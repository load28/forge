import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: {
    browserName: 'chromium',
    viewport: { width: 800, height: 600 },
  },
  webServer: {
    command: 'bunx vite --port 5173 --strictPort',
    cwd: './packages/demo',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
