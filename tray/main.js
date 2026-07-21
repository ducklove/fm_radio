// Mad for Audio 트레이 플레이어 — Electron 메인 프로세스.
// 하나의 숨은 창(shell.html) 안 iframe에서 두 보기를 오간다:
//   튜너형     = 로컬 widget.html (미니 플레이어, 빠른 셸)
//   오디오 시스템 = 배포판 index.html (전체 하이파이 랙)
// 위젯/랙의 postMessage API(fmRadio:*)를 IPC로 중계해 트레이 메뉴와 연결하고,
// 튜너형 재생 중 창을 닫으면 곡명+재생/정지만 남긴 슬림 바로 축소한다.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { fileURLToPath, pathToFileURL } = require("url");

const HOME_URL = "https://ducklove.github.io/mad-for-audio/";
const VOLUME_PRESETS = [100, 80, 60, 40, 20, 0];
const DEBUG = !!process.env.MFA_TRAY_DEBUG;
// macOS에서는 트레이 대신 메뉴바 상주로 동작한다 — 독 숨김, 📻 메뉴바 아이템과
// 나우플레잉 텍스트 스트립(네이티브 macos/ 앱과 같은 문법), 슬림 바 대신 패널 유지.
const IS_MAC = process.platform === "darwin";

// 보기별 창 크기 (슬림 바는 곡명 + 재생/정지만)
// 전체 화면은 랙 페이지의 '⛶ 전체 화면' 버튼(HTML 풀스크린)으로만 진입한다
const SIZE = {
    tuner: { w: 540, h: 300 },
    turntable: { w: 560, h: 430 },
    system: { w: 520, h: 840 },
    bar: { w: 340, h: 58 }
};

// 트레이 메뉴에서 클릭 즉시 재생해야 하므로 사용자 제스처 요건을 끈다
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// 패키징 앱과 개발 실행(electron .)이 같은 프로필을 공유하지 않도록 분리한다.
// (기본값은 둘 다 package.json name을 따라 같은 폴더가 되어, 단일 인스턴스 락 충돌과
//  개발 중 프로필 조작이 사용자 실행분을 건드리는 사고로 이어진다)
if (app.isPackaged) {
    app.setPath("userData", path.join(app.getPath("appData"), "Mad for Audio Tray"));
}

// 개발 중에는 저장소 루트, 패키징 후에는 resources/web 아래에서 웹 자산을 찾는다
const webRoot = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..");
const shellFileUrl = pathToFileURL(path.join(__dirname, "shell.html"));
const tunerFileUrl = pathToFileURL(path.join(webRoot, "widget.html"));
const turntableFileUrl = pathToFileURL(path.join(webRoot, "turntable.html"));

function sameFile(left, right) {
    try {
        return path.resolve(fileURLToPath(left)).toLowerCase()
            === path.resolve(fileURLToPath(right)).toLowerCase();
    } catch (error) {
        return false;
    }
}

