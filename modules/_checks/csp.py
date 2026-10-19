# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# The `csp' check: every page of the built site carries the
# Content-Security-Policy as a <meta> element, first in its head, before any
# script, style or stylesheet (a <meta> policy covers only what follows it);
# the policy allows each executable inline <script> and each inline <style>
# of the page by its SHA-256, recomputed here apart from Astro, which wrote
# them; script-src has 'wasm-unsafe-eval' for linlog's module and nothing
# that would allow inline code or eval wholesale; and no data: URL is used,
# which default-src 'none' blocks.
# Usage: python3 csp.py SITE
import base64
import hashlib
import html.parser
import pathlib
import re
import sys

# The types a browser executes (the HTML standard): the rest are data.
EXECUTABLE = {"", "module", "importmap", "speculationrules"} | {
    f"{kind}/{name}"
    for kind, names in [
        ("application", ["ecmascript", "javascript", "x-ecmascript", "x-javascript"]),
        (
            "text",
            [
                "ecmascript",
                "javascript",
                "jscript",
                "livescript",
                "x-ecmascript",
                "x-javascript",
            ]
            + [f"javascript1.{n}" for n in range(6)],
        ),
    ]
    for name in names
}
# Sources that would allow inline code, eval or any script wholesale.
LOOSE = {
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'unsafe-hashes'",
    "data:",
    "blob:",
    "*",
    "https:",
    "http:",
}


def digest(text):
    return "sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.policies, self.scripts, self.styles = [], set(), set()
        self.head = False
        # Whatever loads code before the policy: an inline script or style,
        # or a script, stylesheet or preload element.
        self.before = []
        self.open = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head":
            self.head = True
        elif (
            tag == "meta"
            and (attrs.get("http-equiv") or "").lower() == "content-security-policy"
        ):
            self.policies.append((attrs.get("content") or "", self.head))
        elif tag in ("script", "style") or (
            tag == "link"
            and {"stylesheet", "modulepreload", "preload"}
            & set((attrs.get("rel") or "").lower().split())
        ):
            if not self.policies:
                self.before.append(tag)
        if tag == "script":
            kind = (attrs.get("type") or "").strip().lower()
            self.open = (
                self.scripts if "src" not in attrs and kind in EXECUTABLE else None,
                [],
            )
        elif tag == "style":
            self.open = (self.styles, [])

    def handle_data(self, data):
        if self.open:
            self.open[1].append(data)

    def handle_endtag(self, tag):
        if tag == "head":
            self.head = False
        if tag in ("script", "style") and self.open:
            found, parts = self.open
            self.open = None
            if found is not None and "".join(parts):
                found.add(digest("".join(parts)))


def directives(policy):
    # A browser obeys the first copy of a directive and ignores the rest.
    out = {}
    for part in policy.split(";"):
        words = part.split()
        if words:
            out.setdefault(words[0].lower(), words[1:])
    return out


def governing(found, kind):
    # The directive a browser applies to <script> or <style> elements:
    # the -elem one where there is one, else the general one, else
    # default-src.
    for name in (f"{kind}-src-elem", f"{kind}-src", "default-src"):
        if name in found:
            return name, found[name]
    return None, None


site = pathlib.Path(sys.argv[1])
problems = []
pages = sorted(site.rglob("*.html"))
if not pages:
    problems.append("the site has no page")
counts = [0, 0]
for path in pages:
    name = path.relative_to(site)
    page = Page()
    page.feed(path.read_text())
    page.close()
    if len(page.policies) != 1:
        problems.append(
            f"{name}: {len(page.policies)} Content-Security-Policy <meta> elements, not one"
        )
        continue
    policy, in_head = page.policies[0]
    if not in_head:
        problems.append(f"{name}: the policy's <meta> is outside <head>")
    if page.before:
        problems.append(
            f"{name}: {', '.join(page.before)} before the policy, which does not cover them"
        )
    found = directives(policy)
    if found.get("default-src") != ["'none'"]:
        problems.append(f"{name}: default-src is not 'none'")
    for kind, inline in [("script", page.scripts), ("style", page.styles)]:
        directive, sources = governing(found, kind)
        if sources is None:
            problems.append(f"{name}: nothing governs {kind} elements")
            continue
        loose = LOOSE & set(sources)
        if loose:
            problems.append(f"{name}: {directive} allows {sorted(loose)}")
        allowed = {
            s.strip("'")
            for s in sources
            if re.fullmatch(r"'sha256-[A-Za-z0-9+/]+=*'", s)
        }
        missing = inline - allowed
        if missing:
            problems.append(
                f"{name}: inline code {directive} does not allow: {sorted(missing)}"
            )
    # Compiling WebAssembly is governed by script-src, never by its -elem form.
    if "'wasm-unsafe-eval'" not in found.get(
        "script-src", found.get("default-src", [])
    ):
        problems.append(
            f"{name}: script-src lacks 'wasm-unsafe-eval', which linlog's module needs"
        )
    counts[0] += len(page.scripts)
    counts[1] += len(page.styles)

data_url = re.compile(r"url\(\s*[\"']?data:|(?:src|href)=[\"']?data:", re.I)
for path in sorted([*site.rglob("*.css"), *site.rglob("*.html")]):
    if data_url.search(path.read_text()):
        problems.append(
            f"{path.relative_to(site)}: a data: URL, which the policy blocks"
        )

if problems:
    sys.exit("\n".join(problems))
print(
    f"every one of the {len(pages)} pages carries the policy first in its head, allowing "
    f"its {counts[0]} inline scripts and {counts[1]} inline styles by hash, and no data: URL is used"
)
