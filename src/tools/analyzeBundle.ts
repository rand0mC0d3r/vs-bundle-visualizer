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
      children: filterOptions?.showChildren ? node.children : undefined,
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
    title: 'Analyze Bundle Statistics',
    description: `Analyzes JavaScript/TypeScript bundle composition from Rollup/Webpack stats files.

Returns a comprehensive breakdown of your bundle including:
- Total number of files and their combined size
- Hierarchical folder structure with sizes
- Individual file details with accurate size metrics

This tool reads from the configured stats file (bundleVisualizer.statsPath setting, default: dist/stats.json).

Optional filter parameters:
- sortCriteria: How to sort results - 'filename' (alphabetical), 'fileCount' (number of files), or 'fileSize' (total size). Default: 'filename'
- sortDirection: Sort order - 'asc' (ascending) or 'desc' (descending). Default: 'asc'
- hiddenRootFolders: Array of root folder names to exclude from results (e.g., ['node_modules/.vite'])
- libraryFilters: Array of library/folder names to focus on (returns only matching items)
- showChildren: Whether to include child items in the results

NOTE: showChildren is returning the 'children' property for each file/folder in the results. This can be useful for detailed analysis of bundle structure. But it's optional and can be omitted to reduce output size.

Common use cases:
- No filters: Get complete bundle overview
- Sort by fileSize desc: Find the largest contributors
- Filter by specific libraries: Analyze particular dependencies
- Hide folders: Remove noise from development artifacts
- Show children: Include child items in the results for detailed analysis

Example: To find the 10 largest items, use sortCriteria='fileSize' and sortDirection='desc'`,
    type: 'object',
    properties: {
      showChildren: {
        type: 'boolean',
        description: 'Whether to include child items in the results',
        default: true
      },
      sortCriteria: {
        type: 'string',
        enum: ['filename', 'fileCount', 'fileSize'],
        description: 'How to sort the results',
        default: 'filename'
      },
      sortDirection: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction',
        default: 'asc'
      },
      hiddenRootFolders: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of root folder names to exclude from results',
        default: []
      },
      libraryFilters: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of library/folder names to filter by (only include matching items)',
        default: []
      }
    }
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
