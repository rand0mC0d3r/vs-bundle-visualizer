// Shared types and utilities for bundle filtering
// This file can be used in both Node.js (extension) and browser (React) contexts

export type SortCriteria = 'filename' | 'fileCount' | 'fileSize';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  showChildren?: boolean;
  hiddenRootFolders?: string[];
  sortCriteria?: SortCriteria;
  sortDirection?: SortDirection;
  libraryFilters?: string[];
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

export interface DependencyInfo {
  consumers: string[];
  dependencies: string[];
  dependenciesParsed: string[];
  isVendor: boolean;
  mainLibrary?: string;
  mainLibraries?: string[];
}

export interface DependencyMap {
  [nodeName: string]: DependencyInfo;
}

export interface BundleData {
  [key: string]: any;
  tree?: {
    children?: TreeNode[];
  };
  nodeParts?: {
    [uid: string]: {
      renderedLength: number;
      gzipLength?: number;
      brotliLength?: number;
      metaUid?: string;
    };
  };
  nodeMetas?: {
    [uid: string]: {
      id: string;
      moduleParts?: {
        [bundleName: string]: string;
      };
      imported?: Array<{ uid: string }>;
      importedBy?: Array<{ uid: string }>;
    };
  };
}

export interface TreeNode {
  name: string;
  id?: string;
  uid?: string;
  value?: number;
  children?: TreeNode[];
}

/**
 * Build dependency map from bundle data
 */
export const buildDependencyMap = (bundleData: BundleData): DependencyMap => {
  const map: DependencyMap = {};

  if (!bundleData || !bundleData.nodeMetas) {
    return {};
  }

  // First pass: identify vendor vs asset bundles and create base entries
  Object.entries(bundleData.nodeMetas).forEach(([, meta]: [string, any]) => {
    const bundleName = Object.keys(meta.moduleParts || {})[0];
    if (!bundleName) {
      return;
    }

    const isVendor = bundleName.startsWith('vendor/');
    const isAsset = bundleName.startsWith('assets/');

    if (isVendor || isAsset) {
      if (!map[bundleName]) {
        map[bundleName] = {
          consumers: [],
          dependencies: [],
          dependenciesParsed: [],
          isVendor,
          mainLibrary: undefined
        };
      }

      // Extract main library name for vendor bundles
      if (isVendor && meta.id) {
        const libMatch = meta.id.match(/node_modules\/([^\/]+)/);
        if (libMatch && !map[bundleName].mainLibrary) {
          map[bundleName].mainLibrary = libMatch[1];
          map[bundleName].mainLibraries = [libMatch[1]];
        } else if (libMatch) {
          if (!map[bundleName].mainLibraries) {
            map[bundleName].mainLibraries = [];
          }
          if (!map[bundleName].mainLibraries.includes(libMatch[1])) {
            map[bundleName].mainLibraries.push(libMatch[1]);
          }
        }
      }
    }
  });

  // Second pass: map dependencies between bundles
  Object.entries(bundleData.nodeMetas).forEach(([, meta]: [string, any]) => {
    const bundleName = Object.keys(meta.moduleParts || {})[0];
    if (!bundleName) {
      return;
    }

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
};

/**
 * Get node size from bundle data
 */
export const getNodeSize = (node: any, bundleData: BundleData): number => {
  // If node has a direct value, use it
  if (node.value) {
    return node.value;
  }

  // If node has a uid and we have nodeParts, look up the size
  if (node.uid && bundleData.nodeParts && bundleData.nodeParts[node.uid]) {
    return bundleData.nodeParts[node.uid].renderedLength;
  }

  // If it's a folder with children, calculate total
  if (node.children && node.children.length > 0) {
    return node.children.reduce((total: number, child: any) => total + getNodeSize(child, bundleData), 0);
  }

  return 0;
};

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
 * Check if a root folder is visible based on hidden folders list
 */
export const isRootFolderVisible = (
  rootFolderName: string,
  hiddenRootFolders: string[]
): boolean => {
  return !hiddenRootFolders.includes(rootFolderName);
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
 * This is the core logic that can be used in both React and Node.js contexts
 */
export const processAndFilterNodes = (
  bundleData: BundleData,
  options: FilterOptions = {}
): ProcessedNode[] => {
  const {
    hiddenRootFolders = [],
    sortCriteria = 'filename',
    sortDirection = 'asc',
    libraryFilters = []
  } = options;

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
