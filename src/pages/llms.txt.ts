// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The page's llms.txt (llmstxt.org): for AI models, what the page is and
// where linlog's own guide for them is, which linlog's rustdoc site on this
// origin serves at /linlog/llms.txt. The text is written content, in
// src/content/llms.txt.
import text from "../content/llms.txt?raw";

export function GET() {
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
