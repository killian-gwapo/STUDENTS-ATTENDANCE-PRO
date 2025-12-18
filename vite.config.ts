import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file from current directory
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      plugins: [react()],
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true, // Cleans the folder before each build
      },
      define: {
        // This allows your code to use process.env.GEMINI_API_KEY
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Points @ to your root directory
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});