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

// ----- 음반 카탈로그 검색·연속 재생 코어 -----
// UI 표현과 재생 엘리먼트에서 분리해, 수납장 검색과 랜덤 연속 재생이 같은
// 장르·분위기 상속 규칙을 사용하도록 한다.
export function normalizeCatalogText(value) {
    return String(value == null ? "" : value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .normalize("NFC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function catalogValues(value) {
    const source = Array.isArray(value) ? value : [value];
    const seen = new Set();
    const values = [];
    source.forEach((item) => {
        const normalized = normalizeCatalogText(item);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        values.push(normalized);
    });
    return values;
}

function ownCatalogTags(item, singular, plural) {
    if (!item || typeof item !== "object") return [];
    const pluralValues = catalogValues(item[plural]);
    if (pluralValues.length) return pluralValues;
    return catalogValues(item[singular]);
}

function inheritedCatalogTags(record, track, singular, plural) {
    const trackValues = ownCatalogTags(track, singular, plural);
    return trackValues.length ? trackValues : ownCatalogTags(record, singular, plural);
}

function pushSearchValues(target, value) {
    if (Array.isArray(value)) {
        value.forEach((item) => pushSearchValues(target, item));
        return;
    }
    if (value != null && value !== "") target.push(value);
}

export function catalogSearchText(record, track) {
    const rec = record && typeof record === "object" ? record : {};
    const tr = track && typeof track === "object" ? track : {};
    const genres = inheritedCatalogTags(rec, tr, "genre", "genres");
    const moods = inheritedCatalogTags(rec, tr, "mood", "moods");
    const values = [];

    [
        rec.id, rec.title, rec.artist, rec.composer, rec.performer,
        rec.catalogNo, rec.bwv, rec.description, rec.credit,
        rec.jTitle, rec.jSub1, rec.jSub2, rec.labelTitle, rec.labelArtist,
        rec.genreLabel, rec.moodLabels, rec.tags,
        tr.id, tr.title, tr.t, tr.artist, tr.composer, tr.performer,
        tr.sourceArtist, tr.description, tr.genreLabel, tr.moodLabels, tr.tags,
        genres, moods
    ].forEach((value) => pushSearchValues(values, value));

    return normalizeCatalogText(values.join(" "));
}

export function catalogTrackMetadata(record, track) {
    const genres = inheritedCatalogTags(record, track, "genre", "genres");
    const moods = inheritedCatalogTags(record, track, "mood", "moods");
    return Object.freeze({
        genre: genres[0] || "",
        genres: Object.freeze(genres.slice()),
        mood: moods[0] || "",
        moods: Object.freeze(moods.slice()),
        searchText: catalogSearchText(record, track)
    });
}

export function catalogTrackKey(record, track, recordIndex, trackIndex) {
    const recordId = record && record.id != null && String(record.id).trim()
        ? String(record.id).trim()
        : `record-${recordIndex}`;
    const trackId = track && track.id != null && String(track.id).trim()
        ? String(track.id).trim()
        : `track-${trackIndex}`;
    return `${recordId}:${trackId}`;
}

function selectedCatalogTags(value) {
    return catalogValues(value).filter((tag) => tag !== "all" && tag !== "*");
}

function matchesAnyTag(actual, selected) {
    return selected.length === 0 || selected.some((tag) => actual.includes(tag));
}

export function filterCatalogTracks(records, filters) {
    const source = Array.isArray(records) ? records : [];
    const options = filters || {};
    const selectedGenres = selectedCatalogTags(options.genres != null ? options.genres : options.genre);
    const selectedMoods = selectedCatalogTags(options.moods != null ? options.moods : options.mood);
    const query = normalizeCatalogText(options.query);
    const candidates = [];

    source.forEach((record, recordIndex) => {
        if (!record || !Array.isArray(record.tracks)) return;
        record.tracks.forEach((track, trackIndex) => {
            if (!track || typeof track !== "object") return;
            const metadata = catalogTrackMetadata(record, track);
            // 같은 분류 안에서는 하나라도 일치, 분류 사이는 장르 AND 분위기로 결합한다.
            if (!matchesAnyTag(metadata.genres, selectedGenres)
                || !matchesAnyTag(metadata.moods, selectedMoods)
                || (query && !metadata.searchText.includes(query))) return;
            candidates.push(Object.freeze({
                record,
                track,
                recordIndex,
                trackIndex,
                key: catalogTrackKey(record, track, recordIndex, trackIndex),
                genre: metadata.genre,
                genres: metadata.genres,
                mood: metadata.mood,
                moods: metadata.moods,
                searchText: metadata.searchText
            }));
        });
    });

    return candidates;
}

function defaultCandidateKey(candidate, index) {
    if (candidate && candidate.key != null) return String(candidate.key);
    return `candidate-${index}`;
}

export function createCatalogShuffleBag(candidates, options) {
    const config = options || {};
    const random = typeof config.random === "function" ? config.random : Math.random;
    const keyOf = typeof config.keyOf === "function" ? config.keyOf : defaultCandidateKey;
    let source = [];
    let bag = [];
    let lastKey = config.lastKey == null ? "" : String(config.lastKey);

    function setSource(nextCandidates) {
        const seen = new Set();
        source = [];
        (Array.isArray(nextCandidates) ? nextCandidates : []).forEach((candidate, index) => {
            const key = String(keyOf(candidate, index));
            if (seen.has(key)) return;
            seen.add(key);
            source.push({ candidate, key });
        });
    }

    function randomIndex(length) {
        const value = Number(random());
        const unit = Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0;
        return Math.floor(unit * length);
    }

    function refill() {
        bag = source.slice();
        for (let i = bag.length - 1; i > 0; i -= 1) {
            const j = randomIndex(i + 1);
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // 새 bag의 첫 곡이 직전 곡과 같으면, 가능한 다른 곡과 자리를 바꾼다.
        if (bag.length > 1 && bag[0].key === lastKey) {
            const replacement = bag.findIndex((entry, index) => index > 0 && entry.key !== lastKey);
            if (replacement > 0) [bag[0], bag[replacement]] = [bag[replacement], bag[0]];
        }
    }

    function next() {
        if (!bag.length) refill();
        if (!bag.length) return null;
        const entry = bag.shift();
        lastKey = entry.key;
        return entry.candidate;
    }

    function reset(nextCandidates, nextLastKey) {
        if (arguments.length > 0) setSource(nextCandidates);
        if (arguments.length > 1) lastKey = nextLastKey == null ? "" : String(nextLastKey);
        refill();
        return api;
    }

    const api = Object.freeze({
        next,
        reset,
        get size() { return source.length; },
        get remaining() { return bag.length; },
        get lastKey() { return lastKey; }
    });

    setSource(candidates);
    refill();
    return api;
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
