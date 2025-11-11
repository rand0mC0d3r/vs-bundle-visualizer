import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { composeChunkFileNames, composeManualChunks, injectedVisualizer } from './vite.utils';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), injectedVisualizer()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
      rosssllupOptions: {
        treeshake: true,
        output: {
          manualChunks: composeManualChunks(process.env.VITE_BUNDLE_DEBUG === 'true'),
          chunkFileNames: (chunkInfo) => composeChunkFileNames(chunkInfo),
        },
      },
    rollupOptions: {
      treeshake: true,
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  base: './',
  publicDir: 'public'
}));
