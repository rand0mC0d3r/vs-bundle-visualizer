import React from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { isDevelopmentMode } from '../mockApi';
import { BundleData } from '../types';
import { SortCriteria, SortDirection } from './types';

interface HeaderProps {
  bundleData?: BundleData | null;
  showSidePanel: boolean;
  libraryFilters: string[];
  showTreemapPanel: boolean;
  hideZeroByteFiles: boolean;
  sortCriteria: SortCriteria;
  sortDirection: SortDirection;
  hiddenRootFolders: Set<string>;
  rootFolders: string[];
  onToggleSidePanel: () => void;
  onToggleTreemapPanel: () => void;
  onToggleZeroByteFiles: () => void;
  onSortCriteriaChange: (criteria: SortCriteria) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onToggleFolderFilter: (folder: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  startMCP: () => void;
  stopMCP: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  bundleData,
  showSidePanel,
  libraryFilters,
  showTreemapPanel,
  hideZeroByteFiles,
  sortCriteria,
  sortDirection,
  hiddenRootFolders,
  rootFolders,
  onToggleSidePanel,
  onToggleTreemapPanel,
  onToggleZeroByteFiles,
  onSortCriteriaChange,
  onSortDirectionChange,
  onToggleFolderFilter,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  startMCP,
  stopMCP,
}) => {
  const { filesToRender } = bundleData
    ? useFilteredNodes(bundleData, hiddenRootFolders, sortCriteria, sortDirection, libraryFilters)
    : { filesToRender: [] };

  return (
    <div className="header">
      <div className="header-title">
        {isDevelopmentMode() && (
          <span className="dev-indicator">DEV</span>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar-section">
          <span className="toolbar-label">Bundle files:</span>
          <span className="toolbar-value">{filesToRender.length}</span>
        </div>

        <div className="toolbar-section">
          <button
            className="toolbar-button"
            onClick={onToggleSidePanel}
            title="Toggle folder panel"
          >
            {showSidePanel ? 'Hide Folders' : 'Show Folders'}
          </button>
          <button
            className="toolbar-button"
            onClick={onToggleTreemapPanel}
            title="Toggle treemap panel"
          >
            {showTreemapPanel ? 'Hide Treemap' : 'Show Treemap'}
          </button>
          <button
            className={`toolbar-button ${hideZeroByteFiles ? 'active' : ''}`}
            onClick={onToggleZeroByteFiles}
            title="Hide files with 0B size and empty folders"
          >
            {hideZeroByteFiles ? 'Show 0B Files' : 'Hide 0B Files'}
          </button>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Sort:</span>
          <button
            className={`toolbar-button ${sortCriteria === 'filename' ? '' : 'active'}`}
            title="Sort by Name"
            onClick={() => onSortCriteriaChange('filename')}
          >
            Name
          </button>
          <button
            className={`toolbar-button ${sortCriteria === 'fileCount' ? '' : 'active'}`}
            title="Sort by Count"
            onClick={() => onSortCriteriaChange('fileCount')}
          >
            Count
          </button>
          <button
            className={`toolbar-button ${sortCriteria === 'fileSize' ? '' : 'active'}`}
            title="Sort by Size"
            onClick={() => onSortCriteriaChange('fileSize')}
          >
            Size
          </button>
          <button
            className="toolbar-button"
            title={`Sort Direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {rootFolders.length > 0 && (
          <div className="toolbar-section">
            <span className="toolbar-label">Folders:</span>
            {rootFolders.map(folder => (
              <button
                key={folder}
                className={`toolbar-button ${hiddenRootFolders.has(folder) ? 'active' : ''}`}
                onClick={() => onToggleFolderFilter(folder)}
                title={`${hiddenRootFolders.has(folder) ? 'Show' : 'Hide'} folder: ${folder}`}
              >
                {folder || 'root'}
              </button>
            ))}
          </div>
        )}

        <div className="toolbar-section">
          <button
            className="toolbar-button"
            onClick={onExpandAll}
            title="Expand all folders"
          >
            Expand All
          </button>
          <button
            className="toolbar-button"
            onClick={onCollapseAll}
            title="Collapse all folders"
          >
            Collapse All
          </button>
          <button
            className="toolbar-button"
            onClick={onRefresh}
            title="Refresh bundle data"
          >
            Refresh
          </button>
        </div>

        <div className="toolbar-section">
          <button
            className="toolbar-button"
            onClick={startMCP}
            title="Start MCP server"
          >
            Start MCP
          </button>
          <button
            className="toolbar-button"
            onClick={stopMCP}
            title="Stop MCP server"
          >
            Stop MCP
          </button>
        </div>
      </div>
    </div>
  );
};
