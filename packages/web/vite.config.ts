import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');
  return { plugins: [react()], envDir: '../..', server: {
    host: '127.0.0.1', port: Number(process.env.WEB_PORT ?? env.WEB_PORT ?? 5173), strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? env.API_PORT ?? 3001}` } }
  } };
});
