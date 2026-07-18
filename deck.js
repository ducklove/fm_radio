// 카세트 데크 모듈 — C-30 실물 테이프 모델(30분 연속 매체)과 트랜스포트.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// ----- 카세트 데크 (Nakamichi DRAGON) — C-30 실물 테이프 모델 -----
// 테이프는 30분짜리 연속 매체다. 카운터 = 테이프 위치.
// REC는 현재 위치에 덮어쓰고, PLAY는 빈 구간에서 히스만 내며 감기고,
// REW/FF는 누르는 동안 고속으로 감긴다. 테이프마다 위치를 기억한다.
const TAPE_LEN = 1800;          // C-30 한 면: 30분 (기본 테이프)
let tapes = [];                 // { id, label, segments:[{start,dur,url,name,offset?}], pos, len?, blank? }
let deckTape = null;            // 장착된 테이프
let tapePos = 0;                // 현재 테이프 위치(초)
let deckMode = "stop";          // stop | play | rec | wind
let deckPlaying = false;        // 덱이 메인 오디오 소스 (deckMode === "play")
let windDir = 0;
let deckSegPlaying = null;      // 재생 중인 세그먼트
let deckAutoSegAnnounced = null; // 빈 구간을 지나 자동 시작된 세그먼트 안내 중복 방지
let deckRecStartPos = 0;
let deckReelAngle = 0;
let tapeSeq = 1;
let hissGain = null;
let hissSrc = null;
const DECK_MODEL_MIGRATION = { tcka7es: "ctf1250" };
let deckModelId = loadJson("fmRadio.deck", "dragon");
deckModelId = DECK_MODEL_MIGRATION[deckModelId] || deckModelId;
if (!DECK_ORDER.includes(deckModelId)) deckModelId = "dragon";
saveJson("fmRadio.deck", deckModelId);

// ----- 더블데크(B웰) -----
// W-990RX 같은 더블 데크에서 녹음(예약·수동)은 B웰이 전담한다.
// A웰(재생 트랜스포트)은 녹음과 완전히 독립 — 예약이 걸려 있어도 자유롭게 쓴다.
let w990DubUntil = 0;       // W-990RX 고속 더빙 연출 종료 시각 (릴 고속 회전)
let w990DubBusy = false;
let w990DubHigh = true;     // DUB SPEED — HIGH(30배 연출) / NORMAL(15배 연출)
let w990ContPlay = false;   // REV MODE(relay) — A면이 끝나면 B웰 테이프로 이어 재생
let dragonRepeat = false;   // DRAGON 오토 리버스(리피트) — 끝나면 되감아 이어 재생
let deckAutoResume = false; // 자동 와인딩 도착 후 재생 재개 (드래곤 리피트용)
let deckLocAddr = null;     // B215 ADDR LOC — MEM으로 기억한 카운터 위치 (세션)
let deckWindTarget = null;  // 자동 와인딩 목표 (ZERO/ADDR LOC), 도달 시 정지
let deckBTape = null;           // B웰에 걸린 테이프 (녹음 중에만 장착, 정지 시 랙으로 배출)
let deckBPos = 0;
let deckBRecStartPos = 0;
let deckBReelAngle = 0;
let recOnB = false;             // 현재 녹음이 B웰에서 도는 중

function isDoubleDeck() {
    return !!(DECK_MODELS[deckModelId] && DECK_MODELS[deckModelId].doubleDeck);
}

// ----- 테이프 메타 영속화 -----
// 녹음(IndexedDB)이 테이프 본문이라면, 라벨·규격은 케이스에 쓴 글씨다.
// 세그먼트가 있거나 이름을 써 준(named) 테이프만 남긴다 — 빈 무명 공테이프는 휘발.
let tapeMeta = loadJson("fmRadio.tapeMeta", {});

function tapeMetaSave() {
    const out = {};
    tapes.forEach((t) => {
        if (t.segments.length || (t.segmentsB && t.segmentsB.length) || t.named || t.cal) out[t.id] = { label: t.label, len: tapeLenOf(t), named: !!t.named, createdAt: tapeCreatedAt(t) || undefined, cal: t.cal || undefined, foreign: t.foreign || undefined, side: (t.side && t.side !== "A") ? t.side : undefined };
    });
    tapeMeta = out;
    saveJson("fmRadio.tapeMeta", out);
}

// 시작 시 메타에 있는 테이프를 빈 껍데기로 복원 — 녹음이 복원되면 세그먼트가 채워진다
Object.entries(tapeMeta).forEach(([id, m]) => {
    if (!m || !m.label) return;
    tapes.push({ id, label: m.label, segments: [], segmentsB: [], side: m.side === "B" ? "B" : "A", pos: 0, len: m.len || TAPE_LEN, blank: !m.named, named: !!m.named, createdAt: m.createdAt, cal: !!m.cal, foreign: !!m.foreign });
});

// ----- 데크 장착 상태 영속화 -----
// 실물 데크처럼 "지난번에 물려 있던 그 테이프, 그 위치"만 되장착한다.
// (아무 테이프나 자동 장착하면 옛 수록 위에 새 녹음이 덮이는 사고가 된다 —
//  녹음해 둔 줄 잊은 음반 녹음이 새 녹음 뒤에 이어 나오는 미스터리의 정체.)
function deckStateSave() {
    if (deckTape) deckTape.pos = tapePos;
    saveJson("fmRadio.deckState", deckTape && !(deckTape.blank && !deckTape.segments.length && !(deckTape.segmentsB || []).length)
        ? { tapeId: deckTape.id, pos: Math.round(tapePos) }
        : null);
}

(function deckStateRestore() {
    const saved = loadJson("fmRadio.deckState", null);
    if (!saved || !saved.tapeId) return;
    const t = tapes.find((x) => x.id === saved.tapeId);
    if (!t) return;
    deckTape = t;
    tapePos = Math.max(0, Math.min(saved.pos || 0, tapeLenOf(t)));
    t.pos = tapePos;
})();

// 테이프 생성 시각 — 명시 필드가 없으면 id에 새겨진 타임스탬프("tape-<ms>-")에서 복원
function tapeCreatedAt(t) {
    if (!t) return null;
    if (t.createdAt) return t.createdAt;
    const m = /^tape-(\d{12,})-/.exec(t.id || "");
    return m ? Number(m[1]) : null;
}

