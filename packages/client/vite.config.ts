/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), '..', '..'), '');
  const serverPort = env.PORT || '3000';

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifestFilename: 'manifest.json',
        manifest: {
          name: 'Chores',
          short_name: 'Chores',
          display: 'standalone',
          start_url: '/',
          background_color: '#ffffff',
          theme_color: '#f59e0b',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
