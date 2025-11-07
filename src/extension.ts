import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from './constants';

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration(PACKAGE_NAME);

  // 🧭 Get workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri;
  const statsPath = config.get<string>('statsPath') || 'dist/stats.json';

  const fileUri = vscode.Uri.joinPath(workspaceRoot, statsPath);

  try {
    const data = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder('utf-8').decode(data);
    const json = JSON.parse(text);

    vscode.window.showInformationMessage(`✅ Loaded ${statsPath} (${Object.keys(json).length} keys)`);
    console.log('📊 stats.json:', json);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to read ${statsPath}: ${err.message}`);
  }
}

export function deactivate() {}