function tapeDateLabel(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const p = (v) => String(v).padStart(2, "0");
    const year = d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + ". " : "";
    return year + (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

// 테이프 길이는 규격별로 다르다 — 예약 녹음은 프로그램 길이에 맞는 규격을 자동으로 고른다
function tapeLenOf(t) {
    return (t && t.len) || TAPE_LEN;
}

function tapeSizeName(len) {
    if (len <= 1800) return "C-30";
    if (len <= 3600) return "C-60";
    if (len <= 5400) return "C-90";
    if (len <= 7200) return "C-120";
    return "오픈릴";
}

function newBlankTape(lenSec) {
    const len = lenSec || TAPE_LEN;
    const t = { id: "tape-" + Date.now() + "-" + tapeSeq, label: tapeSizeName(len) + " · TAPE " + tapeSeq, segments: [], segmentsB: [], side: "A", pos: 0, len, blank: true, createdAt: Date.now() };
    tapeSeq += 1;
    tapes.unshift(t);
    return t;
}

// 양면 모델 — segments는 항상 '지금 위인 면'이고, 뒤집으면 segmentsB와 통째로 바뀐다.
// 구버전 테이프(단면)는 처음 만질 때 B면이 빈 채로 생긴다.
function tapeEnsureSides(t) {
    if (!t.segmentsB) t.segmentsB = [];
    if (!t.side) t.side = "A";
}

function tapeFlipArrays(t) {
    tapeEnsureSides(t);
    const a = t.segments;
    t.segments = t.segmentsB;
    t.segmentsB = a;
    t.side = t.side === "B" ? "A" : "B";
}

// 카세트 뒤집기 — 물리 그대로: 감긴 자리가 유지되므로 카운터는 len - pos로 반전된다
function flipTape() {
    if (!deckTape) return;
    if (!deckGuardReservedRec()) return;
    if (recorder && !recOnB) { playerSubtext.textContent = "녹음 중에는 뒤집을 수 없습니다."; return; }
    if (deckMode !== "stop") { playerSubtext.textContent = "정지(■) 상태에서 카세트를 뒤집으세요."; return; }
    tapeFlipArrays(deckTape);
    tapePos = Math.max(0, tapeLenOf(deckTape) - tapePos);
    deckTape.pos = tapePos;
    tapeMetaSave();
    deckSyncTape();
    playerSubtext.textContent = "카세트를 뒤집었습니다 — SIDE " + deckTape.side +
        (deckTape.segments.length ? "" : " (공면)") + " · 카운터 " + formatDuration(tapePos * 1000);
}

// 지정 면에 세그먼트 삽입 — 비활성 면이면 잠시 바꿔치기해 같은 덮어쓰기 규칙을 태운다
function tapeAddSegmentSide(tape, seg, side) {
    tapeEnsureSides(tape);
    if ((side || "A") === (tape.side || "A")) {
        tapeAddSegment(tape, seg);
        return;
    }
    const active = tape.segments;
    tape.segments = tape.segmentsB;
    tapeAddSegment(tape, seg);
    tape.segmentsB = tape.segments;
    tape.segments = active;
}

function tapeUsedSec(tape) {
    return tape.segments.reduce((a, s) => Math.max(a, s.start + s.dur), 0);
}

function segmentAt(tape, pos) {
    return tape.segments.find((s) => pos >= s.start - 0.05 && pos < s.start + s.dur - 0.05) || null;
}

function nextSegmentAfter(tape, pos) {
    let best = null;
    tape.segments.forEach((s) => {
        if (s.start >= pos - 0.05 && (!best || s.start < best.start)) best = s;
    });
    return best;
}

// 덮어쓰기: 새 세그먼트와 겹치는 기존 구간을 잘라낸다 (실제 테이프처럼)
function tapeAddSegment(tape, seg) {
    const s = seg.start;
    const e = seg.start + seg.dur;
    const out = [];
    tape.segments.forEach((o) => {
        const os = o.start;
        const oe = o.start + o.dur;
        if (oe <= s + 0.05 || os >= e - 0.05) { out.push(o); return; }
        if (os < s) out.push({ start: os, dur: s - os, url: o.url, name: o.name, offset: (o.offset || 0), dbId: o.dbId, type: o.type });
        if (oe > e) out.push({ start: e, dur: oe - e, url: o.url, name: o.name, offset: (o.offset || 0) + (e - os), dbId: o.dbId, type: o.type });
    });
    out.push(seg);
    out.sort((a, b) => a.start - b.start);
    tape.segments = out;
    // 직접 이름을 써 준 테이프(named)는 자동 라벨로 덮지 않는다
    if (tape.segments.length && tape.blank && !tape.named) {
        tape.label = tape.segments.length === 1 ? seg.name : seg.name + " 외";
        tape.blank = false;
    }
}

// 테이프의 현재 면/반대 면을 호출부가 직접 순회하지 않게 하는 저장소 경계.
// 한 녹음 Blob이 덮어쓰기로 여러 조각이 되어도 url/dbId 기준으로 양면에서 함께 정리한다.
const TapeRepository = Object.freeze({
    allSegments(tape) {
        if (!tape) return [];
        tapeEnsureSides(tape);
        return tape.segments.concat(tape.segmentsB);
    },
    removeRecording(record) {
        const url = record && record.url;
        const dbId = record && record.dbId;
        let removed = 0;
        tapes.forEach((tape) => {
            tapeEnsureSides(tape);
            ["segments", "segmentsB"].forEach((side) => {
                const before = tape[side].length;
                tape[side] = tape[side].filter((seg) => !(
                    (url && seg.url === url) || (dbId != null && seg.dbId === dbId)
                ));
                removed += before - tape[side].length;
            });
        });
        return removed;
    },
    markPersisted(url, dbId) {
        if (!url || dbId == null) return 0;
        let updated = 0;
        tapes.forEach((tape) => {
            tapeEnsureSides(tape);
            tape.segments.concat(tape.segmentsB).forEach((seg) => {
                if (seg.url === url) { seg.dbId = dbId; updated += 1; }
            });
        });
        return updated;
    }
});
window.MFA_TapeRepository = TapeRepository;

function ensureHiss() {
    if (!audioCtx || hissSrc) return;
    try {
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, sr * 2, sr);
        const d = buf.getChannelData(0);
        let p = 0;
        for (let i = 0; i < d.length; i++) {
            const w = Math.random() * 2 - 1;
            p = p * 0.72 + w * 0.28;      // 고역 성분을 완만하게 깎은 테이프 히스
            d[i] = p * 0.9;
        }
        hissGain = audioCtx.createGain();
        hissGain.gain.value = 0;
        hissGain.connect(eqNodes ? eqNodes[0] : audioCtx.destination);
        hissSrc = audioCtx.createBufferSource();
        hissSrc.buffer = buf;
        hissSrc.loop = true;
        hissSrc.connect(hissGain);
        hissSrc.start();
    } catch (e) { hissSrc = null; }
}

// 선언된 길이보다 실제 오디오가 짧으면(녹음 중 스트림 끊김 등) 세그먼트를 실측으로 줄인다 —
// 죽은 구간에서 소리만 사라진 채 카운터가 흐르는 증상을 원천에서 없앤다
function deckSegHeal() {
    const seg = deckSegPlaying;
    if (!seg || !isFinite(audio.duration) || !audio.duration) return;
    const realDur = Math.max(0.5, audio.duration - (seg.offset || 0));
    if (realDur < seg.dur - 0.75) {
        seg.dur = realDur;
        updateDeckLabel();
    }
}

let deckSeekFixing = false;   // 길이 확정 시크 중 — ended 핸들러가 오인하지 않게
let deckSeekGeneration = 0;

function deckStartSegment(seg, innerOffset) {
    const seekGeneration = ++deckSeekGeneration;
    deckSeekFixing = false;
    deckSegPlaying = seg;
    streamLoaded = true;
    const target = (seg.offset || 0) + Math.max(0, innerOffset);
    const playbackToken = PlaybackController.begin("tape", seg.name || "TAPE");
    PlaybackController.bind(playbackToken, seg.url, null);
    setAudioState("buffering", "TAPE");
    const startPlay = () => {
        if (!PlaybackController.isCurrent(playbackToken) || deckSegPlaying !== seg) return;
        audio.play().catch(() => {
            if (!PlaybackController.isCurrent(playbackToken)) return;
            PlaybackController.transition(playbackToken, "blocked");
            setAudioState("blocked", "TAPE");
            isPlaying = false;
            updatePlayButton();
        });
    };
    const seekAndPlay = () => {
        if (!PlaybackController.isCurrent(playbackToken) || deckSegPlaying !== seg) return;
        if (!isFinite(audio.duration)) {
            // MediaRecorder·바이트 캡처 blob은 길이 미상(Infinity)이라 시킹이 무시된다.
            // 표준 워크어라운드: 끝으로 한 번 밀면 브라우저가 실제 길이와 큐를 확정한다.
            deckSeekFixing = true;
            audio.pause();
            const done = () => {
                audio.removeEventListener("seeked", done);
                if (seekGeneration === deckSeekGeneration) deckSeekFixing = false;
                if (!PlaybackController.isCurrent(playbackToken) || deckSegPlaying !== seg) return;
                deckSegHeal();
                if (!deckSegPlaying) return;
                if (target - (seg.offset || 0) >= seg.dur - 0.05) {   // 실측보다 뒤 — 빈 구간으로
                    deckSegPlaying = null;
                    return;
                }
                try { audio.currentTime = target; } catch (e) {}
                startPlay();
            };
            audio.addEventListener("seeked", done);
            try { audio.currentTime = 1e10; } catch (e) {
                if (seekGeneration === deckSeekGeneration) deckSeekFixing = false;
                startPlay();
            }
            return;
        }
        deckSegHeal();
        if (target - (seg.offset || 0) >= seg.dur - 0.05) {
            deckSegPlaying = null;
            audio.pause();
            return;
        }
        try { audio.currentTime = target; } catch (e) {}
        startPlay();
    };
    if (audio.currentSrc === seg.url && audio.readyState >= 1) {
        // 같은 blob이 이미 로드돼 있다 — 리로드 없이 시크만 (재대입은 위치를 0으로 되돌린다)
        seekAndPlay();
    } else {
        audio.src = seg.url;
        audio.addEventListener("loadedmetadata", seekAndPlay, { once: true });
        startPlay();
    }
}

function mountDeck() {
    const dragonPeakRow = (id, x) => '<g id="' + id + '" data-meter-style="segments">' +
        Array.from({ length: 20 }, (_, i) => {
            const hot = i >= 18;
            const warn = i >= 14 && !hot;
            const on = hot ? "#ff5a43" : warn ? "#f2c65b" : "#69e59b";
            const off = hot ? "#301315" : warn ? "#2d2716" : "#10251b";
            return '<rect data-meter-segment="' + i + '" data-on="' + on + '" data-off="' + off + '" x="' + x +
                '" y="' + (452 - i * 13.2).toFixed(1) + '" width="18" height="8.6" rx="1.6" fill="' + off + '"/>';
        }).join("") + '</g>';
    const dragonKey = (id, x, y, label, glyph, accent) => {
        const idAttr = id ? ' id="' + id + '" style="cursor:pointer;touch-action:none"' : '';
        const stroke = accent || "#50545b";
        return '<g><rect x="' + (x + 4) + '" y="' + (y + 6) + '" width="82" height="55" rx="3" fill="#000" opacity=".58"/>' +
            '<rect' + idAttr + ' x="' + x + '" y="' + y + '" width="82" height="55" rx="3" fill="url(#dkKey)" stroke="' + stroke + '" stroke-width="1.5">' +
            (id ? '<title>' + label + '</title>' : '') + '</rect>' +
            '<path d="M' + (x + 7) + ' ' + (y + 6) + 'H' + (x + 75) + '" stroke="#fff" stroke-width="1.4" opacity=".18" pointer-events="none"/>' +
            '<text x="' + (x + 41) + '" y="' + (y + 31) + '" font-family="Arial" font-size="17" font-weight="700" fill="' + (accent ? "#e8e0d3" : "#c5c8cb") + '" text-anchor="middle" pointer-events="none">' + glyph + '</text>' +
            '<text x="' + (x + 41) + '" y="' + (y + 48) + '" font-family="Arial" font-size="8.2" font-weight="700" letter-spacing="1" fill="#8d9197" text-anchor="middle" pointer-events="none">' + label + '</text></g>';
    };
    const dragonReel = (side, cx, packRadius) => '<circle id="deckPack' + side + '" cx="' + cx + '" cy="260" r="' + packRadius + '" fill="url(#dkPack)" stroke="#080604" stroke-width="2"/>' +
        '<g id="deckReel' + side + '" data-cx="' + cx + '" data-cy="260"><circle cx="' + cx + '" cy="260" r="21" fill="url(#dkKnurl)" stroke="#70757b"/>' +
        '<circle cx="' + cx + '" cy="260" r="15" fill="url(#dkReel)" stroke="#40454b"/>' +
        '<path d="M' + cx + ' 247V254 M' + cx + ' 266V273 M' + (cx - 13) + ' 260H' + (cx - 6) + ' M' + (cx + 6) + ' 260H' + (cx + 13) +
        ' M' + (cx - 10) + ' 250L' + (cx - 4) + ' 256 M' + (cx + 4) + ' 264L' + (cx + 10) + ' 270 M' + (cx + 10) + ' 250L' + (cx + 4) + ' 256 M' + (cx - 4) + ' 264L' + (cx - 10) + ' 270" stroke="#484d53" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="' + cx + '" cy="260" r="4" fill="#101014"/></g>';
    document.getElementById("deckStage").innerHTML = deckModelId === "dragon" ?
        `<svg class="deck-svg" viewBox="0 0 2000 600" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Nakamichi DRAGON 카세트 데크">
        <defs>
            <linearGradient id="dkFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3035"/><stop offset=".04" stop-color="#1b1d22"/><stop offset=".42" stop-color="#111318"/><stop offset=".82" stop-color="#090b0e"/><stop offset="1" stop-color="#030405"/></linearGradient>
            <linearGradient id="dkDoor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#31343a"/><stop offset=".08" stop-color="#1f2227"/><stop offset=".52" stop-color="#181b20"/><stop offset="1" stop-color="#0b0d10"/></linearGradient>
            <linearGradient id="dkRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#72767d"/><stop offset=".12" stop-color="#2c3036"/><stop offset=".72" stop-color="#0b0d11"/><stop offset="1" stop-color="#494d53"/></linearGradient>
            <linearGradient id="dkWindow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05080a"/><stop offset=".35" stop-color="#151b1f"/><stop offset="1" stop-color="#020304"/></linearGradient>
            <linearGradient id="dkGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8edf2" stop-opacity=".16"/><stop offset=".22" stop-color="#9eb8c0" stop-opacity=".045"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>
            <linearGradient id="dkCassette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555a5d"/><stop offset=".18" stop-color="#2a2e31"/><stop offset=".72" stop-color="#17191c"/><stop offset="1" stop-color="#08090b"/></linearGradient>
            <linearGradient id="dkTape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#26160e"/><stop offset=".5" stop-color="#6f4a31"/><stop offset="1" stop-color="#21120b"/></linearGradient>
            <linearGradient id="dkKey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#52565e"/><stop offset=".09" stop-color="#373b43"/><stop offset=".46" stop-color="#23262c"/><stop offset=".88" stop-color="#111318"/><stop offset="1" stop-color="#07080b"/></linearGradient>
            <linearGradient id="dkSwitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5e66"/><stop offset=".18" stop-color="#353940"/><stop offset="1" stop-color="#101216"/></linearGradient>
            <radialGradient id="dkKnob" cx="34%" cy="28%" r="82%"><stop offset="0" stop-color="#62666c"/><stop offset=".42" stop-color="#2d3036"/><stop offset=".82" stop-color="#0b0c0f"/><stop offset="1" stop-color="#3e4247"/></radialGradient>
            <radialGradient id="dkPack" cx="38%" cy="34%" r="72%"><stop offset="0" stop-color="#745139"/><stop offset=".58" stop-color="#342218"/><stop offset="1" stop-color="#070504"/></radialGradient>
            <radialGradient id="dkReel" cx="34%" cy="28%" r="82%"><stop offset="0" stop-color="#e8e9e6"/><stop offset=".36" stop-color="#a6aaae"/><stop offset=".72" stop-color="#4c5157"/><stop offset="1" stop-color="#cdd0d1"/></radialGradient>
            <pattern id="dkFine" width="9" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5H9 M0 3.5H9" stroke="#fff" stroke-width=".4" opacity=".035"/><path d="M0 2H9 M0 4.5H9" stroke="#000" stroke-width=".5" opacity=".18"/></pattern>
            <pattern id="dkKnurl" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(22)"><path d="M1 0V7 M4.5 0V7" stroke="#fff" stroke-width=".7" opacity=".13"/><path d="M2.7 0V7 M6.2 0V7" stroke="#08090b" stroke-width=".9" opacity=".52"/></pattern>
            <filter id="dkSoft" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
            <filter id="dkInset" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/><feOffset dy="3" result="o"/><feFlood flood-color="#000" flood-opacity=".8"/><feComposite in2="o" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="dkLedBloom" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <style>#deckMicPanel{transform:matrix(.72,0,0,.72,-40,188)}</style>
        <rect width="2000" height="600" rx="8" fill="url(#dkFace)"/>
        <rect width="2000" height="600" rx="8" fill="url(#dkFine)" opacity=".92"/>
        <path d="M12 5H1988" stroke="#fff" stroke-width="3" opacity=".25"/><path d="M12 592H1988" stroke="#000" stroke-width="8" opacity=".78"/>
        <rect x="22" y="18" width="1956" height="560" rx="5" fill="none" stroke="#3e4249" stroke-width="2"/><rect x="27" y="23" width="1946" height="550" rx="4" fill="none" stroke="#050608" stroke-width="1.5"/>
        <path d="M222 82V480 M842 82V480 M1054 82V480 M1742 82V480" stroke="#41454c" stroke-width="2" opacity=".72"/>

        <!-- 실물의 작은 금색 워드마크 -->
        <g fill="#d1b464">
            <path d="M242 43H267V64H258V52Q258 48 254 48H242Z M242 43Q250 43 258 51L267 60V43Z" opacity=".95"/>
            <text x="275" y="62" font-family="Arial" font-size="17" font-weight="700">Nakamichi</text>
            <text x="378" y="63" font-family="Arial Narrow,Arial" font-size="24" font-weight="700" letter-spacing="2.4">DRAGON</text>
            <text x="514" y="62" font-family="Arial" font-size="11" font-weight="600" letter-spacing=".5">Auto Reverse Cassette Deck</text>
        </g>
        <g font-family="Arial" font-size="8.5" font-weight="700" letter-spacing="1.5" fill="#777b82"><text x="850" y="64">DOLBY B-C NR</text><text x="1058" y="64">QUARTZ DD &#183; SILENT MECHANISM &#183; MICROPROCESSOR CONTROL</text></g>

        <!-- 좌측 독립 조작 열: POWER / TIMER / EJECT / PHONES -->
        <g>
            <text x="126" y="92" font-family="Arial" font-size="9" letter-spacing="1.3" fill="#a5a18f" text-anchor="middle">POWER</text>
            <rect x="79" y="104" width="94" height="58" rx="3" fill="#020305" opacity=".7" filter="url(#dkSoft)"/>
            <rect x="75" y="98" width="94" height="58" rx="3" fill="url(#dkKey)" stroke="#5f6369" stroke-width="1.5"/><path d="M82 104H162" stroke="#fff" opacity=".17"/>
            <text x="126" y="192" font-family="Arial" font-size="8.5" letter-spacing="1.2" fill="#9c9887" text-anchor="middle">TIMER</text>
            <rect x="84" y="204" width="36" height="25" rx="3" fill="url(#dkSwitch)" stroke="#555960"/><rect x="130" y="204" width="36" height="25" rx="3" fill="url(#dkSwitch)" stroke="#555960"/>
            <g font-family="Arial" font-size="7.5" fill="#777b82" text-anchor="middle"><text x="102" y="244">OFF / ON</text><text x="148" y="244">PLAY / REC</text></g>
            <circle cx="126" cy="267" r="10" fill="#160909" stroke="#4b2a28"/><circle id="deckTimerLed" cx="126" cy="267" r="5.5" fill="#3a1210"><title>TIMER — 예약 녹음 대기</title></circle>
            <rect x="70" y="306" width="112" height="68" rx="4" fill="#000" opacity=".65" filter="url(#dkSoft)"/>
            <rect id="deckBtnEject" x="66" y="298" width="112" height="68" rx="4" fill="url(#dkKey)" stroke="#62666c" stroke-width="1.6" style="cursor:pointer"><title>EJECT — 테이프를 랙에 넣고 새 공테이프 장착</title></rect>
            <path d="M101 339H143 M108 329L122 316L136 329" fill="none" stroke="#d7d7d3" stroke-width="4" pointer-events="none"/><text x="122" y="356" font-family="Arial" font-size="8" letter-spacing="1.5" fill="#8b8f94" text-anchor="middle" pointer-events="none">EJECT</text>
            <text x="122" y="396" font-family="Arial" font-size="9" letter-spacing="1.3" fill="#a5a18f" text-anchor="middle">PHONES</text><circle cx="122" cy="418" r="17" fill="#191b20" stroke="#73777d" stroke-width="2.5"/><circle cx="122" cy="418" r="8" fill="#020304"/>
        </g>

        <!-- 카세트 도어: 전체 셸 대신 실물처럼 작은 관찰창만 노출 -->
        <ellipse cx="540" cy="486" rx="310" ry="15" fill="#000" opacity=".68" filter="url(#dkSoft)"/>
        <rect x="236" y="88" width="604" height="396" rx="6" fill="#010203" opacity=".72" filter="url(#dkSoft)"/>
        <rect id="dragonCassetteDoor" x="238" y="84" width="596" height="392" rx="5" fill="url(#dkDoor)" stroke="url(#dkRail)" stroke-width="4"/>
        <rect x="249" y="96" width="574" height="368" rx="3" fill="none" stroke="#07090c" stroke-width="3"/><path d="M256 102H816" stroke="#fff" stroke-width="2" opacity=".09"/>
        <rect x="348" y="112" width="370" height="78" rx="3" fill="#030506" stroke="#33383e" stroke-width="2"/>
        <path d="M360 121H706" stroke="#fff" opacity=".08"/>
        <path d="M380 153H442L425 143M380 153L425 163 M686 153H624L641 143M686 153L641 163" fill="none" stroke="#6f7b6d" stroke-width="3"/>
        <path id="deckNaacTrace" d="M448 153H618" fill="none" stroke="#b89d58" stroke-width="2" stroke-dasharray="8 5"/>
        <circle cx="533" cy="153" r="11" fill="#102018" stroke="#375141"/><circle cx="533" cy="153" r="7" fill="#6ee58b" opacity=".24" filter="url(#dkLedBloom)"/><circle id="deckNaacLed" cx="533" cy="153" r="4.5" fill="#6ee58b"/>
        <g font-family="Arial" font-size="8.5" font-weight="700" fill="#8c928c"><text x="374" y="181">DIRECTION</text><text x="692" y="181" text-anchor="end">AUTO AZIMUTH</text></g>

        <rect id="dragonCassetteShell" x="383" y="207" width="306" height="106" rx="5" fill="url(#dkCassette)" stroke="#575c61" stroke-width="2"/>
        <rect id="dragonReelWindow" x="391" y="214" width="290" height="92" rx="4" fill="url(#dkWindow)" stroke="#13171a" stroke-width="3"/>
        <path d="M397 220H675" stroke="#fff" stroke-width="1.5" opacity=".09"/>
        ${dragonReel("L", 450, 40)}${dragonReel("R", 622, 24)}
        <path d="M484 229Q536 214 600 238 M484 291Q536 307 600 282" fill="none" stroke="url(#dkTape)" stroke-width="4.5" opacity=".72"/>
        <path d="M468 297H604L587 315H485Z" fill="#24272b" stroke="#5a5f64"/><circle cx="495" cy="304" r="5" fill="#0e1012"/><circle cx="577" cy="304" r="5" fill="#0e1012"/>
        <text id="deckLabel" x="536" y="342" font-family="Arial" font-size="12.5" font-weight="700" letter-spacing=".4" fill="#aaa58f" text-anchor="middle">C-30 공테이프</text>
        <text id="deckLabelSub" x="536" y="361" font-family="Arial" font-size="9.5" font-weight="600" fill="#6f736f" text-anchor="middle">사용 0:00 / 30:00</text>
        <text x="536" y="389" font-family="Arial Narrow,Arial" font-size="19" font-weight="700" font-style="italic" letter-spacing="2" fill="#b7a267" text-anchor="middle">NAAC</text>
        <path d="M326 414H740" stroke="#34383e"/><text x="536" y="446" font-family="Arial" font-size="7.8" letter-spacing="1.1" fill="#666a70" text-anchor="middle">DISCRETE 3 HEAD &#183; DOUBLE DIRECT DRIVE CAPSTAN &#183; SILENT MECHANISM</text>
        <path d="M251 99H468L304 462H251Z" fill="url(#dkGlass)" opacity=".38" pointer-events="none"/>

        <!-- 중앙의 4자리 카운터와 실물형 세로 20세그먼트 미터 -->
        <rect x="852" y="88" width="194" height="390" rx="5" fill="#090b0e" stroke="#3f4349" stroke-width="2"/>
        <path d="M860 96H1038" stroke="#fff" opacity=".1"/>
        <rect x="868" y="108" width="162" height="58" rx="3" fill="#020304" stroke="#24282d" stroke-width="2"/>
        <text id="deckCounter" x="1018" y="145" font-family="'Courier New',monospace" font-size="27" font-weight="700" fill="#ff5039" text-anchor="end" style="filter:drop-shadow(0 0 4px rgba(255,73,49,.42))">00:00</text>
        <text id="deckCounterMax" x="1026" y="182" font-family="Arial" font-size="8.5" font-weight="700" fill="#565c61" text-anchor="end">/ 30:00</text>
        <text x="870" y="183" font-family="Arial" font-size="8" font-weight="700" letter-spacing="1.2" fill="#70757b">TAPE COUNTER</text>
        <rect x="870" y="192" width="82" height="274" rx="3" fill="#020504" stroke="#26302b" stroke-width="1.5"/>
        ${dragonPeakRow("deckVuL", 882)}
        ${dragonPeakRow("deckVuR", 914)}
        <g font-family="Arial" font-size="8" font-weight="700" fill="#626b66"><text x="891" y="476">L</text><text x="923" y="476">R</text><text x="954" y="462">-40</text><text x="954" y="396">-20</text><text x="954" y="330">-10</text><text x="954" y="264">0</text><text x="954" y="203" fill="#8d5848">+10</text></g>
        <g font-family="Arial" font-size="7.7" font-weight="700" fill="#81858b" text-anchor="middle">
            <rect x="975" y="205" width="56" height="35" rx="3" fill="url(#dkKey)" stroke="#4b4f55"/><text x="1003" y="227">RESET</text>
            <rect x="975" y="250" width="56" height="50" rx="3" fill="url(#dkKey)" stroke="#4b4f55"/><text x="1003" y="271">MEMORY</text><text x="1003" y="286" font-size="6.8">OFF / ON</text>
            <rect x="975" y="310" width="56" height="42" rx="3" fill="url(#dkKey)" stroke="#4b4f55"/><text x="1003" y="327">STOP</text><text x="1003" y="341" font-size="6.8">/ PLAY</text>
            <rect x="975" y="362" width="56" height="42" rx="3" fill="url(#dkKey)" stroke="#4b4f55"/><text x="1003" y="380">AUTO REV</text><text x="1003" y="394" font-size="6.8">1 / CONT</text>
        </g>
        <rect x="970" y="426" width="66" height="32" rx="3" fill="#111419" stroke="#474b51"/><text id="deckAutoRevLbl" x="1003" y="447" font-family="Arial" font-size="8" font-weight="700" letter-spacing=".7" fill="#858993" text-anchor="middle" style="cursor:pointer">AUTO REV ON</text>

        <!-- 우측 중앙: Dragon 고유의 4행 경사 버튼 매트릭스 -->
        <rect x="1064" y="88" width="662" height="390" rx="5" fill="#0b0d10" stroke="#33373d" stroke-width="2"/><path d="M1072 96H1718" stroke="#fff" opacity=".08"/>
        <g id="deckTransport">
            ${dragonKey(null, 1080, 106, "REV PLAY", "&#9664;", null)}
            ${dragonKey("deckBtnStop", 1174, 106, "STOP", "&#9632;", null)}
            ${dragonKey("deckBtnPlay", 1268, 106, "PLAY", "&#9654;", "#6e785e")}
            ${dragonKey("deckBtnRew", 1080, 183, "REW", "&#9664;&#9664;", null)}
            ${dragonKey(null, 1174, 183, "CUE", "&#9670;", null)}
            ${dragonKey("deckBtnFf", 1268, 183, "FF", "&#9654;&#9654;", null)}
            ${dragonKey(null, 1080, 260, "REC MUTE", "&#9675;", null)}
            ${dragonKey(null, 1174, 260, "PAUSE", "&#10074;&#10074;", null)}
            ${dragonKey("deckBtnRec", 1268, 260, "REC", "&#9679;", "#8e3933")}
            <circle cx="1335" cy="273" r="8" fill="#2b0c09" stroke="#66312c"/><circle id="deckRecLed" cx="1335" cy="273" r="4.5" fill="#3a1210"/>
            ${dragonKey(null, 1080, 337, "DOWN", "&#9664;", null)}
            ${dragonKey(null, 1174, 337, "AUTO FADER", "&#8596;", "#8d7543")}
            ${dragonKey(null, 1268, 337, "UP", "&#9654;", null)}
        </g>

        <!-- 테이프별 수동 LEVEL / BIAS 캘리브레이션 -->
        <g font-family="Arial" font-size="8" font-weight="700" fill="#8f938f" text-anchor="middle">
            <rect x="1370" y="106" width="105" height="55" rx="3" fill="url(#dkKey)" stroke="#51555b"/><text x="1422" y="128">LEVEL</text><text x="1422" y="143" font-size="7">400 Hz</text>
            <rect x="1485" y="106" width="72" height="55" rx="3" fill="url(#dkKey)" stroke="#51555b"/><text x="1521" y="137">RESET</text>
            <rect x="1567" y="106" width="105" height="55" rx="3" fill="url(#dkKey)" stroke="#51555b"/><text x="1619" y="128">BIAS</text><text x="1619" y="143" font-size="7">15 kHz</text>
        </g>
        <g font-family="Arial" font-size="8" font-weight="700" fill="#9a9da1" text-anchor="middle">
            ${[0,1,2].map((i) => {
                const y = 216 + i * 83;
                const tape = ["EX", "SX", "ZX"][i];
                return '<circle cx="1396" cy="' + y + '" r="19" fill="#06070a" stroke="#5d6167"/><circle cx="1396" cy="' + y + '" r="14" fill="url(#dkKnob)"/><path d="M1396 ' + (y - 13) + 'V' + (y - 6) + '" stroke="#cdbf91" stroke-width="2.5"/>' +
                    '<circle cx="1450" cy="' + y + '" r="19" fill="#06070a" stroke="#5d6167"/><circle cx="1450" cy="' + y + '" r="14" fill="url(#dkKnob)"/><path d="M1450 ' + (y - 13) + 'V' + (y - 6) + '" stroke="#cdbf91" stroke-width="2.5"/>' +
                    '<rect x="1486" y="' + (y - 24) + '" width="70" height="48" rx="3" fill="url(#dkKey)" stroke="#4f5359"/><text x="1521" y="' + (y + 4) + '" font-size="12" fill="#b9a465">' + tape + '</text>' +
                    '<circle cx="1594" cy="' + y + '" r="19" fill="#06070a" stroke="#5d6167"/><circle cx="1594" cy="' + y + '" r="14" fill="url(#dkKnob)"/><path d="M1594 ' + (y - 13) + 'V' + (y - 6) + '" stroke="#cdbf91" stroke-width="2.5"/>' +
                    '<circle cx="1648" cy="' + y + '" r="19" fill="#06070a" stroke="#5d6167"/><circle cx="1648" cy="' + y + '" r="14" fill="url(#dkKnob)"/><path d="M1648 ' + (y - 13) + 'V' + (y - 6) + '" stroke="#cdbf91" stroke-width="2.5"/>' +
                    '<text x="1396" y="' + (y + 31) + '">L</text><text x="1450" y="' + (y + 31) + '">R</text><text x="1594" y="' + (y + 31) + '">L</text><text x="1648" y="' + (y + 31) + '">R</text>';
            }).join("")}
        </g>

        <!-- 우측 끝: MASTER / L / R / OUTPUT과 실제 필터 스위치 열 -->
        <rect x="1750" y="88" width="218" height="390" rx="5" fill="#0b0d10" stroke="#33373d" stroke-width="2"/><path d="M1758 96H1960" stroke="#fff" opacity=".08"/>
        <g font-family="Arial" font-size="8" font-weight="700" fill="#99958a" text-anchor="middle">
            ${[0,1,2,3].map((i) => {
                const y = 137 + i * 84;
                const label = ["MASTER", "LEFT", "RIGHT", "OUTPUT"][i];
                return '<text x="1798" y="' + (y - 29) + '">' + label + '</text><circle cx="1798" cy="' + y + '" r="27" fill="#040507" stroke="#575b61"/><circle cx="1798" cy="' + y + '" r="21" fill="url(#dkKnob)"/><path d="M1798 ' + (y - 20) + 'V' + (y - 10) + '" stroke="#d0c18f" stroke-width="3"/><path d="M1767 ' + y + 'H1775 M1821 ' + y + 'H1829" stroke="#555960"/>';
            }).join("")}
        </g>
        <g font-family="Arial" font-size="7.5" font-weight="700" fill="#85898f">
            ${["MONITOR", "EQ 120 / 70", "DOLBY NR", "B / C TYPE", "MPX FILTER", "SUBSONIC", "AUTO REC PAUSE"].map((label, i) => {
                const y = 112 + i * 43;
                return '<rect x="1852" y="' + y + '" width="34" height="25" rx="3" fill="url(#dkSwitch)" stroke="#555960"/><rect x="1857" y="' + (y + 4) + '" width="13" height="17" rx="2" fill="#7b7f84" opacity=".45"/><text x="1895" y="' + (y + 16) + '">' + label + '</text>';
            }).join("")}
        </g>

        <!-- 앱 전용 입력/보관 베이는 실물 전면과 분리된 낮은 하단 영역 -->
        <path d="M40 490H1046 M1070 490H1960" stroke="#44484e"/><path d="M40 493H1046 M1070 493H1960" stroke="#000" stroke-width="3" opacity=".7"/>
        <rect x="32" y="498" width="246" height="78" rx="5" fill="#090b0f" opacity=".64"/>
        <text x="292" y="566" font-family="Arial" font-size="7.5" letter-spacing="1.1" fill="#555a61">LINE / MIC INPUT</text>
        <rect x="1070" y="500" width="890" height="82" rx="5" fill="#090b0f" opacity=".7"/><text x="1090" y="517" font-family="Arial" font-size="8" letter-spacing="1.5" fill="#666b72">TAPE LIBRARY</text>
        <ellipse cx="150" cy="590" rx="92" ry="7" fill="#000" opacity=".72"/><ellipse cx="1850" cy="590" rx="92" ry="7" fill="#000" opacity=".72"/><rect x="102" y="574" width="96" height="17" rx="3" fill="#090a0d"/><rect x="1802" y="574" width="96" height="17" rx="3" fill="#090a0d"/>
        <g id="deckShelf" transform="translate(0 80)"></g>
        </svg>` : DECK_MODELS[deckModelId].svg;
    applyPanelLighting(document.querySelector("#deckStage svg"));
    document.getElementById("deckBtnPlay").addEventListener("click", deckPlay);
    document.getElementById("deckBtnStop").addEventListener("click", deckStopTransport);
    document.getElementById("deckBtnRec").addEventListener("click", deckRec);
    document.getElementById("deckBtnEject").addEventListener("click", deckEject);
    const bindWind = (id, dir) => {
        const b = document.getElementById(id);
        const start = () => {
            if (!deckGuardReservedRec()) return;
            if ((recorder && !recOnB) || deckMode === "rec") return;
            if (deckMode === "play") { audio.pause(); deckSegPlaying = null; deckPlaying = false; }
            deckWindTarget = null;
            deckMode = "wind";
            windDir = dir;
        };
        const stop = () => { if (deckMode === "wind") { deckMode = "stop"; windDir = 0; deckWindTarget = null; deckSyncTape(); } };
        b.addEventListener("pointerdown", (e) => {
            start();
            try { b.setPointerCapture(e.pointerId); } catch (err) {}
            e.preventDefault();
        });
        b.addEventListener("pointerup", stop);
        b.addEventListener("pointercancel", stop);
        // 키보드: 누르는 동안 감기 (keydown 반복은 무시, keyup에 정지)
        b.setAttribute("tabindex", "0");
        b.setAttribute("role", "button");
        const t = b.querySelector("title");
        b.setAttribute("aria-label", t ? t.textContent : "");
        b.addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                e.preventDefault();
                start();
            }
        });
        b.addEventListener("keyup", (e) => {
            if (e.key === "Enter" || e.key === " ") stop();
        });
    };
    bindWind("deckBtnRew", -1);
    bindWind("deckBtnFf", 1);
    ["deckBtnPlay", "deckBtnStop", "deckBtnRec", "deckBtnEject"].forEach((id) => svgButtonize(id));
    deckMountMicPanel();
    bindDeckFlip();
    if (typeof applyRecHeadroom === "function") applyRecHeadroom();
    if (deckModelId === "b215") bindB215Keys();
    if (isDoubleDeck()) bindW990Dub();
    if (deckModelId === "dragon") bindDragonPanel();
    bindDeckFrontPanel();
    if (!deckTape) deckTape = newBlankTape();
    deckRefreshShelf();
}

