import { defineConfig, devices } from "@playwright/test";

// Runs against the production build (`vite preview`) so the service worker and precache are real.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone-size", use: { ...devices["iPhone 14"], browserName: "chromium", defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "pnpm preview", url: "http://localhost:4173", reuseExistingServer: !process.env.CI },
});
