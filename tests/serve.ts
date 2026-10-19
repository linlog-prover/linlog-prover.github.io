// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// A static server for the built site, as GitHub Pages serves it: the file at
// the path, a directory's index.html, and 404.html (or a bare 404) for the
// rest, with the media types the page needs (the module as
// application/wasm, which streaming compilation requires) and the ten
// minutes Pages lets a browser keep any file (`cache-control:
// max-age=600`), and an id for each response, as Pages's
// `x-github-request-id`, by which a test tells a fetch from the network
// from one the browser kept. No header beyond those, since Pages sets none
// the site could choose. Under /linlog/ it serves
// tests/linlog-docs/, a stand-in for linlog's own Pages site (the rustdoc),
// which Pages serves on the same origin.
// Usage: node tests/serve.ts DIR PORT
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const [dir = "dist", port = "8790"] = process.argv.slice(2);
const docs = fileURLToPath(new URL("./linlog-docs/", import.meta.url));

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

let responses = 0;

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const [root, rest] = pathname.startsWith("/linlog/")
    ? [docs, pathname.slice("/linlog/".length)]
    : [dir, pathname];
  const path = normalize(join(root, rest));
  const found = path.startsWith(normalize(root)) ? file(path) : undefined;
  const served = found ?? file(join(dir, "404.html"));
  response.statusCode = found ? 200 : 404;
  if (!served) {
    response.end("not found");
    return;
  }
  response.setHeader("content-type", TYPES[extname(served)] ?? "application/octet-stream");
  response.setHeader("cache-control", "max-age=600");
  response.setHeader("x-github-request-id", String(++responses));
  createReadStream(served).pipe(response);
}).listen(Number(port), "127.0.0.1");
