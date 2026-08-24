
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
LOGO_DIR = PUBLIC / "Logo"

FAVICONS = {"favicon-32.png": 32, "favicon-192.png": 192, "apple-touch-icon.png": 180}
HEADER_HEIGHT = 96

def _trim(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    box = img.getchannel("A").getbbox()
    if box is None:
        raise SystemExit(f"{path.name} is fully transparent")
    return img.crop(box)

def _square(img: Image.Image, size: int, pad_ratio: float = 0.08) -> Image.Image:
    inner = int(size * (1 - pad_ratio * 2))
    scaled = img.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2), scaled)
    return canvas

def main() -> None:
    icon = _trim(LOGO_DIR / "LogoNoText.png")
    print(f"icon cropped to {icon.width}x{icon.height}")
    for name, size in FAVICONS.items():
        _square(icon, size).save(PUBLIC / name)
        print(f"  wrote {name}")

    wordmark = _trim(LOGO_DIR / "LogoWithText.png")
    ratio = wordmark.width / wordmark.height
    out = wordmark.resize((round(HEADER_HEIGHT * ratio), HEADER_HEIGHT), Image.LANCZOS)
    out.save(LOGO_DIR / "logo-wordmark.png")
    print(f"  wrote Logo/logo-wordmark.png at {out.width}x{out.height}")

    header_icon = icon.resize(
        (round(HEADER_HEIGHT * icon.width / icon.height), HEADER_HEIGHT), Image.LANCZOS
    )
    header_icon.save(LOGO_DIR / "logo-icon.png")
    print(f"  wrote Logo/logo-icon.png at {header_icon.width}x{header_icon.height}")

if __name__ == "__main__":
    main()
