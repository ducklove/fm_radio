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
    '<linearGradient id="lzWarmFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1cf"/><stop offset="0.16" stop-color="#f8e4b4"/><stop offset="0.55" stop-color="#efd9a2"/><stop offset="1" stop-color="#dcbe7e"/></linearGradient>' +
    '<radialGradient id="lzLampPool" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#fff8e2" stop-opacity="0.8"/><stop offset="0.4" stop-color="#ffedbb" stop-opacity="0.3"/><stop offset="1" stop-color="#ffedbb" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="lzFilHot" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8e6" stop-opacity="0.95"/><stop offset="0.28" stop-color="#ffd98e" stop-opacity="0.85"/><stop offset="0.6" stop-color="#ff9a3a" stop-opacity="0.4"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="lzDeckPool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb45a" stop-opacity="0.5"/><stop offset="0.6" stop-color="#ff9a3a" stop-opacity="0.2"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="lzControlGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.16" stop-color="#ffffff" stop-opacity="0.18"/><stop offset="0.48" stop-color="#ffffff" stop-opacity="0.025"/><stop offset="0.7" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/></linearGradient>' +
    '<radialGradient id="lzControlGlossRound" cx="0.32" cy="0.22" r="0.86"><stop offset="0" stop-color="#ffffff" stop-opacity="0.46"/><stop offset="0.22" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.38"/></radialGradient>' +
    '<radialGradient id="lzKnobGloss" cx="0.3" cy="0.23" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="0.2" stop-color="#ffffff" stop-opacity="0.09"/><stop offset="0.58" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.4"/></radialGradient>' +
    '<linearGradient id="lzSwitchFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="0.2" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.68" stop-color="#000000" stop-opacity="0.02"/><stop offset="1" stop-color="#000000" stop-opacity="0.38"/></linearGradient>' +
    '<linearGradient id="lzGlassSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.18" stop-color="#ffffff" stop-opacity="0.035"/><stop offset="0.34" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.025"/><stop offset="0.72" stop-color="#ffffff" stop-opacity="0.07"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="lzEdgeLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="0.12" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="0.84" stop-color="#000000" stop-opacity="0.08"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></linearGradient>' +
    '<linearGradient id="lzChromeLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#535862"/><stop offset="0.18" stop-color="#f4f6fa"/><stop offset="0.38" stop-color="#868c98"/><stop offset="0.62" stop-color="#f9fafc"/><stop offset="0.82" stop-color="#707680"/><stop offset="1" stop-color="#2d3138"/></linearGradient>' +
    '<pattern id="lzHairline" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H9 M0 3.5H9 M0 6.5H9" stroke="#ffffff" stroke-opacity="0.022" stroke-width="1"/><path d="M0 2H9 M0 5H9" stroke="#000000" stroke-opacity="0.025" stroke-width="1"/></pattern>' +
    '<pattern id="lzKnurl" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><path d="M1 0V8 M5 0V8" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/><path d="M3 0V8 M7 0V8" stroke="#000000" stroke-opacity="0.28" stroke-width="1"/></pattern>' +
    '<filter id="lzContact" x="-35%" y="-35%" width="180%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/><feOffset in="b" dx="2" dy="6" result="o"/><feFlood flood-color="#000000" flood-opacity="0.58" result="c"/><feComposite in="c" in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="lzButtonDepth" x="-30%" y="-35%" width="160%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="lzBtnBlur"/><feOffset in="lzBtnBlur" dx="1.5" dy="6" result="lzBtnOffset"/><feFlood flood-color="#000000" flood-opacity="0.72" result="lzBtnColor"/><feComposite in="lzBtnColor" in2="lzBtnOffset" operator="in" result="lzBtnShadow"/><feMerge><feMergeNode in="lzBtnShadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="lzButtonPressed" x="-22%" y="-25%" width="144%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="lzPressBlur"/><feOffset in="lzPressBlur" dx="0.5" dy="2" result="lzPressOffset"/><feFlood flood-color="#000000" flood-opacity="0.62" result="lzPressColor"/><feComposite in="lzPressColor" in2="lzPressOffset" operator="in" result="lzPressShadow"/><feMerge><feMergeNode in="lzPressShadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="lzKnobDepth" x="-35%" y="-35%" width="180%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="lzKnobBlur"/><feOffset in="lzKnobBlur" dx="3" dy="7" result="lzKnobOffset"/><feFlood flood-color="#000000" flood-opacity="0.62" result="lzKnobColor"/><feComposite in="lzKnobColor" in2="lzKnobOffset" operator="in" result="lzKnobShadow"/><feMerge><feMergeNode in="lzKnobShadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="lzSwitchDepth" x="-50%" y="-45%" width="200%" height="210%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="lzSwBlur"/><feOffset in="lzSwBlur" dx="1" dy="3" result="lzSwOffset"/><feFlood flood-color="#000000" flood-opacity="0.68" result="lzSwColor"/><feComposite in="lzSwColor" in2="lzSwOffset" operator="in" result="lzSwShadow"/><feMerge><feMergeNode in="lzSwShadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="lzSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>' +
    '</defs>';

const LZ_HARDWARE_BUTTONS = [
    '[id^="deckBtn"]', '#eqDefeatBtn', '#ttCleanBtn', '#ttPowerBtn', '#ttStartBtn',
    '#tt33', '#tt45', '#ttPrevRec', '#ttNextRec'
].join(',');

function lzStripControlClone(el, className) {
    const clone = el.cloneNode(false);
    ["id", "style", "tabindex", "role", "aria-label", "filter", "class"].forEach((name) => clone.removeAttribute(name));
    clone.setAttribute("class", className);
    clone.setAttribute("pointer-events", "none");
    return clone;
}

function lzDecorateHardwareButton(el) {
    if (!el || el.dataset.lzHardware === "button") return;
    const tag = el.tagName.toLowerCase();
    if (tag !== "rect" && tag !== "circle") return;
    el.dataset.lzHardware = "button";
    el.classList.add("lz-hardware-button");

    const side = lzStripControlClone(el, "lz-hardware-side");
    side.setAttribute("fill", "#07080a");
    side.setAttribute("stroke", "#020304");
    side.setAttribute("opacity", ".94");
    if (tag === "rect") side.setAttribute("y", String(Number(el.getAttribute("y") || 0) + 7));
    else side.setAttribute("cy", String(Number(el.getAttribute("cy") || 0) + 5));
    el.parentNode.insertBefore(side, el);

    const gloss = lzStripControlClone(el, "lz-hardware-gloss");
    gloss.setAttribute("fill", tag === "circle" ? "url(#lzControlGlossRound)" : "url(#lzControlGloss)");
    gloss.setAttribute("stroke", "none");
    gloss.setAttribute("opacity", ".72");
    el.parentNode.insertBefore(gloss, el.nextSibling);

    const setPressed = (pressed) => {
        el.classList.toggle("lz-pressed", pressed);
        gloss.classList.toggle("lz-pressed", pressed);
    };
    el.addEventListener("pointerdown", () => setPressed(true));
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => el.addEventListener(name, () => setPressed(false)));
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") setPressed(true);
    });
    el.addEventListener("keyup", () => setPressed(false));
    el.addEventListener("blur", () => setPressed(false));
}

function applyHardwareDepth(svg) {
    if (!svg) return;
    svg.querySelectorAll(LZ_HARDWARE_BUTTONS).forEach(lzDecorateHardwareButton);
    svg.querySelectorAll('[id^="tsSw"], .lz-hardware-switch').forEach((el) => el.classList.add("lz-hardware-switch"));
    svg.querySelectorAll('#tsKnob, .lz-hardware-knob').forEach((el) => el.classList.add("lz-hardware-knob"));
}

function applyPanelLighting(svg) {
    if (!svg) return;
    const vb = (svg.getAttribute("viewBox") || "0 0 2000 400").split(/\s+/).map(Number);
    const X = vb[0], Y = vb[1], W = vb[2], H = vb[3];   // viewBox 원점이 (0,0)이 아닐 수도 있다 (턴테이블)
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("pointer-events", "none");
    g.innerHTML = LZ_DEFS +
        '<rect x="' + X + '" y="' + Y + '" width="' + W + '" height="' + Math.round(H * 0.32) + '" rx="8" fill="url(#lzGloss)"/>' +
        '<rect x="' + X + '" y="' + Y + '" width="' + W + '" height="' + H + '" rx="8" fill="url(#lzShade)"/>' +
        '<rect x="' + X + '" y="' + Y + '" width="' + W + '" height="' + H + '" rx="8" fill="url(#lzVign)"/>' +
        '<rect x="' + (X + 2) + '" y="' + (Y + 2) + '" width="' + (W - 4) + '" height="' + (H - 4) + '" rx="7" fill="none" stroke="url(#lzEdgeLight)" stroke-width="2" opacity="0.34"/>' +
        '<path d="M ' + (X + 12) + ' ' + (Y + 3) + ' H ' + (X + W - 12) + '" stroke="#ffffff" stroke-width="1.4" opacity="0.13"/>' +
        '<path d="M ' + (X + 10) + ' ' + (Y + H - 3) + ' H ' + (X + W - 10) + '" stroke="#000000" stroke-width="2" opacity="0.36"/>' +
        '<rect class="lzPowerDim" x="' + X + '" y="' + Y + '" width="' + W + '" height="' + H + '" rx="8" fill="#000000" opacity="0.22"/>';
    svg.appendChild(g);
    applyHardwareDepth(svg);
}

