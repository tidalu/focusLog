import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Electron loads the renderer over file://. Absolute /assets URLs resolve
  // against the drive root and produce a blank packaged window.
  base: './',
  root: resolve(import.meta.dirname, 'src/renderer'),
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true
  }
});
