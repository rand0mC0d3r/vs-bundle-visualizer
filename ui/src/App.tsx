import { useEffect, useState } from 'react';
import './App.css';
import { BundleData, VSCodeAPI, VSCodeMessage, VSCodeTheme } from './types';

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

function App() {
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [theme, setTheme] = useState<VSCodeTheme>({ kind: 2 });
  const [error, setError] = useState<string | null>(null);
  const [vscodeApi] = useState(() => window.acquireVsCodeApi());

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

  const formatValue = (val: any): string => {
    if (Array.isArray(val)) {
      return `[${val.length} items]`;
    }
    if (typeof val === 'object' && val !== null) {
      return '{...}';
    }
    return String(val);
  };

  const renderValue = (key: string, value: any, level: number = 0): JSX.Element => {
    const indent = '  '.repeat(level);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={key} className="object-container">
          <div className="object-key">{indent}{key}:</div>
          <div className="object-value">
            {Object.entries(value).map(([k, v]) => renderValue(k, v, level + 1))}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="data-item">
        <span className="data-key">{indent}{key}:</span>
        <span className="data-value">{formatValue(value)}</span>
      </div>
    );
  };

  return (
    <div className={`app theme-${theme.kind === 1 ? 'light' : 'dark'}`}>
      <div className="header">
        <h1>Bundle Visualizer</h1>
        <button
          className="refresh-button"
          onClick={() => vscodeApi.postMessage({ command: 'refresh' })}
        >
          Refresh
        </button>
      </div>

      <div className="content">
        {error ? (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        ) : bundleData ? (
          <div className="data-container">
            {Object.entries(bundleData).map(([key, value]) =>
              renderValue(key, value)
            )}
          </div>
        ) : (
          <div className="loading">Loading bundle data...</div>
        )}
      </div>
    </div>
  );
}

export default App;
