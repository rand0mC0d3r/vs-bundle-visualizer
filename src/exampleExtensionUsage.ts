// Example: How to use bundleFilterUtils in extension.ts
// This file demonstrates usage patterns - you can integrate these into your actual extension.ts

import * as vscode from 'vscode';
import { BundleData, FilterOptions, processAndFilterNodes } from './bundleFilterUtils';
import { PACKAGE_NAME } from './constants';

/**
 * Read bundle data from the configured stats file
 */
async function readBundleDataFromFile(): Promise<BundleData> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
  const statsPath = config.get<string>('statsPath') || 'dist/stats.json';
  const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, statsPath);

  try {
    const data = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder('utf-8').decode(data);
    const json = JSON.parse(text);
    return json as BundleData;
  } catch (err: any) {
    throw new Error(`Failed to read bundle stats file from ${statsPath}: ${err.message}`);
  }
}

/**
 * Example command that processes bundle data with custom filters
 */
export function registerBundleAnalysisCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'bundleVisualizer.analyzeWithFilters',
    async () => {
      try {
        // Read bundle data from configured file
        const bundleData = await readBundleDataFromFile();

        // Create filter options based on user preferences or configuration
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const filterOptions: FilterOptions = {
          sortCriteria: config.get('defaultSortCriteria') || 'fileSize',
          sortDirection: config.get('defaultSortDirection') || 'desc',
          hiddenRootFolders: config.get('hiddenFolders') || [],
          libraryFilters: config.get('libraryFilters') || []
        };

        // Process and filter the data
        const processedNodes = processAndFilterNodes(bundleData, filterOptions);

        // Display results in output channel or quick pick
        const channel = vscode.window.createOutputChannel('Bundle Analysis');
        channel.clear();
        channel.appendLine(`Total files: ${processedNodes.length}`);
        channel.appendLine(`Total size: ${formatBytes(
          processedNodes.reduce((sum, n) => sum + n.totalSize, 0)
        )}`);
        channel.appendLine('\nTop 10 largest files:');

        processedNodes
          .slice(0, 10)
          .forEach((node, i) => {
            channel.appendLine(
              `${i + 1}. ${node.name} - ${formatBytes(node.totalSize)} (${node.counts.files} files)`
            );
          });

        channel.show();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Bundle analysis failed: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}/**
 * Example: Export filtered data to JSON file
 */
export async function exportFilteredBundleData(
  filterOptions: FilterOptions,
  outputPath: string
) {
  // Read bundle data from configured file
  const bundleData = await readBundleDataFromFile();

  const processedNodes = processAndFilterNodes(bundleData, filterOptions);

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      filters: filterOptions,
      totalFiles: processedNodes.length,
      totalSize: processedNodes.reduce((sum, n) => sum + n.totalSize, 0)
    },
    files: processedNodes.map(node => ({
      name: node.name,
      folder: node.folder,
      fileName: node.fileName,
      size: node.totalSize,
      fileCount: node.counts.files,
      folderCount: node.counts.folders
    }))
  };

  const fs = require('fs').promises;
  await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
}

/**
 * Example: Get bundle statistics grouped by folder
 */
export async function getBundleStatsByFolder(
  filterOptions?: FilterOptions
) {
  // Read bundle data from configured file
  const bundleData = await readBundleDataFromFile();

  const processedNodes = processAndFilterNodes(bundleData, filterOptions || {});

  const statsByFolder = processedNodes.reduce((acc, node) => {
    const folder = node.folder;
    if (!acc[folder]) {
      acc[folder] = {
        count: 0,
        totalSize: 0,
        files: []
      };
    }

    acc[folder].count++;
    acc[folder].totalSize += node.totalSize;
    acc[folder].files.push(node.name);

    return acc;
  }, {} as Record<string, { count: number; totalSize: number; files: string[] }>);

  return statsByFolder;
}

/**
 * Example: Find largest dependencies
 */
export async function findLargestDependencies(
  limit: number = 10
): Promise<Array<{ name: string; size: number; fileCount: number }>> {
  // Read bundle data from configured file
  const bundleData = await readBundleDataFromFile();

  const processedNodes = processAndFilterNodes(bundleData, {
    sortCriteria: 'fileSize',
    sortDirection: 'desc'
  });

  return processedNodes.slice(0, limit).map(node => ({
    name: node.name,
    size: node.totalSize,
    fileCount: node.counts.files
  }));
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
