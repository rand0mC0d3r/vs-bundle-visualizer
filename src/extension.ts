import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

import { setupMcp } from './mcp';

export async function activate(context: vscode.ExtensionContext) {
  const provider = new BundleVisualizerProvider(context.extensionUri);

  const mcpDisposables = setupMcp(context);
  mcpDisposables.forEach(d => context.subscriptions.push(d));

  context.subscriptions.push(
    vscode.commands.registerCommand('bundleVisualizer.show', () => {
      provider.show();
    }),
    vscode.commands.registerCommand('bundleVisualizer.refresh', () => {
      provider.refresh();
    }),
  );

  provider.show();
}

export function deactivate() {}

class BundleVisualizerProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
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
