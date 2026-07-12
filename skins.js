// SVG 스킨 모듈 — 조명 패스(LZ_DEFS), 튜너 스킨 4종, 진공관 렌더러(tubeSvg), 앰프 섀시 5종.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// ----- 튜너 스킨 시스템 -----
// 각 스킨은 { label, cfg, svg }로 정의된다. 기능 요소는 모든 스킨에서 같은 id를 쓰고
// (tsFreq/tsDialPtr/tsSignalPtr/tsTunePtr/tsLed*/tsSw*/tsKnob), 좌표·색만 cfg로 달라진다.
// 히트 영역과 방송국 마커는 cfg 좌표를 바탕으로 마운트 시 생성한다.
const SVG_NS = "http://www.w3.org/2000/svg";
let tunerSkinId = "t2";
let tunerCfg = null;
let tunerSvgEl = null;
let tsFreq = null, tsFreqGlow = null, tsDialPtr = null, tsSignalPtr = null, tsTunePtr = null, tsKnob = null, tsStationMarks = null;
let tsRaf = null;
let tsSignal = 0;
let tsTune = 0.85;
let tsFreqData = null;
let tsTimeData = null;
let tsPeak = 0;          // 피크미터용 (빠른 어택·느린 릴리즈)
let ttLastDt = 0.016;
let tsPanelState = "";
let blendOn = false;
let monoOn = false;

// ----- 공통 조명 패스 -----
// 모든 랙 유닛에 동일한 광원(전방 상단)을 입힌다: 상단 글로스, 수직 셰이드, 비네트.
// url(#id)는 문서 전체에서 해석되므로 defs는 중복 마운트되어도 무해하다.
const LZ_DEFS = '<defs>' +
    '<linearGradient id="lzGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.015"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="lzShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="0.7" stop-color="#000000" stop-opacity="0.04"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/></linearGradient>' +
    '<radialGradient id="lzVign" cx="0.5" cy="0.4" r="0.9"><stop offset="0.62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.12"/></radialGradient>' +
    '<linearGradient id="lzInset" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.42"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="lzStreak" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="0.22" stop-color="#ffffff" stop-opacity="0.01"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="lzLamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.30"/><stop offset="0.55" stop-color="#ffc070" stop-opacity="0.10"/><stop offset="1" stop-color="#ffb050" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="lzLampCool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#cfe8ff" stop-opacity="0.26"/><stop offset="0.55" stop-color="#9fc8f0" stop-opacity="0.09"/><stop offset="1" stop-color="#7fa8d8" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="lzLampGreen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c4f0d0" stop-opacity="0.26"/><stop offset="0.55" stop-color="#7fd8a0" stop-opacity="0.1"/><stop offset="1" stop-color="#4fb878" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="lzLampBlue" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#a8d4ff" stop-opacity="0.3"/><stop offset="0.55" stop-color="#4a9fe8" stop-opacity="0.12"/><stop offset="1" stop-color="#2a6fd0" stop-opacity="0"/></radialGradient>' +
    '<filter id="lzBloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>' +
    '<linearGradient id="lzFil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a2a" stop-opacity="0.35"/><stop offset="0.28" stop-color="#ffc46a"/><stop offset="0.5" stop-color="#fff2c8"/><stop offset="0.72" stop-color="#ffc46a"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0.35"/></linearGradient>' +
    '<linearGradient id="lzFilG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd07a" stop-opacity="0.35"/><stop offset="0.28" stop-color="#9af0b8"/><stop offset="0.5" stop-color="#e8fff0"/><stop offset="0.72" stop-color="#9af0b8"/><stop offset="1" stop-color="#4fd07a" stop-opacity="0.35"/></linearGradient>' +
    '<linearGradient id="lzMcBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ec6ff" stop-opacity="0.74"/><stop offset="0.45" stop-color="#1a9af2" stop-opacity="0.8"/><stop offset="1" stop-color="#0a6ed0" stop-opacity="0.66"/></linearGradient>' +
    '<linearGradient id="lzTubeGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#17171c" stop-opacity="0.9"/><stop offset="0.26" stop-color="#4c4c56" stop-opacity="0.42"/><stop offset="0.5" stop-color="#83838f" stop-opacity="0.18"/><stop offset="0.74" stop-color="#33333c" stop-opacity="0.55"/><stop offset="1" stop-color="#0e0e12" stop-opacity="0.92"/></linearGradient>' +
    '<radialGradient id="lzGetter" cx="0.4" cy="0.35" r="0.9"><stop offset="0" stop-color="#dfe5ee" stop-opacity="0.55"/><stop offset="0.45" stop-color="#98a0b2" stop-opacity="0.6"/><stop offset="1" stop-color="#20242e" stop-opacity="0.85"/></radialGradient>' +
    '<linearGradient id="lzInL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.5"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="lzInR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></linearGradient>' +
    '<linearGradient id="lzInBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.34"/></linearGradient>' +
    '<radialGradient id="lzInCirc" cx="0.5" cy="0.46" r="0.54"><stop offset="0.66" stop-color="#000000" stop-opacity="0"/><stop offset="0.88" stop-color="#000000" stop-opacity="0.3"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>' +
    '</defs>';

function applyPanelLighting(svg) {
    if (!svg) return;
    const vb = (svg.getAttribute("viewBox") || "0 0 2000 400").split(/\s+/).map(Number);
    const W = vb[2], H = vb[3];
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("pointer-events", "none");
    g.innerHTML = LZ_DEFS +
        '<rect x="0" y="0" width="' + W + '" height="' + Math.round(H * 0.32) + '" rx="8" fill="url(#lzGloss)"/>' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="url(#lzShade)"/>' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="url(#lzVign)"/>' +
        '<rect class="lzPowerDim" x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="#000000" opacity="0.22"/>';
    svg.appendChild(g);
}

const TS_HIT_META = {
    power: { title: "전원 — 재생/정지", cursor: "pointer" },
    dial: { title: "드래그하여 주파수를 맞추세요", cursor: "ew-resize" },
    blend: { title: "하이블렌드 — 고음 잡음 감쇠", cursor: "pointer" },
    mode: { title: "스테레오/모노 전환", cursor: "pointer" },
    mute: { title: "음소거", cursor: "pointer" },
    if: { title: "취침 타이머", cursor: "pointer" },
    rf: { title: "채널 목록 열기/닫기", cursor: "pointer" }
};

