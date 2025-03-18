import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple config for Vercel
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}); 