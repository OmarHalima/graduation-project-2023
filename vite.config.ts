import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@supabase/supabase-js',
          ],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@hello-pangea/dnd'],
  },
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    watch: {
      usePolling: true,
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
    host: true,
  },
});
