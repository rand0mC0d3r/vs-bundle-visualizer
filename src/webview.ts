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

  public async show() {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      this.panel.reveal(column);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bundleVisualizer',
      '🔍 Bundle Visualizer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist', 'assets'),
          vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist', 'vendor')
        ]
      }
    );

  this.panel.webview.html = await this.getHtmlForWebview();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      async message => {
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
          case 'openFile':
            await this.openFile(message.filePath);
            break;
        }
      }
    );

    // Initial load
    this.refresh();
    this.sendTheme();
    this.sendMcpStatus();
  }

  private async openFile(filePath: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    try {
      const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
    }
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

  private async getHtmlForWebview(): Promise<string> {
    const webview = this.panel!.webview;

    const nonce = getNonce();

    // Helper: recursively read files under ui/dist and return relative paths
    async function readDirRecursive(root: vscode.Uri, relPath = ''): Promise<string[]> {
      const dirUri = relPath ? vscode.Uri.joinPath(root, ...relPath.split('/')) : root;
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
      } catch (e) {
        return [];
      }

      const results: string[] = [];
      for (const [name, type] of entries) {
        const childRel = relPath ? `${relPath}/${name}` : name;
        if (type === vscode.FileType.Directory) {
          const nested = await readDirRecursive(root, childRel);
          results.push(...nested);
        } else if (type === vscode.FileType.File) {
          results.push(childRel);
        }
      }
      return results;
    }

    // Collect .css and .js files from ui/dist
    const distRoot = vscode.Uri.joinPath(this.extensionUri, 'ui', 'dist');
    let relativeFiles: string[] = [];
    try {
      relativeFiles = await readDirRecursive(distRoot);
    } catch (e) {
      relativeFiles = [];
    }

    const cssFiles = relativeFiles.filter(p => p.endsWith('.css'));
    const jsFiles = relativeFiles.filter(p => p.endsWith('.js'));

    // Convert to webview URIs
    const cssLinks = cssFiles.map(p => {
      const fileUri = vscode.Uri.joinPath(distRoot, ...p.split('/'));
      return webview.asWebviewUri(fileUri).toString();
    });
    const jsLinks = jsFiles.map(p => {
      const fileUri = vscode.Uri.joinPath(distRoot, ...p.split('/'));
      return webview.asWebviewUri(fileUri).toString();
    });

    // Build HTML: include all CSS <link>s, then the root div, then all JS <script>s with nonce
    const cssTags = cssLinks.map(href => `<link href="${href}" rel="stylesheet">`).join('\n        ');
    const scriptTags = jsLinks.map(src => `<script nonce="${nonce}" src="${src}"></script>`).join('\n        ');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        ${cssTags}
        <title>🔍 Bundle Visualizer</title>
    </head>
    <body>
        <div id="root"></div>
        ${scriptTags}
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
