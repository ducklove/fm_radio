// 저장소 모듈 — localStorage JSON 헬퍼 + 녹음 IndexedDB.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// ----- 백그라운드 탭 타이머 심 -----
// Chrome은 5분 이상 가려진 무음 탭의 setTimeout/setInterval을 분당 1회로 묶는다
// (집중 스로틀링). 예약 녹음은 hls.js의 플레이리스트 폴링과 종료 시각 판정이 전부
// 타이머라서, 탭이 뒤로 가면 캡처에 1분꼴 구멍이 뚫리고 음질·길이가 무너진다.
// 전용 워커의 타이머는 이 스로틀링을 받지 않으므로, 페이지 타이머를 워커가 대신
// 깨워 주도록 전면 교체한다. 실패(미지원·CSP)하면 조용히 원본 타이머를 그대로 쓴다.
(function () {
    if (window.__MFA_DISABLE_TIMER_SHIM) return;   // 진단·테스트용 탈출 스위치
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || !window.URL || !URL.createObjectURL) return;
    let worker;
    try {
        const src = "var t={};onmessage=function(e){var m=e.data;" +
            "if(m.op==='set'){t[m.id]=setTimeout(function(){delete t[m.id];postMessage(m.id);},m.delay);}" +
            "else{clearTimeout(t[m.id]);delete t[m.id];}};";
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    } catch (e) { return; }
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const jobs = new Map();          // id → { fn, args, delay, every? }
    const fallbackTimers = new Map();// worker id → { nativeId, every }
    let seq = 2 ** 30;               // 네이티브 타이머 ID(작은 정수)와 절대 겹치지 않는 대역
    let dead = false;
    function fallBackToNative() {    // 워커가 죽으면 기존 ID를 유지한 채 네이티브 타이머로 넘긴다
        if (dead) return;
        dead = true;
        try { worker.terminate(); } catch (error) {}
        jobs.forEach((job, id) => {
            let nativeId;
            if (job.every != null) {
                nativeId = nativeSetInterval(job.fn, job.every, ...job.args);
            } else {
                nativeId = nativeSetTimeout(() => {
                    fallbackTimers.delete(id);
                    jobs.delete(id);
                    job.fn.apply(window, job.args);
                }, job.delay);
            }
            fallbackTimers.set(id, { nativeId, every: job.every != null });
        });
    }
    worker.onerror = fallBackToNative;
    worker.onmessage = (e) => {
        if (dead) return;
        const job = jobs.get(e.data);
        if (!job) return;
        if (job.every != null) worker.postMessage({ op: "set", id: e.data, delay: job.every });
        else jobs.delete(e.data);
        job.fn.apply(window, job.args);
    };
    window.setTimeout = function (fn, delay, ...args) {
        if (dead || typeof fn !== "function") return nativeSetTimeout(fn, delay, ...args);
        const id = seq++;
        jobs.set(id, { fn, args, delay: Math.max(0, +delay || 0) });
        worker.postMessage({ op: "set", id, delay: Math.max(0, +delay || 0) });
        return id;
    };
    window.setInterval = function (fn, every, ...args) {
        if (dead || typeof fn !== "function") return nativeSetInterval(fn, every, ...args);
        const id = seq++;
        jobs.set(id, { fn, args, every: Math.max(1, +every || 1) });
        worker.postMessage({ op: "set", id, delay: Math.max(1, +every || 1) });
        return id;
    };
    // 우리 ID가 아니면 네이티브로 넘긴다 — 심 설치 전에 만들어진 타이머도 지워져야 한다
    window.clearTimeout = window.clearInterval = function (id) {
        if (jobs.has(id)) {
            jobs.delete(id);
            const fallback = fallbackTimers.get(id);
            if (fallback) {
                fallbackTimers.delete(id);
                if (fallback.every) nativeClearInterval(fallback.nativeId);
                else nativeClearTimeout(fallback.nativeId);
            } else if (!dead) {
                worker.postMessage({ op: "clear", id });
            }
            return;
        }
        nativeClearTimeout(id);
        nativeClearInterval(id);
    };
    window.MFA_TimerShim = Object.freeze({
        get mode() { return dead ? "native-fallback" : "worker"; },
        failOver: fallBackToNative
    });
})();

let recDb = null;

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(error);
    }
}