// ----- B215 컴퓨터 컨트롤 — ZERO LOC · ADDR LOC · AUTO CAL (죽어 있던 12키 소생) -----
// 키 배치: 6=MEM(주소 기억) 7=CUE(주소로 와인딩) 9=AUTO(캘리브레이션) 11=RST(0으로 와인딩)
function deckAutoWind(target, label) {
    if (!deckGuardReservedRec()) return;
    if ((recorder && !recOnB) || deckMode === "rec") { playerSubtext.textContent = "녹음 중에는 감을 수 없습니다."; return; }
    if (!deckTape) return;
    target = Math.max(0, Math.min(tapeLenOf(deckTape), target));
    if (deckMode === "play") { PlaybackController.invalidate(); audio.pause(); deckSegPlaying = null; deckPlaying = false; }
    if (Math.abs(target - tapePos) < 0.5) {
        deckMode = "stop";
        windDir = 0;
        playerSubtext.textContent = label + " — 이미 그 위치입니다.";
        return;
    }
    deckWindTarget = target;
    deckMode = "wind";
    windDir = target > tapePos ? 1 : -1;
    playerSubtext.textContent = label + " — " + formatDuration(target * 1000) + " 위치로 감는 중...";
}

function bindB215Keys() {
    const bind = (i, label, fn) => {
        const el = document.getElementById("deckKeyR" + i);
        if (!el) return;
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", label);
        el.addEventListener("click", fn);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
        });
    };
    bind(6, "MEM — 현재 카운터 위치 기억", () => {
        deckLocAddr = tapePos;
        playerSubtext.textContent = "MEM — " + formatDuration(tapePos * 1000) + " 위치를 기억했습니다. CUE로 되돌아옵니다.";
    });
    bind(7, "CUE — 기억한 위치로 자동 와인딩", () => {
        if (deckLocAddr == null) { playerSubtext.textContent = "기억된 위치가 없습니다 — MEM을 먼저 누르세요."; return; }
        deckAutoWind(deckLocAddr, "ADDR LOC");
    });
    bind(9, "AUTO — 테이프 캘리브레이션 (히스 감소)", () => {
        if (!deckTape) return;
        if (deckTape.cal) { playerSubtext.textContent = "이미 캘리브레이션된 테이프입니다."; return; }
        if (deckMode !== "stop" || (recorder && !recOnB)) { playerSubtext.textContent = "정지 상태에서 AUTO CAL을 실행하세요."; return; }
        const tape = deckTape;
        playerSubtext.textContent = "AUTO CAL — 바이어스·감도 측정 중...";
        setTimeout(() => {
            tape.cal = true;
            tapeMetaSave();
            playerSubtext.textContent = "AUTO CAL 완료 — 「" + tape.label + "」의 히스 플로어가 내려갔습니다.";
        }, 2000);
    });
    bind(11, "RST — 카운터 0으로 자동 와인딩 (ZERO LOC)", () => deckAutoWind(0, "ZERO LOC"));
    // 나머지 8키 소생 — 실물 B215의 키 배치를 따른다
    bind(0, "BIAS — 수동 캘리브레이션 1/3", () => b215ManualCal("bias", "BIAS — 400Hz 기준 톤으로 바이어스를 맞췄습니다"));
    bind(1, "EQ — 수동 캘리브레이션 2/3", () => b215ManualCal("eq", "EQ — 10kHz 고역 응답을 맞췄습니다"));
    bind(2, "CAL — 수동 캘리브레이션 3/3", () => b215ManualCal("cal", "CAL — 감도(레벨)를 맞췄습니다"));
    bind(3, "MON — 모니터 소거/복귀", () => {
        audio.muted = !audio.muted;
        if (typeof tsSyncPanel === "function") tsSyncPanel();
        playerSubtext.textContent = audio.muted ? "MONITOR CUT — 모니터를 소거했습니다 (녹음은 계속)." : "MONITOR ON";
    });
    bind(4, "MPX — FM 파일럿 톤 필터 (녹음)", () => {
        fpSet("rec.mpx", !fpGet("rec.mpx", false));
        fpNote(fpGet("rec.mpx", false) ? "MPX FILTER ON — FM 녹음의 19kHz 파일럿을 걸러냅니다." : "MPX FILTER OFF");
    });
    bind(5, "NR — 돌비 OFF/B/C 순환 (재생 히스)", () => deckCycleNr());
    bind(8, "REP — 테이프가 끝나면 되감아 이어 재생", () => {
        dragonRepeat = !dragonRepeat;
        playerSubtext.textContent = dragonRepeat ? "REPEAT ON — 끝나면 되감아 처음부터 다시 재생합니다." : "REPEAT OFF";
    });
    bind(10, "TIME — 카운터 잔량/경과 전환", () => deckToggleTimeMode());
}