function isPathInside(root, candidate) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isLoopback(url) {
    return (url.protocol === "http:" || url.protocol === "https:")
        && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

// 개발 오버라이드는 저장소 내부 file: URL 또는 로컬 서버만 허용한다.
// 패키징 앱에서는 공식 HTTPS 배포판 외의 콘텐츠를 로드하지 않는다.
function normalizeSystemBase(raw) {
    let candidate;
    try {
        candidate = new URL(raw || HOME_URL);
    } catch (error) {
        console.warn("MFA_TRAY_HOME URL이 올바르지 않아 공식 배포판을 사용합니다.");
        return new URL(HOME_URL);
    }

    if (candidate.protocol === "https:" && candidate.origin === new URL(HOME_URL).origin
            && candidate.pathname.startsWith(new URL(HOME_URL).pathname)) {
        return candidate;
    }
    if (!app.isPackaged && isLoopback(candidate)) return candidate;
    if (!app.isPackaged && candidate.protocol === "file:" && isPathInside(webRoot, fileURLToPath(candidate))) {
        return candidate;
    }

    console.warn("허용되지 않은 MFA_TRAY_HOME을 무시하고 공식 배포판을 사용합니다.");
    return new URL(HOME_URL);
}

const systemBaseUrl = normalizeSystemBase(process.env.MFA_TRAY_HOME || HOME_URL);

function isWithinBase(candidate, base) {
    if (candidate.protocol !== base.protocol) return false;
    if (candidate.protocol === "file:") return sameFile(candidate, base);
    const prefix = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    return candidate.origin === base.origin
        && (candidate.pathname === base.pathname || candidate.pathname.startsWith(prefix));
}

function isTrustedNavigation(rawUrl) {
    try {
        const candidate = new URL(rawUrl);
        return sameFile(candidate, shellFileUrl)
            || sameFile(candidate, tunerFileUrl)
            || sameFile(candidate, turntableFileUrl)
            || isWithinBase(candidate, systemBaseUrl);
    } catch (error) {
        return false;
    }
}

function openExternalSafely(rawUrl) {
    try {
        const target = new URL(rawUrl);
        if (target.protocol !== "https:" && target.protocol !== "http:") return;
        void shell.openExternal(target.href).catch((error) => console.error("외부 링크 열기 실패:", error));
    } catch (error) {
        console.warn("올바르지 않은 외부 링크를 차단했습니다.");
    }
}

function navigationTarget(detailsOrUrl) {
    return typeof detailsOrUrl === "string" ? detailsOrUrl : detailsOrUrl && detailsOrUrl.url;
}

function requestUrl(details, webContents) {
    return (details && (details.requestingUrl || details.requestingOrigin
        || details.securityOrigin || details.embeddingOrigin))
        || (webContents && webContents.getURL())
        || "";
}

function isTrustedPermissionOrigin(rawUrl) {
    try {
        const candidate = new URL(rawUrl);
        if (candidate.protocol === "file:") return isTrustedNavigation(candidate.href);
        return candidate.origin === systemBaseUrl.origin;
    } catch (error) {
        return false;
    }
}

function isAllowedPermission(webContents, permission, details = {}, isCheck = false) {
    const trusted = isTrustedPermissionOrigin(requestUrl(details, webContents));
    if (!trusted) return false;
    if (permission === "fullscreen") return true;
    return permission === "media"
        && ((isCheck && !Array.isArray(details.mediaTypes))
            || (Array.isArray(details.mediaTypes)
                && details.mediaTypes.length > 0
                && details.mediaTypes.every((type) => type === "audio")));
}

function configureSessionSecurity() {
    const targetSession = session.defaultSession;
    targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        callback(isAllowedPermission(webContents, permission, details));
    });
    targetSession.setPermissionCheckHandler((webContents, permission, origin, details) => {
        return isAllowedPermission(webContents, permission, {
            ...details,
            requestingUrl: (details && details.requestingUrl) || origin
        }, true);
    });
    targetSession.setDevicePermissionHandler(() => false);
}

// stations.js는 브라우저용 IIFE(window.FMRadio 등록)라 가짜 window 샌드박스에서 실행해 읽는다
function loadStations() {
    const code = fs.readFileSync(path.join(webRoot, "stations.js"), "utf8");
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox);
    return sandbox.window.FMRadio;
}

const { stations, groupLabels } = loadStations();

const defaultSettings = { stationId: stations[0].id, volume: 80, autoplayOnStart: false, recordId: null, recordTrack: 0 };
let settings = { ...defaultSettings };
let saveTimer = null;

function settingsFile() {
    return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
    try {
        // 외부 편집기가 붙였을 수 있는 BOM은 걷어내고 읽는다
        const raw = fs.readFileSync(settingsFile(), "utf8").replace(/^\uFEFF/, "");
        settings = { ...defaultSettings, ...JSON.parse(raw) };
    } catch (error) {
        settings = { ...defaultSettings };
    }
    if (!stations.some((station) => station.id === settings.stationId)) {
        settings.stationId = defaultSettings.stationId;
    }
}

function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            fs.mkdirSync(app.getPath("userData"), { recursive: true });
            fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
        } catch (error) {
            console.error("설정 저장 실패:", error);
        }
    }, 300);
}

let win = null;
let tray = null;
let currentView = "tuner";   // "tuner" | "system"
let barMode = false;
let state = { playing: false, loading: false, station: null, stationName: "", volume: defaultSettings.volume };

function sendCommand(message) {
    if (win && !win.isDestroyed()) win.webContents.send("widget-command", message);
}

