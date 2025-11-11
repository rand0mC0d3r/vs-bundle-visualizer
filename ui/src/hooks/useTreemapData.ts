import { useMemo } from 'react';
import { FolderNode } from '../components/types';
import { BundleData } from '../types';

export function useTreemapData(
  bundleData: BundleData,
  filesToRender: any[],
  hideZeroByteFiles: boolean,
  hiddenRootFolders: Set<string>
): FolderNode {
  return useMemo<FolderNode>(() => {
    const root: FolderNode = { name: 'root', path: '', originalPath: '', children: [], files: [], totalSize: 0 };
    const folderMap = new Map<string, FolderNode>([['', root]]);
    const filesSet = new Set((filesToRender || []).map((f: any) => f.name));

    const nodeSize = (n: any): number => {
      if (!n) {return 0;}
      if (typeof n.value === 'number') {return n.value;}
      if (n.uid && bundleData.nodeParts?.[n.uid]) {return bundleData.nodeParts[n.uid].renderedLength || 0;}
      if (Array.isArray(n.children)) {return n.children.reduce((s: number, c: any) => s + nodeSize(c), 0);}
      return 0;
    };

    const addFile = (fullPath: string, size: number, originalPath: string) => {
      const parts = fullPath.split('/').filter(Boolean);
      const fileName = parts.pop() || '';
      let currentPath = '';
      let current = root;
      for (const p of parts) {
        const newPath = currentPath ? `${currentPath}/${p}` : p;
        if (!folderMap.has(newPath)) {
          const node: FolderNode = { name: p, path: newPath, originalPath: newPath, children: [], files: [], totalSize: 0 };
          folderMap.set(newPath, node);
          current.children.push(node);
        }
        current = folderMap.get(newPath)!;
        currentPath = newPath;
      }
      current.files.push({ name: fileName, size, fullPath, originalPath });
    };

    const walk = (n: any, currentPath = '') => {
      if (!n) {return;}
      if (n.name && !n.children) {
        const fullPath = currentPath ? `${currentPath}/${n.name}` : n.name;
        const originalPath = String(currentPath).split('.js')[0] + '.js';
        const size = nodeSize(n);
        const topLevel = (fullPath.split('/')[0] || '(root)');
        if (!hiddenRootFolders.has(topLevel) && filesSet.has(originalPath) && (!hideZeroByteFiles || size > 0)) {
          addFile(fullPath, size, originalPath);
        }
        return;
      }
      if (n.children) {
        for (const child of n.children) {walk(child, currentPath ? `${currentPath}/${n.name}` : n.name);}
      }
    };

    if (Array.isArray(bundleData?.tree?.children)) {
      for (const node of bundleData.tree.children) {walk(node);}
    }

    const calc = (f: FolderNode): number => {
      const filesSize = f.files.reduce((s, it) => s + (it.size || 0), 0);
      const childrenSize = f.children.reduce((s, c) => s + calc(c), 0);
      f.totalSize = filesSize + childrenSize;
      return f.totalSize;
    };
    calc(root);

    if (hideZeroByteFiles) {
      const prune = (f: FolderNode): FolderNode => ({ ...f, children: f.children.map(prune).filter(c => c.totalSize > 0 || c.files.length > 0) });
      const cleaned = prune(root);
      calc(cleaned);
      return cleaned;
    }

    return root;
  }, [bundleData, filesToRender, hideZeroByteFiles, hiddenRootFolders]);
}

export default useTreemapData;
