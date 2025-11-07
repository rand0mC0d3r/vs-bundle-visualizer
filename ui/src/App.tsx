import { useEffect, useState } from 'react';
import './App.css';
import { createMockVSCodeApi, isDevelopmentMode } from './mockApi';
import { BundleData, VSCodeAPI, VSCodeMessage, VSCodeTheme } from './types';

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

function App() {
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [theme, setTheme] = useState<VSCodeTheme>({ kind: 2 });
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);
  const [vscodeApi] = useState(() => {
    // Use mock API in development mode, real API in VS Code
    if (isDevelopmentMode()) {
      console.log('Running in development mode - using mock VS Code API');
      return createMockVSCodeApi();
    }
    return window.acquireVsCodeApi();
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: VSCodeMessage = event.data;

      switch (message.command) {
        case 'updateData':
          setBundleData(message.data);
          setError(null);
          break;
        case 'updateTheme':
          setTheme(message.data);
          break;
        case 'error':
          setError(message.data);
          setBundleData(null);
          break;
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'e':
            event.preventDefault();
            expandAll();
            break;
          case 'w':
            event.preventDefault();
            collapseAll();
            break;
          case 'r':
            event.preventDefault();
            vscodeApi.postMessage({ command: 'refresh' });
            break;
          case 'b':
            event.preventDefault();
            setShowSidePanel(!showSidePanel);
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleKeydown);

    // Request initial data
    vscodeApi.postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [vscodeApi]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext;
  };

  const getFileIcon = (name: string, isFolder: boolean): string => {
    if (isFolder) return '📁';

    const ext = getFileExtension(name);
    const iconMap: { [key: string]: string } = {
      js: '📄',
      ts: '📘',
      tsx: '📘',
      jsx: '📄',
      css: '🎨',
      scss: '🎨',
      html: '🌐',
      json: '📋',
      md: '📝',
      png: '🖼️',
      jpg: '🖼️',
      jpeg: '🖼️',
      gif: '🖼️',
      svg: '🖼️',
      ico: '🖼️'
    };

    return iconMap[ext] || '📄';
  };

  // Build folder structure from flat file list
  interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: Array<{ name: string; size: number; fullPath: string }>;
    totalSize: number;
  }

  const buildFolderStructure = (bundleData: BundleData): FolderNode => {
    const root: FolderNode = {
      name: 'root',
      path: '',
      children: [],
      files: [],
      totalSize: 0
    };

    const folderMap = new Map<string, FolderNode>();
    folderMap.set('', root);

    const getAllFiles = (node: any, currentPath: string = ''): Array<{ name: string; size: number; fullPath: string }> => {
      const files: Array<{ name: string; size: number; fullPath: string }> = [];

      if (node.name && !node.children) {
        // This is a file
        files.push({
          name: node.name,
          size: node.value || 0,
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
    const allFiles: Array<{ name: string; size: number; fullPath: string }> = [];
    if (bundleData?.tree?.children) {
      bundleData.tree.children.forEach(rootNode => {
        allFiles.push(...getAllFiles(rootNode));
      });
    }

    // Build folder structure
    allFiles.forEach(file => {
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

      // Add file to its folder
      currentFolder.files.push({
        name: fileName,
        size: file.size,
        fullPath: file.fullPath
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
    return root;
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

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
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

    if (bundleData?.tree?.children) {
      const allIds = new Set<string>();
      bundleData.tree.children.forEach((rootNode: any) => {
        getAllNodeIds(rootNode).forEach(id => allIds.add(id));
      });
      setExpandedNodes(allIds);
    }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const selectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const renderTreeNode = (node: any, path: string = '', level: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const isFolder = hasChildren;
    const nodeId = `${path}/${node.name}`.replace(/^\//, '');
    const isExpanded = expandedNodes.has(nodeId);
    const isSelected = selectedNode === nodeId;

    return (
      <div key={nodeId} className="tree-node">
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: level * 16 + 4 }}
          onClick={() => selectNode(nodeId)}
        >
          <div className="tree-item-content">
            {hasChildren && (
              <div
                className={`tree-icon expandable ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(nodeId);
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </div>
            )}
            {!hasChildren && <div className="tree-icon" />}

            <div className={`tree-icon ${isFolder ? 'folder' : 'file'} ${getFileExtension(node.name)}`}>
              {getFileIcon(node.name, isFolder)}
            </div>

            <div className={`tree-label ${isFolder ? 'folder' : ''}`}>
              {node.name}
            </div>

            {node.value && (
              <div className="tree-size">
                {formatFileSize(node.value)}
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child: any) =>
              renderTreeNode(child, nodeId, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const calculateTotalSize = (node: any): number => {
    if (node.value) return node.value;
    if (node.children) {
      return node.children.reduce((total: number, child: any) => total + calculateTotalSize(child), 0);
    }
    return 0;
  };

  const countFiles = (node: any): { files: number; folders: number } => {
    if (!node.children || node.children.length === 0) {
      return { files: 1, folders: 0 };
    }

    return node.children.reduce(
      (acc: { files: number; folders: number }, child: any) => {
        const childCounts = countFiles(child);
        return {
          files: acc.files + childCounts.files,
          folders: acc.folders + childCounts.folders + (child.children ? 1 : 0)
        };
      },
      { files: 0, folders: 0 }
    );
  };

  const renderFolderTree = (folder: FolderNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(folder.path);
    const isSelected = selectedFolder === folder.path;
    const hasChildren = folder.children.length > 0 || folder.files.length > 0;

    return (
      <div key={folder.path} className="folder-node">
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: level * 16 + 4 }}
          onClick={() => selectFolder(folder.path)}
        >
          <div className="tree-item-content">
            {hasChildren && (
              <div
                className={`tree-icon expandable`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.path);
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </div>
            )}
            {!hasChildren && <div className="tree-icon" />}

            <div className="tree-icon folder">📁</div>

            <div className="tree-label folder">
              {folder.name || 'root'}
            </div>

            <div className="tree-size">
              {formatFileSize(folder.totalSize)}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="tree-children">
            {folder.children.map(child =>
              renderFolderTree(child, level + 1)
            )}
            {folder.files.map(file => (
              <div
                key={file.fullPath}
                className={`tree-item ${selectedNode === file.fullPath ? 'selected' : ''}`}
                style={{ paddingLeft: (level + 1) * 16 + 4 }}
                onClick={() => setSelectedNode(file.fullPath)}
              >
                <div className="tree-item-content">
                  <div className="tree-icon" />
                  <div className={`tree-icon file ${getFileExtension(file.name)}`}>
                    {getFileIcon(file.name, false)}
                  </div>
                  <div className="tree-label">
                    {file.name}
                  </div>
                  <div className="tree-size">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`app theme-${theme.kind === 1 ? 'light' : 'dark'}`}>
      <div className="header">
        <h1>Bundle Visualizer</h1>
        {isDevelopmentMode() && (
          <div className="dev-indicator">
            DEV MODE
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="refresh-button"
            onClick={() => setShowSidePanel(!showSidePanel)}
            title="Toggle folder panel"
          >
            {showSidePanel ? 'Hide Folders' : 'Show Folders'}
          </button>
          <button
            className="refresh-button"
            onClick={expandAll}
            title="Expand all folders"
          >
            Expand All
          </button>
          <button
            className="refresh-button"
            onClick={collapseAll}
            title="Collapse all folders"
          >
            Collapse All
          </button>
          <button
            className="refresh-button"
            onClick={() => vscodeApi.postMessage({ command: 'refresh' })}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="content">
        {error ? (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        ) : bundleData?.tree?.children ? (
          <div className="main-layout">
            {showSidePanel && (
              <div className="side-panel">
                <div className="side-panel-header">
                  <h3>Folder Structure</h3>
                </div>
                <div className="side-panel-content">
                  {(() => {
                    const folderStructure = buildFolderStructure(bundleData);
                    return renderFolderTree(folderStructure);
                  })()}
                </div>
              </div>
            )}
            <div className={`tree-container ${showSidePanel ? 'with-sidebar' : ''}`}>
              {bundleData.tree.children.map((rootNode: any) => {
                const totalSize = calculateTotalSize(rootNode);
                const counts = countFiles(rootNode);

                return (
                  <div key={rootNode.name || rootNode.id} className="tree-root">
                    <div className="tree-root-header">
                      <span>{rootNode.name || 'Bundle Root'}</span>
                      <div className="file-stats">
                        <span>{counts.files} files</span>
                        <span>{counts.folders} folders</span>
                        <span>{formatFileSize(totalSize)}</span>
                      </div>
                    </div>
                    <div className="tree-root-content">
                      {rootNode.children ? (
                        rootNode.children.map((child: any) =>
                          renderTreeNode(child, rootNode.name || 'root', 0)
                        )
                      ) : (
                        renderTreeNode(rootNode, '', 0)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : bundleData ? (
          <div className="loading">Bundle data loaded but no tree structure found</div>
        ) : (
          <div className="loading">Loading bundle data...</div>
        )}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-info">
          {selectedNode && <span>Selected: {selectedNode}</span>}
          {bundleData?.tree?.children && (
            <span>
              {bundleData.tree.children.reduce((total, node) => {
                const counts = countFiles(node);
                return total + counts.files + counts.folders;
              }, 0)} items
            </span>
          )}
        </div>
        <div className="status-shortcuts">
          <span><span className="kbd">Ctrl+B</span> Toggle Panel</span>
          <span><span className="kbd">Ctrl+E</span> Expand All</span>
          <span><span className="kbd">Ctrl+W</span> Collapse All</span>
          <span><span className="kbd">Ctrl+R</span> Refresh</span>
        </div>
      </div>
    </div>
  );
}

export default App;
