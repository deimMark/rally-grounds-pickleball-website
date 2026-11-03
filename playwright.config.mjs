import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
for (const file of ['.env.local', '.env.test.local']) if (existsSync(file)) process.loadEnvFile(file);
const port = Number(process.env.TEST_PORT || 3000);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: 1,
  use: {
    baseURL, trace: 'off', // Auth traces may contain local passwords/session tokens.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: `npm run start -- --port ${port}`, url: baseURL, env: { APP_ORIGIN: baseURL }, reuseExistingServer: false, timeout: 120000 },
});