// ----- 프런트패널 소생 (데크 공통) — 그려져 있던 캘리브레이션·NR·레벨 조작 배선 -----
let deckTimeRemaining = false;   // TIME/COUNTER — 카운터를 잔량(-) 표시로 (세션)
let deckBlankScan = false;       // W-990RX BLANK SCAN — 재생 중 빈 구간 건너뜀 (세션)

// 재생 히스 배율 — DOLBY NR(재생)과 테이프 타입(DRAGON I/II/IV)의 곱
function deckHissMult() {
    const nr = fpGet("deck." + deckModelId + ".nr", "off");
    const tape = deckModelId === "dragon" ? fpGet("deck.tapeType", "II") : "II";
    return (nr === "b" ? 0.55 : nr === "c" ? 0.3 : 1) * (tape === "I" ? 1.3 : tape === "IV" ? 0.7 : 1);
}

function deckCycleNr(order) {
    const key = "deck." + deckModelId + ".nr";
    const kinds = order || ["off", "b", "c"];
    const next = kinds[(kinds.indexOf(fpGet(key, "off")) + 1) % kinds.length];
    fpSet(key, next);
    fpNote("DOLBY NR " + next.toUpperCase() + (next === "off" ? " — 히스 그대로" : next === "b" ? " — 재생 히스를 절반으로" : " — 재생 히스 최소"));
}

function deckToggleTimeMode() {
    deckTimeRemaining = !deckTimeRemaining;
    playerSubtext.textContent = deckTimeRemaining ? "TIME — 카운터가 남은 시간을 보여줍니다." : "COUNTER — 카운터가 경과 위치를 보여줍니다.";
}

