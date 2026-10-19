// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// A static server for the built site, as GitHub Pages serves it: the file at
// the path, a directory's index.html, and 404.html (or a bare 404) for the
// rest, with the media types the page needs (the module as
// application/wasm, which streaming compilation requires). No header beyond
// those, since Pages sets none the site could choose.
// Usage: node tests/serve.ts DIR PORT
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const [dir = "dist", port = "8790"] = process.argv.slice(2);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function file(path: string): string | undefined {
  try {
    const stat = statSync(path);
    if (stat.isFile()) return path;
    if (stat.isDirectory()) return file(join(path, "index.html"));
  } catch {
    // Not there: the caller answers 404.
  }
  return undefined;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = normalize(join(dir, decodeURIComponent(url.pathname)));
  const found = path.startsWith(normalize(dir)) ? file(path) : undefined;
  const served = found ?? file(join(dir, "404.html"));
  response.statusCode = found ? 200 : 404;
  if (!served) {
    response.end("not found");
    return;
  }
  response.setHeader("content-type", TYPES[extname(served)] ?? "application/octet-stream");
  createReadStream(served).pipe(response);
}).listen(Number(port), "127.0.0.1");
