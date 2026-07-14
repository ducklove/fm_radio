// 실물 하이파이 레퍼런스를 바탕으로 한 추가 컴포넌트 스킨.
// 사진을 포함하거나 트레이싱하지 않고, 전면 패널의 비례와 대표적인 조형 언어를
// 코드 기반 SVG로 다시 그린다. 출처와 관찰 포인트: docs/EQUIPMENT_REFERENCES.md

function mfaSvgKnob(cx, cy, r, id, face, mark) {
    const ridges = Array.from({ length: 28 }, (_, i) => {
        const a = i * Math.PI * 2 / 28;
        const x1 = (cx + Math.cos(a) * (r - 5)).toFixed(1);
        const y1 = (cy + Math.sin(a) * (r - 5)).toFixed(1);
        const x2 = (cx + Math.cos(a) * r).toFixed(1);
        const y2 = (cy + Math.sin(a) * r).toFixed(1);
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }).join("");
    return '<g' + (id ? ' id="' + id + '"' : '') + '>' +
        '<circle cx="' + (cx + 5) + '" cy="' + (cy + 7) + '" r="' + (r + 3) + '" fill="#000" opacity=".42" filter="url(#lzSoft)"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 2) + '" fill="#17181b" stroke="#050506" stroke-width="3"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + face + '" stroke="#a9a9aa" stroke-width="1.5"/>' +
        '<g stroke="#17181b" stroke-width="2.2" opacity=".82">' + ridges + '</g>' +
        (mark ? '<rect id="' + mark + '" x="' + (cx - 2) + '" y="' + (cy - r + 8) + '" width="4" height="' + Math.max(12, r * .24) + '" rx="2" fill="#e8e1cf"/>' : '') +
        '<ellipse cx="' + (cx - r * .28) + '" cy="' + (cy - r * .3) + '" rx="' + (r * .28) + '" ry="' + (r * .2) + '" fill="#fff" opacity=".12"/>' +
        '</g>';
}

function mfaSvgToggle(x, y, id, light) {
    return '<g>' +
        '<rect x="' + (x - 18) + '" y="' + (y - 27) + '" width="36" height="58" rx="5" fill="#090a0c" stroke="#575a60"/>' +
        '<rect id="' + id + '" x="' + (x - 11) + '" y="' + (y - 20) + '" width="22" height="30" rx="4" fill="' + (light || '#b8babd') + '"/>' +
        '<rect x="' + (x - 8) + '" y="' + (y - 17) + '" width="16" height="5" rx="2" fill="#fff" opacity=".4" pointer-events="none"/>' +
        '</g>';
}

