import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as vscode from 'vscode';
import { BundleDataWatcher } from './bundleDataWatcher';
import { PACKAGE_NAME } from './constants';
import { analyzeBundleTool } from './tools/analyzeBundle';

export type AnalyzeFn = (folderPath: string) => Promise<Record<string, any>>;

export interface McpServerStatus {
  isRunning: boolean;
  port?: number;
}

export async function setupMcp(context: vscode.ExtensionContext, watcher?: BundleDataWatcher) {
  const disposables: vscode.Disposable[] = [];

  // MCP runtime state for in-extension transport
  let httpServer: http.Server | undefined;
  let transport: StreamableHTTPServerTransport | undefined;
  let transportPort: number | undefined;

  // Status change callback
  let statusChangeCallback: ((status: McpServerStatus) => void) | undefined;

  const server = new McpServer({
    name: 'vite-analyzer-mcp',
    version: '1.0.0',
  });

  // Register analyze tool
  server.registerTool(analyzeBundleTool.name, analyzeBundleTool.schema, analyzeBundleTool.handler);

  // Listen for bundle data changes if watcher is provided
  if (watcher) {
    const watcherDisposable = watcher.onChange(() => {
      console.log('Bundle data changed - MCP tool will use fresh data on next call');
    });
    disposables.push(watcherDisposable);
  }

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

      // Notify status change
      if (statusChangeCallback) {
        statusChangeCallback({ isRunning: true, port });
      }
    } catch (err: any) {
      console.error('Failed to start MCP HTTP transport:', err);
      vscode.window.showErrorMessage('Failed to start MCP server: ' + (err?.message ?? String(err)));
      try { httpServer && httpServer.close(); } catch {}
      httpServer = undefined;
      transport = undefined;

      // Notify status change
      if (statusChangeCallback) {
        statusChangeCallback({ isRunning: false });
      }
    }
  }

  // Ensure we close the server on extension deactivation
  disposables.push({ dispose: () => { try { server.close?.(); } catch {} } });

  // Start the MCP server automatically at activation
  await startMcpServer();

  return {
    disposables,
    startMcpServer,
    stopMcpServer: async () => {
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

      // Notify status change
      if (statusChangeCallback) {
        statusChangeCallback({ isRunning: false });
      }
    },
    copyMcpDefinition: async () => {
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
    },
    getStatus: (): McpServerStatus => {
      return {
        isRunning: !!httpServer,
        port: transportPort
      };
    },
    onStatusChange: (callback: (status: McpServerStatus) => void) => {
      statusChangeCallback = callback;
    }
  };
}
