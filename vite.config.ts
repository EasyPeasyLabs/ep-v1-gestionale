import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
        output: {
            manualChunks: {
                vendor: ['react', 'react-dom', 'chart.js', 'jspdf', 'jspdf-autotable', 'xlsx'],
                firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/messaging']
            }
        }
    }
  }
});