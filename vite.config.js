import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true, // Opens browser automatically on start
  },
  build: {
    outDir: 'dist',
  }
});
