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
#   <Family>-OFL.txt, an SIL Open Font License text, or New Computer Modern
#   Math's <Family>-LICENSE.txt, the GUST Font License's, linlog's math
#   fonts' (Euler Math, STIX Two Math, Garamond-Math, Asana Math, New
#   Computer Modern Math) being the licences linlog keeps beside them, and
#   their files linlog's, byte for byte;
# - every image the site serves is the logo's, under logo/, beside
#   logo/LICENSE.txt, which puts it under CC BY 4.0 with a link to the
#   licence, and every SVG of it has its text outlined (no <text>, so no
#   font file goes with it);
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
WRITTEN = {"index.html"}
FONT_FILES = {".woff", ".woff2", ".otf", ".ttf"}
IMAGE_FILES = {".png", ".svg", ".ico", ".jpg", ".jpeg", ".gif", ".webp", ".avif"}

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

# Each family by its files' prefix: its name, the licence file beside it and
# a phrase that licence's text holds.
OFL = "sil open font license"
families = {
    "Euler-Math": ("Euler-Math", "OFL", OFL),
    "STIXTwoMath-": ("STIXTwoMath", "OFL", OFL),
    "Garamond-Math": ("Garamond-Math", "OFL", OFL),
    "Asana-Math": ("Asana-Math", "OFL", OFL),
    "NewCMMath-": ("NewCMMath", "LICENSE", "gust font license"),
    "figtree-": ("Figtree", "OFL", OFL),
    "space-mono-": ("SpaceMono", "OFL", OFL),
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
    family, kind, phrase = family
    beside = path.parent / f"{family}-{kind}.txt"
    if not beside.is_file() or phrase not in beside.read_text().lower():
        problems.append(f"{name}: no licence text beside it ({beside.name})")
# linlog's math fonts, each served with the licence linlog keeps beside it.
for served, source in [
    ("Euler-Math-OFL.txt", "OFL.txt"),
    ("STIXTwoMath-OFL.txt", "STIXTwoMath-Regular-OFL.txt"),
    ("Garamond-Math-OFL.txt", "Garamond-Math-OFL.txt"),
    ("Asana-Math-OFL.txt", "Asana-Math-OFL.txt"),
    ("NewCMMath-LICENSE.txt", "NewCMMath-Book-LICENSE.txt"),
]:
    path = site / "fonts" / served
    if not path.is_file() or path.read_bytes() != (fonts / source).read_bytes():
        problems.append(f"fonts/{served} is not linlog's {source}")
# linlog's math fonts are served unmodified, byte for byte linlog's files: a
# font kept under its name must be (the OFL's Reserved Font Names, the
# LPPL's clause 6 for New Computer Modern Math).
for prefix, source in [
    ("Euler-Math", "Euler-Math.otf"),
    ("STIXTwoMath-", "STIXTwoMath-Regular.otf"),
    ("Garamond-Math", "Garamond-Math.otf"),
    ("Asana-Math", "Asana-Math.otf"),
    ("NewCMMath-", "NewCMMath-Book.otf"),
]:
    served = [p for p in (site / "fonts").glob(f"{prefix}*") if p.suffix in FONT_FILES]
    if len(served) != 1 or served[0].read_bytes() != (fonts / source).read_bytes():
        problems.append(f"fonts/{prefix}*: not linlog's {source}, unmodified, once")

# The logo: the site's only images, under CC BY 4.0.
logo = site / "logo"
notice = logo / "LICENSE.txt"
if (
    not notice.is_file()
    or CC_BY not in notice.read_text()
    or "CC BY 4.0" not in notice.read_text()
):
    problems.append(
        "logo/LICENSE.txt does not put the logo under CC BY 4.0, linking it"
    )
images = sorted(p for p in site.rglob("*") if p.suffix in IMAGE_FILES)
for path in images:
    name = path.relative_to(site)
    if path.parent != logo:
        problems.append(
            f"{name}: an image outside logo/, under no licence the site states"
        )
    elif path.suffix == ".svg" and "<text" in path.read_text():
        problems.append(
            f"{name}: the logo with text not outlined, which needs its font"
        )


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
    f"every font sits beside its licence, the {len(images)} images are the logo's under CC BY 4.0, "
    f"and {len(carrying)} pages of written content say CC BY 4.0"
)
