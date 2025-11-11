import { hierarchy as d3Hierarchy, treemap as d3Treemap, treemapSquarify } from 'd3-hierarchy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { BundleData } from '../types';
import { formatFileSize, getFileColor } from '../utils/fileUtils';
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

      // Add file to its folder (keep originalPath so we can label bundle file)
      currentFolder.files.push({
        name: fileName,
        size: file.size,
        fullPath: file.fullPath,
        originalPath: file.originalPath
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
  // Compute folder structure once
  const folderStructure = buildFolderStructure(bundleData, filesToRender);

  // Compute layout with d3-hierarchy treemap only
  const layout = useMemo(() => {
    // derive top-level bundle names from bundleData.tree.children when possible
    const bundleNames = new Set<string>();
    try {
      if (bundleData && bundleData.tree && Array.isArray(bundleData.tree.children)) {
        bundleData.tree.children.forEach((n: any) => {
          const nm = n?.name || n?.path || '';
          if (nm) bundleNames.add(nm);
        });
      } else if (folderStructure && folderStructure.children) {
        folderStructure.children.forEach((c: any) => { if (c?.name) bundleNames.add(c.name); });
      }
    } catch (e) {
      // ignore
    }

    try {
      const rootObj: any = { name: folderStructure.name || 'root', children: [] };
      const folderToNode = (node: FolderNode) => {
        const obj: any = { name: node.name || node.path || '', children: [] };
        node.children.forEach(c => obj.children.push(folderToNode(c)));
        node.files.forEach(f => obj.children.push({ name: f.name, value: f.size, fullPath: f.fullPath, originalPath: (f as any).originalPath }));
        return obj;
      };
      folderStructure.children.forEach((c: any) => rootObj.children.push(folderToNode(c)));

      const root = d3Hierarchy(rootObj).sum((d: any) => d.value || 0);
      const treemapLayout = d3Treemap().size([containerSize.width, containerSize.height]).padding(1).tile(treemapSquarify);
      treemapLayout(root as any);

      const tiles: any[] = [];
      const samples: Record<string, { name: string; size: number; fullPath?: string; originalPath?: string }> = {};

      root.leaves().forEach((leaf: any) => {
        if (!leaf.data || !leaf.data.fullPath) return;
        // group key: prefer top-level (can be extended later)
        const parts = (leaf.data.fullPath || '').split('/').filter(Boolean);
        const groupKey = parts.length ? parts[0] : '(root)';

        tiles.push({
          key: leaf.data.fullPath,
          x: leaf.x0,
          y: leaf.y0,
          w: Math.max(1, leaf.x1 - leaf.x0),
          h: Math.max(1, leaf.y1 - leaf.y0),
          name: leaf.data.name,
          fullPath: leaf.data.fullPath,
          originalPath: leaf.data.originalPath,
          size: leaf.value,
          groupKey
        });

        const cur = samples[groupKey];
        if (!cur || leaf.value > cur.size) {
          samples[groupKey] = { name: leaf.data.name, size: leaf.value, fullPath: leaf.data.fullPath, originalPath: leaf.data.originalPath };
        }
      });

      const labelsMap: Record<string, { x: number; y: number; w: number; h: number; total: number; sample?: string }> = {};
      tiles.forEach(t => {
        const g = t.groupKey;
        if (!labelsMap[g]) labelsMap[g] = { x: t.x, y: t.y, w: t.w, h: t.h, total: 0, sample: samples[g] ? (samples[g].originalPath || samples[g].name) : undefined };
        labelsMap[g].x = Math.min(labelsMap[g].x, t.x);
        labelsMap[g].y = Math.min(labelsMap[g].y, t.y);
        labelsMap[g].w = Math.max(labelsMap[g].w, t.x + t.w - labelsMap[g].x);
        labelsMap[g].h = Math.max(labelsMap[g].h, t.y + t.h - labelsMap[g].y);
        labelsMap[g].total += t.size;
      });

      let labels = Object.keys(labelsMap).map(k => ({ name: k, ...labelsMap[k] }));

      // helper to get basename (always returns string)
      const basename = (s?: string) => {
        if (!s) return '';
        const parts = String(s).split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : String(s);
      };

      // filter labels so only those that match bundle names are shown
      labels = labels.filter(l => {
        const sample = l.sample || '';
        const name = l.name || '';
        return (
          bundleNames.has(sample) ||
          bundleNames.has(basename(sample)) ||
          bundleNames.has(name) ||
          bundleNames.has(basename(name))
        );
      });

      return { tiles, labels, width: containerSize.width, height: containerSize.height };
    } catch (e) {
      console.warn('d3 layout failed', e);
      return { tiles: [], labels: [], width: containerSize.width, height: containerSize.height };
    }
  }, [folderStructure, containerSize.width, containerSize.height, hideZeroByteFiles, bundleData]);

  return (
    <ResizablePanel title="File Size Visualization">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          {layout.tiles.map((t: any) => {
            const baseColor = getFileColor(t.name);
            const lightColor = baseColor + '80';

            return (
              <div
                key={t.key}
                className={`treemap-file ${selectedNode === t.fullPath ? 'selected' : ''} ${hoveredFolder === t.groupKey ? 'hovered-folder' : ''}`}
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  backgroundColor: lightColor,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredFolder(t.groupKey)}
                onMouseLeave={() => setHoveredFolder(null)}
                onClick={() => onScrollToFile(t.fullPath)}
                title={`${t.fullPath} - ${formatFileSize(t.size)}`}
              >
                  {(t.w > 40 && t.h > 40) && <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      top: 4,
                      pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      padding: '1px 6px',
                      fontSize: 10,
                      borderRadius: 3,
                      maxWidth: Math.max(8, (t.w || 0) - 8),
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {t.name.split('.')[0]}
                  </div>}
                  <div className="treemap-file-size">{formatFileSize(t.size)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </ResizablePanel>
  );
};
