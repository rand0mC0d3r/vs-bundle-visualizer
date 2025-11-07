# Bundle Visualizer UI

This is the React frontend for the VS Code Bundle Visualizer extension.

## Development

To work on the UI:

```bash
cd ui
npm install
npm run dev
```

## Building

The UI is automatically built as part of the extension build process via the `build:ui` script in the main package.json.

To build manually:

```bash
cd ui
npm run build
```

## Architecture

- **React**: Frontend framework
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **CSS**: VS Code themed styling using CSS custom properties

## Communication with Extension

The UI communicates with the VS Code extension via the `webview` message API:

### Messages from Extension to UI:
- `updateData`: Bundle statistics data
- `updateTheme`: VS Code theme information
- `error`: Error messages

### Messages from UI to Extension:
- `ready`: UI is ready to receive data
- `refresh`: Request data refresh

## VS Code Theming

The UI uses VS Code CSS custom properties for theming:
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-button-background`
- etc.

This ensures the UI matches the current VS Code theme automatically.
