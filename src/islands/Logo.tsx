// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * linlog's word mark (src/logo/), drawn inline so that the theme's tokens
 * paint it: the letters in ink, the ring in the logo's own colour (app.css).
 * The drawing names itself "linlog".
 */

import wordmark from "../logo/wordmark-light.svg?raw";

/** The word mark in a span of the given classes. */
export function Logo(props: { class: string }) {
  return (
    <span
      class={`logo ${props.class}`}
      ref={(el) => {
        el.innerHTML = wordmark;
      }}
    />
  );
}
