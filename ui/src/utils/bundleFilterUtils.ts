import { BundleData } from '../types';
import { buildDependencyMap, DependencyMap } from './dependencyUtils';
import { getNodeSize } from './fileUtils';

export type SortCriteria = 'filename' | 'fileCount' | 'fileSize';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  hiddenRootFolders: Set<string> | string[];
  sortCriteria: SortCriteria;
  sortDirection: SortDirection;
  libraryFilters: string[];
}

export interface ProcessedNode {
  name: string;
  folder: string;
  fileName: string;
  hashed: string;
  totalSize: number;
  counts: { files: number; folders: number };
  children?: any[];
  [key: string]: any;
}

/**
 * Count files and folders recursively in a node
 */
export const countFiles = (node: any): { files: number; folders: number } => {
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

/**
 * Sort nodes based on criteria and direction
 */
export const sortNodes = (
  nodes: any[],
  sortCriteria: SortCriteria,
  sortDirection: SortDirection,
  bundleData: BundleData
): any[] => {
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

/**
 * Check if a root folder is visible based on hidden folders set
 */
export const isRootFolderVisible = (
  rootFolderName: string,
  hiddenRootFolders: Set<string> | string[]
): boolean => {
  const hiddenSet = hiddenRootFolders instanceof Set
    ? hiddenRootFolders
    : new Set(hiddenRootFolders);
  return !hiddenSet.has(rootFolderName);
};

/**
 * Filter a node by library filters using dependency map
 */
export const filterNodeByLibraries = (
  rootNode: any,
  libraryFilters: string[],
  dependencyMap: DependencyMap
): boolean => {
  if (libraryFilters.length === 0) {
    return true;
  }

  const bundleInfo = dependencyMap[rootNode.name];

  if (bundleInfo) {
    if (bundleInfo.isVendor) {
      return libraryFilters.some(lf =>
        bundleInfo.mainLibraries?.some(ml => ml === lf)
      );
    } else {
      const parsedDependencies = bundleInfo.dependencies.map(dep =>
        dependencyMap[dep]?.mainLibrary ||
        dep.replace(/^vendor\/vendor__/, '').replace(/\.js$/, '').split('-')[0]
      );
      return libraryFilters.some(lf =>
        parsedDependencies.some(pd => pd === lf)
      );
    }
  }

  return false;
};

/**
 * Process and filter bundle tree nodes
 * This is the core logic extracted from useFilteredNodes
 */
export const processAndFilterNodes = (
  bundleData: BundleData,
  options: FilterOptions
): ProcessedNode[] => {
  const { hiddenRootFolders, sortCriteria, sortDirection, libraryFilters } = options;

  if (!bundleData?.tree?.children) {
    return [];
  }

  // Build dependency map
  const dependencyMap = buildDependencyMap(bundleData);

  // Process nodes
  const filesToRender = sortNodes(
    bundleData.tree.children,
    sortCriteria,
    sortDirection,
    bundleData
  )
    .map((rootNode: any) => ({
      ...rootNode,
      folder: rootNode.name.split('/')[0],
      fileName: rootNode.name.split('/').slice(1).join('/'),
      hashed: rootNode.name.split('-')[1]?.split('.')[0] || '',
      totalSize: getNodeSize(rootNode, bundleData),
      counts: countFiles(rootNode)
    }))
    .filter(rootNode => isRootFolderVisible(rootNode.folder, hiddenRootFolders))
    .filter(rootNode => filterNodeByLibraries(rootNode, libraryFilters, dependencyMap));

  return filesToRender;
};
