import * as vscode from 'vscode';
import { BundleDataWatcher } from './bundleDataWatcher';
import { setupMcp } from './mcp';
import { BundleVisualizerProvider } from './webview';

export async function activate(context: vscode.ExtensionContext) {
  // Create the bundle data watcher
  const watcher = new BundleDataWatcher();
  watcher.start(context);

  // Create provider and MCP with the watcher
  const provider = new BundleVisualizerProvider(context.extensionUri, watcher);
  const mcp = await setupMcp(context, watcher);

  // Wire up MCP status to provider
  provider.setMcpStatusGetter(mcp.getStatus);
  mcp.onStatusChange((status) => {
    provider.sendMcpStatus();
  });

  context.subscriptions.push(
    ...mcp.disposables,
    vscode.commands.registerCommand('bundleVisualizer.startMcpServer', () => mcp.startMcpServer()),
    vscode.commands.registerCommand('bundleVisualizer.stopMcpServer', () => mcp.stopMcpServer()),
    vscode.commands.registerCommand('bundleVisualizer.copyMcpDefinition', () => mcp.copyMcpDefinition()),
    vscode.commands.registerCommand('bundleVisualizer.show', () => provider.show()),
    vscode.commands.registerCommand('bundleVisualizer.refresh', () => provider.refresh()),
    { dispose: () => watcher.dispose() },
    { dispose: () => provider.dispose() },
  );

  provider.show();
}

export function deactivate() {}
