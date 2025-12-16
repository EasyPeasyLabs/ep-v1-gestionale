
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Disabilita sourcemap in prod per sicurezza e leggerezza
    rollupOptions: {
        output: {
            manualChunks: {
                // Separa le librerie pesanti in chunk dedicati per caching migliore
                vendor: ['react', 'react-dom', 'chart.js', 'jspdf', 'jspdf-autotable', 'xlsx'],
                firebase: ['@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/storage', '@firebase/messaging']
            }
        }
    }
  }
});
