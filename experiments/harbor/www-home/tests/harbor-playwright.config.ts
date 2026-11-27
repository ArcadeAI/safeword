import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  maxFailures: 1,
  use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
});