function createWindow() {
    win = new BrowserWindow({
        width: SIZE.tuner.w,
        height: SIZE.tuner.h,
        show: false,
        frame: false,
        // 리사이즈 불가 창은 Windows에서 (HTML) 풀스크린 전환이 무시된다 —
        // 크기는 어차피 표시할 때마다 코드가 다시 잡으므로 리사이즈 가능으로 둔다
        resizable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        backgroundColor: "#0b0a09",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            navigateOnDragDrop: false,
            safeDialogs: true,
            devTools: !app.isPackaged || DEBUG,
            // 창이 숨겨져도(슬림 바·백그라운드) 재생·재시도 타이머가 늦어지지 않게 한다
            backgroundThrottling: false
        }
    });

    // 튜너형: 로컬 widget.html
    const tunerUrl = new URL(tunerFileUrl.href);
    tunerUrl.searchParams.set("skin", "tuner");
    tunerUrl.searchParams.set("station", settings.stationId);
    tunerUrl.searchParams.set("chrome", "tray");
    if (settings.autoplayOnStart) tunerUrl.searchParams.set("autoplay", "1");

    // 턴테이블형: 로컬 turntable.html — 마지막으로 듣던 음반·트랙으로 부팅
    const turntableUrl = new URL(turntableFileUrl.href);
    turntableUrl.searchParams.set("chrome", "tray");
    if (settings.recordId) {
        turntableUrl.searchParams.set("record", settings.recordId);
        turntableUrl.searchParams.set("track", String(settings.recordTrack || 0));
    }

    // 오디오 시스템: 배포판 전체 랙(온라인) — macOS 앱과 동일하게 배포판을 로드
    const systemUrl = new URL(systemBaseUrl.href);
    systemUrl.searchParams.set("view", "rack");
    systemUrl.searchParams.set("chrome", "tray");

    // 메뉴바 앱은 어느 작업공간(Space)에서 아이콘을 눌러도 그 자리에 패널이 떠야 한다.
    // skipTransformProcessType: dock.hide()로 만든 LSUIElement 상태를 되돌리지 않는다.
    if (IS_MAC) {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    }

    win.loadFile(path.join(__dirname, "shell.html"), {
        query: { tuner: tunerUrl.href, turntable: turntableUrl.href, system: systemUrl.href }
    });

    // 위젯/랙 밖의 탐색과 새 창은 셸 안에서 실행하지 않는다.
    win.webContents.setWindowOpenHandler(({ url }) => {
        openExternalSafely(url);
        return { action: "deny" };
    });
    win.webContents.on("will-attach-webview", (event) => event.preventDefault());
    win.webContents.on("will-navigate", (event, details) => {
        const url = navigationTarget(details);
        if (isTrustedNavigation(url)) return;
        event.preventDefault();
        if (url) openExternalSafely(url);
    });
    win.webContents.on("will-frame-navigate", (event, details) => {
        const url = navigationTarget(details);
        if (url && isTrustedNavigation(url)) return;
        event.preventDefault();
        if (url) openExternalSafely(url);
    });
    win.webContents.on("will-redirect", (event, details) => {
        const url = navigationTarget(details);
        if (isTrustedNavigation(url)) return;
        event.preventDefault();
        if (url) openExternalSafely(url);
    });

    win.on("blur", () => {
        if (barMode || !win.isVisible()) return;
        // macOS: 네이티브 macos/ 앱과 같은 플로팅 패널 — 포커스를 잃어도 그대로 떠서
        // 미터·랙을 계속 볼 수 있다. 닫기는 메뉴바 아이콘 토글 또는 ESC.
        if (IS_MAC) return;
        // Windows: 재생 중이면 바로 숨기지 않고 슬림 바로 축소한다
        if (state.playing) enterBarMode();
        else hideWindow();
    });

    win.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown" || input.key !== "Escape") return;
        event.preventDefault();
        // 랙 '⛶ 전체 화면' 중이면 ESC는 창 보기로만 복귀 (닫기·슬림 바 아님)
        if (win.isFullScreen()) {
            applyViewBounds();
            return;
        }
        if (IS_MAC || barMode || !state.playing) hideWindow();
        else enterBarMode();
    });

    // 랙의 '⛶ 전체 화면' 해제(버튼 재클릭·exitFullscreen)로 풀스크린이 풀리면
    // 창 크기 보기로 복귀시킨다 — Chromium의 자동 복원 크기가 어긋날 수 있어 직접 맞춘다.
    // 의도된 전환(슬림 바·숨김·보기 전환)은 이 시점에 상태가 이미 바뀌어 있어 걸러진다.
    win.on("leave-full-screen", () => {
        setTimeout(() => {
            if (win.isDestroyed() || barMode || !win.isVisible()) return;
            applyBounds(placement(SIZE[currentView]));
        }, 120);
    });

    if (DEBUG) {
        win.webContents.on("console-message", (_event, _level, message) => {
            console.log("[shell]", message);
        });
    }
}

