import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as vscode from 'vscode';
import { BundleData, FilterOptions, processAndFilterNodes } from './bundleFilterUtils';
import { PACKAGE_NAME } from './constants';

/**
 * Read and parse the bundle stats JSON file from the workspace
 */
async function readBundleDataFromFile(): Promise<BundleData> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
  const statsPath = config.get<string>('statsPath') || 'dist/stats.json';
  const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, statsPath);

  try {
    const data = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder('utf-8').decode(data);
    const json = JSON.parse(text);
    return json as BundleData;
  } catch (err: any) {
    throw new Error(`Failed to read bundle stats file from ${statsPath}: ${err.message}`);
  }
}

async function analyzeBundle(
  filterOptions?: FilterOptions
) {
  // Read bundle data from file
  const bundleData = await readBundleDataFromFile();

  // Process and filter the bundle data using the shared utility
  const processedNodes = processAndFilterNodes(bundleData, filterOptions);

  const summary: Record<string, any> = {
    totalFiles: processedNodes.length,
    totalSize: processedNodes.reduce((sum, node) => sum + node.totalSize, 0),
    files: processedNodes.map(node => ({
      name: node.name,
      children: node.children,
      folder: node.folder,
      fileName: node.fileName,
      size: node.totalSize,
      fileCount: node.counts.files,
      folderCount: node.counts.folders
    }))
  };

  return summary;
}

export type AnalyzeFn = (folderPath: string) => Promise<Record<string, any>>;

export async function setupMcp(context: vscode.ExtensionContext) {
  const disposables: vscode.Disposable[] = [];

  // MCP runtime state for in-extension transport
  let httpServer: http.Server | undefined;
  let transport: StreamableHTTPServerTransport | undefined;
  let transportPort: number | undefined;

  const server = new McpServer({
    name: 'vite-analyzer-mcp',
    version: '1.0.0',
  });

  // Register analyze tool
  server.registerTool(
    'analyzeBundle',
    {
      title: 'Analyze Bundle',
      description: 'Analyze Vite build output from the configured stats file (bundleVisualizer.statsPath). Optional filter parameters: sortCriteria (filename|fileCount|fileSize), sortDirection (asc|desc), hiddenRootFolders (array), libraryFilters (array).'
    },
    async (params: any) => {
      const filterOptions: FilterOptions = {
        sortCriteria: params?.sortCriteria || 'filename',
        sortDirection: params?.sortDirection || 'asc',
        hiddenRootFolders: params?.hiddenRootFolders || [],
        libraryFilters: params?.libraryFilters || []
      };

      try {
        const summary = await analyzeBundle(filterOptions);
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          structuredContent: summary
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // Provide an MCP server definition provider (runtime) when available
  try {
    const mcpProvider = {
      provideMcpServerDefinitions: async () => {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const port = config.get<number>('mcpPort') || 5215;
        const def = {
          id: 'bundle-visualizer-built-in',
          label: 'Bundle Visualizer (built-in)',
          host: 'localhost',
          port,
          launch: {
            command: 'bundleVisualizer.startMcpServer'
          }
        };
        return [def];
      },
      resolveMcpServerDefinition: async (def: any) => {
        return {
          ...def,
          launch: {
            command: 'bundleVisualizer.startMcpServer'
          }
        };
      }
    };

    // @ts-ignore - the API may not be present in older hosts
    const regFn = (vscode as any).registerMcpServerDefinitionProvider;
    if (typeof regFn === 'function') {
      // @ts-ignore
      const disposable = regFn('vite-analyzer', mcpProvider);
      if (disposable) { disposables.push(disposable as vscode.Disposable); }
    } else {
      console.info('VS Code does not expose registerMcpServerDefinitionProvider; skipping runtime registration.');
    }
  } catch (err) {
    console.warn('MCP server definition provider registration failed:', err);
  }

  // Helper function to start the MCP server
  async function startMcpServer() {
    if (httpServer) {
      vscode.window.showInformationMessage(`MCP server already running on port ${transportPort}`);
      return;
    }

    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const port = config.get<number>('mcpPort') || 5215;

    try {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });

      httpServer = http.createServer((req, res) => {
        transport!.handleRequest(req as any, res as any).catch((err: any) => {
          console.error('MCP transport handleRequest error:', err);
          try { res.writeHead?.(500); res.end?.('Internal Server Error'); } catch {}
        });
      });

      await new Promise<void>((resolve, reject) => {
        httpServer!.once('error', reject);
        httpServer!.listen(port, () => resolve());
      });

      await server.connect(transport as any);

      transportPort = port;
      disposables.push({ dispose: async () => {
        try { await server.close(); } catch {}
        try { httpServer && httpServer.close(); } catch {}
      }});

      vscode.window.showInformationMessage(`MCP server listening on port ${port}`);
    } catch (err: any) {
      console.error('Failed to start MCP HTTP transport:', err);
      vscode.window.showErrorMessage('Failed to start MCP server: ' + (err?.message ?? String(err)));
      try { httpServer && httpServer.close(); } catch {}
      httpServer = undefined;
      transport = undefined;
    }
  }

  // Commands: start / stop / copy definition
  const startCmd = vscode.commands.registerCommand('bundleVisualizer.startMcpServer', async () => {
    await startMcpServer();
  });
  disposables.push(startCmd);

  const stopCmd = vscode.commands.registerCommand('bundleVisualizer.stopMcpServer', async () => {
    if (!httpServer && !transport) {
      vscode.window.showInformationMessage('MCP server is not running.');
      return;
    }
    try { await server.close(); } catch (err) { console.warn('Error closing MCP server:', err); }
    try {
      await new Promise<void>((resolve, reject) => {
        if (!httpServer) { return resolve(); }
        httpServer.close((err) => err ? reject(err) : resolve());
      });
    } catch (err) {
      console.warn('Error closing HTTP server:', err);
    }
    httpServer = undefined;
    transport = undefined;
    transportPort = undefined;
    vscode.window.showInformationMessage('MCP server stopped.');
  });
  disposables.push(stopCmd);

  const copyCmd = vscode.commands.registerCommand('bundleVisualizer.copyMcpDefinition', async () => {
    try {
      const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
      const port = config.get<number>('mcpPort') || 5215;

      const def = {
        id: 'bundle-visualizer-built-in',
        label: 'Bundle Visualizer (built-in)',
        host: 'localhost',
        port,
        launch: {
          command: 'bundleVisualizer.startMcpServer'
        }
      } as const;

      const text = JSON.stringify(def, null, 2);
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('MCP server definition copied to clipboard. Paste it into Configure Tools or your settings.');
    } catch (err: any) {
      console.error('Failed to copy MCP server definition:', err);
      vscode.window.showErrorMessage('Failed to copy MCP server definition: ' + (err?.message ?? String(err)));
    }
  });
  disposables.push(copyCmd);

  // Ensure we close the server on extension deactivation
  disposables.push({ dispose: () => { try { server.close?.(); } catch {} } });

  // Start the MCP server automatically at activation
  await startMcpServer();

  return disposables;
}
