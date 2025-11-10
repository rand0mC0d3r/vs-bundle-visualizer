import React, { useMemo } from 'react';
import { BundleData, VSCodeAPI } from '../../types';
import { buildDependencyMap, DependencyMap } from '../../utils/dependencyUtils';
import { formatFileSize, getFileExtension, getFileIcon, getNodeSize } from '../../utils/fileUtils';
import { SortCriteria, SortDirection } from '../types';
import { TreeViewBundleMainLibraries } from './TreeViewBundleMainLibraries';
import { TreeViewDependencyAsset } from './TreeViewDependencyAsset';
import { TreeViewDependencyVendor } from './TreeViewDependencyVendor';

interface TreeViewRenderNodeProps {
  rootNode: any;
  bundleData: BundleData;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  sortCriteria: SortCriteria;
  sortDirection: SortDirection;
  hideZeroByteFiles: boolean;
  libraryFilters: string[];
  vscodeApi: VSCodeAPI;
  onToggleNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
}

export const TreeViewRenderNode: React.FC<TreeViewRenderNodeProps> = ({
  rootNode,
  bundleData,
  expandedNodes,
  selectedNode,
  sortCriteria,
  sortDirection,
  hideZeroByteFiles,
  libraryFilters,
  vscodeApi,
  onToggleNode,
  onSelectNode,
  onAddLibraryFilter,
  onRemoveLibraryFilter
}) => {

  // Extract dependency relationships from nodeMetas
  const dependencyMap = useMemo((): DependencyMap => {
    return buildDependencyMap(bundleData);
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

            <div
              onClick={(e) => {
                if(bundleInfo) return;
                e.stopPropagation();
                vscodeApi.postMessage({ command: 'openFile', filePath: node.name });
              }}
              className={`tree-label ${isFolder ? 'folder' : ''}`}
              style={{ display: 'flex', flexDirection: 'column', flexWrap: 'wrap' }}
            >
              {node.name}
              {bundleInfo && <TreeViewDependencyVendor {...{ bundleInfo }} />}
            </div>
          </div>

          {/* Show dependency information for bundle files */}
          {bundleInfo && (
            <div className="dependency-info" >
              {bundleInfo.isVendor
                ? <TreeViewBundleMainLibraries
                    bundleInfo={bundleInfo}
                    libraryFilters={libraryFilters}
                    onAddLibraryFilter={onAddLibraryFilter}
                    onRemoveLibraryFilter={onRemoveLibraryFilter}
                    uniqueAssetDependencies={uniqueAssetDependencies}
                  />
                : <TreeViewDependencyAsset
                    bundleInfo={bundleInfo}
                    dependencyMap={dependencyMap}
                    libraryFilters={libraryFilters}
                    onAddLibraryFilter={onAddLibraryFilter}
                    onRemoveLibraryFilter={onRemoveLibraryFilter}
                  />}
            </div>
          )}

          {nodeSize > 0 && (
            <div className="tree-size">
              {formatFileSize(nodeSize)}
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

  return <>
    {renderTreeNode(rootNode)}
  </>
};
