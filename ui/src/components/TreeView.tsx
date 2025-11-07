import React from 'react';
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

    return (
      <div key={nodeId} className="tree-node" data-file-path={nodeId}>
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
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
            </div>

            {nodeSize > 0 && (
              <div className="tree-size">
                {formatFileSize(nodeSize)}
              </div>
            )}
          </div>
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
