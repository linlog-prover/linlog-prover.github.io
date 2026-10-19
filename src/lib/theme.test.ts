// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effective, parseTheme, toggled } from "./theme";

describe("the theme toggle", () => {
  it("always shows the other scheme than the one shown", () => {
    fc.assert(
      fc.property(fc.constantFrom("system", "light", "dark" as const), fc.boolean(), (t, dark) => {
        const theme = parseTheme(t);
        expect(effective(toggled(theme, dark), dark)).not.toBe(effective(theme, dark));
      }),
    );
  });

  it("reads anything but a pinned scheme as the system's", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme("dark")).toBe("dark");
  });
});
