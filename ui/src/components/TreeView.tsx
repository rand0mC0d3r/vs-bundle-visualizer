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

  // Extract dependency relationships from nodeMetas
  const dependencyMap = useMemo((): SharedDependencyMap => {
    return buildDependencyMap(bundleData);
  }, [bundleData]);

  // Function to check if a node matches the current filters
  const nodeMatchesFilters = (node: any, currentPath: string = ''): boolean => {
    return checkNodeMatchesLibraryFilters(node, currentPath,libraryFilters, dependencyMap);
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

  const uniqueAssetDependencies = [
    ...new Set(
      Object.values(dependencyMap)
        .filter(info => !info.isVendor && info.dependencies.length)
        .flatMap(info => info.dependencies)
        .map(dep =>
          dependencyMap[dep]?.mainLibrary ||
          dep.replace(/^vendor\/vendor__/, '').replace(/\.js$/, '').split('-')[0]
        )
    ),
  ];

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

            <div className={`tree-label ${isFolder ? 'folder' : ''}`} style={{ display: 'flex', flexDirection: 'column', flexWrap: 'wrap' }}>
              {node.name}
              <TreeViewBundleMainLibraries
                bundleInfo={bundleInfo}
                libraryFilters={libraryFilters}
                onAddLibraryFilter={onAddLibraryFilter}
                onRemoveLibraryFilter={onRemoveLibraryFilter}
                uniqueAssetDependencies={uniqueAssetDependencies}
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

  const filesToRender = sortNodes(bundleData.tree.children)
    .map((rootNode: any) => ({
      ...rootNode,
      folder: rootNode.name.split('/')[0],
      fileName: rootNode.name.split('/').slice(1).join('/'),
      hashed: rootNode.name.split('-')[1].split('.')[0] || '',
      totalSize: getNodeSize(rootNode, bundleData),
      counts: countFiles(rootNode)
    }))
    .filter(rootNode => isRootFolderVisible(rootNode.folder))
    .filter(rootNode => {
      if(libraryFilters.length === 0) {
        return true
      }

      const bundleInfo = dependencyMap[rootNode.name];

      if (bundleInfo) {
        if(bundleInfo.isVendor) {
          return libraryFilters.some(lf => bundleInfo.mainLibraries?.some(ml => ml === lf))
        } else {
          const parsedDependencies = bundleInfo.dependencies.map(dep =>
            dependencyMap[dep]?.mainLibrary ||
            dep.replace(/^vendor\/vendor__/, '').replace(/\.js$/, '').split('-')[0]
          )
          return libraryFilters.some(lf => parsedDependencies.some(pd => pd === lf))
        }
      }

      return false
    });

  const groupFilesByFolder = filesToRender.reduce((acc: any, file: any) => {
    const folderName = file.folder || 'Root';
    if (!acc[folderName]) {
      acc[folderName] = [];
    }
    acc[folderName].push(file);
    return acc;
  }, {});

  const sortedGroupedFiles = Object.keys(groupFilesByFolder).sort().reduce((acc: any, folderName: string) => {
    acc[folderName] = groupFilesByFolder[folderName];
    return acc;
  }, {});

  return <>
    {filesToRender.length > 0 && <div className="tree-container" style={{ padding: '8px' }}>
      {filesToRender.length}
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

      {Object.entries(sortedGroupedFiles).map(([folderName, files]: [string, any]) => <div key={folderName} className="tree-root">
          <div className="tree-root-header">
            <div className="tree-root-title">
              {folderName}
            </div>
            <div className="tree-root-stats">
              <span className="tree-root-count">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {files.map((rootNode: any) => renderTreeNode(rootNode))}
        </div>)}




      {/* {filesToRender.map((rootNode: any) => <div key={rootNode.name || rootNode.id} className="tree-root">
          <div className="tree-root-header">
            <div className="tree-root-title">
              {rootNode.folder || 'Root'} / {rootNode.fileName || ''}
            </div>
            <div className="tree-root-stats">
              <span className="tree-root-count">
                {formatFileSize(rootNode.totalSize)} | {rootNode.counts.files} files, {rootNode.counts.folders} folders
              </span>
            </div>
          </div>
          {renderTreeNode(rootNode)}
        </div>
      )} */}
    </div>}

     {filesToRender.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
          No files to display with the current filters.
        </div>
      )}
  </>
};
