// 카세트 데크 모듈 — C-30 실물 테이프 모델(30분 연속 매체)과 트랜스포트.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// ----- 카세트 데크 (Nakamichy DRAGON) — C-30 실물 테이프 모델 -----
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
let deckRecStartPos = 0;
let deckReelAngle = 0;
let tapeSeq = 1;
let hissGain = null;
let hissSrc = null;
let deckModelId = loadJson("fmRadio.deck", "dragon");
if (!DECK_MODELS[deckModelId]) deckModelId = "dragon";

// ----- 더블데크(B웰) -----
// W-990RX 같은 더블 데크에서 녹음(예약·수동)은 B웰이 전담한다.
// A웰(재생 트랜스포트)은 녹음과 완전히 독립 — 예약이 걸려 있어도 자유롭게 쓴다.
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
        if (t.segments.length || t.named) out[t.id] = { label: t.label, len: tapeLenOf(t), named: !!t.named, createdAt: tapeCreatedAt(t) || undefined };
    });
    tapeMeta = out;
    saveJson("fmRadio.tapeMeta", out);
}

// 시작 시 메타에 있는 테이프를 빈 껍데기로 복원 — 녹음이 복원되면 세그먼트가 채워진다
Object.entries(tapeMeta).forEach(([id, m]) => {
    if (!m || !m.label) return;
    tapes.push({ id, label: m.label, segments: [], pos: 0, len: m.len || TAPE_LEN, blank: !m.named, named: !!m.named, createdAt: m.createdAt });
});

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
    const t = { id: "tape-" + Date.now() + "-" + tapeSeq, label: tapeSizeName(len) + " · TAPE " + tapeSeq, segments: [], pos: 0, len, blank: true, createdAt: Date.now() };
    tapeSeq += 1;
    tapes.unshift(t);
    return t;
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

function deckStartSegment(seg, innerOffset) {
    deckSegPlaying = seg;
    streamLoaded = true;
    audio.src = seg.url;
    const target = (seg.offset || 0) + Math.max(0, innerOffset);
    const seek = () => { try { audio.currentTime = target; } catch (e) {} };
    audio.addEventListener("loadedmetadata", seek, { once: true });
    audio.play().catch(() => {});
    isPlaying = true;
}