function mfaMeter(x, y, w, h, needleId, label, face, digital) {
    if (digital) {
        let bars = "";
        for (let i = 0; i < 14; i++) {
            bars += '<rect x="' + (x + 18 + i * ((w - 36) / 14)).toFixed(1) + '" y="' + (y + h * .52) + '" width="' + Math.max(4, (w - 50) / 14).toFixed(1) + '" height="' + (h * .16) + '" rx="2" fill="' + (i > 10 ? '#e14a30' : '#67d59a') + '" opacity="' + (.26 + i * .035).toFixed(2) + '"/>';
        }
        return '<g><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" fill="#080b0d" stroke="#34383e" stroke-width="2"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h * .2) + '" fill="url(#lzInset)" opacity=".65"/>' +
            bars + '<text x="' + (x + w / 2) + '" y="' + (y + h * .84) + '" font-family="Arial" font-size="12" letter-spacing="2" fill="#87b6a0" text-anchor="middle">' + label + '</text></g>';
    }
    const cx = x + w / 2, cy = y + h * .88;
    const radius = Math.min(w * .42, h * .68);
    const polar = (deg, r) => {
        const a = deg * Math.PI / 180;
        return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
    };
    const arc = (from, to, r) => {
        const p1 = polar(from, r), p2 = polar(to, r);
        return 'M ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ' A ' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    };
    const ticks = Array.from({ length: 9 }, (_, i) => {
        const deg = -42 + i * 10.5;
        const p1 = polar(deg, radius), p2 = polar(deg, radius - (i % 2 ? 8 : 13));
        return '<line x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '"/>';
    }).join("");
    const needleTip = polar(0, radius - 9);
    return '<g>' +
        '<rect x="' + (x - 5) + '" y="' + (y + 7) + '" width="' + (w + 10) + '" height="' + h + '" rx="7" fill="#000" opacity=".38" filter="url(#lzSoft)"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + face + '" stroke="#171719" stroke-width="2"/>' +
        '<rect class="ampLamp" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="url(#lzWarmFace)" opacity=".02"/>' +
        '<path d="' + arc(-42, 42, radius) + '" fill="none" stroke="#6a5a43" stroke-width="2"/>' +
        '<path d="' + arc(25, 42, radius) + '" fill="none" stroke="#bd392a" stroke-width="4.5" stroke-linecap="round"/>' +
        '<g stroke="#665a48" stroke-width="1.5">' + ticks + '</g>' +
        '<text x="' + cx + '" y="' + (y + h * .31) + '" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#5b4d3c" text-anchor="middle">' + label + '</text>' +
        (needleId ? '<line id="' + needleId + '" data-cx="' + cx + '" data-cy="' + cy + '" x1="' + cx + '" y1="' + cy + '" x2="' + needleTip.x.toFixed(1) + '" y2="' + needleTip.y.toFixed(1) + '" stroke="#c63f27" stroke-width="3" transform="rotate(-42 ' + cx + ' ' + cy + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#211a12"/>' : '') +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h * .19) + '" fill="url(#lzInset)" opacity=".7"/>' +
        '<polygon points="' + x + ',' + y + ' ' + (x + w * .54) + ',' + y + ' ' + (x + w * .25) + ',' + (y + h) + ' ' + x + ',' + (y + h) + '" fill="url(#lzStreak)"/>' +
        '</g>';
}

function mfaTunerSvg(spec) {
    const uid = "mfaT" + spec.id;
    const silver = spec.face === "silver";
    const panelTop = silver ? "#ece9df" : spec.face === "champagne" ? "#d7c49c" : "#22242a";
    const panelBot = silver ? "#8b8c8c" : spec.face === "champagne" ? "#897750" : "#090a0d";
    const ink = silver || spec.face === "champagne" ? "#282a2c" : "#e5e2d8";
    const subInk = silver || spec.face === "champagne" ? "#55575a" : "#92959d";
    const dialGlow = spec.glow || "#f0c76c";
    let ticks = "";
    for (let i = 0; i <= 100; i++) {
        const x = 410 + i * 10.2;
        const major = i % 10 === 0;
        ticks += '<line x1="' + x.toFixed(1) + '" y1="' + (major ? 145 : 153) + '" x2="' + x.toFixed(1) + '" y2="170" stroke="' + dialGlow + '" stroke-width="' + (major ? 2 : .8) + '" opacity="' + (major ? .9 : .52) + '"/>';
    }
    const switchXs = [360, 500, 640, 780, 920, 1060];
    const switchIds = ["tsSwRec", "tsSwBlend", "tsSwMode", "tsSwMute", "tsSwIf", "tsSwRf"];
    const switchLabels = ["CAL", "BLEND", "MODE", "MUTE", "IF", "RF"];
    const switches = switchXs.map((x, i) => mfaSvgToggle(x, 306, switchIds[i], silver ? "#595b5e" : "#b8bbc2") + '<text x="' + x + '" y="358" font-family="Arial" font-size="11" letter-spacing="1.5" fill="' + subInk + '" text-anchor="middle">' + switchLabels[i] + '</text>').join("");
    const meters = spec.digitalMeters
        ? mfaMeter(1160, 240, 300, 112, null, "SIGNAL / CENTER", "#17120b", true)
        : mfaMeter(1140, 238, 170, 116, "tsSignalPtr", "SIGNAL", spec.meterFace || "#eadfb9", false) + mfaMeter(1326, 238, 170, 116, "tsTunePtr", "TUNING", spec.meterFace || "#eadfb9", false);
    const signature = spec.signature === "revox"
        ? '<g fill="#31343a" stroke="#747981"><rect x="72" y="240" width="58" height="96" rx="8"/><rect x="142" y="240" width="58" height="96" rx="8"/><rect x="212" y="240" width="58" height="96" rx="8"/></g><g fill="#93e0b0"><circle cx="101" cy="258" r="5"/><circle cx="171" cy="258" r="5"/><circle cx="241" cy="258" r="5"/></g>'
        : spec.signature === "luxman"
            ? '<g stroke="#a57539" stroke-width="2" fill="none"><path d="M70 372 H260"/><path d="M82 382 H248"/></g><text x="165" y="336" font-family="Georgia" font-size="22" font-style="italic" fill="' + ink + '" text-anchor="middle">Laboratory Reference</text>'
            : spec.signature === "accuphase"
                ? '<rect x="74" y="244" width="190" height="96" rx="5" fill="#201d17" stroke="#aa8e54"/><text x="169" y="284" font-family="Georgia" font-size="23" font-style="italic" fill="#e5c76f" text-anchor="middle">Accuphase</text><text x="169" y="314" font-family="Arial" font-size="12" letter-spacing="3" fill="#aa945f" text-anchor="middle">PRECISION</text>'
                : '<g fill="#44484e"><rect x="76" y="248" width="70" height="18" rx="3"/><rect x="76" y="278" width="70" height="18" rx="3"/><rect x="76" y="308" width="70" height="18" rx="3"/></g><circle cx="208" cy="286" r="42" fill="#15171a" stroke="#71757b" stroke-width="3"/>';
    return '<svg class="tuner-svg" viewBox="0 0 2000 420" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' FM 튜너">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + panelTop + '"/><stop offset=".48" stop-color="' + (silver ? '#c8c5bb' : spec.face === 'champagne' ? '#b9a577' : '#15171b') + '"/><stop offset="1" stop-color="' + panelBot + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Dial" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050608"/><stop offset=".62" stop-color="#10130f"/><stop offset="1" stop-color="#1d1d17"/></linearGradient>' +
        '<radialGradient id="' + uid + 'Knob"><stop offset="0" stop-color="' + (silver ? '#eeeeea' : '#777a80') + '"/><stop offset=".58" stop-color="' + (silver ? '#a2a3a2' : '#393c42') + '"/><stop offset="1" stop-color="#17191d"/></radialGradient></defs>' +
        (spec.wood ? '<rect width="2000" height="420" rx="10" fill="#5b321a"/><path d="M0 34 Q500 8 1000 30 T2000 26 M0 395 Q560 370 1100 392 T2000 378" fill="none" stroke="#9d6840" stroke-width="5" opacity=".55"/>' : '') +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 388 : 420) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<rect x="38" y="18" width="1924" height="4" fill="#fff" opacity=".28"/>' +
        '<text x="72" y="86" font-family="Arial" font-size="30" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text>' +
        '<text x="72" y="116" font-family="Arial" font-size="13" letter-spacing="3" fill="' + subInk + '">FM STEREO TUNER · ' + spec.model + '</text>' +
        '<rect x="360" y="62" width="1120" height="136" rx="6" fill="url(#' + uid + 'Dial)" stroke="#030405" stroke-width="3"/>' +
        '<ellipse class="lampGlow" cx="920" cy="123" rx="530" ry="58" fill="' + dialGlow + '" opacity=".09" filter="url(#lzSoft)"/>' +
        '<rect x="360" y="62" width="1120" height="22" fill="url(#lzInset)" opacity=".8"/>' +
        '<g class="dialScale">' + ticks + '<g font-family="Arial" font-size="15" font-weight="700" fill="' + dialGlow + '" text-anchor="middle">' + [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108].map((n, i) => '<text x="' + (410 + i * 102) + '" y="128">' + n + '</text>').join("") + '</g></g>' +
        '<g id="tsStationMarks"></g><g id="tsDialPtr"><rect x="916" y="83" width="8" height="92" rx="2" fill="#ff4d32" filter="url(#lzSoft)"/><rect x="918" y="83" width="4" height="92" fill="#ffd1b7"/></g>' +
        '<text x="1448" y="188" font-family="Arial" font-size="11" fill="' + dialGlow + '" text-anchor="end">MHz</text>' +
        '<rect x="1518" y="62" width="210" height="136" rx="5" fill="#050608" stroke="#20242a" stroke-width="2"/>' +
        '<text id="tsFreqGlow" x="1702" y="144" font-family="Courier New" font-size="45" font-weight="700" fill="' + dialGlow + '" opacity=".32" text-anchor="end" filter="url(#lzSoft)">--.-</text><text id="tsFreq" x="1702" y="144" font-family="Courier New" font-size="45" font-weight="700" fill="' + dialGlow + '" text-anchor="end">--.-</text>' +
        '<g font-family="Arial" font-size="9" fill="' + subInk + '" text-anchor="middle"><text x="1548" y="184">STEREO</text><text x="1612" y="184">LOCK</text><text x="1680" y="184">BLEND</text></g>' +
        '<rect id="tsLedStereo" x="1530" y="164" width="36" height="8" rx="2" fill="#34120e"/><rect id="tsLedLock" x="1594" y="164" width="36" height="8" rx="2" fill="#34120e"/><rect id="tsLedBlend" x="1662" y="164" width="36" height="8" rx="2" fill="#34120e"/>' +
        signature + switches + meters +
        '<g><rect x="286" y="270" width="42" height="68" rx="5" fill="#111318" stroke="#65686d"/><rect id="tsPwrTop" x="295" y="278" width="24" height="20" rx="3" fill="#25272b"/><rect id="tsPwrBot" x="295" y="304" width="24" height="24" rx="3" fill="#a4a5a5"/><text x="307" y="360" font-family="Arial" font-size="11" fill="' + subInk + '" text-anchor="middle">POWER</text></g>' +
        (spec.digitalMeters ? '<g id="tsSignalPtr"><rect x="1248" y="263" width="3" height="63" fill="#d3472b"/></g><g id="tsTunePtr"><rect x="1400" y="263" width="3" height="63" fill="#d3472b"/></g>' : '') +
        mfaSvgKnob(1812, 218, 116, "tsKnob", 'url(#' + uid + 'Knob)', null) +
        '<text x="1812" y="370" font-family="Arial" font-size="12" letter-spacing="3" fill="' + subInk + '" text-anchor="middle">TUNING</text>' +
        '<circle cx="22" cy="52" r="8" fill="#303238" stroke="#85878b"/><circle cx="1978" cy="52" r="8" fill="#303238" stroke="#85878b"/><circle cx="22" cy="368" r="8" fill="#303238" stroke="#85878b"/><circle cx="1978" cy="368" r="8" fill="#303238" stroke="#85878b"/>' +
        '</svg>';
}

const MFA_TUNERS = [
    { id: "tx9500", brand: "PIONEER", model: "TX-9500 II", face: "silver", wood: true, glow: "#f6d58b", signature: "pioneer", meterFace: "#f2e6bd" },
    { id: "t110", brand: "LUXMAN", model: "T-110", face: "black", wood: true, glow: "#f1d07a", signature: "luxman", meterFace: "#ead9aa" },
    { id: "t100", brand: "ACCUPHASE", model: "T-100", face: "champagne", wood: true, glow: "#f1c66c", signature: "accuphase", meterFace: "#f0dfad" },
    { id: "b760", brand: "REVOX", model: "B760", face: "black", wood: false, glow: "#85e5b0", signature: "revox", digitalMeters: true }
];

MFA_TUNERS.forEach((spec) => {
    TUNER_SKINS[spec.id] = {
        label: spec.brand + " " + spec.model,
        cfg: {
            freq: { x88: 410, px: 51, drawX: 920 },
            mark: { y: 176, h: 7, hOn: 13, color: spec.glow, colorOn: "#ff5a3a" },
            signal: { drawX: 1248, baseX: 1170, travel: 156 },
            tune: { travel: 74 },
            knob: { cx: 1812, cy: 218 },
            swTravel: 18,
            led: { on: "#ff5137", off: "#34120e" },
            digit: { lit: spec.glow, glow: spec.glow, dim: "#263127", dimGlow: "#172019" },
            hits: { power: [286, 270, 42, 68], dial: [360, 62, 1120, 136], rec: [330, 270, 60, 86], blend: [470, 270, 60, 86], mode: [610, 270, 60, 86], mute: [750, 270, 60, 86], if: [890, 270, 60, 86], rf: [1030, 270, 60, 86], knob: [1812, 218, 126] }
        },
        svg: mfaTunerSvg(spec)
    };
    SKIN_ORDER.push(spec.id);
});

function mfaAmpSvg(spec) {
    const uid = "mfaA" + spec.id;
    const pale = spec.face === "silver" || spec.face === "champagne";
    const top = spec.face === "silver" ? "#eeeae0" : spec.face === "champagne" ? "#dbc99d" : "#25272b";
    const bot = spec.face === "silver" ? "#8b8d8f" : spec.face === "champagne" ? "#8f7950" : "#090a0c";
    const ink = pale ? "#222426" : "#e6e4df";
    const sub = pale ? "#55585c" : "#8f9299";
    let lowerControls = "";
    for (let i = 0; i < 8; i++) {
        const x = 102 + i * 112;
        lowerControls += mfaSvgKnob(x, 448, i < 2 ? 28 : 22, null, pale ? '#999b9d' : '#303238', null) + '<text x="' + x + '" y="510" font-family="Arial" font-size="9" letter-spacing="1" fill="' + sub + '" text-anchor="middle">' + ["POWER", "PHONES", "BASS", "TREBLE", "MODE", "FILTER", "TAPE", "INPUT"][i] + '</text>';
    }
    const signature = spec.signature === "sansui"
        ? '<rect x="82" y="66" width="580" height="196" rx="8" fill="#08090b" stroke="#4c4f55"/><g>' + [0,1,2,3,4,5].map(i => '<rect x="' + (112 + i * 84) + '" y="92" width="58" height="140" rx="20" fill="#121015" stroke="#625941"/><ellipse class="ampGlow" cx="' + (141 + i * 84) + '" cy="192" rx="18" ry="28" fill="#ff9b3f" opacity=".08" filter="url(#lzSoft)"/>').join("") + '</g><text x="372" y="249" font-family="Georgia" font-style="italic" font-size="20" fill="#b79d62" text-anchor="middle">AU-111 · 6L6GC</text>'
        : spec.signature === "luxman"
            ? '<rect x="86" y="72" width="580" height="188" rx="6" fill="#15171a" stroke="#50545a"/><g fill="#202329" stroke="#696d73">' + [0,1,2,3,4].map(i => '<rect x="' + (112 + i * 108) + '" y="94" width="78" height="142" rx="5"/>').join("") + '</g><g stroke="#82868b" stroke-width="2">' + [0,1,2,3,4].map(i => '<path d="M' + (125 + i * 108) + ' 112 H' + (177 + i * 108) + ' M' + (125 + i * 108) + ' 132 H' + (177 + i * 108) + ' M' + (125 + i * 108) + ' 152 H' + (177 + i * 108) + ' M' + (125 + i * 108) + ' 172 H' + (177 + i * 108) + ' M' + (125 + i * 108) + ' 192 H' + (177 + i * 108) + ' M' + (125 + i * 108) + ' 212 H' + (177 + i * 108) + '"/>').join("") + '</g><text x="376" y="250" font-family="Georgia" font-style="italic" font-size="19" fill="#d4c7a7" text-anchor="middle">DUO-&#946; CLASS A</text>'
        : spec.signature === "accuphase"
            ? mfaMeter(82, 76, 270, 186, "ampVuL", "PEAK POWER L", "#e9dbaf", false) + mfaMeter(382, 76, 270, 186, "ampVuR", "PEAK POWER R", "#e9dbaf", false)
            : mfaMeter(82, 76, 270, 186, "ampVuL", "POWER L", "#dce3ea", false) + mfaMeter(382, 76, 270, 186, "ampVuR", "POWER R", "#dce3ea", false);
    const metersOnLeft = spec.signature === "accuphase" || spec.signature === "pioneer";
    return '<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' 앰프">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset=".5" stop-color="' + (pale ? '#bcb5a4' : '#17191d') + '"/><stop offset="1" stop-color="' + bot + '"/></linearGradient><radialGradient id="' + uid + 'Knob"><stop offset="0" stop-color="' + (pale ? '#eeeade' : '#777b82') + '"/><stop offset=".55" stop-color="' + (pale ? '#a3a39e' : '#393c42') + '"/><stop offset="1" stop-color="#16181b"/></radialGradient></defs>' +
        (spec.wood ? '<rect width="2000" height="560" rx="10" fill="#5a321a"/><path d="M0 36 Q520 10 1020 38 T2000 30 M0 528 Q500 500 1060 526 T2000 510" fill="none" stroke="#9d6840" stroke-width="6" opacity=".5"/>' : '') +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 18 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 524 : 560) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<rect x="38" y="20" width="1924" height="4" fill="#fff" opacity=".28"/>' + signature +
        '<text x="' + (metersOnLeft ? 760 : 720) + '" y="92" font-family="Arial" font-size="33" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text>' +
        '<text x="' + (metersOnLeft ? 760 : 720) + '" y="124" font-family="Arial" font-size="14" letter-spacing="3" fill="' + sub + '">STEREO INTEGRATED AMPLIFIER · ' + spec.model + '</text>' +
        '<g font-family="Arial" font-size="10" letter-spacing="1.3" fill="' + sub + '">' +
        '<text x="760" y="184">SPEAKERS</text><text x="760" y="246">MUTING</text><text x="980" y="184">TAPE MONITOR</text><text x="980" y="246">SUBSONIC</text></g>' +
        mfaSvgToggle(850, 196, uid + "Spk", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(850, 258, uid + "Mute", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(1095, 196, uid + "Tape", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(1095, 258, uid + "Sub", pale ? '#5f6265' : '#b6b9bf') +
        '<circle cx="1240" cy="115" r="12" fill="#815c2c"/><circle id="ampPwrLed" cx="1240" cy="115" r="7" fill="#3a2012"/>' +
        mfaSvgKnob(1595, 244, 140, null, 'url(#' + uid + 'Knob)', 'ampVolMark') +
        '<g font-family="Arial" font-size="10" fill="' + sub + '" text-anchor="middle">' + Array.from({ length: 11 }, (_, i) => {
            const a = (-135 + i * 27) * Math.PI / 180;
            return '<text x="' + (1595 + Math.sin(a) * 175).toFixed(1) + '" y="' + (250 - Math.cos(a) * 175).toFixed(1) + '">' + i + '</text>';
        }).join("") + '</g><text x="1595" y="414" font-family="Arial" font-size="12" letter-spacing="3" fill="' + sub + '" text-anchor="middle">VOLUME</text>' +
        lowerControls + '<text x="1900" y="508" font-family="Georgia" font-size="20" font-style="italic" fill="' + sub + '" text-anchor="end">' + spec.tagline + '</text>' +
        '</svg>';
}

const MFA_AMPS = [
    { id: "sa9900", brand: "PIONEER", model: "SA-9900", pill: "TR · SA-9900", face: "silver", wood: true, signature: "pioneer", tagline: "dual-mono direct coupled", desc: "단단한 저역과 또렷한 프레즌스의 다이렉트 커플드 사운드", drive: 1.08, k: .08, asym: .01, bass: [70, .8], lowMid: [260, -.2, .8], mid: [1000, 0, 1], presence: [3300, .8, .9], treble: [10000, .7], out: .93 },
    { id: "au111", brand: "SANSUI", model: "AU-111", pill: "6L6GC · AU-111", face: "black", wood: true, signature: "sansui", tagline: "tube control amplifier", desc: "저중역의 밀도와 둥근 고역을 앞세운 6L6GC 빈티지 톤", drive: 2.05, k: 1.45, asym: .16, bass: [90, 1.5], lowMid: [310, 1.2, .78], mid: [1400, .7, .9], presence: [3600, -.4, 1], treble: [7600, -.8], out: .73 },
    { id: "l550", brand: "LUXMAN", model: "L-550", pill: "CLASS A · L-550", face: "champagne", wood: true, signature: "luxman", tagline: "pure class A integrated", desc: "매끈한 중역과 섬세한 윤기를 살린 클래스 A 보이싱", drive: 1.22, k: .32, asym: .04, bass: [75, 1.2], lowMid: [280, .5, .8], mid: [900, .3, 1], presence: [3200, .3, .9], treble: [9500, .4], out: .86 },
    { id: "e303", brand: "ACCUPHASE", model: "E-303", pill: "TR · E-303", face: "champagne", wood: true, signature: "accuphase", tagline: "precision stereo control", desc: "빠른 과도응답과 개방적인 상단을 노린 정밀 제어형 사운드", drive: 1.03, k: .06, asym: 0, bass: [65, .2], lowMid: [250, 0, .82], mid: [1100, 0, 1], presence: [3400, .4, .9], treble: [11000, .6], out: .96 }
];

MFA_AMPS.forEach((spec) => {
    AMP_MODELS[spec.id] = {
        pill: spec.pill,
        desc: spec.desc,
        vol: { cx: 1595, cy: 244, r: 158 },
        drive: spec.drive, k: spec.k, asym: spec.asym,
        bass: spec.bass, lowMid: spec.lowMid, mid: spec.mid, presence: spec.presence, treble: spec.treble, out: spec.out,
        svg: mfaAmpSvg(spec)
    };
    AMP_ORDER.push(spec.id);
});

function mfaTransportButtons(y, fill) {
    const defs = [
        [420, "deckBtnEject", "EJECT", "M456 462 H480 M456 470 H480 M468 446 V462"],
        [524, "deckBtnRew", "REW", "M592 450 L560 466 L592 482 Z"],
        [628, "deckBtnPlay", "PLAY", "M666 450 L704 466 L666 482 Z"],
        [752, "deckBtnFf", "FF", "M780 450 L812 466 L780 482 Z"],
        [856, "deckBtnStop", "STOP", "M884 452 H916 V480 H884 Z"],
        [960, "deckBtnRec", "REC", ""]
    ];
    return '<g id="deckTransport">' + defs.map((d, i) => {
        const w = i === 2 ? 120 : 96;
        return '<rect id="' + d[1] + '" x="' + d[0] + '" y="' + y + '" width="' + w + '" height="72" rx="6" fill="' + fill + '" stroke="' + (i === 5 ? '#8d392f' : '#51545a') + '" style="cursor:pointer;touch-action:none"><title>' + d[2] + '</title></rect>' +
            (i === 5 ? '<circle cx="1008" cy="' + (y + 36) + '" r="14" fill="#d13c2d" pointer-events="none"/>' : '<path d="' + d[3] + '" fill="#d6d7d8" stroke="#d6d7d8" stroke-width="5" pointer-events="none" transform="translate(0 ' + (y - 430) + ')"/>');
    }).join("") + '</g>';
}

function mfaDeckSvg(spec) {
    const uid = "mfaD" + spec.id;
    const pale = spec.face === "silver" || spec.face === "champagne";
    const top = spec.face === "silver" ? "#e8e6df" : spec.face === "champagne" ? "#d9c59b" : "#23252a";
    const bot = spec.face === "silver" ? "#85878a" : spec.face === "champagne" ? "#8d7850" : "#090a0d";
    const ink = pale ? "#242628" : "#ece9e2";
    const sub = pale ? "#55585b" : "#92959d";
    const tapeDoor = spec.openTransport ?
        '<rect x="446" y="120" width="568" height="246" rx="8" fill="#0b0c0f" stroke="#55585e" stroke-width="2"/><rect x="480" y="142" width="500" height="68" rx="4" fill="#ded7c5"/><text id="deckLabel" x="730" y="171" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text><text id="deckLabelSub" x="730" y="196" font-family="Arial" font-size="11" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>' :
        '<rect x="420" y="90" width="620" height="310" rx="10" fill="#07080a" stroke="#35383e" stroke-width="3"/><rect x="450" y="112" width="560" height="264" rx="8" fill="#1d2024" stroke="#5d6066"/><rect x="480" y="134" width="500" height="70" rx="4" fill="#ded7c5"/><text id="deckLabel" x="730" y="165" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text><text id="deckLabelSub" x="730" y="190" font-family="Arial" font-size="11" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>';
    const reels = '<rect x="520" y="216" width="420" height="92" rx="46" fill="#0d0e11" stroke="#4b4e54"/>' +
        '<circle id="deckPackL" cx="610" cy="260" r="40" fill="#1b1914" stroke="#070707" stroke-width="2"/><circle id="deckPackR" cx="850" cy="260" r="24" fill="#1b1914" stroke="#070707" stroke-width="2"/>' +
        '<g id="deckReelL"><circle cx="610" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M610 244 V276 M594 260 H626 M599 249 L621 271 M621 249 L599 271" stroke="#55585d" stroke-width="4"/><circle cx="610" cy="260" r="5" fill="#111317"/></g>' +
        '<g id="deckReelR"><circle cx="850" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M850 244 V276 M834 260 H866 M839 249 L861 271 M861 249 L839 271" stroke="#55585d" stroke-width="4"/><circle cx="850" cy="260" r="5" fill="#111317"/></g>' +
        '<rect x="640" y="330" width="180" height="26" rx="6" fill="#111216" stroke="#3a3d42"/><rect x="700" y="336" width="60" height="14" rx="3" fill="#2f3238"/>';
    const meterBlock = spec.ledMeters
        ? mfaMeter(1120, 112, 594, 170, null, "PEAK PROGRAM · dB", "#17120b", true) + '<line id="deckVuL" data-cx="1262" data-cy="262" x1="1262" y1="262" x2="1262" y2="150" stroke="#d4501e" stroke-width="0"/><line id="deckVuR" data-cx="1572" data-cy="262" x1="1572" y1="262" x2="1572" y2="150" stroke="#d4501e" stroke-width="0"/>'
        : mfaMeter(1120, 110, 284, 172, "deckVuL", "LEVEL L", "#e9dcb5", false) + mfaMeter(1430, 110, 284, 172, "deckVuR", "LEVEL R", "#e9dcb5", false);
    const signature = spec.signature === "revox"
        ? '<g fill="#363941" stroke="#737780">' + Array.from({length: 12}, (_, i) => '<rect x="' + (75 + (i % 6) * 47) + '" y="' + (188 + Math.floor(i / 6) * 54) + '" width="37" height="42" rx="4"/>').join("") + '</g><g fill="#86d4ad">' + Array.from({length: 6}, (_, i) => '<circle cx="' + (94 + i * 47) + '" cy="204" r="3"/>').join("") + '</g>'
        : spec.signature === "tandberg"
            ? '<g fill="#25272b" stroke="#777a80">' + [0,1,2,3].map(i => '<rect x="' + (78 + i * 74) + '" y="190" width="56" height="92" rx="7"/>').join("") + '</g><g fill="#d6d0be">' + [0,1,2,3].map(i => '<circle cx="' + (106 + i * 74) + '" cy="236" r="17"/>').join("") + '</g>'
            : spec.signature === "sony"
                ? '<rect x="76" y="186" width="300" height="88" rx="5" fill="#07090b" stroke="#3d4248"/><text x="226" y="238" font-family="Courier New" font-size="23" fill="#85e7b0" text-anchor="middle">AUTO CAL · HX PRO</text>'
                : '<g fill="#292c31" stroke="#73767b">' + [0,1,2,3].map(i => '<circle cx="' + (104 + i * 78) + '" cy="232" r="27"/>').join("") + '</g><g stroke="#d4d0c4" stroke-width="2">' + [0,1,2,3].map(i => '<line x1="' + (104 + i * 78) + '" y1="210" x2="' + (104 + i * 78) + '" y2="220"/>').join("") + '</g>';
    return '<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' 카세트 데크">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset=".5" stop-color="' + (pale ? '#b9b4a8' : '#17191d') + '"/><stop offset="1" stop-color="' + bot + '"/></linearGradient><linearGradient id="' + uid + 'Btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45484e"/><stop offset=".5" stop-color="#25282d"/><stop offset="1" stop-color="#101216"/></linearGradient></defs>' +
        (spec.wood ? '<rect width="2000" height="540" rx="10" fill="#5a321a"/><path d="M0 34 Q520 8 1050 36 T2000 28 M0 516 Q600 490 1120 514 T2000 498" fill="none" stroke="#98623b" stroke-width="6" opacity=".5"/>' : '') +
        '<rect x="' + (spec.wood ? 26 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1948 : 2000) + '" height="' + (spec.wood ? 508 : 540) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<text x="76" y="82" font-family="Arial" font-size="31" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text><text x="76" y="114" font-family="Arial" font-size="14" letter-spacing="3" fill="' + sub + '">' + spec.model + ' · 3 HEAD CASSETTE DECK</text>' +
        signature + tapeDoor + reels + meterBlock +
        '<text x="1120" y="332" font-family="Arial" font-size="10" letter-spacing="2" fill="' + sub + '">TAPE COUNTER</text><rect x="1120" y="340" width="200" height="58" rx="6" fill="#050608" stroke="#36393e"/><text id="deckCounter" x="1245" y="381" font-family="Courier New" font-size="30" font-weight="700" fill="' + (spec.display || '#ff4f34') + '" text-anchor="end">00:00</text><text x="1254" y="381" font-family="Arial" font-size="11" fill="#686b70">/ 30:00</text><circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/><text x="1420" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="' + sub + '" text-anchor="middle">REC</text>' +
        mfaTransportButtons(430, 'url(#' + uid + 'Btn)') + '<g id="deckShelf"></g></svg>';
}

const DECK_MODELS = {
    dragon: { label: "Nakamichi DRAGON", windRate: 16, hissFloor: .004, blankHiss: .010, reelRate: 1 },
    b215: { label: "REVOX B215", windRate: 18, hissFloor: .003, blankHiss: .008, reelRate: 1.08, svg: mfaDeckSvg({ id: "b215", brand: "REVOX", model: "B215", face: "black", signature: "revox", openTransport: true, ledMeters: true, display: "#8ce9b6" }) },
    tcd3014: { label: "TANDBERG TCD 3014A", windRate: 14, hissFloor: .005, blankHiss: .012, reelRate: .92, svg: mfaDeckSvg({ id: "tcd3014", brand: "TANDBERG", model: "TCD 3014A", face: "black", wood: true, signature: "tandberg", openTransport: true, ledMeters: false, display: "#f0a348" }) },
    tcka7es: { label: "SONY TC-KA7ES", windRate: 16, hissFloor: .0025, blankHiss: .007, reelRate: 1.02, svg: mfaDeckSvg({ id: "tcka7es", brand: "SONY", model: "TC-KA7ES", face: "champagne", signature: "sony", openTransport: false, ledMeters: true, display: "#84e4ae" }) },
    ctf1250: { label: "PIONEER CT-F1250", windRate: 12, hissFloor: .006, blankHiss: .014, reelRate: .86, svg: mfaDeckSvg({ id: "ctf1250", brand: "PIONEER", model: "CT-F1250", face: "silver", wood: true, signature: "pioneer", openTransport: true, ledMeters: false, display: "#58b8ff" }) }
};
const DECK_ORDER = ["dragon", "b215", "tcd3014", "tcka7es", "ctf1250"];

const TT_MODELS = {
    pl12: {
        label: "YAMAHA PL-12", brand: "YAMAHA PL-12", subtitle: "BELT-DRIVE TURNTABLE",
        plinth: "url(#ttWood)", deck: "#17161a", metal: "url(#ttMetal)", accent: "#8a7d70", platter: "#26262b", spinUp: 1.4, runDown: 2.6, noise: 1, detail: ""
    },
    sl1200: {
        label: "TECHNICS SL-1200MK2", brand: "TECHNICS SL-1200MK2", subtitle: "QUARTZ DIRECT DRIVE",
        plinth: "#989b9e", deck: "#c6c8c8", metal: "url(#ttMetal)", accent: "#3b3d40", platter: "#b8bab9",
        ink: "#303235", muted: "#595b5e", spinUp: .35, runDown: 1, noise: .65,
        detail: '<g pointer-events="none"><rect x="462" y="44" width="326" height="18" rx="5" fill="#111214"/><g fill="#eceeed">' + Array.from({length: 21}, (_, i) => '<circle cx="' + (474 + i * 15) + '" cy="53" r="2.8"/>').join("") + '</g><rect x="930" y="294" width="42" height="230" rx="6" fill="#282a2d" stroke="#787b80"/><rect x="942" y="326" width="18" height="62" rx="5" fill="#d3d4d3"/><text x="951" y="542" font-family="Arial" font-size="10" fill="#343638" text-anchor="middle">PITCH</text><circle cx="250" cy="568" r="32" fill="#202226" stroke="#6b6e72"/><circle cx="250" cy="568" r="9" fill="#e84935"/></g>'
    },
    td124: {
        label: "THORENS TD 124", brand: "THORENS TD 124", subtitle: "SWISS PRECISION · IDLER DRIVE",
        plinth: "#6b3d20", deck: "#d4cfc2", metal: "url(#ttMetal)", accent: "#544c40", ink: "#37332d", muted: "#625c51", platter: "#b8b4aa", spinUp: .8, runDown: 1.8, noise: 1.15,
        detail: '<g pointer-events="none"><rect x="390" y="44" width="452" height="30" rx="6" fill="#aaa598" stroke="#534f47"/><text x="414" y="65" font-family="Arial" font-size="12" letter-spacing="2" fill="#413d36">SWISS MADE</text><path d="M300 540 A54 54 0 0 1 408 540" fill="none" stroke="#5e5549" stroke-width="3"/><circle cx="354" cy="540" r="34" fill="#d8d2c4" stroke="#49443c"/><rect x="349" y="510" width="10" height="38" rx="3" fill="#3d3a35"/><text x="354" y="594" font-family="Arial" font-size="10" fill="#4f4a42" text-anchor="middle">16 · 33 · 45 · 78</text></g>'
    },
    g301: {
        label: "GARRARD 301", brand: "GARRARD 301", subtitle: "TRANSCRIPTION MOTOR",
        plinth: "#57321d", deck: "#d8d3c3", metal: "url(#ttMetal)", accent: "#514a3e", ink: "#37332d", muted: "#625c51", platter: "#aaa79e", spinUp: .7, runDown: 1.7, noise: 1.25,
        detail: '<g pointer-events="none"><path d="M280 54 H824 Q862 54 862 92 V118 H280 Z" fill="#c8c2b2" stroke="#5b554b"/><text x="342" y="98" font-family="Georgia" font-size="24" font-style="italic" fill="#413c35">Garrard</text><rect x="292" y="490" width="180" height="90" rx="14" fill="#bcb6a6" stroke="#504b43"/><circle cx="334" cy="535" r="25" fill="#313236"/><path d="M418 512 L438 558" stroke="#38393b" stroke-width="12" stroke-linecap="round"/><text x="382" y="576" font-family="Arial" font-size="9" fill="#4a463f" text-anchor="middle">SPEED · BRAKE</text></g>'
    },
    lp12: {
        label: "LINN SONDEK LP12", brand: "LINN SONDEK LP12", subtitle: "SUSPENDED BELT DRIVE",
        plinth: "#61371e", deck: "#151619", metal: "url(#ttMetal)", accent: "#b9b3a7", platter: "#2a2b2d", spinUp: 1.8, runDown: 3.2, noise: .55,
        detail: '<g pointer-events="none"><path d="M20 30 Q490 0 990 32" fill="none" stroke="#a66b40" stroke-width="6" opacity=".55"/><circle cx="260" cy="574" r="18" fill="#c7c9c8"/><circle cx="260" cy="574" r="6" fill="#111214"/><text x="305" y="580" font-family="Arial" font-size="12" letter-spacing="3" fill="#d0cbc0">33 / 45</text></g>'
    }
};
const TT_ORDER = ["pl12", "sl1200", "td124", "g301", "lp12"];

// 초기 세대 SVG에도 얇은 패널 라이너와 체결 나사 디테일을 더한다.
// MC2105는 사용자가 다듬은 블랙글라스/백라이트 레이어를 그대로 보존한다.
function mfaPolishLegacySvg(svg) {
    const match = svg && svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    if (!match) return svg;
    const w = Number(match[1]), h = Number(match[2]);
    const r = Math.max(7, Math.min(w, h) * .015);
    const screw = (x, y) => '<g transform="translate(' + x + ' ' + y + ')" pointer-events="none"><circle r="' + r.toFixed(1) + '" fill="#22252a" stroke="#a8aaad" stroke-width="1.4"/><path d="M-' + (r * .55).toFixed(1) + ' -' + (r * .18).toFixed(1) + ' L' + (r * .55).toFixed(1) + ' ' + (r * .18).toFixed(1) + '" stroke="#d8d9da" stroke-width="1.3"/></g>';
    const overlay = '<g class="mfaLegacyPolish" pointer-events="none"><rect x="12" y="12" width="' + (w - 24) + '" height="' + (h - 24) + '" rx="8" fill="none" stroke="#fff" stroke-width="2" opacity=".12"/><path d="M42 25 H' + (w - 42) + '" stroke="#fff" stroke-width="2" opacity=".16"/>' + screw(28, 34) + screw(w - 28, 34) + screw(28, h - 34) + screw(w - 28, h - 34) + '</g>';
    return svg.replace('</svg>', overlay + '</svg>');
}

["t2", "mr78", "m10b", "tu9900"].forEach((id) => {
    if (TUNER_SKINS[id]) TUNER_SKINS[id].svg = mfaPolishLegacySvg(TUNER_SKINS[id].svg);
});
["tr", "el34", "300b", "kt88"].forEach((id) => {
    if (AMP_MODELS[id]) AMP_MODELS[id].svg = mfaPolishLegacySvg(AMP_MODELS[id].svg);
});
