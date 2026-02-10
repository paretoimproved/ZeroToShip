import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'tests/generation/brief-generator.test.ts',
      'tests/analysis/gap-analyzer.test.ts',
    ],
    env: {
      PIPELINE_DATA_DIR: '/tmp/ideaforge-test-runs',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
