import React from 'react';
import { isDevelopmentMode } from '../mockApi';
import { SortCriteria, SortDirection } from './types';

interface HeaderProps {
  showSidePanel: boolean;
  showTreemapPanel: boolean;
  hideZeroByteFiles: boolean;
  sortCriteria: SortCriteria;
  sortDirection: SortDirection;
  hiddenRootFolders: Set<string>;
  onToggleSidePanel: () => void;
  onToggleTreemapPanel: () => void;
  onToggleZeroByteFiles: () => void;
  onSortCriteriaChange: (criteria: SortCriteria) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onToggleFolderFilter: (folder: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showSidePanel,
  showTreemapPanel,
  hideZeroByteFiles,
  sortCriteria,
  sortDirection,
  hiddenRootFolders,
  onToggleSidePanel,
  onToggleTreemapPanel,
  onToggleZeroByteFiles,
  onSortCriteriaChange,
  onSortDirectionChange,
  onToggleFolderFilter,
  onExpandAll,
  onCollapseAll,
  onRefresh,
}) => {
  return (
    <div className="header">
      <div className="header-content">
        <h1>Bundle Visualizer</h1>
        {isDevelopmentMode() && (
          <div className="dev-indicator">DEV</div>
        )}
      </div>
      <div className="toolbar">
        <button
          className="refresh-button"
          onClick={onToggleSidePanel}
          title="Toggle folder panel"
        >
          {showSidePanel ? 'Hide Folders' : 'Show Folders'}
        </button>
        <button
          className="refresh-button"
          onClick={onToggleTreemapPanel}
          title="Toggle treemap panel"
        >
          {showTreemapPanel ? 'Hide Treemap' : 'Show Treemap'}
        </button>
        <button
          className={`refresh-button ${hideZeroByteFiles ? 'active' : ''}`}
          onClick={onToggleZeroByteFiles}
          title="Hide files with 0B size and empty folders"
        >
          {hideZeroByteFiles ? 'Show 0B Files' : 'Hide 0B Files'}
        </button>
                <div className="toolbar-group">
          <span className="toolbar-label">Sort:</span>
          <button
            className={`icon-button ${sortCriteria === 'filename' ? 'active' : ''}`}
            title="Sort by Name"
            onClick={() => onSortCriteriaChange('filename')}
          >
            Name
          </button>
          <button
            className={`icon-button ${sortCriteria === 'fileCount' ? 'active' : ''}`}
            title="Sort by Count"
            onClick={() => onSortCriteriaChange('fileCount')}
          >
            Count
          </button>
          <button
            className={`icon-button ${sortCriteria === 'fileSize' ? 'active' : ''}`}
            title="Sort by Size"
            onClick={() => onSortCriteriaChange('fileSize')}
          >
            Size
          </button>
          <button
            className="icon-button"
            title={`Sort Direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <button
          className="icon-button"
          title="Toggle Folder Filter"
          onClick={() => onToggleFolderFilter('/')}
        >
          🗂️
        </button>
        <button
          className={`refresh-button ${hiddenRootFolders.size > 0 ? 'active' : ''}`}
          onClick={() => onToggleFolderFilter('/')}
          title="Toggle root folder visibility"
        >
          Filter Folders
        </button>
        <button
          className="refresh-button"
          onClick={onExpandAll}
          title="Expand all folders"
        >
          Expand All
        </button>
        <button
          className="refresh-button"
          onClick={onCollapseAll}
          title="Collapse all folders"
        >
          Collapse All
        </button>
        <button
          className="refresh-button"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
    </div>
  );
};
