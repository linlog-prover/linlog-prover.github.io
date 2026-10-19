# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# The `licences' check: the built site serves the licence of everything it
# sends a browser, read apart from the integration that wrote them
# (src/integrations/licences.ts).
#
# - licenses/bundle.txt lists every npm package the site depends on at run
#   time (package.json's dependencies, at the version package-lock.json
#   locks) but the font packages, each with its licence's text;
# - licenses/THIRD-PARTY-NOTICES.txt is linlog-web's, the Rust crates inside
#   the module, byte for byte, and licenses/LICENSE.txt this repository's;
# - every font file of the site is under fonts/, beside its family's
#   <Family>-OFL.txt, an SIL Open Font License text, Euler Math's being
#   linlog's own byte for byte;
# - every page that carries written content (an element marked
#   data-written) says that it is under CC BY 4.0, with a link to the
#   licence, and the prover's page is one of them.
# Usage: python3 licences.py SITE LINLOG_WEB LINLOG_FONTS PACKAGE_JSON PACKAGE_LOCK LICENSE
import html.parser
import json
import pathlib
import re
import sys

site, web, fonts = (pathlib.Path(a) for a in sys.argv[1:4])
package = json.loads(pathlib.Path(sys.argv[4]).read_text())
lock = json.loads(pathlib.Path(sys.argv[5]).read_text())
licence = pathlib.Path(sys.argv[6]).read_bytes()
CC_BY = "https://creativecommons.org/licenses/by/4.0/"
# The pages that must carry written content, and so the CC BY line.
WRITTEN: set[str] = set()
FONT_FILES = {".woff", ".woff2", ".otf", ".ttf"}

problems = []

bundle = site / "licenses/bundle.txt"
if not bundle.is_file():
    problems.append("no licenses/bundle.txt, the npm bundle's notices")
else:
    entries = {}
    for block in re.split(r"^## ", bundle.read_text(), flags=re.M)[1:]:
        head, _, text = block.partition("\n")
        match = re.fullmatch(r"(\S+) - (\S+)(?: \((.+)\))?", head.strip())
        if not match:
            problems.append(f"bundle.txt: an entry that names no package: {head!r}")
            continue
        entries[match[1]] = (match[2], match[3], text.strip())
    for name in package.get("dependencies", {}):
        if name.startswith("@fontsource"):
            continue
        locked = lock["packages"].get(f"node_modules/{name}", {}).get("version")
        if name not in entries:
            problems.append(
                f"bundle.txt: no notice of {name}, a dependency the browser runs"
            )
        elif entries[name][0] != locked:
            problems.append(
                f"bundle.txt: {name} {entries[name][0]}, but the lock has {locked}"
            )
    for name, (version, identifier, text) in entries.items():
        if not identifier or len(text) < 100:
            problems.append(
                f"bundle.txt: {name} {version} has no licence identifier or text"
            )

for served, source in [
    ("licenses/THIRD-PARTY-NOTICES.txt", web / "THIRD-PARTY-NOTICES.txt")
]:
    path = site / served
    if not path.is_file() or path.read_bytes() != source.read_bytes():
        problems.append(f"{served} is not the package's {source.name}")
if (
    not (site / "licenses/LICENSE.txt").is_file()
    or (site / "licenses/LICENSE.txt").read_bytes() != licence
):
    problems.append("licenses/LICENSE.txt is not the repository's LICENSE")

families = {
    "Euler-Math": "Euler-Math",
    "figtree-": "Figtree",
    "space-mono-": "SpaceMono",
}
for path in sorted(p for p in site.rglob("*") if p.suffix in FONT_FILES):
    name = path.relative_to(site)
    if path.parent != site / "fonts":
        problems.append(f"{name}: a font outside fonts/, away from its licence")
        continue
    family = next(
        (f for prefix, f in families.items() if path.name.startswith(prefix)), None
    )
    if family is None:
        problems.append(f"{name}: a font of no family whose licence is known here")
        continue
    beside = path.parent / f"{family}-OFL.txt"
    if (
        not beside.is_file()
        or "sil open font license" not in beside.read_text().lower()
    ):
        problems.append(f"{name}: no OFL text beside it ({beside.name})")
euler = site / "fonts/Euler-Math-OFL.txt"
if not euler.is_file() or euler.read_bytes() != (fonts / "OFL.txt").read_bytes():
    problems.append("fonts/Euler-Math-OFL.txt is not linlog's OFL.txt for Euler Math")


class Written(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.written = False
        self.links = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "data-written" in attrs:
            self.written = True
        if tag == "a" and attrs.get("href"):
            self.links.add(attrs["href"])

    handle_startendtag = handle_starttag


carrying = set()
for page in sorted(site.rglob("*.html")):
    name = str(page.relative_to(site))
    parser = Written()
    parser.feed(page.read_text())
    parser.close()
    if parser.written:
        carrying.add(name)
        if CC_BY not in parser.links:
            problems.append(
                f"{name} carries written content but no link to CC BY 4.0 ({CC_BY})"
            )
for name in sorted(WRITTEN - carrying):
    problems.append(f"{name} carries no written content marked data-written")

if problems:
    sys.exit("\n".join(problems))
print(
    f"the bundle's {len(entries)} notices, the crates' notices and the code's licence are served, "
    f"every font sits beside its OFL, and {len(carrying)} pages of written content say CC BY 4.0"
)
