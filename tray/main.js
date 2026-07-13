// Mad for Audio 트레이 플레이어 — Electron 메인 프로세스.
// 재생은 기존 widget.html(미니 플레이어)을 숨은 창의 iframe으로 띄워 그대로 쓰고,
// 트레이 메뉴 ↔ 위젯 사이는 문서화된 postMessage API(fmRadio:*)를 IPC로 중계한다.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const WIN_WIDTH = 540;
const WIN_HEIGHT = 280;
const HOME_URL = "https://ducklove.github.io/mad-for-audio/";
const VOLUME_PRESETS = [100, 80, 60, 40, 20, 0];
const DEBUG = !!process.env.MFA_TRAY_DEBUG;

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
let state = { playing: false, loading: false, station: null, stationName: "", volume: defaultSettings.volume };

function sendCommand(message) {
    if (win && !win.isDestroyed()) win.webContents.send("widget-command", message);
}

function createWindow() {
    win = new BrowserWindow({
        width: WIN_WIDTH,
        height: WIN_HEIGHT,
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
            // 창이 숨겨져도 재시도 타이머 등이 늦어지지 않게 한다
            backgroundThrottling: false
        }
    });

    const widgetUrl = pathToFileURL(path.join(webRoot, "widget.html"));
    widgetUrl.searchParams.set("skin", "tuner");
    widgetUrl.searchParams.set("station", settings.stationId);
    if (settings.autoplayOnStart) widgetUrl.searchParams.set("autoplay", "1");

    win.loadFile(path.join(__dirname, "shell.html"), { query: { widget: widgetUrl.href } });

    // '전체 페이지 ↗' 등 새 창 요청은 기본 브라우저로 돌린다 (로컬 index.html은 배포 페이지로)
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url.startsWith("file:") ? HOME_URL : url);
        return { action: "deny" };
    });

    win.on("blur", () => {
        if (win.isVisible()) win.hide();
    });

    win.webContents.on("before-input-event", (event, input) => {
        if (input.type === "keyDown" && input.key === "Escape") {
            event.preventDefault();
            win.hide();
        }
    });

    if (DEBUG) {
        win.webContents.on("console-message", (_event, _level, message) => {
            console.log("[widget]", message);
        });
    }
}

function showWindow() {
    const trayBounds = tray.getBounds();
    const area = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }).workArea;

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - WIN_WIDTH / 2);
    x = Math.max(area.x + 8, Math.min(x, area.x + area.width - WIN_WIDTH - 8));
    // 작업표시줄이 위쪽이면 화면 상단에, 아니면 하단(트레이 위)에 붙인다
    const trayOnTop = trayBounds.y < area.y + area.height / 2;
    const y = trayOnTop ? area.y + 12 : area.y + area.height - WIN_HEIGHT - 12;

    win.setPosition(x, y);
    win.show();
    win.focus();
}

function toggleWindow() {
    if (win.isVisible()) win.hide();
    else showWindow();
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
                type: "radio",
                checked: station.id === (state.station || settings.stationId),
                click: () => {
                    settings.stationId = station.id;
                    saveSettings();
                    sendCommand({ type: "fmRadio:setStation", station: station.id, autoplay: true });
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
        ...stationMenuItems(),
        { type: "separator" },
        {
            label: "볼륨",
            submenu: VOLUME_PRESETS.map((value) => ({
                label: value === 0 ? "음소거" : `${value}%`,
                type: "radio",
                checked: state.volume === value,
                click: () => sendCommand({ type: "fmRadio:setVolume", value })
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
    tray.setToolTip(`Mad for Audio — ${stationName} ${status}`);
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

ipcMain.on("widget-state", (_event, message) => {
    if (!message || typeof message.type !== "string") return;
    if (DEBUG) console.log("[state]", JSON.stringify(message));

    if (message.type === "fmRadio:ready") {
        // 위젯이 뜨면 저장해 둔 볼륨을 복원한다 (채널은 URL 파라미터로 이미 전달)
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
        if (win && tray) showWindow();
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
