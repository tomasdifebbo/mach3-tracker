from pathlib import Path
from PIL import Image, ImageDraw

from config import ICON_PATH


def ensure_app_icon() -> Path:
    if ICON_PATH.exists():
        return ICON_PATH

    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([6, 6, 122, 122], radius=26, fill=(18, 24, 34, 255), outline=(245, 158, 11, 255), width=5)
    draw.rounded_rectangle([24, 30, 66, 54], radius=8, fill=(217, 119, 6, 255))
    draw.rounded_rectangle([24, 42, 104, 96], radius=10, fill=(245, 158, 11, 255))
    draw.rounded_rectangle([30, 50, 98, 60], radius=4, fill=(254, 243, 199, 210))
    draw.ellipse([72, 66, 114, 108], fill=(16, 185, 129, 255), outline=(18, 24, 34, 255), width=4)
    draw.line([(83, 88), (91, 96), (104, 80)], fill=(255, 255, 255, 255), width=5, joint="curve")

    img.save(ICON_PATH, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)])
    return ICON_PATH
