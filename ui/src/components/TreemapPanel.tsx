import { hierarchy as d3Hierarchy, treemap as d3Treemap, treemapSquarify } from 'd3-hierarchy';
import potpack from 'potpack';
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
  if (!bundleData) {
    return null as any;
  }

  const { filesToRender } = useFilteredNodes(bundleData, hiddenRootFolders, 'filename', 'asc', libraryFilters);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 });
    });
    ro.observe(el);
    // initialize
    setContainerSize({ width: el.clientWidth || 1200, height: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  const buildFolderStructure = (bundleData: BundleData, filesToRender: any[]): FolderNode => {
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

    const getNodeSize = (node: any): number => {
      if (node.value) {
        return node.value;
      }
      if (node.uid && bundleData.nodeParts && bundleData.nodeParts[node.uid]) {
        return bundleData.nodeParts[node.uid].renderedLength;
      }
      if (node.children && node.children.length > 0) {
        return node.children.reduce((total: number, child: any) => total + getNodeSize(child), 0);
      }
      return 0;
    };

    const getAllFiles = (node: any, currentPath: string = ''): Array<{ name: string; size: number; originalPath: string; fullPath: string }> => {
      const files: Array<{ name: string; size: number; originalPath: string; fullPath: string }> = [];

      if (node.name && !node.children) {
        files.push({
          name: node.name,
          size: getNodeSize(node),
          originalPath: currentPath.split('.js')[0] + '.js',
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
  const allFiles: Array<{ name: string; size: number; originalPath: string; fullPath: string }> = [];
    if (bundleData?.tree?.children) {
      bundleData.tree.children.forEach(rootNode => {
        allFiles.push(...getAllFiles(rootNode));
      });
    }

  // Filter files based on filesToRender (from the hook) and visible root folders

    // Filter files based on visible root folders and zero-byte filter
    const filteredFiles = allFiles.filter(file => filesToRender.find((f: any) => f.name === file.originalPath))
    .filter(file => {
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

      // Add file to its folder (keep originalPath so we can label bundle file)
      currentFolder.files.push({
        name: fileName,
        size: file.size,
        fullPath: file.fullPath,
        originalPath: file.originalPath
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
  // Layout configuration state
  const [useD3, setUseD3] = useState(false);
  const [subgroupThreshold, setSubgroupThreshold] = useState(0.10);

  // Compute folder structure once
  const folderStructure = buildFolderStructure(bundleData, filesToRender);

  // Compute layout (either grouped potpack or d3 treemap)
  const layout = useMemo(() => {
    const groups = new Map<string, Array<any>>();
    const SUBGROUP_THRESHOLD = subgroupThreshold;

    const collectFiles = (node: FolderNode, collectInto: Array<any>, groupKey: string) => {
      node.files.forEach((f: any) => collectInto.push({ name: f.name, size: f.size, fullPath: f.fullPath, originalPath: f.originalPath, groupKey }));
      node.children.forEach(c => collectFiles(c, collectInto, groupKey));
    };

    // root files
    if (folderStructure.files && folderStructure.files.length > 0) {
      const rootKey = '(root)';
      groups.set(rootKey, []);
      collectFiles(folderStructure, groups.get(rootKey)!, rootKey);
    }

    (folderStructure.children || []).forEach((top) => {
      const topKey = top.name || top.path || '(root)';
      if (!groups.has(topKey)) groups.set(topKey, []);
      top.files.forEach((f: any) => groups.get(topKey)!.push({ name: f.name, size: f.size, fullPath: f.fullPath, groupKey: topKey }));
      (top.children || []).forEach(child => {
        const proportion = child.totalSize / Math.max(1, top.totalSize);
        if (proportion >= SUBGROUP_THRESHOLD) {
          const childKey = `${topKey}/${child.name}`;
          groups.set(childKey, []);
          collectFiles(child, groups.get(childKey)!, childKey);
        } else {
          collectFiles(child, groups.get(topKey)!, topKey);
        }
      });
    });

    // If using d3, create hierarchy and treemap
    if (useD3) {
      try {
        const rootObj: any = { name: folderStructure.name || 'root', children: [] };
        const folderToNode = (node: FolderNode) => {
          const obj: any = { name: node.name || node.path || '', children: [] };
          node.children.forEach(c => obj.children.push(folderToNode(c)));
          node.files.forEach(f => obj.children.push({ name: f.name, value: f.size, fullPath: f.fullPath }));
          return obj;
        };
        folderStructure.children.forEach(c => rootObj.children.push(folderToNode(c)));

        const root = d3Hierarchy(rootObj).sum((d: any) => d.value || 0);
        const treemapLayout = d3Treemap().size([containerSize.width, containerSize.height]).padding(3).tile(treemapSquarify);
        treemapLayout(root as any);

        const tiles: any[] = [];
        // track a sample (largest) file per group while iterating leaves
        const samples: Record<string, { name: string; size: number; fullPath?: string }> = {};
        root.leaves().forEach((leaf: any) => {
          if (!leaf.data || !leaf.data.fullPath) return;
          const groupKey = (() => {
            const firstSlash = leaf.data.fullPath.indexOf('/');
            return firstSlash > 0 ? leaf.data.fullPath.substring(0, firstSlash) : '(root)';
          })();

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
            samples[groupKey] = { name: leaf.data.name, size: leaf.value, fullPath: leaf.data.fullPath };
          }
        });

        // create basic labels by grouping tiles by their top-level groupKey
        const labelsMap: Record<string, { x: number; y: number; w: number; h: number; total: number; sample?: string }> = {};
        tiles.forEach(t => {
          const g = t.groupKey;
          if (!labelsMap[g]) labelsMap[g] = { x: t.x, y: t.y, w: t.w, h: t.h, total: 0, sample: samples[g] ? samples[g].name : undefined };
          labelsMap[g].x = Math.min(labelsMap[g].x, t.x);
          labelsMap[g].y = Math.min(labelsMap[g].y, t.y);
          labelsMap[g].w = Math.max(labelsMap[g].w, t.x + t.w - labelsMap[g].x);
          labelsMap[g].h = Math.max(labelsMap[g].h, t.y + t.h - labelsMap[g].y);
          labelsMap[g].total += t.size;
        });

        const labels = Object.keys(labelsMap).map(k => ({ name: k, ...labelsMap[k] }));

        return { tiles, labels, width: containerSize.width, height: containerSize.height };
      } catch (e) {
        // fallback to grouped layout on error
        console.warn('d3 layout failed, falling back to grouped layout', e);
      }
    }

    // Grouped potpack layout
    const folderBoxes: any[] = [];
    const folderMeta: Record<string, any> = {};

    groups.forEach((groupFiles, folderName) => {
      const minSide = 18;
      const total = groupFiles.reduce((s: number, f: any) => s + f.size, 0);
      const sideScale = Math.sqrt(Math.max(4000, total));
      const boxes = groupFiles.map((f: any) => {
        const area = Math.max(1, (f.size / Math.max(1, total)) * (sideScale * sideScale * Math.max(1, groupFiles.length)));
        const side = Math.max(minSide, Math.sqrt(area));
        return { w: side, h: side, meta: f };
      });

      const packed = boxes.length > 0 ? potpack(boxes) : { w: Math.max(150, sideScale), h: Math.max(150, sideScale), fill: 0 };
      folderBoxes.push({ w: packed.w + 10, h: packed.h + 10, meta: { folderName, boxes, packed, total } });
      folderMeta[folderName] = { boxes, packed, total };
    });

    const packedFolders = folderBoxes.length > 0 ? potpack(folderBoxes) : { w: 800, h: 600, fill: 0 };
    const globalScale = Math.min(containerSize.width / Math.max(1, packedFolders.w), containerSize.height / Math.max(1, packedFolders.h), 1);

    const tiles: any[] = [];
    const labels: any[] = [];

    folderBoxes.forEach((fb) => {
      const folderX = (fb.x || 0) * globalScale;
      const folderY = (fb.y || 0) * globalScale;
      const folderW = (fb.w || 0) * globalScale;
      const folderH = (fb.h || 0) * globalScale;
      const { meta } = fb;
      const { boxes, packed, total } = meta as any;

      const innerScale = Math.min((fb.w - 10) / Math.max(1, packed.w), (fb.h - 10) / Math.max(1, packed.h), 1) * globalScale;

      boxes.forEach((b: any) => {
        const file = b.meta;
        const x = Math.round((b.x || 0) * innerScale + folderX + 5);
        const y = Math.round((b.y || 0) * innerScale + folderY + 5);
        const w = Math.max(6, Math.round(b.w * innerScale));
        const h = Math.max(6, Math.round(b.h * innerScale));
        tiles.push({ key: file.fullPath, x, y, w, h, name: file.name, fullPath: file.fullPath, originalPath: file.originalPath, size: file.size, groupKey: file.groupKey });
      });

      // pick the largest file within the folder as a representative sample for the label
      let sampleName: string | undefined = undefined;
      if (boxes && boxes.length > 0) {
        const largest = boxes.reduce((m: any, b: any) => (b.meta.size > (m?.meta?.size || 0) ? b : m), boxes[0]);
        sampleName = largest?.meta?.name;
      }

      labels.push({ name: meta.folderName, x: Math.round(folderX), y: Math.round(folderY), w: Math.round(folderW), h: Math.round(folderH), total, sample: sampleName });
    });

    return { tiles, labels, width: packedFolders.w * globalScale, height: packedFolders.h * globalScale };
  }, [folderStructure, containerSize.width, containerSize.height, subgroupThreshold, useD3, hideZeroByteFiles]);

  return (
    <ResizablePanel title="File Size Visualization">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12 }}>Layout:</label>
          <button onClick={() => setUseD3(false)} style={{ fontWeight: !useD3 ? '700' : '400' }}>Grouped</button>
          <button onClick={() => setUseD3(true)} style={{ fontWeight: useD3 ? '700' : '400' }}>D3 Treemap</button>
          <label style={{ marginLeft: 12, fontSize: 12 }}>Subgroup threshold:</label>
          <input type="range" min={0} max={0.5} step={0.01} value={subgroupThreshold} onChange={(e) => setSubgroupThreshold(Number(e.target.value))} />
          <span style={{ width: 40 }}>{Math.round(subgroupThreshold * 100)}%</span>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          {/* labels */}
          {layout.labels.map((label: any) => (
            <React.Fragment key={`lbl-${label.name}`}>
              {/* outline around the group */}
              <div
                key={`outline-${label.name}`}
                style={{
                  position: 'absolute',
                  left: label.x,
                  top: label.y,
                  width: label.w,
                  height: label.h,
                  border: '1px solid rgba(0,0,0,0.18)',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.02)'
                }}
              />

              {/* label content */}
              <div key={`lblbox-${label.name}`} style={{ position: 'absolute', left: label.x + 6, top: label.y + 6, pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: 12, borderRadius: 3 }}>
                  {label.name} ({formatFileSize(label.total)})
                </div>
                {label.sample ? (
                  <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.35)', color: '#eee', padding: '2px 6px', fontSize: 11, borderRadius: 3 }}>
                    {label.sample}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          ))}

          {/* tiles */}
          {layout.tiles.map((t: any) => {
            const baseColor = getFileColor(t.name);
            const lightColor = baseColor + '80';
            return (
              <div
                key={t.key}
                className={`treemap-file ${selectedNode === t.fullPath ? 'selected' : ''} ${hoveredFolder === t.groupKey ? 'hovered-folder' : ''}`}
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  minWidth: 6,
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
                  {/* small overlay label showing the bundle file identifier (originalPath) when available */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      top: 4,
                      pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      padding: '1px 6px',
                      fontSize: 10,
                      borderRadius: 3,
                      maxWidth: Math.max(8, (t.w || 0) - 8),
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {t.originalPath || t.name}
                  </div>
                  {/* <div className="treemap-file-icon">{getFileIcon(t.name, false)}</div> */}
                  <div className="treemap-file-size">{formatFileSize(t.size)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </ResizablePanel>
  );
};