const TUNER_SKINS = {
    t2: {
        label: "YAHAMA T-2",
        cfg: {
            freq: { x88: 300, px: 47, drawX: 864 },
            mark: { y: 82, h: 7, hOn: 12, color: "#e8c85a", colorOn: "#ff8a3a" },
            signal: { drawX: 1030, baseX: 955, travel: 155 },
            tune: { travel: 46 },
            knob: { cx: 1852, cy: 138 },
            swTravel: 20,
            led: { on: "#ff4a26", off: "#4a1410" },
            digit: { lit: "#ff5230", glow: "#ff3a1e", dim: "#5a1e12", dimGlow: "#3a1208" },
            hits: { power: [128, 160, 52, 56], dial: [150, 56, 1220, 64], rec: [244, 138, 56, 80], blend: [338, 138, 56, 80], mode: [428, 138, 56, 80], mute: [520, 138, 56, 80], if: [608, 138, 56, 80], rf: [694, 138, 56, 80], knob: [1852, 140, 112] }
        },
        svg: `<svg class="tuner-svg" viewBox="0 0 2000 269" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Yahama Natural Sound FM Stereo Tuner T-2">
            <defs>
                <linearGradient id="tnPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d5951"/><stop offset="0.05" stop-color="#514e46"/><stop offset="0.5" stop-color="#4a4740"/><stop offset="1" stop-color="#393630"/></linearGradient>
                <linearGradient id="tnBevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b2afa7"/><stop offset="0.5" stop-color="#918e86"/><stop offset="1" stop-color="#63605a"/></linearGradient>
                <linearGradient id="tnDialWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0c07"/><stop offset="0.5" stop-color="#12140c"/><stop offset="1" stop-color="#181a10"/></linearGradient>
                <linearGradient id="tnMeterWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0e0a"/><stop offset="1" stop-color="#17170f"/></linearGradient>
                <radialGradient id="tnKnobFace" cx="0.38" cy="0.34" r="0.85"><stop offset="0" stop-color="#56545c"/><stop offset="0.45" stop-color="#403e45"/><stop offset="1" stop-color="#262429"/></radialGradient>
                <linearGradient id="tnKnobRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5960"/><stop offset="1" stop-color="#201f24"/></linearGradient>
                <linearGradient id="tnSwitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2830"/><stop offset="1" stop-color="#3f3d45"/></linearGradient>
                <filter id="tnGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
                <pattern id="tnTicksMinor" width="13" height="30" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="1.4" height="14" fill="#8f8a4a"/></pattern>
                <pattern id="tnTicksMajor" width="65" height="30" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="2.2" height="24" fill="#c8c07a"/></pattern>
            </defs>
            <rect x="0" y="0" width="2000" height="269" rx="6" fill="url(#tnPanel)"/>
            <rect x="0" y="0" width="2000" height="13" rx="6" fill="url(#tnBevel)"/>
            <rect x="0" y="12" width="2000" height="2" fill="#26242a" opacity="0.7"/>
            <rect x="0" y="255" width="2000" height="14" fill="#000000" opacity="0.18"/>
            <rect x="120" y="23" width="30" height="30" rx="15" fill="none" stroke="#d9d7dc" stroke-width="1.6"/>
            <g stroke="#d9d7dc" stroke-width="1.7" fill="none" stroke-linecap="round">
                <path d="M129 30 L129 42"/><path d="M135 27 L135 42"/><path d="M141 30 L141 42"/><path d="M129 42 Q135 47 141 42"/><path d="M135 42 L135 47"/>
            </g>
            <text x="160" y="43" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" letter-spacing="1.5" fill="#e6e5e8">YAHAMA</text>
            <text x="298" y="41" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" letter-spacing="2" fill="#b3b1b8">NATURAL SOUND<tspan dx="18">FM STEREO TUNER</tspan><tspan dx="18" font-weight="700" fill="#c8c6cd">T-2</tspan></text>
            <rect x="128" y="58" width="1272" height="64" rx="4" fill="url(#tnDialWin)" stroke="#0a0b06" stroke-width="2"/>
            <ellipse class="lampGlow" cx="764" cy="92" rx="560" ry="52" fill="url(#lzLampGreen)" opacity="0.4"/>
            <rect x="128" y="58" width="1272" height="16" fill="url(#lzInset)" opacity="0.8"/>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="12.5" font-weight="700" fill="#cfc78a" text-anchor="middle">
                <text x="150" y="76" fill="#d8d0a0">FM</text><text x="300" y="76">88</text><text x="488" y="76">92</text><text x="676" y="76">96</text><text x="864" y="76">100</text><text x="1052" y="76">104</text><text x="1240" y="76">108</text><text x="1360" y="76" fill="#a49c6a">MHz</text>
            </g>
            <rect class="dialScale" x="150" y="86" width="1210" height="14" fill="url(#tnTicksMinor)"/>
            <rect class="dialScale" x="150" y="86" width="1210" height="24" fill="url(#tnTicksMajor)"/>
            <g id="tsStationMarks"></g>
            <g id="tsDialPtr">
                <rect x="862" y="102" width="20" height="16" rx="2" fill="#ff5a24" filter="url(#tnGlow)"/>
                <rect x="866" y="86" width="8" height="34" fill="#e23c14"/>
                <rect x="868" y="86" width="4" height="34" fill="#ff8a5a"/>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" letter-spacing="0.5" fill="#a7a5ac" text-anchor="middle">
                <text x="1452" y="74">STEREO</text><text x="1524" y="74">LOCK</text><text x="1596" y="74">HI-BLEND</text>
            </g>
            <rect id="tsLedStereo" x="1432" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <rect id="tsLedLock" x="1504" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <rect id="tsLedBlend" x="1576" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <g font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" letter-spacing="0.8" fill="#c3c1c8" text-anchor="middle">
                <text x="152" y="152">POWER</text><text x="272" y="152">REC CAL</text><text x="366" y="152">BLEND</text><text x="456" y="152">MODE</text><text x="548" y="152">MUTE/STE</text><text x="636" y="152">IF MODE</text><text x="722" y="152">RF MODE</text>
            </g>
            <rect x="132" y="164" width="40" height="48" rx="4" fill="url(#tnSwitch)" stroke="#25232a" stroke-width="1"/>
            <rect id="tsPwrTop" x="140" y="172" width="24" height="15" rx="2" fill="#1c1a20"/>
            <rect id="tsPwrBot" x="140" y="190" width="24" height="15" rx="2" fill="#54525a"/>
            <g>
                <rect x="252" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwRec" x="262" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="346" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwBlend" x="356" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="436" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwMode" x="446" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="528" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwMute" x="538" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="616" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwIf" x="626" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="702" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwRf" x="712" y="171" width="20" height="18" rx="3" fill="#57555d"/>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" letter-spacing="1.5" fill="#c3c1c8" text-anchor="middle">
                <text x="1030" y="150">SIGNAL QUALITY</text><text x="1290" y="150">TUNING</text><text x="1520" y="150">STATION</text>
            </g>
            <rect x="925" y="162" width="212" height="50" rx="4" fill="url(#tnMeterWin)" stroke="#0a0b06" stroke-width="1.5"/>
            <g stroke="#8f8a4a" stroke-width="1.3">
                <line x1="948" y1="182" x2="948" y2="196"/><line x1="972" y1="184" x2="972" y2="196"/><line x1="996" y1="182" x2="996" y2="196"/><line x1="1020" y1="184" x2="1020" y2="196"/><line x1="1044" y1="182" x2="1044" y2="196"/><line x1="1068" y1="184" x2="1068" y2="196"/><line x1="1092" y1="182" x2="1092" y2="196"/><line x1="1114" y1="184" x2="1114" y2="196"/>
            </g>
            <g id="tsSignalPtr">
                <rect x="1029" y="172" width="3" height="32" fill="#ff3a1e" filter="url(#tnGlow)"/>
                <rect x="1030" y="172" width="1.5" height="32" fill="#ff7a55"/>
            </g>
            <rect x="925" y="162" width="212" height="11" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="925" y="162" width="10" height="50" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1127" y="162" width="10" height="50" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="925" y="204" width="212" height="8" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="923" y="159" width="216" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="923" y="213" width="216" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect x="1182" y="162" width="212" height="50" rx="4" fill="url(#tnMeterWin)" stroke="#0a0b06" stroke-width="1.5"/>
            <g stroke="#8f8a4a" stroke-width="1.3">
                <line x1="1210" y1="184" x2="1210" y2="196"/><line x1="1234" y1="184" x2="1234" y2="196"/><line x1="1258" y1="184" x2="1258" y2="196"/><line x1="1330" y1="184" x2="1330" y2="196"/><line x1="1354" y1="184" x2="1354" y2="196"/><line x1="1378" y1="184" x2="1378" y2="196"/>
            </g>
            <g id="tsTunePtr">
                <rect x="1287" y="172" width="3" height="32" fill="#ff3a1e" filter="url(#tnGlow)"/>
                <rect x="1288" y="172" width="1.5" height="32" fill="#ff7a55"/>
            </g>
            <rect x="1182" y="162" width="212" height="11" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1182" y="162" width="10" height="50" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1384" y="162" width="10" height="50" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1182" y="204" width="212" height="8" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1180" y="159" width="216" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1180" y="213" width="216" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect x="1424" y="162" width="196" height="50" rx="4" fill="#050505" stroke="#000000" stroke-width="1.5"/>
            <text x="1440" y="182" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#c23018">FM</text>
            <text x="1440" y="200" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" fill="#7a2416">MHz</text>
            <text id="tsFreqGlow" x="1600" y="200" font-family="'Courier New', monospace" font-size="38" font-weight="700" fill="#3a1208" text-anchor="end" filter="url(#tnGlow)">--.-</text>
            <text id="tsFreq" x="1600" y="200" font-family="'Courier New', monospace" font-size="38" font-weight="700" fill="#5a1e12" text-anchor="end">--.-</text>
            <rect x="1424" y="162" width="196" height="11" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1424" y="162" width="10" height="50" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1610" y="162" width="10" height="50" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1424" y="204" width="196" height="8" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1422" y="159" width="200" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1422" y="213" width="200" height="2.5" fill="#ffffff" opacity="0.09"/>
            <ellipse cx="1852" cy="140" rx="112" ry="110" fill="#1c1b20"/>
            <g id="tsKnob">
                <ellipse cx="1852" cy="138" rx="110" ry="108" fill="url(#tnKnobRim)"/>
                <ellipse cx="1852" cy="138" rx="98" ry="97" fill="url(#tnKnobFace)"/>
                <circle cx="1852" cy="62" r="7" fill="#191820"/>
            </g>
            <ellipse cx="1820" cy="112" rx="42" ry="34" fill="#ffffff" opacity="0.05" pointer-events="none"/>
        </svg>`
    },
    mr78: {
        label: "McIntoch MR-78",
        cfg: {
            freq: { x88: 430, px: 54, drawX: 970 },
            mark: { y: 182, h: 10, hOn: 16, color: "#7fd8cf", colorOn: "#ff5a3a" },
            signal: { drawX: 560, baseX: 435, travel: 250 },
            tune: { travel: 130 },
            knob: { cx: 1755, cy: 215 },
            swTravel: 7,
            led: { on: "#ff4a3a", off: "#3a1512" },
            digit: { lit: "#57b0ff", glow: "#2a6fd0", dim: "#16324d", dimGlow: "#0d1f30" },
            hits: { power: [65, 520, 80, 80], dial: [430, 95, 1080, 170], rec: [310, 470, 140, 130], if: [550, 470, 140, 130], blend: [790, 470, 140, 130], mute: [1030, 470, 140, 130], mode: [1270, 470, 140, 130], rf: [1510, 470, 140, 130], knob: [1755, 215, 132] }
        },
        svg: `<svg class="tuner-svg" viewBox="0 0 2000 700" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntoch MR-78 FM Tuner">
            <defs>
                <linearGradient id="mrPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17171a"/><stop offset="0.5" stop-color="#0d0d10"/><stop offset="1" stop-color="#08080a"/></linearGradient>
                <linearGradient id="mrRail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d8d8dc"/><stop offset="0.5" stop-color="#8a8a92"/><stop offset="1" stop-color="#55555c"/></linearGradient>
                <linearGradient id="mrMeter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#95e4da"/><stop offset="1" stop-color="#5cb6ad"/></linearGradient>
                <radialGradient id="mrKnob" cx="0.38" cy="0.32" r="0.9"><stop offset="0" stop-color="#3a3a40"/><stop offset="0.6" stop-color="#1c1c22"/><stop offset="1" stop-color="#0c0c10"/></radialGradient>
                <filter id="mrGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
                <pattern id="mrTickMinor" width="10.8" height="30" patternUnits="userSpaceOnUse"><rect width="1.2" height="14" fill="#e8e8ea" opacity="0.75"/></pattern>
                <pattern id="mrTickMajor" width="54" height="30" patternUnits="userSpaceOnUse"><rect width="2" height="24" fill="#ffffff"/></pattern>
            </defs>
            <rect x="0" y="0" width="2000" height="700" rx="8" fill="url(#mrPanel)"/>
            <rect x="0" y="0" width="30" height="700" rx="8" fill="url(#mrRail)"/>
            <rect x="1970" y="0" width="30" height="700" rx="8" fill="url(#mrRail)"/>
            <rect x="0" y="686" width="2000" height="14" fill="#000000" opacity="0.4"/>
            <!-- FUNCTION 표시창 -->
            <rect x="70" y="60" width="240" height="145" rx="4" fill="#050506" stroke="#6b6648" stroke-width="1.6"/>
            <text x="190" y="88" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="2.5" fill="#7ee08a" text-anchor="middle">FUNCTION</text>
            <text id="tsLedStereo" data-on="#ff4a3a" data-off="#3a1512" x="190" y="126" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a1512" text-anchor="middle">STEREO</text>
            <text id="tsLedLock" data-on="#ffd24a" data-off="#3a3012" x="190" y="158" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a3012" text-anchor="middle">LOCKED</text>
            <text id="tsLedBlend" data-on="#ff9a3a" data-off="#3a2312" x="190" y="190" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a2312" text-anchor="middle">FILTER</text>
            <!-- STATION 표시창 -->
            <rect x="70" y="225" width="240" height="145" rx="4" fill="#050506" stroke="#6b6648" stroke-width="1.6"/>
            <rect class="lampGlow" x="72" y="227" width="236" height="141" rx="3" fill="url(#lzMcBlue)" opacity="0.4" style="mix-blend-mode:screen"/>
            <text x="190" y="253" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="2.5" fill="#7ee08a" text-anchor="middle">STATION</text>
            <text id="tsFreqGlow" x="190" y="330" font-family="'Courier New', monospace" font-size="54" font-weight="700" fill="#0d1f30" text-anchor="middle" filter="url(#mrGlow)">--.-</text>
            <text id="tsFreq" x="190" y="330" font-family="'Courier New', monospace" font-size="54" font-weight="700" fill="#16324d" text-anchor="middle">--.-</text>
            <rect x="70" y="225" width="240" height="31.9" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="70" y="225" width="12" height="145" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="298" y="225" width="12" height="145" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="70" y="346.8" width="240" height="23.2" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="68" y="222" width="244" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="68" y="371" width="244" height="2.5" fill="#ffffff" opacity="0.09"/>
            <!-- 다이얼 창 (블랙글라스) -->
            <rect x="350" y="60" width="1210" height="310" rx="4" fill="#060607" stroke="#6b6648" stroke-width="1.6"/>
            <rect class="lampGlow" x="352" y="62" width="1206" height="306" rx="3" fill="url(#lzMcBlue)" opacity="0.4" style="mix-blend-mode:screen"/>
            <rect x="350" y="60" width="1210" height="20" fill="url(#lzInset)" opacity="0.8"/>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#f2f2f2" text-anchor="middle">
                <text x="430" y="130">88</text><text x="538" y="130">90</text><text x="646" y="130">92</text><text x="754" y="130">94</text><text x="862" y="130">96</text><text x="970" y="130">98</text><text x="1078" y="130">100</text><text x="1186" y="130">102</text><text x="1294" y="130">104</text><text x="1402" y="130">106</text><text x="1510" y="130">108</text>
            </g>
            <rect class="dialScale" x="430" y="150" width="1080" height="16" fill="url(#mrTickMinor)"/>
            <rect class="dialScale" x="430" y="150" width="1080" height="26" fill="url(#mrTickMajor)"/>
            <g id="tsStationMarks"></g>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#cfcfcf" text-anchor="middle">
                <text x="430" y="238">0</text><text x="538" y="238">10</text><text x="646" y="238">20</text><text x="754" y="238">30</text><text x="862" y="238">40</text><text x="970" y="238">50</text><text x="1078" y="238">60</text><text x="1186" y="238">70</text><text x="1294" y="238">80</text><text x="1402" y="238">90</text><text x="1510" y="238">100</text>
            </g>
            <g id="tsDialPtr">
                <rect x="968" y="115" width="4" height="135" fill="#ff2a1a" filter="url(#mrGlow)"/>
                <rect x="969" y="115" width="2" height="135" fill="#ff6a4a"/>
            </g>
            <!-- 틸 미터 (SIGNAL / TUNING) -->
            <text x="560" y="266" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="#7ee08a" text-anchor="middle">SIGNAL STRENGTH</text>
            <rect x="420" y="276" width="280" height="60" rx="3" fill="url(#mrMeter)"/>
            <g stroke="#134a44" stroke-width="1.4">
                <line x1="450" y1="286" x2="450" y2="302"/><line x1="490" y1="290" x2="490" y2="302"/><line x1="530" y1="286" x2="530" y2="302"/><line x1="570" y1="290" x2="570" y2="302"/><line x1="610" y1="286" x2="610" y2="302"/><line x1="650" y1="290" x2="650" y2="302"/><line x1="680" y1="286" x2="680" y2="302"/>
            </g>
            <g id="tsSignalPtr">
                <rect x="558" y="280" width="4" height="52" fill="#0a1a18"/>
            </g>
            <rect x="420" y="276" width="280" height="13.2" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="420" y="276" width="14" height="60" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="686" y="276" width="14" height="60" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="420" y="326.4" width="280" height="9.6" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="418" y="273" width="284" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="418" y="337" width="284" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect class="meterDark" x="420" y="276" width="280" height="60" rx="3" fill="#0d0a06" opacity="0.5"/>
            <text x="1350" y="266" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="#7ee08a" text-anchor="middle">TUNING</text>
            <rect x="1210" y="276" width="280" height="60" rx="3" fill="url(#mrMeter)"/>
            <g stroke="#134a44" stroke-width="1.4">
                <line x1="1240" y1="288" x2="1240" y2="302"/><line x1="1295" y1="290" x2="1295" y2="302"/><line x1="1350" y1="284" x2="1350" y2="304"/><line x1="1405" y1="290" x2="1405" y2="302"/><line x1="1460" y1="288" x2="1460" y2="302"/>
            </g>
            <g id="tsTunePtr">
                <rect x="1348" y="280" width="4" height="52" fill="#0a1a18"/>
            </g>
            <rect x="1210" y="276" width="280" height="13.2" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1210" y="276" width="14" height="60" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1476" y="276" width="14" height="60" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1210" y="326.4" width="280" height="9.6" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1208" y="273" width="284" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1208" y="337" width="284" height="2.5" fill="#ffffff" opacity="0.09"/>
            <rect class="meterDark" x="1210" y="276" width="280" height="60" rx="3" fill="#0d0a06" opacity="0.5"/>
            <!-- 브랜드 -->
            <text x="955" y="310" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="46" font-weight="700" fill="#d8b060" text-anchor="middle">McIntoch</text>
            <text x="955" y="345" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" letter-spacing="7" fill="#e8e8ea" text-anchor="middle">MR 78 FM TUNER</text>
            <!-- 튜닝 노브 (우상단, 다이얼 높이) -->
            <circle cx="1755" cy="215" r="134" fill="#050507"/>
            <g id="tsKnob">
                <circle cx="1755" cy="215" r="130" fill="url(#mrKnob)" stroke="#c8c8ce" stroke-width="3"/>
                <circle cx="1755" cy="215" r="112" fill="none" stroke="#3a3a42" stroke-width="1.5"/>
                <circle cx="1755" cy="123" r="8" fill="#4a4a52"/>
            </g>
            <ellipse cx="1712" cy="176" rx="46" ry="36" fill="#ffffff" opacity="0.05" pointer-events="none"/>
            <!-- 하단 노브 행 (글라스 위) -->
            <g font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#7ee08a" text-anchor="middle">
                <text x="380" y="462">SELECTIVITY</text><text x="620" y="462">METER</text><text x="860" y="462">FILTER</text><text x="1100" y="462">MUTING</text><text x="1340" y="462">MODE</text><text x="1580" y="462">VOLUME</text>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1" fill="#4e8a5a" text-anchor="middle">
                <text x="380" y="480">REC</text><text x="620" y="480">TIMER</text><text x="860" y="480">HI BLEND</text><text x="1100" y="480">MUTE</text><text x="1340" y="480">STEREO/MONO</text><text x="1580" y="480">LIST</text>
            </g>
            <g>
                <circle cx="380" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwRec" x="378" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="620" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwIf" x="618" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="860" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwBlend" x="858" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1100" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwMute" x="1098" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1340" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwMode" x="1338" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1580" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><rect id="tsSwRf" x="1578" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
            </g>
            <!-- PANLOC (좌 = 전원) -->
            <circle cx="105" cy="560" r="20" fill="#1c1c22" stroke="#8a8a92" stroke-width="1.6"/>
            <circle id="tsSwPwr" cx="105" cy="556" r="9" fill="#55555c"/>
            <text x="105" y="608" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1.5" fill="#7ee08a" text-anchor="middle">PANLOC</text>
            <circle cx="1895" cy="560" r="20" fill="#1c1c22" stroke="#8a8a92" stroke-width="1.6"/>
            <circle cx="1895" cy="556" r="9" fill="#55555c"/>
            <text x="1895" y="608" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1.5" fill="#7ee08a" text-anchor="middle">PANLOC</text>
            <!-- 하단 로고 -->
            <text x="955" y="655" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="22" font-weight="700" fill="#3a3a42" text-anchor="middle">McIntoch</text>
        </svg>`
    },
    m10b: {
        label: "Maranz 10B",
        cfg: {
            freq: { x88: 430, px: 57.5, drawX: 1005 },
            mark: { y: 340, h: 7, hOn: 12, color: "#4ac8c8", colorOn: "#ff7a2a" },
            signal: { drawX: 1530, baseX: 1460, travel: 140 },
            tune: { travel: 140 },
            knob: { cx: 1000, cy: 515 },
            swTravel: 6,
            led: { on: "#ff3a2a", off: "#2a0d0a" },
            digit: { lit: "#ff4a2a", glow: "#d02a12", dim: "#3a1410", dimGlow: "#200c08" },
            hits: { power: [1450, 450, 140, 140], dial: [430, 292, 1150, 92], rec: [300, 225, 60, 60], blend: [410, 450, 140, 140], mode: [610, 450, 140, 140], mute: [1650, 450, 140, 140], if: [1250, 450, 140, 140], rf: [1640, 225, 60, 60], knob: [1000, 515, 100] }
        },
        svg: `<svg class="tuner-svg" viewBox="0 0 2000 730" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Maranz Model 10B Stereo FM Tuner">
            <defs>
                <linearGradient id="mzWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a2c"/><stop offset="0.5" stop-color="#5d3620"/><stop offset="1" stop-color="#402414"/></linearGradient>
                <linearGradient id="mzPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfd6bd"/><stop offset="0.5" stop-color="#cfc6aa"/><stop offset="1" stop-color="#b8ae90"/></linearGradient>
                <radialGradient id="mzKnob" cx="0.4" cy="0.32" r="0.9"><stop offset="0" stop-color="#f2eee2"/><stop offset="0.55" stop-color="#c9c2ae"/><stop offset="1" stop-color="#8f8a76"/></radialGradient>
                <linearGradient id="mzScope" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04170b"/><stop offset="1" stop-color="#020a05"/></linearGradient>
                <filter id="mzGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>
                <pattern id="mzBrush" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity="0.04"/></pattern>
                <pattern id="mzTick" width="11.5" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="7" r="1.9" fill="#4ac8c8"/></pattern>
            </defs>
            <!-- 월넛 우드 케이스 -->
            <rect x="0" y="0" width="2000" height="730" rx="12" fill="url(#mzWood)"/>
            <rect x="0" y="0" width="2000" height="730" rx="12" fill="none" stroke="#2a1810" stroke-width="3"/>
            <rect x="20" y="14" width="1960" height="8" rx="4" fill="#8a5a36" opacity="0.5"/>
            <rect x="20" y="706" width="1960" height="8" rx="4" fill="#1c0f08" opacity="0.6"/>
            <!-- 샴페인 알루미늄 패널 -->
            <rect x="90" y="60" width="1820" height="610" rx="4" fill="url(#mzPanel)"/>
            <rect x="90" y="60" width="1820" height="610" rx="4" fill="url(#mzBrush)"/>
            <circle cx="130" cy="100" r="8" fill="#9a9076"/><circle cx="1870" cy="100" r="8" fill="#9a9076"/><circle cx="130" cy="630" r="8" fill="#9a9076"/><circle cx="1870" cy="630" r="8" fill="#9a9076"/>
            <!-- 블랙 윈도우 -->
            <rect x="360" y="120" width="1280" height="270" rx="6" fill="#070707" stroke="#1c1a16" stroke-width="3"/>
            <ellipse class="lampGlow" cx="1050" cy="330" rx="600" ry="58" fill="url(#lzLamp)" opacity="0.4"/>
            <rect x="360" y="120" width="1280" height="18" fill="url(#lzInset)" opacity="0.8"/>
            <!-- 오실로스코프 -->
            <rect x="390" y="140" width="370" height="230" rx="4" fill="url(#mzScope)" stroke="#0d2a16" stroke-width="2"/>
            <text x="575" y="168" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="3" fill="#3fd06a" text-anchor="middle" opacity="0.9">TUNE TO CENTER</text>
            <g stroke="#1f7a3c" stroke-width="1.2" opacity="0.8">
                <line x1="575" y1="185" x2="575" y2="350"/>
                <line x1="545" y1="205" x2="605" y2="205"/><line x1="555" y1="235" x2="595" y2="235"/><line x1="535" y1="267" x2="615" y2="267"/><line x1="555" y1="299" x2="595" y2="299"/><line x1="545" y1="330" x2="605" y2="330"/>
            </g>
            <g id="tsTunePtr">
                <rect x="572" y="185" width="6" height="165" fill="#ffb03a" filter="url(#mzGlow)" opacity="0.9"/>
                <rect x="574" y="185" width="2.5" height="165" fill="#ffd98a"/>
            </g>
            <!-- 브랜드 -->
            <text x="1130" y="230" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="1" fill="#e8e2cf" text-anchor="middle">maranz<tspan font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="400" fill="#4ac8c8" dx="14">Stereo</tspan><tspan dx="14" font-size="28">fm tuner</tspan><tspan dx="18" font-size="15" fill="#ff8a3a" letter-spacing="2">MODEL 10 B</tspan></text>
            <!-- STEREO 표시창 + LOCK/BLEND 램프 -->
            <rect x="1450" y="196" width="130" height="44" rx="3" fill="#0d0808" stroke="#2a2a2e" stroke-width="1.5"/>
            <text id="tsLedStereo" data-on="#ff4a3a" data-off="#241012" x="1515" y="225" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2.5" fill="#241012" text-anchor="middle">STEREO</text>
            <circle id="tsLedLock" data-on="#62e07a" data-off="#12300f" cx="1608" cy="207" r="6" fill="#12300f"/>
            <circle id="tsLedBlend" data-on="#ffb03a" data-off="#3a2a10" cx="1608" cy="230" r="6" fill="#3a2a10"/>
            <!-- STATION 디지트 (윈도우 내 우측) -->
            <text id="tsFreqGlow" x="1595" y="290" font-family="'Courier New', monospace" font-size="32" font-weight="700" fill="#200c08" text-anchor="end" filter="url(#mzGlow)">--.-</text>
            <text id="tsFreq" x="1595" y="290" font-family="'Courier New', monospace" font-size="32" font-weight="700" fill="#3a1410" text-anchor="end">--.-</text>
            <!-- 주파수 스케일 -->
            <g class="dialScale" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#e6dfc6" text-anchor="middle">
                <text x="430" y="332">88</text><text x="545" y="332">90</text><text x="660" y="332">92</text><text x="775" y="332">94</text><text x="890" y="332">96</text><text x="1005" y="332">98</text><text x="1120" y="332">100</text><text x="1235" y="332">102</text><text x="1350" y="332">104</text><text x="1465" y="332">106</text><text x="1580" y="332">108</text>
            </g>
            <g id="tsStationMarks"></g>
            <rect class="dialScale" x="430" y="348" width="1150" height="14" fill="url(#mzTick)"/>
            <g id="tsDialPtr">
                <rect x="1003" y="302" width="4" height="66" fill="#ff7a2a" filter="url(#mzGlow)"/>
                <rect x="1004" y="302" width="2" height="66" fill="#ffb07a"/>
            </g>
            <!-- Vert./Hor. 소형 버튼 -->
            <circle cx="330" cy="255" r="10" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/>
            <circle id="tsSwRec" cx="330" cy="255" r="4" fill="#b8ae90"/>
            <text x="330" y="285" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="13" fill="#4a4436" text-anchor="middle">Vert.</text>
            <circle cx="1670" cy="255" r="10" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/>
            <circle id="tsSwRf" cx="1670" cy="255" r="4" fill="#b8ae90"/>
            <text x="1670" y="285" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="13" fill="#4a4436" text-anchor="middle">Hor.</text>
            <!-- 신호 미터 (우측 슬롯) -->
            <text x="1435" y="434" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="13" fill="#4a4436" text-anchor="end">signal</text>
            <rect x="1450" y="415" width="160" height="27" rx="3" fill="#0d0d0d" stroke="#8f8a76" stroke-width="1.2"/>
            <g id="tsSignalPtr">
                <rect x="1528.5" y="419" width="3" height="19" fill="#e8e2cf"/>
            </g>
            <rect x="1450" y="415" width="160" height="7" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="1450" y="415" width="7" height="27" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="1603" y="415" width="7" height="27" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="1450" y="437.7" width="160" height="4.3" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="1448" y="412" width="164" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="1448" y="443" width="164" height="2.5" fill="#ffffff" opacity="0.09"/>
            <!-- 컨트롤 노브 -->
            <g font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="17" font-weight="700" fill="#2a2a2e" text-anchor="middle">
                <text x="480" y="596">blend</text><text x="680" y="596">mode</text><text x="1000" y="648">tuning</text><text x="1320" y="596">timer</text><text x="1520" y="596">power</text><text x="1720" y="596">muting</text>
            </g>
            <g>
                <circle cx="480" cy="520" r="38" fill="#8f8a76"/><circle cx="480" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><rect id="tsSwBlend" x="478" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="680" cy="520" r="38" fill="#8f8a76"/><circle cx="680" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><rect id="tsSwMode" x="678" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1320" cy="520" r="38" fill="#8f8a76"/><circle cx="1320" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><rect id="tsSwIf" x="1318" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1520" cy="520" r="38" fill="#8f8a76"/><circle cx="1520" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><rect id="tsSwPwr" x="1518" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1720" cy="520" r="38" fill="#8f8a76"/><circle cx="1720" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><rect id="tsSwMute" x="1718" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
            </g>
            <circle cx="1000" cy="519" r="99" fill="#8f8a76"/>
            <g id="tsKnob">
                <circle cx="1000" cy="515" r="95" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="2"/>
                <circle cx="1000" cy="446" r="6" fill="#4a4436"/>
            </g>
            <ellipse cx="968" cy="482" rx="34" ry="26" fill="#ffffff" opacity="0.25" pointer-events="none"/>
        </svg>`
    },
    tu9900: {
        label: "Sansul TU-9900",
        cfg: {
            freq: { x88: 440, px: 56, drawX: 1000 },
            mark: { y: 186, h: 9, hOn: 15, color: "#9fd8ff", colorOn: "#ff5a3a" },
            signal: { drawX: 520, baseX: 405, travel: 230 },
            tune: { travel: 115 },
            knob: { cx: 1815, cy: 310 },
            swTravel: 9,
            led: { on: "#ff3a2a", off: "#3a1210" },
            digit: { lit: "#ff3a26", glow: "#c8200f", dim: "#441410", dimGlow: "#280c08" },
            hits: { power: [40, 545, 270, 64], dial: [440, 74, 1130, 150], rec: [40, 116, 270, 48], blend: [40, 172, 270, 48], mode: [40, 228, 270, 48], mute: [40, 284, 270, 48], if: [40, 340, 270, 48], rf: [40, 396, 270, 48], knob: [1815, 310, 150] }
        },
        svg: `<svg class="tuner-svg" viewBox="0 0 2000 660" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Sansul TU-9900 AM/FM Stereo Tuner">
            <defs>
                <linearGradient id="suPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b1f"/><stop offset="0.5" stop-color="#121215"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
                <linearGradient id="suDial" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16283c"/><stop offset="0.35" stop-color="#0c1626"/><stop offset="1" stop-color="#05070c"/></linearGradient>
                <radialGradient id="suKnob" cx="0.38" cy="0.32" r="0.9"><stop offset="0" stop-color="#f0f0f4"/><stop offset="0.5" stop-color="#b8b8c0"/><stop offset="1" stop-color="#6a6a72"/></radialGradient>
                <linearGradient id="suMeter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4258"/><stop offset="1" stop-color="#101a26"/></linearGradient>
                <filter id="suGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>
                <pattern id="suTickMinor" width="11.2" height="24" patternUnits="userSpaceOnUse"><rect width="1.2" height="12" fill="#cfe4f5" opacity="0.7"/></pattern>
                <pattern id="suTickMajor" width="56" height="24" patternUnits="userSpaceOnUse"><rect width="2" height="20" fill="#ffffff"/></pattern>
            </defs>
            <rect x="0" y="0" width="2000" height="660" rx="8" fill="url(#suPanel)"/>
            <rect x="0" y="48" width="2000" height="2" fill="#3a3a42" opacity="0.8"/>
            <rect x="0" y="646" width="2000" height="14" fill="#000000" opacity="0.4"/>
            <!-- 상단 브랜드 스트립 -->
            <text x="310" y="33" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1" fill="#e8e8ec">TU-9900</text>
            <text x="460" y="35" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" font-weight="700" fill="#f0f0f2">Sansul</text>
            <text x="1530" y="33" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="1.5" fill="#c8c8d0">AM/FM Stereo Tuner</text>
            <!-- 좌측 레버 컬럼 -->
            <rect x="56" y="76" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect x="62" y="80" width="24" height="9" rx="2" fill="#55555c"/>
            <text x="108" y="95" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="0.8" fill="#8a8a94">ANT ATT</text>
            <g font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="0.8" fill="#c8c8d0">
                <text x="108" y="145">CAL LEVEL</text><text x="108" y="201">BAND WIDTH</text><text x="108" y="257">FM MODE</text><text x="108" y="313">MUTING</text><text x="108" y="369">SLEEP</text><text x="108" y="425">MET SELECT</text>
            </g>
            <g>
                <rect x="56" y="128" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwRec" x="62" y="132" width="24" height="9" rx="2" fill="#8a8a94"/>
                <rect x="56" y="184" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwBlend" x="62" y="188" width="24" height="9" rx="2" fill="#8a8a94"/>
                <rect x="56" y="240" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwMode" x="62" y="244" width="24" height="9" rx="2" fill="#8a8a94"/>
                <rect x="56" y="296" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwMute" x="62" y="300" width="24" height="9" rx="2" fill="#8a8a94"/>
                <rect x="56" y="352" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwIf" x="62" y="356" width="24" height="9" rx="2" fill="#8a8a94"/>
                <rect x="56" y="408" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect id="tsSwRf" x="62" y="412" width="24" height="9" rx="2" fill="#8a8a94"/>
            </g>
            <!-- OUTPUT LEVEL(장식) + POWER -->
            <circle cx="95" cy="490" r="26" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="1.6"/>
            <rect x="93" y="466" width="4" height="12" rx="2" fill="#26262c"/>
            <text x="150" y="495" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="0.8" fill="#8a8a94">OUTPUT LEVEL</text>
            <rect x="52" y="560" width="48" height="34" rx="4" fill="#26262c" stroke="#3a3a42"/>
            <rect id="tsSwPwr" x="59" y="566" width="34" height="11" rx="2" fill="#8a8a94"/>
            <text x="115" y="583" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="#e8e8ec">POWER</text>
            <!-- 다이얼 창 -->
            <rect x="320" y="64" width="1320" height="376" rx="5" fill="url(#suDial)" stroke="#26262c" stroke-width="2.5"/>
            <rect x="320" y="66" width="1320" height="58" fill="#bfe8ff" opacity="0.1"/>
            <ellipse class="lampGlow" cx="980" cy="140" rx="620" ry="90" fill="url(#lzLampCool)" opacity="0.4"/>
            <rect x="320" y="64" width="1320" height="20" fill="url(#lzInset)" opacity="0.8"/>
            <rect x="320" y="64" width="20" height="376" fill="url(#lzInL)" opacity="0.4"/>
            <rect x="1620" y="64" width="20" height="376" fill="url(#lzInR)" opacity="0.4"/>
            <rect x="320" y="390" width="1320" height="50" fill="url(#lzInBot)" opacity="0.4"/>
            <text class="dialScale" x="352" y="142" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#cfeaff">FM</text>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#f2f6fa" text-anchor="middle">
                <text x="440" y="142">88</text><text x="552" y="142">90</text><text x="664" y="142">92</text><text x="776" y="142">94</text><text x="888" y="142">96</text><text x="1000" y="142">98</text><text x="1112" y="142">100</text><text x="1224" y="142">102</text><text x="1336" y="142">104</text><text x="1448" y="142">106</text><text x="1560" y="142">108</text>
            </g>
            <text class="dialScale" x="1600" y="142" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#9fc8e0">MHz</text>
            <rect class="dialScale" x="440" y="158" width="1120" height="14" fill="url(#suTickMinor)"/>
            <rect class="dialScale" x="440" y="158" width="1120" height="22" fill="url(#suTickMajor)"/>
            <g id="tsStationMarks"></g>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#5a7a90" text-anchor="middle">
                <text x="360" y="244">AM</text><text x="560" y="244">600</text><text x="760" y="244">800</text><text x="960" y="244">1000</text><text x="1160" y="244">1200</text><text x="1360" y="244">1400</text><text x="1520" y="244">1600</text>
            </g>
            <g id="tsDialPtr">
                <rect x="998" y="78" width="4" height="234" fill="#bfe8ff" filter="url(#suGlow)" opacity="0.9"/>
                <rect x="999" y="78" width="2" height="234" fill="#ffffff"/>
            </g>
            <!-- 트윈 미터 (아이스블루 백라이트) -->
            <text x="520" y="302" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="2.5" fill="#9fc8e0" text-anchor="middle">SIGNAL</text>
            <rect x="390" y="312" width="260" height="108" rx="4" fill="url(#suMeter)" stroke="#2a3a4a" stroke-width="1.6"/>
            <rect x="394" y="316" width="252" height="100" fill="#bfe8ff" opacity="0.1"/>
            <g stroke="#9fc8e0" stroke-width="1.2" opacity="0.7">
                <line x1="420" y1="340" x2="420" y2="362"/><line x1="460" y1="346" x2="460" y2="362"/><line x1="500" y1="340" x2="500" y2="362"/><line x1="540" y1="346" x2="540" y2="362"/><line x1="580" y1="340" x2="580" y2="362"/><line x1="620" y1="346" x2="620" y2="362"/>
            </g>
            <g id="tsSignalPtr">
                <rect x="518" y="320" width="4" height="92" fill="#dff2ff" filter="url(#suGlow)"/>
            </g>
            <rect x="390" y="312" width="260" height="23.8" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="390" y="312" width="13" height="108" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="637" y="312" width="13" height="108" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="390" y="402.7" width="260" height="17.3" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="388" y="309" width="264" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="388" y="421" width="264" height="2.5" fill="#ffffff" opacity="0.09"/>
            <text x="830" y="302" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="2.5" fill="#9fc8e0" text-anchor="middle">TUNE</text>
            <rect x="700" y="312" width="260" height="108" rx="4" fill="url(#suMeter)" stroke="#2a3a4a" stroke-width="1.6"/>
            <rect x="704" y="316" width="252" height="100" fill="#bfe8ff" opacity="0.1"/>
            <g stroke="#9fc8e0" stroke-width="1.2" opacity="0.7">
                <line x1="740" y1="346" x2="740" y2="362"/><line x1="785" y1="346" x2="785" y2="362"/><line x1="830" y1="338" x2="830" y2="364"/><line x1="875" y1="346" x2="875" y2="362"/><line x1="920" y1="346" x2="920" y2="362"/>
            </g>
            <g id="tsTunePtr">
                <rect x="828" y="320" width="4" height="92" fill="#dff2ff" filter="url(#suGlow)"/>
            </g>
            <rect x="700" y="312" width="260" height="23.8" fill="url(#lzInset)" opacity="0.62"/>
            <rect x="700" y="312" width="13" height="108" fill="url(#lzInL)" opacity="0.5"/>
            <rect x="947" y="312" width="13" height="108" fill="url(#lzInR)" opacity="0.5"/>
            <rect x="700" y="402.7" width="260" height="17.3" fill="url(#lzInBot)" opacity="0.55"/>
            <rect x="698" y="309" width="264" height="3" fill="#04050a" opacity="0.55"/>
            <rect x="698" y="421" width="264" height="2.5" fill="#ffffff" opacity="0.09"/>
            <!-- 램프 컬럼 -->
            <circle id="tsLedStereo" data-on="#ff3a2a" data-off="#3a1210" cx="1050" cy="332" r="9" fill="#3a1210" filter="url(#suGlow)"/>
            <text x="1072" y="338" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#c8d8e8">FM STEREO</text>
            <circle id="tsLedLock" data-on="#62e07a" data-off="#12300f" cx="1050" cy="374" r="9" fill="#12300f" filter="url(#suGlow)"/>
            <text x="1072" y="380" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#c8d8e8">FM AUTO</text>
            <circle id="tsLedBlend" data-on="#ffb03a" data-off="#3a2a10" cx="1050" cy="416" r="9" fill="#3a2a10" filter="url(#suGlow)"/>
            <text x="1072" y="422" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#c8d8e8">HI-BLEND</text>
            <!-- 소형 노브(장식) -->
            <circle cx="1250" cy="374" r="24" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="1.6"/>
            <rect x="1248" y="352" width="4" height="12" rx="2" fill="#26262c"/>
            <!-- STATION 디지트 -->
            <rect x="1360" y="312" width="230" height="94" rx="6" fill="#050505" stroke="#26303a" stroke-width="1.6"/>
            <text x="1376" y="344" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#c23018">FM</text>
            <text x="1376" y="364" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#7a2416">MHz</text>
            <text id="tsFreqGlow" x="1575" y="376" font-family="'Courier New', monospace" font-size="44" font-weight="700" fill="#280c08" text-anchor="end" filter="url(#suGlow)">--.-</text>
            <text id="tsFreq" x="1575" y="376" font-family="'Courier New', monospace" font-size="44" font-weight="700" fill="#441410" text-anchor="end">--.-</text>
            <!-- 하단 통풍 슬롯(장식) -->
            <g fill="#0a0a0c" opacity="0.55">
                <rect x="360" y="480" width="12" height="110" rx="4"/><rect x="408" y="480" width="12" height="110" rx="4"/><rect x="456" y="480" width="12" height="110" rx="4"/><rect x="504" y="480" width="12" height="110" rx="4"/><rect x="552" y="480" width="12" height="110" rx="4"/><rect x="600" y="480" width="12" height="110" rx="4"/><rect x="648" y="480" width="12" height="110" rx="4"/><rect x="696" y="480" width="12" height="110" rx="4"/><rect x="744" y="480" width="12" height="110" rx="4"/><rect x="792" y="480" width="12" height="110" rx="4"/><rect x="840" y="480" width="12" height="110" rx="4"/><rect x="888" y="480" width="12" height="110" rx="4"/><rect x="936" y="480" width="12" height="110" rx="4"/><rect x="984" y="480" width="12" height="110" rx="4"/><rect x="1032" y="480" width="12" height="110" rx="4"/><rect x="1080" y="480" width="12" height="110" rx="4"/><rect x="1128" y="480" width="12" height="110" rx="4"/><rect x="1176" y="480" width="12" height="110" rx="4"/><rect x="1224" y="480" width="12" height="110" rx="4"/><rect x="1272" y="480" width="12" height="110" rx="4"/><rect x="1320" y="480" width="12" height="110" rx="4"/><rect x="1368" y="480" width="12" height="110" rx="4"/><rect x="1416" y="480" width="12" height="110" rx="4"/><rect x="1464" y="480" width="12" height="110" rx="4"/><rect x="1512" y="480" width="12" height="110" rx="4"/><rect x="1560" y="480" width="12" height="110" rx="4"/><rect x="1608" y="480" width="12" height="110" rx="4"/>
            </g>
            <!-- 플라이휠 노브 -->
            <circle cx="1815" cy="314" r="154" fill="#050507"/>
            <g id="tsKnob">
                <circle cx="1815" cy="310" r="150" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="2.5"/>
                <circle cx="1815" cy="310" r="104" fill="none" stroke="#8a8a94" stroke-width="1.2" opacity="0.5"/>
                <circle cx="1815" cy="190" r="8" fill="#3a3a40"/>
            </g>
            <ellipse cx="1768" cy="262" rx="46" ry="36" fill="#ffffff" opacity="0.07" pointer-events="none"/>
            <text x="1815" y="505" font-family="Arial, Helvetica, sans-serif" font-size="13" letter-spacing="4" fill="#9a9aa2" text-anchor="middle">TUNING</text>
        </svg>`
    }
};

