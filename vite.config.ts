import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // This allows the app to access process.env.API_KEY in the browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      port: 7860,
      host: true 
    },
    preview: {
      port: 7860,
      allowedHosts: ['localhost', '127.0.0.1', '.hf.space']
    }
  };
});