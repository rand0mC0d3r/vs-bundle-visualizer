import { hierarchy as d3Hierarchy, treemap as d3Treemap, treemapSquarify } from 'd3-hierarchy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { useTreemapData } from '../hooks/useTreemapData';
import { BundleData } from '../types';
import { ResizablePanel } from './General/ResizablePanel';
import { TreemapLayers } from './Treemap/TreemapLayers';
import { TreemapTiles } from './Treemap/TreemapTiles';
import { TreemapWrappers } from './Treemap/TreemapWrappers';
import { FolderNode } from './types';

interface TreemapPanelProps {
  bundleData: BundleData;
  libraryFilters: string[];
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  onScrollToFile: (filePath: string) => void;
}

export const TreemapPanel: React.FC<TreemapPanelProps> = ({
  bundleData,
  libraryFilters,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  onScrollToFile
}) => {
  if (!bundleData) return null as any;

  const { filesToRender } = useFilteredNodes(bundleData, hiddenRootFolders, 'filename', 'asc', libraryFilters);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [wrapperConfig, setWrapperConfig] = useState<Record<number, { enabled: boolean; label: string }>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 }));
    ro.observe(el);
    setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  const folderStructure = useTreemapData(bundleData, filesToRender, hideZeroByteFiles, hiddenRootFolders);

  // Compute layout with d3-hierarchy treemap only
  const layout = useMemo(() => {
    // derive top-level bundle names from bundleData.tree.children when possible
    const bundleNames = new Set<string>();
    try {
      if (bundleData && bundleData.tree && Array.isArray(bundleData.tree.children)) {
        bundleData.tree.children.forEach((n: any) => {
          const nm = n?.name || n?.path || '';
          if (nm) bundleNames.add(nm);
        });
      } else if (folderStructure && folderStructure.children) {
        folderStructure.children.forEach((c: any) => { if (c?.name) bundleNames.add(c.name); });
      }
    } catch (e) {
      // ignore
    }

    try {
      const rootObj: any = { name: folderStructure.name || 'root', children: [] };
      const folderToNode = (node: FolderNode) => {
        const obj: any = { name: node.name || node.path || '', children: [] };
        node.children.forEach(c => obj.children.push(folderToNode(c)));
        node.files.forEach(f => obj.children.push({ name: f.name, value: f.size, fullPath: f.fullPath, originalPath: (f as any).originalPath }));
        return obj;
      };
      folderStructure.children.forEach((c: any) => rootObj.children.push(folderToNode(c)));

      const root = d3Hierarchy(rootObj).sum((d: any) => d.value || 0);
      const treemapLayout = d3Treemap().size([containerSize.width, containerSize.height]).padding(3).tile(treemapSquarify);
      treemapLayout(root as any);

      const tiles: any[] = [];
      const samples: Record<string, { name: string; size: number; fullPath?: string; originalPath?: string }> = {};

      root.leaves().forEach((leaf: any) => {
        if (!leaf.data || !leaf.data.fullPath) return;
        // group key: prefer top-level (can be extended later)
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
        if (!labelsMap[g]) labelsMap[g] = { x: t.x, y: t.y, w: t.w, h: t.h, total: 0, sample: samples[g] ? (samples[g].originalPath || samples[g].name) : undefined };
        labelsMap[g].x = Math.min(labelsMap[g].x, t.x);
        labelsMap[g].y = Math.min(labelsMap[g].y, t.y);
        labelsMap[g].w = Math.max(labelsMap[g].w, t.x + t.w - labelsMap[g].x);
        labelsMap[g].h = Math.max(labelsMap[g].h, t.y + t.h - labelsMap[g].y);
        labelsMap[g].total += t.size;
      });

      let labels = Object.keys(labelsMap).map(k => ({ name: k, ...labelsMap[k] }));

      // helper to get basename (always returns string)
      const basename = (s?: string) => {
        if (!s) return '';
        const parts = String(s).split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : String(s);
      };

      // filter labels so only those that match bundle names are shown
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

      // collect nodes for wrappers (include root and internal nodes)
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
  }, [folderStructure, containerSize.width, containerSize.height]);

  // initialize wrapperConfig when maxDepth changes (preserve existing entries)
  useEffect(() => {
    const maxDepth = (layout as any).maxDepth || 0;
    setWrapperConfig(prev => {
      const next: Record<number, { enabled: boolean; label: string }> = {};
      for (let i = 0; i <= maxDepth; i++) {
        next[i] = prev[i] || { enabled: false, label: String(i) };
      }
      return next;
    });
  }, [layout.maxDepth]);

  return (
    <ResizablePanel title="File Size Visualization" titleChildren={<TreemapLayers {...{ layout, wrapperConfig, setWrapperConfig }} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          <TreemapWrappers {...{ layout, wrapperConfig }} />
          <TreemapTiles {...{ hoveredFolder, setHoveredFolder, layout, selectedNode, onScrollToFile }} />
        </div>
      </div>
    </ResizablePanel>
  );
};
