import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
  },
  build: {
    outDir: 'dist',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
        output: {
            manualChunks: {
                react: ['react', 'react-dom'],
                firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/messaging'],
                pdf: ['jspdf', 'jspdf-autotable'],
                excel: ['xlsx'],
                charts: ['chart.js']
            }
        }
    }
  }
});