function mountDeck() {
    document.getElementById("deckStage").innerHTML = deckModelId === "dragon" ?
        `<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Nakamichy DRAGON 카세트 데크">
        <defs>
            <linearGradient id="dkFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#292a30"/><stop offset="0.055" stop-color="#1b1c21"/><stop offset="0.5" stop-color="#121318"/><stop offset="0.86" stop-color="#090a0d"/><stop offset="1" stop-color="#050608"/></linearGradient>
            <linearGradient id="dkShell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#414249"/><stop offset="0.14" stop-color="#303138"/><stop offset="1" stop-color="#15161b"/></linearGradient>
            <radialGradient id="dkMeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.65" stop-color="#f0e3ba"/><stop offset="1" stop-color="#d8ca9c"/></radialGradient>
            <linearGradient id="dkBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#454750"/><stop offset="0.12" stop-color="#30323a"/><stop offset="0.54" stop-color="#1d1f25"/><stop offset="1" stop-color="#0d0e12"/></linearGradient>
            <radialGradient id="dkShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
            <linearGradient id="dkEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dce3"/><stop offset=".12" stop-color="#626771"/><stop offset=".78" stop-color="#181a20"/><stop offset="1" stop-color="#7d828d"/></linearGradient>
            <linearGradient id="dkCassette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eee8d5"/><stop offset=".45" stop-color="#d7ceb7"/><stop offset="1" stop-color="#a9a08d"/></linearGradient>
            <linearGradient id="dkTape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#392317"/><stop offset=".48" stop-color="#8a5c39"/><stop offset="1" stop-color="#2c1a11"/></linearGradient>
            <pattern id="dkFine" width="10" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H10 M0 3.5H10 M0 6.5H10" stroke="#ffffff" stroke-width=".55" opacity=".025"/><path d="M0 2H10 M0 5H10" stroke="#000000" stroke-width=".6" opacity=".18"/></pattern>
            <pattern id="dkReelTeeth" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><path d="M1 0V9 M5.5 0V9" stroke="#ffffff" stroke-width="1" opacity=".2"/><path d="M3 0V9 M7.5 0V9" stroke="#15161b" stroke-width="1.1" opacity=".55"/></pattern>
            <filter id="dkRedBloom" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        <rect width="2000" height="540" rx="8" fill="url(#dkFace)"/>
        <rect width="2000" height="540" rx="8" fill="url(#dkFine)" opacity=".86"/>
        <rect x="0" y="2" width="2000" height="3" fill="#ffffff" opacity="0.35"/>
        <rect x="24" y="22" width="1952" height="496" rx="5" fill="none" stroke="#34373f" stroke-width="2"/><rect x="29" y="27" width="1942" height="486" rx="4" fill="none" stroke="#050608" stroke-width="1.5"/>
        <g fill="#111217" stroke="#bfc3cc" stroke-width="1"><circle cx="42" cy="42" r="6"/><circle cx="1958" cy="42" r="6"/><circle cx="42" cy="498" r="6"/><circle cx="1958" cy="498" r="6"/></g>
        <text x="90" y="80" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" font-weight="700" fill="#f0f0f2">Nakamichy</text>
        <text x="330" y="80" font-family="Arial" font-size="26" font-weight="700" letter-spacing="6" fill="#d4b76b">DRAGON</text>
        <text x="90" y="109" font-family="Arial" font-size="14" font-weight="600" letter-spacing="2" fill="#a3a5ad">3 HEAD &#183; DISCRETE HEAD CASSETTE DECK</text>
        <g transform="translate(88 150)">
            <rect width="282" height="226" rx="8" fill="#0a0b0e" stroke="#343740" stroke-width="2"/>
            <rect x="8" y="8" width="266" height="210" rx="5" fill="none" stroke="#161920"/>
            <text x="20" y="34" font-family="Arial" font-size="15" font-weight="700" letter-spacing="2.4" fill="#d4b76b">NAAC</text>
            <text x="20" y="58" font-family="Arial" font-size="12" font-weight="650" letter-spacing="1.3" fill="#a2a5ad">AUTO AZIMUTH CONTROL</text>
            <path d="M26 92H78L102 72L136 112L172 78L204 96H254" fill="none" stroke="#58c8d8" stroke-width="3" opacity=".9"/>
            <path d="M26 92H78L102 72L136 112L172 78L204 96H254" fill="none" stroke="#bff8ff" stroke-width="1"/>
            <path d="M26 132H254 M26 160H254" stroke="#343842" stroke-width="1.2"/>
            <g font-family="Arial" font-size="11.5" font-weight="600" fill="#858993"><text x="26" y="151">BIAS CAL</text><text x="125" y="151">EQ</text><text x="202" y="151">AZIMUTH</text><text x="26" y="190">AUTO REVERSE · 3 MOTOR · DUAL CAPSTAN</text></g>
            <circle cx="254" cy="31" r="6" fill="#24372a" stroke="#596a5d"/><circle cx="254" cy="31" r="2.5" fill="#6ee58b"/>
        </g>
        <rect x="420" y="90" width="620" height="310" rx="10" fill="#08080a" stroke="#2e2e34" stroke-width="2"/>
        <rect x="412" y="82" width="636" height="326" rx="14" fill="none" stroke="url(#dkEdge)" stroke-width="5"/>
        <rect x="420" y="90" width="620" height="22" fill="url(#lzInset)" opacity="0.9"/>
        <rect x="450" y="115" width="560" height="260" rx="8" fill="url(#dkShell)" stroke="#3a3a40" stroke-width="1.6"/>
        <polygon points="454,119 698,119 586,371 454,371" fill="url(#lzGlassSweep)" opacity=".42"/>
        <circle cx="466" cy="131" r="4" fill="#101014"/><circle cx="994" cy="131" r="4" fill="#101014"/><circle cx="466" cy="359" r="4" fill="#101014"/><circle cx="994" cy="359" r="4" fill="#101014"/>
        <rect x="480" y="135" width="500" height="70" rx="4" fill="url(#dkCassette)"/>
        <rect x="480" y="135" width="500" height="12" fill="url(#lzInset)" opacity="0.3"/>
        <text id="deckLabel" x="730" y="165" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text>
        <text id="deckLabelSub" x="730" y="190" font-family="Arial" font-size="13" font-weight="600" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>
        <rect x="520" y="215" width="420" height="92" rx="46" fill="#0e0e12" stroke="#3a3a40" stroke-width="1.4"/>
        <circle id="deckPackL" cx="610" cy="260" r="40" fill="#1b1914" stroke="#0a0a0a" stroke-width="2"/>
        <circle id="deckPackR" cx="850" cy="260" r="24" fill="#1b1914" stroke="#0a0a0a" stroke-width="2"/>
        <path d="M610 220 C685 205 775 224 850 236 M610 300 C685 315 775 296 850 284" fill="none" stroke="url(#dkTape)" stroke-width="7" opacity=".82"/>
        <g id="deckReelL">
            <circle cx="610" cy="260" r="31" fill="url(#dkReelTeeth)" opacity=".7"/>
            <circle cx="610" cy="260" r="17" fill="#e8e8ec"/>
            <rect x="608" y="244" width="4" height="10" rx="1" fill="#55555c"/><rect x="608" y="266" width="4" height="10" rx="1" fill="#55555c" transform="rotate(180 610 271)"/>
            <rect x="594" y="258" width="10" height="4" rx="1" fill="#55555c"/><rect x="616" y="258" width="10" height="4" rx="1" fill="#55555c"/>
            <circle cx="610" cy="260" r="5" fill="#101014"/>
        </g>
        <g id="deckReelR">
            <circle cx="850" cy="260" r="28" fill="url(#dkReelTeeth)" opacity=".7"/>
            <circle cx="850" cy="260" r="17" fill="#e8e8ec"/>
            <rect x="848" y="244" width="4" height="10" rx="1" fill="#55555c"/><rect x="848" y="266" width="4" height="10" rx="1" fill="#55555c" transform="rotate(180 850 271)"/>
            <rect x="834" y="258" width="10" height="4" rx="1" fill="#55555c"/><rect x="856" y="258" width="10" height="4" rx="1" fill="#55555c"/>
            <circle cx="850" cy="260" r="5" fill="#101014"/>
        </g>
        <g>
            <path d="M648 314H812L790 350H670Z" fill="#2a2b31" stroke="#4a4b53" stroke-width="1.4"/>
            <circle cx="680" cy="326" r="9" fill="#111217" stroke="#a2a4aa" stroke-width="2"/><circle cx="780" cy="326" r="9" fill="#111217" stroke="#a2a4aa" stroke-width="2"/>
            <rect x="718" y="316" width="24" height="28" rx="4" fill="#98999d"/><rect x="723" y="320" width="14" height="20" rx="2" fill="#28292e"/>
        </g>
        <rect x="640" y="330" width="180" height="26" rx="6" fill="#16161a" stroke="#2e2e34"/>
        <rect x="700" y="336" width="60" height="14" rx="3" fill="#26262c"/>
        <g>
            <ellipse cx="1262" cy="292" rx="150" ry="18" fill="url(#dkShadow)"/>
            <rect x="1125" y="117" width="284" height="172" rx="9" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="1120" y="110" width="284" height="172" rx="9" fill="#15151a"/>
        <rect x="1123" y="111.5" width="278" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
            <rect x="1130" y="120" width="264" height="152" rx="5" fill="#16110b"/>
            <rect class="ampLamp" x="1130" y="120" width="264" height="152" rx="5" fill="url(#lzWarmFace)" opacity="0.02"/>
            <ellipse class="ampLamp" cx="1262" cy="135" rx="116" ry="36" fill="url(#lzLampPool)" opacity="0.02"/>
            <rect x="1130" y="120" width="264" height="20" fill="url(#lzInset)" opacity="0.5"/>
            <path d="M 1186.2 193.8 A 102 102 0 0 1 1337.8 193.8" fill="none" stroke="#4a3a28" stroke-width="1.5"/>
            <path d="M 1283.2 162.2 A 102 102 0 0 1 1337.8 193.8" fill="none" stroke="#c0392b" stroke-width="4"/>
            <g stroke="#4a3a28" stroke-width="1.5">
                <line x1="1193.8" y1="186.2" x2="1189.1" y2="181.0"/><line x1="1214.1" y1="171.9" x2="1210.9" y2="165.7"/>
                <line x1="1237.3" y1="163.0" x2="1235.6" y2="156.2"/><line x1="1262" y1="160" x2="1262" y2="153"/>
            </g>
            <g stroke="#c0392b" stroke-width="1.5">
                <line x1="1286.7" y1="163.0" x2="1288.4" y2="156.2"/><line x1="1309.9" y1="171.9" x2="1313.1" y2="165.7"/>
                <line x1="1330.2" y1="186.2" x2="1334.9" y2="181.0"/>
            </g>
            <text x="1183" y="177" font-family="Arial" font-size="11" font-weight="650" fill="#4a3a28" text-anchor="middle">-20</text>
            <text x="1287" y="149" font-family="Arial" font-size="11" font-weight="650" fill="#4a3a28" text-anchor="middle">0</text>
            <text x="1341" y="177" font-family="Arial" font-size="11" font-weight="650" fill="#8a2020" text-anchor="middle">+3</text>
            <text x="1262" y="236" font-family="Georgia, serif" font-size="16" font-weight="700" letter-spacing="2" fill="#6b5a40" text-anchor="middle">VU</text>
            <line id="deckVuL" data-cx="1262" data-cy="262" x1="1262" y1="262" x2="1262" y2="150" stroke="#d4501e" stroke-width="3" transform="rotate(-42 1262 262)"/>
            <circle cx="1262" cy="262" r="7" fill="#1a1610"/>
            <polygon points="1130,120 1290,120 1180,272 1130,272" fill="url(#lzStreak)"/>
            <rect x="1130" y="120" width="264" height="33.4" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1130" y="120" width="13.2" height="152" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1380.8" y="120" width="13.2" height="152" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1130" y="247.7" width="264" height="24.3" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1128" y="117" width="268" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1128" y="273" width="268" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect class="meterDark" x="1130" y="120" width="264" height="152" rx="5" fill="#0d0a06" opacity="0.55"/>
            <text x="1262" y="302" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#a4a6ae" text-anchor="middle">LEFT</text>
        </g>
        <g>
            <ellipse cx="1572" cy="292" rx="150" ry="18" fill="url(#dkShadow)"/>
            <rect x="1435" y="117" width="284" height="172" rx="9" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="1430" y="110" width="284" height="172" rx="9" fill="#15151a"/>
        <rect x="1433" y="111.5" width="278" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
            <rect x="1440" y="120" width="264" height="152" rx="5" fill="#16110b"/>
            <rect class="ampLamp" x="1440" y="120" width="264" height="152" rx="5" fill="url(#lzWarmFace)" opacity="0.02"/>
            <ellipse class="ampLamp" cx="1572" cy="135" rx="116" ry="36" fill="url(#lzLampPool)" opacity="0.02"/>
            <rect x="1440" y="120" width="264" height="20" fill="url(#lzInset)" opacity="0.5"/>
            <path d="M 1496.2 193.8 A 102 102 0 0 1 1647.8 193.8" fill="none" stroke="#4a3a28" stroke-width="1.5"/>
            <path d="M 1593.2 162.2 A 102 102 0 0 1 1647.8 193.8" fill="none" stroke="#c0392b" stroke-width="4"/>
            <g stroke="#4a3a28" stroke-width="1.5">
                <line x1="1503.8" y1="186.2" x2="1499.1" y2="181.0"/><line x1="1524.1" y1="171.9" x2="1520.9" y2="165.7"/>
                <line x1="1547.3" y1="163.0" x2="1545.6" y2="156.2"/><line x1="1572" y1="160" x2="1572" y2="153"/>
            </g>
            <g stroke="#c0392b" stroke-width="1.5">
                <line x1="1596.7" y1="163.0" x2="1598.4" y2="156.2"/><line x1="1619.9" y1="171.9" x2="1623.1" y2="165.7"/>
                <line x1="1640.2" y1="186.2" x2="1644.9" y2="181.0"/>
            </g>
            <text x="1493" y="177" font-family="Arial" font-size="11" font-weight="650" fill="#4a3a28" text-anchor="middle">-20</text>
            <text x="1597" y="149" font-family="Arial" font-size="11" font-weight="650" fill="#4a3a28" text-anchor="middle">0</text>
            <text x="1651" y="177" font-family="Arial" font-size="11" font-weight="650" fill="#8a2020" text-anchor="middle">+3</text>
            <text x="1572" y="236" font-family="Georgia, serif" font-size="16" font-weight="700" letter-spacing="2" fill="#6b5a40" text-anchor="middle">VU</text>
            <line id="deckVuR" data-cx="1572" data-cy="262" x1="1572" y1="262" x2="1572" y2="150" stroke="#d4501e" stroke-width="3" transform="rotate(-42 1572 262)"/>
            <circle cx="1572" cy="262" r="7" fill="#1a1610"/>
            <polygon points="1440,120 1600,120 1490,272 1440,272" fill="url(#lzStreak)"/>
            <rect x="1440" y="120" width="264" height="33.4" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1440" y="120" width="13.2" height="152" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1690.8" y="120" width="13.2" height="152" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1440" y="247.7" width="264" height="24.3" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1438" y="117" width="268" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1438" y="273" width="268" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect class="meterDark" x="1440" y="120" width="264" height="152" rx="5" fill="#0d0a06" opacity="0.55"/>
            <text x="1572" y="302" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#a4a6ae" text-anchor="middle">RIGHT</text>
        </g>
        <text x="1120" y="332" font-family="Arial" font-size="13" font-weight="650" letter-spacing="2" fill="#a0a3ac">TAPE COUNTER</text>
        <rect x="1120" y="340" width="200" height="58" rx="6" fill="#050505" stroke="#26262c" stroke-width="1.5"/>
        <rect x="1114" y="334" width="212" height="70" rx="9" fill="none" stroke="url(#dkEdge)" stroke-width="2.5"/>
        <rect x="1156" y="350" width="146" height="38" rx="9" fill="#ff3a26" opacity=".07" filter="url(#dkRedBloom)"/>
        <text id="deckCounter" x="1245" y="381" font-family="'Courier New', monospace" font-size="30" font-weight="700" fill="#ff3a26" text-anchor="end">00:00</text>
        <text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="11" fill="#55555c">/ 30:00</text>
        <circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/>
        <text x="1420" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#8a8a94" text-anchor="middle">REC</text>
        <circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"><title>TIMER — 예약 녹음 대기</title></circle>
        <text x="1366" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#8a8a94" text-anchor="middle">TIMER</text>
        <g font-family="Arial" font-size="13" font-weight="650" letter-spacing="1.2" fill="#a1a4ad">
            <text x="1490" y="332">DOLBY NR</text><text x="1620" y="332">TAPE</text>
        </g>
        <rect x="1490" y="342" width="26" height="52" rx="6" fill="#26262c"/><rect x="1494" y="346" width="18" height="22" rx="3" fill="#55555c"/>
        <rect x="1620" y="342" width="26" height="52" rx="6" fill="#26262c"/><rect x="1624" y="368" width="18" height="22" rx="3" fill="#55555c"/>
        <text x="1710" y="380" font-family="Arial" font-size="10" letter-spacing="1" fill="#55555c">CrO&#8322;</text>
        <g id="deckTransport">
            <rect id="deckBtnEject" x="420" y="430" width="96" height="72" rx="8" fill="url(#dkBtn)" stroke="#3a3a40" style="cursor:pointer"><title>EJECT — 테이프를 랙에 넣고 새 공테이프 장착</title></rect>
            <polygon points="456,462 480,462 468,448" fill="#c8c8d0" pointer-events="none"/><rect x="456" y="468" width="24" height="5" rx="2" fill="#c8c8d0" pointer-events="none"/>
            <rect id="deckBtnRew" x="524" y="430" width="96" height="72" rx="8" fill="url(#dkBtn)" stroke="#3a3a40" style="cursor:pointer;touch-action:none"><title>REW — 누르는 동안 되감기</title></rect>
            <polygon points="584,452 584,480 564,466" fill="#c8c8d0" pointer-events="none"/><polygon points="600,452 600,480 580,466" fill="#c8c8d0" pointer-events="none"/>
            <rect id="deckBtnPlay" x="628" y="430" width="120" height="72" rx="8" fill="url(#dkBtn)" stroke="#3a3a40" style="cursor:pointer"><title>PLAY — 현재 위치부터 테이프 재생</title></rect>
            <polygon points="676,450 676,482 706,466" fill="#c8c8d0" pointer-events="none"/>
            <rect id="deckBtnFf" x="752" y="430" width="96" height="72" rx="8" fill="url(#dkBtn)" stroke="#3a3a40" style="cursor:pointer;touch-action:none"><title>FF — 누르는 동안 빨리감기</title></rect>
            <polygon points="784,452 784,480 804,466" fill="#c8c8d0" pointer-events="none"/><polygon points="800,452 800,480 820,466" fill="#c8c8d0" pointer-events="none"/>
            <rect id="deckBtnStop" x="856" y="430" width="96" height="72" rx="8" fill="url(#dkBtn)" stroke="#3a3a40" style="cursor:pointer"><title>STOP — 정지</title></rect>
            <rect x="890" y="452" width="28" height="28" rx="3" fill="#c8c8d0" pointer-events="none"/>
            <rect id="deckBtnRec" x="960" y="430" width="96" height="72" rx="8" fill="url(#dkBtn)" stroke="#6b2a22" stroke-width="1.6" style="cursor:pointer"><title>REC — 지금 나오는 소리를 현재 위치에 녹음 (덮어쓰기)</title></rect>
            <circle cx="1008" cy="466" r="14" fill="#d03a2a" pointer-events="none"/>
        </g>
        <g font-family="Arial" font-size="11.5" font-weight="650" letter-spacing="1.2" fill="#777b84" text-anchor="middle"><text x="468" y="525">EJECT</text><text x="572" y="525">REW</text><text x="688" y="525">PLAY</text><text x="800" y="525">FF</text><text x="904" y="525">STOP</text><text x="1008" y="525" fill="#9b554a">REC</text></g>
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
            deckMode = "wind";
            windDir = dir;
        };
        const stop = () => { if (deckMode === "wind") { deckMode = "stop"; windDir = 0; deckSyncTape(); } };
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
    if (!deckTape) deckTape = newBlankTape();
    deckRefreshShelf();
}

// ----- REC INPUT (LINE/MIC) — 하단 좌측 입력 베이 -----
// 모든 데크 스킨이 비워 두는 좌하단(트랜스포트 왼쪽)에 공용으로 주입한다.
// 실제 데크의 마이크 단자 + 입력 셀렉터 문법: MIC로 전환하면 REC가 마이크를 녹음한다.
function deckMountMicPanel() {
    const svg = document.querySelector("#deckStage svg");
    if (!svg || svg.querySelector("#deckMicPanel")) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", "deckMicPanel");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", "녹음 입력 선택 — LINE(재생 소스) / MIC(마이크)");
    g.setAttribute("style", "cursor:pointer");
    g.innerHTML = '<title>REC INPUT — LINE은 지금 나오는 소리를, MIC는 마이크를 녹음합니다</title>' +
        '<rect x="112" y="434" width="272" height="72" rx="8" fill="#000" opacity=".38" filter="url(#lzSoft)"/>' +
        '<rect x="108" y="430" width="272" height="72" rx="8" fill="#14161b" stroke="#3c4046" stroke-width="1.8"/>' +
        '<path d="M116 434 H372" stroke="#fff" stroke-width="1.6" opacity=".14"/>' +
        '<text x="124" y="451" font-family="Arial" font-size="10" letter-spacing="2" fill="#8a8e96">REC INPUT</text>' +
        '<circle cx="152" cy="479" r="14" fill="#23262c" stroke="#767b83" stroke-width="2.4"/>' +
        '<circle cx="152" cy="479" r="14" fill="url(#lzInCirc)" opacity=".5"/>' +
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
            html += '<g style="cursor:pointer" data-id="' + t.id + '">' +
                '<rect x="' + x + '" y="430" width="156" height="72" rx="6" fill="#22222a" stroke="#3a3a40" stroke-width="1.2"/>' +
                '<circle cx="' + (x + 46) + '" cy="478" r="9" fill="#101014" stroke="#4a4a52"/>' +
                '<circle cx="' + (x + 110) + '" cy="478" r="9" fill="#101014" stroke="#4a4a52"/>' +
                '<rect x="' + (x + 10) + '" y="438" width="136" height="20" rx="3" fill="#e8e0c8"/>' +
                '<text x="' + (x + 78) + '" y="452" font-family="Arial" font-size="11" font-weight="700" fill="#3a2b1e" text-anchor="middle">' + t.label.slice(0, 11) + '</text>' +
                '<text x="' + (x + 78) + '" y="497" font-family="Arial" font-size="9" fill="#8a8a94" text-anchor="middle">' + formatDuration(tapeUsedSec(t) * 1000) + ' / ' + formatDuration(tapeLenOf(t) * 1000) + '</text>' +
                '</g>';
        });
    }
    shelf.innerHTML = html;
    shelf.querySelectorAll("g[data-id]").forEach((g) => {
        g.addEventListener("click", () => deckInsertTape(g.getAttribute("data-id")));
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
    s.textContent = "사용 " + formatDuration(tapeUsedSec(deckTape) * 1000) + " / " + maxLabel;
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
    if (typeof Hls !== "undefined" && Hls.isSupported()) ensureAudioGraph();
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
    playerSubtext.textContent = "카세트 재생 (" + formatDuration(tapePos * 1000) + " 위치부터)";
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
    if (deckMode === "play") { audio.pause(); deckSegPlaying = null; deckPlaying = false; }
    deckMode = "stop";
    if (deckTape) deckTape.pos = tapePos;
    const old = deckTape ? deckTape.label : "";
    deckTape = newBlankTape();
    tapePos = 0;
    deckRefreshShelf();
    playerSubtext.textContent = old + " 테이프를 랙에 보관하고 새 공테이프를 넣었습니다.";
}

function stopDeck() {
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

function tapeCaseDelete(id, btn) {
    const t = tapes.find((x) => x.id === id);
    if (!t) return;
    if (recorder && (deckTape === t || deckBTape === t)) {
        playerSubtext.textContent = "녹음 중인 테이프는 지울 수 없습니다 — 먼저 정지하세요.";
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
    if (deckTape === t && deckMode === "play") {
        audio.pause();
        deckSegPlaying = null;
        deckPlaying = false;
        deckMode = "stop";
        windDir = 0;
    }
    // 수록 녹음을 IndexedDB와 녹음 파일 목록에서도 제거한다 (미리듣기 src로 대조)
    const urls = new Set();
    t.segments.forEach((seg) => {
        if (seg.dbId != null) deleteRecording(seg.dbId);
        if (seg.url) urls.add(seg.url);
    });
    urls.forEach((u) => {
        document.querySelectorAll("#recordingList .recording audio").forEach((a) => {
            if (a.getAttribute("src") === u) {
                a.closest(".recording").remove();
                recordingCount -= 1;
            }
        });
        try { URL.revokeObjectURL(u); } catch (e) {}
    });
    updateRecordingsNote();
    tapes = tapes.filter((x) => x !== t);
    if (deckTape === t) {
        deckTape = newBlankTape();
        tapePos = 0;
    }
    tapeMetaSave();
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

function audioFileDuration(file) {
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
        record.dbId = await persistRecording(record);
        addRecordingItem(record);
        pos += x.dur + 2;
    }
    // 믹스테이프 라벨 — 첫 곡 이름에 나머지 곡 수를 붙인다 (직접 쓴 라벨은 존중)
    if (items.length > 1 && !tape.named) {
        tape.label = items[0].file.name.replace(/\.[a-z0-9]+$/i, "") + " 외 " + (items.length - 1) + "곡";
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
