
import urllib.request
from pathlib import Path

from PIL import Image

BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images"
TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"]
OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "rank-emblems"
MARGIN = 20

def _fetch(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    tmp = OUT_DIR / "_tmp.png"
    tmp.write_bytes(data)
    img = Image.open(tmp).convert("RGBA")
    tmp.unlink()
    return img

def _crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - MARGIN)
    top = max(0, top - MARGIN)
    right = min(img.width, right + MARGIN)
    bottom = min(img.height, bottom + MARGIN)
    return img.crop((left, top, right, bottom))

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for tier in TIERS:
        img = _fetch(f"{BASE}/ranked-emblem/emblem-{tier}.png")
        cropped = _crop_to_content(img)
        cropped.save(OUT_DIR / f"{tier}.png")
        print(f"{tier}: {img.size} -> {cropped.size}")

    img = _fetch(f"{BASE}/unranked-emblem.png")
    cropped = _crop_to_content(img)
    cropped.save(OUT_DIR / "unranked.png")
    print(f"unranked: {img.size} -> {cropped.size}")

if __name__ == "__main__":
    main()
