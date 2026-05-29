import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import * as dotenv from 'dotenv';

dotenv.config();

const testDir = defineBddConfig({
  features: 'src/ui/features/**/*.feature',
  steps: ['src/ui/pages/**/*.bddhelper.ts', 'src/ui/fixtures/index.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  timeout: 3 * 60 * 1000,
  retries: 0,
  reporter: [['html', { outputFolder: 'reports/ui', open: 'never' }], ['line']],
  use: {
    baseURL: process.env.BASE_URL,
    headless: !!process.env.CI,
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'on' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
