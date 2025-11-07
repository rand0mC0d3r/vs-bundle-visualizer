
export const PACKAGE_NAME = 'bundleVisualizer';
export const PACKAGE_JSON_NAME = 'vs-bundle-visualizer';

export const EXTENSIONS = [
  '/index.ts', '/index.tsx', '/index.js', '/index.jsx'
];

export const ALIASES = {
  '@utils/': 'utils',
  '@/': 'root',
  '@services/': 'services',
  '@store/': 'store',
  '@/store/': 'store',
  '@components/': 'components',
  '@/components/': 'components',
  '@views/': 'views',
  '@/views/': 'views',
  '@modules/': 'modules',
  '@/modules/': 'modules',
};

export const BADGES = {
  1: '1️⃣',
  2: '2️⃣',
  3: '3️⃣',
  4: '4️⃣',
  5: '5️⃣',
  6: '6️⃣',
  7: '7️⃣',
  8: '8️⃣',
  9: '9️⃣',
  10: '🔟'
};

export const SKIPPED_PACKAGES = [
  'react',
  'react-leaflet',
  'crypto-js/md5',
  'localforage',
  'string-to-color',
  'leaflet',
  'dayjs',
  '@mui/material',
  '@mui/material/styles',
  'react-resizable-panels',
  'react-markdown',
  'react-intersection-observer',
  'js-base64',
  '@iconify/react',
  "@emotion/react",
  'react-dom/client',
  '@turf/area',
  'immer',
  '@mui/x-charts',
  'react-dom',
  'reselect',
  '@vercel/speed-insights/react',
  'lodash',
  'color',
  '@react-oauth/google',
  'axios',
  'mobx',
  '@tanstack/react-virtual',
  'mobx-react',
  'redux',
  'react-redux',
  'next',
  'vue',
  'vuex',
  'svelte',
];

export const INPUT_FILE_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

export const INPUT_ROOT_FOLDER = 'src/';
