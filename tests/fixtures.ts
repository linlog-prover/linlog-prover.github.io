// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Playwright's `test', with every page watched for what the
// Content-Security-Policy blocked: a test fails when anything it did was
// refused by the policy (an inline style in a drawing, a fetch, a worker),
// which only the deployed site would otherwise show.

import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ policy: undefined }>({
  policy: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { __blocked: string[] }).__blocked = seen;
        document.addEventListener("securitypolicyviolation", (event) =>
          seen.push(`${event.effectiveDirective} ${event.blockedURI}`),
        );
      });
      await use(undefined);
      for (const page of context.pages()) {
        const blocked = await page
          .evaluate(() => (window as unknown as { __blocked?: string[] }).__blocked ?? [])
          .catch(() => []);
        expect(blocked, "what the Content-Security-Policy blocked").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
