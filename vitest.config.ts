import { defineConfig } from 'vitest/config';

/** Shared Vitest options for all workspaces. */
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
    },
  },
});
