import potpack from 'potpack';
import React, { useEffect, useRef, useState } from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { BundleData } from '../types';
import { formatFileSize, getFileColor, getFileIcon } from '../utils/fileUtils';
import { ResizablePanel } from './General/ResizablePanel';
import { FolderNode } from './types';

interface TreemapPanelProps {
  bundleData: BundleData;
  libraryFilters: string[];
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  onScrollToFile: (filePath: string) => void;
}

export const TreemapPanel: React.FC<TreemapPanelProps> = ({
  bundleData,
  libraryFilters,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  onScrollToFile
}) => {
  if (!bundleData) {
    return null as any;
  }

  const { filesToRender } = useFilteredNodes(bundleData, hiddenRootFolders, 'filename', 'asc', libraryFilters);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 });
    });
    ro.observe(el);
    // initialize
    setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  const buildFolderStructure = (bundleData: BundleData, filesToRender: any[]): FolderNode => {
    const root: FolderNode = {
      name: 'root',
      path: '',
      originalPath: '',
      children: [],
      files: [],
      totalSize: 0
    };


    const folderMap = new Map<string, FolderNode>();
    folderMap.set('', root);

    const isRootFolderVisible = (rootFolderName: string): boolean => {
      return !hiddenRootFolders.has(rootFolderName);
    };

    const getNodeSize = (node: any): number => {
      if (node.value) {
        return node.value;
      }
      if (node.uid && bundleData.nodeParts && bundleData.nodeParts[node.uid]) {
        return bundleData.nodeParts[node.uid].renderedLength;
      }
      if (node.children && node.children.length > 0) {
        return node.children.reduce((total: number, child: any) => total + getNodeSize(child), 0);
      }
      return 0;
    };

    const getAllFiles = (node: any, currentPath: string = ''): Array<{ name: string; size: number; originalPath: string; fullPath: string }> => {
      const files: Array<{ name: string; size: number; originalPath: string; fullPath: string }> = [];

      if (node.name && !node.children) {
        files.push({
          name: node.name,
          size: getNodeSize(node),
          originalPath: currentPath.split('.js')[0] + '.js',
          fullPath: currentPath ? `${currentPath}/${node.name}` : node.name
        });
      }

      if (node.children) {
        node.children.forEach((child: any) => {
          files.push(...getAllFiles(child, currentPath ? `${currentPath}/${node.name}` : node.name));
        });
      }

      return files;
    };

  // Extract all files from bundle data
  const allFiles: Array<{ name: string; size: number; originalPath: string; fullPath: string }> = [];
    if (bundleData?.tree?.children) {
      bundleData.tree.children.forEach(rootNode => {
        allFiles.push(...getAllFiles(rootNode));
      });
    }

  // Filter files based on filesToRender (from the hook) and visible root folders

    // Filter files based on visible root folders and zero-byte filter
    const filteredFiles = allFiles.filter(file => filesToRender.find((f: any) => f.name === file.originalPath))
    .filter(file => {
      const firstSlash = file.fullPath.indexOf('/');
      const topLevelFolder = firstSlash > 0 ? file.fullPath.substring(0, firstSlash) : '(root)';
      const isVisible = isRootFolderVisible(topLevelFolder);
      const isNotZeroByte = !hideZeroByteFiles || file.size > 0;
      return isVisible && isNotZeroByte;
    });

    // Build folder structure
    filteredFiles.forEach(file => {
      const pathParts = file.fullPath.split('/');
      const fileName = pathParts.pop() || '';
      let currentPath = '';
      let currentFolder = root;

      // Create folder hierarchy
      pathParts.forEach(folderName => {
        const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;

        if (!folderMap.has(newPath)) {
          const newFolder: FolderNode = {
            name: folderName,
            path: newPath,
            originalPath: newPath, // Initially, originalPath is the same as path
            children: [],
            files: [],
            totalSize: 0
          };
          folderMap.set(newPath, newFolder);
          currentFolder.children.push(newFolder);
        }

        currentFolder = folderMap.get(newPath)!;
        currentPath = newPath;
      });

      // Add file to its folder
      currentFolder.files.push({
        name: fileName,
        size: file.size,
        fullPath: file.fullPath
      });
    });

  // Calculate total sizes
    const calculateFolderSize = (folder: FolderNode): number => {
      const fileSize = folder.files.reduce((sum, file) => sum + file.size, 0);
      const childrenSize = folder.children.reduce((sum, child) => sum + calculateFolderSize(child), 0);
      folder.totalSize = fileSize + childrenSize;
      return folder.totalSize;
    };

    calculateFolderSize(root);

    // Remove empty folders if filter is enabled
    if (hideZeroByteFiles) {
      const removeEmptyFolders = (folder: FolderNode): FolderNode => {
        // First, recursively clean children
        const cleanedChildren = folder.children
          .map(child => removeEmptyFolders(child))
          .filter(child => child.totalSize > 0 || child.files.length > 0 || child.children.length > 0);

        return {
          ...folder,
          children: cleanedChildren
        };
      };

      const cleanedRoot = removeEmptyFolders(root);
      // Recalculate sizes after cleaning
      calculateFolderSize(cleanedRoot);
      return cleanedRoot;
    }

    return root;
  };

  const renderTreemap = (folder: FolderNode): JSX.Element => {
    // We'll create a grouped global layout:
    // 1) collect all visible files and group them by top-level folder
    // 2) for each top-level folder, potpack its files to get local boxes
    // 3) potpack the folder boxes to get global positions
    // 4) scale everything to fit the measured container

    // collect all files with their top-level folder
    const filesList: Array<{ name: string; size: number; fullPath: string; rootFolder: string; parentFolder: string }> = [];

    const walk = (node: FolderNode, parentPath: string) => {
      const path = node.path || parentPath;
      node.files.forEach(f => {
        const firstSlash = f.fullPath.indexOf('/');
        const top = firstSlash > 0 ? f.fullPath.substring(0, firstSlash) : '(root)';
        filesList.push({ name: f.name, size: f.size, fullPath: f.fullPath, rootFolder: top, parentFolder: path });
      });
      node.children.forEach(c => walk(c, path));
    };

    walk(folder, '');

    // group by rootFolder
    const groups = new Map<string, typeof filesList>();
    filesList.forEach(f => {
      if (!groups.has(f.rootFolder)) groups.set(f.rootFolder, [] as any);
      groups.get(f.rootFolder)!.push(f);
    });

    // pack each group's files locally
    const folderBoxes: Array<any> = [];
    const folderMeta: Record<string, any> = {};

    groups.forEach((groupFiles, folderName) => {
      // create boxes scaled by file.size
      const minSide = 18;
      const targetArea = Math.max(4000, groupFiles.reduce((s, f) => s + f.size, 0));
      const sideScale = Math.sqrt(targetArea) / Math.max(1, Math.sqrt(groupFiles.length || 1));

      const boxes = groupFiles.map(f => {
        const area = Math.max(1, (f.size / Math.max(1, groupFiles.reduce((s, x) => s + x.size, 0))) * (sideScale * sideScale * groupFiles.length));
        const side = Math.max(minSide, Math.sqrt(area));
        return { w: side, h: side, meta: f };
      });

      const packed = boxes.length > 0 ? potpack(boxes) : { w: Math.max(150, sideScale), h: Math.max(150, sideScale), fill: 0 };

      folderBoxes.push({ w: packed.w + 10, h: packed.h + 10, meta: { folderName, boxes, packed } });
      folderMeta[folderName] = { boxes, packed };
    });

    // pack folders globally
    const packedFolders = folderBoxes.length > 0 ? potpack(folderBoxes) : { w: 800, h: 600, fill: 0 };

    const scale = Math.min(containerSize.width / Math.max(1, packedFolders.w), containerSize.height / Math.max(1, packedFolders.h), 1);

    // Collect file elements with absolute positions
    const fileElements: JSX.Element[] = [];

    folderBoxes.forEach((fb) => {
      const folderX = (fb.x || 0) * scale;
      const folderY = (fb.y || 0) * scale;
      const { meta } = fb;
      const { boxes, packed } = meta as any;

      const innerScale = Math.min((fb.w - 10) / Math.max(1, packed.w), (fb.h - 10) / Math.max(1, packed.h), 1) * scale;

      boxes.forEach((b: any) => {
        const file = b.meta;
        const x = Math.round((b.x || 0) * innerScale + folderX + 5);
        const y = Math.round((b.y || 0) * innerScale + folderY + 5);
        const w = Math.max(10, Math.round(b.w * innerScale));
        const h = Math.max(10, Math.round(b.h * innerScale));
        const baseColor = getFileColor(file.name);
        const lightColor = baseColor + '80';

        fileElements.push(
          <div
            key={file.fullPath}
            className={`treemap-file ${selectedNode === file.fullPath ? 'selected' : ''} ${hoveredFolder === file.rootFolder ? 'hovered-folder' : ''}`}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              backgroundColor: lightColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredFolder(file.rootFolder)}
            onMouseLeave={() => setHoveredFolder(null)}
            onClick={() => onScrollToFile(file.fullPath)}
            title={`${file.fullPath} - ${formatFileSize(file.size)}`}
          >
            <div className="treemap-file-icon">{getFileIcon(file.name, false)}</div>
            <div className="treemap-file-size">{formatFileSize(file.size)}</div>
          </div>
        );
      });
    });

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {fileElements}
      </div>
    );
  };

  const folderStructure = buildFolderStructure(bundleData, filesToRender);

  return (
    <ResizablePanel title="File Size Visualization">
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {renderTreemap(folderStructure)}
      </div>
    </ResizablePanel>
  );
};