// B215 수동 캘리브레이션 — BIAS→EQ→CAL 세 키를 다 누르면 AUTO CAL과 같은 결과
function b215ManualCal(step, msg) {
    if (!deckTape) { playerSubtext.textContent = "테이프를 먼저 장착하세요."; return; }
    if (deckTape.cal) { playerSubtext.textContent = "이미 캘리브레이션된 테이프입니다."; return; }
    deckTape.calSteps = deckTape.calSteps || {};
    deckTape.calSteps[step] = true;
    const done = ["bias", "eq", "cal"].filter((s) => deckTape.calSteps[s]).length;
    if (done >= 3) {
        deckTape.cal = true;
        delete deckTape.calSteps;
        tapeMetaSave();
        playerSubtext.textContent = "수동 캘리브레이션 완료 — 「" + deckTape.label + "」의 히스 플로어가 내려갔습니다.";
    } else {
        playerSubtext.textContent = msg + " (" + done + "/3)";
    }
}

function bindDeckFrontPanel() {
    const svg = document.querySelector("#deckStage svg");
    if (!svg || typeof fpKnob !== "function") return;
    const pct = (v) => Math.round(v * 100) + "%";
    const biasFmt = (v) => (v > 0 ? "+" : "") + Math.round(v * 100) + "% (고역 " + (v > 0 ? "밝게" : v < 0 ? "어둡게" : "평탄") + ")";
    if (deckModelId === "dragon") {
        fpKnob(svg, 1570, 300, 26, "rec.bias", { label: "BIAS — 녹음 고역 성향", min: -1, max: 1, def: 0, fmt: biasFmt, ink: "#d6c48f" });
        fpKnob(svg, 1640, 300, 26, "rec.level", { label: "LEVEL — 녹음 레벨", min: 0.4, max: 2, def: 1, fmt: pct, ink: "#d6c48f" });
        fpButton(svg, 1690, 278, 72, 54, "테이프 타입", "TAPE — I/II/IV 순환 (히스 바닥이 달라진다)", () => {
            const order = ["I", "II", "IV"];
            const next = order[(order.indexOf(fpGet("deck.tapeType", "II")) + 1) % 3];
            fpSet("deck.tapeType", next);
            fpNote("TAPE TYPE " + next + (next === "I" ? " — 노멀: 히스가 많다" : next === "II" ? " — 크롬: 기준" : " — 메탈: 가장 정숙"));
        });
        fpButton(svg, 1786, 278, 72, 54, "돌비 NR", "DOLBY NR — OFF/B/C 순환 (재생 히스)", () => deckCycleNr());
        fpButton(svg, 1878, 278, 40, 54, "MPX 필터", "MPX — FM 파일럿 톤 필터 (녹음)", () => {
            fpSet("rec.mpx", !fpGet("rec.mpx", false));
            fpNote(fpGet("rec.mpx", false) ? "MPX FILTER ON" : "MPX FILTER OFF");
        });
    } else if (deckModelId === "tcd3014") {
        fpKnob(svg, 106, 238, 32, "rec.bias", { label: "BIAS — 녹음 고역 성향", min: -1, max: 1, def: 0, fmt: biasFmt });
        fpKnob(svg, 180, 238, 32, "rec.levelL", { label: "LEVEL L — 좌채널 녹음 레벨", min: 0.4, max: 2, def: 1, fmt: pct });
        fpKnob(svg, 254, 238, 32, "rec.levelR", { label: "LEVEL R — 우채널 녹음 레벨", min: 0.4, max: 2, def: 1, fmt: pct });
        fpKnob(svg, 328, 238, 32, "deck.out", { label: "OUTPUT — 데크 재생 출력", min: 0.4, max: 1.6, def: 1, fmt: pct, apply: () => applyGainStaging() });
    } else if (deckModelId === "ctf1250") {
        fpButton(svg, 76, 202, 58, 60, "돌비 NR", "DOLBY NR — OFF/B 전환 (재생 히스)", () => deckCycleNr(["off", "b"]));
        fpKnob(svg, 182, 232, 30, "rec.bias", { label: "BIAS — 녹음 고역 성향", min: -1, max: 1, def: 0, fmt: biasFmt, ink: "#4b4e51" });
        fpKnob(svg, 260, 232, 30, "rec.level", { label: "REC LEVEL — 녹음 레벨", min: 0.4, max: 2, def: 1, fmt: pct, ink: "#4b4e51" });
        fpKnob(svg, 338, 232, 30, "deck.out", { label: "OUTPUT — 데크 재생 출력", min: 0.4, max: 1.6, def: 1, fmt: pct, ink: "#4b4e51", apply: () => applyGainStaging() });
    } else if (isDoubleDeck()) {
        fpButton(svg, 26, 190, 66, 76, "전원", "POWER — 시스템 재생/정지", () => togglePlay());
        fpButton(svg, 1854, 82, 62, 58, "B웰 배출", "EJECT II — B웰 카세트를 랙으로 배출", () => {
            if (recorder && recOnB) { playerSubtext.textContent = "녹음 중에는 배출할 수 없습니다 — REC를 먼저 멈추세요."; return; }
            if (!deckBTape) { playerSubtext.textContent = "B웰이 비어 있습니다."; return; }
            deckBTape = null;
            deckRefreshShelf();
            playerSubtext.textContent = "EJECT — B웰 카세트를 랙에 보관했습니다.";
        });
        fpKnob(svg, 1920, 218, 28, "rec.level", { label: "REC LEVEL — 녹음 레벨", min: 0.4, max: 2, def: 1, fmt: pct });
        fpButton(svg, 1206, 248, 86, 52, "일시정지", "PAUSE — 카운터 위치를 지키며 멈춤", () => {
            if (deckMode === "play" || deckMode === "wind") {
                deckStopTransport();
                playerSubtext.textContent = "PAUSE — 위치를 지킨 채 멈췄습니다. PLAY로 이어집니다.";
            }
        });
        const key = (i, label, title, fn) => {
            const el = document.getElementById("deckModeKey" + i);
            if (!el) return;
            el.setAttribute("style", "cursor:pointer");
            el.addEventListener("click", fn);
            svgButtonize(el, label);
            const t = document.createElementNS(SVG_NS, "title");
            t.textContent = title;
            el.appendChild(t);
        };
        key(0, "카운터 모드", "COUNTER — 잔량/경과 표시 전환", () => deckToggleTimeMode());
        key(1, "돌비 B", "DOLBY B — 재생 히스 절반", () => {
            fpSet("deck.w990.nr", fpGet("deck.w990.nr", "off") === "b" ? "off" : "b");
            fpNote("DOLBY " + (fpGet("deck.w990.nr", "off") === "b" ? "B ON" : "OFF"));
        });
        key(2, "돌비 C", "DOLBY C — 재생 히스 최소", () => {
            fpSet("deck.w990.nr", fpGet("deck.w990.nr", "off") === "c" ? "off" : "c");
            fpNote("DOLBY " + (fpGet("deck.w990.nr", "off") === "c" ? "C ON" : "OFF"));
        });
        key(5, "싱크 더빙", "SYNC — A→B 동조 더빙 시작", () => {
            playerSubtext.textContent = "SYNC DUB — A웰과 B웰을 동조시켜 더빙을 시작합니다.";
            w990StartDub();
        });
        key(6, "블랭크 스캔", "BLANK SCAN — 재생 중 빈 구간 건너뜀", () => {
            deckBlankScan = !deckBlankScan;
            playerSubtext.textContent = deckBlankScan ? "BLANK SCAN ON — 빈 구간을 만나면 다음 수록곡으로 건너뜁니다." : "BLANK SCAN OFF";
        });
        fpButton(svg, 862, 470, 90, 42, "더빙 모니터", "MONITOR — SOURCE/TAPE 모니터 소거 전환", () => {
            audio.muted = !audio.muted;
            if (typeof tsSyncPanel === "function") tsSyncPanel();
            playerSubtext.textContent = audio.muted ? "MONITOR CUT — 더빙 소리를 소거합니다 (더빙은 계속)." : "MONITOR ON";
        });
        fpButton(svg, 1896, 280, 48, 44, "헤드폰 단자", "PHONES — 실물이라면 여기 꽂았을 단자", () =>
            fpNote("PHONES — 브라우저에서는 시스템 볼륨이 헤드폰의 역할을 합니다."));
    }
}

// ----- 카세트 뒤집기 히트 — 어느 스킨이든 라벨 판이 곧 손잡이다 -----
function bindDeckFlip() {
    const label = document.getElementById("deckLabel");
    const svg = document.querySelector("#deckStage svg");
    if (!label || !svg) return;
    let bb = null;
    try { bb = label.getBBox(); } catch (e) {}
    if (!bb || !bb.width) bb = { x: 480, y: 140, width: 500, height: 60 };
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", bb.x - 46);
    r.setAttribute("y", bb.y - 16);
    r.setAttribute("width", bb.width + 92);
    r.setAttribute("height", bb.height + 46);
    r.setAttribute("fill", "#000");
    r.setAttribute("fill-opacity", "0");
    r.setAttribute("style", "cursor:pointer");
    r.setAttribute("tabindex", "0");
    r.setAttribute("role", "button");
    r.setAttribute("aria-label", "카세트 뒤집기 — SIDE A/B 전환");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = "카세트 뒤집기 — 정지 상태에서 라벨을 누르면 반대 면(SIDE A/B)으로";
    r.appendChild(t);
    svg.appendChild(r);
    r.addEventListener("click", flipTape);
    r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipTape(); } });
}

// ----- DRAGON — AUTO REVERSE(리피트) 토글 + NAAC 표시 -----
// 진짜 양면 테이프 모델은 별도 설계가 필요하므로, 오토 리버스는 '끝나면 되감아
// 이어 재생'하는 리피트로 해석한다 (3모터 데크의 자동 반전 감각).
function bindDragonPanel() {
    const lbl = document.getElementById("deckAutoRevLbl");
    if (!lbl) return;
    lbl.setAttribute("tabindex", "0");
    lbl.setAttribute("role", "button");
    lbl.setAttribute("aria-label", "오토 리버스 — 테이프가 끝나면 되감아 이어 재생");
    const toggle = () => {
        dragonRepeat = !dragonRepeat;
        lbl.setAttribute("fill", dragonRepeat ? "#6ee58b" : "#858993");
        playerSubtext.textContent = dragonRepeat
            ? "AUTO REVERSE ON — 테이프가 끝나면 되감아 이어 재생합니다."
            : "AUTO REVERSE OFF";
    };
    lbl.addEventListener("click", toggle);
    lbl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
}

// ----- W-990RX 더빙 버스 — DECK I PLAY ▶ DECK II RECORD (그려져 있던 패널 배선) -----
// 고속 더빙은 실시간 캡처가 아니라 세그먼트의 '실복사'다: A웰 테이프의 각 구간 blob을
// 복제해 IndexedDB에 새 녹음으로 영속하고 B웰 카세트에 싣는다 — 결과물은 정상 속도.
// 릴이 고속으로 도는 연출 시간은 수록 길이 / (HIGH 30배 · NORMAL 15배).
async function w990StartDub() {
    if (w990DubBusy) { playerSubtext.textContent = "이미 더빙 중입니다."; return; }
    if (recorder) { playerSubtext.textContent = "녹음 중에는 더빙할 수 없습니다."; return; }
    if (!deckTape || !deckTape.segments.length) { playerSubtext.textContent = "A웰 테이프에 수록 내용이 없습니다 — TAPE RACK에서 장착하세요."; return; }
    if (deckMode !== "stop") { playerSubtext.textContent = "정지 상태에서 더빙을 시작하세요 (더빙 중엔 두 웰을 모두 씁니다)."; return; }
    w990DubBusy = true;
    const src = deckTape;
    const dst = newBlankTape(tapeLenOf(src));
    deckBTape = dst;
    deckBPos = 0;
    deckRefreshShelf();
    const used = tapeUsedSec(src);
    const theater = Math.max(2500, used / (w990DubHigh ? 30 : 15) * 1000);
    w990DubUntil = Date.now() + theater;
    playerSubtext.textContent = (w990DubHigh ? "HIGH-SPEED" : "NORMAL") + " DUBBING — A→B 복사 중... (" + Math.ceil(theater / 1000) + "초)";
    let copied = 0;
    let volatileCopies = 0;
    try {
        for (const seg of src.segments.slice()) {
            const blob = await fetch(seg.url).then((r) => r.blob());
            const record = {
                stationId: "dub", stationName: seg.name || "더빙",
                startedAt: new Date().toISOString(), durationMs: seg.dur * 1000,
                type: seg.type || blob.type || "audio/mp4",
                tapeId: dst.id, tapeStart: seg.start, tapeLen: tapeLenOf(dst), blob
            };
            const saved = await persistRecording(record);
            record.dbId = saved.ok ? saved.id : null;
            if (!saved.ok) {
                volatileCopies += 1;
                offerRecordingDownload(record, saved);
            }
            tapeAddSegment(dst, { start: seg.start, dur: seg.dur, url: URL.createObjectURL(blob), name: seg.name, dbId: record.dbId, type: record.type });
            copied++;
        }
        tapeMetaSave();
    } catch (e) { console.warn("더빙 복사 실패:", e); }
    const remain = w990DubUntil - Date.now();
    if (remain > 0) await new Promise((r) => setTimeout(r, remain));
    w990DubUntil = 0;
    w990DubBusy = false;
    dst.pos = 0;
    if (!copied) {
        deckBTape = null;
        tapes.splice(tapes.indexOf(dst), 1);
        playerSubtext.textContent = "더빙에 실패했습니다.";
    } else if (volatileCopies) {
        playerSubtext.textContent = "더빙은 완료됐지만 브라우저 저장소에 보관하지 못한 " + volatileCopies + "개 파일의 다운로드를 시작했습니다.";
    } else if (w990ContPlay) {
        playerSubtext.textContent = "더빙 완료 — 카세트 「" + dst.label + "」가 B웰에 대기합니다 (REV MODE: 릴레이).";
    } else {
        deckBTape = null;
        playerSubtext.textContent = "더빙 완료 — 카세트 「" + dst.label + "」를 되감아 테이프 랙에 보관했습니다.";
    }
    deckRefreshShelf();
}

