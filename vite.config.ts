import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Production optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react'],
          pdf: ['jspdf', 'jspdf-autotable'],
          excel: ['exceljs'],
          utils: ['uuid', 'bcryptjs', 'date-fns']
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  server: {
    // Development server configuration
    port: 5173,
    host: true,
    cors: true,
  },
  preview: {
    // Preview server configuration for production testing
    port: 4173,
    host: true,
  },
  define: {
    // Define global constants for production
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
});