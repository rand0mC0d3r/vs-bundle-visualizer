# Bundle Visualizer for VS Code

A VS Code extension that visualizes bundle statistics for Webpack, Rollup, and Vite in an interactive React-based panel.

## Features

- 🎯 **Interactive Panel**: View bundle stats in a dedicated webview panel with React UI
- 🎨 **VS Code Theme Integration**: UI automatically adapts to your VS Code theme (light/dark/high contrast)
- 📊 **Bundle Analysis**: Visualize chunks, modules, assets, and dependencies
- 🔄 **Real-time Updates**: Refresh data with a click or command
- ⚡ **Fast**: Built with Vite for optimal performance

## Usage

1. Generate a bundle stats JSON file with your bundler:
   - **Webpack**: `webpack --json > stats.json` or use `webpack-bundle-analyzer`
   - **Rollup**: Use `rollup-plugin-bundle-analyzer`
   - **Vite**: Use `rollup-plugin-bundle-analyzer` in build config

2. Place the stats file in your workspace (default: `dist/stats.json`)

3. Run the command `Bundle Visualizer: Show Panel` or the extension will auto-open on activation

## Configuration

Configure the stats file location in VS Code settings:

```json
{
  "bundleVisualizer.statsPath": "dist/stats.json"
}
```

## Commands

- `Bundle Visualizer: Show Panel` - Open the visualizer panel
- `Bundle Visualizer: Refresh Data` - Refresh the bundle data

## Development

### Extension Development

```bash
npm install
npm run compile
```

### UI Development

The UI is a separate React app in the `ui/` folder:

```bash
cd ui
npm install
npm run dev
```

### Building

```bash
npm run package  # Builds both extension and UI
```

## Architecture

- **Extension**: TypeScript extension that provides webview panel
- **UI**: React + Vite frontend with TypeScript
- **Communication**: VS Code webview message API
- **Theming**: CSS custom properties from VS Code

## License

MIT
