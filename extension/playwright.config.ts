import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Rio Extension E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome extension context
        // Note: Tests will need to load the extension manually
      },
    },
  ],

  // Run build before tests
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run build',
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
      },
});
