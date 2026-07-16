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
    const t = { id: "tape-" + Date.now() + "-" + tapeSeq, label: tapeSizeName(len) + " · TAPE " + tapeSeq, segments: [], pos: 0, len, blank: true };
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
        if (os < s) out.push({ start: os, dur: s - os, url: o.url, name: o.name, offset: (o.offset || 0) });
        if (oe > e) out.push({ start: e, dur: oe - e, url: o.url, name: o.name, offset: (o.offset || 0) + (e - os) });
    });
    out.push(seg);
    out.sort((a, b) => a.start - b.start);
    tape.segments = out;
    if (tape.segments.length && tape.blank) {
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
            <linearGradient id="dkFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d21"/><stop offset="0.5" stop-color="#131316"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
            <linearGradient id="dkShell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2e34"/><stop offset="1" stop-color="#1a1a1f"/></linearGradient>
            <radialGradient id="dkMeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.65" stop-color="#f0e3ba"/><stop offset="1" stop-color="#d8ca9c"/></radialGradient>
            <linearGradient id="dkBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2c33"/><stop offset="0.5" stop-color="#1e1e24"/><stop offset="1" stop-color="#141419"/></linearGradient>
            <radialGradient id="dkShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="2000" height="540" rx="8" fill="url(#dkFace)"/>
        <rect x="0" y="2" width="2000" height="3" fill="#ffffff" opacity="0.35"/>
        <text x="90" y="82" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="30" font-weight="700" fill="#f0f0f2">Nakamichy</text>
        <text x="330" y="82" font-family="Arial" font-size="23" font-weight="700" letter-spacing="6" fill="#c8a860">DRAGON</text>
        <text x="90" y="110" font-family="Arial" font-size="12" letter-spacing="2" fill="#8a8a94">3 HEAD &#183; DISCRETE HEAD CASSETTE DECK</text>
        <rect x="420" y="90" width="620" height="310" rx="10" fill="#08080a" stroke="#2e2e34" stroke-width="2"/>
        <rect x="420" y="90" width="620" height="22" fill="url(#lzInset)" opacity="0.9"/>
        <rect x="450" y="115" width="560" height="260" rx="8" fill="url(#dkShell)" stroke="#3a3a40" stroke-width="1.6"/>
        <circle cx="466" cy="131" r="4" fill="#101014"/><circle cx="994" cy="131" r="4" fill="#101014"/><circle cx="466" cy="359" r="4" fill="#101014"/><circle cx="994" cy="359" r="4" fill="#101014"/>
        <rect x="480" y="135" width="500" height="70" rx="4" fill="#e8e0c8"/>
        <rect x="480" y="135" width="500" height="12" fill="url(#lzInset)" opacity="0.3"/>
        <text id="deckLabel" x="730" y="165" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text>
        <text id="deckLabelSub" x="730" y="190" font-family="Arial" font-size="11" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>
        <rect x="520" y="215" width="420" height="92" rx="46" fill="#0e0e12" stroke="#3a3a40" stroke-width="1.4"/>
        <circle id="deckPackL" cx="610" cy="260" r="40" fill="#1b1914" stroke="#0a0a0a" stroke-width="2"/>
        <circle id="deckPackR" cx="850" cy="260" r="24" fill="#1b1914" stroke="#0a0a0a" stroke-width="2"/>
        <g id="deckReelL">
            <circle cx="610" cy="260" r="17" fill="#e8e8ec"/>
            <rect x="608" y="244" width="4" height="10" rx="1" fill="#55555c"/><rect x="608" y="266" width="4" height="10" rx="1" fill="#55555c" transform="rotate(180 610 271)"/>
            <rect x="594" y="258" width="10" height="4" rx="1" fill="#55555c"/><rect x="616" y="258" width="10" height="4" rx="1" fill="#55555c"/>
            <circle cx="610" cy="260" r="5" fill="#101014"/>
        </g>
        <g id="deckReelR">
            <circle cx="850" cy="260" r="17" fill="#e8e8ec"/>
            <rect x="848" y="244" width="4" height="10" rx="1" fill="#55555c"/><rect x="848" y="266" width="4" height="10" rx="1" fill="#55555c" transform="rotate(180 850 271)"/>
            <rect x="834" y="258" width="10" height="4" rx="1" fill="#55555c"/><rect x="856" y="258" width="10" height="4" rx="1" fill="#55555c"/>
            <circle cx="850" cy="260" r="5" fill="#101014"/>
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
            <text x="1183" y="177" font-family="Arial" font-size="9" fill="#4a3a28" text-anchor="middle">-20</text>
            <text x="1287" y="149" font-family="Arial" font-size="9" fill="#4a3a28" text-anchor="middle">0</text>
            <text x="1341" y="177" font-family="Arial" font-size="9" fill="#8a2020" text-anchor="middle">+3</text>
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
            <text x="1262" y="302" font-family="Arial" font-size="11" letter-spacing="2" fill="#8a8a94" text-anchor="middle">L</text>
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
            <text x="1493" y="177" font-family="Arial" font-size="9" fill="#4a3a28" text-anchor="middle">-20</text>
            <text x="1597" y="149" font-family="Arial" font-size="9" fill="#4a3a28" text-anchor="middle">0</text>
            <text x="1651" y="177" font-family="Arial" font-size="9" fill="#8a2020" text-anchor="middle">+3</text>
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
            <text x="1572" y="302" font-family="Arial" font-size="11" letter-spacing="2" fill="#8a8a94" text-anchor="middle">R</text>
        </g>
        <text x="1120" y="332" font-family="Arial" font-size="10" letter-spacing="2" fill="#8a8a94">TAPE COUNTER</text>
        <rect x="1120" y="340" width="200" height="58" rx="6" fill="#050505" stroke="#26262c" stroke-width="1.5"/>
        <text id="deckCounter" x="1245" y="381" font-family="'Courier New', monospace" font-size="30" font-weight="700" fill="#ff3a26" text-anchor="end">00:00</text>
        <text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="11" fill="#55555c">/ 30:00</text>
        <circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/>
        <text x="1420" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#8a8a94" text-anchor="middle">REC</text>
        <circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"><title>TIMER — 예약 녹음 대기</title></circle>
        <text x="1366" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#8a8a94" text-anchor="middle">TIMER</text>
        <g font-family="Arial" font-size="10" letter-spacing="1" fill="#8a8a94">
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
            if (recorder || deckMode === "rec") return;
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
    if (!deckTape) deckTape = newBlankTape();
    deckRefreshShelf();
}

function deckSyncTape() {
    if (deckTape) deckTape.pos = tapePos;
    updateDeckLabel();
    deckRefreshShelf();
}

function deckRefreshShelf() {
    const shelf = document.getElementById("deckShelf");
    if (!shelf) return;
    const others = tapes.filter((t) => t !== deckTape);
    let html = "";
    if (!others.length) {
        html = '<text x="1540" y="472" font-family="Arial" font-size="12" letter-spacing="1" fill="#55555c" text-anchor="middle">TAPE RACK &#183; EJECT하면 테이프가 이곳에 보관됩니다</text>';
    } else {
        others.slice(0, 5).forEach((t, i) => {
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

function deckInsertTape(id) {
    const t = tapes.find((x) => x.id === id);
    if (!t || t === deckTape) return;
    if (recorder) { playerSubtext.textContent = "녹음 중에는 테이프를 바꿀 수 없습니다."; return; }
    if (deckMode === "play") { audio.pause(); deckSegPlaying = null; deckPlaying = false; }
    deckMode = "stop";
    if (deckTape) deckTape.pos = tapePos;
    deckTape = t;
    tapePos = t.pos || 0;
    deckRefreshShelf();
    playerSubtext.textContent = "테이프 장착: " + t.label + " (" + formatDuration(tapePos * 1000) + " 위치)";
}

function deckPlay() {
    if (recorder) { playerSubtext.textContent = "녹음 중입니다 — STOP으로 먼저 정지하세요."; return; }
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
    if (recorder) {
        stopRecording();
        playerSubtext.textContent = "녹음을 정지했습니다 — 테이프에 기록되었습니다.";
        if (activeResRec && activeResRec.started) {
            cancelReservedRecording("예약 녹음을 중단했습니다 — " + activeResRec.res.title);
        }
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
    if (recorder) {
        stopRecording();
        playerSubtext.textContent = "녹음을 정지했습니다 — 테이프에 기록되었습니다.";
        if (activeResRec && activeResRec.started) {
            cancelReservedRecording("예약 녹음을 중단했습니다 — " + activeResRec.res.title);
        }
        return;
    }
    if (deckMode === "play" || deckMode === "wind") { playerSubtext.textContent = "정지 상태에서 REC를 누르세요."; return; }
    if (!isPlaying) { playerSubtext.textContent = "녹음할 소스가 없습니다 — 방송이나 음반을 먼저 재생하세요."; return; }
    if (tapePos >= tapeLenOf(deckTape) - 1) { playerSubtext.textContent = "테이프 끝입니다 — 되감거나 EJECT로 새 테이프를 넣으세요."; return; }
    toggleRecording();
}

function deckEject() {
    if (recorder) { playerSubtext.textContent = "녹음 중에는 꺼낼 수 없습니다."; return; }
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