function bindW990Dub() {
    const svg = document.querySelector("#deckStage svg");
    if (!svg) return;
    const addHit = (x, y, w, h, label, title, fn) => {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", x); r.setAttribute("y", y);
        r.setAttribute("width", w); r.setAttribute("height", h);
        r.setAttribute("fill", "#000"); r.setAttribute("fill-opacity", "0");
        r.setAttribute("style", "cursor:pointer");
        r.setAttribute("tabindex", "0");
        r.setAttribute("role", "button");
        r.setAttribute("aria-label", label);
        const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
        t.textContent = title;
        r.appendChild(t);
        svg.appendChild(r);
        r.addEventListener("click", fn);
        r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
        return r;
    };
    // 하단 더빙 버스: DECK I PLAY ▶ DECK II RECORD 흐름 전체가 시작 버튼
    addHit(432, 448, 342, 48, "A웰 → B웰 더빙 시작", "DUBBING — A웰 테이프를 B웰 카세트로 복사합니다", w990StartDub);
    // DUB SPEED 스위치 (NORMAL/HIGH)
    addHit(886, 444, 110, 28, "더빙 속도 전환", "DUB SPEED — HIGH / NORMAL", () => {
        w990DubHigh = !w990DubHigh;
        playerSubtext.textContent = "DUB SPEED: " + (w990DubHigh ? "HIGH — 릴이 빠르게 감깁니다" : "NORMAL");
    });
    // 센터 패널: DUBBING 키 = 더빙 시작, REV MODE 키 = 릴레이(CONT PLAY) 토글
    const dubKey = document.getElementById("deckModeKey4");
    if (dubKey) {
        dubKey.addEventListener("click", w990StartDub);
    }
    const revKey = document.getElementById("deckModeKey3");
    if (revKey) {
        revKey.addEventListener("click", () => {
            w990ContPlay = !w990ContPlay;
            revKey.setAttribute("stroke", w990ContPlay ? "#b9a46f" : "#4e5155");
            revKey.setAttribute("stroke-width", w990ContPlay ? "2" : "1");
            playerSubtext.textContent = w990ContPlay
                ? "REV MODE: 릴레이 — A면이 끝나면 B웰 테이프로 이어 재생합니다."
                : "REV MODE: 단면 — A면이 끝나면 정지합니다.";
        });
    }
}

// ----- REC INPUT (LINE/MIC) — 하단 좌측 입력 베이 -----
// 모든 데크 스킨이 비워 두는 좌하단(트랜스포트 왼쪽)에 공용으로 주입한다.
// 실제 데크의 마이크 단자 + 입력 셀렉터 문법: MIC로 전환하면 REC가 마이크를 녹음한다.
function deckMountMicPanel() {
    const svg = document.querySelector("#deckStage svg");
    if (!svg || svg.querySelector("#deckMicPanel")) return;
    const lzPrefix = svg.getAttribute("data-lz-prefix") || "";
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", "deckMicPanel");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", "녹음 입력 선택 — LINE(재생 소스) / MIC(마이크)");
    g.setAttribute("style", "cursor:pointer");
    g.innerHTML = '<title>REC INPUT — LINE은 지금 나오는 소리를, MIC는 마이크를 녹음합니다</title>' +
        '<rect x="112" y="434" width="272" height="72" rx="8" fill="#000" opacity=".38" filter="url(#' + lzPrefix + 'lzSoft)"/>' +
        '<rect x="108" y="430" width="272" height="72" rx="8" fill="#14161b" stroke="#3c4046" stroke-width="1.8"/>' +
        '<path d="M116 434 H372" stroke="#fff" stroke-width="1.6" opacity=".14"/>' +
        '<text x="124" y="451" font-family="Arial" font-size="10" letter-spacing="2" fill="#8a8e96">REC INPUT</text>' +
        '<circle cx="152" cy="479" r="14" fill="#23262c" stroke="#767b83" stroke-width="2.4"/>' +
        '<circle cx="152" cy="479" r="14" fill="url(#' + lzPrefix + 'lzInCirc)" opacity=".5"/>' +
        '<circle cx="152" cy="479" r="6.5" fill="#040507"/>' +
        '<rect x="200" y="444" width="26" height="52" rx="6" fill="#26262c"/>' +
        '<rect id="deckMicKnob" x="204" y="448" width="18" height="22" rx="3" fill="#55555c"/>' +
        '<text id="deckMicLineLbl" x="238" y="463" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1" fill="#c9cdd3">LINE</text>' +
        '<text id="deckMicMicLbl" x="238" y="493" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1" fill="#6a6e75">MIC</text>' +
        '<circle id="deckMicLed" cx="342" cy="475" r="6" fill="#3a1210"/>' +
        '<text x="342" y="496" font-family="Arial" font-size="8.5" letter-spacing="1.2" fill="#8a8e96" text-anchor="middle">MIC ON</text>';
    svg.appendChild(g);
    g.addEventListener("click", deckMicToggle);
    g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); deckMicToggle(); }
    });
    deckMicPaint();   // 스킨 교체 후에도 셀렉터 위치·LED가 상태를 따라간다
}

async function deckMicToggle() {
    // 녹음 소스는 시작 시점에 고정된다 — 진행 중에는 셀렉터를 잠근다 (예약 백그라운드 녹음은 무관)
    if (recorder && !activeResRec) {
        playerSubtext.textContent = recIsMic
            ? "마이크 녹음 중입니다 — REC 또는 정지로 먼저 저장하세요."
            : "녹음 중에는 입력을 바꿀 수 없습니다 — 먼저 녹음을 정지하세요.";
        return;
    }
    if (micArmed) {
        micDisable();
        playerSubtext.textContent = "녹음 입력: LINE — 지금 나오는 소리를 녹음합니다.";
        return;
    }
    try {
        if (!(await micEnable())) {
            playerSubtext.textContent = "이 브라우저에서는 마이크 입력을 지원하지 않습니다.";
            return;
        }
        micArmed = true;
        playerSubtext.textContent = "녹음 입력: MIC — REC를 누르면 마이크를 " +
            (isDoubleDeck() ? "B웰에 녹음합니다." : "테이프에 녹음합니다.");
    } catch (e) {
        playerSubtext.textContent = "마이크를 열 수 없습니다 — 브라우저의 마이크 권한을 허용해 주세요.";
    }
    deckMicPaint();
}

function deckMicPaint() {
    const knob = document.getElementById("deckMicKnob");
    if (knob) knob.setAttribute("y", micArmed ? "474" : "448");
    const led = document.getElementById("deckMicLed");
    if (led) led.style.fill = micArmed ? "#e8493a" : "#3a1210";
    const line = document.getElementById("deckMicLineLbl");
    const mic = document.getElementById("deckMicMicLbl");
    if (line) line.setAttribute("fill", micArmed ? "#6a6e75" : "#c9cdd3");
    if (mic) mic.setAttribute("fill", micArmed ? "#e8e3da" : "#6a6e75");
}

function deckSyncTape() {
    if (deckTape) deckTape.pos = tapePos;
    updateDeckLabel();
    deckRefreshShelf();
    deckStateSave();   // 트랜스포트가 멈춰 위치가 확정될 때마다 장착 상태를 남긴다
}

function deckRefreshShelf() {
    const shelf = document.getElementById("deckShelf");
    if (!shelf) return;
    const others = tapes.filter((t) => t !== deckTape && t !== deckBTape);
    // 보관함 입구 — 마지막 슬롯 자리에 카세트 크기의 '서랍' 카드로 상시 노출
    let html = '<g id="deckCaseBtn" role="button" tabindex="0" aria-label="테이프 보관함 열기" style="cursor:pointer">' +
        '<rect x="1792" y="430" width="156" height="72" rx="6" fill="#26292f" stroke="#5f646d" stroke-width="1.6" stroke-dasharray="6 3"/>' +
        '<text x="1870" y="461" font-family="Arial" font-size="13" font-weight="700" fill="#ccd0d6" text-anchor="middle">&#9656; 테이프 보관함</text>' +
        '<text x="1870" y="482" font-family="Arial" font-size="10" fill="#8a8e94" text-anchor="middle">' + tapes.length + '개 &#183; 라벨/삭제/가져오기</text></g>';
    if (!others.length) {
        html += '<text x="1440" y="472" font-family="Arial" font-size="12" letter-spacing="1" fill="#55555c" text-anchor="middle">TAPE RACK &#183; EJECT하면 테이프가 이곳에 보관됩니다</text>';
    } else {
        others.slice(0, 4).forEach((t, i) => {
            const x = 1120 + i * 168;
            html += '<g style="cursor:pointer" data-tape-index="' + i + '">' +
                '<rect x="' + x + '" y="430" width="156" height="72" rx="6" fill="#22222a" stroke="#3a3a40" stroke-width="1.2"/>' +
                '<circle cx="' + (x + 46) + '" cy="478" r="9" fill="#101014" stroke="#4a4a52"/>' +
                '<circle cx="' + (x + 110) + '" cy="478" r="9" fill="#101014" stroke="#4a4a52"/>' +
                '<rect x="' + (x + 10) + '" y="438" width="136" height="20" rx="3" fill="#e8e0c8"/>' +
                '<text data-tape-label-index="' + i + '" x="' + (x + 78) + '" y="452" font-family="Arial" font-size="11" font-weight="700" fill="#3a2b1e" text-anchor="middle"></text>' +
                '<text x="' + (x + 78) + '" y="497" font-family="Arial" font-size="9" fill="#8a8a94" text-anchor="middle">' + formatDuration(tapeUsedSec(t) * 1000) + ' / ' + formatDuration(tapeLenOf(t) * 1000) + '</text>' +
                '</g>';
        });
    }
    shelf.innerHTML = html;
    const visibleTapes = others.slice(0, 4);
    shelf.querySelectorAll("text[data-tape-label-index]").forEach((labelNode) => {
        const tape = visibleTapes[Number(labelNode.getAttribute("data-tape-label-index"))];
        labelNode.textContent = tape ? String(tape.label || "").slice(0, 11) : "";
    });
    shelf.querySelectorAll("g[data-tape-index]").forEach((g) => {
        const tape = visibleTapes[Number(g.getAttribute("data-tape-index"))];
        if (tape) {
            // 기존 셸/테스트의 data-id 계약은 유지하되, 문자열 템플릿이 아닌 DOM API로
            // 설정해 가져온 ID에 따옴표나 마크업이 있어도 속성 경계를 벗어나지 못하게 한다.
            g.setAttribute("data-id", String(tape.id || ""));
            g.addEventListener("click", () => deckInsertTape(tape.id));
        }
    });
    const caseBtn = shelf.querySelector("#deckCaseBtn");
    if (caseBtn) {
        caseBtn.addEventListener("click", openTapeCase);
        caseBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTapeCase(); }
        });
    }
    updateDeckLabel();
}

function updateDeckLabel() {
    const l = document.getElementById("deckLabel");
    const s = document.getElementById("deckLabelSub");
    if (!l || !deckTape) return;
    const maxLabel = formatDuration(tapeLenOf(deckTape) * 1000);
    l.textContent = deckTape.label;
    const sideTag = (deckTape.side || "A") === "B" || (deckTape.segmentsB && deckTape.segmentsB.length) ? "SIDE " + (deckTape.side || "A") + " · " : "";
    s.textContent = sideTag + "사용 " + formatDuration(tapeUsedSec(deckTape) * 1000) + " / " + maxLabel;
    const counterMax = document.getElementById("deckCounterMax");
    if (counterMax) counterMax.textContent = "/ " + maxLabel;
}

