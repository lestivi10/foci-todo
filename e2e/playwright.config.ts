import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Unique database per run; fixed dedicated ports never reuse a developer server.
const databaseDir =
  process.env.E2E_DATABASE_DIR ??
  mkdtempSync(path.join(tmpdir(), "daylist-e2e-"));
process.env.E2E_DATABASE_DIR = databaseDir;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalTeardown: "./teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command:
        ".venv/bin/uvicorn todo_app.main:app --host 127.0.0.1 --port 8001",
      cwd: "../backend",
      env: { TODO_DB_PATH: path.join(databaseDir, "todos.sqlite3") },
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 4173 --strictPort",
      cwd: "../frontend",
      env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:8001" },
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
});
