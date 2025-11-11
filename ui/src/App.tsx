import { useState } from 'react';
import './App.css';
import { FolderPanel } from './components/FolderPanel';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { TreemapPanel } from './components/TreemapPanel';
import { TreeView } from './components/TreeView';
import { FolderNode, SortCriteria, SortDirection } from './components/types';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { getRootFolders } from './utils/folderUtils';

function App() {
  const { bundleData, theme, error, mcpStatus, vscodeApi } = useVSCodeApi();

  // UI State
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);
  const [showTreemapPanel, setShowTreemapPanel] = useState<boolean>(false);
  const [showMainPanel, setShowMainPanel] = useState<boolean>(true);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('filename');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [hiddenRootFolders, setHiddenRootFolders] = useState<Set<string>>(new Set());
  const [hideZeroByteFiles, setHideZeroByteFiles] = useState<boolean>(false);
  const [libraryFilters, setLibraryFilters] = useState<string[]>([]);

  // Event Handlers
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const selectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const selectFolder = (folderPath: string) => {
    setSelectedFolder(folderPath);
  };

  const expandAll = () => {
    const getAllNodeIds = (node: any, path: string = ''): string[] => {
      const nodeId = `${path}/${node.name}`.replace(/^\//, '');
      const ids = [nodeId];

      if (node.children) {
        node.children.forEach((child: any) => {
          ids.push(...getAllNodeIds(child, nodeId));
        });
      }

      return ids;
    };

    // Expand main tree nodes
    if (bundleData?.tree?.children) {
      const allIds = new Set<string>();
      bundleData.tree.children.forEach((rootNode: any) => {
        getAllNodeIds(rootNode).forEach(id => allIds.add(id));
      });
      setExpandedNodes(allIds);
    }

    // Also expand all folders in side panel
    const getAllFolderPaths = (folder: FolderNode): string[] => {
      const paths = [folder.path];
      folder.children.forEach(child => {
        paths.push(...getAllFolderPaths(child));
      });
      return paths;
    };

    // if (bundleData) {
    //   const folderStructure = buildFolderStructure(bundleData, hideZeroByteFiles, hiddenRootFolders);
    //   const allFolderPaths = new Set(getAllFolderPaths(folderStructure));
    //   setExpandedFolders(allFolderPaths);
    // }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
    // setExpandedFolders(new Set());
  };

  const addLibraryFilter = (library: string) => {
    if (!libraryFilters.includes(library)) {
      setLibraryFilters([...libraryFilters, library]);
    }
  };

  const removeLibraryFilter = (library: string) => {
    setLibraryFilters(libraryFilters.filter(f => f !== library));
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const changeSortCriteria = (criteria: SortCriteria) => {
    setSortCriteria(criteria);
  };

  const toggleRootFolderVisibility = () => {
    if (!bundleData) return;
    const rootFolders = getRootFolders(bundleData);
    if (rootFolders.length > 0) {
      const newHidden = new Set(hiddenRootFolders);
      if (newHidden.has(rootFolders[0])) {
        newHidden.delete(rootFolders[0]);
      } else {
        newHidden.add(rootFolders[0]);
      }
      setHiddenRootFolders(newHidden);
    }
  };

  const scrollToFileInMainContent = (filePath: string) => {
    // Set the selected node first
    setSelectedNode(filePath);

    // Find and expand all parent nodes in the main tree to make the file visible
    const expandParentNodes = (targetPath: string) => {
      const parts = targetPath.split('/');
      const newExpanded = new Set(expandedNodes);

      // Build all parent paths and expand them
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        newExpanded.add(currentPath);
      }

      setExpandedNodes(newExpanded);
    };

    expandParentNodes(filePath);

    // Scroll to the element after a short delay to allow rendering
    setTimeout(() => {
      const element = document.querySelector(`[data-file-path="${filePath}"]`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    vscodeApi,
    showSidePanel,
    showTreemapPanel,
    hideZeroByteFiles,
    onExpandAll: expandAll,
    onCollapseAll: collapseAll,
    onToggleSidePanel: () => setShowSidePanel(!showSidePanel),
    onToggleTreemapPanel: () => setShowTreemapPanel(!showTreemapPanel),
    onToggleZeroByteFiles: () => setHideZeroByteFiles(!hideZeroByteFiles),
    onToggleSortDirection: toggleSortDirection,
    onChangeSortCriteria: changeSortCriteria,
    onToggleRootFolderVisibility: toggleRootFolderVisibility
  });

  const rootFolders = bundleData ? getRootFolders(bundleData) : [];

  return (
    <div className={`app theme-${theme.kind === 1 ? 'light' : 'dark'}`}>
      <Header
        {...{ showMainPanel }}
        bundleData={bundleData}
        libraryFilters={libraryFilters}
        showSidePanel={showSidePanel}
        showTreemapPanel={showTreemapPanel}
        hideZeroByteFiles={hideZeroByteFiles}
        sortCriteria={sortCriteria}
        sortDirection={sortDirection}
        hiddenRootFolders={hiddenRootFolders}
        rootFolders={rootFolders}
        mcpStatus={mcpStatus}
        onToggleSidePanel={() => setShowSidePanel(!showSidePanel)}
        onToggleTreemapPanel={() => setShowTreemapPanel(!showTreemapPanel)}
        onToggleMainPanel={() => setShowMainPanel(!showMainPanel)}
        onToggleZeroByteFiles={() => setHideZeroByteFiles(!hideZeroByteFiles)}
        onSortCriteriaChange={setSortCriteria}
        onSortDirectionChange={setSortDirection}
        onToggleFolderFilter={(folder) => {
          const newHidden = new Set(hiddenRootFolders);
          if (newHidden.has(folder)) {
            newHidden.delete(folder);
          } else {
            newHidden.add(folder);
          }
          setHiddenRootFolders(newHidden);
        }}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onRefresh={() => vscodeApi.postMessage({ command: 'refresh' })}
        startMCP={() => vscodeApi.postMessage({ command: 'startMcp' })}
        stopMCP={() => vscodeApi.postMessage({ command: 'stopMcp' })}
      />

      <div className="content">
        {error ? (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        ) : bundleData?.tree?.children ? (
          <div className="main-layout">
            {showSidePanel && (
              <FolderPanel
                bundleData={bundleData}
                expandedFolders={expandedFolders}
                selectedFolder={selectedFolder}
                selectedNode={selectedNode}
                hideZeroByteFiles={hideZeroByteFiles}
                hiddenRootFolders={hiddenRootFolders}
                libraryFilters={libraryFilters}
                onToggleFolder={toggleFolder}
                onSetExpandedFolders={(folders: Set<string>) => setExpandedFolders(folders)}
                onSelectFolder={selectFolder}
                onScrollToFile={scrollToFileInMainContent}
                onAddLibraryFilter={addLibraryFilter}
                onRemoveLibraryFilter={removeLibraryFilter}
              />
            )}
            {showTreemapPanel && (
              <TreemapPanel
                libraryFilters={libraryFilters}
                bundleData={bundleData}
                sortCriteria={sortCriteria}
                sortDirection={sortDirection}
                selectedNode={selectedNode}
                hideZeroByteFiles={hideZeroByteFiles}
                hiddenRootFolders={hiddenRootFolders}
                onScrollToFile={scrollToFileInMainContent}
              />
            )}
            {showMainPanel && (
              <TreeView
                bundleData={bundleData}
                expandedNodes={expandedNodes}
                selectedNode={selectedNode}
                sortCriteria={sortCriteria}
                sortDirection={sortDirection}
                hideZeroByteFiles={hideZeroByteFiles}
                hiddenRootFolders={hiddenRootFolders}
                libraryFilters={libraryFilters}
                vscodeApi={vscodeApi}
                onToggleNode={toggleNode}
                onSelectNode={selectNode}
                onAddLibraryFilter={addLibraryFilter}
                onRemoveLibraryFilter={removeLibraryFilter}
              />
            )}
          </div>
        ) : (
          <div className="loading">
            No bundle data available. Please open a file or refresh.
          </div>
        )}
      </div>

      <StatusBar
        bundleData={bundleData}
        hiddenRootFolders={hiddenRootFolders}
      />
    </div>
  );
}

export default App;
