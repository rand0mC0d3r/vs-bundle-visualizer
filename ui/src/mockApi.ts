import { BundleData, VSCodeAPI, VSCodeMessage } from './types';

// Mock bundle data for testing
let mockBundleData: BundleData | null = null;

// Load mock data from mock.json
async function loadMockData(): Promise<BundleData> {
  try {
    const response = await fetch('/mock.json');
    if (!response.ok) {
      throw new Error(`Failed to load mock data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading mock data:', error);
    // Fallback mock data
    return {
      version: "5.88.2",
      hash: "abc123def456",
      time: 2847,
      assets: [
        {
          name: "js/main.12345.js",
          size: 245678,
          chunks: [0],
          chunkNames: ["main"],
          emitted: true
        },
        {
          name: "css/main.67890.css",
          size: 45123,
          chunks: [0],
          chunkNames: ["main"],
          emitted: true
        }
      ],
      chunks: [
        {
          id: 0,
          rendered: true,
          initial: true,
          entry: true,
          size: 290801,
          names: ["main"],
          files: ["js/main.12345.js", "css/main.67890.css"]
        }
      ],
      modules: []
    };
  }
}

// Mock VS Code API for development
export function createMockVSCodeApi(): VSCodeAPI {
  return {
    postMessage: (message: VSCodeMessage) => {
      console.log('Mock VSCode API - Sending message:', message);

      // Simulate responses
      setTimeout(() => {
        switch (message.command) {
          case 'ready':
            // Send initial data and theme
            window.dispatchEvent(new MessageEvent('message', {
              data: {
                command: 'updateTheme',
                data: { kind: 2 } // Dark theme
              }
            }));

            loadMockData().then(data => {
              mockBundleData = data;
              window.dispatchEvent(new MessageEvent('message', {
                data: {
                  command: 'updateData',
                  data: mockBundleData
                }
              }));
            }).catch(error => {
              window.dispatchEvent(new MessageEvent('message', {
                data: {
                  command: 'error',
                  data: error.message
                }
              }));
            });
            break;

          case 'refresh':
            // Reload mock data
            loadMockData().then(data => {
              mockBundleData = data;
              window.dispatchEvent(new MessageEvent('message', {
                data: {
                  command: 'updateData',
                  data: mockBundleData
                }
              }));
            });
            break;
        }
      }, 100); // Small delay to simulate async behavior
    },

    getState: () => {
      return { mockBundleData };
    },

    setState: (state: any) => {
      console.log('Mock VSCode API - Setting state:', state);
    }
  };
}

// Check if we're running in development mode (not in VS Code)
export function isDevelopmentMode(): boolean {
  return !window.acquireVsCodeApi || process.env.NODE_ENV === 'development';
}
