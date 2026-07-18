// shell.html(최상위 프레임)에만 주입되는 브리지 — 위젯/랙 iframe에는 노출되지 않는다.
const { contextBridge, ipcRenderer } = require("electron");

const STATE_TYPES = new Set(["fmRadio:ready", "fmRadio:state", "fmRadio:ended"]);

function isStateMessage(message) {
    return !!message
        && typeof message === "object"
        && STATE_TYPES.has(message.type);
}

const trayBridge = Object.freeze({
    // 위젯/랙의 재생 상태(fmRadio:*)를 메인 프로세스로 올린다
    sendState(message) {
        if (isStateMessage(message)) ipcRenderer.send("widget-state", message);
    },
    // 현재 보기(tuner|system)를 알려 창 크기를 맞추게 한다
    sendView(view) {
        if (view === "tuner" || view === "system") ipcRenderer.send("widget-view", view);
    },
    // 슬림 바에서 '펼치기' — 전체 플레이어로 복귀 요청
    requestFull() {
        ipcRenderer.send("widget-request-full");
    },
    // 메인 프로세스 → 셸 명령(fmRadio:* 재생 명령 / trayMode / setView)
    onCommand(callback) {
        if (typeof callback !== "function") throw new TypeError("onCommand callback이 필요합니다");
        const listener = (_event, message) => {
            if (message && typeof message === "object") callback(message);
        };
        ipcRenderer.on("widget-command", listener);
        return () => ipcRenderer.removeListener("widget-command", listener);
    }
});

contextBridge.exposeInMainWorld("trayBridge", trayBridge);
