// shell.html(최상위 프레임)에만 주입되는 브리지 — 위젯 iframe에는 노출되지 않는다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trayBridge", {
    sendState(message) {
        ipcRenderer.send("widget-state", message);
    },
    onCommand(callback) {
        ipcRenderer.on("widget-command", (_event, message) => callback(message));
    }
});