const SKIN_ORDER = ["t2", "mr78", "m10b", "tu9900"];

// ----- 진공관 렌더러 — 클래식 관의 실물 구조를 그린다 -----
// 유리 실루엣(직관형/벌룬형) + 내부 플레이트(양극)·마이카 디스크·게터 플래시(돔의 은거울면)
// + 필라멘트 백열 + 유리 반사. kind: "power"(앰버) | "small"(그린) | "balloon"(300B)
function tubeSvg(cx, baseY, w, h, kind) {
    const grn = kind === "small";
    const glowFill = grn ? "#7ae09a" : "#ff9a3a";
    const filGrad = grn ? "url(#lzFilG)" : "url(#lzFil)";
    const top = baseY - h;
    const r = w / 2;
    const plateW = w * 0.54, plateH = h * 0.5;
    const plateX = cx - plateW / 2, plateY = top + h * 0.27;
    let glass;
    if (kind === "balloon") {
        glass = '<path d="M ' + (cx - r) + ' ' + baseY + ' C ' + (cx - r) + ' ' + (top + h * 0.42) + ' ' + (cx - r * 0.62) + ' ' + (top + h * 0.14) + ' ' + cx + ' ' + top + ' C ' + (cx + r * 0.62) + ' ' + (top + h * 0.14) + ' ' + (cx + r) + ' ' + (top + h * 0.42) + ' ' + (cx + r) + ' ' + baseY + ' Z"';
    } else {
        glass = '<path d="M ' + (cx - r) + ' ' + baseY + ' L ' + (cx - r) + ' ' + (top + r * 1.05) + ' Q ' + (cx - r) + ' ' + top + ' ' + (cx - r * 0.34) + ' ' + top + ' L ' + (cx + r * 0.34) + ' ' + top + ' Q ' + (cx + r) + ' ' + top + ' ' + (cx + r) + ' ' + (top + r * 1.05) + ' L ' + (cx + r) + ' ' + baseY + ' Z"';
    }
    const getterCy = top + (kind === "balloon" ? h * 0.1 : r * 0.52);
    const getterRy = kind === "balloon" ? h * 0.06 : r * 0.36;
    return '<g>' +
        '<ellipse class="ampGlow" cx="' + cx + '" cy="' + (top + h * 0.55).toFixed(1) + '" rx="' + (w * 0.85).toFixed(1) + '" ry="' + (h * 0.5).toFixed(1) + '" fill="' + glowFill + '" opacity="0.06" filter="url(#lzBloom)"/>' +
        '<rect x="' + (cx - r - 5).toFixed(1) + '" y="' + (baseY - 2) + '" width="' + (w + 10) + '" height="15" rx="5" fill="#17130e"/>' +
        '<rect x="' + (cx - r - 1).toFixed(1) + '" y="' + (baseY - 8) + '" width="' + (w + 2) + '" height="9" rx="3" fill="#2b2118"/>' +
        glass + ' fill="url(#lzTubeGlass)" stroke="#6e6656" stroke-width="1.4"/>' +
        '<rect x="' + plateX.toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (plateW * 0.2).toFixed(1) + '" fill="#1d1c20" stroke="#0c0b0e" stroke-width="1"/>' +
        '<rect x="' + (plateX + plateW * 0.26).toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + (plateW * 0.12).toFixed(1) + '" height="' + plateH.toFixed(1) + '" fill="#2a2930"/>' +
        '<rect x="' + (plateX + plateW * 0.62).toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + (plateW * 0.12).toFixed(1) + '" height="' + plateH.toFixed(1) + '" fill="#2a2930"/>' +
        '<ellipse cx="' + cx + '" cy="' + (plateY - 3.5).toFixed(1) + '" rx="' + (plateW * 0.64).toFixed(1) + '" ry="3.4" fill="#8f8f96" opacity="0.85"/>' +
        '<ellipse cx="' + cx + '" cy="' + (plateY + plateH + 3.5).toFixed(1) + '" rx="' + (plateW * 0.64).toFixed(1) + '" ry="3.4" fill="#7a7a82" opacity="0.8"/>' +
        '<rect class="ampFil" x="' + (cx - 2.5) + '" y="' + (plateY + 3).toFixed(1) + '" width="5" height="' + (plateH - 6).toFixed(1) + '" rx="2.5" fill="' + filGrad + '" opacity="0.08"/>' +
        '<ellipse cx="' + cx + '" cy="' + getterCy.toFixed(1) + '" rx="' + (r * 0.55).toFixed(1) + '" ry="' + getterRy.toFixed(1) + '" fill="url(#lzGetter)" opacity="0.9"/>' +
        '<path d="M ' + (cx - r * 0.64).toFixed(1) + ' ' + (top + h * 0.17).toFixed(1) + ' Q ' + (cx - r * 0.8).toFixed(1) + ' ' + (top + h * 0.52).toFixed(1) + ' ' + (cx - r * 0.58).toFixed(1) + ' ' + (baseY - h * 0.1).toFixed(1) + '" stroke="#ffffff" stroke-width="' + (w * 0.09).toFixed(1) + '" fill="none" opacity="0.16" stroke-linecap="round"/>' +
        '<path d="M ' + (cx + r * 0.54).toFixed(1) + ' ' + (top + h * 0.22).toFixed(1) + ' Q ' + (cx + r * 0.66).toFixed(1) + ' ' + (top + h * 0.52).toFixed(1) + ' ' + (cx + r * 0.5).toFixed(1) + ' ' + (baseY - h * 0.12).toFixed(1) + '" stroke="#ffffff" stroke-width="' + (w * 0.05).toFixed(1) + '" fill="none" opacity="0.07" stroke-linecap="round"/>' +
        '</g>';
}

