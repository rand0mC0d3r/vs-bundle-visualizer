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
  onToggleNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
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
  onToggleNode,
  onSelectNode
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
    });    return map;
  }, [bundleData]);

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

    // Check if this is a bundle file and get dependency info
    const bundleInfo = dependencyMap[node.name];
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
                <span className="main-library"> ({bundleInfo.mainLibrary})</span>
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
                    <div className="dependency-label">📦 Used by:</div>
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
                    <div className="dependency-label">🔗 Dependencies:</div>
                    <div className="dependency-list">
                      {bundleInfo.dependencies.map(dep => {
                        const depInfo = dependencyMap[dep];
                        return (
                          <span key={dep} className="dependency-item dependency-item-vendor">
                            {depInfo?.mainLibrary || dep.replace('vendor/vendor__', '').replace('.js', '')}
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
              if (hideZeroByteFiles) {
                const childSize = getNodeSize(child, bundleData);
                return childSize > 0;
              }
              return true;
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
      {sortNodes(bundleData.tree.children.filter(rootNode => {
        // Check if any file in this root node belongs to a visible folder
        const hasVisibleFiles = (node: any, currentPath: string = ''): boolean => {
          if (node.name && !node.children) {
            // This is a file - check if its top-level folder is visible
            const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
            const firstSlash = fullPath.indexOf('/');
            const topLevelFolder = firstSlash > 0 ? fullPath.substring(0, firstSlash) : '(root)';
            return isRootFolderVisible(topLevelFolder);
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
                <span className="tree-root-size">
                  {formatFileSize(totalSize)}
                </span>
                <span className="tree-root-count">
                  {counts.files} files, {counts.folders} folders
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
