import React, { useMemo } from 'react';
import { BundleData } from '../types';
import { buildDependencyMap, checkNodeMatchesLibraryFilters, DependencyMap as SharedDependencyMap } from '../utils/dependencyUtils';
import { formatFileSize, getFileExtension, getFileIcon, getNodeSize } from '../utils/fileUtils';
import { TreeViewBundleMainLibraries } from './TreeView/TreeViewBundleMainLibraries';
import { TreeViewDependencyAsset } from './TreeView/TreeViewDependencyAsset';
import { TreeViewDependencyVendor } from './TreeView/TreeViewDependencyVendor';
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

  console.log('Rendering TreeView with bundleData:', bundleData);

  // Extract dependency relationships from nodeMetas
  const dependencyMap = useMemo((): SharedDependencyMap => {
    return buildDependencyMap(bundleData);
  }, [bundleData]);

  // Function to check if a node matches the current filters
  const nodeMatchesFilters = (node: any, currentPath: string = ''): boolean => {
    return checkNodeMatchesLibraryFilters(node, currentPath, libraryFilters, dependencyMap);
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

    console.log('Rendering node:', nodeId, 'isFolder:', isFolder, 'isBundle:', isBundle, 'bundleInfo:', bundleInfo);

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

            <div className={`tree-label ${isFolder ? 'folder' : ''}`} style={{ flexWrap: 'wrap' }}>
              {node.name}
              <TreeViewBundleMainLibraries
                bundleInfo={bundleInfo}
                libraryFilters={libraryFilters}
                onAddLibraryFilter={onAddLibraryFilter}
                onRemoveLibraryFilter={onRemoveLibraryFilter}
              />
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
              {bundleInfo.isVendor
                ? <TreeViewDependencyVendor {...{ bundleInfo }} />
                : <TreeViewDependencyAsset
                    bundleInfo={bundleInfo}
                    dependencyMap={dependencyMap}
                    libraryFilters={libraryFilters}
                    onAddLibraryFilter={onAddLibraryFilter}
                    onRemoveLibraryFilter={onRemoveLibraryFilter}
                  />}
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

      {sortNodes(bundleData.tree.children
        .filter(rootNode => {
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
        }))
        .map((rootNode: any) => ({
          ...rootNode,
          folder: rootNode.name.split('/')[0] + '/',
          totalSize: getNodeSize(rootNode, bundleData),
          counts: countFiles(rootNode)
        }))
        .map((rootNode: any) => <div key={rootNode.name || rootNode.id} className="tree-root">
          <div className="tree-root-header">
            {JSON.stringify(rootNode)}
            <div className="tree-root-title">
              {rootNode.name || 'Root'}
            </div>
            <div className="tree-root-stats">
              <span className="tree-root-count">
                {formatFileSize(rootNode.totalSize)} | {rootNode.counts.files} files, {rootNode.counts.folders} folders
              </span>
            </div>
          </div>
          {renderTreeNode(rootNode)}
        </div>)}
    </div>
  );
};
