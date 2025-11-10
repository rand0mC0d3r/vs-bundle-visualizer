# Bundle Filter Utils - Usage Guide

This document explains how the bundle filtering logic has been refactored to be DRY (Don't Repeat Yourself) and usable in both React components and Node.js extension code.

## Architecture

The filtering logic has been extracted into pure functions that don't depend on React or browser-specific APIs:

### Files Created/Modified

1. **`ui/src/utils/bundleFilterUtils.ts`** - React version (uses Set for hiddenRootFolders)
2. **`src/bundleFilterUtils.ts`** - Node.js version (uses array for hiddenRootFolders)
3. **`ui/src/hooks/useFilteredNodes.ts`** - Simplified to use the utility
4. **`src/mcp.ts`** - Updated to use the filtering logic

## Usage Examples

### In React Components (UI)

```typescript
import { useFilteredNodes } from '../hooks/useFilteredNodes';

function MyComponent() {
  const { filesToRender } = useFilteredNodes(
    bundleData,
    hiddenRootFolders,  // Set<string>
    sortCriteria,       // 'filename' | 'fileCount' | 'fileSize'
    sortDirection,      // 'asc' | 'desc'
    libraryFilters      // string[]
  );

  // Use filesToRender...
}
```

### Direct Usage in React (without hook)

```typescript
import { processAndFilterNodes } from '../utils/bundleFilterUtils';

const result = processAndFilterNodes(bundleData, {
  hiddenRootFolders: new Set(['vendor']),
  sortCriteria: 'fileSize',
  sortDirection: 'desc',
  libraryFilters: ['react', 'vue']
});
```

### In Node.js Extension (MCP Server)

The MCP server automatically reads bundle data from the configured file path (`bundleVisualizer.statsPath`):

```typescript
import { processAndFilterNodes, FilterOptions } from './bundleFilterUtils';

// Read bundle data from configured file
async function readBundleDataFromFile(): Promise<BundleData> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  const config = vscode.workspace.getConfiguration('bundleVisualizer');
  const statsPath = config.get<string>('statsPath') || 'dist/stats.json';
  const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, statsPath);

  const data = await vscode.workspace.fs.readFile(fileUri);
  const text = new TextDecoder('utf-8').decode(data);
  return JSON.parse(text) as BundleData;
}

async function analyzeBundle(filterOptions?: FilterOptions) {
  // Read bundle data from file
  const bundleData = await readBundleDataFromFile();

  // Process and filter the bundle data
  const processedNodes = processAndFilterNodes(bundleData, filterOptions);

  return {
    totalFiles: processedNodes.length,
    totalSize: processedNodes.reduce((sum, node) => sum + node.totalSize, 0),
    files: processedNodes.map(node => ({
      name: node.name,
      folder: node.folder,
      fileName: node.fileName,
      size: node.totalSize,
      fileCount: node.counts.files,
      folderCount: node.counts.folders
    }))
  };
}
```

### In MCP Tool

The MCP tool reads from the configured stats file path (no need to pass bundleData):

```typescript
server.registerTool(
  'analyzeBundle',
  {
    title: 'Analyze Bundle',
    description: 'Analyze bundle from configured stats file with optional filters'
  },
  async (params: any) => {
    const filterOptions: FilterOptions = {
      sortCriteria: params?.sortCriteria || 'filename',
      sortDirection: params?.sortDirection || 'asc',
      hiddenRootFolders: params?.hiddenRootFolders || [],
      libraryFilters: params?.libraryFilters || []
    };

    try {
      const summary = await analyzeBundle(filterOptions);
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }
);
```

### Configuration

Set the path to your bundle stats file in VS Code settings:

```json
{
  "bundleVisualizer.statsPath": "dist/stats.json"
}
```

## Available Functions

### Core Processing

- **`processAndFilterNodes(bundleData, options)`** - Main function that processes and filters bundle data
  - Returns: `ProcessedNode[]` with folder, fileName, size, counts, etc.

### Utility Functions

- **`buildDependencyMap(bundleData)`** - Build map of dependencies between bundles
- **`getNodeSize(node, bundleData)`** - Get size of a node
- **`countFiles(node)`** - Count files and folders in a node
- **`sortNodes(nodes, criteria, direction, bundleData)`** - Sort nodes
- **`isRootFolderVisible(folderName, hiddenFolders)`** - Check visibility
- **`filterNodeByLibraries(node, filters, dependencyMap)`** - Filter by libraries

## FilterOptions Interface

```typescript
interface FilterOptions {
  hiddenRootFolders?: string[];      // Folders to hide
  sortCriteria?: SortCriteria;       // 'filename' | 'fileCount' | 'fileSize'
  sortDirection?: SortDirection;     // 'asc' | 'desc'
  libraryFilters?: string[];         // Filter by library names
}
```

## Benefits of This Refactoring

1. **DRY Principle** - Logic is defined once, used everywhere
2. **Type Safety** - Shared TypeScript types across React and Node.js
3. **Testability** - Pure functions are easy to unit test
4. **Consistency** - Same filtering behavior in UI and MCP server
5. **Maintainability** - Update logic in one place, affects all consumers
