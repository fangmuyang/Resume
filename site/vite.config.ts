import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * base decides the URL prefix of every emitted asset.
 * A GitHub Pages *project* site is served from https://<user>.github.io/<repo>/,
 * so the production build must use '/resume/'. Getting this wrong produces the
 * classic "blank page + 404 on every asset" symptom.
 * Local dev is happier at '/', hence the split by command.
 */
const REPO_NAME = 'resume';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO_NAME}/` : '/',

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      // Must stay in sync with compilerOptions.paths in tsconfig.json
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    strictPort: false,
  },

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
}));
