import React from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { BundleData } from '../types';
import { TreeViewRenderNode } from './TreeView/TreeViewRenderNode';
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
  const { filesToRender } = useFilteredNodes(bundleData, hiddenRootFolders, sortCriteria, sortDirection, libraryFilters);

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

  if (!bundleData?.tree?.children) {
    return <div className="tree-container">No data available</div>;
  }

  const groupFilesByFolder = filesToRender.reduce((acc: any, file: any) => {
    const folderName = file.folder || 'Root';
    if (!acc[folderName]) {
      acc[folderName] = [];
    }
    acc[folderName].push(file);
    return acc;
  }, {});

  const sortedGroupedFiles = Object.keys(groupFilesByFolder)
  .sort((a, b) => {
    let aValue: any, bValue: any;

      switch (sortCriteria) {
        case 'filename':
          aValue = a.toLowerCase();
          bValue = b.toLowerCase();
          break;
        case 'fileCount':
          aValue = groupFilesByFolder[a].length;
          bValue = groupFilesByFolder[b].length;
          break;
        case 'fileSize':
          aValue = groupFilesByFolder[a].reduce((acc: number, file: any) => acc + file.totalSize, 0);
          bValue = groupFilesByFolder[b].reduce((acc: number, file: any) => acc + file.totalSize, 0);
          break;
        default:
          aValue = a.toLowerCase();
          bValue = b.toLowerCase();
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
  })
  .reduce((acc: any, folderName: string) => {
    acc[folderName] = groupFilesByFolder[folderName];
    return acc;
  }, {});

  return <>
    {filesToRender.length > 0 && <div className="tree-container">
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
              📂 {folderName}
            </div>
            <div className="tree-root-stats">
              <span className="tree-root-count">
                {files.length} file{files.length !== 1 ? 's' : ''} | {Math.round(files.reduce((acc: number, file: any) => acc + file.totalSize, 0) / 1000) / 1} KB
              </span>
            </div>
          </div>
          {files.map((rootNode: any) => <TreeViewRenderNode key={rootNode.name || rootNode.id} rootNode={rootNode} bundleData={bundleData} expandedNodes={expandedNodes} selectedNode={selectedNode} sortCriteria={sortCriteria} sortDirection={sortDirection} hideZeroByteFiles={hideZeroByteFiles} libraryFilters={libraryFilters} onToggleNode={onToggleNode} onSelectNode={onSelectNode} onAddLibraryFilter={onAddLibraryFilter} onRemoveLibraryFilter={onRemoveLibraryFilter} />)}
        </div>)}
    </div>}

     {filesToRender.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
          No files to display with the current filters.
        </div>
      )}
  </>
};
