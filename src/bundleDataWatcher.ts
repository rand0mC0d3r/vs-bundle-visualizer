import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

export class BundleDataWatcher {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private listeners: Array<() => void> = [];

  constructor() {}

  public start(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const statsPath = config.get<string>('statsPath') || 'dist/stats.json';

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      return;
    }

    // Create a file watcher for the stats file
    const pattern = new vscode.RelativePattern(workspaceFolders[0], statsPath);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Watch for changes
    this.fileWatcher.onDidChange(() => {
      console.log('Bundle stats file changed, notifying listeners...');
      this.notifyListeners();
    });

    this.fileWatcher.onDidCreate(() => {
      console.log('Bundle stats file created, notifying listeners...');
      this.notifyListeners();
    });

    context.subscriptions.push(this.fileWatcher);

    // Also watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(`${PACKAGE_NAME}.statsPath`)) {
          // Restart the watcher with the new path
          this.dispose();
          this.start(context);
          this.notifyListeners();
        }
      })
    );
  }

  public onChange(callback: () => void) {
    this.listeners.push(callback);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Error in bundle data watcher listener:', err);
      }
    });
  }

  public dispose() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
    this.listeners = [];
  }
}
