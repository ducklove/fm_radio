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
    const dragonPeakRow = (id, y) => '<g id="' + id + '" data-meter-style="segments">' +
        Array.from({ length: 20 }, (_, i) => {
            const hot = i >= 18;
            const warn = i >= 14 && !hot;
            const on = hot ? "#ff5a43" : warn ? "#f2c65b" : "#69e59b";
            const off = hot ? "#301315" : warn ? "#2d2716" : "#10251b";
            return '<rect data-meter-segment="' + i + '" data-on="' + on + '" data-off="' + off + '" x="' +
                (1114 + i * 17.2).toFixed(1) + '" y="' + y + '" width="12.8" height="20" rx="1.8" fill="' + off + '"/>';
        }).join("") + '</g>';
    document.getElementById("deckStage").innerHTML = deckModelId === "dragon" ?
        `<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Nakamichi DRAGON 카세트 데크">
        <defs>
            <linearGradient id="dkFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#31333a"/><stop offset=".055" stop-color="#1e2026"/><stop offset=".44" stop-color="#15171c"/><stop offset=".86" stop-color="#090a0d"/><stop offset="1" stop-color="#030406"/></linearGradient>
            <linearGradient id="dkRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6068"/><stop offset=".12" stop-color="#24272d"/><stop offset=".72" stop-color="#101217"/><stop offset="1" stop-color="#4a4e56"/></linearGradient>
            <linearGradient id="dkWell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020304"/><stop offset=".17" stop-color="#090b0e"/><stop offset=".68" stop-color="#14171b"/><stop offset="1" stop-color="#050608"/></linearGradient>
            <linearGradient id="dkSmoke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#56636a" stop-opacity=".28"/><stop offset=".2" stop-color="#1e292e" stop-opacity=".12"/><stop offset=".58" stop-color="#04080b" stop-opacity=".48"/><stop offset="1" stop-color="#000205" stop-opacity=".82"/></linearGradient>
            <linearGradient id="dkGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f5f8" stop-opacity=".18"/><stop offset=".16" stop-color="#a7c4cb" stop-opacity=".055"/><stop offset=".36" stop-color="#ffffff" stop-opacity="0"/><stop offset=".76" stop-color="#6b9099" stop-opacity=".045"/><stop offset="1" stop-color="#ffffff" stop-opacity=".1"/></linearGradient>
            <linearGradient id="dkCassette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ded8c5"/><stop offset=".42" stop-color="#c9c0a8"/><stop offset="1" stop-color="#8f8878"/></linearGradient>
            <linearGradient id="dkTape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e1a10"/><stop offset=".5" stop-color="#725037"/><stop offset="1" stop-color="#25150d"/></linearGradient>
            <linearGradient id="dkBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e626b"/><stop offset=".09" stop-color="#42464e"/><stop offset=".42" stop-color="#272a31"/><stop offset=".82" stop-color="#17191e"/><stop offset="1" stop-color="#08090c"/></linearGradient>
            <linearGradient id="dkSwitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5e66"/><stop offset=".18" stop-color="#353940"/><stop offset="1" stop-color="#101216"/></linearGradient>
            <radialGradient id="dkPack" cx="38%" cy="34%" r="72%"><stop offset="0" stop-color="#79563b"/><stop offset=".58" stop-color="#362318"/><stop offset="1" stop-color="#090705"/></radialGradient>
            <radialGradient id="dkReel" cx="34%" cy="28%" r="82%"><stop offset="0" stop-color="#f3f4f1"/><stop offset=".36" stop-color="#b7bbc0"/><stop offset=".72" stop-color="#555a61"/><stop offset="1" stop-color="#d8dadd"/></radialGradient>
            <pattern id="dkFine" width="8" height="6" patternUnits="userSpaceOnUse"><path d="M0 .5H8 M0 3.5H8" stroke="#fff" stroke-width=".45" opacity=".026"/><path d="M0 2H8 M0 5H8" stroke="#000" stroke-width=".55" opacity=".2"/></pattern>
            <pattern id="dkKnurl" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(22)"><path d="M1 0V8 M5 0V8" stroke="#fff" stroke-width=".8" opacity=".14"/><path d="M3 0V8 M7 0V8" stroke="#08090b" stroke-width="1" opacity=".5"/></pattern>
            <filter id="dkCyanBloom" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3.5"/></filter>
            <filter id="dkLedBloom" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <rect width="2000" height="540" rx="8" fill="url(#dkFace)"/>
        <rect width="2000" height="540" rx="8" fill="url(#dkFine)" opacity=".92"/>
        <path d="M12 4H1988" stroke="#fff" stroke-width="3" opacity=".27"/><path d="M12 532H1988" stroke="#000" stroke-width="7" opacity=".72"/>
        <rect x="24" y="20" width="1952" height="496" rx="5" fill="none" stroke="#393c44" stroke-width="2"/><rect x="29" y="25" width="1942" height="486" rx="4" fill="none" stroke="#050608" stroke-width="1.5"/>
        <g fill="#111217" stroke="#adb2bc" stroke-width="1"><circle cx="43" cy="41" r="6"/><circle cx="1957" cy="41" r="6"/><circle cx="43" cy="497" r="6"/><circle cx="1957" cy="497" r="6"/></g>
        <text x="72" y="68" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="31" font-weight="700" fill="#eceef0">Nakamichi</text>
        <text x="301" y="68" font-family="Arial" font-size="24" font-weight="700" letter-spacing="6" fill="#cfb465">DRAGON</text>
        <text x="72" y="94" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#898d96">DISCRETE HEAD CASSETTE DECK &#183; NAAC</text>
        <text x="954" y="65" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2.1" fill="#767b84" text-anchor="end">3 HEAD &#183; 5 MOTOR &#183; DOUBLE DIRECT DRIVE</text>

        <!-- 좌측: 깊은 스모크 카세트 웰 -->
        <ellipse cx="564" cy="396" rx="472" ry="22" fill="#000" opacity=".68"/>
        <rect x="64" y="112" width="938" height="286" rx="12" fill="#030405" stroke="#111318" stroke-width="6"/>
        <rect x="70" y="106" width="926" height="282" rx="10" fill="none" stroke="url(#dkRail)" stroke-width="5"/>
        <rect x="86" y="124" width="894" height="246" rx="7" fill="url(#dkWell)" stroke="#010203" stroke-width="3"/>
        <path d="M92 130H974" stroke="#8d99a0" stroke-width="2" opacity=".12"/><path d="M92 362H974" stroke="#000" stroke-width="5" opacity=".72"/>
        <rect x="116" y="143" width="836" height="202" rx="7" fill="#0b0e11" stroke="#353a40" stroke-width="2"/>
        <path d="M126 153H942" stroke="#fff" stroke-width="2" opacity=".08"/>
        <rect x="214" y="153" width="738" height="187" rx="6" fill="url(#dkCassette)" stroke="#817b6e" stroke-width="2"/>
        <path d="M222 162H944" stroke="#fff" stroke-width="2" opacity=".35"/>
        <rect x="478" y="166" width="470" height="56" rx="3" fill="#e7dfc9" opacity=".92"/>
        <path d="M486 176H938" stroke="#fff" stroke-width="2" opacity=".72"/>
        <text id="deckLabel" x="730" y="190" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text>
        <text id="deckLabelSub" x="730" y="211" font-family="Arial" font-size="11" font-weight="700" fill="#665a49" text-anchor="middle">사용 0:00 / 30:00</text>
        <rect x="532" y="226" width="404" height="96" rx="48" fill="#111216" stroke="#514d45" stroke-width="2"/>
        <rect x="544" y="237" width="380" height="74" rx="37" fill="#08090b" stroke="#272a2f"/>
        <circle id="deckPackL" cx="610" cy="260" r="40" fill="url(#dkPack)" stroke="#080604" stroke-width="2"/>
        <circle id="deckPackR" cx="850" cy="260" r="24" fill="url(#dkPack)" stroke="#080604" stroke-width="2"/>
        <path d="M610 222 C690 211 773 226 850 238 M610 298 C690 309 773 294 850 282" fill="none" stroke="url(#dkTape)" stroke-width="6" opacity=".76"/>
        <g id="deckReelL">
            <circle cx="610" cy="260" r="30" fill="url(#dkKnurl)" stroke="#777b82"/>
            <circle cx="610" cy="260" r="20" fill="url(#dkReel)" stroke="#44484f"/>
            <path d="M610 243V253 M610 267V277 M593 260H603 M617 260H627 M598 248L605 255 M615 265L622 272 M622 248L615 255 M605 265L598 272" stroke="#484c52" stroke-width="4" stroke-linecap="round"/>
            <circle cx="610" cy="260" r="5" fill="#101014"/>
        </g>
        <g id="deckReelR">
            <circle cx="850" cy="260" r="28" fill="url(#dkKnurl)" stroke="#777b82"/>
            <circle cx="850" cy="260" r="20" fill="url(#dkReel)" stroke="#44484f"/>
            <path d="M850 243V253 M850 267V277 M833 260H843 M857 260H867 M838 248L845 255 M855 265L862 272 M862 248L855 255 M845 265L838 272" stroke="#484c52" stroke-width="4" stroke-linecap="round"/>
            <circle cx="850" cy="260" r="5" fill="#101014"/>
        </g>
        <path d="M652 309H808L788 337H672Z" fill="#24262b" stroke="#6a6d72"/><circle cx="684" cy="321" r="8" fill="#101216" stroke="#a6a7a6"/><circle cx="776" cy="321" r="8" fill="#101216" stroke="#a6a7a6"/><rect x="711" y="311" width="38" height="20" rx="3" fill="#24272c" stroke="#6a6e73"/>
        <rect x="86" y="124" width="894" height="246" rx="7" fill="url(#dkSmoke)" pointer-events="none"/>
        <path d="M100 132H462L350 365H100Z" fill="url(#dkGlass)" opacity=".85" pointer-events="none"/><path d="M714 130H964L850 368H600Z" fill="url(#dkGlass)" opacity=".22" pointer-events="none"/>
        <path d="M118 139L416 139 M754 139L950 139" stroke="#d9f3f7" stroke-width="2" opacity=".12" pointer-events="none"/>

        <!-- 중앙: 4자리 카운터와 2x20 LED 피크미터 -->
        <rect x="1040" y="106" width="448" height="282" rx="8" fill="#0a0c0f" stroke="#3c4047" stroke-width="2"/>
        <path d="M1050 116H1478" stroke="#fff" stroke-width="2" opacity=".1"/>
        <text x="1066" y="138" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#858b94">4 DIGIT TAPE COUNTER</text>
        <rect x="1064" y="150" width="250" height="58" rx="5" fill="#020405" stroke="#252b30" stroke-width="2"/>
        <text id="deckCounter" x="1286" y="190" font-family="'Courier New', monospace" font-size="32" font-weight="700" fill="#ff513b" text-anchor="end" style="filter:drop-shadow(0 0 4px rgba(255,73,49,.52))">00:00</text>
        <text id="deckCounterMax" x="1294" y="190" font-family="Arial" font-size="10" font-weight="700" fill="#4e555b">/ 30:00</text>
        <circle cx="1362" cy="177" r="10" fill="#170909" stroke="#4b2a28"/><circle id="deckTimerLed" cx="1362" cy="177" r="6" fill="#3a1210"><title>TIMER — 예약 녹음 대기</title></circle><text x="1362" y="203" font-family="Arial" font-size="9" font-weight="700" fill="#6f747c" text-anchor="middle">TIMER</text>
        <circle cx="1430" cy="177" r="12" fill="#170909" stroke="#5c2a27"/><circle id="deckRecLed" cx="1430" cy="177" r="8" fill="#3a1210"/><text x="1430" y="203" font-family="Arial" font-size="9" font-weight="700" fill="#7c5a56" text-anchor="middle">REC</text>
        <rect x="1064" y="220" width="400" height="132" rx="5" fill="#020504" stroke="#25312b" stroke-width="2"/>
        <path d="M1072 228H1456" stroke="#d8fff0" stroke-width="1.5" opacity=".08"/>
        <text x="1082" y="252" font-family="Arial" font-size="11" font-weight="700" fill="#6d7e75">L</text><text x="1082" y="296" font-family="Arial" font-size="11" font-weight="700" fill="#6d7e75">R</text>
        ${dragonPeakRow("deckVuL", 236)}
        ${dragonPeakRow("deckVuR", 280)}
        <g font-family="Arial" font-size="8.5" font-weight="700" fill="#536158"><text x="1114" y="328">-40</text><text x="1198" y="328">-20</text><text x="1286" y="328">-10</text><text x="1367" y="328">0</text><text x="1430" y="328" fill="#835042">+6</text></g>
        <text x="1264" y="372" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2" fill="#747b82" text-anchor="middle">PEAK LEVEL &#183; dB &#183; PEAK HOLD</text>

        <!-- 우측: NAAC / 캘리브레이션 / 테이프·노이즈리덕션 계통 -->
        <rect x="1518" y="106" width="420" height="282" rx="8" fill="#0a0c0f" stroke="#3c4047" stroke-width="2"/>
        <path d="M1528 116H1928" stroke="#fff" stroke-width="2" opacity=".1"/>
        <text x="1540" y="140" font-family="Arial" font-size="15" font-weight="700" letter-spacing="2.6" fill="#cfb465">NAAC</text>
        <text x="1612" y="140" font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.4" fill="#858b94">AUTOMATIC AZIMUTH CONTROL</text>
        <circle cx="1904" cy="135" r="10" fill="#102018" stroke="#375141"/><circle cx="1904" cy="135" r="6" fill="#6ee58b" opacity=".28" filter="url(#dkLedBloom)"/><circle id="deckNaacLed" cx="1904" cy="135" r="4" fill="#6ee58b"/>
        <rect x="1540" y="154" width="376" height="70" rx="4" fill="#020708" stroke="#23363a"/>
        <path d="M1548 188H1908" stroke="#244047"/><path d="M1548 171H1908 M1548 205H1908" stroke="#183037" stroke-dasharray="4 6"/>
        <path d="M1552 188H1620L1644 173L1683 202L1720 178L1750 191L1790 174L1828 198L1868 184H1904" fill="none" stroke="#4bc3d2" stroke-width="7" opacity=".12" filter="url(#dkCyanBloom)"/>
        <path id="deckNaacTrace" d="M1552 188H1620L1644 173L1683 202L1720 178L1750 191L1790 174L1828 198L1868 184H1904" fill="none" stroke="#73dae5" stroke-width="2.5"/>
        <g font-family="Arial" font-size="8.5" font-weight="700" fill="#5f7075"><text x="1548" y="219">L</text><text x="1898" y="219" text-anchor="end">R &#183; AZIMUTH LOCK</text></g>
        <path d="M1538 238H1918" stroke="#373b42"/>
        <text x="1540" y="257" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.3" fill="#777d86">MANUAL CALIBRATION</text>
        <g>
            <circle cx="1570" cy="300" r="24" fill="#08090c" stroke="#676b72"/><circle cx="1570" cy="300" r="18" fill="url(#dkSwitch)"/><path d="M1570 283V291" stroke="#d6c48f" stroke-width="3"/><text x="1570" y="338" font-family="Arial" font-size="8.5" font-weight="700" fill="#858a92" text-anchor="middle">BIAS</text>
            <circle cx="1640" cy="300" r="24" fill="#08090c" stroke="#676b72"/><circle cx="1640" cy="300" r="18" fill="url(#dkSwitch)"/><path d="M1640 283V291" stroke="#d6c48f" stroke-width="3"/><text x="1640" y="338" font-family="Arial" font-size="8.5" font-weight="700" fill="#858a92" text-anchor="middle">LEVEL</text>
        </g>
        <g font-family="Arial" font-size="8.5" font-weight="700" fill="#8a8f97">
            <text x="1693" y="268">TAPE</text><text x="1790" y="268">DOLBY NR</text><text x="1881" y="268">MPX</text>
        </g>
        <g fill="#17191e" stroke="#51555c"><rect x="1690" y="278" width="72" height="54" rx="5"/><rect x="1786" y="278" width="72" height="54" rx="5"/><rect x="1880" y="278" width="36" height="54" rx="5"/></g>
        <g fill="url(#dkSwitch)" stroke="#777b82"><rect x="1697" y="284" width="18" height="22" rx="3"/><rect x="1793" y="303" width="18" height="22" rx="3"/><rect x="1887" y="284" width="18" height="22" rx="3"/></g>
        <g font-family="Arial" font-size="8" font-weight="700" fill="#747a83"><text x="1721" y="294">I</text><text x="1721" y="311">II</text><text x="1721" y="328">IV</text><text x="1818" y="294">OFF</text><text x="1818" y="311">B</text><text x="1818" y="328">C</text><text x="1909" y="294">ON</text><text x="1909" y="326">OFF</text></g>
        <text id="deckAutoRevLbl" x="1540" y="370" font-family="Arial" font-size="9.5" font-weight="700" letter-spacing="1.35" fill="#858993" style="cursor:pointer">AUTO REVERSE &#183; DOUBLE DIRECT DRIVE &#183; DUAL CAPSTAN</text>

        <!-- 하단: 대형 입체 트랜스포트 -->
        <rect x="404" y="414" width="668" height="102" rx="9" fill="#030405" stroke="#292c32" stroke-width="2"/>
        <path d="M414 424H1062" stroke="#fff" stroke-width="2" opacity=".08"/>
        <g id="deckTransport">
            <rect id="deckBtnEject" x="420" y="428" width="96" height="72" rx="6" fill="url(#dkBtn)" stroke="#73777f" stroke-width="2" style="cursor:pointer"><title>EJECT — 테이프를 랙에 넣고 새 공테이프 장착</title></rect><path d="M430 437H506" stroke="#fff" stroke-width="2" opacity=".22" pointer-events="none"/>
            <polygon points="456,462 480,462 468,448" fill="#d7d9dc" pointer-events="none"/><rect x="456" y="468" width="24" height="5" rx="2" fill="#d7d9dc" pointer-events="none"/>
            <rect id="deckBtnRew" x="524" y="428" width="96" height="72" rx="6" fill="url(#dkBtn)" stroke="#73777f" stroke-width="2" style="cursor:pointer;touch-action:none"><title>REW — 누르는 동안 되감기</title></rect><path d="M534 437H610" stroke="#fff" stroke-width="2" opacity=".22" pointer-events="none"/>
            <polygon points="584,452 584,480 564,466" fill="#d7d9dc" pointer-events="none"/><polygon points="600,452 600,480 580,466" fill="#d7d9dc" pointer-events="none"/>
            <rect id="deckBtnPlay" x="628" y="428" width="120" height="72" rx="6" fill="url(#dkBtn)" stroke="#858990" stroke-width="2" style="cursor:pointer"><title>PLAY — 현재 위치부터 테이프 재생</title></rect><path d="M638 437H738" stroke="#fff" stroke-width="2" opacity=".24" pointer-events="none"/>
            <polygon points="676,450 676,482 706,466" fill="#e1e2e3" pointer-events="none"/>
            <rect id="deckBtnFf" x="752" y="428" width="96" height="72" rx="6" fill="url(#dkBtn)" stroke="#73777f" stroke-width="2" style="cursor:pointer;touch-action:none"><title>FF — 누르는 동안 빨리감기</title></rect><path d="M762 437H838" stroke="#fff" stroke-width="2" opacity=".22" pointer-events="none"/>
            <polygon points="784,452 784,480 804,466" fill="#d7d9dc" pointer-events="none"/><polygon points="800,452 800,480 820,466" fill="#d7d9dc" pointer-events="none"/>
            <rect id="deckBtnStop" x="856" y="428" width="96" height="72" rx="6" fill="url(#dkBtn)" stroke="#73777f" stroke-width="2" style="cursor:pointer"><title>STOP — 정지</title></rect><path d="M866 437H942" stroke="#fff" stroke-width="2" opacity=".22" pointer-events="none"/>
            <rect x="890" y="452" width="28" height="28" rx="3" fill="#d7d9dc" pointer-events="none"/>
            <rect id="deckBtnRec" x="960" y="428" width="96" height="72" rx="6" fill="url(#dkBtn)" stroke="#97433a" stroke-width="2" style="cursor:pointer"><title>REC — 지금 나오는 소리를 현재 위치에 녹음 (덮어쓰기)</title></rect><path d="M970 437H1046" stroke="#fff" stroke-width="2" opacity=".2" pointer-events="none"/>
            <circle cx="1008" cy="466" r="14" fill="#d54838" pointer-events="none"/>
        </g>
        <g font-family="Arial" font-size="10.5" font-weight="700" letter-spacing="1.2" fill="#777c85" text-anchor="middle"><text x="468" y="516">EJECT</text><text x="572" y="516">REW</text><text x="688" y="516">PLAY</text><text x="800" y="516">FF</text><text x="904" y="516">STOP</text><text x="1008" y="516" fill="#9f554b">REC</text></g>
        <g id="deckShelf"></g>
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
    // 더블데크(recOnB)에서 STOP은 A웰 전용 — B웰 녹음은 REC 버튼으로 제어한다
    if (recorder && !recOnB && activeResRec && activeResRec.started) {
        if (!deckGuardReservedRec()) return;   // 1차: 경고만
        return;                                 // 2차: 가드가 녹음 중단까지 처리했다
    }
    if (recorder && !recOnB) {
        stopRecording();
        playerSubtext.textContent = "녹음을 정지했습니다 — 테이프에 기록되었습니다.";
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
    if (recorder && activeResRec && activeResRec.started) {
        if (!deckGuardReservedRec(true)) return;   // 1차: 경고만 (더블데크도 REC는 B웰 녹음을 건드린다)
        return;                                     // 2차: 가드가 녹음 중단까지 처리했다
    }
    if (recorder) {
        const wasB = recOnB;
        stopRecording();
        playerSubtext.textContent = wasB
            ? "B웰 녹음을 정지했습니다 — 카세트를 되감아 랙에 보관했습니다."
            : "녹음을 정지했습니다 — 테이프에 기록되었습니다.";
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
