// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The light and dark toggle's rules. The page follows the system's scheme
 * unless the visitor pinned one; the pin is kept in the browser's storage
 * under `THEME_KEY` and applied as `<html data-theme>` before the first
 * paint (layouts/Base.astro reads the same key).
 */

/** The visitor's choice: the system's scheme, or one pinned. */
export type Theme = "system" | "light" | "dark";

/** The storage key of the pinned scheme. */
export const THEME_KEY = "linlog-theme";

/** The choice a stored value names, the system's for anything else. */
export function parseTheme(stored: string | null): Theme {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** The scheme the page shows under a choice, given the system's. */
export function effective(theme: Theme, systemDark: boolean): "light" | "dark" {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/** The choice the band's toggle makes: the other scheme than the one shown. */
export function toggled(theme: Theme, systemDark: boolean): Theme {
  return effective(theme, systemDark) === "dark" ? "light" : "dark";
}

/**
 * The script that applies the pinned scheme before the first paint, inline
 * at the start of every page's body (layouts/Base.astro), after the policy's
 * <meta>; astro.config.ts allows it by this very text's hash.
 */
export const PREPAINT = `try{const t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}`;
