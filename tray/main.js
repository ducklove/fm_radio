// Mad for Audio 트레이 플레이어 — Electron 메인 프로세스.
// 하나의 숨은 창(shell.html) 안 iframe에서 두 보기를 오간다:
//   튜너형     = 로컬 widget.html (미니 플레이어, 빠른 셸)
//   오디오 시스템 = 배포판 index.html (전체 하이파이 랙)
// 위젯/랙의 postMessage API(fmRadio:*)를 IPC로 중계해 트레이 메뉴와 연결하고,
// 튜너형 재생 중 창을 닫으면 곡명+재생/정지만 남긴 슬림 바로 축소한다.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const HOME_URL = "https://ducklove.github.io/mad-for-audio/";
// 오디오 시스템 보기의 로드 대상 — 개발 중 로컬 index.html 검증용 오버라이드 (예: file:///.../index.html)
const SYSTEM_BASE = process.env.MFA_TRAY_HOME || HOME_URL;
const VOLUME_PRESETS = [100, 80, 60, 40, 20, 0];
const DEBUG = !!process.env.MFA_TRAY_DEBUG;

// 보기별 창 크기 (슬림 바는 곡명 + 재생/정지만)
const SIZE = {
    tuner: { w: 540, h: 300 },
    system: { w: 520, h: 840 },
    bar: { w: 340, h: 58 }
};

// 트레이 메뉴에서 클릭 즉시 재생해야 하므로 사용자 제스처 요건을 끈다
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// 개발 중에는 저장소 루트, 패키징 후에는 resources/web 아래에서 웹 자산을 찾는다
const webRoot = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..");

// stations.js는 브라우저용 IIFE(window.FMRadio 등록)라 가짜 window 샌드박스에서 실행해 읽는다
function loadStations() {
    const code = fs.readFileSync(path.join(webRoot, "stations.js"), "utf8");
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox);
    return sandbox.window.FMRadio;
}

const { stations, groupLabels } = loadStations();

const defaultSettings = { stationId: stations[0].id, volume: 80, autoplayOnStart: false };
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
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        backgroundColor: "#0b0a09",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            // 방송사 API·HLS 세그먼트의 CORS 헤더가 제각각이라 로컬 신뢰 콘텐츠에 한해 끈다
            webSecurity: false,
            // 창이 숨겨져도(슬림 바·백그라운드) 재생·재시도 타이머가 늦어지지 않게 한다
            backgroundThrottling: false
        }
    });

    // 튜너형: 로컬 widget.html
    const tunerUrl = pathToFileURL(path.join(webRoot, "widget.html"));
    tunerUrl.searchParams.set("skin", "tuner");
    tunerUrl.searchParams.set("station", settings.stationId);
    tunerUrl.searchParams.set("chrome", "tray");
    if (settings.autoplayOnStart) tunerUrl.searchParams.set("autoplay", "1");

    // 오디오 시스템: 배포판 전체 랙(온라인) — macOS 앱과 동일하게 배포판을 로드
    const systemUrl = `${SYSTEM_BASE}?view=rack&chrome=tray`;

    win.loadFile(path.join(__dirname, "shell.html"), {
        query: { tuner: tunerUrl.href, system: systemUrl }
    });

    // 위젯/랙 밖으로 나가는 새 창 요청(window.open 등)은 기본 브라우저로 돌린다
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url.startsWith("file:") ? HOME_URL : url);
        return { action: "deny" };
    });

    win.on("blur", () => {
        if (barMode || !win.isVisible()) return;
        // 재생 중이면(어느 보기든) 바로 숨기지 않고 슬림 바로 축소한다
        if (state.playing) enterBarMode();
        else win.hide();
    });

    win.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown" || input.key !== "Escape") return;
        event.preventDefault();
        if (barMode) win.hide();
        else if (state.playing) enterBarMode();
        else win.hide();
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

// resizable:false 창도 프로그램에서는 크기를 바꿀 수 있도록 잠깐 풀었다 되돌린다
function applyBounds(bounds) {
    win.setResizable(true);
    win.setBounds(bounds);
    win.setResizable(false);
}

function showFull() {
    barMode = false;
    sendCommand({ trayMode: "full" });
    win.setAlwaysOnTop(true);   // 일반 최상위 레벨로 복귀
    applyBounds(placement(SIZE[currentView]));
    win.show();
    win.focus();
    refreshTray();
}

function enterBarMode() {
    barMode = true;
    sendCommand({ trayMode: "bar" });
    // 작업표시줄은 자체가 최상위 창이라, 그 위에 그리려면 레벨을 한 단계 올린다
    win.setAlwaysOnTop(true, "screen-saver");
    applyBounds(barPlacement());   // 창은 계속 떠 있고(오디오 유지) 슬림 바로 줄어든다
    refreshTray();
}

function toggleWindow() {
    if (!win.isVisible()) return showFull();
    if (barMode) return showFull();
    if (state.playing) enterBarMode();
    else win.hide();
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
    const viewLabel = currentView === "system" ? "오디오 시스템" : "튜너";
    tray.setToolTip(`Mad for Audio · ${viewLabel} — ${stationName} ${status}`);
    tray.setContextMenu(buildMenu());
}

function createTray() {
    const icon = nativeImage
        .createFromPath(path.join(webRoot, "icons", "icon-192.png"))
        .resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.on("click", toggleWindow);
    refreshTray();
}

// 셸이 보기를 바꾸면(사용자가 '오디오 시스템'/'미니 플레이어'를 누름) 창 크기를 맞춘다
ipcMain.on("widget-view", (_event, view) => {
    currentView = view === "system" ? "system" : "tuner";
    if (win.isVisible() && !barMode) applyBounds(placement(SIZE[currentView]));
    refreshTray();
});

// 슬림 바에서 '펼치기'
ipcMain.on("widget-request-full", () => showFull());

ipcMain.on("widget-state", (_event, message) => {
    if (!message || typeof message.type !== "string") return;
    if (DEBUG) console.log("[state]", JSON.stringify(message));

    if (message.type === "fmRadio:ready") {
        // 튜너 위젯이 뜨면 저장해 둔 볼륨을 복원한다 (채널은 URL 파라미터로 이미 전달)
        sendCommand({ type: "fmRadio:setVolume", value: settings.volume });
        return;
    }

    state = {
        playing: !!message.playing,
        loading: !!message.loading,
        station: message.station || null,
        stationName: message.stationName || "",
        volume: typeof message.volume === "number" ? message.volume : state.volume
    };

    if (message.mode === "radio" && message.station && message.station !== settings.stationId) {
        settings.stationId = message.station;
        saveSettings();
    }
    if (typeof message.volume === "number" && message.volume !== settings.volume) {
        settings.volume = message.volume;
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

    app.whenReady().then(() => {
        app.setAppUserModelId("com.madforaudio.tray");
        loadSettings();
        createWindow();
        createTray();
    });
}

// 트레이 상주 앱: 창이 모두 닫혀도 종료하지 않는다
app.on("window-all-closed", () => {});
