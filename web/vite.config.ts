/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Semi 2.x 的 exports 未暴露 dist/css，精确映射到磁盘文件以绕过 exports 解析
      '@douyinfe/semi-ui/dist/css/semi.min.css': fileURLToPath(
        new URL('../node_modules/@douyinfe/semi-ui/dist/css/semi.min.css', import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
