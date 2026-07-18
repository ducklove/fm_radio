# side-speaker.jpg -> side-speaker.webp (배경 알파 제거)
# 배경은 테두리에 연결된 근흑(<=TOL) 영역만 — 스피커 내부의 어두운 부분은 보존된다.
from PIL import Image, ImageFilter
from collections import deque
import sys

SRC = r"D:\Work\mad-for-audio\images\side-speaker.jpg"
DST = r"D:\Work\mad-for-audio\images\side-speaker.webp"
TOL = 8

im = Image.open(SRC).convert("RGB")
w, h = im.size
px = im.load()

def dark(x, y):
    r, g, b = px[x, y]
    return max(r, g, b) <= TOL

# BFS: 테두리의 어두운 픽셀에서 시작해 연결된 배경 영역을 찾는다
bg = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if dark(x, y) and not bg[y * w + x]:
            bg[y * w + x] = 1
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if dark(x, y) and not bg[y * w + x]:
            bg[y * w + x] = 1
            q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
        if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and dark(nx, ny):
            bg[ny * w + nx] = 1
            q.append((nx, ny))

bg_count = sum(bg)
alpha = Image.frombytes("L", (w, h), bytes(255 - 255 * v for v in bg))
# 경계 페더 1px — 컷아웃 티를 없앤다
alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))

out = im.convert("RGBA")
out.putalpha(alpha)
out.save(DST, "WEBP", quality=92, method=6)

import os
print("bg pixels: %d (%.1f%%)" % (bg_count, bg_count / (w * h) * 100))
print("saved:", DST, os.path.getsize(DST), "bytes")
