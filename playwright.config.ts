// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Browser tests against the built site, served as GitHub Pages serves it
// (tests/serve.ts). With SITE_DIR set (the flake's `e2e' check points it at
// packages.default) that very package is tested; otherwise (`e2e' in the dev
// shell) a fresh `astro build`. The browsers are nixpkgs'
// (PLAYWRIGHT_BROWSERS_PATH), so only Chromium is configured: at a desktop's
// width, and at a phone's for tests/phone.spec.ts. E2E_PORT moves the server,
// so that two workspaces can run their tests side by side.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["E2E_PORT"] ?? 8790);
const site = process.env["SITE_DIR"];

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env["CI"],
  fullyParallel: true,
  // Under CI 60 s and one retry, as the author's sites have it; a test that
  // passes on its retry is reported as flaky, not hidden. The dev shell keeps
  // 30 s and no retry, so a test that grows slow still shows.
  timeout: process.env["CI"] ? 60_000 : 30_000,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: process.env["CI"] ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "phone.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "phone",
      testMatch: "phone.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: site
      ? `node tests/serve.ts ${site} ${port}`
      : `npm run build && node tests/serve.ts dist ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
