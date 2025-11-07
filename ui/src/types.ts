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

export interface VSCodeMessage {
  command: string;
  data?: any;
}

export interface VSCodeAPI {
  postMessage(message: VSCodeMessage): void;
  getState(): any;
  setState(state: any): void;
}
