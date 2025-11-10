import React from 'react';
import { BundleData } from '../types';
import { countFiles } from '../utils/fileUtils';

interface StatusBarProps {
  bundleData: BundleData | null;
  hiddenRootFolders: Set<string>;
}

export const StatusBar: React.FC<StatusBarProps> = ({ bundleData, hiddenRootFolders }) => {
  const isRootFolderVisible = (rootFolderName: string): boolean => {
    return !hiddenRootFolders.has(rootFolderName);
  };

  const getTotalItemCount = (): number => {
    if (!bundleData?.tree?.children) {
      return 0;
    }

    return bundleData.tree.children
      .filter(rootNode => {
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
      })
      .reduce((total, node) => {
        const counts = countFiles(node);
        return total + counts.files + counts.folders;
      }, 0);
  };

  return (
    <div className="status-bar">
      <div className="status-info">
        {bundleData && (
          <span>
            Showing {getTotalItemCount()} items
          </span>
        )}
      </div>
      <div className="status-shortcuts">
        <span><span className="kbd">Ctrl+B</span> Toggle Panel</span>
        <span><span className="kbd">Ctrl+T</span> Toggle Treemap</span>
        <span><span className="kbd">Ctrl+H</span> Hide 0B Files</span>
        <span><span className="kbd">Ctrl+S</span> Sort Direction</span>
        <span><span className="kbd">Ctrl+1/2/3</span> Sort By</span>
        <span><span className="kbd">Ctrl+E</span> Expand All</span>
        <span><span className="kbd">Ctrl+W</span> Collapse All</span>
        <span><span className="kbd">Ctrl+R</span> Refresh</span>
      </div>
    </div>
  );
};
