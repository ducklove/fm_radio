// UI와 DOM에서 독립적인 앱 런타임 코어.
// bootstrap.js가 이 ES module을 먼저 준비한 뒤 classic app.js를 실행한다.

export function createPlaybackController(options) {
    const config = options || {};
    const audio = config.audio;
    const isStreamLoaded = typeof config.isStreamLoaded === "function"
        ? config.isStreamLoaded
        : () => false;
    const resolveUrl = typeof config.resolveUrl === "function"
        ? config.resolveUrl
        : (url) => String(url || "");
    let generation = 0;
    let current = { generation: 0, source: "none", phase: "idle", label: "", url: "", handle: null };

    function begin(source, label) {
        generation += 1;
        current = { generation, source, phase: "resolving", label: label || "", url: "", handle: null };
        return generation;
    }

    function isCurrent(token) {
        return token === current.generation;
    }

    function bind(token, url, handle) {
        if (!isCurrent(token)) {
            if (handle && typeof handle.destroy === "function") handle.destroy();
            return false;
        }
        current.url = url || "";
        current.handle = handle || null;
        current.phase = "buffering";
        return true;
    }

    function transition(token, phase) {
        if (!isCurrent(token)) return false;
        current.phase = phase;
        return true;
    }

    function acceptsMediaEvent() {
        if (!isStreamLoaded() || current.source === "none") return false;
        if (current.handle && typeof current.handle.isCurrent === "function" && !current.handle.isCurrent()) return false;
        if (!current.url || (current.handle && current.handle.kind === "hls")) return true;
        try {
            const expected = resolveUrl(current.url);
            const actual = audio && (audio.currentSrc || audio.src) || "";
            return !actual || actual === expected;
        } catch (error) {
            return true;
        }
    }

    function invalidate(phase) {
        generation += 1;
        current = { generation, source: "none", phase: phase || "idle", label: "", url: "", handle: null };
        return generation;
    }

    function inspect() {
        return Object.freeze({
            generation: current.generation,
            source: current.source,
            phase: current.phase,
            label: current.label,
            kind: current.handle ? current.handle.kind : null
        });
    }

    return Object.freeze({ begin, bind, transition, isCurrent, acceptsMediaEvent, invalidate, inspect });
}

export function ymdToDate(ymd) {
    return new Date(
        parseInt(ymd.slice(0, 4), 10),
        parseInt(ymd.slice(4, 6), 10) - 1,
        parseInt(ymd.slice(6, 8), 10)
    );
}

function ymdOf(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return "" + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
}

export const ReservationSchedule = Object.freeze({
    occurrence(reservation, nowTs) {
        const res = reservation;
        if (!res || !Number.isFinite(res.startMin) || !Number.isFinite(res.endMin)) return null;
        const makeOccurrence = (base) => ({
            startTs: base.getTime() + res.startMin * 60000,
            endTs: base.getTime() + res.endMin * 60000,
            ymd: ymdOf(base)
        });
        if (res.repeat === "once") {
            return /^\d{8}$/.test(res.ymd || "") ? makeOccurrence(ymdToDate(res.ymd)) : null;
        }
        const today = new Date(nowTs);
        today.setHours(0, 0, 0, 0);
        for (let offset = -1; offset <= 7; offset += 1) {
            const date = new Date(today);
            date.setDate(today.getDate() + offset);
            if (res.repeat === "weekly" && date.getDay() !== res.dow) continue;
            const occurrence = makeOccurrence(date);
            if (occurrence.endTs > nowTs) return occurrence;
        }
        return null;
    }
});

export function recFileExtension(mimeType) {
    const type = String(mimeType || "");
    if (type.includes("mp2t")) return "ts";
    if (type.includes("aac")) return "aac";              // 원본 ADTS AAC 세그먼트 패스스루
    if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
    if (type.includes("mp4")) return "m4a";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    if (type.includes("flac")) return "flac";
    return "webm";
}

export function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatSize(bytes) {
    return bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1)}MB`
        : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function recordingFileInfo(record) {
    const startDate = new Date(record.startedAt);
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}_${pad(startDate.getHours())}${pad(startDate.getMinutes())}${pad(startDate.getSeconds())}`;
    const safeName = String(record.stationName || "recording").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
    return {
        fileName: `${safeName}_${stamp}.${recFileExtension(record.type || "")}`,
        startLabel: `${startDate.getMonth() + 1}/${startDate.getDate()} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())} 시작`
    };
}