// ----- 앰프 (TR 1종 + 진공관 3종, 모델별 고유 음색 · 실물 사진 기반 섀시 뷰) -----
const AMP_MODELS = {
    tr: {
        pill: "TR · CA-100",
        desc: "솔리드스테이트 인티앰프 — 무색·투명, 높은 댐핑 (Yamaha CA-1000 오마주)",
        vol: { cx: 1770, cy: 326, r: 160 },
        drive: 1, k: 0, asym: 0, bass: [80, 0], mid: [1000, 0, 1], treble: [8000, 0], out: 1
    },
    mc2105: {
        pill: "TR · MC2105",
        desc: "매킨토시 솔리드스테이트 — 블루 와트미터, 오토포머의 여유 (MC2105 오마주)",
        vol: { cx: 1000, cy: 442, r: 72 },
        drive: 1, k: 0, asym: 0, bass: [60, 0.5], mid: [1000, 0, 1], treble: [12000, 0.3], out: 1
    },
    el34: {
        pill: "EL34 · 8B",
        desc: "EL34 푸시풀 — 미드 포워드, 브리티시 웜 (Marantz 8B 오마주)",
        vol: { cx: 690, cy: 406, r: 34 },
        drive: 2.2, k: 1.7, asym: 0.12, bass: [120, 0.8], mid: [1800, 1.6, 0.9], treble: [8000, -0.9], out: 0.74
    },
    "300b": {
        pill: "300B · 91E",
        desc: "300B 싱글엔디드 — 달콤한 짝수 배음, 부드러운 고역 (WE 91E 오마주)",
        vol: { cx: 880, cy: 420, r: 112 },
        drive: 2.8, k: 1.15, asym: 0.38, bass: [100, 1.4], mid: [800, 0.8, 0.8], treble: [7000, -2.2], out: 0.7
    },
    kt88: {
        pill: "KT88 · 275",
        desc: "KT88 크롬 스테레오 파워 — 광대역, 깊고 단단한 저역 (McIntosh MC275 오마주)",
        vol: { cx: 600, cy: 422, r: 32 },
        drive: 1.9, k: 1.45, asym: 0.08, bass: [80, 1.8], mid: [1200, -0.5, 1], treble: [10000, 0.9], out: 0.78
    }
};

