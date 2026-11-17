import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5180', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    env: { VITE_API_URL: 'http://127.0.0.1:3001' },
    reuseExistingServer: false,
  },
})
