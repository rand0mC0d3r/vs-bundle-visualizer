import React, { useMemo } from 'react';
import { BundleData } from '../types';
import { formatFileSize, getFileExtension, getFileIcon, getNodeSize } from '../utils/fileUtils';
import { SortCriteria, SortDirection } from './types';

interface TreeViewProps {
  bundleData: BundleData;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  sortCriteria: SortCriteria;
  sortDirection: SortDirection;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  libraryFilters: string[];
  onToggleNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
}

interface DependencyInfo {
  consumers: string[];
  dependencies: string[];
  isVendor: boolean;
  mainLibrary?: string;
}

interface DependencyMap {
  [nodeName: string]: DependencyInfo;
}

export const TreeView: React.FC<TreeViewProps> = ({
  bundleData,
  expandedNodes,
  selectedNode,
  sortCriteria,
  sortDirection,
  hideZeroByteFiles,
  hiddenRootFolders,
  libraryFilters,
  onToggleNode,
  onSelectNode,
  onAddLibraryFilter,
  onRemoveLibraryFilter
}) => {

  // Extract dependency relationships from nodeMetas
  const dependencyMap = useMemo((): DependencyMap => {
    const map: DependencyMap = {};

    if (!bundleData.nodeMetas) return map;

    // First pass: identify vendor vs asset bundles and create base entries
    Object.entries(bundleData.nodeMetas).forEach(([, meta]: [string, any]) => {
      const bundleName = Object.keys(meta.moduleParts || {})[0];
      if (!bundleName) return;

      const isVendor = bundleName.startsWith('vendor/');
      const isAsset = bundleName.startsWith('assets/');

      if (isVendor || isAsset) {
        if (!map[bundleName]) {
          map[bundleName] = {
            consumers: [],
            dependencies: [],
            isVendor,
            mainLibrary: undefined
          };
        }

        // Extract main library name for vendor bundles
        if (isVendor && meta.id) {
          const libMatch = meta.id.match(/node_modules\/([^\/]+)/);
          if (libMatch && !map[bundleName].mainLibrary) {
            map[bundleName].mainLibrary = libMatch[1];
          }
        }
      }
    });

    // Second pass: map dependencies between bundles
    Object.entries(bundleData.nodeMetas).forEach(([, meta]: [string, any]) => {
      const bundleName = Object.keys(meta.moduleParts || {})[0];
      if (!bundleName) return;

      const isAsset = bundleName.startsWith('assets/');

      if (isAsset && meta.imported) {
        // Asset bundle importing from vendors
        meta.imported.forEach((imported: any) => {
          const importedMeta = bundleData.nodeMetas?.[imported.uid];
          if (importedMeta) {
            const importedBundle = Object.keys(importedMeta.moduleParts || {})[0];
            if (importedBundle && importedBundle.startsWith('vendor/')) {
              if (!map[bundleName].dependencies.includes(importedBundle)) {
                map[bundleName].dependencies.push(importedBundle);
              }
              if (!map[importedBundle].consumers.includes(bundleName)) {
                map[importedBundle].consumers.push(bundleName);
              }
            }
          }
        });
      }
    });

    return map;
  }, [bundleData, libraryFilters]);

  // Function to check if a node matches the current filters
  const nodeMatchesFilters = (node: any, currentPath: string = ''): boolean => {
    // No filters means show everything
    if (libraryFilters.length === 0) return true;

    // Construct the full path for this node
    const fullPath = currentPath

    // Check if this node corresponds to a bundle file
    const bundleInfo = dependencyMap[fullPath];


    // If this is a bundle file (has bundle info)
    if (bundleInfo) {
      // For vendor bundles, check if the main library matches any filter
      if (bundleInfo.isVendor && bundleInfo.mainLibrary) {

        return libraryFilters.includes(bundleInfo.mainLibrary);
      }

      // For asset bundles, check if any of their dependencies match the filters
      if (!bundleInfo.isVendor && bundleInfo.dependencies.length > 0) {
        return bundleInfo.dependencies.some(dep => {
          const depInfo = dependencyMap[dep];
          return depInfo?.mainLibrary && libraryFilters.includes(depInfo.mainLibrary);
        });
      }

      // If it's a bundle but doesn't match any filter, hide it
      return false;
    }

    // For non-bundle nodes (folders, internal files), check if they contain matching children
    if (node.children && node.children.length > 0) {
      return node.children.some((child: any) => nodeMatchesFilters(child, fullPath));
    }

    // For leaf nodes that aren't bundles, show them (they're internal files within matching bundles)
    return false;
  };

  const sortNodes = (nodes: any[]): any[] => {
    return [...nodes].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortCriteria) {
        case 'filename':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'fileCount':
          aValue = countFiles(a).files + countFiles(a).folders;
          bValue = countFiles(b).files + countFiles(b).folders;
          break;
        case 'fileSize':
          aValue = getNodeSize(a, bundleData);
          bValue = getNodeSize(b, bundleData);
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortCriteria === 'filename') {
        // String comparison
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      } else {
        // Numeric comparison
        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
    });
  };

  const countFiles = (node: any): { files: number; folders: number } => {
    if (!node.children || node.children.length === 0) {
      return { files: 1, folders: 0 };
    }

    return node.children.reduce(
      (acc: { files: number; folders: number }, child: any) => {
        const childCounts = countFiles(child);
        return {
          files: acc.files + childCounts.files,
          folders: acc.folders + childCounts.folders + (child.children ? 1 : 0)
        };
      },
      { files: 0, folders: 0 }
    );
  };

  const isRootFolderVisible = (rootFolderName: string): boolean => {
    return !hiddenRootFolders.has(rootFolderName);
  };

  const renderTreeNode = (node: any, path: string = '', level: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const isFolder = hasChildren;
    const nodeId = `${path}/${node.name}`.replace(/^\//, '');
    const isExpanded = expandedNodes.has(nodeId);
    const isSelected = selectedNode === nodeId;
    const nodeSize = getNodeSize(node, bundleData);

    // Check if this is a bundle file and get dependency info using the full path
    const fullPath = nodeId; // nodeId is the full path
    const bundleInfo = dependencyMap[fullPath];
    const isBundle = !!bundleInfo;

    return (
      <div key={nodeId} className="tree-node" data-file-path={nodeId}>
        <div
          className={`tree-item ${isSelected ? 'selected' : ''} ${isBundle ? 'bundle-item' : ''}`}
          style={{ paddingLeft: level * 16 + 4 }}
          onClick={() => onSelectNode(nodeId)}
        >
          <div className="tree-item-content">
            {hasChildren && (
              <div
                className={`tree-icon expandable ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNode(nodeId);
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </div>
            )}
            {!hasChildren && <div className="tree-icon" />}

            <div className={`tree-icon ${isFolder ? 'folder' : 'file'} ${getFileExtension(node.name)}`}>
              {getFileIcon(node.name, isFolder)}
            </div>

            <div className={`tree-label ${isFolder ? 'folder' : ''}`}>
              {node.name}
              {bundleInfo?.mainLibrary && (
                <span
                  className="main-library clickable"
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

            {nodeSize > 0 && (
              <div className="tree-size">
                {formatFileSize(nodeSize)}
              </div>
            )}
          </div>

          {/* Show dependency information for bundle files */}
          {bundleInfo && (
            <div className="dependency-info" style={{ paddingLeft: (level + 1) * 16 + 24 }}>
              {bundleInfo.isVendor ? (
                // Vendor bundle - show what assets use it
                bundleInfo.consumers.length > 0 && (
                  <div className="dependency-section">
                    {/* <div className="dependency-label">📦 Used by:</div> */}
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
                    {/* <div className="dependency-label">🔗 Dependencies:</div> */}
                    <div className="dependency-list">
                      {bundleInfo.dependencies.map(dep => {
                        const depInfo = dependencyMap[dep];
                        const libraryName = depInfo?.mainLibrary || dep.replace('vendor/vendor__', '').replace('.js', '');
                        return (
                          <span
                            key={dep}
                            className="dependency-item dependency-item-vendor clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (depInfo?.mainLibrary) {
                                onAddLibraryFilter(depInfo.mainLibrary);
                              }
                            }}
                            title={`Filter by ${libraryName}`}
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

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {sortNodes(node.children.filter((child: any) => {
              let shouldShow = true;

              if (hideZeroByteFiles) {
                const childSize = getNodeSize(child, bundleData);
                shouldShow = childSize > 0;
              }

              // Apply library filtering
              if (shouldShow) {
                shouldShow = nodeMatchesFilters(child, nodeId);
              }

              return shouldShow;
            })).map((child: any) =>
              renderTreeNode(child, nodeId, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (!bundleData?.tree?.children) {
    return <div className="tree-container">No data available</div>;
  }

  return (
    <div className="tree-container">
      {/* Library Filters Header */}
      {libraryFilters.length > 0 && (
        <div className="library-filters-header">
          <div className="library-filters-label">Filtering by libraries:</div>
          <div className="library-filters-list">
            {libraryFilters.map(filter => (
              <span
                key={filter}
                className="library-filter-item"
                onClick={() => onRemoveLibraryFilter(filter)}
                title={`Remove filter: ${filter}`}
              >
                {filter} ×
              </span>
            ))}
          </div>
        </div>
      )}

      {sortNodes(bundleData.tree.children.filter(rootNode => {
        // Check if any file in this root node belongs to a visible folder and matches filters
        const hasVisibleFiles = (node: any, currentPath: string = ''): boolean => {
          if (node.name && !node.children) {
            // This is a file - check if its top-level folder is visible
            const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
            const firstSlash = fullPath.indexOf('/');
            const topLevelFolder = firstSlash > 0 ? fullPath.substring(0, firstSlash) : '(root)';
            const isVisible = isRootFolderVisible(topLevelFolder);

            // Also check if it matches library filters
            return isVisible && nodeMatchesFilters(node, currentPath);
          }

          if (node.children) {
            return node.children.some((child: any) =>
              hasVisibleFiles(child, currentPath ? `${currentPath}/${node.name}` : node.name)
            );
          }

          return false;
        };

        return hasVisibleFiles(rootNode);
      })).map((rootNode: any) => {
        const totalSize = getNodeSize(rootNode, bundleData);
        const counts = countFiles(rootNode);

        return (
          <div key={rootNode.name || rootNode.id} className="tree-root">
            <div className="tree-root-header">
              <div className="tree-root-title">
                {rootNode.name || 'Root'}
              </div>
              <div className="tree-root-stats">
                <span className="tree-root-count">
                  {formatFileSize(totalSize)} | {counts.files} files, {counts.folders} folders
                </span>
              </div>
            </div>
            {renderTreeNode(rootNode)}
          </div>
        );
      })}
    </div>
  );
};
