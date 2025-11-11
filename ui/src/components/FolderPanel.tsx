import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BundleData } from '../types';
import { buildDependencyMap, checkFileMatchesLibraryFilters, checkFolderMatchesLibraryFilters, DependencyMap as SharedDependencyMap } from '../utils/dependencyUtils';
import { formatFileSize, getFileExtension, getFileIcon } from '../utils/fileUtils';
import { ResizablePanel } from './General/ResizablePanel';
import { FolderNode } from './types';

interface FolderPanelProps {
  bundleData: BundleData;
  expandedFolders: Set<string>;
  selectedFolder: string | null;
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  libraryFilters: string[];
  onToggleFolder: (folderPath: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onScrollToFile: (filePath: string) => void;
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
  // Optional bulk setter to update expanded folders in one go (used by slider)
  onSetExpandedFolders?: (folders: Set<string>) => void;
}

export const FolderPanel: React.FC<FolderPanelProps> = ({
  bundleData,
  expandedFolders,
  selectedFolder,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  libraryFilters,
  onToggleFolder,
  onSelectFolder,
  onScrollToFile,
  onAddLibraryFilter,
  onRemoveLibraryFilter,
  onSetExpandedFolders
}) => {
  // Extract dependency relationships from nodeMetas (similar to TreeView)
  const dependencyMap = useMemo((): SharedDependencyMap => {
    return buildDependencyMap(bundleData);
  }, [bundleData]);

  // Function to check if a file matches the current library filters
  const fileMatchesLibraryFilters = (filePath: string): boolean => {
    return checkFileMatchesLibraryFilters(filePath, libraryFilters, dependencyMap);
  };

  // Function to check if a folder should be visible based on library filters
  const folderMatchesLibraryFilters = (folder: FolderNode): boolean => {
    return checkFolderMatchesLibraryFilters(folder.path, folder.originalPath, libraryFilters, dependencyMap);
  };

  // Function to check if a folder or its contents should be visible
  const shouldShowFolder = (folder: FolderNode): boolean => {
    // If no filters, show everything
    if (libraryFilters.length === 0) {
      return true;
    }

    // Check if the folder itself matches
    if (folderMatchesLibraryFilters(folder)) {
      return true;
    }

    // Check if any files in the folder match
    const hasMatchingFiles = folder.files.some(file => fileMatchesLibraryFilters(file.fullPath));
    if (hasMatchingFiles) {
      return true;
    }

    // Check if any child folders should be shown (recursive)
    const hasMatchingChildren = folder.children.some(child => shouldShowFolder(child));
    return hasMatchingChildren;
  };

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

    // Filter files based on visible root folders, zero-byte filter, and library filters
    const filteredFiles = allFiles.filter(file => {
      const firstSlash = file.fullPath.indexOf('/');
      const topLevelFolder = firstSlash > 0 ? file.fullPath.substring(0, firstSlash) : '(root)';
      const isVisible = isRootFolderVisible(topLevelFolder);
      const isNotZeroByte = !hideZeroByteFiles || file.size > 0;
      const matchesLibraryFilter = fileMatchesLibraryFilters(file.fullPath);
      return isVisible && isNotZeroByte && matchesLibraryFilter;
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
          path: onlyChild.path, // Keep the original path for expansion logic
          originalPath: onlyChild.originalPath || onlyChild.path // Preserve the original path for dependency map matching
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

    // Check if there are any visible children or files after filtering
    const visibleChildren = folder.children.filter(child => shouldShowFolder(child));
    const visibleFiles = folder.files.filter(file => fileMatchesLibraryFilters(file.fullPath));
    const hasChildren = visibleChildren.length > 0 || visibleFiles.length > 0;

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
                  const collapsedPath = pathParts[0];

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
            {visibleChildren.map(child => renderFolderTree(child, level + 1))}
            {visibleFiles.map(file => {
              const bundleInfo = dependencyMap[file.fullPath];
              const isBundle = !!bundleInfo;

              return (
                <div
                  key={file.fullPath}
                  className={`tree-item ${selectedFolder === file.fullPath || selectedNode === file.fullPath ? 'selected' : ''} ${isBundle ? 'bundle-item' : ''}`}
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
                      {bundleInfo?.mainLibrary && (
                        <span
                          className={`main-library clickable ${libraryFilters.includes(bundleInfo.mainLibrary) ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (libraryFilters.includes(bundleInfo.mainLibrary!)) {
                              onRemoveLibraryFilter(bundleInfo.mainLibrary!);
                            } else {
                              onAddLibraryFilter(bundleInfo.mainLibrary!);
                            }
                          }}
                          title={`${libraryFilters.includes(bundleInfo.mainLibrary!) ? 'Remove' : 'Add'} filter: ${bundleInfo.mainLibrary}`}
                        >
                          ({bundleInfo.mainLibrary})
                        </span>
                      )}
                    </div>
                    <div className="tree-size">
                      {formatFileSize(file.size)}
                    </div>
                  </div>

                  {/* Show dependency information for bundle files */}
                  {bundleInfo && (
                    <div className="dependency-info" style={{ paddingLeft: (level + 2) * 16 + 24 }}>
                      {bundleInfo.isVendor ? (
                        // Vendor bundle - show what assets use it
                        bundleInfo.consumers.length > 0 && (
                          <div className="dependency-section">
                            <div className="dependency-list">
                              {bundleInfo.consumers.map(consumer => (
                                <span key={consumer} className="dependency-item consumer-item">
                                  {consumer.replace('assets/', '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        // Asset bundle - show what vendors it depends on
                        bundleInfo.dependencies.length > 0 && (
                          <div className="dependency-section">
                            <div className="dependency-list">
                              {bundleInfo.dependencies.map(dep => {
                                const depInfo = dependencyMap[dep];
                                const libraryName = depInfo?.mainLibrary || dep.replace('vendor/vendor__', '').replace('.js', '');
                                const isActive = depInfo?.mainLibrary && libraryFilters.includes(depInfo.mainLibrary);
                                return (
                                  <span
                                    key={dep}
                                    className={`dependency-item dependency-item-vendor clickable ${isActive ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (depInfo?.mainLibrary) {
                                        if (isActive) {
                                          onRemoveLibraryFilter(depInfo.mainLibrary);
                                        } else {
                                          onAddLibraryFilter(depInfo.mainLibrary);
                                        }
                                      }
                                    }}
                                    title={`${isActive ? 'Remove' : 'Add'} filter: ${libraryName}`}
                                  >
                                    {libraryName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!bundleData) {
    return null;
  }

  const folderStructure = buildFolderStructure(bundleData);
  // Compute depth map and max depth for the folder tree (root = 0)
  const { depthMap, computedMaxDepth } = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    const traverse = (node: FolderNode, depth: number) => {
      map.set(node.path, depth);
      if (depth > max) max = depth;
      node.children.forEach(child => traverse(child, depth + 1));
    };
    traverse(folderStructure, 0);
    return { depthMap: map, computedMaxDepth: max };
  }, [folderStructure]);

  const [selectedDepth, setSelectedDepth] = useState<number>(0);
  const skipInitialRef = useRef(true);

  // Initialize slider to max depth when the structure changes, but don't trigger toggles on mount
  useEffect(() => {
    setSelectedDepth(1);
  }, [computedMaxDepth]);

  // When the selected depth changes, compute which folders should be expanded and toggle as needed
  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }

    // Build desired set: all folder paths with depth <= selectedDepth and that have children
    const desired = new Set<string>();
    const collect = (node: FolderNode) => {
      const depth = depthMap.get(node.path) ?? 0;
      if (node.children && node.children.length > 0 && depth <= selectedDepth) {
        // skip toggling root ('') to avoid strange UX; include if you prefer
        if (node.path !== '') desired.add(node.path);
      }
      node.children.forEach(child => collect(child));
    };
    collect(folderStructure);

    // Current expanded folders is a Set passed from parent
    const currentlyExpanded = new Set<string>(expandedFolders);

    // If parent provided a bulk setter, use it to replace the set in one update
    if (onSetExpandedFolders) {
      const newExpanded = new Set<string>(desired);
      // Keep any currently expanded root (empty string) if present
      if (currentlyExpanded.has('')) newExpanded.add('');
      onSetExpandedFolders(newExpanded);
    } else {
      // Folders to expand: in desired but not currently expanded
      const toExpand = Array.from(desired).filter(p => !currentlyExpanded.has(p));
      // Folders to collapse: currently expanded but not desired
      const toCollapse = Array.from(currentlyExpanded).filter(p => !desired.has(p));

      // First expand (so nested toggles won't immediately collapse), then collapse extras
      toExpand.forEach(path => onToggleFolder(path));
      toCollapse.forEach(path => onToggleFolder(path));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepth]);

  return (
    <ResizablePanel title="Folder Structure" titleChildren={<div className="folder-panel-controls">
        <label style={{ display: 'flex',  alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, lineHeight: 1, color: '#666' }}>Nesting level:</span>
          <input
            type="range"
            min={0}
            max={computedMaxDepth}
            value={selectedDepth}
            onChange={(e) => setSelectedDepth(Number(e.target.value))}
            style={{  margin: 0, width: '100px', fontSize: 10}}
          />
          <span style={{ minWidth: 32, lineHeight: 1, textAlign: 'right', fontSize: 12 }}>{selectedDepth}</span>
        </label>
      </div>}>

      {renderFolderTree(folderStructure)}
    </ResizablePanel>
  );
};
