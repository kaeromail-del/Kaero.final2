import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // Allow importing files from the project root (kaero-v51.jsx lives there)
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      // Makes ../kaero-v51.jsx resolvable from any depth
      '@root': path.resolve(__dirname, '..'),
    },
  },
});