function openRecordingDb() {
    if (!window.indexedDB) return;
    try {
        const request = indexedDB.open("fm-radio", 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("recordings", { keyPath: "id", autoIncrement: true });
        };
        request.onsuccess = () => {
            recDb = request.result;
            restoreRecordings();
            updateRecordingsNote();
        };
        request.onerror = () => {
            console.error(request.error);
        };
    } catch (error) {
        console.error(error);
    }
}

function recordingStoreFailure(error, fallbackReason) {
    const name = error && error.name ? String(error.name) : "";
    const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
    return {
        ok: false,
        id: null,
        reason: quota ? "quota" : (fallbackReason || "write-failed"),
        error: error || null
    };
}

function idbAddRecording(record) {
    return new Promise((resolve) => {
        try {
            const request = recDb
                .transaction("recordings", "readwrite")
                .objectStore("recordings")
                .add(record);
            request.onsuccess = () => resolve({ ok: true, id: request.result, reason: null, error: null });
            request.onerror = () => resolve(recordingStoreFailure(request.error));
        } catch (error) {
            resolve(recordingStoreFailure(error));
        }
    });
}

async function persistRecording(record) {
    if (!recDb) return recordingStoreFailure(null, "unavailable");
    const direct = await idbAddRecording(record);
    if (direct.ok) return direct;
    if (direct.reason === "quota") return direct;
    // 일부 WebKit(사파리 사생활 보호·임시 세션)은 Blob/File을 IDB에 못 담는다.
    // ArrayBuffer로 풀어 저장하고 복원 시 Blob으로 되살린다.
    try {
        const buf = await record.blob.arrayBuffer();
        const flat = { ...record, blob: null, blobBuf: buf, blobType: record.blob.type || record.type || "" };
        const retry = await idbAddRecording(flat);
        if (!retry.ok) console.error("녹음 저장 실패:", retry.error);
        return retry;
    } catch (error) {
        console.error(error);
        return recordingStoreFailure(error);
    }
}

function deleteRecordings(dbIds) {
    const ids = [...new Set((dbIds || []).filter((id) => id != null))];
    if (!ids.length) return Promise.resolve({ ok: true, ids: [], reason: null, error: null });
    if (!recDb) return Promise.resolve(recordingStoreFailure(null, "unavailable"));
    return new Promise((resolve) => {
        try {
            const transaction = recDb.transaction("recordings", "readwrite");
            const store = transaction.objectStore("recordings");
            let requestError = null;
            ids.forEach((id) => {
                const request = store.delete(id);
                request.onerror = () => {
                    requestError = request.error || new Error("recording delete failed");
                    try { transaction.abort(); } catch (error) {}
                };
            });
            transaction.oncomplete = () => resolve({ ok: true, ids, reason: null, error: null });
            transaction.onabort = transaction.onerror = () =>
                resolve(recordingStoreFailure(requestError || transaction.error, "delete-failed"));
        } catch (error) {
            console.error(error);
            resolve(recordingStoreFailure(error, "delete-failed"));
        }
    });
}

async function deleteRecording(dbId) {
    if (dbId == null) return recordingStoreFailure(null, "unavailable");
    const result = await deleteRecordings([dbId]);
    return result.ok
        ? { ok: true, id: dbId, reason: null, error: null }
        : { ...result, id: dbId };
}

// 저장 호출부가 성공/실패를 추측하지 않도록 단일 Result 계약으로 노출한다.
// 기존 함수 이름은 호환 래퍼로 유지하고, 새 코드는 이 저장소 경계를 기준으로 동작한다.
const RecordingRepository = Object.freeze({
    save: persistRecording,
    remove: deleteRecording,
    removeMany: deleteRecordings,
    available: () => !!recDb
});
window.MFA_RecordingRepository = RecordingRepository;

function restoreRecordings() {
    try {
        const request = recDb.transaction("recordings").objectStore("recordings").getAll();
        request.onsuccess = () => {
            for (const saved of request.result) {
                const rec = { ...saved, dbId: saved.id };
                // ArrayBuffer 폴백으로 저장된 녹음은 Blob으로 되살린다
                if (!rec.blob && rec.blobBuf) rec.blob = new Blob([rec.blobBuf], { type: rec.blobType || rec.type || "audio/webm" });
                addRecordingItem(rec);
            }
        };
    } catch (error) {
        console.error(error);
    }
}
