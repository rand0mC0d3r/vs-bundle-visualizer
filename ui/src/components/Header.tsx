import React from 'react';
import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { isDevelopmentMode } from '../mockApi';
import { BundleData, McpServerStatus } from '../types';
import { MiniToolbar } from './Header/MiniToolbar';
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
  showMainPanel: boolean;
  onToggleMainPanel: () => void;
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
  showMainPanel,
  onToggleMainPanel
}) => {
  const { filesToRender } = bundleData
    ? useFilteredNodes(bundleData, hiddenRootFolders, sortCriteria, sortDirection, libraryFilters)
    : { filesToRender: [] };

  const panelsItems = [
    {
      action: onToggleSidePanel,
      disabled: false,
      isVisible: !showSidePanel,
      label: !showSidePanel ? 'Hide 📂' : 'Show 📂',
      name: 'sidePanel',
      title: 'Toggle folder panel',
    },
    {
      action: onToggleTreemapPanel,
      disabled: false,
      isVisible: !showTreemapPanel,
      label: !showTreemapPanel ? 'Hide 🌳' : 'Show 🌳',
      name: 'treemapPanel',
      title: 'Toggle treemap panel',
    },
    {
      action: onToggleMainPanel,
      disabled: false,
      isVisible: !showMainPanel,
      label: !showMainPanel ? 'Hide 📋' : 'Show 📋',
      name: 'mainPanel',
      title: 'Toggle main panel',
    }
  ]

  const mcpItems = [
    {
      action: startMCP,
      disabled: mcpStatus.isRunning,
      isVisible: mcpStatus.isRunning,
      label: 'Start MCP',
      name: 'startMCP',
      title: 'Start MCP server',
    },
    {
      action: stopMCP,
      disabled: !mcpStatus.isRunning,
      isVisible: !mcpStatus.isRunning,
      label: 'Stop MCP',
      name: 'stopMCP',
      title: 'Stop MCP server',
    }
  ]

  const visualizationItems = [
    {
        action: onExpandAll,
        disabled: false,
        isVisible: false,
        label: 'Expand All',
        name: 'expandAll',
        title: 'Expand all folders',
    },
    {
        action: onCollapseAll,
        disabled: false,
        isVisible: false,
        label: 'Collapse All',
        name: 'collapseAll',
        title: 'Collapse all folders',
    },
    {
        action: onToggleZeroByteFiles,
        disabled: false,
        isVisible: hideZeroByteFiles,
        label: hideZeroByteFiles ? 'Show 0B Files' : 'Hide 0B Files',
        name: 'toggleZeroByteFiles',
        title: 'Toggle visibility of zero-byte files',
    },
    {
        action: onRefresh,
        disabled: false,
        isVisible: false,
        label: 'Refresh',
        name: 'refresh',
        title: 'Refresh bundle data',
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

        <MiniToolbar items={panelsItems} />
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

        <MiniToolbar items={visualizationItems} />

        <MiniToolbar items={mcpItems} position='start'>
          <span
            className={`mcp-status-indicator ${mcpStatus.isRunning ? 'running' : 'stopped'}`}
            title={mcpStatus.isRunning ? `MCP Server Running on port ${mcpStatus.port}` : 'MCP Server Stopped'}
          />
        </MiniToolbar>
      </div>
    </div>
  );
};
