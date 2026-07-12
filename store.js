// 저장소 모듈 — localStorage JSON 헬퍼 + 녹음 IndexedDB.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

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

function persistRecording(record) {
    return new Promise((resolve) => {
        if (!recDb) return resolve(null);
        try {
            const request = recDb
                .transaction("recordings", "readwrite")
                .objectStore("recordings")
                .add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch (error) {
            console.error(error);
            resolve(null);
        }
    });
}

function deleteRecording(dbId) {
    if (!recDb || dbId == null) return;
    try {
        recDb.transaction("recordings", "readwrite").objectStore("recordings").delete(dbId);
    } catch (error) {
        console.error(error);
    }
}

function restoreRecordings() {
    try {
        const request = recDb.transaction("recordings").objectStore("recordings").getAll();
        request.onsuccess = () => {
            for (const saved of request.result) {
                addRecordingItem({ ...saved, dbId: saved.id });
            }
        };
    } catch (error) {
        console.error(error);
    }
}
