from PIL import Image
from pathlib import Path

OUT = Path(__file__).parent / "wallet_assets"
MARK = Path(__file__).parent.parent / "frontend" / "public" / "brand" / "mark-512.png"


def square(size: int, bg=None) -> Image.Image:
    src = Image.open(MARK).convert("RGBA")
    canvas = Image.new("RGBA", src.size, bg or (0, 0, 0, 0))
    canvas.paste(src, (0, 0), src)
    return canvas.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, px in (("icon.png", 29), ("icon@2x.png", 58), ("icon@3x.png", 87), ("logo.png", 50), ("logo@2x.png", 100), ("logo@3x.png", 150)):
        square(px).save(OUT / name)
    square(660, (255, 209, 102, 255)).save(OUT / "google_logo.png")
    print("ok")
