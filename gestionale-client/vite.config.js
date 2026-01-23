import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '80', 10),
    strictPort: true,
    host: process.env.VITE_HOST || '0.0.0.0',
    allowedHosts: ['www.gestionale.studiocapoferri.eu'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    // Ottimizzazioni per produzione
    target: 'es2015',
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger']
    },
    // Code splitting automatico
    rollupOptions: {
      output: {
        manualChunks: {
          // Separazione delle dipendenze principali
          'react-vendor': ['react', 'react-dom'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          'ui-vendor': ['bootstrap']
        },
        // Nomi file con hash per cache busting
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Limite di dimensione per warning
    chunkSizeWarningLimit: 1000,
    // Source maps solo in sviluppo
    sourcemap: process.env.NODE_ENV === 'development'
  },
  // Ottimizzazioni per pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'bootstrap']
  }
})
