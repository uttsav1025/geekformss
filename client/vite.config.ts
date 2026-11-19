import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read the repo-root .env. Only VITE_* variables are ever exposed to the browser.
  envDir: '..',
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't bust the React/router cache.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          vendor: ['axios', 'lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Same-origin in dev too, so the path-scoped refresh cookie just works.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