// 예약 녹음 중 데크 조작 가드 — 처음엔 경고만 하고, 8초 안에 다시 조작하면
// 예약 녹음을 중단하고 요청한 조작을 실행한다. (수동 녹음에는 관여하지 않는다)
let resRecDeckWarnedAt = 0;
function deckGuardReservedRec(touchesRec) {
    // 더블데크는 녹음이 B웰 — A 트랜스포트는 언제나 자유. 단 REC(touchesRec)는 B웰 녹음을 건드리므로 경고를 거친다.
    if (isDoubleDeck() && !touchesRec) return true;
    if (!(recorder && typeof activeResRec !== "undefined" && activeResRec && activeResRec.started)) return true;
    const now = Date.now();
    if (now - resRecDeckWarnedAt > 8000) {
        resRecDeckWarnedAt = now;
        playerSubtext.textContent = "예약 녹음이 진행 중입니다 — 그래도 조작하려면 8초 안에 한 번 더 누르세요 (녹음이 중단됩니다).";
        return false;
    }
    resRecDeckWarnedAt = 0;
    stopRecording();
    cancelReservedRecording("예약 녹음을 중단했습니다 — 데크를 조작했습니다.");
    return true;
}

// STOP/REC로 진행 중인 녹음을 사용자가 직접 멈추는 공통 경로.
// STOP·REC는 "멈추고 싶다"는 자연스러운 표현이므로, 다른 트랜스포트 조작(PLAY·감기·EJECT)과
// 달리 확인 없이 한 번에 멈추고 저장한다 — 싱글·더블데크(B웰) 모두 동일. 지금까지 담긴
// 구간은 stopRecording의 onstop이 테이프에 남긴다. 예약이면 회차를 취소로 표시(재발화 안 함).
function stopActiveRecordingByUser() {
    if (!recorder) return false;
    const wasReserved = typeof activeResRec !== "undefined" && activeResRec && activeResRec.started;
    const wasB = recOnB;
    resRecDeckWarnedAt = 0;
    stopRecording();
    if (wasReserved) {
        cancelReservedRecording(wasB
            ? "B웰 예약 녹음을 멈추고 카세트를 테이프 랙에 보관했습니다."
            : "예약 녹음을 멈추고 지금까지를 테이프에 저장했습니다.");
    } else {
        playerSubtext.textContent = wasB
            ? "B웰 녹음을 멈추고 카세트를 테이프 랙에 보관했습니다."
            : "녹음을 멈추고 테이프에 기록했습니다.";
    }
    return true;
}

function deckInsertTape(id) {
    const t = tapes.find((x) => x.id === id);
    if (!t || t === deckTape) return;
    if (t === deckBTape) { playerSubtext.textContent = "B웰에서 녹음 중인 테이프입니다."; return; }
    if (!deckGuardReservedRec()) return;
    if (recorder && !recOnB) { playerSubtext.textContent = "녹음 중에는 테이프를 바꿀 수 없습니다."; return; }
    if (deckMode === "play") { audio.pause(); deckSegPlaying = null; deckPlaying = false; }
    deckMode = "stop";
    if (deckTape) deckTape.pos = tapePos;
    deckTape = t;
    tapePos = t.pos || 0;
    deckRefreshShelf();
    deckStateSave();
    playerSubtext.textContent = "테이프 장착: " + t.label + " (" + formatDuration(tapePos * 1000) + " 위치)";
}

function deckPlay() {
    if (!deckGuardReservedRec()) return;
    if (recorder && !recOnB) { playerSubtext.textContent = "녹음 중입니다 — STOP으로 먼저 정지하세요."; return; }
    if (deckMode === "play") return;
    if (deckMode === "wind") { deckMode = "stop"; windDir = 0; }
    if (!deckTape) deckTape = newBlankTape();
    stopPhono();
    if (player) { player.destroy(); player = null; }
    PlaybackController.invalidate();
    if (typeof Hls !== "undefined" && Hls.isSupported()) ensureAudioGraph();
    // 제스처 밖에서 만들어져 잠든 컨텍스트가 있으면 깨운다 — 릴만 돌고 무음이 되는 원인
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (gainNode) gainNode.gain.value = volumeLevel;
    ensureHiss();
    deckMode = "play";
    deckPlaying = true;
    currentStation = null;
    tunerSetStation(null);
    document.querySelectorAll(".station").forEach((el) => el.classList.remove("active", "playing", "loading"));
    streamLoaded = true;
    try { audio.preservesPitch = true; audio.playbackRate = 1; } catch (e) {}
    const seg = segmentAt(deckTape, tapePos);
    if (seg) {
        deckStartSegment(seg, tapePos - seg.start);
    } else {
        audio.pause();
        deckSegPlaying = null;
    }
    nowStation.textContent = deckTape.label + " — TAPE";
    if (deckTape.foreign && deckTape.segments.length) {
        playerSubtext.textContent = deckModelId === "dragon"
            ? "NAAC — 외부 테이프의 아지무스를 자동 보정합니다. 고역이 온전합니다."
            : "외부 테이프 — 아지무스가 미세하게 어긋나 고역이 감깁니다 (DRAGON의 NAAC만 보정).";
        updatePlayButton();
        updateMediaSession();
        gtag('event', 'play_tape', { tape: deckTape.label });
        return;
    }
    playerSubtext.textContent = !deckTape.segments.length
        ? "공테이프가 돌고 있습니다 — 소리를 들으려면 TAPE RACK에서 녹음된 테이프를 장착하세요."
        : !seg
            ? "빈 구간부터 감기 시작 (" + formatDuration(tapePos * 1000) + ") — 수록 구간에 닿으면 소리가 납니다."
            : "카세트 재생 (" + formatDuration(tapePos * 1000) + " 위치부터)";
    updatePlayButton();
    updateMediaSession();
    gtag('event', 'play_tape', { tape: deckTape.label });
}

function deckStopTransport() {
    // 더블데크: A웰이 재생 중이면 STOP은 그 재생을 멈추는 것이 우선이다 (B웰 녹음은 계속).
    // 무엇이 STOP되는지 헷갈리지 않게, 녹음이 여전히 도는 중임과 멈추는 법을 함께 알린다.
    if (recOnB && recorder && deckMode === "play") {
        PlaybackController.invalidate();
        deckSeekGeneration += 1;
        deckSeekFixing = false;
        audio.pause();
        deckSegPlaying = null;
        deckMode = "stop";
        windDir = 0;
        deckPlaying = false;
        if (hissGain) hissGain.gain.value = 0;
        deckSyncTape();
        playerSubtext.textContent = "A웰 재생을 정지했습니다 — B웰 녹음은 계속됩니다. 녹음을 멈추려면 STOP이나 REC를 다시 누르세요.";
        return;
    }
    // 녹음이 도는 중(싱글=A웰, 더블=B웰)이고 A웰이 재생 중이 아니면 STOP이 녹음을 멈춘다
    if (recorder) {
        stopActiveRecordingByUser();
        return;
    }
    if (deckMode === "play") {
        PlaybackController.invalidate();
        deckSeekGeneration += 1;
        deckSeekFixing = false;
        audio.pause();
        deckSegPlaying = null;
    }
    deckMode = "stop";
    windDir = 0;
    deckPlaying = false;
    if (hissGain) hissGain.gain.value = 0;
    deckSyncTape();
}

function deckRec() {
    // REC는 녹음의 시작/정지 버튼이다 — 예약이든 수동이든, 눌리면 멈추고 저장한다 (확인 없이 한 번에).
    if (recorder) {
        stopActiveRecordingByUser();
        return;
    }
    // 예약 시각인데 아직 시작 전(자동재생 차단·튠 대기) — REC 누름이 곧 시동이다
    if (typeof activeResRec !== "undefined" && activeResRec && !activeResRec.started) {
        playerSubtext.textContent = "예약 녹음을 시작합니다 — " + activeResRec.res.title;
        bgRecKick();
        return;
    }
    if (!isDoubleDeck()) {
        // 싱글 데크: 장착 테이프에 직접 기록하므로 정지 상태·잔량이 필요하다
        if (deckMode === "play" || deckMode === "wind") { playerSubtext.textContent = "정지 상태에서 REC를 누르세요."; return; }
        if (tapePos >= tapeLenOf(deckTape) - 1) { playerSubtext.textContent = "테이프 끝입니다 — 되감거나 EJECT로 새 테이프를 넣으세요."; return; }
    }
    if (!isPlaying && !micArmed) { playerSubtext.textContent = "녹음할 소스가 없습니다 — 방송이나 음반, 테이프를 재생하거나 REC INPUT을 MIC로 전환하세요."; return; }
    toggleRecording();
}

function deckEject() {
    if (!deckGuardReservedRec()) return;
    if (recorder && !recOnB) { playerSubtext.textContent = "녹음 중에는 꺼낼 수 없습니다."; return; }
    if (deckMode === "play") { PlaybackController.invalidate(); audio.pause(); deckSegPlaying = null; deckPlaying = false; }
    deckMode = "stop";
    if (deckTape) deckTape.pos = tapePos;
    const old = deckTape ? deckTape.label : "";
    deckTape = newBlankTape();
    tapePos = 0;
    deckRefreshShelf();
    deckStateSave();
    playerSubtext.textContent = old + " 테이프를 랙에 보관하고 새 공테이프를 넣었습니다.";
}

function stopDeck() {
    if (deckPlaying || deckMode === "play") PlaybackController.invalidate();
    deckSeekGeneration += 1;
    deckSeekFixing = false;
    deckPlaying = false;
    deckSegPlaying = null;
    if (deckMode === "play" || deckMode === "wind") deckMode = "stop";
    windDir = 0;
    if (hissGain) hissGain.gain.value = 0;
}

// ----- 테이프 보관함 -----
// 음반 수납장의 카세트판. 테이프는 "하나의 연속 매체"라는 모델을 유지하고,
// 케이스의 J-카드(수록곡 목록)로 곡 단위 접근을 제공한다 — 트랙을 누르면
// 그 위치로 감아서 재생한다. 라벨 개명은 케이스에 이름을 써 두는 것(영속).

function tapeCaseMirrorMsg() {
    // 오버레이가 플레이어바를 가리므로, 차단 안내는 보관함 안에도 비춘다
    const el = document.getElementById("tapeCaseMsg");
    if (el) {
        el.textContent = playerSubtext.textContent;
        el.hidden = !el.textContent;
    }
}

function openTapeCase() {
    renderTapeCase();
    const msg = document.getElementById("tapeCaseMsg");
    if (msg) { msg.textContent = ""; msg.hidden = true; }
    document.getElementById("tapeCaseOverlay").hidden = false;
    gtag('event', 'open_tapecase', {});
}

function closeTapeCase() {
    document.getElementById("tapeCaseOverlay").hidden = true;
}

function renderTapeCase() {
    const list = document.getElementById("tapeCaseList");
    const empty = document.getElementById("tapeCaseEmpty");
    if (!list) return;
    list.innerHTML = "";
    const ordered = [deckTape, ...tapes.filter((t) => t !== deckTape)].filter(Boolean);
    ordered.forEach((t) => list.appendChild(tapeCaseItem(t)));
    empty.hidden = ordered.length > 0;
    document.getElementById("tapeCaseCount").textContent = tapes.length + "개";
}

function tapeCaseItem(t) {
    const item = document.createElement("div");
    item.className = "tapecase-item" + (t === deckTape ? " is-current" : "");
    item.setAttribute("role", "listitem");

    const head = document.createElement("div");
    head.className = "tapecase-head";
    const shell = document.createElement("div");
    shell.className = "tapecase-shell";
    shell.innerHTML = '<span class="tapecase-hub"></span><span class="tapecase-hub"></span>';

    const info = document.createElement("div");
    info.className = "tapecase-info";
    const label = document.createElement("div");
    label.className = "tapecase-label";
    label.textContent = t.label;
    const meta = document.createElement("div");
    meta.className = "tapecase-meta";
    const born = tapeDateLabel(tapeCreatedAt(t));
    meta.textContent = tapeSizeName(tapeLenOf(t)) + " · 사용 " + formatDuration(tapeUsedSec(t) * 1000)
        + " / " + formatDuration(tapeLenOf(t) * 1000) + " · 수록 " + t.segments.length + "곡"
        + (born ? " · " + born + " 생성" : "")
        + (t === deckTape ? " · 장착됨" : t === deckBTape ? " · B웰 녹음 중" : "");
    info.append(label, meta);

    const actions = document.createElement("div");
    actions.className = "tapecase-actions";
    const btn = (text, fn, danger) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rec-btn" + (danger ? " danger" : "");
        b.textContent = text;
        b.addEventListener("click", fn);
        return b;
    };
    // 라벨 개명 — 인라인 입력. prompt()는 WKWebView 앱·일부 PWA에서 조용히 무시된다.
    const startRename = () => {
        if (info.querySelector(".tapecase-label-input")) return;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "tapecase-label-input";
        input.value = t.label;
        input.maxLength = 40;
        input.setAttribute("aria-label", "테이프 라벨");
        label.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const commit = () => {
            if (done) return;
            done = true;
            const clean = input.value.trim().slice(0, 40);
            if (clean && clean !== t.label) {
                t.label = clean;
                t.named = true;
                t.blank = false;
                tapeMetaSave();
                deckRefreshShelf();
                gtag('event', 'tape_rename', {});
            }
            renderTapeCase();
        };
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { done = true; renderTapeCase(); }
        });
        input.addEventListener("blur", commit);
        input.addEventListener("click", (e) => e.stopPropagation());
    };
    if (t !== deckTape) actions.appendChild(btn("장착", () => tapeCaseInsert(t.id)));
    actions.appendChild(btn("라벨", startRename));
    if (t.segments.length) actions.appendChild(btn("내보내기", () => tapeCaseExport(t.id)));
    actions.appendChild(btn("삭제", (e) => tapeCaseDelete(t.id, e.currentTarget), true));

    head.append(shell, info, actions);
    item.appendChild(head);

    if (t.segments.length) {
        const tracks = document.createElement("div");
        tracks.className = "tapecase-tracks";
        t.segments.forEach((seg) => {
            const row = document.createElement("div");
            row.className = "tapecase-track";
            row.setAttribute("role", "button");
            row.tabIndex = 0;
            row.title = "이 위치로 감아서 재생";
            const pos = document.createElement("span");
            pos.className = "tapecase-track-pos";
            pos.textContent = "▶ " + formatDuration(seg.start * 1000);
            const name = document.createElement("span");
            name.className = "tapecase-track-name";
            name.textContent = seg.name || "무제 녹음";
            const dur = document.createElement("span");
            dur.className = "tapecase-track-dur";
            dur.textContent = formatDuration(seg.dur * 1000);
            row.append(pos, name, dur);
            if (seg.url) {
                const save = document.createElement("a");
                save.className = "rec-btn";
                save.href = seg.url;
                save.download = (seg.name || "tape").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-")
                    + "." + recFileExtension(seg.type || "");
                save.textContent = "저장";
                save.addEventListener("click", (e) => e.stopPropagation());
                row.appendChild(save);
            }
            const go = () => tapeCasePlayTrack(t.id, seg.start);
            row.addEventListener("click", go);
            row.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
            });
            tracks.appendChild(row);
        });
        item.appendChild(tracks);
    }
    return item;
}

