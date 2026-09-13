import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5179', headless: true, trace: 'retain-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: [
    { command: 'pnpm --filter @experience-map/api exec tsx src/server.ts', cwd: '../..', port: 3019, reuseExistingServer: false,
      env: { API_PORT: '3019', NODE_ENV: 'development', ZHIHU_ACCESS_SECRET: '' } },
    { command: 'pnpm dev --host 127.0.0.1 --port 5179', port: 5179, reuseExistingServer: false,
      env: { API_PORT: '3019', VITE_DATA_MODE: 'replay' } }
  ]
});
