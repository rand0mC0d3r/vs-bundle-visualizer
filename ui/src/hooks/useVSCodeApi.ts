import { useEffect, useState } from 'react';
import { createMockVSCodeApi, isDevelopmentMode } from '../mockApi';
import { BundleData, McpServerStatus, VSCodeAPI, VSCodeMessage, VSCodeTheme } from '../types';

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

export const useVSCodeApi = () => {
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [theme, setTheme] = useState<VSCodeTheme>({ kind: 2 });
  const [error, setError] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus>({ isRunning: false });

  const [vscodeApi] = useState(() => {
    // Use mock API in development mode, real API in VS Code
    if (isDevelopmentMode()) {
      console.log('Running in development mode - using mock VS Code API');
      return createMockVSCodeApi();
    }
    return window.acquireVsCodeApi();
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: VSCodeMessage = event.data;

      switch (message.command) {
        case 'updateData':
          setBundleData(message.data);
          setError(null);
          break;
        case 'updateTheme':
          setTheme(message.data);
          break;
        case 'updateMcpStatus':
          setMcpStatus(message.data);
          break;
        case 'error':
          setError(message.data);
          setBundleData(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial data
    vscodeApi.postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscodeApi]);

  return {
    bundleData,
    theme,
    error,
    mcpStatus,
    vscodeApi
  };
};
