import React from 'react';
import { BundleData } from '../types';
import { formatFileSize, getFileColor, getFileIcon } from '../utils/fileUtils';
import { FolderNode } from './types';

interface TreemapPanelProps {
  bundleData: BundleData;
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  onScrollToFile: (filePath: string) => void;
}

export const TreemapPanel: React.FC<TreemapPanelProps> = ({
  bundleData,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  onScrollToFile
}) => {
  const buildFolderStructure = (bundleData: BundleData): FolderNode => {
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

    const getAllFiles = (node: any, currentPath: string = ''): Array<{ name: string; size: number; fullPath: string }> => {
      const files: Array<{ name: string; size: number; fullPath: string }> = [];

      if (node.name && !node.children) {
        files.push({
          name: node.name,
          size: getNodeSize(node),
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
    const allFiles: Array<{ name: string; size: number; fullPath: string }> = [];
    if (bundleData?.tree?.children) {
      bundleData.tree.children.forEach(rootNode => {
        allFiles.push(...getAllFiles(rootNode));
      });
    }

    // Filter files based on visible root folders and zero-byte filter
    const filteredFiles = allFiles.filter(file => {
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
    const totalSize = folder.totalSize;

    // Function to collapse single-child wrapper folders
    const collapseFolders = (folderData: FolderNode): FolderNode => {
      // If this folder has only one child folder and no files, collapse it
      if (folderData.children.length === 1 && folderData.files.length === 0) {
        const child = folderData.children[0];
        const collapsedChild = collapseFolders(child);
        return {
          ...collapsedChild,
          name: folderData.name ? `${folderData.name}/${collapsedChild.name}` : collapsedChild.name,
          path: folderData.path || collapsedChild.path,
          originalPath: collapsedChild.originalPath || collapsedChild.path // Preserve the original path for dependency map matching
        };
      }

      // Otherwise, recursively collapse children
      return {
        ...folderData,
        children: folderData.children.map(child => collapseFolders(child))
      };
    };

    const renderFolder = (folderData: FolderNode, depth: number = 0): JSX.Element => {
      if (folderData.totalSize === 0) {
        return <></>;
      }

      const collapsed = collapseFolders(folderData);
      const allFiles = hideZeroByteFiles
        ? collapsed.files.filter(file => file.size > 0)
        : [...collapsed.files];
      const allFolders = collapsed.children.filter(child => child.totalSize > 0);

      // Sort by size for better layout
      allFiles.sort((a, b) => b.size - a.size);
      allFolders.sort((a, b) => b.totalSize - a.totalSize);

      // Don't show folder wrapper if it's just the root or if it only has files and no meaningful structure
      const showFolderHeader = collapsed.name && collapsed.name !== 'root' &&
        (allFolders.length > 0 || (allFiles.length > 3 && collapsed.totalSize > totalSize * 0.1));

      return (
        <div className={'treemap-folder'} key={collapsed.path}>
          {showFolderHeader && (
            <div className="treemap-folder-header">
              <span className="treemap-folder-name">[{depth}] {collapsed.name}</span>
              <span className="treemap-folder-size">{formatFileSize(collapsed.totalSize)}</span>
            </div>
          )}
          <div style={{
              // display: [4, 5, 6, 7].includes(depth) ? "grid" : "flex",
              display:  "flex",
              flexWrap: "wrap",
              gap: "4px",
              alignItems: "flex-start",
              // gridTemplateColumns: [4, 5, 6, 7].includes(depth) ? "repeat(auto-fit, 1fr)" : "none",
              // gridAutoRows: [4, 5, 6, 7].includes(depth) ? "minmax(15px, auto)" : "none"
          }}>
            {allFolders.map(subfolder => renderFolder(subfolder, depth + 1))}
            {allFiles.map(file => {
              const sizeRatio = Math.max(file.size / totalSize, 0.001); // Minimum size
              const minSize = 20; // Minimum tile size in pixels
              const maxSize = 200; // Maximum tile size in pixels
              const size = Math.max(minSize, Math.min(maxSize, Math.sqrt(sizeRatio) * 300));

              // Get base color and make it lighter for better readability
              const baseColor = getFileColor(file.name);
              const lightColor = baseColor + '80'; // Add transparency for lighter effect

              return (
                <div
                  key={file.fullPath}
                  className={`treemap-file ${selectedNode === file.fullPath ? 'selected' : ''}`}
                  style={{
                    width: `${size*2}px`,
                    height: `${size * 1.75}px`,
                    backgroundColor: lightColor,
                    // border: `1px solid ${baseColor}`,
                    minWidth: `${minSize}px`,
                    minHeight: `${minSize * 0.75}px`
                  }}
                  onClick={() => onScrollToFile(file.fullPath)}
                  title={`${file.name} - ${formatFileSize(file.size)}`}
                >
                  {/* <div className="treemap-file-content"> */}
                    <div className="treemap-file-icon">
                      {getFileIcon(file.name, false)}
                    </div>
                    {/* <div className="treemap-file-name">
                      {file.name.length > 12 ? `${file.name.substring(0, 9)}...` : file.name}
                    </div> */}
                    <div className="treemap-file-size">
                      {formatFileSize(file.size)}
                    </div>
                  {/* </div> */}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return renderFolder(folder, 0);
  };

  if (!bundleData) {
    return null;
  }

  const folderStructure = buildFolderStructure(bundleData);

  return (
    <div className="treemap-panel">
      <div className="side-panel-header">
        <h3>File Size Visualizer</h3>
      </div>
      <div className="treemap-panel-content">
        {renderTreemap(folderStructure)}
      </div>
    </div>
  );
};
