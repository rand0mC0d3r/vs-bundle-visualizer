import { hierarchy as d3Hierarchy, treemap as d3Treemap, treemapSquarify } from 'd3-hierarchy';
import { useMemo } from 'react';
import { FolderNode } from '../components/types';
import { BundleData } from '../types';

export interface TreemapLayoutResult {
  tiles: any[];
  labels: any[];
  nodes: any[];
  maxDepth: number;
  width: number;
  height: number;
}

export function useTreemapLayout(folderStructure: FolderNode, containerSize: { width: number; height: number }, bundleData?: BundleData): TreemapLayoutResult {
  return useMemo(() => {
    try {
      // derive top-level bundle names from bundleData.tree.children when possible
      const bundleNames = new Set<string>();
      try {
        if (bundleData && bundleData.tree && Array.isArray(bundleData.tree.children)) {
          bundleData.tree.children.forEach((n: any) => {
            const nm = n?.name || n?.path || '';
                if (nm) { bundleNames.add(nm); }
          });
            } else if (folderStructure && folderStructure.children) {
              folderStructure.children.forEach((c: any) => {
                if (c?.name) { bundleNames.add(c.name); }
              });
        }
      } catch (e) {
        // ignore
      }

      const rootObj: any = { name: folderStructure.name || 'root', children: [] };
      const folderToNode = (node: FolderNode) => {
        const obj: any = { name: node.name || node.path || '', children: [] };
        node.children.forEach(c => obj.children.push(folderToNode(c)));
        node.files.forEach(f => obj.children.push({ name: f.name, value: f.size, fullPath: f.fullPath, originalPath: (f as any).originalPath }));
        return obj;
      };
      folderStructure.children.forEach((c: any) => rootObj.children.push(folderToNode(c)));

      const root = d3Hierarchy(rootObj).sum((d: any) => d.value || 0);
      const treemapLayout = d3Treemap().size([containerSize.width, containerSize.height]).padding(2).tile(treemapSquarify);
      treemapLayout(root as any);

      const tiles: any[] = [];
      const samples: Record<string, { name: string; size: number; fullPath?: string; originalPath?: string }> = {};

      root.leaves().forEach((leaf: any) => {
        if (!leaf.data || !leaf.data.fullPath) { return; }
        const parts = (leaf.data.fullPath || '').split('/').filter(Boolean);
        const groupKey = parts.length ? parts[0] : '(root)';

        tiles.push({
          key: leaf.data.fullPath,
          x: leaf.x0,
          y: leaf.y0,
          w: Math.max(1, leaf.x1 - leaf.x0),
          h: Math.max(1, leaf.y1 - leaf.y0),
          name: leaf.data.name,
          fullPath: leaf.data.fullPath,
          originalPath: leaf.data.originalPath,
          size: leaf.value,
          groupKey
        });

        const cur = samples[groupKey];
        if (!cur || leaf.value > cur.size) {
          samples[groupKey] = { name: leaf.data.name, size: leaf.value, fullPath: leaf.data.fullPath, originalPath: leaf.data.originalPath };
        }
      });

      const labelsMap: Record<string, { x: number; y: number; w: number; h: number; total: number; sample?: string }> = {};
      tiles.forEach(t => {
        const g = t.groupKey;
        if (!labelsMap[g]) { labelsMap[g] = { x: t.x, y: t.y, w: t.w, h: t.h, total: 0, sample: samples[g] ? (samples[g].originalPath || samples[g].name) : undefined }; }
        labelsMap[g].x = Math.min(labelsMap[g].x, t.x);
        labelsMap[g].y = Math.min(labelsMap[g].y, t.y);
        labelsMap[g].w = Math.max(labelsMap[g].w, t.x + t.w - labelsMap[g].x);
        labelsMap[g].h = Math.max(labelsMap[g].h, t.y + t.h - labelsMap[g].y);
        labelsMap[g].total += t.size;
      });

      let labels = Object.keys(labelsMap).map(k => ({ name: k, ...labelsMap[k] }));

      const basename = (s?: string) => {
        if (!s) { return ''; }
        const parts = String(s).split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : String(s);
      };

      labels = labels.filter(l => {
        const sample = l.sample || '';
        const name = l.name || '';
        return (
          bundleNames.has(sample) ||
          bundleNames.has(basename(sample)) ||
          bundleNames.has(name) ||
          bundleNames.has(basename(name))
        );
      });

      const nodes: any[] = [];
      root.descendants().forEach((d: any) => {
        nodes.push({
          depth: d.depth,
          name: d.data?.name,
          x: d.x0,
          y: d.y0,
          w: Math.max(1, d.x1 - d.x0),
          h: Math.max(1, d.y1 - d.y0),
          data: d.data
        });
      });

      const maxDepth = Math.max(0, ...nodes.map(n => n.depth));

      return { tiles, labels, nodes, maxDepth, width: containerSize.width, height: containerSize.height };
    } catch (e) {
      console.warn('d3 layout failed', e);
      return { tiles: [], labels: [], nodes: [], maxDepth: 0, width: containerSize.width, height: containerSize.height };
    }
  }, [folderStructure, containerSize.width, containerSize.height, bundleData]);
}

export default useTreemapLayout;
