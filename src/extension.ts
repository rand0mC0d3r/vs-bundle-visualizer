import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import * as http from 'http';

async function analyzeBundle(folderPath: string) {
  const summary: Record<string, any> = {};

  return summary;
}

export async function activate(context: vscode.ExtensionContext) {
  const provider = new BundleVisualizerProvider(context.extensionUri);

  // MCP runtime state for in-extension transport
  let httpServer: http.Server | undefined;
  let transport: StreamableHTTPServerTransport | undefined;
  let transportPort: number | undefined;

  // Register an MCP server definition provider so VS Code's "Configure Tools" UI
  // can discover this extension as a built-in MCP server provider. The provider
  // returns a minimal server definition (label) so it appears in the list. We
  // use a safe any-cast because the API surface may not be present in older
  // @types/vscode packages in this workspace.
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
      // Optional: resolve a server definition to a launch object later
      resolveMcpServerDefinition: async (def: any) => {
        // Ensure the resolved definition includes a launch command pointing at
        // our start command so Configure Tools can start the built-in server.
        return {
          ...def,
          launch: {
            command: 'bundleVisualizer.startMcpServer'
          }
        };
      }
    };

    // register provider (API may not be present in older type definitions)
    // Check for the API first to avoid calling an undefined function (which
    // results in a TypeError in older VS Code versions).
    // @ts-ignore
    const regFn = (vscode as any).registerMcpServerDefinitionProvider;
    if (typeof regFn === 'function') {
      // @ts-ignore
      const disposable = regFn('vite-analyzer', mcpProvider);
      if (disposable) {
        context.subscriptions.push(disposable as vscode.Disposable);
      }
    } else {
      // API not available at runtime — skip registration silently.
      console.info('VS Code does not expose registerMcpServerDefinitionProvider; skipping runtime registration.');
    }
  } catch (err) {
    // No-op: if the API isn't available at runtime, this just won't register.
    console.warn('MCP server definition provider registration failed:', err);
  }

  const server = new McpServer({
    name: 'vite-analyzer-mcp',
    version: '1.0.0',
  });
    // created server instance (not started yet)


  // Register the analyze tool using the McpServer high-level API.
  // We intentionally do not start/connect a transport here; connecting to a transport
  // (HTTP/stdio) is the responsibility of the consumer. Registering the tool still
  // prepares it for when a transport is connected.
  server.registerTool(
    'analyzeBundle',
    {
      title: 'Analyze Bundle',
      description: 'Analyze Vite build output and summarize imports per file'
    },
    async (params: any) => {
      console.log('analyzeBundle tool invoked with params:', params);
      const folderPath = params?.folderPath as string | undefined;

      const summary = await analyzeBundle(folderPath || '');
      return {
        content: [{ type: 'text', text: JSON.stringify(summary) }],
        structuredContent: summary
      };
    }
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bundleVisualizer.show', () => {
      provider.show();
    }),
    vscode.commands.registerCommand('bundleVisualizer.startMcpServer', async () => {
      // Start an in-extension Streamable HTTP transport and connect it to the McpServer
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
          // let the transport handle the request (it will read the body if needed)
          transport!.handleRequest(req as any, res as any).catch((err: any) => {
            console.error('MCP transport handleRequest error:', err);
            try { res.writeHead?.(500); res.end?.('Internal Server Error'); } catch {}
          });
        });

        await new Promise<void>((resolve, reject) => {
          httpServer!.once('error', reject);
          httpServer!.listen(port, () => resolve());
        });

        // Connect the McpServer to the transport
        await server.connect(transport as any);

        transportPort = port;
        context.subscriptions.push({ dispose: async () => {
          try { await server.close(); } catch {};
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
    }),
    vscode.commands.registerCommand('bundleVisualizer.stopMcpServer', async () => {
      if (!httpServer && !transport) {
        vscode.window.showInformationMessage('MCP server is not running.');
        return;
      }
      try {
        await server.close();
      } catch (err) {
        console.warn('Error closing MCP server:', err);
      }
      try {
        await new Promise<void>((resolve, reject) => {
          if (!httpServer) {return resolve();}
          httpServer.close((err) => err ? reject(err) : resolve());
        });
      } catch (err) {
        console.warn('Error closing HTTP server:', err);
      }
      httpServer = undefined;
      transport = undefined;
      transportPort = undefined;
      vscode.window.showInformationMessage('MCP server stopped.');
    }),
    // Copy a JSON MCP server definition to the clipboard as a fallback for hosts
    // that don't support runtime provider registration. Users can paste this
    // into the Configure Tools UI or their settings to add the built-in server.
    vscode.commands.registerCommand('bundleVisualizer.copyMcpDefinition', async () => {
      try {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const port = config.get<number>('mcpPort') || 5215;

        const def = {
          id: 'bundle-visualizer-built-in',
          label: 'Bundle Visualizer (built-in)',
          host: 'localhost',
          port,
          // When Configure Tools or the user wants to start this server, it can
          // use this launch command which maps to the extension command.
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
    }),
    vscode.commands.registerCommand('bundleVisualizer.refresh', () => {
      provider.refresh();
    }),
    vscode.commands.registerCommand('bundleVisualizer.askCopilot', async (uri: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No file is currently open.');
        return;
      }

      const doc = editor.document;
      const filePath = doc.uri.fsPath;

      const question = `Explain the import chain for this file: ${filePath}. You also can use from /dist/stats.json the bundle structure to help you understand the context. Provide a concise explanation suitable for a developer familiar with JavaScript/TypeScript and bundlers.`;

      const codeSnippet = doc.getText().slice(0, 5000); // limit to 5k chars
      const prompt = `${question}\n\nHere is the file content (truncated):\n${codeSnippet}`;

      await vscode.env.clipboard.writeText(prompt);
      vscode.commands.executeCommand('workbench.action.chat.open');
      vscode.window.showInformationMessage(
        '📋 Copied your prompt. Paste it in Copilot Chat manually (API not public yet).'
      );
    })
  );

  // Auto-show the panel on activation
  provider.show();

  context.subscriptions.push({ dispose: () => { try { server.close?.(); } catch {} } });
}