AMP_MODELS.tr.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="YAHAMA CA-100 솔리드스테이트 앰프">
    <defs>
        <linearGradient id="caWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset="0.5" stop-color="#66401f"/><stop offset="1" stop-color="#472a15"/></linearGradient>
        <linearGradient id="caFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f4"/><stop offset="0.12" stop-color="#dcdee4"/><stop offset="0.5" stop-color="#c6c8d0"/><stop offset="0.82" stop-color="#b2b4bc"/><stop offset="1" stop-color="#9a9ca6"/></linearGradient>
        <radialGradient id="caKnob" cx="0.38" cy="0.3" r="0.95"><stop offset="0" stop-color="#f8f8fa"/><stop offset="0.45" stop-color="#d2d4da"/><stop offset="0.8" stop-color="#a6a8b2"/><stop offset="1" stop-color="#7e808a"/></radialGradient>
        <radialGradient id="caMeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.6" stop-color="#f2e5bc"/><stop offset="1" stop-color="#dcCC9e"/></radialGradient>
        <radialGradient id="caShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <pattern id="caBrush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#caWood)"/>
    <rect x="0" y="3" width="2000" height="3" fill="#b8825a" opacity="0.5"/>
    <rect x="26" y="38" width="1948" height="496" rx="4" fill="url(#caFace)"/>
    <rect x="26" y="38" width="1948" height="496" rx="4" fill="url(#caBrush)"/>
    <rect x="26" y="38" width="1948" height="3" fill="#ffffff" opacity="0.5"/>
    <rect x="26" y="530" width="1948" height="4" fill="#000000" opacity="0.25"/>
    <circle cx="92" cy="96" r="16" fill="none" stroke="#3a3a42" stroke-width="2"/>
    <path d="M86 89 L86 100 M92 86 L92 100 M98 89 L98 100 M86 100 Q92 106 98 100" stroke="#3a3a42" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <text x="124" y="105" font-family="Arial" font-size="26" font-weight="700" letter-spacing="1.5" fill="#26262c">YAHAMA</text>
    <text x="296" y="103" font-family="Arial" font-size="12.5" letter-spacing="2.5" fill="#5a5a64">NATURAL SOUND STEREO AMPLIFIER CA-100</text>
    <g>
        <ellipse cx="268" cy="392" rx="180" ry="22" fill="url(#caShadow)"/>
        <rect x="100" y="140" width="336" height="240" rx="10" fill="#15151a"/>
        <rect x="103" y="143" width="330" height="234" rx="8" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <rect x="114" y="154" width="308" height="212" rx="5" fill="url(#caMeterFace)"/>
        <rect x="114" y="154" width="308" height="26" fill="url(#lzInset)" opacity="0.55"/>
        <path d="M 168 342 A 122 122 0 0 1 368 342" fill="none" stroke="#4a3a28" stroke-width="1.6"/>
        <path d="M 330 262 A 122 122 0 0 1 368 342" fill="none" stroke="#c0392b" stroke-width="4.5"/>
        <g stroke="#4a3a28" stroke-width="1.5">
            <line x1="172" y1="336" x2="182" y2="345"/><line x1="204" y1="300" x2="212" y2="311"/><line x1="268" y1="282" x2="268" y2="295"/><line x1="332" y1="300" x2="324" y2="311"/><line x1="364" y1="336" x2="354" y2="345"/>
        </g>
        <text x="268" y="232" font-family="Arial" font-size="14" font-weight="700" letter-spacing="3" fill="#5a4a34" text-anchor="middle">PEAK</text>
        <line id="ampVuL" data-cx="268" data-cy="352" x1="268" y1="352" x2="268" y2="212" stroke="#1a1610" stroke-width="3.5" transform="rotate(-42 268 352)"/>
        <circle cx="268" cy="352" r="9" fill="#1a1610"/>
        <polygon points="114,154 300,154 180,366 114,366" fill="url(#lzStreak)"/>
        <rect x="114" y="154" width="308" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="114" y="154" width="14" height="212" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="408" y="154" width="14" height="212" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="114" y="332.1" width="308" height="33.9" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="112" y="151" width="312" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="112" y="367" width="312" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="114" y="154" width="308" height="212" rx="5" fill="#0d0a06" opacity="0.55"/>
        <text x="268" y="408" font-family="Arial" font-size="12" letter-spacing="3" fill="#5a5a64" text-anchor="middle">LEFT</text>
    </g>
    <g>
        <ellipse cx="640" cy="392" rx="180" ry="22" fill="url(#caShadow)"/>
        <rect x="472" y="140" width="336" height="240" rx="10" fill="#15151a"/>
        <rect x="475" y="143" width="330" height="234" rx="8" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <rect x="486" y="154" width="308" height="212" rx="5" fill="url(#caMeterFace)"/>
        <rect x="486" y="154" width="308" height="26" fill="url(#lzInset)" opacity="0.55"/>
        <path d="M 540 342 A 122 122 0 0 1 740 342" fill="none" stroke="#4a3a28" stroke-width="1.6"/>
        <path d="M 702 262 A 122 122 0 0 1 740 342" fill="none" stroke="#c0392b" stroke-width="4.5"/>
        <g stroke="#4a3a28" stroke-width="1.5">
            <line x1="544" y1="336" x2="554" y2="345"/><line x1="576" y1="300" x2="584" y2="311"/><line x1="640" y1="282" x2="640" y2="295"/><line x1="704" y1="300" x2="696" y2="311"/><line x1="736" y1="336" x2="726" y2="345"/>
        </g>
        <text x="640" y="232" font-family="Arial" font-size="14" font-weight="700" letter-spacing="3" fill="#5a4a34" text-anchor="middle">PEAK</text>
        <line id="ampVuR" data-cx="640" data-cy="352" x1="640" y1="352" x2="640" y2="212" stroke="#1a1610" stroke-width="3.5" transform="rotate(-42 640 352)"/>
        <circle cx="640" cy="352" r="9" fill="#1a1610"/>
        <polygon points="486,154 672,154 552,366 486,366" fill="url(#lzStreak)"/>
        <rect x="486" y="154" width="308" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="486" y="154" width="14" height="212" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="780" y="154" width="14" height="212" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="486" y="332.1" width="308" height="33.9" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="484" y="151" width="312" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="484" y="367" width="312" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="486" y="154" width="308" height="212" rx="5" fill="#0d0a06" opacity="0.55"/>
        <text x="640" y="408" font-family="Arial" font-size="12" letter-spacing="3" fill="#5a5a64" text-anchor="middle">RIGHT</text>
    </g>
    <g font-family="Arial" font-size="12" letter-spacing="1.5" fill="#5a5a64" text-anchor="middle">
        <text x="920" y="160">MODE</text><text x="1090" y="160">PHONO</text><text x="1260" y="160">REC OUT</text><text x="1430" y="160">INPUT</text>
    </g>
    <g>
        <ellipse cx="920" cy="262" rx="26" ry="8" fill="url(#caShadow)"/>
        <rect x="906" y="176" width="28" height="86" rx="7" fill="#1c1c22"/><rect x="908" y="178" width="24" height="42" rx="5" fill="#2a2a32"/><rect x="911" y="182" width="18" height="34" rx="4" fill="url(#caKnob)"/>
        <ellipse cx="1090" cy="262" rx="26" ry="8" fill="url(#caShadow)"/>
        <rect x="1076" y="176" width="28" height="86" rx="7" fill="#1c1c22"/><rect x="1078" y="218" width="24" height="42" rx="5" fill="#2a2a32"/><rect x="1081" y="222" width="18" height="34" rx="4" fill="url(#caKnob)"/>
        <ellipse cx="1260" cy="262" rx="26" ry="8" fill="url(#caShadow)"/>
        <rect x="1246" y="176" width="28" height="86" rx="7" fill="#1c1c22"/><rect x="1248" y="196" width="24" height="42" rx="5" fill="#2a2a32"/><rect x="1251" y="200" width="18" height="34" rx="4" fill="url(#caKnob)"/>
        <ellipse cx="1430" cy="262" rx="26" ry="8" fill="url(#caShadow)"/>
        <rect x="1416" y="176" width="28" height="86" rx="7" fill="#1c1c22"/><rect x="1418" y="178" width="24" height="42" rx="5" fill="#2a2a32"/><rect x="1421" y="182" width="18" height="34" rx="4" fill="url(#caKnob)"/>
    </g>
    <g font-family="Arial" font-size="12" letter-spacing="1.5" fill="#5a5a64" text-anchor="middle">
        <text x="920" y="352">POWER</text><text x="1058" y="352">PHONES</text><text x="1196" y="352">BASS</text><text x="1356" y="352">TREBLE</text>
    </g>
    <circle id="ampPwrLed" cx="884" cy="404" r="6" fill="#3a2012"/>
    <ellipse cx="928" cy="458" rx="22" ry="7" fill="url(#caShadow)"/>
    <rect x="906" y="368" width="26" height="88" rx="7" fill="#1c1c22"/><rect x="908" y="370" width="22" height="43" rx="5" fill="#2a2a32"/><rect x="911" y="374" width="16" height="35" rx="4" fill="url(#caKnob)"/>
    <circle cx="1058" cy="412" r="18" fill="#101014"/><circle cx="1058" cy="412" r="15" fill="#1e1e26"/><circle cx="1058" cy="412" r="7" fill="#050507"/>
    <ellipse cx="1196" cy="452" rx="44" ry="12" fill="url(#caShadow)"/>
    <circle cx="1196" cy="412" r="40" fill="url(#caKnob)" stroke="#8a8c96" stroke-width="1.5"/>
    <circle cx="1196" cy="412" r="40" fill="none" stroke="#6e707a" stroke-width="5" stroke-dasharray="1.8 5.5" opacity="0.5"/>
    <rect x="1193" y="376" width="6" height="18" rx="3" fill="#3a3a42"/>
    <ellipse cx="1184" cy="398" rx="13" ry="10" fill="#ffffff" opacity="0.4"/>
    <ellipse cx="1356" cy="452" rx="44" ry="12" fill="url(#caShadow)"/>
    <circle cx="1356" cy="412" r="40" fill="url(#caKnob)" stroke="#8a8c96" stroke-width="1.5"/>
    <circle cx="1356" cy="412" r="40" fill="none" stroke="#6e707a" stroke-width="5" stroke-dasharray="1.8 5.5" opacity="0.5"/>
    <rect x="1353" y="376" width="6" height="18" rx="3" fill="#3a3a42"/>
    <ellipse cx="1344" cy="398" rx="13" ry="10" fill="#ffffff" opacity="0.4"/>
    <text x="1770" y="160" font-family="Arial" font-size="12" letter-spacing="2" fill="#5a5a64" text-anchor="middle">VOLUME &#183; BALANCE</text>
    <ellipse cx="1770" cy="475" rx="160" ry="30" fill="url(#caShadow)"/>
    <circle cx="1770" cy="330" r="150" fill="#7e808a"/>
    <circle cx="1770" cy="326" r="146" fill="url(#caKnob)" stroke="#9a9ca6" stroke-width="2"/>
    <circle cx="1770" cy="326" r="146" fill="none" stroke="#6e707a" stroke-width="12" stroke-dasharray="2.5 8" opacity="0.45"/>
    <circle cx="1770" cy="326" r="104" fill="none" stroke="#b6b8c0" stroke-width="1.2" opacity="0.7"/>
    <circle id="ampVolMark" cx="1770" cy="206" r="8" fill="#3a3a42"/>
    <ellipse cx="1712" cy="262" rx="54" ry="40" fill="#ffffff" opacity="0.35" pointer-events="none"/>
