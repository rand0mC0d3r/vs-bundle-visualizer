import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

import { setupMcp } from './mcp';

async function analyzeBundle(folderPath: string) {
  const summary: Record<string, any> = {};

  return summary;
}

export async function activate(context: vscode.ExtensionContext) {
  const provider = new BundleVisualizerProvider(context.extensionUri);

  // Setup MCP server, tools and commands in a separate module to keep this file small.
  const mcpDisposables = setupMcp(context, analyzeBundle);
  mcpDisposables.forEach(d => context.subscriptions.push(d));

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

  // Note: MCP cleanup is handled inside `setupMcp` and its returned disposables.
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