// 트레이 아이콘 근처에 지정 크기로 놓을 좌표·높이를 계산한다 (작업표시줄 위치 대응)
function placement(size) {
    const trayBounds = tray.getBounds();
    const area = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }).workArea;
    const height = Math.min(size.h, area.height - 24);

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - size.w / 2);
    x = Math.max(area.x + 8, Math.min(x, area.x + area.width - size.w - 8));

    const trayOnTop = trayBounds.y < area.y + area.height / 2;
    let y = trayOnTop ? area.y + 12 : area.y + area.height - height - 12;
    y = Math.max(area.y + 8, y);

    return { x, y, width: size.w, height };
}

// 슬림 바 자리: 하단 작업표시줄 스트립 안(트레이 아이콘 왼쪽)에 도킹한다.
// 상단/세로 작업표시줄·자동 숨김 등 도킹할 자리가 없으면 트레이 근처 플로팅으로 폴백.
function barPlacement() {
    const trayBounds = tray.getBounds();
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
    const full = display.bounds;
    const work = display.workArea;
    const taskbarH = (full.y + full.height) - (work.y + work.height);

    if (taskbarH >= 32 && work.width === full.width) {
        const h = Math.min(SIZE.bar.h, taskbarH - 8);
        let x = trayBounds.x - SIZE.bar.w - 8;   // 알림 영역 바로 왼쪽
        x = Math.max(work.x + 8, Math.min(x, full.x + full.width - SIZE.bar.w - 8));
        const y = work.y + work.height + Math.round((taskbarH - h) / 2);
        return { x, y, width: SIZE.bar.w, height: h };
    }
    return placement(SIZE.bar);
}

function applyBounds(bounds) {
    win.setBounds(bounds);
}

// 풀스크린을 빠져나온 '다음에' 배치를 적용한다 — 해제 직후 Chromium이 이전 창 크기를
// 복원하며 setBounds를 덮어쓰므로, 이벤트 후 한 박자 늦춰 적용한다
function exitFullScreenThen(fn) {
    if (!win.isFullScreen()) return fn();
    win.once("leave-full-screen", () => setTimeout(fn, 80));
    win.setFullScreen(false);
}

// 현재 보기에 맞는 '펼친' 배치 — 두 보기 모두 트레이 옆 창.
// 랙의 '⛶ 전체 화면'(HTML 풀스크린) 상태였다면 먼저 빠져나온다.
function applyViewBounds() {
    exitFullScreenThen(() => applyBounds(placement(SIZE[currentView])));
}

function showFull() {
    barMode = false;
    sendCommand({ trayMode: "full" });
    win.setAlwaysOnTop(true);   // 일반 최상위 레벨로 복귀
    applyViewBounds();
    win.show();
    win.focus();
    refreshTray();
}

function enterBarMode() {
    barMode = true;
    sendCommand({ trayMode: "bar" });
    exitFullScreenThen(() => {
        // 작업표시줄은 자체가 최상위 창이라, 그 위에 그리려면 레벨을 한 단계 올린다
        win.setAlwaysOnTop(true, "screen-saver");
        applyBounds(barPlacement());   // 창은 계속 떠 있고(오디오 유지) 슬림 바로 줄어든다
    });
    refreshTray();
}

function hideWindow() {
    if (win.isFullScreen()) win.setFullScreen(false);
    win.hide();
}

function toggleWindow() {
    if (!win.isVisible()) return showFull();
    if (barMode) return showFull();
    if (!IS_MAC && state.playing) return enterBarMode();
    hideWindow();
}