</svg>`;

        AMP_MODELS.mc2105.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="McIntoch MC 2105 솔리드스테이트 앰프">
    <defs>
        <linearGradient id="m5Glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141418"/><stop offset="0.5" stop-color="#0c0c10"/><stop offset="1" stop-color="#060608"/></linearGradient>
        <linearGradient id="m5Rail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2e4ea"/><stop offset="0.5" stop-color="#9aa0ac"/><stop offset="1" stop-color="#5c626e"/></linearGradient>
        <radialGradient id="m5Face" cx="0.5" cy="0.4" r="0.85"><stop offset="0" stop-color="#a2e9ff"/><stop offset="0.45" stop-color="#55c8f8"/><stop offset="0.8" stop-color="#1e9ae8"/><stop offset="1" stop-color="#0f78cc"/></radialGradient>
        <radialGradient id="m5Knob" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#5a606c"/><stop offset="0.35" stop-color="#2c3038"/><stop offset="1" stop-color="#0e1014"/></radialGradient>
        <radialGradient id="m5Shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#m5Glass)"/>
    <rect x="0" y="2" width="2000" height="3" fill="#ffffff" opacity="0.28"/>
    <rect x="0" y="0" width="26" height="560" rx="8" fill="url(#m5Rail)"/>
    <rect x="1974" y="0" width="26" height="560" rx="8" fill="url(#m5Rail)"/>
    <rect x="52" y="56" width="26" height="448" rx="13" fill="url(#m5Rail)"/>
    <rect x="1922" y="56" width="26" height="448" rx="13" fill="url(#m5Rail)"/>
    <!-- 블루 와트미터 (L) -->
    <g>
        <rect x="250" y="54" width="560" height="256" rx="10" fill="#101014"/>
        <rect x="250" y="54" width="560" height="256" rx="10" fill="none" stroke="#3c4048" stroke-width="2"/>
        <rect x="262" y="66" width="536" height="232" rx="6" fill="#071019"/>
        <rect class="ampLamp" x="262" y="66" width="536" height="232" rx="6" fill="url(#m5Face)" opacity="0.02"/>
        <path d="M 340 262 A 235 235 0 0 1 720 262" fill="none" stroke="#0b365e" stroke-width="2.5"/>
        <g stroke="#0b365e" stroke-width="2">
            <line x1="348" y1="256" x2="360" y2="266"/><line x1="398" y1="212" x2="408" y2="224"/><line x1="470" y1="184" x2="476" y2="198"/><line x1="530" y1="176" x2="530" y2="190"/><line x1="590" y1="184" x2="584" y2="198"/><line x1="662" y1="212" x2="652" y2="224"/><line x1="712" y1="256" x2="700" y2="266"/>
        </g>
        <text x="530" y="130" font-family="Arial" font-size="15" font-weight="700" letter-spacing="4" fill="#0b365e" text-anchor="middle">WATTS</text>
        <g font-family="Arial" font-size="12" font-weight="600" fill="#0b365e">
            <text x="354" y="244">.2</text><text x="406" y="204">2.0</text><text x="522" y="170">20</text><text x="642" y="204">100</text><text x="686" y="244">200</text>
        </g>
        <g font-family="Arial" font-size="10" font-weight="600" fill="#0b365e" opacity="0.85">
            <text x="380" y="272">-50</text><text x="434" y="234">-30</text><text x="526" y="214">-10</text><text x="622" y="234">0</text>
        </g>
        <text x="530" y="248" font-family="Arial" font-size="9" letter-spacing="2" fill="#0b365e" opacity="0.8" text-anchor="middle">DECIBELS</text>
        <text x="530" y="290" font-family="Arial" font-size="14" letter-spacing="4" fill="#0a3054" text-anchor="middle">POWER OUTPUT</text>
        <line id="ampVuL" data-cx="530" data-cy="286" x1="530" y1="286" x2="530" y2="120" stroke="#0d1119" stroke-width="3.5" transform="rotate(-42 530 286)"/>
        <polygon points="262,66 560,66 380,298 262,298" fill="url(#lzStreak)" opacity="0.7"/>
        <rect x="262" y="66" width="536" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="262" y="66" width="14" height="232" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="784" y="66" width="14" height="232" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="262" y="260.9" width="536" height="37.1" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="260" y="63" width="540" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="260" y="299" width="540" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="262" y="66" width="536" height="232" rx="6" fill="#05070a" opacity="0.55"/>
    </g>
    <!-- 블루 와트미터 (R) -->
    <g>
        <rect x="1190" y="54" width="560" height="256" rx="10" fill="#101014"/>
        <rect x="1190" y="54" width="560" height="256" rx="10" fill="none" stroke="#3c4048" stroke-width="2"/>
        <rect x="1202" y="66" width="536" height="232" rx="6" fill="#071019"/>
        <rect class="ampLamp" x="1202" y="66" width="536" height="232" rx="6" fill="url(#m5Face)" opacity="0.02"/>
        <path d="M 1280 262 A 235 235 0 0 1 1660 262" fill="none" stroke="#0b365e" stroke-width="2.5"/>
        <g stroke="#0b365e" stroke-width="2">
            <line x1="1288" y1="256" x2="1300" y2="266"/><line x1="1338" y1="212" x2="1348" y2="224"/><line x1="1410" y1="184" x2="1416" y2="198"/><line x1="1470" y1="176" x2="1470" y2="190"/><line x1="1530" y1="184" x2="1524" y2="198"/><line x1="1602" y1="212" x2="1592" y2="224"/><line x1="1652" y1="256" x2="1640" y2="266"/>
        </g>
        <text x="1470" y="130" font-family="Arial" font-size="15" font-weight="700" letter-spacing="4" fill="#0b365e" text-anchor="middle">WATTS</text>
        <g font-family="Arial" font-size="12" font-weight="600" fill="#0b365e">
            <text x="1294" y="244">.2</text><text x="1346" y="204">2.0</text><text x="1462" y="170">20</text><text x="1582" y="204">100</text><text x="1626" y="244">200</text>
        </g>
        <g font-family="Arial" font-size="10" font-weight="600" fill="#0b365e" opacity="0.85">
            <text x="1320" y="272">-50</text><text x="1374" y="234">-30</text><text x="1466" y="214">-10</text><text x="1562" y="234">0</text>
        </g>
        <text x="1470" y="248" font-family="Arial" font-size="9" letter-spacing="2" fill="#0b365e" opacity="0.8" text-anchor="middle">DECIBELS</text>
        <text x="1470" y="290" font-family="Arial" font-size="14" letter-spacing="4" fill="#0a3054" text-anchor="middle">POWER OUTPUT</text>
        <line id="ampVuR" data-cx="1470" data-cy="286" x1="1470" y1="286" x2="1470" y2="120" stroke="#0d1119" stroke-width="3.5" transform="rotate(-42 1470 286)"/>
        <polygon points="1202,66 1500,66 1320,298 1202,298" fill="url(#lzStreak)" opacity="0.7"/>
        <rect x="1202" y="66" width="536" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="1202" y="66" width="14" height="232" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="1724" y="66" width="14" height="232" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="1202" y="260.9" width="536" height="37.1" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="1200" y="63" width="540" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="1200" y="299" width="540" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="1202" y="66" width="536" height="232" rx="6" fill="#05070a" opacity="0.55"/>
    </g>
    <!-- 중앙 로고 — 그린 백라이트 -->
    <text class="ampLegend" x="1000" y="150" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="46" font-weight="700" fill="#3fe373" text-anchor="middle">McIntoch</text>
    <text class="ampLegend" x="1000" y="192" font-family="Arial" font-size="19" font-weight="600" letter-spacing="7" fill="#3fe373" text-anchor="middle">MC 2105</text>
    <text class="ampLegend" x="1000" y="222" font-family="Arial" font-size="12" letter-spacing="3" fill="#2fae58" text-anchor="middle">SOLID STATE STEREO POWER AMPLIFIER</text>
    <!-- 하단 컨트롤 행 -->
    <g class="ampLegend" font-family="Arial" font-size="12" letter-spacing="1.5" fill="#3fe373" text-anchor="middle">
        <text x="290" y="382">POWER</text><text x="560" y="382">L GAIN</text><text x="1000" y="382">GAIN</text><text x="1440" y="382">R GAIN</text><text x="1710" y="382">SPEAKERS</text>
    </g>
    <circle cx="290" cy="436" r="15" fill="#8a6a2a"/>
    <circle id="ampPwrLed" cx="290" cy="436" r="9" fill="#3a2012"/>
    <ellipse cx="560" cy="486" rx="36" ry="10" fill="url(#m5Shadow)"/>
    <circle cx="560" cy="440" r="32" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2"/>
    <path d="M 542 420 A 26 26 0 0 1 578 420" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>
    <rect x="557" y="412" width="6" height="16" rx="3" fill="#dce2ea"/>
    <ellipse cx="1000" cy="500" rx="66" ry="14" fill="url(#m5Shadow)"/>
    <circle cx="1000" cy="442" r="58" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2.5"/>
    <path d="M 966 410 A 47 47 0 0 1 1034 410" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.35"/>
    <circle cx="1000" cy="442" r="58" fill="none" stroke="#3a3e46" stroke-width="6" stroke-dasharray="2 6" opacity="0.6"/>
    <circle id="ampVolMark" cx="1000" cy="392" r="6" fill="#dce2ea"/>
    <ellipse cx="1440" cy="486" rx="36" ry="10" fill="url(#m5Shadow)"/>
    <circle cx="1440" cy="440" r="32" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2"/>
    <path d="M 1422 420 A 26 26 0 0 1 1458 420" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>
    <rect x="1437" y="412" width="6" height="16" rx="3" fill="#dce2ea"/>
    <ellipse cx="1712" cy="486" rx="24" ry="8" fill="url(#m5Shadow)"/>
    <rect x="1696" y="400" width="28" height="80" rx="7" fill="#1c1c22"/><rect x="1699" y="404" width="22" height="34" rx="4" fill="#b8bcc6"/>
    <text class="ampLegend" x="1000" y="536" font-family="Arial" font-size="11" letter-spacing="2" fill="#2fae58" text-anchor="middle">105 WATTS PER CHANNEL</text>
</svg>`;

