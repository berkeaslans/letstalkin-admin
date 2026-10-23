import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Geliştirmede /api istekleri yerel backend'e gider (web'deki LT_DEV_BACKEND ile aynı).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': '/src' } },
  server: {
    proxy: { '/api': { target: process.env.LT_DEV_BACKEND ?? 'http://localhost:3000', changeOrigin: true } },
  },
});
