import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

export async function activate(context: vscode.ExtensionContext) {
  const provider = new StatsTreeProvider();
  vscode.window.registerTreeDataProvider('statsViewer', provider);

  context.subscriptions.push(
    vscode.commands.registerCommand('statsViewer.refresh', () => provider.refresh())
  );

  // auto-load once on activation
  provider.refresh();
}

export function deactivate() {}

class StatsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private items: vscode.TreeItem[] = [];

  async refresh() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {return;}

    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const statsPath = config.get<string>('statsPath') || 'dist/stats.json';
    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, statsPath);

    try {
      const data = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder('utf-8').decode(data);
      const json = JSON.parse(text);

      this.items = Object.entries(json).map(([key, value]) => {
        const item = new vscode.TreeItem(`${key}: ${formatValue(value)}`);
        item.tooltip = JSON.stringify(value, null, 2);
        return item;
      });
    } catch (err: any) {
      this.items = [new vscode.TreeItem(`Error: ${err.message}`)];
    }

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return this.items;
  }
}

function formatValue(val: any): string {
  if (Array.isArray(val)) {return `[${val.length}]`;}
  if (typeof val === 'object' && val !== null) {return '{…}';}
  return String(val);
}