export function deactivate() {}

class BundleVisualizerProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  public askAboutFile(uri: vscode.Uri) {
    vscode.commands.executeCommand('bundleVisualizer.askCopilot', uri);
  }

  public show() {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      this.panel.reveal(column);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bundleVisualizer',
      'Bundle Visualizer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist', 'assets')
        ]
      }
    );

    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'ready':
            this.refresh();
            this.sendTheme();
            break;
          case 'refresh':
            this.refresh();
            break;
          case 'startMcp':
            // Start the built-in MCP server via the existing command
            vscode.commands.executeCommand('bundleVisualizer.startMcpServer');
            break;
          case 'stopMcp':
            // Stop the built-in MCP server via the existing command
            vscode.commands.executeCommand('bundleVisualizer.stopMcpServer');
            break;
        }
      }
    );

    // Initial load
    this.refresh();
    this.sendTheme();
  }

  public async refresh() {
    if (!this.panel) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.panel.webview.postMessage({
        command: 'error',
        data: 'No workspace folder found'
      });
      return;
    }

    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const statsPath = config.get<string>('statsPath') || 'dist/stats.json';
    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, statsPath);

    try {
      const data = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder('utf-8').decode(data);
      const json = JSON.parse(text);

      this.panel.webview.postMessage({
        command: 'updateData',
        data: json
      });
    } catch (err: any) {
      this.panel.webview.postMessage({
        command: 'error',
        data: err.message
      });
    }
  }

  private sendTheme() {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      command: 'updateTheme',
      data: { kind: vscode.window.activeColorTheme.kind }
    });
  }

  private getHtmlForWebview(): string {
    const webview = this.panel!.webview;

    // Get paths to the built React app
    const scriptPathOnDisk = vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist', 'assets', 'index.js');
    const stylePathOnDisk = vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist', 'assets', 'index.css');

    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    const styleUri = webview.asWebviewUri(stylePathOnDisk);

    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Bundle Visualizer</title>
    </head>
    <body>
        <div id="root"></div>

        <div style="position:fixed;right:12px;top:12px;z-index:9999;display:flex;gap:8px;">
          <button id="bv-start">Start MCP</button>
          <button id="bv-stop">Stop MCP</button>
        </div>

        <script nonce="${nonce}">
          // Small helper to communicate with the extension host
          (function(){
            const start = document.getElementById('bv-start');
            const stop = document.getElementById('bv-stop');
            start?.addEventListener('click', () => {
              window.acquireVsCodeApi()?.postMessage({ command: 'startMcp' });
            });
            stop?.addEventListener('click', () => {
              window.acquireVsCodeApi()?.postMessage({ command: 'stopMcp' });
            });
          })();
        </script>

        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
