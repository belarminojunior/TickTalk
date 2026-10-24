/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.TICKTALK_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
      '/api': { target: `http://localhost:${SERVER_PORT}` },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // The full-game tests play whole turns through the UI; give them room on slower machines.
    testTimeout: 20000,
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
