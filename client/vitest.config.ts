import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../vitest.config';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      },
    },
  }),
);
