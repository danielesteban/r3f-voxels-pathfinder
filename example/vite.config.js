import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'r3f-voxels-pathfinder',
        replacement: fileURLToPath(new URL('../dist', import.meta.url)),
      }
    ],
  },
  plugins: [react()],
  server: { port: 8080 },
});
