from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).parent / "wallet_assets"
TERRA, SAND, GOLD = (217, 83, 41), (251, 248, 243), (243, 167, 46)


def mark(size: int, rounded: bool = True) -> Image.Image:
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S // 4 if rounded else 0, fill=TERRA)
    u = S / 64
    d.rounded_rectangle([14 * u, 18 * u, 50 * u, 46 * u], radius=4 * u, fill=SAND)
    d.ellipse([9 * u, 27 * u, 19 * u, 37 * u], fill=TERRA)
    d.ellipse([45 * u, 27 * u, 55 * u, 37 * u], fill=TERRA)
    d.ellipse([25.5 * u, 27.5 * u, 32.5 * u, 34.5 * u], fill=TERRA)
    d.ellipse([31.5 * u, 27.5 * u, 38.5 * u, 34.5 * u], fill=TERRA)
    d.polygon([(26 * u, 33 * u), (38 * u, 33 * u), (32 * u, 40.5 * u)], fill=TERRA)
    d.ellipse([41.6 * u, 17.6 * u, 46.4 * u, 22.4 * u], fill=GOLD)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, px in (("icon.png", 29), ("icon@2x.png", 58), ("icon@3x.png", 87), ("logo.png", 50), ("logo@2x.png", 100), ("logo@3x.png", 150)):
        mark(px).save(OUT / name)
    mark(660).save(OUT / "google_logo.png")
    print("ok")
