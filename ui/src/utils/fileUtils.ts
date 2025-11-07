import { BundleData } from '../types';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

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

export const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
};

export const getFileIcon = (name: string, isFolder: boolean): string => {
  if (isFolder) {
    return '📁';
  }

  const ext = getFileExtension(name);
  const iconMap: { [key: string]: string } = {
    js: '📄',
    ts: '📘',
    tsx: '📘',
    jsx: '📄',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    json: '📋',
    md: '📝',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    ico: '🖼️'
  };

  return iconMap[ext] || '📄';
};

export const getFileColor = (fileName: string): string => {
  const ext = getFileExtension(fileName);
  const colorMap: { [key: string]: string } = {
    js: '#f7df1e',
    ts: '#007acc',
    tsx: '#007acc',
    jsx: '#f7df1e',
    css: '#1572b6',
    scss: '#c6538c',
    html: '#e34f26',
    json: '#cbcb41',
    md: '#083fa1',
    png: '#a074c4',
    jpg: '#a074c4',
    jpeg: '#a074c4',
    gif: '#a074c4',
    svg: '#a074c4',
    ico: '#a074c4'
  };
  return colorMap[ext] || '#6c757d';
};

export const calculateTotalSize = (node: any, bundleData: BundleData): number => {
  return getNodeSize(node, bundleData);
};

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
