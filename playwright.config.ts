import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/qa',
  testMatch: '**/*.spec.ts',
  timeout: 120000,
  retries: 0,
  workers: 1,
  globalSetup: './scripts/qa/global.setup.ts',
  use: {
    baseURL: process.env.ZUROT_BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
