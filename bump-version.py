#!/usr/bin/env python3
# 배포 버전 범프 — sw.js 캐시 이름과 index.html 자산 쿼리(?v=N)를 함께 올린다.
# 자산 URL이 바뀌므로 WKWebView HTTP 캐시·GitHub Pages CDN(max-age 600)·SW 캐시를
# 전부 우회해 새 코드가 즉시 도달한다. 배포 전에 실행: python3 bump-version.py
import re
import pathlib

root = pathlib.Path(__file__).parent

sw = (root / "sw.js").read_text(encoding="utf-8")
n = int(re.search(r"fm-radio-v(\d+)", sw).group(1)) + 1
sw = re.sub(r"fm-radio-v\d+", f"fm-radio-v{n}", sw)

ASSETS = [
    "styles.css", "stations.js", "player-core.js", "native-hls-capture.js", "store.js", "schedule.js",
    "skins.js", "component-skins.js", "model-registry.js", "animation-scheduler.js",
    "engine.js", "deck.js", "records.json", "bootstrap.js", "ui-controls.js", "app.js",
]

idx = (root / "index.html").read_text(encoding="utf-8")
for a in ASSETS:
    idx = re.sub(re.escape(a) + r"(\?v=\d+)?\"", f"{a}?v={n}\"", idx)
(root / "index.html").write_text(idx, encoding="utf-8")

# SW 프리캐시도 버전 URL로 (오프라인 첫 화면 보장)
def core_repl(m):
    name = m.group(1)
    return f'"{name}?v={n}"' if name in ASSETS else m.group(0)
sw = re.sub(r'"([a-z\-]+\.(?:js|css|json))(?:\?v=\d+)?"', core_repl, sw)
(root / "sw.js").write_text(sw, encoding="utf-8")

print(f"v{n}")
