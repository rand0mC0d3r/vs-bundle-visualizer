import * as vscode from 'vscode';
import { setupMcp } from './mcp';
import { BundleVisualizerProvider } from './webview';

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
