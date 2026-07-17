from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/mfa-svg-eval")
GROUPS = {
    "tuner": (3, ["t2", "mr78", "m10b"]),
    "eq": (2, ["ge5", "se9"]),
    "amp": (2, ["mc2105", "el34", "300b", "e303", "ma2375"]),
    "deck": (2, ["dragon", "b215", "tcd3014", "ctf1250", "w990"]),
    "turntable": (2, ["sl1200", "td124", "g301", "lp12"]),
}

try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
except OSError:
    FONT = ImageFont.load_default()


for group, (columns, ids) in GROUPS.items():
    thumb_w = 700 if columns == 4 else 900
    gutter = 24
    label_h = 52
    cells = []
    for model_id in ids:
        src = Image.open(ROOT / f"{group}-{model_id}.png").convert("RGB")
        h = round(src.height * thumb_w / src.width)
        thumb = src.resize((thumb_w, h), Image.Resampling.LANCZOS)
        cells.append((model_id, thumb))
    rows = []
    for start in range(0, len(cells), columns):
        row = cells[start:start + columns]
        rows.append((row, max(im.height for _, im in row) + label_h))
    sheet_w = columns * thumb_w + (columns + 1) * gutter
    sheet_h = sum(height for _, height in rows) + (len(rows) + 1) * gutter
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#14110f")
    draw = ImageDraw.Draw(sheet)
    y = gutter
    for row, row_h in rows:
        for col, (model_id, thumb) in enumerate(row):
            x = gutter + col * (thumb_w + gutter)
            draw.text((x + 10, y + 8), f"{group.upper()} / {model_id}", fill="#f3dfc6", font=FONT)
            sheet.paste(thumb, (x, y + label_h))
        y += row_h + gutter
    sheet.save(ROOT / f"contact-{group}.jpg", quality=94, subsampling=0)
    print(group, sheet.size)
