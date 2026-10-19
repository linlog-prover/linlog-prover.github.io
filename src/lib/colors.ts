// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The colour of the bands in each scheme, `--color-panel` of tokens.css:
 * an installed app's title bar, which sits on the top band. Read from the
 * tokens' text, never written out (layouts/Base.astro's theme-color, the
 * manifest of src/integrations/offline.ts).
 */
export function panelColors(tokens: string): { light: string; dark: string } {
  const match = /--color-panel: light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\);/.exec(tokens);
  if (!match?.[1] || !match[2]) throw new Error("tokens.css: no --color-panel: light-dark(#…, #…)");
  return { light: match[1], dark: match[2] };
}
