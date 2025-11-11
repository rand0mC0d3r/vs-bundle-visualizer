import { visualizer } from 'rollup-plugin-visualizer';

import pkg from './package.json' assert { type: 'json' };

const productionMatchers = pkg.vsBundleAnalyzer.production.map(
  (arr) => arr.map((str) => new RegExp(str)),
);


export function matchVendorFast(id: string, debug = false) {
  if(!debug) {
    for (const [regex] of (productionMatchers)) {
      const regexSignature = String(regex).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (regex.test(id)) { return 'vendor__' + regexSignature; }
    }

    return productionMatchers.length === 0 ? undefined : 'vendor__misc';
  } else {
    return 'vendor__' + id.split('node_modules/')[1]?.split('/')[0];
  }
}

export function composeChunkFileNames(chunkInfo) {
  const { name } = chunkInfo;
  if (name?.startsWith('vendor')) { return 'vendor/[name]-[hash].js'; }

  return 'assets/[name]-[hash].js';
}

export function composeManualChunks(debug = false) {
  return (id: string) => {
    if (id.includes('node_modules')) {
      return matchVendorFast(id, debug);
    }
  };
}

export function injectedVisualizer() {
  return visualizer({
    filename: 'dist/stats.json',
    template: 'raw-data',
    open: false,
    gzipSize: false,
    title: 'Bundle Visualizer',
    brotliSize: false,
  }) as any;
}