// 개발 모드에서는 electron.exe가 실행 파일이므로 앱 경로를 인자로 넘겨야 한다
function loginItemOptions() {
    return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function stationMenuItems() {
    const items = [];
    for (const group of Object.keys(groupLabels)) {
        const groupStations = stations.filter((station) => station.group === group);
        if (!groupStations.length) continue;
        if (items.length) items.push({ type: "separator" });
        for (const station of groupStations) {
            items.push({
                label: `${station.name}  ${station.freq.toFixed(1)}`,
                // radio 타입은 separator마다 그룹이 갈려 그룹별로 체크가 하나씩 남는다 —
                // checkbox로 두고 체크 상태는 우리가 관리하며 클릭 즉시 메뉴를 다시 그린다
                type: "checkbox",
                checked: station.id === (state.station || settings.stationId),
                click: () => {
                    settings.stationId = station.id;
                    state.station = station.id;
                    state.stationName = station.name;
                    saveSettings();
                    sendCommand({ type: "fmRadio:setStation", station: station.id, autoplay: true });
                    refreshTray();
                }
            });
        }
    }
    return items;
}

function buildMenu() {
    return Menu.buildFromTemplate([
        {
            label: state.loading ? "연결 중…" : state.playing ? "일시정지" : "재생",
            enabled: !state.loading,
            click: () => sendCommand({ type: state.playing ? "fmRadio:pause" : "fmRadio:play" })
        },
        { type: "separator" },
        {
            label: "보기",
            submenu: [
                { label: "튜너형", type: "radio", checked: currentView === "tuner", click: () => sendCommand({ setView: "tuner" }) },
                { label: "턴테이블형", type: "radio", checked: currentView === "turntable", click: () => sendCommand({ setView: "turntable" }) },
                { label: "오디오 시스템", type: "radio", checked: currentView === "system", click: () => sendCommand({ setView: "system" }) }
            ]
        },
        { type: "separator" },
        ...stationMenuItems(),
        { type: "separator" },
        {
            label: "볼륨",
            submenu: VOLUME_PRESETS.map((value) => ({
                label: value === 0 ? "음소거" : `${value}%`,
                type: "radio",
                checked: state.volume === value,
                click: () => {
                    state.volume = value;
                    settings.volume = value;
                    saveSettings();
                    sendCommand({ type: "fmRadio:setVolume", value });
                    refreshTray();
                }
            }))
        },
        { type: "separator" },
        { label: "미니 플레이어 열기/닫기", click: toggleWindow },
        {
            label: "로그인 시 자동 시작",
            type: "checkbox",
            checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
            click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked })
        },
        {
            label: "시작할 때 바로 재생",
            type: "checkbox",
            checked: settings.autoplayOnStart,
            click: (item) => {
                settings.autoplayOnStart = item.checked;
                saveSettings();
            }
        },
        { type: "separator" },
        { label: "종료", click: () => app.quit() }
    ]);
}

function refreshTray() {
    if (!tray) return;
    const fallback = stations.find((station) => station.id === settings.stationId);
    const stationName = state.stationName || (fallback ? fallback.name : "");
    const status = state.loading ? "연결 중…" : state.playing ? "재생 중" : "정지";
    const viewLabel = currentView === "system" ? "오디오 시스템" : currentView === "turntable" ? "턴테이블" : "튜너";
    tray.setToolTip(`Mad for Audio · ${viewLabel} — ${stationName} ${status}`);
    if (IS_MAC) {
        // 메뉴바 나우플레잉 스트립 — 재생 중에만 곡명(채널명)을 붙이고 평소엔 📻만 남긴다
        const short = stationName.length > 18 ? stationName.slice(0, 17) + "…" : stationName;
        tray.setTitle(state.loading ? "📻 …" : state.playing ? `📻 ${short}` : "📻");
    }
    // macOS에서 메뉴를 Tray에 상시 연결하면 좌클릭으로 패널을 열 때 네이티브 메뉴까지
    // 함께 표시될 수 있다. 맥 메뉴는 아래 right-click 핸들러에서만 팝업한다.
    if (!IS_MAC) tray.setContextMenu(buildMenu());
}

function createTray() {
    if (IS_MAC) {
        // macOS: 아이콘 이미지 대신 📻 텍스트 메뉴바 아이템 — 네이티브 macos/ 앱과 같은 얼굴.
        // 나우플레잉 스트립은 refreshTray()의 setTitle이 담당한다.
        tray = new Tray(nativeImage.createEmpty());
    } else {
        const icon = nativeImage
            .createFromPath(path.join(webRoot, "icons", "icon-192.png"))
            .resize({ width: 16, height: 16 });
        tray = new Tray(icon);
    }
    tray.on("click", toggleWindow);
    if (IS_MAC) {
        tray.on("right-click", () => tray.popUpContextMenu(buildMenu()));
    }
    refreshTray();
}

