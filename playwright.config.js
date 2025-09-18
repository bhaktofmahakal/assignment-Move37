const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'api-tests',
      testMatch: '**/api.spec.js',
    },
    {
      name: 'websocket-tests', 
      testMatch: '**/websocket.spec.js',
    },
    {
      name: 'websocket-simple-tests',
      testMatch: '**/websocket-simple.spec.js',
    }
  ],

  // webServer: {
  //   command: 'npm start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 30000,
  // },
});