const TS_HIT_META = {
    power: { title: "전원 — 재생/정지", cursor: "pointer" },
    dial: { title: "드래그하여 주파수를 맞추세요", cursor: "ew-resize" },
    rec: { title: "편성표 — 프로그램 확인과 예약 녹음", cursor: "pointer" },
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
                <linearGradient id="tnPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#68645c"/><stop offset="0.045" stop-color="#555149"/><stop offset="0.48" stop-color="#48453f"/><stop offset="0.82" stop-color="#403d37"/><stop offset="1" stop-color="#302e2a"/></linearGradient>
                <linearGradient id="tnBevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b2afa7"/><stop offset="0.5" stop-color="#918e86"/><stop offset="1" stop-color="#63605a"/></linearGradient>
                <linearGradient id="tnDialWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0c07"/><stop offset="0.5" stop-color="#12140c"/><stop offset="1" stop-color="#181a10"/></linearGradient>
                <linearGradient id="tnMeterWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0e0a"/><stop offset="1" stop-color="#17170f"/></linearGradient>
                <radialGradient id="tnKnobFace" cx="0.38" cy="0.34" r="0.85"><stop offset="0" stop-color="#56545c"/><stop offset="0.45" stop-color="#403e45"/><stop offset="1" stop-color="#262429"/></radialGradient>
                <linearGradient id="tnKnobRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5960"/><stop offset="1" stop-color="#201f24"/></linearGradient>
                <linearGradient id="tnSwitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2830"/><stop offset="1" stop-color="#3f3d45"/></linearGradient>
                <filter id="tnGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
                <pattern id="tnTicksMinor" width="13" height="30" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="1.4" height="14" fill="#8f8a4a"/></pattern>
                <pattern id="tnTicksMajor" width="65" height="30" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="2.2" height="24" fill="#c8c07a"/></pattern>
                <pattern id="tnBrush" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5H8 M0 3.5H8" stroke="#ffffff" stroke-width=".65" opacity=".055"/><path d="M0 2H8" stroke="#000000" stroke-width=".6" opacity=".06"/></pattern>
                <radialGradient id="tnScrew" cx=".34" cy=".28" r=".8"><stop offset="0" stop-color="#d3d0c8"/><stop offset=".36" stop-color="#77746d"/><stop offset="1" stop-color="#24231f"/></radialGradient>
            </defs>
            <rect x="0" y="0" width="2000" height="269" rx="6" fill="url(#tnPanel)"/>
            <rect x="0" y="0" width="2000" height="269" rx="6" fill="url(#tnBrush)" opacity=".58"/>
            <rect x="0" y="0" width="2000" height="13" rx="6" fill="url(#tnBevel)"/>
            <rect x="0" y="12" width="2000" height="2" fill="#26242a" opacity="0.7"/>
            <rect x="0" y="255" width="2000" height="14" fill="#000000" opacity="0.18"/>
            <g fill="url(#tnScrew)" stroke="#1d1c19" stroke-width="1"><circle cx="24" cy="30" r="7"/><circle cx="1976" cy="30" r="7"/><circle cx="24" cy="239" r="7"/><circle cx="1976" cy="239" r="7"/></g>
            <g stroke="#24231f" stroke-width="1.4" opacity=".8"><path d="M20 30h8"/><path d="M1972 30h8"/><path d="M20 239h8"/><path d="M1972 239h8"/></g>
            <rect x="120" y="23" width="30" height="30" rx="15" fill="none" stroke="#d9d7dc" stroke-width="1.6"/>
            <g stroke="#d9d7dc" stroke-width="1.7" fill="none" stroke-linecap="round">
                <path d="M129 30 L129 42"/><path d="M135 27 L135 42"/><path d="M141 30 L141 42"/><path d="M129 42 Q135 47 141 42"/><path d="M135 42 L135 47"/>
            </g>
            <text x="160" y="43" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" letter-spacing="1.5" fill="#e6e5e8">YAHAMA</text>
            <text x="298" y="41" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" letter-spacing="2" fill="#b3b1b8">NATURAL SOUND<tspan dx="18">FM STEREO TUNER</tspan><tspan dx="18" font-weight="700" fill="#c8c6cd">T-2</tspan></text>
            <rect x="128" y="58" width="1272" height="64" rx="4" fill="url(#tnDialWin)" stroke="#0a0b06" stroke-width="2"/>
            <ellipse class="lampGlow" cx="764" cy="92" rx="560" ry="52" fill="url(#lzLampGreen)" opacity="0.4"/>
            <rect x="132" y="62" width="1264" height="56" rx="3" fill="none" stroke="#8e8a64" stroke-width="1" opacity=".35"/>
            <polygon points="132,62 560,62 440,118 132,118" fill="url(#lzGlassSweep)" opacity=".72"/>
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
            <g font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="650" letter-spacing="0.7" fill="#bbb9bf" text-anchor="middle">
                <text x="1452" y="74">STEREO</text><text x="1524" y="74">LOCK</text><text x="1596" y="74">HI-BLEND</text>
            </g>
            <rect id="tsLedStereo" x="1432" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <rect id="tsLedLock" x="1504" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <rect id="tsLedBlend" x="1576" y="96" width="40" height="11" rx="2" fill="#4a1410" filter="url(#tnGlow)"/>
            <g font-family="Arial, Helvetica, sans-serif" font-size="14.5" font-weight="650" letter-spacing="0.9" fill="#d1cfd4" text-anchor="middle">
                <text x="152" y="152">POWER</text><text x="272" y="152">REC CAL</text><text x="366" y="152">BLEND</text><text x="456" y="152">MODE</text><text x="548" y="152">MUTE/STE</text><text x="636" y="152">IF MODE</text><text x="722" y="152">RF MODE</text>
            </g>
            <rect x="132" y="164" width="40" height="48" rx="4" fill="url(#tnSwitch)" stroke="#25232a" stroke-width="1"/>
            <rect id="tsPwrTop" x="140" y="172" width="24" height="15" rx="2" fill="#1c1a20"/>
            <rect id="tsPwrBot" x="140" y="190" width="24" height="15" rx="2" fill="#54525a"/>
            <g>
                <rect x="254" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="252" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwRec" x="262" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="348" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="346" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwBlend" x="356" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="438" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="436" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwMode" x="446" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="530" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="528" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwMute" x="538" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="618" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="616" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwIf" x="626" y="171" width="20" height="18" rx="3" fill="#57555d"/>
                <rect x="704" y="172" width="40" height="42" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><rect x="702" y="168" width="40" height="42" rx="4" fill="url(#tnSwitch)" stroke="#25232a"/><rect id="tsSwRf" x="712" y="171" width="20" height="18" rx="3" fill="#57555d"/>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" fill="#aaa7a0" text-anchor="middle">
                <text x="820" y="165" font-size="12" font-weight="700" letter-spacing="1.8">QUARTZ LOCK</text>
                <text x="820" y="184" font-size="10.5" letter-spacing="1.2">SERVO TUNING</text>
                <circle cx="820" cy="202" r="7" fill="#151519" stroke="#77746d" stroke-width="1.3"/><circle cx="820" cy="202" r="2.6" fill="#050506"/>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" letter-spacing="1.5" fill="#c3c1c8" text-anchor="middle">
                <text x="1030" y="150">SIGNAL QUALITY</text><text x="1290" y="150">TUNING</text><text x="1520" y="150">STATION</text>
            </g>
            <rect x="925" y="162" width="212" height="50" rx="4" fill="url(#tnMeterWin)" stroke="#0a0b06" stroke-width="1.5"/>
            <rect class="ampLamp" x="925" y="162" width="212" height="50" rx="4" fill="url(#lzWarmFace)" opacity="0.02"/>
            <ellipse class="ampLamp" cx="1031" cy="167" rx="93" ry="12" fill="url(#lzLampPool)" opacity="0.02"/>
            <g stroke="#5a5240" stroke-width="1.3">
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
            <rect class="ampLamp" x="1182" y="162" width="212" height="50" rx="4" fill="url(#lzWarmFace)" opacity="0.02"/>
            <ellipse class="ampLamp" cx="1288" cy="167" rx="93" ry="12" fill="url(#lzLampPool)" opacity="0.02"/>
            <g stroke="#5a5240" stroke-width="1.3">
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
            <ellipse cx="1863" cy="156" rx="113" ry="110" fill="#000000" opacity="0.45" filter="url(#lzSoft)"/><ellipse cx="1852" cy="140" rx="112" ry="110" fill="#1c1b20"/>
            <g id="tsKnob">
                <ellipse cx="1852" cy="138" rx="110" ry="108" fill="url(#tnKnobRim)"/>
                <ellipse cx="1852" cy="138" rx="98" ry="97" fill="url(#tnKnobFace)"/>
                <ellipse cx="1852" cy="138" rx="88" ry="87" fill="none" stroke="#77747c" stroke-width="6" stroke-dasharray="1.6 5" opacity=".38"/>
                <ellipse cx="1852" cy="138" rx="68" ry="67" fill="none" stroke="#1b1a1e" stroke-width="1.4" opacity=".8"/>
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
                <linearGradient id="mrPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#222328"/><stop offset="0.055" stop-color="#15161a"/><stop offset="0.5" stop-color="#0d0e12"/><stop offset="0.88" stop-color="#08090c"/><stop offset="1" stop-color="#050608"/></linearGradient>
                <linearGradient id="mrRail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#474c55"/><stop offset="0.18" stop-color="#eef0f5"/><stop offset="0.42" stop-color="#9ca2ad"/><stop offset="0.7" stop-color="#f2f3f5"/><stop offset="1" stop-color="#444952"/></linearGradient>
                <linearGradient id="mrMeter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#95e4da"/><stop offset="1" stop-color="#5cb6ad"/></linearGradient>
                <radialGradient id="mrKnob" cx="0.38" cy="0.32" r="0.9"><stop offset="0" stop-color="#3a3a40"/><stop offset="0.6" stop-color="#1c1c22"/><stop offset="1" stop-color="#0c0c10"/></radialGradient>
                <linearGradient id="mrGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17242d" stop-opacity=".72"/><stop offset=".14" stop-color="#071016" stop-opacity=".18"/><stop offset=".62" stop-color="#020406" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".48"/></linearGradient>
                <linearGradient id="mrBrass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#80642e"/><stop offset=".25" stop-color="#d6b86c"/><stop offset=".52" stop-color="#8e7134"/><stop offset=".76" stop-color="#e2c77e"/><stop offset="1" stop-color="#6a5126"/></linearGradient>
                <filter id="mrGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
                <filter id="mrBlueBloom" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
                <pattern id="mrTickMinor" width="10.8" height="30" patternUnits="userSpaceOnUse"><rect width="1.2" height="14" fill="#e8e8ea" opacity="0.75"/></pattern>
                <pattern id="mrTickMajor" width="54" height="30" patternUnits="userSpaceOnUse"><rect width="2" height="24" fill="#ffffff"/></pattern>
                <pattern id="mrFine" width="11" height="9" patternUnits="userSpaceOnUse"><path d="M0 .5H11 M0 4.5H11 M0 8.5H11" stroke="#ffffff" stroke-width=".55" opacity=".025"/><path d="M0 2.5H11 M0 6.5H11" stroke="#000000" stroke-width=".5" opacity=".12"/></pattern>
                <pattern id="mrKnurl" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M1 0V7 M4.5 0V7" stroke="#bfc2c9" stroke-width=".9" opacity=".33"/><path d="M2.5 0V7 M6 0V7" stroke="#050608" stroke-width="1.2" opacity=".72"/></pattern>
            </defs>
            <rect x="0" y="0" width="2000" height="700" rx="8" fill="url(#mrPanel)"/>
            <rect x="0" y="0" width="2000" height="700" rx="8" fill="url(#mrFine)" opacity=".72"/>
            <rect x="0" y="0" width="30" height="700" rx="8" fill="url(#mrRail)"/>
            <rect x="1970" y="0" width="30" height="700" rx="8" fill="url(#mrRail)"/>
            <rect x="34" y="24" width="1932" height="642" rx="5" fill="none" stroke="#31333a" stroke-width="2"/>
            <rect x="39" y="29" width="1922" height="632" rx="4" fill="none" stroke="#08090b" stroke-width="1.5"/>
            <path d="M8 18V682 M22 18V682 M1978 18V682 M1992 18V682" stroke="#ffffff" stroke-width="1" opacity=".28"/>
            <rect x="0" y="686" width="2000" height="14" fill="#000000" opacity="0.4"/>
            <g fill="#15161a" stroke="#d7d9df" stroke-width="1.2"><circle cx="15" cy="32" r="6"/><circle cx="1985" cy="32" r="6"/><circle cx="15" cy="668" r="6"/><circle cx="1985" cy="668" r="6"/></g>
            <!-- FUNCTION 표시창 -->
            <rect x="70" y="60" width="240" height="145" rx="4" fill="#050506" stroke="#6b6648" stroke-width="1.6"/>
            <rect x="66" y="56" width="248" height="153" rx="6" fill="none" stroke="url(#mrBrass)" stroke-width="2" opacity=".7"/>
            <rect x="74" y="64" width="232" height="137" rx="2" fill="url(#mrGlass)" opacity=".52"/>
            <text x="190" y="88" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="2.5" fill="#7ee08a" text-anchor="middle">FUNCTION</text>
            <text id="tsLedStereo" data-on="#ff4a3a" data-off="#3a1512" x="190" y="126" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a1512" text-anchor="middle">STEREO</text>
            <text id="tsLedLock" data-on="#ffd24a" data-off="#3a3012" x="190" y="158" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a3012" text-anchor="middle">LOCKED</text>
            <text id="tsLedBlend" data-on="#ff9a3a" data-off="#3a2312" x="190" y="190" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3.5" fill="#3a2312" text-anchor="middle">FILTER</text>
            <!-- STATION 표시창 -->
            <rect x="70" y="225" width="240" height="145" rx="4" fill="#050506" stroke="#6b6648" stroke-width="1.6"/>
            <rect x="66" y="221" width="248" height="153" rx="6" fill="none" stroke="url(#mrBrass)" stroke-width="2" opacity=".7"/>
            <rect class="lampGlow" x="72" y="227" width="236" height="141" rx="3" fill="url(#lzMcBlue)" opacity="0.4" style="mix-blend-mode:screen"/>
            <polygon points="74,229 230,229 174,366 74,366" fill="url(#lzGlassSweep)" opacity=".4"/>
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
            <rect x="344" y="54" width="1222" height="322" rx="7" fill="none" stroke="url(#mrBrass)" stroke-width="2.5" opacity=".82"/>
            <rect x="350" y="60" width="1210" height="310" rx="4" fill="url(#mrGlass)" opacity=".58"/>
            <rect class="lampGlow" x="352" y="62" width="1206" height="306" rx="3" fill="url(#lzMcBlue)" opacity="0.4" style="mix-blend-mode:screen"/>
            <ellipse class="lampGlow" cx="955" cy="216" rx="570" ry="132" fill="#1679be" opacity=".05" filter="url(#mrBlueBloom)"/>
            <polygon points="354,64 770,64 610,366 354,366" fill="url(#lzGlassSweep)" opacity=".56"/>
            <rect x="350" y="60" width="1210" height="20" fill="url(#lzInset)" opacity="0.8"/>
            <g class="dialScale" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#f2f2f2" text-anchor="middle">
                <text x="430" y="130">88</text><text x="538" y="130">90</text><text x="646" y="130">92</text><text x="754" y="130">94</text><text x="862" y="130">96</text><text x="970" y="130">98</text><text x="1078" y="130">100</text><text x="1186" y="130">102</text><text x="1294" y="130">104</text><text x="1402" y="130">106</text><text x="1510" y="130">108</text>
            </g>
            <text class="dialScale" x="390" y="130" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="#9fe2d4" text-anchor="end">FM · MHz</text>
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
            <rect class="ampLamp" x="420" y="276" width="280" height="60" rx="3" fill="url(#lzMcBlue)" opacity=".03"/>
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
            <rect class="ampLamp" x="1210" y="276" width="280" height="60" rx="3" fill="url(#lzMcBlue)" opacity=".03"/>
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
            <circle cx="1755" cy="215" r="137" fill="none" stroke="url(#mrBrass)" stroke-width="3" opacity=".78"/>
            <g id="tsKnob">
                <circle cx="1768.0" cy="238.4" r="132.6" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1755" cy="215" r="130" fill="url(#mrKnob)" stroke="#c8c8ce" stroke-width="3"/><path d="M 1661.4 150.0 A 114.4 114.4 0 0 1 1770.6 103.2" stroke="#ffffff" stroke-width="7.8" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
                <circle cx="1755" cy="215" r="121" fill="url(#mrKnurl)" opacity=".62"/>
                <circle cx="1755" cy="215" r="105" fill="url(#mrKnob)" stroke="#4d5159" stroke-width="1.5"/>
                <circle cx="1755" cy="215" r="112" fill="none" stroke="#3a3a42" stroke-width="1.5"/>
                <circle cx="1755" cy="123" r="8" fill="#4a4a52"/>
            </g>
            <ellipse cx="1712" cy="176" rx="46" ry="36" fill="#ffffff" opacity="0.05" pointer-events="none"/>
            <!-- 하단 노브 행 (글라스 위) -->
            <g font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#7ee08a" text-anchor="middle">
                <text x="380" y="462">SELECTIVITY</text><text x="620" y="462">METER</text><text x="860" y="462">FILTER</text><text x="1100" y="462">MUTING</text><text x="1340" y="462">MODE</text><text x="1580" y="462">VOLUME</text>
            </g>
            <g font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" letter-spacing="1.1" fill="#65a872" text-anchor="middle">
                <text x="380" y="480">REC</text><text x="620" y="480">TIMER</text><text x="860" y="480">HI BLEND</text><text x="1100" y="480">MUTE</text><text x="1340" y="480">STEREO/MONO</text><text x="1580" y="480">LIST</text>
            </g>
            <g>
                <circle cx="384.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="380" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 351.2 513.0 A 35.2 35.2 0 0 1 384.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwRec" x="378" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="624.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="620" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 591.2 513.0 A 35.2 35.2 0 0 1 624.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwIf" x="618" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="864.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="860" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 831.2 513.0 A 35.2 35.2 0 0 1 864.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwBlend" x="858" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1104.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1100" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 1071.2 513.0 A 35.2 35.2 0 0 1 1104.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwMute" x="1098" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1344.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1340" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 1311.2 513.0 A 35.2 35.2 0 0 1 1344.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwMode" x="1338" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
                <circle cx="1584.0" cy="540.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1580" cy="533" r="40" fill="url(#mrKnob)" stroke="#9a9aa2" stroke-width="2"/><path d="M 1551.2 513.0 A 35.2 35.2 0 0 1 1584.8 498.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwRf" x="1578" y="497" width="4" height="18" rx="2" fill="#d8d8dc"/>
            </g>
            <!-- PANLOC (좌 = 전원) -->
            <circle cx="105" cy="560" r="20" fill="#1c1c22" stroke="#8a8a92" stroke-width="1.6"/>
            <circle id="tsSwPwr" cx="105" cy="556" r="9" fill="#55555c"/>
            <text x="105" y="608" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="1.7" fill="#7ee08a" text-anchor="middle">PANLOC</text>
            <circle cx="1895" cy="560" r="20" fill="#1c1c22" stroke="#8a8a92" stroke-width="1.6"/>
            <circle cx="1895" cy="556" r="9" fill="#55555c"/>
            <text x="1895" y="608" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="1.7" fill="#7ee08a" text-anchor="middle">PANLOC</text>
            <!-- 하단 로고 -->
            <path d="M250 628H1660" stroke="url(#mrBrass)" stroke-width="1.2" opacity=".48"/>
            <text x="955" y="655" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" font-weight="700" fill="#555860" text-anchor="middle">McIntoch</text>
            <text x="1645" y="653" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" letter-spacing="2.2" fill="#5d6068" text-anchor="end">LABORATORY REFERENCE · SERIAL 078-2105</text>
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
                <pattern id="mzWoodGrain" width="180" height="42" patternUnits="userSpaceOnUse"><path d="M-20 9 C25 -3 52 20 96 8 S164 4 210 16 M-12 28 C35 17 64 42 112 27 S170 22 205 34" fill="none" stroke="#d69a65" stroke-width="2" opacity=".14"/><path d="M-10 18 C42 8 70 31 126 16 S184 13 218 23" fill="none" stroke="#241108" stroke-width="1.2" opacity=".28"/></pattern>
                <linearGradient id="mzBevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9e8"/><stop offset=".18" stop-color="#d8ceb3"/><stop offset=".82" stop-color="#a69b7e"/><stop offset="1" stop-color="#766d59"/></linearGradient>
                <filter id="mzScopeBloom" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="5"/></filter>
            </defs>
            <!-- 월넛 우드 케이스 -->
            <rect x="0" y="0" width="2000" height="730" rx="12" fill="url(#mzWood)"/>
            <rect x="0" y="0" width="2000" height="730" rx="12" fill="url(#mzWoodGrain)"/>
            <rect x="0" y="0" width="2000" height="730" rx="12" fill="none" stroke="#2a1810" stroke-width="3"/>
            <rect x="20" y="14" width="1960" height="8" rx="4" fill="#8a5a36" opacity="0.5"/>
            <rect x="20" y="706" width="1960" height="8" rx="4" fill="#1c0f08" opacity="0.6"/>
            <!-- 샴페인 알루미늄 패널 -->
            <rect x="90" y="60" width="1820" height="610" rx="4" fill="url(#mzPanel)"/>
            <rect x="90" y="60" width="1820" height="610" rx="4" fill="url(#mzBrush)"/>
            <rect x="96" y="66" width="1808" height="598" rx="3" fill="none" stroke="#fffbea" stroke-width="2" opacity=".44"/>
            <rect x="88" y="58" width="1824" height="614" rx="5" fill="none" stroke="#5d5544" stroke-width="3" opacity=".62"/>
            <circle cx="130" cy="100" r="8" fill="#9a9076"/><circle cx="1870" cy="100" r="8" fill="#9a9076"/><circle cx="130" cy="630" r="8" fill="#9a9076"/><circle cx="1870" cy="630" r="8" fill="#9a9076"/>
            <!-- 블랙 윈도우 -->
            <rect x="360" y="120" width="1280" height="270" rx="6" fill="#070707" stroke="#1c1a16" stroke-width="3"/>
            <rect x="354" y="114" width="1292" height="282" rx="9" fill="none" stroke="url(#mzBevel)" stroke-width="4"/>
            <ellipse class="lampGlow" cx="1050" cy="330" rx="600" ry="58" fill="url(#lzLamp)" opacity="0.4"/>
            <rect x="360" y="120" width="1280" height="18" fill="url(#lzInset)" opacity="0.8"/>
            <!-- 오실로스코프 -->
            <rect x="390" y="140" width="370" height="230" rx="4" fill="url(#mzScope)" stroke="#0d2a16" stroke-width="2"/>
            <rect x="382" y="132" width="386" height="246" rx="8" fill="none" stroke="url(#mzBevel)" stroke-width="4"/>
            <ellipse class="lampGlow" cx="575" cy="260" rx="132" ry="88" fill="#21d06a" opacity=".035" filter="url(#mzScopeBloom)"/>
            <text x="575" y="168" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="3" fill="#3fd06a" text-anchor="middle" opacity="0.9">TUNE TO CENTER</text>
            <g stroke="#1f7a3c" stroke-width="1.2" opacity="0.8">
                <line x1="575" y1="185" x2="575" y2="350"/>
                <line x1="545" y1="205" x2="605" y2="205"/><line x1="555" y1="235" x2="595" y2="235"/><line x1="535" y1="267" x2="615" y2="267"/><line x1="555" y1="299" x2="595" y2="299"/><line x1="545" y1="330" x2="605" y2="330"/>
            </g>
            <g fill="none" stroke="#5af28a" stroke-linecap="round">
                <path d="M445 268 C477 214 521 212 575 268 S674 322 705 268" stroke-width="3" opacity=".8" filter="url(#mzGlow)"/>
                <path d="M445 268 C477 214 521 212 575 268 S674 322 705 268" stroke-width="1.2" opacity=".95"/>
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
            <text x="330" y="285" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="15" font-weight="700" fill="#4a4436" text-anchor="middle">Vert.</text>
            <circle cx="1670" cy="255" r="10" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/>
            <circle id="tsSwRf" cx="1670" cy="255" r="4" fill="#b8ae90"/>
            <text x="1670" y="285" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="15" font-weight="700" fill="#4a4436" text-anchor="middle">Hor.</text>
            <!-- 신호 미터 (우측 슬롯) -->
            <text x="1435" y="436" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="16" font-weight="700" fill="#4a4436" text-anchor="end">signal</text>
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
            <g font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="19" font-weight="700" fill="#2a2a2e" text-anchor="middle">
                <text x="480" y="596">blend</text><text x="680" y="596">mode</text><text x="1000" y="648">tuning</text><text x="1320" y="596">timer</text><text x="1520" y="596">power</text><text x="1720" y="596">muting</text>
            </g>
            <g>
                <circle cx="480" cy="520" r="38" fill="#8f8a76"/><circle cx="483.6" cy="523.5" r="36.7" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="480" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><path d="M 454.1 499.0 A 31.7 31.7 0 0 1 484.3 486.0" stroke="#ffffff" stroke-width="2.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwBlend" x="478" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="680" cy="520" r="38" fill="#8f8a76"/><circle cx="683.6" cy="523.5" r="36.7" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="680" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><path d="M 654.1 499.0 A 31.7 31.7 0 0 1 684.3 486.0" stroke="#ffffff" stroke-width="2.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwMode" x="678" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1320" cy="520" r="38" fill="#8f8a76"/><circle cx="1323.6" cy="523.5" r="36.7" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1320" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><path d="M 1294.1 499.0 A 31.7 31.7 0 0 1 1324.3 486.0" stroke="#ffffff" stroke-width="2.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwIf" x="1318" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1520" cy="520" r="38" fill="#8f8a76"/><circle cx="1523.6" cy="523.5" r="36.7" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1520" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><path d="M 1494.1 499.0 A 31.7 31.7 0 0 1 1524.3 486.0" stroke="#ffffff" stroke-width="2.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwPwr" x="1518" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
                <circle cx="1720" cy="520" r="38" fill="#8f8a76"/><circle cx="1723.6" cy="523.5" r="36.7" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1720" cy="517" r="36" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="1.4"/><path d="M 1694.1 499.0 A 31.7 31.7 0 0 1 1724.3 486.0" stroke="#ffffff" stroke-width="2.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/><rect id="tsSwMute" x="1718" y="488" width="4" height="16" rx="2" fill="#4a4436"/>
            </g>
            <circle cx="1000" cy="519" r="99" fill="#8f8a76"/>
            <circle cx="1000" cy="515" r="103" fill="none" stroke="url(#mzBevel)" stroke-width="5"/>
            <g id="tsKnob">
                <circle cx="1009.5" cy="532.1" r="96.9" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1000" cy="515" r="95" fill="url(#mzKnob)" stroke="#8f8a76" stroke-width="2"/><path d="M 931.6 467.5 A 83.6 83.6 0 0 1 1011.4 433.3" stroke="#ffffff" stroke-width="5.7" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
                <circle cx="1000" cy="446" r="6" fill="#4a4436"/>
            </g>
            <circle cx="1000" cy="515" r="75" fill="none" stroke="#766f60" stroke-width="7" stroke-dasharray="1.8 6.2" opacity=".62"/>
            <ellipse cx="968" cy="482" rx="34" ry="26" fill="#ffffff" opacity="0.25" pointer-events="none"/>
            <g font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="650" letter-spacing="1.5" fill="#5b5445">
                <text x="145" y="628">OSCILLOSCOPE TUNING MONITOR</text>
                <text x="1850" y="628" text-anchor="end">HANDCRAFTED · MODEL 10 B · S/N 10B-1457</text>
            </g>
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
                <pattern id="suBlackBrush" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0 .5H10 M0 3.5H10" stroke="#ffffff" stroke-width=".55" opacity=".035"/><path d="M0 2H10 M0 5H10" stroke="#000000" stroke-width=".7" opacity=".22"/></pattern>
                <linearGradient id="suBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d939e"/><stop offset=".16" stop-color="#343942"/><stop offset=".82" stop-color="#11141a"/><stop offset="1" stop-color="#777d88"/></linearGradient>
                <pattern id="suKnurl" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(26)"><path d="M1 0V8 M5 0V8" stroke="#f8f8fa" stroke-width="1" opacity=".34"/><path d="M3 0V8 M7 0V8" stroke="#3b3e46" stroke-width="1.2" opacity=".52"/></pattern>
            </defs>
            <rect x="0" y="0" width="2000" height="660" rx="8" fill="url(#suPanel)"/>
            <rect x="0" y="0" width="2000" height="660" rx="8" fill="url(#suBlackBrush)" opacity=".72"/>
            <rect x="0" y="48" width="2000" height="2" fill="#3a3a42" opacity="0.8"/>
            <path d="M32 58V628 M304 58V628 M1658 58V628" stroke="#3b3d45" stroke-width="1.5" opacity=".72"/>
            <rect x="0" y="646" width="2000" height="14" fill="#000000" opacity="0.4"/>
            <!-- 상단 브랜드 스트립 -->
            <text x="310" y="34" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" letter-spacing="1.4" fill="#e8e8ec">TU-9900</text>
            <text x="460" y="35" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" font-weight="700" fill="#f0f0f2">Sansul</text>
            <text x="1530" y="33" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="1.5" fill="#c8c8d0">AM/FM Stereo Tuner</text>
            <!-- 좌측 레버 컬럼 -->
            <rect x="56" y="76" width="36" height="24" rx="3" fill="#26262c" stroke="#3a3a42"/><rect x="62" y="80" width="24" height="9" rx="2" fill="#55555c"/>
            <text x="108" y="95" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="0.8" fill="#8a8a94">ANT ATT</text>
            <g font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" letter-spacing="0.9" fill="#d5d5dc">
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
            <circle cx="97.6" cy="494.7" r="26.5" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="95" cy="490" r="26" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="1.6"/><path d="M 76.3 477.0 A 22.9 22.9 0 0 1 98.1 467.6" stroke="#ffffff" stroke-width="1.6" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
            <rect x="93" y="466" width="4" height="12" rx="2" fill="#26262c"/>
            <text x="150" y="495" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="0.8" fill="#8a8a94">OUTPUT LEVEL</text>
            <rect x="52" y="560" width="48" height="34" rx="4" fill="#26262c" stroke="#3a3a42"/>
            <rect id="tsSwPwr" x="59" y="566" width="34" height="11" rx="2" fill="#8a8a94"/>
            <text x="115" y="583" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="#e8e8ec">POWER</text>
            <!-- 다이얼 창 -->
            <rect x="320" y="64" width="1320" height="376" rx="5" fill="url(#suDial)" stroke="#26262c" stroke-width="2.5"/>
            <rect x="312" y="56" width="1336" height="392" rx="9" fill="none" stroke="url(#suBezel)" stroke-width="5"/>
            <rect x="320" y="66" width="1320" height="58" fill="#bfe8ff" opacity="0.1"/>
            <ellipse class="lampGlow" cx="980" cy="140" rx="620" ry="90" fill="url(#lzLampCool)" opacity="0.4"/>
            <polygon points="324,68 782,68 620,436 324,436" fill="url(#lzGlassSweep)" opacity=".48"/>
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
            <rect class="ampLamp" x="390" y="312" width="260" height="108" rx="4" fill="url(#lzMcBlue)" opacity=".03"/>
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
            <rect class="ampLamp" x="700" y="312" width="260" height="108" rx="4" fill="url(#lzMcBlue)" opacity=".03"/>
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
            <circle cx="1252.4" cy="378.3" r="24.5" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1250" cy="374" r="24" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="1.6"/><path d="M 1232.7 362.0 A 21.1 21.1 0 0 1 1252.9 353.4" stroke="#ffffff" stroke-width="1.6" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
            <rect x="1248" y="352" width="4" height="12" rx="2" fill="#26262c"/>
            <!-- STATION 디지트 -->
            <rect x="1360" y="312" width="230" height="94" rx="6" fill="#050505" stroke="#26303a" stroke-width="1.6"/>
            <rect x="1354" y="306" width="242" height="106" rx="9" fill="none" stroke="url(#suBezel)" stroke-width="3"/>
            <polygon points="1364,316 1460,316 1420,402 1364,402" fill="url(#lzGlassSweep)" opacity=".38"/>
            <text x="1376" y="344" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#c23018">FM</text>
            <text x="1376" y="364" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#7a2416">MHz</text>
            <text id="tsFreqGlow" x="1575" y="376" font-family="'Courier New', monospace" font-size="44" font-weight="700" fill="#280c08" text-anchor="end" filter="url(#suGlow)">--.-</text>
            <text id="tsFreq" x="1575" y="376" font-family="'Courier New', monospace" font-size="44" font-weight="700" fill="#441410" text-anchor="end">--.-</text>
            <!-- 하단 통풍 슬롯(장식) -->
            <g fill="#0a0a0c" opacity="0.55">
                <rect x="360" y="480" width="12" height="110" rx="4"/><rect x="408" y="480" width="12" height="110" rx="4"/><rect x="456" y="480" width="12" height="110" rx="4"/><rect x="504" y="480" width="12" height="110" rx="4"/><rect x="552" y="480" width="12" height="110" rx="4"/><rect x="600" y="480" width="12" height="110" rx="4"/><rect x="648" y="480" width="12" height="110" rx="4"/><rect x="696" y="480" width="12" height="110" rx="4"/><rect x="744" y="480" width="12" height="110" rx="4"/><rect x="792" y="480" width="12" height="110" rx="4"/><rect x="840" y="480" width="12" height="110" rx="4"/><rect x="888" y="480" width="12" height="110" rx="4"/><rect x="936" y="480" width="12" height="110" rx="4"/><rect x="984" y="480" width="12" height="110" rx="4"/><rect x="1032" y="480" width="12" height="110" rx="4"/><rect x="1080" y="480" width="12" height="110" rx="4"/><rect x="1128" y="480" width="12" height="110" rx="4"/><rect x="1176" y="480" width="12" height="110" rx="4"/><rect x="1224" y="480" width="12" height="110" rx="4"/><rect x="1272" y="480" width="12" height="110" rx="4"/><rect x="1320" y="480" width="12" height="110" rx="4"/><rect x="1368" y="480" width="12" height="110" rx="4"/><rect x="1416" y="480" width="12" height="110" rx="4"/><rect x="1464" y="480" width="12" height="110" rx="4"/><rect x="1512" y="480" width="12" height="110" rx="4"/><rect x="1560" y="480" width="12" height="110" rx="4"/><rect x="1608" y="480" width="12" height="110" rx="4"/>
            </g>
            <rect x="338" y="466" width="1296" height="138" rx="7" fill="none" stroke="#32343b" stroke-width="1.8"/>
            <path d="M350 474H1622 M350 596H1622" stroke="#ffffff" stroke-width="1" opacity=".07"/>
            <text x="986" y="626" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" letter-spacing="2.2" fill="#666a73" text-anchor="middle">DUAL-GATE MOS FET · QUARTZ LOCK · 4-GANG VARIABLE CAPACITOR</text>
            <!-- 플라이휠 노브 -->
            <circle cx="1815" cy="314" r="154" fill="#050507"/>
            <circle cx="1815" cy="310" r="158" fill="none" stroke="url(#suBezel)" stroke-width="5"/>
            <g id="tsKnob">
                <circle cx="1830.0" cy="337.0" r="153.0" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1815" cy="310" r="150" fill="url(#suKnob)" stroke="#4a4a52" stroke-width="2.5"/><path d="M 1707.0 235.0 A 132.0 132.0 0 0 1 1833.0 181.0" stroke="#ffffff" stroke-width="9.0" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
                <circle cx="1815" cy="310" r="139" fill="url(#suKnurl)" opacity=".74"/>
                <circle cx="1815" cy="310" r="112" fill="url(#suKnob)" stroke="#727680" stroke-width="1.6"/>
                <circle cx="1815" cy="310" r="104" fill="none" stroke="#8a8a94" stroke-width="1.2" opacity="0.5"/>
                <circle cx="1815" cy="190" r="8" fill="#3a3a40"/>
            </g>
            <ellipse cx="1768" cy="262" rx="46" ry="36" fill="#ffffff" opacity="0.07" pointer-events="none"/>
            <text x="1815" y="505" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="4" fill="#b4b6be" text-anchor="middle">TUNING</text>
            <text x="1815" y="536" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="1.8" fill="#666a72" text-anchor="middle">PRECISION FLYWHEEL</text>
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
    const gridLines = Array.from({ length: 7 }, (_, i) => {
        const y = plateY + plateH * (0.16 + i * 0.112);
        return '<path d="M ' + (plateX - w * 0.08).toFixed(1) + ' ' + y.toFixed(1) + ' Q ' + cx + ' ' + (y - w * 0.018).toFixed(1) + ' ' + (plateX + plateW + w * 0.08).toFixed(1) + ' ' + y.toFixed(1) + '" fill="none" stroke="#b4a88f" stroke-width="0.75" opacity="0.42"/>';
    }).join("");
    const basePins = Array.from({ length: 5 }, (_, i) => {
        const x = cx - w * 0.34 + i * w * 0.17;
        return '<rect x="' + (x - w * 0.018).toFixed(1) + '" y="' + (baseY + 8) + '" width="' + (w * 0.036).toFixed(1) + '" height="' + Math.max(5, w * 0.13).toFixed(1) + '" rx="1" fill="url(#lzChromeLine)"/>';
    }).join("");
    let glass;
    if (kind === "balloon") {
        glass = '<path d="M ' + (cx - r) + ' ' + baseY + ' C ' + (cx - r) + ' ' + (top + h * 0.42) + ' ' + (cx - r * 0.62) + ' ' + (top + h * 0.14) + ' ' + cx + ' ' + top + ' C ' + (cx + r * 0.62) + ' ' + (top + h * 0.14) + ' ' + (cx + r) + ' ' + (top + h * 0.42) + ' ' + (cx + r) + ' ' + baseY + ' Z"';
    } else {
        glass = '<path d="M ' + (cx - r) + ' ' + baseY + ' L ' + (cx - r) + ' ' + (top + r * 1.05) + ' Q ' + (cx - r) + ' ' + top + ' ' + (cx - r * 0.34) + ' ' + top + ' L ' + (cx + r * 0.34) + ' ' + top + ' Q ' + (cx + r) + ' ' + top + ' ' + (cx + r) + ' ' + (top + r * 1.05) + ' L ' + (cx + r) + ' ' + baseY + ' Z"';
    }
    const getterCy = top + (kind === "balloon" ? h * 0.1 : r * 0.52);
    const getterRy = kind === "balloon" ? h * 0.06 : r * 0.36;
    return '<g>' +
        '<ellipse cx="' + (cx + w * 0.06).toFixed(1) + '" cy="' + (baseY + w * 0.19).toFixed(1) + '" rx="' + (w * 0.7).toFixed(1) + '" ry="' + (w * 0.18).toFixed(1) + '" fill="#000000" opacity="0.52" filter="url(#lzSoft)"/>' +
        '<ellipse class="ampGlow" cx="' + cx + '" cy="' + (baseY + 5) + '" rx="' + (w * 1.15).toFixed(1) + '" ry="' + (w * 0.24).toFixed(1) + '" fill="url(#lzDeckPool)" opacity="0.02"/>' +
        '<ellipse class="ampGlow" cx="' + cx + '" cy="' + (top + h * 0.55).toFixed(1) + '" rx="' + (w * 0.85).toFixed(1) + '" ry="' + (h * 0.5).toFixed(1) + '" fill="' + glowFill + '" opacity="0.06" filter="url(#lzBloom)"/>' +
        basePins +
        '<rect x="' + (cx - r - 5).toFixed(1) + '" y="' + (baseY - 2) + '" width="' + (w + 10) + '" height="15" rx="5" fill="#17130e"/>' +
        '<rect x="' + (cx - r - 3).toFixed(1) + '" y="' + (baseY + 1) + '" width="' + (w + 6) + '" height="3" rx="1.5" fill="#705942" opacity="0.72"/>' +
        '<rect x="' + (cx - r - 1).toFixed(1) + '" y="' + (baseY - 8) + '" width="' + (w + 2) + '" height="9" rx="3" fill="#2b2118"/>' +
        glass + ' fill="url(#lzTubeGlass)" stroke="#6e6656" stroke-width="1.4"/>' +
        '<path d="M ' + (cx - r * 0.78).toFixed(1) + ' ' + (baseY - 5) + ' Q ' + cx + ' ' + (baseY + 1) + ' ' + (cx + r * 0.78).toFixed(1) + ' ' + (baseY - 5) + '" fill="none" stroke="#d9d7cf" stroke-width="1.2" opacity="0.35"/>' +
        '<rect x="' + (plateX - w * 0.1).toFixed(1) + '" y="' + (plateY - h * 0.05).toFixed(1) + '" width="' + (w * 0.035).toFixed(1) + '" height="' + (plateH + h * 0.12).toFixed(1) + '" rx="1" fill="#9e9688" opacity="0.72"/>' +
        '<rect x="' + (plateX + plateW + w * 0.065).toFixed(1) + '" y="' + (plateY - h * 0.05).toFixed(1) + '" width="' + (w * 0.035).toFixed(1) + '" height="' + (plateH + h * 0.12).toFixed(1) + '" rx="1" fill="#9e9688" opacity="0.72"/>' +
        '<rect x="' + plateX.toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (plateW * 0.2).toFixed(1) + '" fill="#1d1c20" stroke="#0c0b0e" stroke-width="1"/>' +
        '<rect x="' + (plateX + plateW * 0.26).toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + (plateW * 0.12).toFixed(1) + '" height="' + plateH.toFixed(1) + '" fill="#2a2930"/>' +
        '<rect x="' + (plateX + plateW * 0.62).toFixed(1) + '" y="' + plateY.toFixed(1) + '" width="' + (plateW * 0.12).toFixed(1) + '" height="' + plateH.toFixed(1) + '" fill="#2a2930"/>' +
        '<path d="M ' + (plateX + plateW * 0.12).toFixed(1) + ' ' + (plateY + plateH * 0.1).toFixed(1) + ' V ' + (plateY + plateH * 0.9).toFixed(1) + ' M ' + (plateX + plateW * 0.88).toFixed(1) + ' ' + (plateY + plateH * 0.1).toFixed(1) + ' V ' + (plateY + plateH * 0.9).toFixed(1) + '" stroke="#56545c" stroke-width="1.2" opacity="0.75"/>' +
        gridLines +
        '<ellipse cx="' + cx + '" cy="' + (plateY - 3.5).toFixed(1) + '" rx="' + (plateW * 0.64).toFixed(1) + '" ry="3.4" fill="#8f8f96" opacity="0.85"/>' +
        '<ellipse cx="' + cx + '" cy="' + (plateY + plateH + 3.5).toFixed(1) + '" rx="' + (plateW * 0.64).toFixed(1) + '" ry="3.4" fill="#7a7a82" opacity="0.8"/>' +
        '<rect class="ampFil" x="' + (cx - 2.5) + '" y="' + (plateY + 3).toFixed(1) + '" width="5" height="' + (plateH - 6).toFixed(1) + '" rx="2.5" fill="' + filGrad + '" opacity="0.08"/>' +
        '<path class="ampFil" d="M ' + (cx - w * 0.14).toFixed(1) + ' ' + (plateY + plateH * 0.88).toFixed(1) + ' Q ' + cx + ' ' + (plateY + plateH * 0.64).toFixed(1) + ' ' + (cx + w * 0.14).toFixed(1) + ' ' + (plateY + plateH * 0.88).toFixed(1) + '" fill="none" stroke="' + glowFill + '" stroke-width="' + Math.max(1.5, w * 0.035).toFixed(1) + '" opacity="0.08"/>' +
        '<ellipse class="ampFilHot" cx="' + cx + '" cy="' + (plateY + plateH * 0.48).toFixed(1) + '" rx="' + (w * 0.3).toFixed(1) + '" ry="' + (plateH * 0.36).toFixed(1) + '" fill="url(#lzFilHot)" opacity="0"/>' +
        '<ellipse cx="' + cx + '" cy="' + getterCy.toFixed(1) + '" rx="' + (r * 0.55).toFixed(1) + '" ry="' + getterRy.toFixed(1) + '" fill="url(#lzGetter)" opacity="0.9"/>' +
        '<path d="M ' + (cx - r * 0.64).toFixed(1) + ' ' + (top + h * 0.17).toFixed(1) + ' Q ' + (cx - r * 0.8).toFixed(1) + ' ' + (top + h * 0.52).toFixed(1) + ' ' + (cx - r * 0.58).toFixed(1) + ' ' + (baseY - h * 0.1).toFixed(1) + '" stroke="#ffffff" stroke-width="' + (w * 0.09).toFixed(1) + '" fill="none" opacity="0.16" stroke-linecap="round"/>' +
        '<path d="M ' + (cx + r * 0.54).toFixed(1) + ' ' + (top + h * 0.22).toFixed(1) + ' Q ' + (cx + r * 0.66).toFixed(1) + ' ' + (top + h * 0.52).toFixed(1) + ' ' + (cx + r * 0.5).toFixed(1) + ' ' + (baseY - h * 0.12).toFixed(1) + '" stroke="#ffffff" stroke-width="' + (w * 0.05).toFixed(1) + '" fill="none" opacity="0.07" stroke-linecap="round"/>' +
        '</g>';
}

// 회로 계통별 동작 모델: 전압 증폭관, 출력관, 정류/전원, 출력 트랜스와 스피커 부하.
const AMP_CIRCUITS = {
    el34PushPull: {
        topology: "ultralinear-push-pull-ab",
        pre: { drive: 1, knee: .92, ceiling: .975, even: .004, body: .01, kind: "triode" },
        power: { drive: 1.08, knee: .78, ceiling: .94, even: .0015, body: .035, crossover: .0003, kind: "pentode" },
        sag: { threshold: -13, knee: 14, ratio: 1.38, attack: .01, release: .26 },
        transformer: { low: 28, lowQ: .72, high: 21000, highQ: .72 },
        damping: { factor: 8, bass: [72, 1, 1.02], high: [4500, .3] }
    },
    triode300bSE: {
        topology: "single-ended-triode-a",
        pre: { drive: 1, knee: .94, ceiling: .98, even: .008, body: .006, kind: "triode" },
        power: { drive: 1.06, knee: .82, ceiling: .95, even: .04, body: .018, crossover: 0, kind: "triode" },
        // 클래스 A는 평균 전류 변화가 작으므로 정류 새그보다 출력관의 비대칭 포화가 중심이다.
        sag: { threshold: -4, knee: 12, ratio: 1.04, attack: .02, release: .12 },
        transformer: { low: 38, lowQ: .72, high: 16500, highQ: .7 },
        damping: { factor: 2.5, bass: [68, 2.1, 1.08], high: [4200, .75] }
    },
    kt88UnityPushPull: {
        topology: "unity-coupled-push-pull-ab",
        pre: { drive: 1, knee: .95, ceiling: .98, even: .0015, body: .004, kind: "triode" },
        power: { drive: 1.04, knee: .88, ceiling: .965, even: .0005, body: .012, crossover: 0, kind: "beam" },
        sag: { threshold: -8, knee: 10, ratio: 1.14, attack: .004, release: .16 },
        transformer: { low: 18, lowQ: .707, high: 28000, highQ: .707 },
        damping: { factor: 15, bass: [65, .35, .86], high: [5200, .15] }
    },
    ma2375UnityCoupled: {
        topology: "kt88-unity-coupled-push-pull-ab-sgs",
        pre: { drive: .98, knee: .97, ceiling: .985, even: .001, body: .002, kind: "triode" },
        power: { drive: 1.01, knee: .93, ceiling: .975, even: .0004, body: .005, crossover: 0, kind: "beam" },
        // Power Guard SGS가 큰 피크에서만 빠르게 개입하는 동작을 완만한 보호 압축으로 근사한다.
        sag: { threshold: -3, knee: 8, ratio: 1.08, attack: .002, release: .12 },
        transformer: { low: 10, lowQ: .707, high: 50000, highQ: .707 },
        damping: { factor: 22, bass: [62, .12, .78], high: [5600, .08] }
    },
    sixL6PushPull: {
        topology: "6l6gc-push-pull-ab",
        pre: { drive: 1, knee: .92, ceiling: .975, even: .004, body: .012, kind: "triode" },
        power: { drive: 1.07, knee: .79, ceiling: .94, even: .003, body: .04, crossover: .0008, kind: "beam" },
        sag: { threshold: -13, knee: 16, ratio: 1.45, attack: .012, release: .32 },
        transformer: { low: 30, lowQ: .72, high: 19000, highQ: .7 },
        damping: { factor: 5, bass: [76, 1.4, 1.05], high: [4400, .4] }
    }
};

// ----- 앰프 (TR 2종 + 진공관 3종, 모델별 고유 회로 동작 · 실물 기반 섀시 뷰) -----
const AMP_MODELS = {
    tr: {
        pill: "TR · CA-100",
        desc: "솔리드스테이트 인티앰프 — 무색·투명, 높은 댐핑 (Yamaha CA-1000 오마주)",
        vol: { cx: 1770, cy: 326, r: 160 },
        drive: 1, k: 0, asym: 0, bass: [80, 0], lowMid: [250, -0.15, 0.8], mid: [1000, 0, 1], presence: [3000, 0.15, 0.9], treble: [8000, 0], out: 1
    },
    mc2105: {
        pill: "TR · MC2105",
        desc: "매킨토시 솔리드스테이트 — 블루 와트미터, 오토포머의 여유 (MC2105 오마주)",
        vol: { cx: 1000, cy: 442, r: 72 },
        drive: 1.05, k: 0.18, asym: 0.02, bass: [65, 1.2], lowMid: [220, 0.6, 0.75], mid: [900, 0.1, 1], presence: [3200, -0.3, 0.9], treble: [11000, 0.2], out: 0.94
    },
    el34: {
        pill: "EL34 · 8B",
        desc: "EL34 울트라리니어 푸시풀 — 3차 배음, 완만한 AB 클리핑과 중간 새그 (Marantz 8B 오마주)",
        vol: { cx: 690, cy: 406, r: 34 },
        drive: 2.2, k: 1.7, asym: 0.12, bass: [100, .4], lowMid: [320, .6, 0.8], mid: [1600, .7, 0.9], presence: [4000, -0.2, 1], treble: [8500, -.35], out: .92,
        circuit: AMP_CIRCUITS.el34PushPull
    },
    "300b": {
        pill: "300B · 91E",
        desc: "300B 싱글엔디드 클래스 A — 우세한 2차 배음, 비대칭 소프트 포화와 낮은 댐핑 (WE 91E 오마주)",
        vol: { cx: 880, cy: 420, r: 112 },
        drive: 2.8, k: 1.15, asym: 0.38, bass: [100, .3], lowMid: [300, .45, 0.72], mid: [800, .25, 0.8], presence: [3200, -.25, 0.9], treble: [7000, -.65], out: .90,
        circuit: AMP_CIRCUITS.triode300bSE
    },
    kt88: {
        pill: "KT88 · 275",
        desc: "KT88 유니티 커플드 푸시풀 — 높은 헤드룸, 낮은 배음과 강한 댐핑 (McIntosh MC275 오마주)",
        vol: { cx: 600, cy: 422, r: 32 },
        drive: 1.9, k: 1.45, asym: 0.08, bass: [80, .15], lowMid: [260, .1, 0.8], mid: [1200, -.1, 1], presence: [3800, .15, 0.9], treble: [10000, .25], out: .95,
        circuit: AMP_CIRCUITS.kt88UnityPushPull
    }
};

AMP_MODELS.tr.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="YAHAMA CA-100 솔리드스테이트 앰프">
    <defs>
        <linearGradient id="caWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset="0.5" stop-color="#66401f"/><stop offset="1" stop-color="#472a15"/></linearGradient>
        <linearGradient id="caFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f4"/><stop offset="0.12" stop-color="#dcdee4"/><stop offset="0.5" stop-color="#c6c8d0"/><stop offset="0.82" stop-color="#b2b4bc"/><stop offset="1" stop-color="#9a9ca6"/></linearGradient>
        <radialGradient id="caKnob" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="#f0f1f4"/><stop offset="0.34" stop-color="#c8cbd1"/><stop offset="0.68" stop-color="#969ba5"/><stop offset="0.88" stop-color="#686e79"/><stop offset="1" stop-color="#343943"/></radialGradient>
        <linearGradient id="caKnobRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#343841"/><stop offset=".18" stop-color="#d9dce2"/><stop offset=".42" stop-color="#777d88"/><stop offset=".68" stop-color="#eef0f3"/><stop offset="1" stop-color="#3d424b"/></linearGradient>
        <linearGradient id="caEtch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".48" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".52" stop-color="#30343c" stop-opacity=".08"/><stop offset="1" stop-color="#30343c" stop-opacity=".3"/></linearGradient>
        <radialGradient id="caMeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.6" stop-color="#f2e5bc"/><stop offset="1" stop-color="#dcCC9e"/></radialGradient>
        <radialGradient id="caShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <pattern id="caBrush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
        <pattern id="caWoodGrain" width="170" height="38" patternUnits="userSpaceOnUse"><path d="M-20 8 C24 -3 62 18 104 7 S172 5 210 15 M-12 27 C28 16 69 38 118 25 S177 22 210 31" fill="none" stroke="#e2aa74" stroke-width="1.7" opacity=".16"/><path d="M-10 18 C40 9 81 27 128 16 S183 14 218 24" fill="none" stroke="#241207" opacity=".3"/></pattern>
        <linearGradient id="caBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#d7d9df"/><stop offset=".82" stop-color="#8e919b"/><stop offset="1" stop-color="#676a72"/></linearGradient>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#caWood)"/>
    <rect width="2000" height="560" rx="8" fill="url(#caWoodGrain)"/>
    <rect x="0" y="3" width="2000" height="3" fill="#b8825a" opacity="0.5"/>
    <rect x="26" y="38" width="1948" height="496" rx="4" fill="url(#caFace)"/>
    <rect x="26" y="38" width="1948" height="496" rx="4" fill="url(#caBrush)"/>
    <rect x="31" y="43" width="1938" height="486" rx="3" fill="none" stroke="url(#caBezel)" stroke-width="2.2" opacity=".72"/>
    <rect x="26" y="38" width="1948" height="3" fill="#ffffff" opacity="0.5"/>
    <rect x="26" y="530" width="1948" height="4" fill="#000000" opacity="0.25"/>
    <path d="M48 119H1952 M48 506H1952" stroke="url(#caEtch)" stroke-width="2" opacity=".58"/>
    <circle cx="92" cy="96" r="16" fill="none" stroke="#3a3a42" stroke-width="2"/>
    <path d="M86 89 L86 100 M92 86 L92 100 M98 89 L98 100 M86 100 Q92 106 98 100" stroke="#3a3a42" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <text x="124" y="105" font-family="Arial" font-size="26" font-weight="700" letter-spacing="1.5" fill="#26262c">YAHAMA</text>
    <text x="296" y="103" font-family="Arial" font-size="16.5" font-weight="650" letter-spacing="2.35" fill="#41454e">NATURAL SOUND STEREO AMPLIFIER CA-100</text>
    <g>
        <ellipse cx="268" cy="392" rx="180" ry="22" fill="url(#caShadow)"/>
        <rect x="105" y="147" width="336" height="240" rx="10" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="100" y="140" width="336" height="240" rx="10" fill="#15151a"/>
        <rect x="103" y="141.5" width="330" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
        <rect x="103" y="143" width="330" height="234" rx="8" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <rect x="114" y="154" width="308" height="212" rx="5" fill="#16110b"/>
        <rect class="ampLamp" x="114" y="154" width="308" height="212" rx="5" fill="url(#lzWarmFace)" opacity="0.02"/>
        <ellipse class="ampLamp" cx="268" cy="175" rx="135" ry="50" fill="url(#lzLampPool)" opacity="0.02"/>
        <rect x="114" y="154" width="308" height="26" fill="url(#lzInset)" opacity="0.55"/>
        <path d="M 168 342 A 122 122 0 0 1 368 342" fill="none" stroke="#4a3a28" stroke-width="1.6"/>
        <path id="ca100RedL" d="M 329 306 A 122 122 0 0 1 368 342" fill="none" stroke="#c0392b" stroke-width="4.5" stroke-linecap="round"/>
        <g stroke="#4a3a28" stroke-width="1.5">
            <line x1="172" y1="336" x2="182" y2="345"/><line x1="204" y1="300" x2="212" y2="311"/><line x1="268" y1="282" x2="268" y2="295"/><line x1="332" y1="300" x2="324" y2="311"/><line x1="364" y1="336" x2="354" y2="345"/>
        </g>
        <text x="268" y="232" font-family="Arial" font-size="15.5" font-weight="700" letter-spacing="3" fill="#443522" text-anchor="middle">PEAK</text>
        <g font-family="Arial" font-size="12.5" font-weight="650" fill="#4f3e28" text-anchor="middle"><text x="182" y="330">-40</text><text x="212" y="299">-20</text><text x="268" y="278">0</text><text x="328" y="299">+2</text><text x="356" y="330">+3</text></g>
        <line id="ampVuL" data-cx="268" data-cy="352" x1="268" y1="352" x2="268" y2="212" stroke="#d4501e" stroke-width="3.5" transform="rotate(-42 268 352)"/>
        <circle cx="268" cy="352" r="9" fill="#1a1610"/>
        <polygon points="114,154 300,154 180,366 114,366" fill="url(#lzStreak)"/>
        <rect x="114" y="154" width="308" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="114" y="154" width="14" height="212" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="408" y="154" width="14" height="212" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="114" y="332.1" width="308" height="33.9" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="112" y="151" width="312" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="112" y="367" width="312" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="114" y="154" width="308" height="212" rx="5" fill="#0d0a06" opacity="0.55"/>
        <text x="268" y="408" font-family="Arial" font-size="13.5" font-weight="650" letter-spacing="3" fill="#41454e" text-anchor="middle">LEFT</text>
    </g>
    <g>
        <ellipse cx="640" cy="392" rx="180" ry="22" fill="url(#caShadow)"/>
        <rect x="477" y="147" width="336" height="240" rx="10" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="472" y="140" width="336" height="240" rx="10" fill="#15151a"/>
        <rect x="475" y="141.5" width="330" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
        <rect x="475" y="143" width="330" height="234" rx="8" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <rect x="486" y="154" width="308" height="212" rx="5" fill="#16110b"/>
        <rect class="ampLamp" x="486" y="154" width="308" height="212" rx="5" fill="url(#lzWarmFace)" opacity="0.02"/>
        <ellipse class="ampLamp" cx="640" cy="175" rx="135" ry="50" fill="url(#lzLampPool)" opacity="0.02"/>
        <rect x="486" y="154" width="308" height="26" fill="url(#lzInset)" opacity="0.55"/>
        <path d="M 540 342 A 122 122 0 0 1 740 342" fill="none" stroke="#4a3a28" stroke-width="1.6"/>
        <path id="ca100RedR" d="M 701 306 A 122 122 0 0 1 740 342" fill="none" stroke="#c0392b" stroke-width="4.5" stroke-linecap="round"/>
        <g stroke="#4a3a28" stroke-width="1.5">
            <line x1="544" y1="336" x2="554" y2="345"/><line x1="576" y1="300" x2="584" y2="311"/><line x1="640" y1="282" x2="640" y2="295"/><line x1="704" y1="300" x2="696" y2="311"/><line x1="736" y1="336" x2="726" y2="345"/>
        </g>
        <text x="640" y="232" font-family="Arial" font-size="15.5" font-weight="700" letter-spacing="3" fill="#443522" text-anchor="middle">PEAK</text>
        <g font-family="Arial" font-size="12.5" font-weight="650" fill="#4f3e28" text-anchor="middle"><text x="554" y="330">-40</text><text x="584" y="299">-20</text><text x="640" y="278">0</text><text x="700" y="299">+2</text><text x="728" y="330">+3</text></g>
        <line id="ampVuR" data-cx="640" data-cy="352" x1="640" y1="352" x2="640" y2="212" stroke="#d4501e" stroke-width="3.5" transform="rotate(-42 640 352)"/>
        <circle cx="640" cy="352" r="9" fill="#1a1610"/>
        <polygon points="486,154 672,154 552,366 486,366" fill="url(#lzStreak)"/>
        <rect x="486" y="154" width="308" height="34" fill="url(#lzInset)" opacity="0.62"/>
        <rect x="486" y="154" width="14" height="212" fill="url(#lzInL)" opacity="0.5"/>
        <rect x="780" y="154" width="14" height="212" fill="url(#lzInR)" opacity="0.5"/>
        <rect x="486" y="332.1" width="308" height="33.9" fill="url(#lzInBot)" opacity="0.55"/>
        <rect x="484" y="151" width="312" height="3" fill="#04050a" opacity="0.55"/>
        <rect x="484" y="367" width="312" height="2.5" fill="#ffffff" opacity="0.09"/>
        <rect class="meterDark" x="486" y="154" width="308" height="212" rx="5" fill="#0d0a06" opacity="0.55"/>
        <text x="640" y="408" font-family="Arial" font-size="13.5" font-weight="650" letter-spacing="3" fill="#41454e" text-anchor="middle">RIGHT</text>
    </g>
    <g font-family="Arial" font-size="15.5" font-weight="650" letter-spacing="1.5" fill="#3f434c" text-anchor="middle">
        <text x="920" y="160">MODE</text><text x="1090" y="160">PHONO</text><text x="1260" y="160">REC OUT</text><text x="1430" y="160">INPUT</text>
    </g>
    <g font-family="Arial" font-size="10.5" font-weight="650" letter-spacing="1.2" fill="#626670" text-anchor="middle">
        <text x="920" y="286">COUPLED · NORMAL</text><text x="1090" y="286">MM · MC</text><text x="1260" y="286">SOURCE · TAPE</text><text x="1430" y="286">AUX · TUNER</text>
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
    <g font-family="Arial" font-size="15.5" font-weight="650" letter-spacing="1.5" fill="#3f434c" text-anchor="middle">
        <text x="920" y="352">POWER</text><text x="1058" y="352">PHONES</text><text x="1196" y="352">BASS</text><text x="1356" y="352">TREBLE</text>
    </g>
    <circle id="ampPwrLed" cx="884" cy="404" r="6" fill="#3a2012"/>
    <ellipse cx="928" cy="458" rx="22" ry="7" fill="url(#caShadow)"/>
    <rect x="906" y="368" width="26" height="88" rx="7" fill="#1c1c22"/><rect x="908" y="370" width="22" height="43" rx="5" fill="#2a2a32"/><rect x="911" y="374" width="16" height="35" rx="4" fill="url(#caKnob)"/>
    <circle cx="1058" cy="412" r="18" fill="#101014"/><circle cx="1058" cy="412" r="15" fill="#1e1e26"/><circle cx="1058" cy="412" r="7" fill="#050507"/>
    <ellipse cx="1196" cy="452" rx="44" ry="12" fill="url(#caShadow)"/>
    <circle cx="1200.0" cy="419.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1196" cy="412" r="40" fill="url(#caKnob)" stroke="#8a8c96" stroke-width="1.5"/><path d="M 1167.2 392.0 A 35.2 35.2 0 0 1 1200.8 377.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
    <circle cx="1196" cy="412" r="36" fill="url(#lzKnurl)" opacity=".3"/>
    <circle cx="1196" cy="412" r="40" fill="none" stroke="#6e707a" stroke-width="5" stroke-dasharray="1.8 5.5" opacity="0.5"/>
    <rect x="1193" y="376" width="6" height="18" rx="3" fill="#3a3a42"/>
    <ellipse cx="1184" cy="398" rx="13" ry="10" fill="#ffffff" opacity="0.4"/>
    <ellipse cx="1356" cy="452" rx="44" ry="12" fill="url(#caShadow)"/>
    <circle cx="1360.0" cy="419.2" r="40.8" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1356" cy="412" r="40" fill="url(#caKnob)" stroke="#8a8c96" stroke-width="1.5"/><path d="M 1327.2 392.0 A 35.2 35.2 0 0 1 1360.8 377.6" stroke="#ffffff" stroke-width="2.4" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
    <circle cx="1356" cy="412" r="36" fill="url(#lzKnurl)" opacity=".3"/>
    <circle cx="1356" cy="412" r="40" fill="none" stroke="#6e707a" stroke-width="5" stroke-dasharray="1.8 5.5" opacity="0.5"/>
    <rect x="1353" y="376" width="6" height="18" rx="3" fill="#3a3a42"/>
    <ellipse cx="1344" cy="398" rx="13" ry="10" fill="#ffffff" opacity="0.4"/>
    <text x="1770" y="160" font-family="Arial" font-size="14.5" font-weight="650" letter-spacing="2.2" fill="#3d414a" text-anchor="middle">VOLUME &#183; BALANCE</text>
    <ellipse cx="1770" cy="475" rx="160" ry="30" fill="url(#caShadow)"/>
    <circle cx="1770" cy="330" r="151" fill="url(#caKnobRim)"/>
    <circle cx="1784.6" cy="352.3" r="148.9" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="1770" cy="326" r="146" fill="url(#caKnob)" stroke="#9a9ca6" stroke-width="2"/><path d="M 1664.9 253.0 A 128.5 128.5 0 0 1 1787.5 200.4" stroke="#ffffff" stroke-width="8.8" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
    <circle cx="1770" cy="326" r="135" fill="url(#lzKnurl)" opacity=".28"/>
    <circle cx="1770" cy="326" r="112" fill="url(#caKnob)" stroke="#59606b" stroke-width="2.2"/>
    <circle cx="1770" cy="326" r="96" fill="none" stroke="#eef0f3" stroke-width="1.4" opacity=".36"/>
    <circle cx="1770" cy="326" r="146" fill="none" stroke="#6e707a" stroke-width="12" stroke-dasharray="2.5 8" opacity="0.45"/>
    <circle cx="1770" cy="326" r="104" fill="none" stroke="#b6b8c0" stroke-width="1.2" opacity="0.7"/>
    <circle id="ampVolMark" cx="1770" cy="206" r="8" fill="#3a3a42"/>
    <ellipse cx="1712" cy="262" rx="54" ry="40" fill="#ffffff" opacity="0.35" pointer-events="none"/>
    <g font-family="Arial" font-size="11.5" font-weight="700" fill="#484c55" text-anchor="middle"><text x="1640" y="218">0</text><text x="1664" y="185">2</text><text x="1712" y="166">4</text><text x="1828" y="166">6</text><text x="1876" y="185">8</text><text x="1900" y="218">10</text></g>
    <path d="M842 318H1510" stroke="#747882" stroke-width="1.2" opacity=".42"/><g fill="#747882" opacity=".56"><circle cx="858" cy="318" r="3"/><circle cx="1494" cy="318" r="3"/></g>
    <text x="1176" y="315" font-family="Arial" font-size="10.5" font-weight="650" letter-spacing="2" fill="#555a64" text-anchor="middle">DC SERVO · DUAL MONO SIGNAL PATH</text>
    <text x="1500" y="510" font-family="Arial" font-size="13.5" font-weight="650" letter-spacing="2" fill="#4f535d" text-anchor="middle">CLASS A / AB · DIRECT COUPLED · S/N CA100-0724</text>
</svg>`;

        AMP_MODELS.mc2105.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntoch MC 2105 솔리드스테이트 앰프">
    <defs>
        <linearGradient id="m5Glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22252b"/><stop offset="0.055" stop-color="#111318"/><stop offset="0.48" stop-color="#0a0c10"/><stop offset="0.86" stop-color="#050609"/><stop offset="1" stop-color="#020304"/></linearGradient>
        <linearGradient id="m5Rail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#454b55"/><stop offset="0.17" stop-color="#f2f4f8"/><stop offset="0.39" stop-color="#939aa6"/><stop offset="0.66" stop-color="#eff1f5"/><stop offset="1" stop-color="#4b515b"/></linearGradient>
        <radialGradient id="m5Face" cx="0.5" cy="0.36" r="0.9"><stop offset="0" stop-color="#d4f6ff"/><stop offset="0.25" stop-color="#86dcff"/><stop offset="0.58" stop-color="#3ab5f2"/><stop offset="0.84" stop-color="#1385d8"/><stop offset="1" stop-color="#075ba3"/></radialGradient>
        <radialGradient id="m5Knob" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#5a606c"/><stop offset="0.35" stop-color="#2c3038"/><stop offset="1" stop-color="#0e1014"/></radialGradient>
        <radialGradient id="m5Shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <linearGradient id="m5MeterChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe5ec"/><stop offset=".12" stop-color="#535a65"/><stop offset=".5" stop-color="#1c2027"/><stop offset=".86" stop-color="#090b0f"/><stop offset="1" stop-color="#686f7a"/></linearGradient>
        <linearGradient id="m5GlassSweep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".12"/><stop offset=".16" stop-color="#ffffff" stop-opacity=".025"/><stop offset=".42" stop-color="#ffffff" stop-opacity="0"/><stop offset=".74" stop-color="#78d8ff" stop-opacity=".045"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
        <pattern id="m5Fine" width="10" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5H10 M0 4.5H10" stroke="#ffffff" stroke-width=".55" opacity=".024"/><path d="M0 2.5H10 M0 6.5H10" stroke="#000000" stroke-width=".6" opacity=".15"/></pattern>
        <pattern id="m5Knurl" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M1 0V7 M4.5 0V7" stroke="#bfc5ce" stroke-width=".9" opacity=".28"/><path d="M2.7 0V7 M6.2 0V7" stroke="#030406" stroke-width="1.1" opacity=".75"/></pattern>
        <filter id="m5BlueBloom" x="-35%" y="-50%" width="170%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
        <filter id="m5GreenBloom" x="-60%" y="-80%" width="220%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>
        <linearGradient id="m5Crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20252a"/><stop offset=".18" stop-color="#0d1115"/><stop offset=".72" stop-color="#05080a"/><stop offset="1" stop-color="#010304"/></linearGradient>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#m5Glass)"/>
    <rect width="2000" height="560" rx="8" fill="url(#m5Fine)" opacity=".86"/>
    <rect x="0" y="2" width="2000" height="3" fill="#ffffff" opacity="0.28"/>
    <rect x="0" y="0" width="26" height="560" rx="8" fill="url(#m5Rail)"/>
    <rect x="1974" y="0" width="26" height="560" rx="8" fill="url(#m5Rail)"/>
    <rect x="34" y="24" width="1932" height="512" rx="5" fill="none" stroke="#343840" stroke-width="2"/><rect x="39" y="29" width="1922" height="502" rx="4" fill="none" stroke="#030405" stroke-width="1.5"/>
    <rect x="58" y="64" width="26" height="448" rx="13" fill="#000000" opacity="0.5" filter="url(#lzSoft)"/><rect x="52" y="56" width="26" height="448" rx="13" fill="url(#m5Rail)"/>
    <rect x="1928" y="64" width="26" height="448" rx="13" fill="#000000" opacity="0.5" filter="url(#lzSoft)"/><rect x="1922" y="56" width="26" height="448" rx="13" fill="url(#m5Rail)"/>
    <path d="M60 70V490 M1930 70V490" stroke="#ffffff" stroke-width="3" opacity=".38"/><g fill="#15171b" stroke="#d9dde4" stroke-width="1.2"><circle cx="65" cy="70" r="7"/><circle cx="65" cy="490" r="7"/><circle cx="1935" cy="70" r="7"/><circle cx="1935" cy="490" r="7"/></g>
    <polygon points="88,30 720,30 470,530 88,530" fill="url(#m5GlassSweep)" opacity=".52"/>
    <!-- 블루 와트미터 (L) -->
    <g>
        <rect x="244" y="48" width="572" height="268" rx="14" fill="none" stroke="url(#m5MeterChrome)" stroke-width="5"/>
        <rect x="255" y="61" width="560" height="256" rx="10" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="250" y="54" width="560" height="256" rx="10" fill="#101014"/>
        <rect x="250" y="54" width="560" height="256" rx="10" fill="none" stroke="#3c4048" stroke-width="2"/>
        <rect x="253" y="55.5" width="554" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
        <rect x="262" y="66" width="536" height="232" rx="6" fill="#071019"/>
        <ellipse class="ampGlow" cx="530" cy="212" rx="238" ry="118" fill="#289fe8" opacity=".02" filter="url(#m5BlueBloom)"/>
        <rect class="ampLamp" x="262" y="66" width="536" height="232" rx="6" fill="url(#m5Face)" opacity="0.02"/>
        <path d="M 340 246 A 235 235 0 0 1 720 246" fill="none" stroke="#0b365e" stroke-width="2.5"/>
        <g stroke="#0b365e" stroke-width="2">
            <line x1="348" y1="240" x2="360" y2="250"/><line x1="398" y1="196" x2="408" y2="208"/><line x1="470" y1="168" x2="476" y2="182"/><line x1="530" y1="160" x2="530" y2="174"/><line x1="590" y1="168" x2="584" y2="182"/><line x1="662" y1="196" x2="652" y2="208"/><line x1="712" y1="240" x2="700" y2="250"/>
        </g>
        <line id="ampVuL" data-cx="530" data-cy="286" x1="530" y1="286" x2="530" y2="120" stroke="#0d1119" stroke-width="3.5" transform="rotate(-42 530 286)"/>
        <text x="530" y="112" font-family="Arial" font-size="19" font-weight="700" letter-spacing="4" fill="#082d52" text-anchor="middle">WATTS</text>
        <g font-family="Arial" font-size="14.5" font-weight="700" fill="#082d52">
            <text x="354" y="228">.2</text><text x="406" y="188">2.0</text><text x="522" y="154">20</text><text x="642" y="188">100</text><text x="686" y="228">200</text>
        </g>
        <g font-family="Arial" font-size="12.5" font-weight="650" fill="#0a3157">
            <text x="380" y="256">-50</text><text x="434" y="218">-30</text><text x="526" y="198">-10</text><text x="622" y="218">0</text>
        </g>
        <text x="530" y="267" font-family="Arial" font-size="12" font-weight="700" letter-spacing="2" fill="#092f55" stroke="#52c1ed" stroke-width="3" paint-order="stroke fill" text-anchor="middle">DECIBELS</text>
        <g font-family="Arial" font-size="15.5" font-weight="650" letter-spacing="3.4" fill="#082b4c" stroke="#43b6e8" stroke-width="3.5" paint-order="stroke fill">
            <text x="510" y="289" text-anchor="end">POWER</text><text x="550" y="289">OUTPUT</text>
        </g>
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
        <rect x="1184" y="48" width="572" height="268" rx="14" fill="none" stroke="url(#m5MeterChrome)" stroke-width="5"/>
        <rect x="1195" y="61" width="560" height="256" rx="10" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="1190" y="54" width="560" height="256" rx="10" fill="#101014"/>
        <rect x="1190" y="54" width="560" height="256" rx="10" fill="none" stroke="#3c4048" stroke-width="2"/>
        <rect x="1193" y="55.5" width="554" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
        <rect x="1202" y="66" width="536" height="232" rx="6" fill="#071019"/>
        <ellipse class="ampGlow" cx="1470" cy="212" rx="238" ry="118" fill="#289fe8" opacity=".02" filter="url(#m5BlueBloom)"/>
        <rect class="ampLamp" x="1202" y="66" width="536" height="232" rx="6" fill="url(#m5Face)" opacity="0.02"/>
        <path d="M 1280 246 A 235 235 0 0 1 1660 246" fill="none" stroke="#0b365e" stroke-width="2.5"/>
        <g stroke="#0b365e" stroke-width="2">
            <line x1="1288" y1="240" x2="1300" y2="250"/><line x1="1338" y1="196" x2="1348" y2="208"/><line x1="1410" y1="168" x2="1416" y2="182"/><line x1="1470" y1="160" x2="1470" y2="174"/><line x1="1530" y1="168" x2="1524" y2="182"/><line x1="1602" y1="196" x2="1592" y2="208"/><line x1="1652" y1="240" x2="1640" y2="250"/>
        </g>
        <line id="ampVuR" data-cx="1470" data-cy="286" x1="1470" y1="286" x2="1470" y2="120" stroke="#0d1119" stroke-width="3.5" transform="rotate(-42 1470 286)"/>
        <text x="1470" y="112" font-family="Arial" font-size="19" font-weight="700" letter-spacing="4" fill="#082d52" text-anchor="middle">WATTS</text>
        <g font-family="Arial" font-size="14.5" font-weight="700" fill="#082d52">
            <text x="1294" y="228">.2</text><text x="1346" y="188">2.0</text><text x="1462" y="154">20</text><text x="1582" y="188">100</text><text x="1626" y="228">200</text>
        </g>
        <g font-family="Arial" font-size="12.5" font-weight="650" fill="#0a3157">
            <text x="1320" y="256">-50</text><text x="1374" y="218">-30</text><text x="1466" y="198">-10</text><text x="1562" y="218">0</text>
        </g>
        <text x="1470" y="267" font-family="Arial" font-size="12" font-weight="700" letter-spacing="2" fill="#092f55" stroke="#52c1ed" stroke-width="3" paint-order="stroke fill" text-anchor="middle">DECIBELS</text>
        <g font-family="Arial" font-size="15.5" font-weight="650" letter-spacing="3.4" fill="#082b4c" stroke="#43b6e8" stroke-width="3.5" paint-order="stroke fill">
            <text x="1450" y="289" text-anchor="end">POWER</text><text x="1490" y="289">OUTPUT</text>
        </g>
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
    <rect x="846" y="86" width="308" height="158" rx="9" fill="#000000" opacity=".58" filter="url(#lzSoft)"/>
    <rect x="842" y="82" width="316" height="158" rx="9" fill="url(#m5Crest)" stroke="#3b444b" stroke-width="1.6"/>
    <rect x="848" y="88" width="304" height="146" rx="6" fill="none" stroke="#3fe373" stroke-width="1" opacity=".22"/>
    <ellipse cx="1000" cy="164" rx="120" ry="58" fill="#35d96b" opacity=".055" filter="url(#m5GreenBloom)" pointer-events="none"/>
    <path d="M884 110H1116 M884 226H1116" stroke="#3fe373" stroke-width="1.2" opacity=".28"/>
    <text class="ampLegend" x="1000" y="146" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="47" font-weight="700" fill="#4aee80" text-anchor="middle">McIntoch</text>
    <text class="ampLegend" x="1000" y="188" font-family="Arial" font-size="20.5" font-weight="700" letter-spacing="7" fill="#43e979" text-anchor="middle">MC 2105</text>
    <text class="ampLegend" x="1000" y="215" font-family="Arial" font-size="12.5" font-weight="650" letter-spacing="2" fill="#35c865" text-anchor="middle">SOLID STATE POWER AMPLIFIER</text>
    <!-- 하단 컨트롤 행 -->
    <g class="ampLegend" font-family="Arial" font-size="15.5" font-weight="700" letter-spacing="1.6" fill="#49e77e" text-anchor="middle">
        <text x="290" y="382">POWER</text><text x="560" y="382">L GAIN</text><text x="1000" y="382">GAIN</text><text x="1440" y="382">R GAIN</text><text x="1710" y="382">SPEAKERS</text>
    </g>
    <circle cx="290" cy="436" r="18" fill="url(#m5MeterChrome)"/>
    <circle cx="290" cy="436" r="14" fill="#8a6a2a"/>
    <circle id="ampPwrLed" cx="290" cy="436" r="9" fill="#3a2012"/>
    <ellipse cx="560" cy="486" rx="36" ry="10" fill="url(#m5Shadow)"/>
    <circle cx="560" cy="440" r="32" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2"/>
    <path d="M532 427 A34 34 0 0 1 588 427" fill="none" stroke="#8c96a3" stroke-width="3" stroke-dasharray="1.8 5" opacity=".78"/>
    <circle cx="560" cy="440" r="27" fill="url(#m5Knurl)" opacity=".56"/><circle cx="560" cy="440" r="19" fill="url(#m5Knob)"/>
    <path d="M 542 420 A 26 26 0 0 1 578 420" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>
    <rect x="557" y="412" width="6" height="16" rx="3" fill="#dce2ea"/>
    <ellipse cx="1000" cy="500" rx="66" ry="14" fill="url(#m5Shadow)"/>
    <circle cx="1000" cy="442" r="58" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2.5"/>
    <path d="M946 424 A61 61 0 0 1 1054 424" fill="none" stroke="#9ea7b3" stroke-width="3.5" stroke-dasharray="2 6" opacity=".74"/>
    <circle cx="1000" cy="442" r="51" fill="url(#m5Knurl)" opacity=".58"/><circle cx="1000" cy="442" r="37" fill="url(#m5Knob)" stroke="#545a64" stroke-width="1"/>
    <path d="M 966 410 A 47 47 0 0 1 1034 410" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.35"/>
    <circle cx="1000" cy="442" r="58" fill="none" stroke="#3a3e46" stroke-width="6" stroke-dasharray="2 6" opacity="0.6"/>
    <circle id="ampVolMark" cx="1000" cy="392" r="6" fill="#dce2ea"/>
    <ellipse cx="1440" cy="486" rx="36" ry="10" fill="url(#m5Shadow)"/>
    <circle cx="1440" cy="440" r="32" fill="url(#m5Knob)" stroke="#9aa0ac" stroke-width="2"/>
    <path d="M1412 427 A34 34 0 0 1 1468 427" fill="none" stroke="#8c96a3" stroke-width="3" stroke-dasharray="1.8 5" opacity=".78"/>
    <circle cx="1440" cy="440" r="27" fill="url(#m5Knurl)" opacity=".56"/><circle cx="1440" cy="440" r="19" fill="url(#m5Knob)"/>
    <path d="M 1422 420 A 26 26 0 0 1 1458 420" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>
    <rect x="1437" y="412" width="6" height="16" rx="3" fill="#dce2ea"/>
    <ellipse cx="1712" cy="486" rx="24" ry="8" fill="url(#m5Shadow)"/>
    <rect x="1696" y="400" width="28" height="80" rx="7" fill="#1c1c22"/><rect x="1699" y="404" width="22" height="34" rx="4" fill="#b8bcc6"/>
    <rect x="1703" y="408" width="14" height="25" rx="3" fill="url(#m5Rail)" opacity=".8"/>
    <g class="ampLegend" font-family="Arial" font-size="11.5" font-weight="650" letter-spacing="1.4" fill="#2fae58" text-anchor="middle"><text x="560" y="506">LEFT AUTOFORMER TRIM</text><text x="1000" y="522">0 · 2 · 4 · 8 · 16 Ω</text><text x="1440" y="506">RIGHT AUTOFORMER TRIM</text><text x="1710" y="501">1 · 2</text></g>
    <path d="M230 516H820 M1180 516H1770" stroke="#343a42" stroke-width="1.4"/><text class="ampLegend" x="1000" y="548" font-family="Arial" font-size="14" font-weight="650" letter-spacing="2.4" fill="#35c865" text-anchor="middle">105 WATTS PER CHANNEL · AUTOFORMER COUPLED · S/N 21-05-7841</text>
</svg>`;

AMP_MODELS.el34.svg = `<svg class="amp-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Maranz 8B EL34 진공관 앰프">
    <defs>
        <linearGradient id="m8Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0e7cd"/><stop offset=".08" stop-color="#ded4b9"/><stop offset="0.5" stop-color="#c9bea0"/><stop offset=".84" stop-color="#aba185"/><stop offset="1" stop-color="#8f866f"/></linearGradient>
        <linearGradient id="m8Win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1812"/><stop offset="1" stop-color="#0b0906"/></linearGradient>
        <linearGradient id="m8Glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#211d16" stop-opacity="0.9"/><stop offset="0.3" stop-color="#5c5644" stop-opacity="0.45"/><stop offset="0.55" stop-color="#8a8168" stop-opacity="0.25"/><stop offset="1" stop-color="#171310" stop-opacity="0.92"/></linearGradient>
        <linearGradient id="m8Can" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#08080a"/><stop offset="0.35" stop-color="#22222a"/><stop offset="0.5" stop-color="#32323c"/><stop offset="0.7" stop-color="#1a1a22"/><stop offset="1" stop-color="#050507"/></linearGradient>
        <radialGradient id="m8MeterFace" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#fdf4d8"/><stop offset="0.65" stop-color="#f0e3ba"/><stop offset="1" stop-color="#d8ca9c"/></radialGradient>
        <radialGradient id="m8Shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="m8Glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
        <pattern id="m8Brush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
        <linearGradient id="m8Edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9e7"/><stop offset=".18" stop-color="#c9b88e"/><stop offset=".78" stop-color="#766a4f"/><stop offset="1" stop-color="#e6d6ae"/></linearGradient>
        <pattern id="m8Fine" width="13" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H13 M0 3.5H13 M0 6.5H13" stroke="#ffffff" stroke-width=".55" opacity=".05"/><path d="M0 2H13 M0 5H13" stroke="#4a3d2a" stroke-width=".45" opacity=".08"/></pattern>
        <linearGradient id="m8Plaque" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead0" stop-opacity=".54"/><stop offset=".5" stop-color="#b9ad91" stop-opacity=".2"/><stop offset="1" stop-color="#655c49" stop-opacity=".32"/></linearGradient>
    </defs>
    <rect width="2000" height="540" rx="8" fill="url(#m8Face)"/>
    <rect width="2000" height="540" rx="8" fill="url(#m8Brush)"/>
    <rect width="2000" height="540" rx="8" fill="url(#m8Fine)" opacity=".65"/>
    <rect x="0" y="2" width="2000" height="3" fill="#fff8e8" opacity="0.55"/>
    <rect x="40" y="40" width="1920" height="234" rx="8" fill="url(#m8Win)" stroke="#0a0906" stroke-width="2.5"/>
    <rect x="34" y="34" width="1932" height="246" rx="11" fill="none" stroke="url(#m8Edge)" stroke-width="4"/>
    <ellipse class="ampGlow" cx="640" cy="180" rx="240" ry="90" fill="url(#lzLamp)" opacity="0.1" filter="url(#m8Glow)"/>
    <ellipse class="ampGlow" cx="1370" cy="180" rx="240" ry="90" fill="url(#lzLamp)" opacity="0.1" filter="url(#m8Glow)"/>
    <g>
        <rect x="94" y="76" width="252" height="192" rx="10" fill="#000000" opacity=".5" filter="url(#lzSoft)"/><rect x="86" y="66" width="252" height="192" rx="10" fill="url(#m8Can)"/>
        <rect x="100" y="76" width="8" height="172" rx="4" fill="#3c3c46" opacity="0.6"/>
        <rect x="86" y="66" width="252" height="8" rx="4" fill="#2e2e38"/>
        <rect x="1670" y="76" width="252" height="192" rx="10" fill="#000000" opacity=".5" filter="url(#lzSoft)"/><rect x="1662" y="66" width="252" height="192" rx="10" fill="url(#m8Can)"/>
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
    <polygon points="1340,42 1956,42 1956,270 1660,270" fill="url(#lzGlassSweep)" opacity=".35"/>
    <g font-family="Arial" text-anchor="middle" fill="#918879">
        <text x="212" y="160" font-size="15" font-weight="700" letter-spacing="2.4">OUTPUT</text><text x="212" y="184" font-size="11.5" font-weight="650" letter-spacing="1.6">TRANSFORMER · L</text>
        <text x="1788" y="160" font-size="15" font-weight="700" letter-spacing="2.4">OUTPUT</text><text x="1788" y="184" font-size="11.5" font-weight="650" letter-spacing="1.6">TRANSFORMER · R</text>
    </g>
    <g font-family="Arial" font-size="10.5" font-weight="700" letter-spacing="1.6" fill="#9e9175" text-anchor="middle"><text x="630" y="268">EL34 · PUSH</text><text x="1026" y="268">12AU7 / 12BH7 DRIVER</text><text x="1370" y="268">EL34 · PULL</text></g>
    <rect x="40" y="280" width="1920" height="3" fill="#c8a860" opacity="0.5"/>
    <rect x="38" y="286" width="1924" height="244" rx="4" fill="none" stroke="#7f745e" stroke-width="1.5" opacity=".55"/>
    <g>
        <ellipse cx="252" cy="486" rx="100" ry="16" fill="url(#m8Shadow)"/>
        <circle cx="257" cy="418" r="82" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/><circle cx="250" cy="408" r="82" fill="#15151a"/>
        <path d="M 192 373 A 81 81 0 0 1 308 373" stroke="#ffffff" stroke-width="2" opacity="0.14" fill="none"/>
        <circle cx="250" cy="406" r="78" fill="none" stroke="#3c3e46" stroke-width="1.5"/>
        <circle cx="250" cy="406" r="68" fill="#16110b"/>
        <circle class="ampLamp" cx="250" cy="406" r="68" fill="url(#lzWarmFace)" opacity="0.02"/>
        <ellipse class="ampLamp" cx="250" cy="352" rx="56" ry="24" fill="url(#lzLampPool)" opacity="0.02"/>
        <path d="M 206 434 A 62 62 0 0 1 294 434" fill="none" stroke="#4a3a28" stroke-width="1.4" transform="rotate(180 250 420)"/>
        <g stroke="#4a3a28" stroke-width="1.3">
            <line x1="212" y1="430" x2="220" y2="437"/><line x1="230" y1="410" x2="236" y2="419"/><line x1="250" y1="402" x2="250" y2="413"/><line x1="270" y1="410" x2="264" y2="419"/><line x1="288" y1="430" x2="280" y2="437"/>
        </g>
        <g font-family="Arial" font-size="10.5" font-weight="700" fill="#5b4a32" text-anchor="middle"><text x="214" y="420">-10</text><text x="250" y="396">0</text><text x="286" y="420">+10</text></g>
        <line id="ampVuL" data-cx="250" data-cy="446" x1="250" y1="446" x2="250" y2="360" stroke="#d4501e" stroke-width="2.8" transform="rotate(-42 250 446)"/>
        <circle cx="250" cy="446" r="6" fill="#1a1610"/>
        <text x="250" y="470" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#655d4e" text-anchor="middle">BIAS</text>
        <polygon points="188,344 268,344 214,468 188,468" fill="url(#lzStreak)"/>
        <circle cx="250" cy="406" r="68" fill="url(#lzInCirc)"/>
        <circle cx="250" cy="406" r="69.5" fill="none" stroke="#04050a" stroke-width="3" opacity="0.45"/>
        <circle class="meterDark" cx="250" cy="406" r="68" fill="#0d0a06" opacity="0.55"/>
    </g>
    <circle cx="524" cy="398" r="13" fill="#8a7a5a"/>
    <circle id="ampPwrLed" cx="524" cy="398" r="8" fill="#3a2012"/>
    <ellipse cx="586" cy="446" rx="20" ry="7" fill="url(#m8Shadow)"/>
    <rect x="570" y="368" width="30" height="74" rx="7" fill="#26241f"/><rect x="574" y="374" width="22" height="28" rx="4" fill="#b0a488"/>
    <text x="560" y="474" font-family="Arial" font-size="15.5" font-weight="700" letter-spacing="2" fill="#4f483c" text-anchor="middle">POWER</text>
    <text x="524" y="352" font-family="Arial" font-size="10.5" font-weight="650" letter-spacing="1.3" fill="#645c4d" text-anchor="middle">STANDBY · OPERATE</text>
    <ellipse cx="690" cy="438" rx="30" ry="9" fill="url(#m8Shadow)"/>
    <circle cx="690" cy="408" r="27" fill="#8a8068"/>
    <circle cx="692.5" cy="410.5" r="25.5" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="690" cy="406" r="25" fill="url(#m8MeterFace)" stroke="#8a8068" stroke-width="1.4"/><path d="M 672.0 393.5 A 22.0 22.0 0 0 1 693.0 384.5" stroke="#ffffff" stroke-width="1.6" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
    <circle cx="690" cy="406" r="20" fill="url(#lzKnurl)" opacity=".22"/>
    <rect id="ampVolMark" x="688" y="384" width="4" height="12" rx="2" fill="#3a3226"/>
    <text x="690" y="474" font-family="Arial" font-size="15.5" font-weight="700" letter-spacing="2" fill="#4f483c" text-anchor="middle">LEVEL</text>
    <path d="M662 400 A30 30 0 0 1 718 400" fill="none" stroke="#746b58" stroke-width="2.5" stroke-dasharray="1.4 4.5" opacity=".75"/>
    <rect x="866" y="368" width="268" height="76" rx="8" fill="#14120e"/>
    <rect x="869" y="371" width="262" height="70" rx="6" fill="none" stroke="#3a362c" stroke-width="1.4"/>
    <text x="1000" y="418" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" font-weight="700" fill="#f0ecd8" text-anchor="middle">maranz</text>
    <rect x="1190" y="354" width="506" height="94" rx="7" fill="url(#m8Plaque)" stroke="#8d8068" stroke-width="1.2" opacity=".72"/>
    <rect x="1196" y="360" width="494" height="82" rx="5" fill="none" stroke="#fff8e2" stroke-width="1" opacity=".34"/>
    <text x="1660" y="396" font-family="Arial" font-size="18.5" font-weight="700" letter-spacing="2.6" fill="#3f392f" text-anchor="end">MODEL 8B &#183; STEREO POWER AMPLIFIER</text>
    <text x="1660" y="426" font-family="Arial" font-size="14" font-weight="650" letter-spacing="1.55" fill="#564e41" text-anchor="end">ULTRALINEAR PUSH-PULL · 35 WATTS / CHANNEL</text>
    <g fill="#26241f">
        <circle cx="1700" cy="470" r="9"/><circle cx="1740" cy="470" r="9"/><circle cx="1780" cy="470" r="9"/><circle cx="1820" cy="470" r="9"/>
    </g>
    <g font-family="Arial" font-size="10.5" font-weight="700" fill="#4e473a" text-anchor="middle"><text x="1700" y="454">COM</text><text x="1740" y="454">4 Ω</text><text x="1780" y="454">8 Ω</text><text x="1820" y="454">16 Ω</text></g>
    <g fill="url(#m8Edge)" stroke="#625842" stroke-width="1"><circle cx="1830" cy="350" r="8"/><circle cx="1870" cy="350" r="8"/></g>
    <text x="1850" y="390" font-family="Arial" font-size="13.5" font-weight="700" letter-spacing="1.5" fill="#50483b" text-anchor="middle">TEST POINTS</text>
    <path d="M820 494H1240" stroke="#736956" stroke-width="1.3" opacity=".56"/><text x="1030" y="490" font-family="Arial" font-size="10.5" font-weight="650" letter-spacing="1.7" fill="#5f5748" text-anchor="middle">CHANNEL A · BIAS NULL · CHANNEL B</text>
    <text x="1540" y="514" font-family="Arial" font-size="13.5" font-weight="650" letter-spacing="2" fill="#554e42" text-anchor="middle">HAND-WIRED · SERIAL 8B-34018</text>
</svg>`;

AMP_MODELS["300b"].svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Western Eletric 91E 300B 앰프">
    <defs>
        <linearGradient id="weFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eee8d8"/><stop offset=".08" stop-color="#dcd5c2"/><stop offset="0.5" stop-color="#c7bea7"/><stop offset=".84" stop-color="#a79e87"/><stop offset="1" stop-color="#8b826e"/></linearGradient>
        <linearGradient id="weWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191510"/><stop offset="1" stop-color="#0a0805"/></linearGradient>
        <linearGradient id="weGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2016" stop-opacity="0.85"/><stop offset="0.32" stop-color="#6e5c42" stop-opacity="0.4"/><stop offset="0.55" stop-color="#96805c" stop-opacity="0.22"/><stop offset="1" stop-color="#1d150c" stop-opacity="0.92"/></linearGradient>
        <radialGradient id="weKnob" cx="0.4" cy="0.32" r="0.95"><stop offset="0" stop-color="#f6f2e6"/><stop offset="0.5" stop-color="#cfc7b0"/><stop offset="0.85" stop-color="#a39b84"/><stop offset="1" stop-color="#7e765f"/></radialGradient>
        <radialGradient id="weShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.4"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="weGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>
        <pattern id="weMesh" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.8" fill="#8a8270"/></pattern>
        <pattern id="weBrush" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.05"/></pattern>
        <linearGradient id="weEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset=".2" stop-color="#d4cbb6"/><stop offset=".8" stop-color="#766d5b"/><stop offset="1" stop-color="#e3dac7"/></linearGradient>
        <pattern id="weFine" width="12" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H12 M0 3.5H12 M0 6.5H12" stroke="#ffffff" stroke-width=".55" opacity=".045"/><path d="M0 2H12 M0 5H12" stroke="#352b1d" stroke-width=".45" opacity=".07"/></pattern>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#weFace)"/>
    <rect width="2000" height="560" rx="8" fill="url(#weBrush)"/>
    <rect width="2000" height="560" rx="8" fill="url(#weFine)" opacity=".7"/>
    <rect x="0" y="2" width="2000" height="3" fill="#fff8e8" opacity="0.55"/>
    <rect x="40" y="40" width="1920" height="222" rx="8" fill="url(#weWin)" stroke="#0a0906" stroke-width="2.5"/>
    <rect x="34" y="34" width="1932" height="234" rx="11" fill="none" stroke="url(#weEdge)" stroke-width="4"/>
    <ellipse class="ampGlow" cx="1400" cy="165" rx="280" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#weGlow)"/>
    <g>
        <circle cx="250" cy="150" r="74" fill="#0d0c0a" stroke="#7e765f" stroke-width="3"/>
        <circle cx="250" cy="150" r="64" fill="url(#weMesh)"/>
        <circle cx="250" cy="150" r="26" fill="#17140f" stroke="#817761" stroke-width="2"/><circle cx="250" cy="150" r="8" fill="#050504"/>
        <circle cx="250" cy="150" r="64" fill="url(#lzVign)"/>
        <circle cx="460" cy="150" r="74" fill="#0d0c0a" stroke="#7e765f" stroke-width="3"/>
        <circle cx="460" cy="150" r="64" fill="url(#weMesh)"/>
        <circle cx="460" cy="150" r="26" fill="#17140f" stroke="#817761" stroke-width="2"/><circle cx="460" cy="150" r="8" fill="#050504"/>
        <circle cx="460" cy="150" r="64" fill="url(#lzVign)"/>
    </g>
    <rect x="700" y="58" width="240" height="188" rx="5" fill="#cfc8b4"/>
    <rect x="700" y="58" width="240" height="188" rx="5" fill="url(#weBrush)"/>
    <rect x="700" y="58" width="240" height="10" fill="#ffffff" opacity="0.25"/>
    <rect x="694" y="52" width="252" height="200" rx="8" fill="none" stroke="url(#weEdge)" stroke-width="3"/>
    <text x="820" y="140" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="25" font-weight="700" fill="#4a4436" text-anchor="middle">Western Eletric</text>
    <text x="820" y="188" font-family="Arial" font-size="30" letter-spacing="7" fill="#847c66" text-anchor="middle">91E</text>
    ${tubeSvg(1300, 240, 96, 195, "balloon")}
    ${tubeSvg(1500, 240, 96, 195, "balloon")}
    ${tubeSvg(1664, 242, 46, 114, "power")}
    <rect class="tubeDark" x="42" y="42" width="1916" height="218" rx="7" fill="#050403" opacity="0.72"/>
    <rect x="40" y="40" width="1920" height="18" fill="url(#lzInset)" opacity="0.85"/>
    <polygon points="40,40 720,40 300,262 40,262" fill="url(#lzStreak)"/>
    <polygon points="1330,42 1958,42 1958,260 1680,260" fill="url(#lzGlassSweep)" opacity=".36"/>
    <rect x="60" y="268" width="1880" height="22" rx="11" fill="url(#weKnob)"/>
    <rect x="64" y="279" width="1872" height="10" rx="5" fill="#000000" opacity=".25" filter="url(#lzSoft)"/>
    <rect x="60" y="270" width="1880" height="5" rx="2.5" fill="#ffffff" opacity="0.5"/>
    <rect x="120" y="294" width="1760" height="12" rx="6" fill="url(#weKnob)" opacity="0.75"/>
    <g font-family="Arial" font-size="13" font-weight="650" letter-spacing="1.2" fill="#5e5648">
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
    <rect x="425" y="329" width="200" height="200" rx="8" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>
        <rect x="420" y="322" width="200" height="200" rx="8" fill="#15130f"/>
        <rect x="423" y="323.5" width="194" height="2.5" rx="1" fill="#ffffff" opacity="0.16"/>
    <rect x="428" y="330" width="184" height="184" rx="4" fill="#1a150e"/>
    <rect class="ampLamp" x="428" y="330" width="184" height="184" rx="4" fill="url(#lzWarmFace)" opacity="0.02"/>
    <ellipse class="ampLamp" cx="520" cy="348" rx="80" ry="44" fill="url(#lzLampPool)" opacity="0.02"/>
    <rect x="428" y="330" width="184" height="22" fill="url(#lzInset)" opacity="0.4"/>
    <path d="M 434.4 404.9 A 128 128 0 0 1 605.6 404.9" fill="none" stroke="#4a3a28" stroke-width="1.6"/>
    <path d="M 574.1 384 A 128 128 0 0 1 605.6 404.9" fill="none" stroke="#c0392b" stroke-width="4"/>
    <g stroke="#4a3a28" stroke-width="1.4">
        <line x1="434.4" y1="404.9" x2="442.4" y2="413.8"/><line x1="459.9" y1="387" x2="465.6" y2="397.6"/><line x1="489" y1="375.8" x2="491.9" y2="387.4"/><line x1="520" y1="372" x2="520" y2="384"/><line x1="551" y1="375.8" x2="548.1" y2="387.4"/><line x1="580.1" y1="387" x2="574.4" y2="397.6"/><line x1="605.6" y1="404.9" x2="597.6" y2="413.8"/>
    </g>
    <text x="520" y="360" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#4a3a28" text-anchor="middle" opacity="0.85">VU</text>
    <text x="443" y="426" font-family="Arial" font-size="11" font-weight="650" fill="#4a3a28" opacity="0.85">-20</text>
    <text x="588" y="426" font-family="Arial" font-size="11" font-weight="650" fill="#8a2020" opacity="0.9">+3</text>
    <line id="ampVuL" data-cx="520" data-cy="500" x1="520" y1="500" x2="520" y2="378" stroke="#2a2018" stroke-width="2.6" transform="rotate(-42 520 500)"/>
    <circle cx="520" cy="500" r="7" fill="#241c12"/>
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
    <circle cx="890.4" cy="438.7" r="106.1" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/><circle cx="880" cy="420" r="104" fill="url(#weKnob)" stroke="#a49d87" stroke-width="2"/><path d="M 805.1 368.0 A 91.5 91.5 0 0 1 892.5 330.6" stroke="#ffffff" stroke-width="6.2" opacity="0.3" fill="none" stroke-linecap="round" pointer-events="none"/>
    <circle cx="880" cy="420" r="94" fill="url(#lzKnurl)" opacity=".28"/>
    <circle cx="880" cy="420" r="104" fill="none" stroke="#847c66" stroke-width="8" stroke-dasharray="2 6" opacity="0.4"/>
    <circle cx="880" cy="420" r="76" fill="none" stroke="#b8b09a" stroke-width="1.4" opacity="0.7"/>
    <circle cx="880" cy="420" r="52" fill="url(#weKnob)"/>
    <circle id="ampVolMark" cx="880" cy="330" r="7" fill="#55504a"/>
    <ellipse cx="838" cy="376" rx="36" ry="28" fill="#ffffff" opacity="0.35" pointer-events="none"/>
    <text x="1120" y="360" font-family="Arial" font-size="16" font-weight="700" letter-spacing="2.2" fill="#50493e">91E &#183; 300B SINGLE-ENDED TRIODE</text>
    <text x="1120" y="386" font-family="Arial" font-size="12.5" font-weight="600" letter-spacing="1.6" fill="#706756">CLASS A · DIRECT HEATED · ZERO FEEDBACK</text>
    <circle cx="1120" cy="420" r="14" fill="#8a7a5a"/>
    <circle id="ampPwrLed" cx="1120" cy="420" r="8" fill="#3a2012"/>
    <text x="1146" y="425" font-family="Arial" font-size="11" letter-spacing="1" fill="#6b6252">I/O</text>
    <circle cx="1230" cy="420" r="15" fill="#15130f"/><circle cx="1230" cy="420" r="6" fill="#050505"/>
    <text x="1256" y="425" font-family="Arial" font-size="11" letter-spacing="1" fill="#6b6252">PHONES</text>
    <g>
        <rect x="1542" y="312" width="382" height="236" rx="10" fill="#716956" opacity=".34"/><rect x="1548" y="318" width="370" height="224" rx="7" fill="#252119" opacity=".28"/>
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
    <path d="M1548 316H1918 M1548 544H1918" stroke="url(#weEdge)" stroke-width="4"/>
    <text x="1390" y="518" font-family="Arial" font-size="12" font-weight="650" letter-spacing="1.8" fill="#6d6454" text-anchor="middle">8 Ω OUTPUT · S/N 91E-0300B</text>
</svg>`;

AMP_MODELS.kt88.svg = `<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntoch 275 KT88 진공관 파워앰프">
    <defs>
        <linearGradient id="mcChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f7fa"/><stop offset="0.16" stop-color="#d2d6de"/><stop offset="0.34" stop-color="#9aa0ac"/><stop offset="0.5" stop-color="#6e7480"/><stop offset="0.6" stop-color="#9aa0ac"/><stop offset="0.82" stop-color="#d8dbe2"/><stop offset="1" stop-color="#848a96"/></linearGradient>
        <radialGradient id="mcChromeTop" cx=".34" cy=".28" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="#d7dbe2"/><stop offset=".68" stop-color="#9197a2"/><stop offset="1" stop-color="#525762"/></radialGradient>
        <linearGradient id="mcWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101014"/><stop offset="1" stop-color="#060608"/></linearGradient>
        <linearGradient id="mcCan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050507"/><stop offset="0.32" stop-color="#24242c"/><stop offset="0.5" stop-color="#383842"/><stop offset="0.7" stop-color="#1a1a22"/><stop offset="1" stop-color="#030304"/></linearGradient>
        <linearGradient id="mcGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d288"/><stop offset="0.45" stop-color="#cfa04a"/><stop offset="1" stop-color="#8e6a26"/></linearGradient>
        <linearGradient id="mcGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c1c22" stop-opacity="0.88"/><stop offset="0.32" stop-color="#565662" stop-opacity="0.4"/><stop offset="0.55" stop-color="#8a8a98" stop-opacity="0.22"/><stop offset="1" stop-color="#12121a" stop-opacity="0.92"/></linearGradient>
        <radialGradient id="mcShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
        <filter id="mcGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
        <linearGradient id="mcEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#abb1bd"/><stop offset=".82" stop-color="#4b505a"/><stop offset="1" stop-color="#d7dae0"/></linearGradient>
        <pattern id="mcFine" width="12" height="6" patternUnits="userSpaceOnUse"><path d="M0 .5H12 M0 3.5H12" stroke="#ffffff" stroke-width=".6" opacity=".09"/><path d="M0 2H12 M0 5H12" stroke="#1f2229" stroke-width=".5" opacity=".08"/></pattern>
        <pattern id="mcKnurl" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><path d="M1 0V7 M4.5 0V7" stroke="#ffffff" stroke-width=".85" opacity=".32"/><path d="M2.8 0V7 M6.2 0V7" stroke="#3d424b" stroke-width="1" opacity=".52"/></pattern>
    </defs>
    <rect width="2000" height="560" rx="8" fill="url(#mcChrome)"/>
    <rect width="2000" height="560" rx="8" fill="url(#mcFine)" opacity=".65"/>
    <rect x="0" y="2" width="2000" height="4" fill="#ffffff" opacity="0.7"/>
    <rect x="40" y="40" width="1920" height="252" rx="8" fill="url(#mcWin)" stroke="#2a2a32" stroke-width="2.5"/>
    <rect x="34" y="34" width="1932" height="264" rx="11" fill="none" stroke="url(#mcEdge)" stroke-width="4"/>
    <ellipse class="ampGlow" cx="590" cy="195" rx="230" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#mcGlow)"/>
    <ellipse class="ampGlow" cx="1210" cy="195" rx="230" ry="85" fill="url(#lzLamp)" opacity="0.1" filter="url(#mcGlow)"/>
    <g>
        <rect x="138" y="72" width="270" height="222" rx="14" fill="#000000" opacity=".48" filter="url(#lzSoft)"/><rect x="130" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="130" y="62" width="270" height="8" rx="4" fill="#4a4a55"/><rect x="148" y="74" width="7" height="198" rx="3.5" fill="#666b76" opacity="0.65"/><text x="265" y="180" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2" fill="#565b65" text-anchor="middle">OUTPUT</text>
        <rect x="828" y="72" width="270" height="222" rx="14" fill="#000000" opacity=".48" filter="url(#lzSoft)"/><rect x="820" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="820" y="62" width="270" height="8" rx="4" fill="#4a4a55"/><rect x="838" y="74" width="7" height="198" rx="3.5" fill="#666b76" opacity="0.65"/><text x="955" y="180" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2" fill="#565b65" text-anchor="middle">POWER</text>
        <rect x="1508" y="72" width="270" height="222" rx="14" fill="#000000" opacity=".48" filter="url(#lzSoft)"/><rect x="1500" y="62" width="270" height="222" rx="14" fill="url(#mcCan)"/><rect x="1500" y="62" width="270" height="8" rx="4" fill="#4a4a55"/><rect x="1518" y="74" width="7" height="198" rx="3.5" fill="#666b76" opacity="0.65"/><text x="1635" y="180" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2" fill="#565b65" text-anchor="middle">OUTPUT</text>
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
    <polygon points="1340,42 1958,42 1958,290 1660,290" fill="url(#lzGlassSweep)" opacity=".36"/>
    <rect x="36" y="306" width="1928" height="232" rx="5" fill="none" stroke="#606671" stroke-width="1.6" opacity=".7"/>
    <g>
        <rect x="1478" y="352" width="384" height="150" rx="12" fill="#000000" opacity="0.3" transform="translate(6,8)"/>
        <rect x="1478" y="352" width="384" height="150" rx="12" fill="url(#mcGold)" stroke="#6e5420" stroke-width="2.5"/>
        <rect x="1484" y="358" width="372" height="138" rx="9" fill="none" stroke="#f6e2a8" stroke-width="1.5" opacity="0.8"/>
        <text x="1670" y="418" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" font-weight="700" fill="#1a1206" text-anchor="middle">McIntoch</text>
        <text x="1670" y="472" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" letter-spacing="12" fill="#1a1206" text-anchor="middle">275</text>
        <path d="M1510 380H1830 M1510 482H1830" stroke="#fff1b8" stroke-width="1" opacity=".45"/>
    </g>
    <g font-family="Arial" font-size="14" font-weight="650" letter-spacing="1.6" fill="#303640" text-anchor="middle">
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
    <circle cx="600" cy="422" r="19" fill="url(#mcKnurl)" opacity=".38"/><circle cx="600" cy="422" r="12" fill="url(#mcChromeTop)"/>
    <rect id="ampVolMark" x="598" y="402" width="4" height="11" rx="2" fill="#22222a"/>
    <text x="980" y="404" font-family="Arial" font-size="16" font-weight="700" letter-spacing="3" fill="#353b45" text-anchor="middle">MC 275 &#183; 75 WATTS PER CHANNEL &#183; KT88</text>
    <text x="980" y="434" font-family="Arial" font-size="12" font-weight="650" letter-spacing="2" fill="#555b65" text-anchor="middle">UNITY COUPLED OUTPUT · STEREO / MONO</text>
    <g fill="#22222a">
        <circle cx="640" cy="480" r="10"/><circle cx="680" cy="480" r="10"/><circle cx="720" cy="480" r="10"/><circle cx="760" cy="480" r="10"/><circle cx="800" cy="480" r="10"/><circle cx="840" cy="480" r="10"/><circle cx="880" cy="480" r="10"/><circle cx="920" cy="480" r="10"/>
    </g>
    <text x="980" y="512" font-family="Arial" font-size="12" font-weight="650" letter-spacing="2" fill="#555b65" text-anchor="middle">BIAS MONITOR · S/N MC275-2188</text>
</svg>`;
const AMP_ORDER = ["tr", "mc2105", "el34", "300b", "kt88"];
