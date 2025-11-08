import { useMemo } from 'react';
import { buildDependencyMap, DependencyMap } from '../utils/dependencyUtils';
import { getNodeSize } from '../utils/fileUtils';

export const useFilteredNodes = (bundleData, hiddenRootFolders, sortCriteria, sortDirection, libraryFilters) => {

  const dependencyMap = useMemo((): DependencyMap => {
    return buildDependencyMap(bundleData);
  }, [bundleData]);

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

  const isRootFolderVisible = (rootFolderName: string): boolean => {
    return !hiddenRootFolders.has(rootFolderName);
  };

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
          return true;
        }

        const bundleInfo = dependencyMap[rootNode.name];

        if (bundleInfo) {
          if(bundleInfo.isVendor) {
            return libraryFilters.some(lf => bundleInfo.mainLibraries?.some(ml => ml === lf));
          } else {
            const parsedDependencies = bundleInfo.dependencies.map(dep =>
              dependencyMap[dep]?.mainLibrary ||
              dep.replace(/^vendor\/vendor__/, '').replace(/\.js$/, '').split('-')[0]
            );
            return libraryFilters.some(lf => parsedDependencies.some(pd => pd === lf));
          }
        }

        return false;
      });

  return {
    filesToRender,
  };
};
