#!/usr/bin/env python3
"""Build Leon Panel brand assets (SVG, PNG, PWA icons, Apple Touch Icon, multi-size ICO)
from the canonical vector logos in design/logos/.

Usage:
  python3 scripts/build-brand-assets.py [--logo a|b|c]
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

LOGOS = {
    "a": {
        "color": ROOT / "design/logos/leon-logo-a-prism.svg",
        "mono": ROOT / "design/logos/leon-logo-a-prism-mono.svg",
        "apple_bg": (9, 9, 11, 255),      # #09090B
    },
    "b": {
        "color": ROOT / "design/logos/leon-logo-b-grid.svg",
        "mono": ROOT / "design/logos/leon-logo-b-grid-mono.svg",
        "apple_bg": (244, 241, 234, 255), # #F4F1EA
    },
    "c": {
        "color": ROOT / "design/logos/leon-logo-c-monolith.svg",
        "mono": ROOT / "design/logos/leon-logo-c-monolith-mono.svg",
        "apple_bg": (17, 19, 24, 255),    # #111318
    },
}


def render_svg_to_png(svg_path: Path, out_path: Path, size: int) -> None:
    subprocess.run(
        [
            "rsvg-convert",
            "-w",
            str(size),
            "-h",
            str(size),
            str(svg_path),
            "-o",
            str(out_path),
        ],
        check=True,
    )


def build_apple_touch_icon(svg_path: Path, out_path: Path, bg_rgba: tuple[int, int, int, int]) -> None:
    # iOS applies its own rounded mask and fills transparent pixels with black,
    # so render onto a solid matching brand background with comfortable safe-area inset.
    with tempfile.TemporaryDirectory() as tmp:
        fg_path = Path(tmp) / "fg.png"
        render_svg_to_png(svg_path, fg_path, 164)
        canvas = Image.new("RGBA", (180, 180), bg_rgba)
        fg = Image.open(fg_path).convert("RGBA")
        canvas.alpha_composite(fg, (8, 8))
        canvas.convert("RGB").save(out_path, format="PNG", optimize=True)


def build_favicon_ico(svg_path: Path, out_path: Path) -> None:
    sizes = [16, 32, 48, 64]
    images: list[Image.Image] = []
    with tempfile.TemporaryDirectory() as tmp:
        for size in sizes:
            png_path = Path(tmp) / f"icon-{size}.png"
            render_svg_to_png(svg_path, png_path, size)
            images.append(Image.open(png_path).convert("RGBA").copy())
    # Save multi-resolution ICO (Pillow embeds all provided sizes cleanly when append_images is used)
    images[-1].save(
        out_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Leon Panel brand icon assets.")
    parser.add_argument("--logo", choices=("a", "b", "c"), default="b", help="Logo concept to build (default: b)")
    args = parser.parse_args()

    spec = LOGOS[args.logo]
    color_svg: Path = spec["color"]
    mono_svg: Path = spec["mono"]
    apple_bg: tuple[int, int, int, int] = spec["apple_bg"]

    shutil.copyfile(color_svg, ROOT / "public/favicon.svg")
    shutil.copyfile(color_svg, ROOT / "src/assets/logo.svg")
    shutil.copyfile(mono_svg, ROOT / "public/favicon-black.svg")

    render_svg_to_png(color_svg, ROOT / "public/logo.png", 512)
    shutil.copyfile(ROOT / "public/logo.png", ROOT / "doc/images/logo.png")
    render_svg_to_png(color_svg, ROOT / "public/pwa-192x192.png", 192)
    render_svg_to_png(color_svg, ROOT / "public/pwa-512x512.png", 512)
    build_apple_touch_icon(color_svg, ROOT / "public/apple-touch-icon.png", apple_bg)
    build_favicon_ico(color_svg, ROOT / "public/favicon.ico")

    print(f"Built Leon Panel brand assets from concept '{args.logo.upper()}'.")


if __name__ == "__main__":
    main()
