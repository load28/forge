import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo-direct-dom.spec.ts',
  timeout: 60000,
  use: {
    browserName: 'chromium',
    viewport: { width: 800, height: 600 },
  },
  webServer: {
    command: 'bunx vite --port 5174 --strictPort',
    cwd: './packages/demo-direct-dom',
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
