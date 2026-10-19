// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The link: a proof in the URL's fragment, which never reaches a server.
 *
 * `#v=1&m=<mode>&s=<sequent>[&d=<session>]`: a version mark of this
 * format, the mode, the sequent in the parser's own Unicode syntax (readable
 * in the address bar), and while a proof is under way or finished, the
 * session itself: linlog's session document, a promised wire form with its
 * own level and its own sequent terms, so that no goal number or formula
 * position of one library version is ever stored. The document goes
 * deflate-raw (`CompressionStream`) and then base64url. Past `LINK_LIMIT`
 * characters the link holds the sequent and the mode alone, and says so.
 * Reading a link unpacks at most `UNPACKED_LIMIT` bytes: a crafted link can
 * hold a document that inflates a thousandfold, in the visitor's own tab,
 * before linlog's limits ever read it.
 */

import type { Mode } from "./linlog";

/** This format's version mark. */
export const LINK_VERSION = "1";

/** The longest link that carries the session; a longer one carries the sequent alone. */
export const LINK_LIMIT = 2000;

/**
 * The most a link's session unpacks to, in bytes. A link the page writes is
 * at most `LINK_LIMIT` characters, about 1.5 KB of deflated JSON, which
 * unpacks to some tens of kilobytes; this is ten times that much and more.
 */
export const UNPACKED_LIMIT = 512 * 1024;

/** What a link holds. */
export interface LinkContent {
  readonly sequent: string;
  readonly mode: Mode | string;
  /** The session document's JSON text, when the link carried one that unpacked. */
  readonly session?: string;
  /** Why the session could not be read back: a version mark this page does not know, a document that did not unpack, or one past `UNPACKED_LIMIT`. */
  readonly problem?: "version" | "document" | "size";
}

/** A link written: the fragment, and whether it carries the session. */
export interface Written {
  readonly hash: string;
  readonly whole: boolean;
}

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Thrown when what a link unpacks to passes `UNPACKED_LIMIT`. */
class TooLarge extends Error {}

/** Inflates deflate-raw bytes, giving up as soon as the output passes `limit` bytes. */
async function inflate(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new TooLarge();
    }
    parts.push(value);
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Bytes as base64url, without padding. */
export function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** The bytes of a base64url text; throws on a character outside the alphabet. */
export function fromBase64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The fragment for a sequent and mode, and the session when there is one and it fits. */
export async function writeLink(
  sequent: string,
  mode: string,
  session?: string,
  limit = LINK_LIMIT,
): Promise<Written> {
  const params = new URLSearchParams({ v: LINK_VERSION, m: mode, s: sequent });
  const bare = `#${params}`;
  if (session === undefined) return { hash: bare, whole: true };
  const packed = await through(
    new TextEncoder().encode(session),
    new CompressionStream("deflate-raw"),
  );
  params.set("d", toBase64url(packed));
  const full = `#${params}`;
  return full.length <= limit ? { hash: full, whole: true } : { hash: bare, whole: false };
}

/** What a fragment holds, or undefined when it is no link of this page's. */
export async function readLink(
  hash: string,
  limit = UNPACKED_LIMIT,
): Promise<LinkContent | undefined> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const sequent = params.get("s");
  const mode = params.get("m");
  if (sequent === null || mode === null) return undefined;
  if (params.get("v") !== LINK_VERSION) return { sequent, mode, problem: "version" };
  const packed = params.get("d");
  if (packed === null) return { sequent, mode };
  try {
    const bytes = await inflate(fromBase64url(packed), limit);
    return { sequent, mode, session: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch (thrown) {
    return { sequent, mode, problem: thrown instanceof TooLarge ? "size" : "document" };
  }
}