function tapeCaseInsert(id) {
    deckInsertTape(id);
    if (deckTape && deckTape.id === id) closeTapeCase();
    else { renderTapeCase(); tapeCaseMirrorMsg(); }
}

async function tapeCaseDelete(id, btn) {
    const t = tapes.find((x) => x.id === id);
    if (!t) return;
    if (recorder && (deckTape === t || deckBTape === t)) {
        playerSubtext.textContent = "녹음 중인 테이프는 지울 수 없습니다 — 먼저 정지하세요.";
        tapeCaseMirrorMsg();
        return;
    }
    if (typeof activeResRec !== "undefined" && activeResRec && activeResRec.tapeId === t.id) {
        playerSubtext.textContent = "예약 녹음 회차가 사용 중인 테이프는 지울 수 없습니다 — 예약이 끝난 뒤 다시 시도하세요.";
        tapeCaseMirrorMsg();
        return;
    }
    if (w990DubBusy && deckBTape === t) {
        playerSubtext.textContent = "더빙 중인 B웰 테이프는 지울 수 없습니다 — 더빙이 끝난 뒤 다시 시도하세요.";
        tapeCaseMirrorMsg();
        return;
    }
    // 2단계 확인 — confirm()은 WKWebView 앱·일부 PWA에서 조용히 false를 돌려준다
    if (btn && btn.dataset.arm !== "1") {
        btn.dataset.arm = "1";
        btn.textContent = "정말 삭제?";
        btn.classList.add("armed-danger");
        setTimeout(() => {
            if (btn.isConnected && btn.dataset.arm === "1") {
                btn.dataset.arm = "";
                btn.textContent = "삭제";
                btn.classList.remove("armed-danger");
            }
        }, 4000);
        return;
    }

    const lifecycle = window.MFA_RecordingLifecycle;
    if (!lifecycle) {
        playerSubtext.textContent = "녹음 저장소가 아직 준비되지 않았습니다. 잠시 후 다시 삭제해 주세요.";
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.dataset.deleting = "1";
        btn.textContent = "삭제 중…";
    }
    const segments = t.segments.concat(t.segmentsB || []).slice();
    const prepared = await lifecycle.prepareTapeDeletion(segments);
    if (!prepared.ok) {
        if (btn && btn.isConnected) {
            btn.disabled = false;
            btn.dataset.deleting = "";
            btn.dataset.arm = "1";
            btn.textContent = "다시 삭제";
        }
        playerSubtext.textContent = prepared.reason === "busy"
            ? "이 테이프의 녹음 삭제가 이미 진행 중입니다. 완료 후 다시 시도하세요."
            : "브라우저 저장소에서 일부 수록을 지우지 못했습니다. 테이프와 파일은 유지했으니 다시 삭제해 주세요.";
        tapeCaseMirrorMsg();
        return;
    }

    // 영속 데이터 삭제가 모두 확인된 뒤에만 재생/릴레이 참조와 로컬 메타를 정리한다.
    lifecycle.commitTapeDeletion(prepared);
    if (deckTape === t) {
        if (deckMode === "play") {
            PlaybackController.invalidate();
            deckSeekGeneration += 1;
            deckSeekFixing = false;
            audio.pause();
            deckSegPlaying = null;
        }
        deckPlaying = false;
        deckMode = "stop";
        windDir = 0;
        deckWindTarget = null;
        deckAutoResume = false;
        if (hissGain) hissGain.gain.value = 0;
    }
    if (deckBTape === t) {
        deckBTape = null;
        deckBPos = 0;
        deckBRecStartPos = 0;
        w990DubUntil = 0;
    }
    tapes = tapes.filter((x) => x !== t);
    if (deckTape === t) {
        deckTape = newBlankTape();
        tapePos = 0;
    }
    tapeMetaSave();
    deckStateSave();
    deckRefreshShelf();
    renderTapeCase();
    playerSubtext.textContent = '테이프 "' + t.label + '"를 정리했습니다.';
    gtag('event', 'tape_delete', {});
}

// 트랙 점프: 테이프를 장착하고 그 위치로 감아서 재생 — J-카드 보고 카운터 감기
function tapeCasePlayTrack(tapeId, startSec) {
    const t = tapes.find((x) => x.id === tapeId);
    if (!t) return;
    if (deckTape !== t) {
        deckInsertTape(tapeId);
        if (deckTape !== t) { tapeCaseMirrorMsg(); return; }   // 녹음 가드 등에 막힘
    } else if (deckMode === "play" || deckMode === "wind") {
        if (deckMode === "play") { audio.pause(); deckSegPlaying = null; deckPlaying = false; }
        deckMode = "stop";
        windDir = 0;
    }
    tapePos = Math.max(0, Math.min(tapeLenOf(t) - 1, startSec + 0.01));
    deckPlay();
    if (deckMode === "play") closeTapeCase();
    else tapeCaseMirrorMsg();
}

document.getElementById("tapeCaseOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTapeCase();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("tapeCaseOverlay").hidden) closeTapeCase();
});

// ----- 테이프 가져오기 / 내보내기 -----
// 가져오기: 오디오 파일을 길이에 맞는 규격의 테이프에 담는다 (여러 파일 = 믹스테이프).
// 원본 blob을 IndexedDB '녹음'으로 저장하므로 리로드 후에도 남는다.
// 내보내기: 수록곡을 원본 형식 그대로 내려받는다 — 재인코딩 없음, 원본 음질.

async function wavFileDuration(file) {
    if (!file || !/\.wav$/i.test(file.name || "") && !/wav/i.test(file.type || "")) return 0;
    try {
        const view = new DataView(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
        const ascii = (offset, length) => {
            let text = "";
            for (let i = 0; i < length && offset + i < view.byteLength; i++) {
                text += String.fromCharCode(view.getUint8(offset + i));
            }
            return text;
        };
        if (view.byteLength < 44 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") return 0;
        let offset = 12;
        let byteRate = 0;
        let dataBytes = 0;
        while (offset + 8 <= view.byteLength) {
            const id = ascii(offset, 4);
            const size = view.getUint32(offset + 4, true);
            const body = offset + 8;
            if (id === "fmt " && size >= 16 && body + 12 <= view.byteLength) {
                byteRate = view.getUint32(body + 8, true);
            } else if (id === "data") {
                dataBytes = size;
                break;
            }
            offset = body + size + (size % 2);
        }
        return byteRate > 0 && dataBytes > 0 ? dataBytes / byteRate : 0;
    } catch (error) {
        return 0;
    }
}

async function audioFileDuration(file) {
    const headerDuration = await wavFileDuration(file);
    if (headerDuration > 0) return headerDuration;
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const probe = document.createElement("audio");
        probe.preload = "metadata";
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            const d = isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 0;
            URL.revokeObjectURL(url);
            resolve(d);
        };
        probe.onloadedmetadata = done;
        probe.onerror = done;
        setTimeout(done, 8000);
        probe.src = url;
    });
}

async function tapeCaseImportFiles(fileList) {
    const files = [...(fileList || [])].filter((f) => f && f.size);
    if (!files.length) return;
    playerSubtext.textContent = "가져오는 중… 파일 길이를 재고 있습니다.";
    tapeCaseMirrorMsg();
    const items = [];
    for (const f of files) {
        const dur = await audioFileDuration(f);
        if (!dur) {
            playerSubtext.textContent = '"' + f.name + '" — 길이를 읽지 못해 건너뜁니다 (브라우저가 재생할 수 없는 형식).';
            tapeCaseMirrorMsg();
            continue;
        }
        items.push({ file: f, dur });
    }
    if (!items.length) return;
    // 전체 길이(트랙 사이 2초 리더 포함)에 맞는 규격을 고른다
    const total = items.reduce((a, x) => a + x.dur, 0) + 2 * items.length;
    const len = [1800, 3600, 5400, 7200].find((s) => s >= total) || Math.ceil(total / 1800) * 1800;
    const tape = newBlankTape(len);
    tape.foreign = true;   // 외부 테이프 — 아지무스가 미세하게 어긋나 있다 (DRAGON의 NAAC만 보정)
    // 비동기 IDB 저장보다 먼저 최종 라벨을 확정한다. 두 번째 세그먼트가 보이는 순간에도
    // 사용자가 중간 라벨(첫 파일명만)을 보거나 테스트/셸이 이를 영속 상태로 오인하지 않는다.
    if (items.length > 1 && !tape.named) {
        tape.label = items[0].file.name.replace(/\.[a-z0-9]+$/i, "") + " 외 " + (items.length - 1) + "곡";
        tape.blank = false;
    }
    let pos = 0;
    for (const x of items) {
        const record = {
            stationId: "import",
            stationName: x.file.name.replace(/\.[a-z0-9]+$/i, ""),
            startedAt: new Date().toISOString(),
            durationMs: Math.round(x.dur * 1000),
            type: x.file.type || "audio/mpeg",
            tapeId: tape.id,
            tapeStart: pos,
            tapeLen: len,
            blob: x.file
        };
        const item = addRecordingItem(record);
        await startRecordingPersistence(record, item);
        pos += x.dur + 2;
    }
    // 믹스테이프 라벨 — 첫 곡 이름에 나머지 곡 수를 붙인다 (직접 쓴 라벨은 존중)
    if (items.length > 1 && !tape.named) {
        tapeMetaSave();
        deckRefreshShelf();
    }
    renderTapeCase();
    playerSubtext.textContent = '"' + tape.label + '" — ' + tapeSizeName(len) + " 테이프로 가져왔습니다 (" + items.length + "곡).";
    tapeCaseMirrorMsg();
    gtag('event', 'tape_import', { tracks: items.length });
}

function tapeCaseExport(id) {
    const t = tapes.find((x) => x.id === id);
    if (!t) return;
    const segs = t.segments.filter((s) => s.url);
    if (!segs.length) {
        playerSubtext.textContent = "빈 테이프입니다 — 내보낼 수록곡이 없어요.";
        tapeCaseMirrorMsg();
        return;
    }
    const clean = (s) => (s || "tape").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
    const base = clean(t.label);
    segs.forEach((seg, i) => {
        setTimeout(() => {
            const a = document.createElement("a");
            a.href = seg.url;
            a.download = base + (segs.length > 1 ? "_" + String(i + 1).padStart(2, "0") : "")
                + (clean(seg.name) !== base ? "-" + clean(seg.name) : "")
                + "." + recFileExtension(seg.type || "");
            document.body.appendChild(a);
            a.click();
            a.remove();
        }, i * 400);
    });
    playerSubtext.textContent = '"' + t.label + '" 수록곡 ' + segs.length + "개를 원본 형식으로 내려받습니다.";
    tapeCaseMirrorMsg();
    gtag('event', 'tape_export', { tracks: segs.length });
}

document.getElementById("tapeImportInput").addEventListener("change", (e) => {
    tapeCaseImportFiles(e.target.files);
    e.target.value = "";
});
