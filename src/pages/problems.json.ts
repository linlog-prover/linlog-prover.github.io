// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The problems Practice offers, the store's provable ones, as one JSON file
// the island fetches when Practice first opens, so the page's first load
// carries none of them.
import { getCollection } from "astro:content";
import { offered } from "../lib/practice";

export async function GET() {
  return new Response(JSON.stringify(offered(await getCollection("problems"))), {
    headers: { "content-type": "application/json" },
  });
}
