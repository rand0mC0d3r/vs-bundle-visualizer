# Development Guide

## Starting the UI React App Locally

To develop the React UI independently from VS Code:

### 1. Navigate to the UI folder
```bash
cd ui
```

### 2. Install dependencies (if not already done)
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```

This will:
- Start Vite dev server on `http://localhost:3000`
- Automatically open the browser
- Enable hot module replacement for instant updates
- Use mock VS Code API for development

### 4. Alternative development command
```bash
npm run dev:mock
```

## Mock Data

The UI uses mock data from `/ui/public/mock.json` when running in development mode.

### To use your own mock data:
1. Replace the content of `/ui/public/mock.json` with your bundle stats JSON
2. Restart the dev server if it's already running
3. Click "Refresh" in the UI to reload the mock data

### Mock data sources:
- **Webpack**: Generate with `webpack --json > stats.json`
- **Rollup**: Use `rollup-plugin-bundle-analyzer`
- **Vite**: Use `rollup-plugin-bundle-analyzer` in build config

## Development Features

When running locally, the UI includes:

- **DEV MODE indicator**: Orange badge in the header
- **Mock VS Code API**: Simulates extension communication
- **VS Code theme colors**: Applied automatically
- **Console logging**: Mock API calls are logged for debugging
- **Hot reload**: Changes update instantly

## File Structure for Development

```
ui/
├── public/
│   └── mock.json          # Mock bundle data (served by Vite)
├── src/
│   ├── App.tsx           # Main component with dev mode detection
│   ├── mockApi.ts        # Mock VS Code API implementation
│   ├── types.ts          # TypeScript interfaces
│   ├── index.css         # VS Code theme colors for dev
│   └── dev.css           # Development-specific styles
└── package.json          # Dev scripts
```

## Development vs Production

### Development Mode
- Detects absence of `window.acquireVsCodeApi`
- Uses mock VS Code API
- Loads mock data from `/mock.json`
- Shows DEV MODE indicator
- Console logs API interactions

### Production Mode (in VS Code)
- Uses real VS Code webview API
- Receives data from extension
- No dev indicator
- Real theme updates from VS Code

## Troubleshooting

### Mock data not loading
- Ensure `mock.json` is in `/ui/public/` directory
- Check browser console for fetch errors
- Verify JSON is valid

### Styles not matching VS Code
- Theme colors are defined in `index.css`
- Theme switching is handled by the `theme.kind` value
- Light theme: `kind: 1`, Dark theme: `kind: 2`

### Hot reload not working
- Restart Vite dev server: `npm run dev`
- Check terminal for any TypeScript errors
- Clear browser cache if needed
