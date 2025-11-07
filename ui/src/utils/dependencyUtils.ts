import { BundleData } from '../types';

export interface DependencyInfo {
  consumers: string[];
  dependencies: string[];
  isVendor: boolean;
  mainLibrary?: string;
}

export interface DependencyMap {
  [nodeName: string]: DependencyInfo;
}

export const buildDependencyMap = (bundleData: BundleData): DependencyMap => {
  const map: DependencyMap = {};

  if (!bundleData.nodeMetas) {
    return map;
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

export const checkNodeMatchesLibraryFilters = (
  node: any,
  currentPath: string,
  libraryFilters: string[],
  dependencyMap: DependencyMap
): boolean => {
  // No filters means show everything
  if (libraryFilters.length === 0) {
    return true;
  }

  // Construct the full path for this node
  const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;

  // Check if this node corresponds to a bundle file
  const bundleInfo = dependencyMap[fullPath];

  if (bundleInfo) {
    // For vendor bundles, check if the main library matches any filter
    if (bundleInfo.isVendor && bundleInfo.mainLibrary) {
      return libraryFilters.includes(bundleInfo.mainLibrary);
    }

    // For asset bundles, check if any of their dependencies match the filters
    if (!bundleInfo.isVendor && bundleInfo.dependencies.length > 0) {
      return bundleInfo.dependencies.some(dep => {
        const depInfo = dependencyMap[dep];
        return depInfo?.mainLibrary && libraryFilters.includes(depInfo.mainLibrary);
      });
    }

    // If it's a bundle but doesn't match any filter, hide it
    return false;
  }

  // For non-bundle nodes (folders, internal files), check if they contain matching children
  if (node.children && node.children.length > 0) {
    return node.children.some((child: any) =>
      checkNodeMatchesLibraryFilters(child, fullPath, libraryFilters, dependencyMap)
    );
  }

  // For leaf nodes that aren't bundles, show them (they're internal files within matching bundles)
  return true;
};

export const checkFileMatchesLibraryFilters = (
  filePath: string,
  libraryFilters: string[],
  dependencyMap: DependencyMap
): boolean => {
  // No filters means show everything
  if (libraryFilters.length === 0) {
    return true;
  }

  // Check if this file corresponds to a bundle file
  const bundleInfo = dependencyMap[filePath];

  if (bundleInfo) {
    // For vendor bundles, check if the main library matches any filter
    if (bundleInfo.isVendor && bundleInfo.mainLibrary) {
      return libraryFilters.includes(bundleInfo.mainLibrary);
    }

    // For asset bundles, check if any of their dependencies match the filters
    if (!bundleInfo.isVendor && bundleInfo.dependencies.length > 0) {
      return bundleInfo.dependencies.some(dep => {
        const depInfo = dependencyMap[dep];
        return depInfo?.mainLibrary && libraryFilters.includes(depInfo.mainLibrary);
      });
    }

    // If it's a bundle but doesn't match any filter, hide it
    return false;
  }

  // For non-bundle files, show them if they are part of matching bundles
  return true;
};
