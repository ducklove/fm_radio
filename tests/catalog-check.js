// 음반 카탈로그 정적 검증 — 브라우저를 띄우기 전에 JSON/필수 메타데이터 회귀를 잡는다.
const fs = require("fs");
const path = require("path");

const catalogPath = path.join(__dirname, "..", "records.json");
const records = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const requiredStrings = [
    "id", "title", "artist", "catalogNo", "bwv", "composer", "performer", "genre", "credit",
    "labelBig", "labelTitle", "labelArtist", "jTitle", "jSub1", "jSub2",
    "labelBg", "jacketBg", "accent",
];
const colorFields = ["labelBg", "jacketBg", "accent"];
const qualityNumberFields = [
    "sampleRate", "bitDepth", "channels", "bitrateKbps", "durationSeconds", "bytes",
];
const errors = [];
const recordIds = new Set();
const trackIds = new Set();

if (!Array.isArray(records) || records.length === 0) {
    errors.push("catalog must be a non-empty array");
}

for (const [recordIndex, record] of records.entries()) {
    const at = `record[${recordIndex}]`;
    for (const field of requiredStrings) {
        if (typeof record[field] !== "string" || record[field].trim() === "") {
            errors.push(`${at}.${field} must be a non-empty string`);
        }
    }
    if (recordIds.has(record.id)) errors.push(`${at}.id must be unique (${record.id})`);
    recordIds.add(record.id);
    if (!Array.isArray(record.moods) || record.moods.length === 0
        || record.moods.some((mood) => typeof mood !== "string" || mood.trim() === "")) {
        errors.push(`${at}.moods must be a non-empty string array`);
    }
    for (const field of colorFields) {
        if (typeof record[field] === "string" && !/^#[0-9a-f]{6}$/i.test(record[field])) {
            errors.push(`${at}.${field} must be a six-digit hex color`);
        }
    }
    if (record.cover != null && (typeof record.cover !== "string" || /^https?:\/\//i.test(record.cover))) {
        errors.push(`${at}.cover must be a relative Wikimedia Commons path`);
    }
    if (record.recordingYear != null && (!Number.isInteger(record.recordingYear) || record.recordingYear < 1877)) {
        errors.push(`${at}.recordingYear must be an integer no earlier than 1877`);
    }
    if (record.source != null) {
        if (typeof record.source !== "object" || Array.isArray(record.source)) {
            errors.push(`${at}.source must be an object`);
        } else {
            for (const field of ["provider", "license"]) {
                if (typeof record.source[field] !== "string" || record.source[field].trim() === "") {
                    errors.push(`${at}.source.${field} must be a non-empty string`);
                }
            }
        }
    }
    if (record.collection === "commons-genres-2026-07"
        && (!record.source || record.source.commercialUse !== true)) {
        errors.push(`${at}.source.commercialUse must be true for the Commons genre collection`);
    }
    if (!Array.isArray(record.tracks) || record.tracks.length === 0) {
        errors.push(`${at}.tracks must be a non-empty array`);
        continue;
    }
    for (const [trackIndex, track] of record.tracks.entries()) {
        const trackAt = `${at}.tracks[${trackIndex}]`;
        if (!track || typeof track.t !== "string" || track.t.trim() === "") {
            errors.push(`${trackAt}.t must be a non-empty string`);
        }
        if (!track || typeof track.id !== "string" || track.id.trim() === "") {
            errors.push(`${trackAt}.id must be a non-empty string`);
        } else if (trackIds.has(track.id)) {
            errors.push(`${trackAt}.id must be globally unique (${track.id})`);
        } else {
            trackIds.add(track.id);
        }
        if (!track || typeof track.f !== "string" || track.f.trim() === "" || /^https?:\/\//i.test(track.f)) {
            errors.push(`${trackAt}.f must be a relative Wikimedia Commons path`);
        }
        if (track.performer != null && (typeof track.performer !== "string" || track.performer.trim() === "")) {
            errors.push(`${trackAt}.performer must be a non-empty string when present`);
        }
        if (track.recordingYear != null && (!Number.isInteger(track.recordingYear) || track.recordingYear < 1877)) {
            errors.push(`${trackAt}.recordingYear must be an integer no earlier than 1877`);
        }
        if (track.sourcePage != null && !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(track.sourcePage)) {
            errors.push(`${trackAt}.sourcePage must be a Wikimedia Commons file page`);
        }
        if (track.quality != null) {
            if (typeof track.quality !== "object" || Array.isArray(track.quality)) {
                errors.push(`${trackAt}.quality must be an object`);
            } else {
                if (typeof track.quality.format !== "string" || track.quality.format.trim() === "") {
                    errors.push(`${trackAt}.quality.format must be a non-empty string`);
                }
                if (typeof track.quality.lossless !== "boolean") {
                    errors.push(`${trackAt}.quality.lossless must be boolean`);
                }
                for (const field of qualityNumberFields) {
                    if (track.quality[field] != null &&
                        (typeof track.quality[field] !== "number" || !Number.isFinite(track.quality[field]) || track.quality[field] <= 0)) {
                        errors.push(`${trackAt}.quality.${field} must be a positive finite number`);
                    }
                }
            }
        }
        if (record.collection === "commons-genres-2026-07") {
            if (track.commercialUse !== true) {
                errors.push(`${trackAt}.commercialUse must be true for cafe-mode candidates`);
            }
            if (typeof track.license !== "string" || !/^(?:CC BY(?:-SA)?|CC0|Public domain)/i.test(track.license)) {
                errors.push(`${trackAt}.license must permit commercial use`);
            }
        }
    }
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

const tracks = records.reduce((total, record) => total + record.tracks.length, 0);
console.log(`음반 카탈로그 검증 완료: ${records.length}장 · ${tracks}트랙`);
