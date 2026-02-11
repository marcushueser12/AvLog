import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3001')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html')
          },
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
                if (id.includes('framer-motion')) return 'vendor-motion';
                if (id.includes('@supabase')) return 'vendor-supabase';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('@vercel')) return 'vendor-analytics';
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
