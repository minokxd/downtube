import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: {
    include: ['tests/shared/**/*.test.ts', 'tests/main/**/*.test.ts', 'tests/renderer/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
});
