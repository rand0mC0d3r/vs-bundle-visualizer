import { hierarchy as d3Hierarchy, treemap as d3Treemap, treemapSquarify } from 'd3-hierarchy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { BundleData } from '../types';
import { formatFileSize, getFileColor } from '../utils/fileUtils';
import { ResizablePanel } from './General/ResizablePanel';
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

  const folderStructure = useMemo<FolderNode>(() => {
    const root: FolderNode = { name: 'root', path: '', originalPath: '', children: [], files: [], totalSize: 0 };
    const folderMap = new Map<string, FolderNode>([['', root]]);
    const filesSet = new Set((filesToRender || []).map((f: any) => f.name));

    const nodeSize = (n: any): number => {
      if (!n) return 0;
      if (typeof n.value === 'number') return n.value;
      if (n.uid && bundleData.nodeParts?.[n.uid]) return bundleData.nodeParts[n.uid].renderedLength || 0;
      if (Array.isArray(n.children)) return n.children.reduce((s: number, c: any) => s + nodeSize(c), 0);
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
      if (!n) return;
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
        for (const child of n.children) walk(child, currentPath ? `${currentPath}/${n.name}` : n.name);
      }
    };

    if (Array.isArray(bundleData?.tree?.children)) {
      for (const node of bundleData.tree.children) walk(node);
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
    <ResizablePanel title="File Size Visualization">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        {/* level wrapper controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px' }}>
          <div style={{ fontSize: 12, color: '#666' }}>Level wrappers:</div>
          {Array.from({ length: (layout as any).maxDepth + 1 }).map((_, i) => {
            const cfg = wrapperConfig[i] || { enabled: false, label: String(i) };
            return (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', border: '1px solid transparent', padding: '2px' }}>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => setWrapperConfig(prev => ({ ...prev, [i]: { ...cfg, enabled: e.target.checked } }))}
                  />
                  <span style={{ marginLeft: 6 }}>{i}</span>
                </label>
                {/* <input
                  aria-label={`label-for-level-${i}`}
                  value={cfg.label}
                  onChange={(e) => setWrapperConfig(prev => ({ ...prev, [i]: { ...cfg, label: e.target.value } }))}
                  style={{ width: 64, fontSize: 12, padding: '2px 4px' }}
                /> */}
              </div>
            );
          })}
        </div>

        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          {/* render level wrappers behind tiles */}
          {((layout as any).nodes || []).map((n: any, idx: number) => {
            const cfg = wrapperConfig[n.depth];
            if (!cfg || !cfg.enabled) return null;
            return (
              <div
                className="treemap-panel-wrapper"
                key={`wrapper-${idx}-${n.depth}`}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: Math.max(1, n.w),
                  height: Math.max(1, n.h),
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  background: 'transparent'
                }}
              >
                {(n.w > 40 && n.h > 40) && <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  zIndex: 1,
                  pointerEvents: 'none',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 11,
                  maxWidth: Math.max(8, (n.w || 0) - 8),
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}>
                  {n.name.split("-")[0]}
                </div>}
              </div>
            );
          })}

          {layout.tiles.map((t: any) => {
            const baseColor = getFileColor(t.name);
            const lightColor = baseColor + '80';

            return <>
              <div
                key={t.key}
                className={`treemap-file ${selectedNode === t.fullPath ? 'selected' : ''} ${hoveredFolder === t.groupKey ? 'hovered-folder' : ''}`}
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  backgroundColor: lightColor,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredFolder(t.groupKey)}
                onMouseLeave={() => setHoveredFolder(null)}
                onClick={() => onScrollToFile(t.fullPath)}
                title={`${t.fullPath} - ${formatFileSize(t.size)}`}
              >

                  {(t.w > 40 && t.h > 40) && <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      padding: '1px 6px',
                      opacity: 0.45,
                      fontSize: 10,
                      borderRadius: 3,
                      maxWidth: Math.max(8, (t.w || 0) - 8),
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {t.name.split('.')[0]}
                  </div>}
                  <div className="treemap-file-size">{formatFileSize(t.size)}</div>
              </div>
            </>;
          })}
        </div>
      </div>
    </ResizablePanel>
  );
};
