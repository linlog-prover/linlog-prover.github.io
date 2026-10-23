# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# Every raster of the logo, drawn from its SVGs (src/logo/, the one source)
# with resvg: what the site serves under site/, and under github/ what only
# the author can upload to GitHub. The square icons are the dark square form,
# which reads on a light and on a dark background alike; the banners are the
# dark word mark centred on the square form's field.
# Usage: python3 derive.py LOGO_DIR OUT
import pathlib
import re
import subprocess
import sys
import tempfile

src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
square = (src / "square-dark.svg").read_text()
wordmark = (src / "wordmark-dark.svg").read_text()

background = re.search(
    r'<rect width="512" height="512" rx="96" fill="(#[0-9a-f]{6})"/>', square
)
if background is None:
    sys.exit("square-dark.svg: no rounded background of 512 by 512")
field = background[1]
head, rect, rest = square.partition(background[0])
figure = rest.rsplit("</svg>", 1)[0]
view = re.search(r'viewBox="0 -768 (\d+) (\d+)"', wordmark)
if view is None:
    sys.exit("wordmark-dark.svg: not the viewBox the banners are laid out for")
mark_w, mark_h = int(view[1]), int(view[2])


def tile(rounded, scale=1.0):
    """The square form on its field: with the rounded corners, or to the edge
    for a platform that cuts its own shape, the figure scaled about the centre."""
    body = (
        figure
        if scale == 1
        else (
            f'<g transform="translate(256 256) scale({scale}) translate(-256 -256)">{figure}</g>'
        )
    )
    return (
        head + (rect if rounded else rect.replace(' rx="96"', "")) + body + "</svg>\n"
    )


def banner(width, height, mark):
    """The word mark, `mark` pixels wide, centred on the field."""
    h = mark * mark_h / mark_w
    inner = wordmark.replace(
        "<svg ",
        f'<svg x="{(width - mark) / 2}" y="{(height - h) / 2}" width="{mark}" height="{h}" ',
        1,
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'
        f'<rect width="{width}" height="{height}" fill="{field}"/>{inner}</svg>\n'
    )


# A maskable icon is cut to a circle of 80 per cent of its width at most: the
# figure, which spans 77 per cent of the square, is scaled into it.
SITE = {
    "favicon-32.png": (tile(True), 32, 32),
    "apple-touch-icon.png": (tile(False), 180, 180),
    "icon-192.png": (tile(True), 192, 192),
    "icon-512.png": (tile(True), 512, 512),
    "icon-maskable-512.png": (tile(False, 0.8), 512, 512),
    "og.png": (banner(1200, 630, 640), 1200, 630),
}
GITHUB = {
    "avatar.png": (tile(False), 512, 512),
    "social-preview.png": (banner(1280, 640, 640), 1280, 640),
}

with tempfile.TemporaryDirectory() as tmp:
    for part, files in [("site", SITE), ("github", GITHUB)]:
        (out / part).mkdir(parents=True)
        for name, (svg, width, height) in files.items():
            path = pathlib.Path(tmp) / f"{part}-{name}.svg"
            path.write_text(svg)
            subprocess.run(
                [
                    "resvg",
                    "--width",
                    str(width),
                    "--height",
                    str(height),
                    path,
                    out / part / name,
                ],
                check=True,
            )
            print(f"{part}/{name}: {width} by {height}")
