import { FolderNode } from '../components/types';
import { BundleData } from '../types';
import { getNodeSize } from './fileUtils';

export const buildFolderStructure = (
  bundleData: BundleData,
  hideZeroByteFiles: boolean,
  hiddenRootFolders: Set<string>
): FolderNode => {
  const root: FolderNode = {
    name: 'root',
    path: '',
    originalPath: '',
    children: [],
    files: [],
    totalSize: 0
  };

  const folderMap = new Map<string, FolderNode>();
  folderMap.set('', root);

  const isRootFolderVisible = (rootFolderName: string): boolean => {
    return !hiddenRootFolders.has(rootFolderName);
  };

  const getAllFiles = (node: any, currentPath: string = ''): Array<{ name: string; size: number; fullPath: string }> => {
    const files: Array<{ name: string; size: number; fullPath: string }> = [];

    if (node.name && !node.children) {
      files.push({
        name: node.name,
        size: getNodeSize(node, bundleData),
        fullPath: currentPath ? `${currentPath}/${node.name}` : node.name
      });
    }

    if (node.children) {
      node.children.forEach((child: any) => {
        files.push(...getAllFiles(child, currentPath ? `${currentPath}/${node.name}` : node.name));
      });
    }

    return files;
  };

  // Extract all files from bundle data
  const allFiles: Array<{ name: string; size: number; fullPath: string }> = [];
  if (bundleData?.tree?.children) {
    bundleData.tree.children.forEach(rootNode => {
      allFiles.push(...getAllFiles(rootNode));
    });
  }

  // Filter files based on visible root folders and zero-byte filter
  const filteredFiles = allFiles.filter(file => {
    const firstSlash = file.fullPath.indexOf('/');
    const topLevelFolder = firstSlash > 0 ? file.fullPath.substring(0, firstSlash) : '(root)';
    const isVisible = isRootFolderVisible(topLevelFolder);
    const isNotZeroByte = !hideZeroByteFiles || file.size > 0;
    return isVisible && isNotZeroByte;
  });

  // Build folder structure
  filteredFiles.forEach(file => {
    const pathParts = file.fullPath.split('/');
    const fileName = pathParts.pop() || '';
    let currentPath = '';
    let currentFolder = root;

    // Create folder hierarchy
    pathParts.forEach(folderName => {
      const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      if (!folderMap.has(newPath)) {
        const newFolder: FolderNode = {
          name: folderName,
          path: newPath,
          originalPath: newPath, // Initially, originalPath is the same as path
          children: [],
          files: [],
          totalSize: 0
        };
        folderMap.set(newPath, newFolder);
        currentFolder.children.push(newFolder);
      }

      currentFolder = folderMap.get(newPath)!;
      currentPath = newPath;
    });

    // Add file to its folder
    currentFolder.files.push({
      name: fileName,
      size: file.size,
      fullPath: file.fullPath
    });
  });

  // Calculate total sizes
  const calculateFolderSize = (folder: FolderNode): number => {
    const fileSize = folder.files.reduce((sum, file) => sum + file.size, 0);
    const childrenSize = folder.children.reduce((sum, child) => sum + calculateFolderSize(child), 0);
    folder.totalSize = fileSize + childrenSize;
    return folder.totalSize;
  };

  calculateFolderSize(root);

  // Remove empty folders if filter is enabled
  if (hideZeroByteFiles) {
    const removeEmptyFolders = (folder: FolderNode): FolderNode => {
      // First, recursively clean children
      const cleanedChildren = folder.children
        .map(child => removeEmptyFolders(child))
        .filter(child => child.totalSize > 0 || child.files.length > 0 || child.children.length > 0);

      return {
        ...folder,
        children: cleanedChildren
      };
    };

    const cleanedRoot = removeEmptyFolders(root);
    // Recalculate sizes after cleaning
    calculateFolderSize(cleanedRoot);
    return cleanedRoot;
  }

  return root;
};

export const getRootFolders = (bundleData: BundleData): string[] => {
  if (!bundleData?.tree?.children) {
    return [];
  }

  const rootFolderNames = new Set<string>();

  // Extract all files and get their top-level folder names
  const extractRootFolders = (node: any, currentPath: string = '') => {
    if (node.name && !node.children) {
      // This is a file - extract the top-level folder from the full path
      const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      const firstSlash = fullPath.indexOf('/');
      if (firstSlash > 0) {
        const topLevelFolder = fullPath.substring(0, firstSlash);
        rootFolderNames.add(topLevelFolder);
      } else {
        // File is at root level
        rootFolderNames.add('(root)');
      }
    }

    if (node.children) {
      node.children.forEach((child: any) => {
        extractRootFolders(child, currentPath ? `${currentPath}/${node.name}` : node.name);
      });
    }
  };

  bundleData.tree.children.forEach(rootNode => {
    extractRootFolders(rootNode);
  });

  return Array.from(rootFolderNames).sort();
};
