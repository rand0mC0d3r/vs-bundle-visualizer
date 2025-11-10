export interface BundleData {
  [key: string]: any;
  tree?: {
    children?: TreeNode[];
  };
  nodeParts?: {
    [uid: string]: {
      renderedLength: number;
      gzipLength?: number;
      brotliLength?: number;
      metaUid?: string;
    };
  };
  nodeMetas?: {
    [uid: string]: {
      id: string;
      moduleParts?: {
        [bundleName: string]: string;
      };
      imported?: Array<{ uid: string }>;
      importedBy?: Array<{ uid: string }>;
    };
  };
}

export interface TreeNode {
  name: string;
  id?: string;
  uid?: string;
  value?: number;
  children?: TreeNode[];
}

export interface VSCodeTheme {
  kind: number; // 1 = light, 2 = dark, 3 = high contrast
}

export interface McpServerStatus {
  isRunning: boolean;
  port?: number;
}

export interface VSCodeMessage {
  command: string;
  data?: any;
  filePath?: string;
}

export interface VSCodeAPI {
  postMessage(message: VSCodeMessage): void;
  getState(): any;
  setState(state: any): void;
}
