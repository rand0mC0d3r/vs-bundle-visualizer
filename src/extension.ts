import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

async function analyzeBundle(folderPath: string) {
  const summary: Record<string, any> = {};

  return summary;
}

export async function activate(context: vscode.ExtensionContext) {
  const provider = new BundleVisualizerProvider(context.extensionUri);

  // Register an MCP server definition provider so VS Code's "Configure Tools" UI
  // can discover this extension as a built-in MCP server provider. The provider
  // returns a minimal server definition (label) so it appears in the list. We
  // use a safe any-cast because the API surface may not be present in older
  // @types/vscode packages in this workspace.
  try {
    const mcpProvider = {
      provideMcpServerDefinitions: async () => {
        return [
          {
            label: 'Vite Analyzer (built-in)'
            // additional fields (e.g. version, launch) can be added here
          }
        ];
      },
      // Optional: resolve a server definition to a launch object later
      resolveMcpServerDefinition: async (def: any) => {
        // Not implementing automatic launch here. Returning the same def is fine
        // for display purposes. If you want to support launching from VS Code's
        // UI, return a resolved launch descriptor here.
        return def;
      }
    };

    // register provider (API may not be present in older type definitions)
    // @ts-ignore
    const disposable = (vscode as any).registerMcpServerDefinitionProvider('vite-analyzer', mcpProvider);
    if (disposable) {
      context.subscriptions.push(disposable as vscode.Disposable);
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

  const analyzeBundleTool = {
    name: 'analyzeBundle',
    description: 'Analyze Vite build output and summarize imports per file',
    parameters: {
      type: 'object',
      properties: {
        folderPath: { type: 'string' },
      },
      required: ['folderPath'],
    },
    async execute({ folderPath }: { folderPath: string }) {
      return await analyzeBundle(folderPath);
    },
  };

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
