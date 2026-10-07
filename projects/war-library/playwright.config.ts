import { defineConfig, devices } from '@playwright/test'

// One worker: parallel headless WebGL contexts contend for the GPU and make game time drift.
// channel 'chrome' uses the installed Google Chrome (hardware GPU) — no browser download, and not
// the SwiftShader headless shell whose frame times are fiction.
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4188',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4188 --strictPort',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 720 } } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@mobile/ },
  ],
})
