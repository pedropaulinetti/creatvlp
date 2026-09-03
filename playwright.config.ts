import { defineConfig, devices } from "@playwright/test";

// Portas altas de propósito: evita reaproveitar o dev server de outro projeto.
const PORT = 5987;
const FUNCTIONS_PORT = 54987;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      // 375 px em Chromium: o WebKit exigiria outro download de navegador.
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: [
    {
      // As mesmas Edge Functions de produção, com o provider fake.
      command: `deno run --allow-net --allow-env --allow-read --allow-sys _e2e/server.ts`,
      cwd: "supabase/functions",
      port: FUNCTIONS_PORT,
      reuseExistingServer: false,
      env: { FAKE_AI: "true", FUNCTIONS_PORT: String(FUNCTIONS_PORT) },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npx vite --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: false,
      env: { VITE_FUNCTIONS_URL: `http://localhost:${FUNCTIONS_PORT}/functions/v1` },
    },
  ],
});
