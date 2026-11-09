import { defineConfig } from 'vite';

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
