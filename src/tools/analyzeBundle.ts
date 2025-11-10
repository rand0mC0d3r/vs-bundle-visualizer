import * as vscode from 'vscode';
import { BundleData, FilterOptions, processAndFilterNodes } from '../bundleFilterUtils';
import { PACKAGE_NAME } from '../constants';

/**
 * Read and parse the bundle stats JSON file from the workspace
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

async function analyzeBundle(filterOptions?: FilterOptions) {
  // Read bundle data from file
  const bundleData = await readBundleDataFromFile();

  // Process and filter the bundle data using the shared utility
  const processedNodes = processAndFilterNodes(bundleData, filterOptions);

  const summary: Record<string, any> = {
    totalFiles: processedNodes.length,
    totalSize: processedNodes.reduce((sum, node) => sum + node.totalSize, 0),
    files: processedNodes.map(node => ({
      name: node.name,
      children: node.children,
      folder: node.folder,
      fileName: node.fileName,
      size: node.totalSize,
      fileCount: node.counts.files,
      folderCount: node.counts.folders
    }))
  };

  return summary;
}

export const analyzeBundleTool = {
  name: 'analyzeBundle',
  schema: {
    title: 'Analyze Bundle',
    description: 'Analyze Vite build output from the configured stats file (bundleVisualizer.statsPath). Optional filter parameters: sortCriteria (filename|fileCount|fileSize), sortDirection (asc|desc), hiddenRootFolders (array), libraryFilters (array).'
  },
  handler: async (params: any) => {
    const filterOptions: FilterOptions = {
      sortCriteria: params?.sortCriteria || 'filename',
      sortDirection: params?.sortDirection || 'asc',
      hiddenRootFolders: params?.hiddenRootFolders || [],
      libraryFilters: params?.libraryFilters || []
    };

    try {
      const summary = await analyzeBundle(filterOptions);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }
};
