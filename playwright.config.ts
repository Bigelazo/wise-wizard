import { defineConfig, devices } from "@playwright/test";

const port = 3000;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Mobile uses Chromium too, so CI installs a single browser.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Runs the production build; run `bun run build` first.
  webServer: {
    command: "bun run start",
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
