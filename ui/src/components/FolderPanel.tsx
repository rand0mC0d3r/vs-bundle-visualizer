import React from 'react';
import { BundleData } from '../types';
import { formatFileSize, getFileExtension, getFileIcon } from '../utils/fileUtils';
import { FolderNode } from './types';

interface FolderPanelProps {
  bundleData: BundleData;
  expandedFolders: Set<string>;
  selectedFolder: string | null;
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  onToggleFolder: (folderPath: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onScrollToFile: (filePath: string) => void;
}

export const FolderPanel: React.FC<FolderPanelProps> = ({
  bundleData,
  expandedFolders,
  selectedFolder,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  onToggleFolder,
  onSelectFolder,
  onScrollToFile
}) => {
  const buildFolderStructure = (bundleData: BundleData): FolderNode => {
    const root: FolderNode = {
      name: 'root',
      path: '',
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

    // Collapse wrapper folders (folders with only one child folder and no files)
    const collapseWrapperFolders = (folder: FolderNode): FolderNode => {
      // First, recursively process children
      const processedChildren = folder.children.map(child => collapseWrapperFolders(child));

      // Check if this folder can be collapsed
      const shouldCollapse = processedChildren.length === 1 &&
                           folder.files.length === 0 &&
                           folder.name !== 'root'; // Don't collapse the root folder

      if (shouldCollapse) {
        const onlyChild = processedChildren[0];
        // Create a collapsed folder with combined path
        const collapsedName = `${folder.name}/${onlyChild.name}`;
        return {
          ...onlyChild,
          name: collapsedName,
          path: onlyChild.path // Keep the original path for expansion logic
        };
      }

      return {
        ...folder,
        children: processedChildren
      };
    };

    const collapsedRoot = collapseWrapperFolders(root);

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

      const cleanedRoot = removeEmptyFolders(collapsedRoot);
      // Recalculate sizes after cleaning
      calculateFolderSize(cleanedRoot);
      return cleanedRoot;
    }

    return collapsedRoot;
  };

  const renderFolderTree = (folder: FolderNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(folder.path);
    const isSelected = selectedFolder === folder.path;
    const hasChildren = folder.children.length > 0 || folder.files.length > 0;

    return (
      <div key={folder.path} className="folder-node">
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: level * 16 + 4 }}
          onClick={() => onSelectFolder(folder.path)}
        >
          <div className="tree-item-content">
            {hasChildren && (
              <div
                className={`tree-icon expandable`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(folder.path);
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </div>
            )}
            {!hasChildren && <div className="tree-icon" />}

            <div className="tree-icon folder">
              {getFileIcon(folder.name, true)}
            </div>

            <div className="tree-label folder">
              {(() => {
                const displayName = folder.name || 'Root';
                if (displayName.includes('/')) {
                  // Split the collapsed path to show the last part normally and the rest dimmed
                  const pathParts = displayName.split('/');
                  const lastPart = pathParts.pop();
                  const collapsedPath = pathParts.join('/');

                  return (
                    <>
                      <span>{collapsedPath}</span>
                      <span className="path-separator"> / </span>
                      <span className="collapsed-path">{lastPart}</span>
                    </>
                  );
                }
                return displayName;
              })()}
            </div>

            <div className="tree-size">
              {formatFileSize(folder.totalSize)}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {folder.children.map(child => renderFolderTree(child, level + 1))}
            {folder.files.map(file => (
              <div
                key={file.fullPath}
                className={`tree-item ${selectedFolder === file.fullPath || selectedNode === file.fullPath ? 'selected' : ''}`}
                style={{ paddingLeft: (level + 1) * 16 + 4 }}
                onClick={() => onScrollToFile(file.fullPath)}
              >
                <div className="tree-item-content">
                  <div className="tree-icon" />
                  <div className={`tree-icon file ${getFileExtension(file.name)}`}>
                    {getFileIcon(file.name, false)}
                  </div>
                  <div className="tree-label">
                    {file.name}
                  </div>
                  <div className="tree-size">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!bundleData) {
    return null;
  }

  const folderStructure = buildFolderStructure(bundleData);

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h3>Folder Structure</h3>
      </div>
      <div className="side-panel-content">
        {renderFolderTree(folderStructure)}
      </div>
    </div>
  );
};
