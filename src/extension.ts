import * as vscode from 'vscode';
import { setupMcp } from './mcp';
import { BundleVisualizerProvider } from './webview';

export async function activate(context: vscode.ExtensionContext) {
  const provider = new BundleVisualizerProvider(context.extensionUri);
  const mcp = await setupMcp(context);

  context.subscriptions.push(
    ...mcp.disposables,
    vscode.commands.registerCommand('bundleVisualizer.startMcpServer', () => mcp.startMcpServer()),
    vscode.commands.registerCommand('bundleVisualizer.stopMcpServer', () => mcp.stopMcpServer()),
    vscode.commands.registerCommand('bundleVisualizer.copyMcpDefinition', () => mcp.copyMcpDefinition()),
    vscode.commands.registerCommand('bundleVisualizer.show', () => provider.show()),
    vscode.commands.registerCommand('bundleVisualizer.refresh', () => provider.refresh()),
  );

  provider.show();
}

export function deactivate() {}