AMP_MODELS.el34.svg = `<svg class="amp-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Maranz 8B EL34 진공관 앰프">
    <defs>
        <linearGradient id="m8Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6ddc2"/><stop offset="0.5" stop-color="#cfc6a9"/><stop offset="1" stop-color="#aba288"/></linearGradient>
        <linearGradient id="m8Win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1812"/><stop offset="1" stop-color="#0b0906"/></linearGradient>
        <linearGradient id="m8Glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#211d16" stop-opacity="0.9"/><stop offset="0.3" stop-color="#5c5644" stop-opacity="0.45"/><stop offset="0.55" stop-color="#8a8168" stop-opacity="0.25"/><stop offset="1" stop-color="#171310" stop-opacity="0.92"/></linearGradient>
        <linearGradient id="m8Can" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#08080a"/><stop offset="0.35" stop-color="#22222a"/><stop offset="0.5" stop-color="#32323c"/><stop offset="0.7" stop-color="#1a1a22"/><stop offset="1" stop-color="#050507"/></linearGradient>
        <radialGradient id="m8MeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.65" stop-color="#f0e3ba"/><stop offset="1" stop-color="#d8ca9c"/></radialGradient>
        <radialGradient id="m8Shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="m8Glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
        <pattern id="m8Brush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
    </defs>
    <rect width="2000" height="540" rx="8" fill="url(#m8Face)"/>
    <rect width="2000" height="540" rx="8" fill="url(#m8Brush)"/>
    <rect x="0" y="2" width="2000" height="3" fill="#fff8e8" opacity="0.55"/>
    <rect x="40" y="40" width="1920" height="234" rx="8" fill="url(#m8Win)" stroke="#0a0906" stroke-width="2.5"/>
    <ellipse class="ampGlow" cx="640" cy="180" rx="240" ry="90" fill="url(#lzLamp)" opacity="0.1" filter="url(#m8Glow)"/>
    <ellipse class="ampGlow" cx="1370" cy="180" rx="240" ry="90" fill="url(#lzLamp)" opacity="0.1" filter="url(#m8Glow)"/>
    <g>
        <rect x="86" y="66" width="252" height="192" rx="10" fill="url(#m8Can)"/>
        <rect x="100" y="76" width="8" height="172" rx="4" fill="#3c3c46" opacity="0.6"/>
        <rect x="86" y="66" width="252" height="8" rx="4" fill="#2e2e38"/>
        <rect x="1662" y="66" width="252" height="192" rx="10" fill="url(#m8Can)"/>
        <rect x="1676" y="76" width="8" height="172" rx="4" fill="#3c3c46" opacity="0.6"/>
        <rect x="1662" y="66" width="252" height="8" rx="4" fill="#2e2e38"/>
    </g>
    ${tubeSvg(560, 254, 74, 176, "power")}
    ${tubeSvg(700, 254, 74, 176, "power")}
    ${tubeSvg(1300, 254, 74, 176, "power")}
    ${tubeSvg(1440, 254, 74, 176, "power")}
    ${tubeSvg(906, 258, 46, 118, "power")}
    ${tubeSvg(986, 258, 46, 118, "power")}
    ${tubeSvg(1066, 258, 46, 118, "power")}
    ${tubeSvg(1146, 258, 46, 118, "power")}
    <rect class="tubeDark" x="42" y="42" width="1916" height="230" rx="7" fill="#050403" opacity="0.72"/>
    <rect x="40" y="40" width="1920" height="20" fill="url(#lzInset)" opacity="0.85"/>
    <polygon points="40,40 760,40 320,274 40,274" fill="url(#lzStreak)"/>
    <rect x="40" y="280" width="1920" height="3" fill="#c8a860" opacity="0.5"/>
    <g>
        <ellipse cx="252" cy="486" rx="100" ry="16" fill="url(#m8Shadow)"/>
        <circle cx="250" cy="408" r="82" fill="#15151a"/>
        <circle cx="250" cy="406" r="78" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <circle cx="250" cy="406" r="68" fill="url(#m8MeterFace)"/>
        <path d="M 206 434 A 62 62 0 0 1 294 434" fill="none" stroke="#4a3a28" stroke-width="1.4" transform="rotate(180 250 420)"/>
        <g stroke="#4a3a28" stroke-width="1.3">
            <line x1="212" y1="430" x2="220" y2="437"/><line x1="230" y1="410" x2="236" y2="419"/><line x1="250" y1="402" x2="250" y2="413"/><line x1="270" y1="410" x2="264" y2="419"/><line x1="288" y1="430" x2="280" y2="437"/>
        </g>
        <line id="ampVuL" data-cx="250" data-cy="446" x1="250" y1="446" x2="250" y2="360" stroke="#1a1610" stroke-width="2.8" transform="rotate(-42 250 446)"/>
        <circle cx="250" cy="446" r="6" fill="#1a1610"/>
        <text x="250" y="470" font-family="Arial" font-size="10" letter-spacing="2" fill="#6b6252" text-anchor="middle">BIAS</text>
        <polygon points="188,344 268,344 214,468 188,468" fill="url(#lzStreak)"/>
        <circle cx="250" cy="406" r="68" fill="url(#lzInCirc)"/>
        <circle cx="250" cy="406" r="69.5" fill="none" stroke="#04050a" stroke-width="3" opacity="0.45"/>
        <circle class="meterDark" cx="250" cy="406" r="68" fill="#0d0a06" opacity="0.55"/>
    </g>
    <circle cx="524" cy="398" r="13" fill="#8a7a5a"/>
    <circle id="ampPwrLed" cx="524" cy="398" r="8" fill="#3a2012"/>
    <ellipse cx="586" cy="446" rx="20" ry="7" fill="url(#m8Shadow)"/>
    <rect x="570" y="368" width="30" height="74" rx="7" fill="#26241f"/><rect x="574" y="374" width="22" height="28" rx="4" fill="#b0a488"/>
    <text x="560" y="474" font-family="Arial" font-size="11" letter-spacing="2" fill="#6b6252" text-anchor="middle">POWER</text>
    <ellipse cx="690" cy="438" rx="30" ry="9" fill="url(#m8Shadow)"/>
    <circle cx="690" cy="408" r="27" fill="#8a8068"/>
    <circle cx="690" cy="406" r="25" fill="url(#m8MeterFace)" stroke="#8a8068" stroke-width="1.4"/>
    <rect id="ampVolMark" x="688" y="384" width="4" height="12" rx="2" fill="#3a3226"/>
    <text x="690" y="474" font-family="Arial" font-size="11" letter-spacing="2" fill="#6b6252" text-anchor="middle">LEVEL</text>
    <rect x="866" y="368" width="268" height="76" rx="8" fill="#14120e"/>
    <rect x="869" y="371" width="262" height="70" rx="6" fill="none" stroke="#3a362c" stroke-width="1.4"/>
    <text x="1000" y="418" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" font-weight="700" fill="#f0ecd8" text-anchor="middle">maranz</text>
    <text x="1660" y="412" font-family="Arial" font-size="14" letter-spacing="2.5" fill="#5f584a" text-anchor="end">MODEL 8B &#183; STEREO POWER AMPLIFIER</text>
    <g fill="#26241f">
        <circle cx="1700" cy="470" r="9"/><circle cx="1740" cy="470" r="9"/><circle cx="1780" cy="470" r="9"/><circle cx="1820" cy="470" r="9"/>
    </g>
</svg>`;

