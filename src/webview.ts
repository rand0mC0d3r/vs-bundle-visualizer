import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { BundleDataWatcher } from './bundleDataWatcher';
import { PACKAGE_NAME } from './constants';
import { McpServerStatus } from './mcp';

export class BundleVisualizerProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private watcherDisposable: vscode.Disposable | undefined;
  private mcpStatusGetter?: () => McpServerStatus;

  constructor(extensionUri: vscode.Uri, private watcher?: BundleDataWatcher) {
    this.extensionUri = extensionUri;

    // Listen for file changes if watcher is provided
    if (this.watcher) {
      this.watcherDisposable = this.watcher.onChange(() => {
        this.refresh();
      });
    }
  }

  public setMcpStatusGetter(getter: () => McpServerStatus) {
    this.mcpStatusGetter = getter;
  }

  public sendMcpStatus() {
    if (!this.panel || !this.mcpStatusGetter) {
      return;
    }

    const status = this.mcpStatusGetter();
    this.panel.webview.postMessage({
      command: 'updateMcpStatus',
      data: status
    });
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
            this.sendMcpStatus();
            break;
          case 'refresh':
            this.refresh();
            break;
          case 'requestMcpStatus':
            this.sendMcpStatus();
            break;
          case 'startMcp':
            vscode.commands.executeCommand('bundleVisualizer.startMcpServer');
            break;
          case 'stopMcp':
            vscode.commands.executeCommand('bundleVisualizer.stopMcpServer');
            break;
        }
      }
    );

    // Initial load
    this.refresh();
    this.sendTheme();
    this.sendMcpStatus();
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

  public dispose() {
    if (this.watcherDisposable) {
      this.watcherDisposable.dispose();
      this.watcherDisposable = undefined;
    }
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
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
