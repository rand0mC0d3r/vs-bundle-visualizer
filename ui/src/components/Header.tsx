import React from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { isDevelopmentMode } from '../mockApi';
import { BundleData, McpServerStatus } from '../types';
import { SortCriteria, SortDirection } from './types';

const sortItems = [
  { criteria: 'filename' as SortCriteria, label: 'Name' },
  { criteria: 'fileCount' as SortCriteria, label: 'Count' },
  { criteria: 'fileSize' as SortCriteria, label: 'Size' }
]

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
  mcpStatus: McpServerStatus;
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
  mcpStatus,
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

  const panelsItems = [
    {
      action: onToggleSidePanel,
      disabled: false,
      isVisible: showSidePanel,
      label: showSidePanel ? 'Hide 📂' : 'Show 📂',
      name: 'sidePanel',
      title: 'Toggle folder panel',
    },
    {
      action: onToggleTreemapPanel,
      disabled: false,
      isVisible: showTreemapPanel,
      label: showTreemapPanel ? 'Hide 🌳' : 'Show 🌳',
      name: 'treemapPanel',
      title: 'Toggle treemap panel',
    }
  ]

  const mcpItems = [
    {
      action: startMCP,
      disabled: mcpStatus.isRunning,
      isVisible: !mcpStatus.isRunning,
      label: 'Start MCP',
      name: 'startMCP',
      title: 'Start MCP server',
    },
    {
      action: stopMCP,
      disabled: !mcpStatus.isRunning,
      isVisible: mcpStatus.isRunning,
      label: 'Stop MCP',
      name: 'stopMCP',
      title: 'Stop MCP server',
    }
  ]

  return (
    <div className="header">
      <div className="header-title">
        {isDevelopmentMode() && (
          <span className="dev-indicator">DEV</span>
        )}
        <div className="toolbar-section">
          <span className="toolbar-label">Bundle files:</span>
          <span className="toolbar-value">{filesToRender.length}</span>
        </div>
         <div className="toolbar-section">
          {panelsItems.map(item => (
            <button
              key={item.name}
              className={`toolbar-button ${item.isVisible ? 'active' : ''}`}
              onClick={item.action}
              disabled={item.disabled}
              title={item.title}
            >
            {item.label}
          </button>
          ))}
        </div>
      </div>

      <div className="toolbar">

        <div className="toolbar-section">
          <span className="toolbar-label">Sort:</span>
          {sortItems.map(item => <button
            className={`toolbar-button ${sortCriteria === item.criteria ? '' : 'active'}`}
            title={`Sort by ${item.label}`}
            onClick={() => onSortCriteriaChange(item.criteria)}
          >
            {item.label}
          </button>)}
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
            className={`toolbar-button ${hideZeroByteFiles ? 'active' : ''}`}
            onClick={onToggleZeroByteFiles}
            title="Hide files with 0B size and empty folders"
          >
            {hideZeroByteFiles ? 'Show 0B Files' : 'Hide 0B Files'}
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
            <span
              className={`mcp-status-indicator ${mcpStatus.isRunning ? 'running' : 'stopped'}`}
              title={mcpStatus.isRunning ? `MCP Server Running on port ${mcpStatus.port}` : 'MCP Server Stopped'}
            />

            {mcpItems.map(item => (
              <button
                key={item.name}
                className="toolbar-button"
                onClick={item.action}
                title={item.title}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