AMP_MODELS["300b"].svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Western Eletric 91E 300B 앰프">
    <defs>
        <linearGradient id="weFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2dbc9"/><stop offset="0.5" stop-color="#cbc4ae"/><stop offset="1" stop-color="#a49d87"/></linearGradient>
        <linearGradient id="weWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191510"/><stop offset="1" stop-color="#0a0805"/></linearGradient>
        <linearGradient id="weGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2016" stop-opacity="0.85"/><stop offset="0.32" stop-color="#6e5c42" stop-opacity="0.4"/><stop offset="0.55" stop-color="#96805c" stop-opacity="0.22"/><stop offset="1" stop-color="#1d150c" stop-opacity="0.92"/></linearGradient>
        <radialGradient id="weKnob" cx="0.4" cy="0.32" r="0.95"><stop offset="0" stop-color="#f6f2e6"/><stop offset="0.5" stop-color="#cfc7b0"/><stop offset="0.85" stop-color="#a39b84"/><stop offset="1" stop-color="#7e765f"/></radialGradient>
        <radialGradient id="weShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="weGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>
        <pattern id="weMesh" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.8" fill="#8a8270"/></pattern>
        <pattern id="weBrush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#weFace)"/>
    <rect width="2000" height="560" rx="8" fill="url(#weBrush)"/>
    <rect x="0" y="2" width="2000" height="3" fill="#fff8e8" opacity="0.55"/>
    <rect x="40" y="40" width="1920" height="222" rx="8" fill="url(#weWin)" stroke="#0a0906" stroke-width="2.5"/>
    <ellipse class="ampGlow" cx="1400" cy="165" rx="280" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#weGlow)"/>
    <g>
        <circle cx="250" cy="150" r="74" fill="#0d0c0a" stroke="#7e765f" stroke-width="3"/>
        <circle cx="250" cy="150" r="64" fill="url(#weMesh)"/>
        <circle cx="250" cy="150" r="64" fill="url(#lzVign)"/>
        <circle cx="460" cy="150" r="74" fill="#0d0c0a" stroke="#7e765f" stroke-width="3"/>
        <circle cx="460" cy="150" r="64" fill="url(#weMesh)"/>
        <circle cx="460" cy="150" r="64" fill="url(#lzVign)"/>
    </g>
    <rect x="700" y="58" width="240" height="188" rx="5" fill="#cfc8b4"/>
    <rect x="700" y="58" width="240" height="188" rx="5" fill="url(#weBrush)"/>
    <rect x="700" y="58" width="240" height="10" fill="#ffffff" opacity="0.25"/>
    <text x="820" y="140" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="25" font-weight="700" fill="#4a4436" text-anchor="middle">Western Eletric</text>
    <text x="820" y="188" font-family="Arial" font-size="30" letter-spacing="7" fill="#847c66" text-anchor="middle">91E</text>
    ${tubeSvg(1300, 240, 96, 195, "balloon")}
    ${tubeSvg(1500, 240, 96, 195, "balloon")}
    ${tubeSvg(1664, 242, 46, 114, "power")}
    <rect class="tubeDark" x="42" y="42" width="1916" height="218" rx="7" fill="#050403" opacity="0.72"/>
    <rect x="40" y="40" width="1920" height="18" fill="url(#lzInset)" opacity="0.85"/>
    <polygon points="40,40 720,40 300,262 40,262" fill="url(#lzStreak)"/>
    <rect x="60" y="268" width="1880" height="22" rx="11" fill="url(#weKnob)"/>
    <rect x="60" y="270" width="1880" height="5" rx="2.5" fill="#ffffff" opacity="0.5"/>
    <rect x="120" y="294" width="1760" height="12" rx="6" fill="url(#weKnob)" opacity="0.75"/>
    <g font-family="Arial" font-size="10.5" letter-spacing="1" fill="#6b6252">
        <text x="164" y="352">PHONO</text><text x="164" y="396">CD</text><text x="164" y="440">TUNER</text><text x="164" y="484">AUX</text><text x="164" y="528">BT</text>
    </g>
    <g>
        <circle cx="130" cy="348" r="12" fill="url(#weKnob)" stroke="#847c66" stroke-width="1.4"/><circle cx="126" cy="344" r="4" fill="#ffffff" opacity="0.5"/>
        <circle cx="130" cy="392" r="12" fill="url(#weKnob)" stroke="#847c66" stroke-width="1.4"/><circle cx="126" cy="388" r="4" fill="#ffffff" opacity="0.5"/>
        <circle cx="130" cy="436" r="12" fill="url(#weKnob)" stroke="#847c66" stroke-width="1.4"/><circle cx="126" cy="432" r="4" fill="#ffffff" opacity="0.5"/>
        <circle cx="130" cy="480" r="12" fill="url(#weKnob)" stroke="#847c66" stroke-width="1.4"/><circle cx="126" cy="476" r="4" fill="#ffffff" opacity="0.5"/>
        <circle cx="130" cy="524" r="12" fill="url(#weKnob)" stroke="#847c66" stroke-width="1.4"/><circle cx="126" cy="520" r="4" fill="#ffffff" opacity="0.5"/>
    </g>
    <ellipse cx="520" cy="530" rx="110" ry="14" fill="url(#weShadow)"/>
    <rect x="420" y="322" width="200" height="200" rx="8" fill="#15130f"/>
    <rect x="428" y="330" width="184" height="184" rx="4" fill="#f4f1e8"/>
    <rect x="428" y="330" width="184" height="22" fill="url(#lzInset)" opacity="0.4"/>
    <rect x="458" y="346" width="24" height="150" rx="2" fill="#0d0b08"/>
    <rect x="536" y="346" width="24" height="150" rx="2" fill="#0d0b08"/>
    <line id="ampVuL" data-cx="470" data-cy="492" x1="470" y1="492" x2="470" y2="356" stroke="#e02a1a" stroke-width="5" transform="rotate(-42 470 492)"/>
    <line id="ampVuR" data-cx="548" data-cy="492" x1="548" y1="492" x2="548" y2="356" stroke="#e02a1a" stroke-width="5" transform="rotate(-42 548 492)"/>
    <rect x="428" y="330" width="184" height="34" fill="url(#lzInset)" opacity="0.62"/>
    <rect x="428" y="330" width="9.2" height="184" fill="url(#lzInL)" opacity="0.5"/>
    <rect x="602.8" y="330" width="9.2" height="184" fill="url(#lzInR)" opacity="0.5"/>
    <rect x="428" y="484.6" width="184" height="29.4" fill="url(#lzInBot)" opacity="0.55"/>
    <rect x="426" y="327" width="188" height="3" fill="#04050a" opacity="0.55"/>
    <rect x="426" y="515" width="188" height="2.5" fill="#ffffff" opacity="0.09"/>
    <rect class="meterDark" x="428" y="330" width="184" height="184" rx="3" fill="#0d0a06" opacity="0.55"/>
    <text x="520" y="510" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="12" fill="#8a2020" text-anchor="middle">Western Eletric</text>
    <ellipse cx="880" cy="530" rx="120" ry="20" fill="url(#weShadow)"/>
    <circle cx="880" cy="424" r="108" fill="#7e765f"/>
    <circle cx="880" cy="420" r="104" fill="url(#weKnob)" stroke="#a49d87" stroke-width="2"/>
    <circle cx="880" cy="420" r="104" fill="none" stroke="#847c66" stroke-width="8" stroke-dasharray="2 6" opacity="0.4"/>
    <circle cx="880" cy="420" r="76" fill="none" stroke="#b8b09a" stroke-width="1.4" opacity="0.7"/>
    <circle cx="880" cy="420" r="52" fill="url(#weKnob)"/>
    <circle id="ampVolMark" cx="880" cy="330" r="7" fill="#55504a"/>
    <ellipse cx="838" cy="376" rx="36" ry="28" fill="#ffffff" opacity="0.35" pointer-events="none"/>
    <text x="1120" y="366" font-family="Arial" font-size="12" letter-spacing="2" fill="#6b6252">91E &#183; 300B SINGLE-ENDED TRIODE</text>
    <circle cx="1120" cy="420" r="14" fill="#8a7a5a"/>
    <circle id="ampPwrLed" cx="1120" cy="420" r="8" fill="#3a2012"/>
    <text x="1146" y="425" font-family="Arial" font-size="11" letter-spacing="1" fill="#6b6252">I/O</text>
    <circle cx="1230" cy="420" r="15" fill="#15130f"/><circle cx="1230" cy="420" r="6" fill="#050505"/>
    <text x="1256" y="425" font-family="Arial" font-size="11" letter-spacing="1" fill="#6b6252">PHONES</text>
    <g>
        <rect x="1560" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1560" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1590" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1590" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1620" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1620" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1650" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1650" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1680" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1680" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1710" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1710" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1740" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1740" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1770" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1770" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1800" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1800" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1830" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1830" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1860" y="322" width="17" height="216" rx="5" fill="#8a8270"/><rect x="1860" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
        <rect x="1890" y="322" width="17" height="216" rx="5" fill="#a49d87"/><rect x="1890" y="322" width="17" height="6" fill="#fff" opacity="0.3"/>
    </g>
</svg>`;

AMP_MODELS.kt88.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntoch 275 KT88 진공관 파워앰프">
    <defs>
        <linearGradient id="mcChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f7fa"/><stop offset="0.16" stop-color="#d2d6de"/><stop offset="0.34" stop-color="#9aa0ac"/><stop offset="0.5" stop-color="#6e7480"/><stop offset="0.6" stop-color="#9aa0ac"/><stop offset="0.82" stop-color="#d8dbe2"/><stop offset="1" stop-color="#848a96"/></linearGradient>
        <linearGradient id="mcWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101014"/><stop offset="1" stop-color="#060608"/></linearGradient>
        <linearGradient id="mcCan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050507"/><stop offset="0.32" stop-color="#24242c"/><stop offset="0.5" stop-color="#383842"/><stop offset="0.7" stop-color="#1a1a22"/><stop offset="1" stop-color="#030304"/></linearGradient>
        <linearGradient id="mcGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d288"/><stop offset="0.45" stop-color="#cfa04a"/><stop offset="1" stop-color="#8e6a26"/></linearGradient>
        <linearGradient id="mcGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c1c22" stop-opacity="0.88"/><stop offset="0.32" stop-color="#565662" stop-opacity="0.4"/><stop offset="0.55" stop-color="#8a8a98" stop-opacity="0.22"/><stop offset="1" stop-color="#12121a" stop-opacity="0.92"/></linearGradient>
        <radialGradient id="mcShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="mcGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#mcChrome)"/>
    <rect x="0" y="2" width="2000" height="4" fill="#ffffff" opacity="0.7"/>
    <rect x="40" y="40" width="1920" height="252" rx="8" fill="url(#mcWin)" stroke="#2a2a32" stroke-width="2.5"/>
    <ellipse class="ampGlow" cx="590" cy="195" rx="230" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#mcGlow)"/>
    <ellipse class="ampGlow" cx="1210" cy="195" rx="230" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#mcGlow)"/>
    <g>
        <rect x="130" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="130" y="62" width="270" height="8" rx="4" fill="#32323c"/><rect x="148" y="74" width="7" height="198" rx="3.5" fill="#4a4a56" opacity="0.6"/>
        <rect x="820" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="820" y="62" width="270" height="8" rx="4" fill="#32323c"/><rect x="838" y="74" width="7" height="198" rx="3.5" fill="#4a4a56" opacity="0.6"/>
        <rect x="1500" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="1500" y="62" width="270" height="8" rx="4" fill="#32323c"/><rect x="1518" y="74" width="7" height="198" rx="3.5" fill="#4a4a56" opacity="0.6"/>
    </g>
    ${tubeSvg(500, 278, 78, 184, "power")}
    ${tubeSvg(650, 278, 78, 184, "power")}
    ${tubeSvg(1190, 278, 78, 184, "power")}
    ${tubeSvg(1340, 278, 78, 184, "power")}
    ${tubeSvg(1828, 278, 44, 102, "small")}
    ${tubeSvg(1898, 278, 44, 102, "small")}
    <rect class="tubeDark" x="42" y="42" width="1916" height="248" rx="7" fill="#050403" opacity="0.72"/>
    <rect x="40" y="40" width="1920" height="20" fill="url(#lzInset)" opacity="0.9"/>
    <polygon points="40,40 780,40 330,292 40,292" fill="url(#lzStreak)"/>
    <g>
        <rect x="1478" y="352" width="384" height="150" rx="12" fill="#000000" opacity="0.3" transform="translate(6,8)"/>
        <rect x="1478" y="352" width="384" height="150" rx="12" fill="url(#mcGold)" stroke="#6e5420" stroke-width="2.5"/>
        <rect x="1484" y="358" width="372" height="138" rx="9" fill="none" stroke="#f6e2a8" stroke-width="1.5" opacity="0.8"/>
        <text x="1670" y="418" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" font-weight="700" fill="#1a1206" text-anchor="middle">McIntoch</text>
        <text x="1670" y="472" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" letter-spacing="12" fill="#1a1206" text-anchor="middle">275</text>
    </g>
    <g font-family="Arial" font-size="12" letter-spacing="1.5" fill="#3c424e" text-anchor="middle">
        <text x="170" y="370">POWER</text><text x="330" y="370">MODE</text><text x="470" y="370">INPUT</text>
    </g>
    <circle cx="170" cy="424" r="15" fill="#8a6a2a"/>
    <circle id="ampPwrLed" cx="170" cy="424" r="9" fill="#3a2012"/>
    <ellipse cx="332" cy="472" rx="20" ry="7" fill="url(#mcShadow)"/>
    <rect x="318" y="386" width="26" height="80" rx="7" fill="#22222a"/><rect x="321" y="390" width="20" height="34" rx="4" fill="#b8bcc6"/>
    <ellipse cx="472" cy="472" rx="20" ry="7" fill="url(#mcShadow)"/>
    <rect x="458" y="386" width="26" height="80" rx="7" fill="#22222a"/><rect x="461" y="428" width="20" height="34" rx="4" fill="#b8bcc6"/>
    <text x="600" y="370" font-family="Arial" font-size="12" letter-spacing="1.5" fill="#3c424e" text-anchor="middle">LEVEL</text>
    <ellipse cx="600" cy="458" rx="26" ry="8" fill="url(#mcShadow)"/>
    <circle cx="600" cy="424" r="27" fill="#16161c"/>
    <circle cx="600" cy="422" r="23" fill="url(#mcChromeTop)" stroke="#6e7480" stroke-width="1.4"/>
    <rect id="ampVolMark" x="598" y="402" width="4" height="11" rx="2" fill="#22222a"/>
    <text x="800" y="436" font-family="Arial" font-size="13" letter-spacing="3" fill="#4c525e" text-anchor="middle">MC 275 &#183; 75 WATTS PER CHANNEL &#183; KT88</text>
    <g fill="#22222a">
        <circle cx="640" cy="480" r="10"/><circle cx="680" cy="480" r="10"/><circle cx="720" cy="480" r="10"/><circle cx="760" cy="480" r="10"/><circle cx="800" cy="480" r="10"/><circle cx="840" cy="480" r="10"/><circle cx="880" cy="480" r="10"/><circle cx="920" cy="480" r="10"/>
    </g>
</svg>`;
const AMP_ORDER = ["tr", "mc2105", "el34", "300b", "kt88"];
