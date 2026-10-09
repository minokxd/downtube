import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: {
    include: ['tests/live/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 600_000,
  },
});
