import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'lib/__tests__/**/*.test.ts',
      'components/__tests__/**/*.test.tsx',
    ],
    setupFiles: ['./vitest.setup.ts'],
  },
});
