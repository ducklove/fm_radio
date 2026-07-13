#!/bin/bash
# Mad for Audio 메뉴바 앱 빌드 — Xcode 프로젝트 없이 swiftc로 .app 번들을 만든다.
set -euo pipefail
cd "$(dirname "$0")"

APP="Mad for Audio.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# 아이콘: PWA 아이콘(512px)을 icns로 변환
ICON_SRC="../icons/icon-512.png"
if [ -f "$ICON_SRC" ]; then
    ICONSET="$(mktemp -d)/AppIcon.iconset"
    mkdir -p "$ICONSET"
    for s in 16 32 128 256 512; do
        sips -z $s $s "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
        d=$((s * 2))
        sips -z $d $d "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
fi

cp Info.plist "$APP/Contents/"
xcrun swiftc -O -parse-as-library main.swift -o "$APP/Contents/MacOS/MadForAudio" \
    -framework Cocoa -framework WebKit

# 로컬 임시 서명 — SMAppService(로그인 시 자동 시작)에 필요
codesign --force --sign - "$APP" 2>/dev/null || true

echo "빌드 완료: $(pwd)/$APP"
echo "실행:      open \"$(pwd)/$APP\""
echo "설치(권장): /Applications로 복사 후 실행"
