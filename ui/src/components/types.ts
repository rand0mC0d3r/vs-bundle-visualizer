export interface FolderNode {
  name: string;
  path: string;
  originalPath?: string; // Preserves the original path before folder collapsing
  children: FolderNode[];
  files: Array<{ name: string; size: number; fullPath: string; originalPath?: string }>;
  totalSize: number;
}

export interface AppState {
  bundleData: any | null;
  theme: { kind: number };
  error: string | null;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  expandedFolders: Set<string>;
  selectedFolder: string | null;
  showSidePanel: boolean;
  showTreemapPanel: boolean;
  sortCriteria: 'filename' | 'fileCount' | 'fileSize';
  sortDirection: 'asc' | 'desc';
  hiddenRootFolders: Set<string>;
  hideZeroByteFiles: boolean;
}

export type SortCriteria = 'filename' | 'fileCount' | 'fileSize';
export type SortDirection = 'asc' | 'desc';
