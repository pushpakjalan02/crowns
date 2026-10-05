"""
Generates the PNG app icons the PWA manifest needs (Android/Chrome require PNGs).

Run from the project root:   py tools\make_icons.py
Needs Pillow (PIL). Check with:   py -c "import PIL; print(PIL.__version__)"
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
BG = (91, 60, 196)       # purple, same as theme-color in index.html
FG = (255, 213, 79)      # gold crown
SCALE = 4                # draw big, then shrink = smooth edges (anti-aliasing)


def crown(draw, size, inset):
    """Crown polygon on a 24x24 design grid, mapped into the square with an inset."""
    pts = [(3, 8), (7.5, 12), (12, 5), (16.5, 12), (21, 8), (19, 19), (5, 19)]
    span = size - 2 * inset
    mapped = [(inset + x / 24 * span, inset + (y + 0.5) / 24 * span) for x, y in pts]
    draw.polygon(mapped, fill=FG)
    for x, y in [(3, 8), (12, 5), (21, 8)]:  # little balls on the crown tips
        cx, cy, r = inset + x / 24 * span, inset + (y + 0.5) / 24 * span, span * 0.045
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FG)


def make(name, size, rounded, inset_ratio):
    big = size * SCALE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=BG)
    else:  # maskable / apple icons: full square, the OS applies its own mask
        d.rectangle([0, 0, big, big], fill=BG)
    crown(d, big, big * inset_ratio)
    img.resize((size, size), Image.LANCZOS).save(OUT / name)
    print("wrote", OUT / name)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    make("icon-192.png", 192, True, 0.14)
    make("icon-512.png", 512, True, 0.14)
    make("maskable-512.png", 512, False, 0.24)  # extra padding: safe zone for round masks
    make("apple-touch-icon.png", 180, False, 0.16)
