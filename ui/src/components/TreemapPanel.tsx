import React, { useEffect, useRef, useState } from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { useTreemapData } from '../hooks/useTreemapData';
import { useTreemapLayout } from '../hooks/useTreemapLayout';
import { BundleData } from '../types';
import { ResizablePanel } from './General/ResizablePanel';
import { TreemapLayers } from './Treemap/TreemapLayers';
import { TreemapTiles } from './Treemap/TreemapTiles';
import { TreemapWrappers } from './Treemap/TreemapWrappers';

interface TreemapPanelProps {
  bundleData: BundleData;
  libraryFilters: string[];
  selectedNode: string | null;
  hideZeroByteFiles: boolean;
  hiddenRootFolders: Set<string>;
  onScrollToFile: (filePath: string) => void;
  sortCriteria: string;
  sortDirection: string;
}

export const TreemapPanel: React.FC<TreemapPanelProps> = ({
  bundleData,
  libraryFilters,
  selectedNode,
  hideZeroByteFiles,
  hiddenRootFolders,
  onScrollToFile,
  sortCriteria,
  sortDirection,
}) => {
  if (!bundleData) return null as any;

  const { filesToRender } = useFilteredNodes(bundleData, hiddenRootFolders,  sortCriteria, sortDirection, libraryFilters);

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

  const layout = useTreemapLayout(folderStructure, containerSize, bundleData);

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