function isTrustedIpcSender(event) {
    return !!win
        && !win.isDestroyed()
        && event.sender === win.webContents
        && event.senderFrame === win.webContents.mainFrame;
}

// 셸이 보기를 바꾸면(사용자가 '오디오 시스템'/'미니 플레이어'를 누름) 창 크기를 맞춘다
ipcMain.on("widget-view", (event, view) => {
    if (!isTrustedIpcSender(event) || !["tuner", "turntable", "system"].includes(view)) return;
    currentView = view;
    if (win.isVisible() && !barMode) applyViewBounds();
    refreshTray();
});

// 턴테이블 보기용 음반 카탈로그 — file:// 렌더러는 fetch가 막혀 메인이 읽어 준다
ipcMain.handle("records-get", (event) => {
    if (!isTrustedIpcSender(event)) return null;
    try {
        const raw = fs.readFileSync(path.join(webRoot, "records.json"), "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        console.error("records.json 읽기 실패:", error);
        return null;
    }
});

// 슬림 바에서 '펼치기'
ipcMain.on("widget-request-full", (event) => {
    if (isTrustedIpcSender(event)) showFull();
});

ipcMain.on("widget-state", (event, message) => {
    if (!isTrustedIpcSender(event)
            || !message
            || !["fmRadio:ready", "fmRadio:state", "fmRadio:ended"].includes(message.type)) return;
    if (DEBUG) console.log("[state]", JSON.stringify(message));

    if (message.type === "fmRadio:ready") {
        // 튜너 위젯이 뜨면 저장해 둔 볼륨을 복원한다 (채널은 URL 파라미터로 이미 전달)
        sendCommand({ type: "fmRadio:setVolume", value: settings.volume });
        return;
    }

    const volume = Number(message.volume);
    state = {
        playing: !!message.playing,
        loading: !!message.loading,
        station: typeof message.station === "string" && stations.some((item) => item.id === message.station)
            ? message.station
            : null,
        stationName: typeof message.stationName === "string" ? message.stationName.slice(0, 160) : "",
        volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : state.volume
    };

    if (message.mode === "radio" && message.station && message.station !== settings.stationId) {
        settings.stationId = message.station;
        saveSettings();
    }
    // 턴테이블 보기: 마지막으로 듣던 음반·트랙을 기억해 다음 부팅에 복원한다
    if (message.mode === "media" && typeof message.record === "string" && message.record) {
        const track = Number(message.track);
        const nextTrack = Number.isFinite(track) ? Math.max(0, Math.floor(track)) : 0;
        if (message.record !== settings.recordId || nextTrack !== settings.recordTrack) {
            settings.recordId = message.record.slice(0, 120);
            settings.recordTrack = nextTrack;
            saveSettings();
        }
    }
    if (Number.isFinite(volume) && state.volume !== settings.volume) {
        settings.volume = state.volume;
        saveSettings();
    }

    refreshTray();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (win && tray) showFull();
    });

    app.whenReady().then(async () => {
        if (IS_MAC) app.dock.hide();                        // 메뉴바 전용 — 독·Cmd+Tab에서 제외
        else app.setAppUserModelId("com.madforaudio.tray"); // Windows 알림·작업표시줄 식별자
        loadSettings();
        configureSessionSecurity();
        // 시작할 때 웹 캐시·서비스워커 저장소를 비운다 — 온라인 전용이라 캐시 이득이 없고,
        // 손상되거나 낡은 SW 캐시가 랙 페이지 렌더링을 깨뜨리는 일을 원천 차단한다.
        // (설정·즐겨찾기(localStorage)와 녹음(IndexedDB)은 지우지 않는다)
        try {
            await session.defaultSession.clearCache();
            await session.defaultSession.clearStorageData({ storages: ["serviceworkers", "cachestorage"] });
        } catch (error) {
            console.error("캐시 정리 실패:", error);
        }
        createWindow();
        createTray();
    });
}

// 트레이 상주 앱: 창이 모두 닫혀도 종료하지 않는다
app.on("window-all-closed", () => {});
