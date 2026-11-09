import { defineConfig } from '@playwright/test';

// Serves the production build from a sub-path, as GitHub Pages does.
const SERVE =
  'npm run build && rm -rf .cache/pages && mkdir -p .cache/pages && cp -r dist .cache/pages/chess-course && python3 -m http.server 4173 -d .cache/pages';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4173/chess-course/' },
  webServer: { command: SERVE, url: 'http://127.0.0.1:4173/chess-course/', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 375, height: 740 }, hasTouch: true } },
  ],
});
