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
    return '<g class="lz-hardware-knob"' + (id ? ' id="' + id + '"' : '') + '>' +
        '<ellipse cx="' + (cx + 4) + '" cy="' + (cy + r * .72).toFixed(1) + '" rx="' + (r * .84).toFixed(1) + '" ry="' + (r * .3).toFixed(1) + '" fill="#000" opacity=".54" filter="url(#lzSoft)"/>' +
        '<circle cx="' + cx + '" cy="' + (cy + 5) + '" r="' + (r + 3) + '" fill="#08090b" stroke="#020304" stroke-width="3"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 2) + '" fill="#17181b" stroke="#050506" stroke-width="3"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + face + '" stroke="#a9a9aa" stroke-width="1.5"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 1) + '" fill="url(#lzKnobGloss)" pointer-events="none"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * .77).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="1.2" opacity=".11" pointer-events="none"/>' +
        '<g stroke="#17181b" stroke-width="2.2" opacity=".82">' + ridges + '</g>' +
        (mark ? '<rect id="' + mark + '" x="' + (cx - 2) + '" y="' + (cy - r + 8) + '" width="4" height="' + Math.max(12, r * .24) + '" rx="2" fill="#e8e1cf"/>' : '') +
        '<path d="M' + (cx - r * .66).toFixed(1) + ' ' + (cy - r * .35).toFixed(1) + ' Q' + (cx - r * .28).toFixed(1) + ' ' + (cy - r * .82).toFixed(1) + ' ' + (cx + r * .14).toFixed(1) + ' ' + (cy - r * .76).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="' + Math.max(1.5, r * .045).toFixed(1) + '" opacity=".28" stroke-linecap="round" pointer-events="none"/>' +
        '<path d="M' + (cx - r * .63).toFixed(1) + ' ' + (cy + r * .49).toFixed(1) + ' Q' + cx + ' ' + (cy + r * .86).toFixed(1) + ' ' + (cx + r * .63).toFixed(1) + ' ' + (cy + r * .49).toFixed(1) + '" fill="none" stroke="#000" stroke-width="' + Math.max(2, r * .055).toFixed(1) + '" opacity=".34" pointer-events="none"/>' +
        '</g>';
}

function mfaSvgToggle(x, y, id, light) {
    return '<g>' +
        '<rect x="' + (x - 19) + '" y="' + (y - 24) + '" width="38" height="59" rx="6" fill="#000" opacity=".48" filter="url(#lzSoft)"/>' +
        '<rect x="' + (x - 18) + '" y="' + (y - 27) + '" width="36" height="58" rx="5" fill="#090a0c" stroke="#575a60" stroke-width="1.5"/>' +
        '<rect id="' + id + '" class="lz-hardware-switch" x="' + (x - 11) + '" y="' + (y - 20) + '" width="22" height="30" rx="4" fill="' + (light || '#b8babd') + '" stroke="#090a0c" stroke-width="1"/>' +
        '<rect x="' + (x - 11) + '" y="' + (y - 20) + '" width="22" height="30" rx="4" fill="url(#lzSwitchFace)" pointer-events="none"/>' +
        '<rect x="' + (x - 8) + '" y="' + (y - 17) + '" width="16" height="5" rx="2" fill="#fff" opacity=".46" pointer-events="none"/>' +
        '<path d="M' + (x - 8) + ' ' + (y + 7) + ' H' + (x + 8) + '" stroke="#000" stroke-width="2" opacity=".38" pointer-events="none"/>' +
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
    { id: "au111", brand: "SANSUI", model: "AU-111", pill: "6L6GC · AU-111", face: "black", wood: true, signature: "sansui", tagline: "tube control amplifier", desc: "6L6GC 푸시풀 — 묵직한 3차 배음, 가장 큰 전원 새그와 낮은 댐핑", drive: 2.05, k: 1.45, asym: .16, bass: [90, .35], lowMid: [310, .5, .78], mid: [1400, .2, .9], presence: [3600, -.15, 1], treble: [7600, -.3], out: .88, circuit: AMP_CIRCUITS.sixL6PushPull },
    { id: "l550", brand: "LUXMAN", model: "L-550", pill: "CLASS A · L-550", face: "champagne", wood: true, signature: "luxman", tagline: "pure class A integrated", desc: "매끈한 중역과 섬세한 윤기를 살린 클래스 A 보이싱", drive: 1.22, k: .32, asym: .04, bass: [75, 1.2], lowMid: [280, .5, .8], mid: [900, .3, 1], presence: [3200, .3, .9], treble: [9500, .4], out: .86 },
    { id: "e303", brand: "ACCUPHASE", model: "E-303", pill: "TR · E-303", face: "champagne", wood: true, signature: "accuphase", tagline: "precision stereo control", desc: "빠른 과도응답과 개방적인 상단을 노린 정밀 제어형 사운드", drive: 1.03, k: .06, asym: 0, bass: [65, .2], lowMid: [250, 0, .82], mid: [1100, 0, 1], presence: [3400, .4, .9], treble: [11000, .6], out: .96 }
];

MFA_AMPS.forEach((spec) => {
    AMP_MODELS[spec.id] = {
        pill: spec.pill,
        desc: spec.desc,
        vol: { cx: 1595, cy: 244, r: 158 },
        drive: spec.drive, k: spec.k, asym: spec.asym,
        bass: spec.bass, lowMid: spec.lowMid, mid: spec.mid, presence: spec.presence, treble: spec.treble, out: spec.out, circuit: spec.circuit,
        svg: mfaAmpSvg(spec)
    };
    AMP_ORDER.push(spec.id);
});

function mfaMa2375Meter(x, needleId) {
    const cx = x + 192, cy = 354, arcCy = 305;
    const ticks = Array.from({ length: 13 }, (_, i) => {
        const deg = -70 + i * (140 / 12);
        const a = deg * Math.PI / 180;
        const major = i % 3 === 0;
        const x1 = (cx + Math.sin(a) * (major ? 134 : 140)).toFixed(1);
        const y1 = (arcCy - Math.cos(a) * (major ? 41 : 44)).toFixed(1);
        const x2 = (cx + Math.sin(a) * 150).toFixed(1);
        const y2 = (arcCy - Math.cos(a) * 50).toFixed(1);
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#123b5b" stroke-width="' + (major ? 2.5 : 1.3) + '"/>';
    }).join("");
    return '<g>' +
        '<rect x="' + x + '" y="174" width="384" height="202" rx="4" fill="#05080b" stroke="#161a1f" stroke-width="14"/>' +
        '<rect x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="url(#ma2375MeterBlue)" opacity=".34"/>' +
        '<rect class="ampLamp ma2375-meter-light" x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="url(#ma2375MeterBlue)" opacity=".03" filter="url(#ma2375BlueGlow)"/>' +
        '<path class="ma2375-meter-arc" d="M' + (x + 51) + ' 288 A150 50 0 0 1 ' + (x + 333) + ' 288" fill="none" stroke="#153e5b" stroke-width="2"/>' + ticks +
        '<g font-family="Arial" fill="#11334d" text-anchor="middle"><text x="' + (x + 57) + '" y="282" font-size="13">.075</text><text x="' + (x + 126) + '" y="252" font-size="13">.75</text><text x="' + (x + 258) + '" y="252" font-size="13">7.5</text><text x="' + (x + 327) + '" y="282" font-size="13">75</text><text x="' + cx + '" y="211" font-size="11" letter-spacing="3">WATTS</text><text x="' + cx + '" y="316" font-size="11" letter-spacing="3">DECIBELS</text><text x="' + cx + '" y="339" font-size="14" letter-spacing="2">POWER OUTPUT</text></g>' +
        '<line id="' + needleId + '" data-cx="' + cx + '" data-cy="' + cy + '" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="248" stroke="#071019" stroke-width="4" transform="rotate(-42 ' + cx + ' ' + cy + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#101820" stroke="#5c829c" stroke-width="2"/>' +
        '<rect class="meterDark" x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="#02070c" opacity=".55" pointer-events="none"/>' +
        '<path d="M' + (x + 24) + ' 199 H' + (x + 360) + '" stroke="#fff" stroke-width="3" opacity=".23"/>' +
        '</g>';
}

function mfaMa2375Tube(cx, baseY, scale, cage) {
    const w = 92 * scale, h = 220 * scale, top = baseY - h;
    const cageLines = cage ?
        '<g fill="none" stroke="url(#ma2375Cage)" stroke-width="' + (8 * scale).toFixed(1) + '" opacity=".96">' +
        Array.from({ length: 6 }, (_, i) => '<ellipse cx="' + cx + '" cy="' + (top + 24 * scale + i * 32 * scale).toFixed(1) + '" rx="' + (w * .74).toFixed(1) + '" ry="' + (12 * scale).toFixed(1) + '"/>').join("") +
        '<path d="M' + (cx - w * .67).toFixed(1) + ' ' + (top + 20 * scale).toFixed(1) + ' L' + (cx - w * .67).toFixed(1) + ' ' + baseY + ' M' + (cx - w * .22).toFixed(1) + ' ' + (top + 10 * scale).toFixed(1) + ' L' + (cx - w * .22).toFixed(1) + ' ' + baseY + ' M' + (cx + w * .22).toFixed(1) + ' ' + (top + 10 * scale).toFixed(1) + ' L' + (cx + w * .22).toFixed(1) + ' ' + baseY + ' M' + (cx + w * .67).toFixed(1) + ' ' + (top + 20 * scale).toFixed(1) + ' L' + (cx + w * .67).toFixed(1) + ' ' + baseY + '"/>' +
        '<ellipse cx="' + cx + '" cy="' + baseY + '" rx="' + (w * .82).toFixed(1) + '" ry="' + (15 * scale).toFixed(1) + '"/></g>' : '';
    return '<g>' +
        '<ellipse class="ampGlow" cx="' + cx + '" cy="' + (baseY - h * .42).toFixed(1) + '" rx="' + (w * .8).toFixed(1) + '" ry="' + (h * .55).toFixed(1) + '" fill="#55ff87" opacity=".035" filter="url(#ma2375TubeGlow)"/>' +
        '<rect x="' + (cx - w * .46).toFixed(1) + '" y="' + (top + h * .18).toFixed(1) + '" width="' + (w * .92).toFixed(1) + '" height="' + (h * .73).toFixed(1) + '" rx="' + (w * .38).toFixed(1) + '" fill="url(#ma2375TubeGlass)" stroke="#aab3ba" stroke-width="2" opacity=".86"/>' +
        '<ellipse cx="' + cx + '" cy="' + (top + h * .19).toFixed(1) + '" rx="' + (w * .44).toFixed(1) + '" ry="' + (w * .18).toFixed(1) + '" fill="#cad1d4" opacity=".32"/>' +
        '<rect x="' + (cx - w * .24).toFixed(1) + '" y="' + (top + h * .34).toFixed(1) + '" width="' + (w * .48).toFixed(1) + '" height="' + (h * .46).toFixed(1) + '" rx="5" fill="#272d30" stroke="#777f81" opacity=".82"/>' +
        '<path class="ampFil" d="M' + (cx - w * .14).toFixed(1) + ' ' + (baseY - h * .18).toFixed(1) + ' Q' + cx + ' ' + (baseY - h * .48).toFixed(1) + ' ' + (cx + w * .14).toFixed(1) + ' ' + (baseY - h * .18).toFixed(1) + '" fill="none" stroke="#ff913d" stroke-width="' + (5 * scale).toFixed(1) + '" opacity=".04"/>' +
        '<circle class="ampFilHot" cx="' + cx + '" cy="' + (baseY - h * .22).toFixed(1) + '" r="' + (7 * scale).toFixed(1) + '" fill="#ffd27a" opacity=".02"/>' +
        '<rect x="' + (cx - w * .52).toFixed(1) + '" y="' + (baseY - h * .1).toFixed(1) + '" width="' + (w * 1.04).toFixed(1) + '" height="' + (h * .12).toFixed(1) + '" rx="7" fill="#111416" stroke="#8d9295" stroke-width="2"/>' + cageLines + '</g>';
}

function mfaMa2375Knob(cx, faceY, r, options) {
    const opt = options || {};
    const depth = opt.depth || r * 1.05;
    const faceRy = r * .7;
    const bodyRx = r;
    const faceRx = r * .96;
    // 원기둥의 모든 단면은 페이스와 같은 이심률로 투영된다 — 아래 테두리·경계골도 동일한 타원호
    const bulgeRy = faceRy;
    const sideBottom = faceY + depth - r * .46;   // 직선 실루엣 하단 (최저점 = sideBottom + bulgeRy)
    const lowest = sideBottom + bulgeRy;
    const grooveY = faceY + (sideBottom - faceY) * .72;  // 널링 드럼 ↔ 폴리시드 스커트 경계 (실루엣 기준)
    const capRx = r * .84;                  // 블랙 글로시 캡 — 얇은 크롬 림만 남긴다
    const capRy = faceRy * .86;
    const key = Math.round(cx) + "x" + Math.round(faceY);
    const rimY = (u, base, ry) => base + ry * Math.sqrt(Math.max(0, 1 - u * u));
    // 널링 — 실린더 각도 등간격 배치라 가장자리로 갈수록 촘촘해지고,
    // 좌측 35% 지점의 스펙큘러 밴드에서는 어두운 골이 밝은 능선으로 반전된다
    const knurlN = Math.max(24, Math.round(r * .62));
    let knurl = "";
    for (let i = 0; i < knurlN; i++) {
        const t = -1 + 2 * i / (knurlN - 1);
        const u = Math.sin(t * 1.38) * .985;
        const x = cx + bodyRx * u;
        const fu = u * bodyRx / faceRx;
        const topY = Math.abs(fu) < 1 ? rimY(fu, faceY, faceRy) + 1.5 : faceY + 2;
        const botY = rimY(u, grooveY, bulgeRy) - Math.max(1, r * .02);
        if (botY - topY < 3) continue;
        const spec = Math.exp(-Math.pow((t + .42) / .17, 2)) + .55 * Math.exp(-Math.pow((t - .66) / .22, 2));
        const lit = spec > .5;
        knurl += '<line x1="' + x.toFixed(1) + '" y1="' + topY.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + botY.toFixed(1) + '" stroke="' + (lit ? '#fbfbf8' : '#141618') + '" stroke-width="' + Math.max(1.1, r * (lit ? .022 : .027)).toFixed(1) + '" opacity="' + (lit ? Math.min(.92, spec) : .3 + .42 * Math.abs(u)).toFixed(2) + '"/>';
    }
    const specU = -.54, spec2U = .58;
    const specX = cx + bodyRx * specU;
    const specTop = rimY(specU * bodyRx / faceRx, faceY, faceRy) + 2;
    const specBot = rimY(specU, grooveY, bulgeRy) - 2;
    const spec2Top = rimY(spec2U * bodyRx / faceRx, faceY, faceRy) + 2;
    const spec2Bot = rimY(spec2U, grooveY, bulgeRy) - 2;
    const id = opt.id ? ' id="' + opt.id + '"' : '';
    const mark = opt.mark
        ? '<path id="' + opt.mark + '" d="M' + cx + ' ' + (faceY - faceRy * .83).toFixed(1) + ' L' + cx + ' ' + (faceY - faceRy * .54).toFixed(1) + '" fill="none" stroke="#f6f3de" stroke-width="' + Math.max(3, r * .07).toFixed(1) + '" stroke-linecap="round"/>'
        : '';
    const lx = (cx - bodyRx).toFixed(1), rx = (cx + bodyRx).toFixed(1);
    const arcDown = ' A' + bodyRx.toFixed(1) + ' ' + bulgeRy.toFixed(1) + ' 0 0 0 ';
    const arcUp = ' A' + bodyRx.toFixed(1) + ' ' + bulgeRy.toFixed(1) + ' 0 0 1 ';
    return '<g' + id + ' class="ma2375-cylinder-knob" data-body-rx="' + bodyRx.toFixed(1) + '" data-face-rx="' + faceRx.toFixed(1) + '">' +
        '<clipPath id="maCap' + key + '"><ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + capRx.toFixed(1) + '" ry="' + capRy.toFixed(1) + '"/></clipPath>' +
        '<ellipse cx="' + cx + '" cy="' + (lowest + r * .34).toFixed(1) + '" rx="' + (bodyRx * .68).toFixed(1) + '" ry="' + (r * .3).toFixed(1) + '" fill="#171a1d" opacity=".16" filter="url(#ma2375Smudge)"/>' +
        '<ellipse cx="' + (cx + r * .07).toFixed(1) + '" cy="' + (lowest + r * .04).toFixed(1) + '" rx="' + (bodyRx * 1.05).toFixed(1) + '" ry="' + (r * .28).toFixed(1) + '" fill="#000" opacity=".58" filter="url(#ma2375KnobShadow)"/>' +
        '<ellipse cx="' + cx + '" cy="' + (lowest - r * .05).toFixed(1) + '" rx="' + (bodyRx * .9).toFixed(1) + '" ry="' + (r * .16).toFixed(1) + '" fill="#000" opacity=".5" filter="url(#ma2375Sheen)"/>' +
        '<ellipse class="ma2375-knob-body" cx="' + cx + '" cy="' + sideBottom.toFixed(1) + '" rx="' + bodyRx.toFixed(1) + '" ry="' + bulgeRy.toFixed(1) + '" fill="#26292c" stroke="#0e1012" stroke-width="2"/>' +
        '<path d="M' + lx + ' ' + grooveY.toFixed(1) + ' L' + lx + ' ' + sideBottom.toFixed(1) + arcDown + rx + ' ' + sideBottom.toFixed(1) + ' L' + rx + ' ' + grooveY.toFixed(1) + arcUp + lx + ' ' + grooveY.toFixed(1) + ' Z" fill="url(#ma2375KnobSkirt)" stroke="#1d2023" stroke-width="1.5"/>' +
        '<path d="M' + (cx - bodyRx * .8).toFixed(1) + ' ' + (sideBottom + bulgeRy * .6).toFixed(1) + arcDown + (cx + bodyRx * .8).toFixed(1) + ' ' + (sideBottom + bulgeRy * .6).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="' + Math.max(1.4, r * .026).toFixed(1) + '" opacity=".4"/>' +
        '<path d="M' + lx + ' ' + faceY + ' L' + lx + ' ' + grooveY.toFixed(1) + arcDown + rx + ' ' + grooveY.toFixed(1) + ' L' + rx + ' ' + faceY + ' Z" fill="url(#ma2375KnobSide)" stroke="#33373a" stroke-width="1.5"/>' +
        knurl +
        '<rect x="' + (specX - r * .07).toFixed(1) + '" y="' + specTop.toFixed(1) + '" width="' + (r * .14).toFixed(1) + '" height="' + Math.max(4, specBot - specTop).toFixed(1) + '" fill="#fff" opacity=".34" filter="url(#ma2375Sheen)"/>' +
        '<rect x="' + (cx + bodyRx * spec2U).toFixed(1) + '" y="' + spec2Top.toFixed(1) + '" width="' + (r * .09).toFixed(1) + '" height="' + Math.max(4, spec2Bot - spec2Top).toFixed(1) + '" fill="#fff" opacity=".14" filter="url(#ma2375Sheen)"/>' +
        '<path d="M' + lx + ' ' + grooveY.toFixed(1) + arcDown + rx + ' ' + grooveY.toFixed(1) + '" fill="none" stroke="#08090a" stroke-width="' + Math.max(1.6, r * .032).toFixed(1) + '" opacity=".72"/>' +
        '<path d="M' + lx + ' ' + (grooveY + 2.5).toFixed(1) + arcDown + rx + ' ' + (grooveY + 2.5).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="1.4" opacity=".26"/>' +
        '<path d="M' + (cx - bodyRx * .985).toFixed(1) + ' ' + (faceY + 2) + ' V' + (sideBottom - 1).toFixed(1) + '" stroke="#060708" stroke-width="' + Math.max(2, r * .045).toFixed(1) + '" opacity=".46"/>' +
        '<path d="M' + (cx + bodyRx * .985).toFixed(1) + ' ' + (faceY + 2) + ' V' + (sideBottom - 1).toFixed(1) + '" stroke="#040506" stroke-width="' + Math.max(2.4, r * .055).toFixed(1) + '" opacity=".56"/>' +
        '<ellipse class="ma2375-knob-bezel" cx="' + cx + '" cy="' + faceY + '" rx="' + faceRx.toFixed(1) + '" ry="' + faceRy.toFixed(1) + '" fill="url(#ma2375KnobBezel)" stroke="#191c1e" stroke-width="2"/>' +
        '<ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (faceRx * .93).toFixed(1) + '" ry="' + (faceRy * .91).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/>' +
        '<ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + capRx.toFixed(1) + '" ry="' + capRy.toFixed(1) + '" fill="url(#ma2375KnobCap)" stroke="#3f4347" stroke-width="1.5"/>' +
        '<g fill="none" stroke="#aeb4b9"><ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (capRx * .76).toFixed(1) + '" ry="' + (capRy * .76).toFixed(1) + '" opacity=".07"/><ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (capRx * .54).toFixed(1) + '" ry="' + (capRy * .54).toFixed(1) + '" opacity=".06"/><ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (capRx * .32).toFixed(1) + '" ry="' + (capRy * .32).toFixed(1) + '" opacity=".05"/></g>' +
        '<g clip-path="url(#maCap' + key + ')"><g transform="rotate(-28 ' + cx + ' ' + faceY + ')">' +
        '<ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (capRx * 1.06).toFixed(1) + '" ry="' + (r * .13).toFixed(1) + '" fill="#fff" opacity=".3" filter="url(#ma2375Smudge)"/>' +
        '<ellipse cx="' + cx + '" cy="' + faceY + '" rx="' + (capRx * .96).toFixed(1) + '" ry="' + (r * .05).toFixed(1) + '" fill="#fff" opacity=".5" filter="url(#ma2375Sheen)"/>' +
        '<ellipse cx="' + cx + '" cy="' + (faceY + r * .34).toFixed(1) + '" rx="' + (capRx * .8).toFixed(1) + '" ry="' + (r * .08).toFixed(1) + '" fill="#fff" opacity=".08" filter="url(#ma2375Smudge)"/>' +
        '</g></g>' + mark +
        '</g>';
}

function mfaMa2375Svg() {
    const powerTubes = [380, 620, 1380, 1620].map((x) => mfaMa2375Tube(x, 642, 1.12, true)).join("");
    // 미러 폴리시 상판에 비친 진공관 실루엣 + 점등 시 은은한 그린 글로우 반사
    const tubeRefl = [380, 620, 1380, 1620].map((x) =>
        '<path d="M' + (x - 40) + ' 654 L' + (x + 40) + ' 654 L' + (x + 56) + ' 806 L' + (x - 56) + ' 806 Z" fill="#171b1f" opacity=".28" filter="url(#ma2375Smudge)"/>' +
        '<path d="M' + (x - 18) + ' 656 L' + (x + 18) + ' 656 L' + (x + 26) + ' 800 L' + (x - 26) + ' 800 Z" fill="#0b0e11" opacity=".22" filter="url(#ma2375Smudge)"/>' +
        '<g opacity=".45"><ellipse class="ampGlow" cx="' + x + '" cy="724" rx="52" ry="58" fill="#55ff87" opacity=".03" filter="url(#ma2375TubeGlow)"/></g>'
    ).join("") +
        '<g opacity=".12"><ellipse class="ampLamp" cx="442" cy="706" rx="160" ry="44" fill="url(#ma2375MeterBlue)" opacity=".03" filter="url(#ma2375Smudge)"/><ellipse class="ampLamp" cx="1558" cy="706" rx="160" ry="44" fill="url(#ma2375MeterBlue)" opacity=".03" filter="url(#ma2375Smudge)"/></g>';
    const eqKnobs = [720, 860, 1000, 1140, 1280].map((x) => mfaMa2375Knob(x, 690, 34, { depth: 64 })).join("");
    const scale = 1.076, offsetX = -76;
    const volumeX = offsetX + 1700 * scale;
    const volumeY = 690 * scale;
    const volumeR = 70 * scale;
    const volumeDepth = 78 * scale;
    return `<svg class="amp-svg ma2375-svg" viewBox="0 0 2000 1080" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntosh MA2375 KT88 진공관 인티그레이티드 앰프 정면">
    <defs>
        <linearGradient id="ma2375Backdrop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14171b"/><stop offset=".68" stop-color="#07090c"/><stop offset="1" stop-color="#020304"/></linearGradient>
        <linearGradient id="ma2375Glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03070b"/><stop offset=".35" stop-color="#111820"/><stop offset=".55" stop-color="#020406"/><stop offset="1" stop-color="#0b0e12"/></linearGradient>
        <linearGradient id="ma2375Steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f6468"/><stop offset=".05" stop-color="#9ba0a3"/><stop offset=".14" stop-color="#f0f1ef"/><stop offset=".3" stop-color="#c9cccb"/><stop offset=".46" stop-color="#f8f8f5"/><stop offset=".62" stop-color="#aeb2b3"/><stop offset=".76" stop-color="#e6e7e4"/><stop offset=".9" stop-color="#c2c5c4"/><stop offset="1" stop-color="#84898c"/></linearGradient>
        <linearGradient id="ma2375SteelBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#66696c"/><stop offset=".12" stop-color="#ecece9"/><stop offset=".5" stop-color="#a9aaa9"/><stop offset=".82" stop-color="#f5f5f1"/><stop offset="1" stop-color="#5e6265"/></linearGradient>
        <linearGradient id="ma2375LowerFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".07" stop-color="#e9ebe9"/><stop offset=".22" stop-color="#c3c8ca"/><stop offset=".4" stop-color="#8f969b"/><stop offset=".54" stop-color="#596066"/><stop offset=".62" stop-color="#788087"/><stop offset=".74" stop-color="#d9dcdb"/><stop offset=".88" stop-color="#aeb3b4"/><stop offset="1" stop-color="#3f4549"/></linearGradient>
        <linearGradient id="ma2375GlassRefl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14181c" stop-opacity=".62"/><stop offset="1" stop-color="#14181c" stop-opacity="0"/></linearGradient>
        <linearGradient id="ma2375Edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#63666a"/><stop offset=".35" stop-color="#f0f0ed"/><stop offset=".62" stop-color="#96999c"/><stop offset="1" stop-color="#3d4044"/></linearGradient>
        <linearGradient id="ma2375Cage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34383b"/><stop offset=".2" stop-color="#f1f2ef"/><stop offset=".45" stop-color="#85898b"/><stop offset=".72" stop-color="#f7f7f3"/><stop offset="1" stop-color="#4b4f52"/></linearGradient>
        <radialGradient id="ma2375Chrome"><stop offset="0" stop-color="#f5f5f1"/><stop offset=".42" stop-color="#a4a7aa"/><stop offset=".75" stop-color="#3b3f43"/><stop offset="1" stop-color="#e1e2df"/></radialGradient>
        <linearGradient id="ma2375KnobSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101214"/><stop offset=".08" stop-color="#5d6164"/><stop offset=".17" stop-color="#f1f2f0"/><stop offset=".25" stop-color="#fdfdfb"/><stop offset=".36" stop-color="#8d9296"/><stop offset=".5" stop-color="#43474b"/><stop offset=".63" stop-color="#c6c9c9"/><stop offset=".78" stop-color="#f2f2ef"/><stop offset=".9" stop-color="#787d81"/><stop offset="1" stop-color="#0c0e10"/></linearGradient>
        <linearGradient id="ma2375KnobSkirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#191b1d"/><stop offset=".1" stop-color="#8d9194"/><stop offset=".2" stop-color="#f7f7f4"/><stop offset=".34" stop-color="#b1b5b8"/><stop offset=".5" stop-color="#585d61"/><stop offset=".66" stop-color="#d4d6d5"/><stop offset=".8" stop-color="#fafaf7"/><stop offset=".92" stop-color="#84888c"/><stop offset="1" stop-color="#121416"/></linearGradient>
        <linearGradient id="ma2375KnobBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#c8cbcc"/><stop offset=".62" stop-color="#5d6266"/><stop offset=".85" stop-color="#9ea3a6"/><stop offset="1" stop-color="#e8e9e7"/></linearGradient>
        <radialGradient id="ma2375KnobCap" cx="34%" cy="26%" r="82%"><stop offset="0" stop-color="#484d52"/><stop offset=".3" stop-color="#212529"/><stop offset=".62" stop-color="#0d0f12"/><stop offset="1" stop-color="#010203"/></radialGradient>
        <linearGradient id="ma2375MeterBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#44d2ff"/><stop offset=".32" stop-color="#29aee9"/><stop offset=".72" stop-color="#1682c2"/><stop offset="1" stop-color="#0a487e"/></linearGradient>
        <linearGradient id="ma2375TubeGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101519"/><stop offset=".25" stop-color="#e8f1ef" stop-opacity=".34"/><stop offset=".48" stop-color="#252b2f" stop-opacity=".82"/><stop offset=".75" stop-color="#dfe8e7" stop-opacity=".28"/><stop offset="1" stop-color="#090d10"/></linearGradient>
        <filter id="ma2375Shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="24"/></filter>
        <filter id="ma2375BlueGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="11"/></filter>
        <filter id="ma2375TubeGlow" x="-80%" y="-60%" width="260%" height="240%"><feGaussianBlur stdDeviation="24"/></filter>
        <filter id="ma2375LetterGlow" x="-80%" y="-120%" width="260%" height="340%"><feGaussianBlur stdDeviation="10"/></filter>
        <filter id="ma2375KnobShadow" x="-50%" y="-50%" width="200%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="ma2375Sheen" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>
        <filter id="ma2375Smudge" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="lzSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <rect width="2000" height="1080" rx="18" fill="url(#ma2375Backdrop)"/>
    <ellipse cx="1000" cy="1040" rx="920" ry="42" fill="#000" opacity=".82" filter="url(#ma2375Shadow)"/>
    <g transform="translate(${offsetX} 0) scale(${scale})">
    <rect x="160" y="92" width="1680" height="873" rx="7" fill="#090b0e" stroke="#34383c" stroke-width="7"/>
    <rect x="180" y="112" width="1640" height="536" rx="4" fill="#05070a" stroke="url(#ma2375Edge)" stroke-width="12"/>
    <rect x="205" y="126" width="1590" height="508" rx="2" fill="url(#ma2375Glass)" stroke="#1c242b" stroke-width="4"/>
    <rect x="180" y="112" width="36" height="536" fill="url(#ma2375SteelBand)" opacity=".92"/>
    <rect x="1784" y="112" width="36" height="536" fill="url(#ma2375SteelBand)" opacity=".92"/>
    <path d="M218 139 H1782" stroke="#fff" stroke-width="4" opacity=".11"/>
    ${mfaMa2375Meter(250, "ampVuL")}${mfaMa2375Meter(1366, "ampVuR")}
    <g class="ampLegend ma2375-lettering" text-anchor="middle">
        <g fill="#63f48b" opacity=".72" filter="url(#ma2375LetterGlow)"><text x="1000" y="252" font-family="Georgia" font-size="58" font-style="italic">McIntosh</text><text x="1000" y="291" font-family="Arial" font-size="18" font-weight="700" letter-spacing="8">MA2375</text><text x="1000" y="319" font-family="Arial" font-size="12" letter-spacing="4">TUBE INTEGRATED AMPLIFIER</text></g>
        <text x="1000" y="252" font-family="Georgia" font-size="58" font-style="italic" fill="#62ef86" stroke="#235e38" stroke-width="1">McIntosh</text><text x="1000" y="291" font-family="Arial" font-size="18" font-weight="700" letter-spacing="8" fill="#54d477">MA2375</text><text x="1000" y="319" font-family="Arial" font-size="12" letter-spacing="4" fill="#50c771">TUBE INTEGRATED AMPLIFIER</text>
    </g><circle cx="1000" cy="344" r="4" fill="#b52c27"/>
    <rect x="700" y="405" width="600" height="125" rx="5" fill="#020607" stroke="#0c2026" stroke-width="4"/>
    <g class="ampLegend ma2375-display-readout" font-family="monospace" font-size="34">
        <g fill="#63e2e8" opacity=".78" filter="url(#lzSoft)"><text id="ma2375SourceGlow" x="760" y="480">Tuner</text><text id="ma2375VolumeGlow" x="1240" y="480" text-anchor="end">100%</text></g>
        <g fill="#76f1f3"><text id="ma2375SourceText" x="760" y="480">Tuner</text><text id="ma2375VolumeText" x="1240" y="480" text-anchor="end">100%</text></g>
    </g>
    ${powerTubes}
    <path d="M103 632 H1897 L1920 812 H80 Z" fill="url(#ma2375Steel)" stroke="#202326" stroke-width="8"/>
    <path d="M104 634 H1896 L1903 700 H97 Z" fill="url(#ma2375GlassRefl)"/>
    ${tubeRefl}
    <path d="M113 649 H1887" stroke="#fff" stroke-width="4" opacity=".8"/>
    <path d="M113 654 H1887" stroke="#4a4f53" stroke-width="2" opacity=".5"/>
    <rect class="ma2375-lower-chassis" x="80" y="812" width="1840" height="153" fill="url(#ma2375LowerFace)" stroke="#24272a" stroke-width="7"/>
    <path d="M80 808 H1920" stroke="#4d5357" stroke-width="4" opacity=".9"/><path d="M84 815 H1916" stroke="#ffffff" stroke-width="3" opacity=".75"/><path d="M84 958 H1916" stroke="#1b1e21" stroke-width="7" opacity=".8"/>
    ${mfaMa2375Knob(300, 690, 70, { depth: 78 })}
    <circle cx="540" cy="707" r="26" fill="url(#ma2375KnobSkirt)" stroke="#212427" stroke-width="2"/><circle cx="540" cy="707" r="17" fill="#0b0d0e"/><circle cx="540" cy="707" r="10" fill="#010203"/><ellipse cx="534" cy="700" rx="6" ry="4" fill="#fff" opacity=".2"/>
    ${eqKnobs}
    <g font-family="Arial" text-anchor="middle" fill="#3c3f41"><text x="300" y="806" font-size="13" letter-spacing="4">PUSH · TRIM</text><text x="540" y="674" font-size="10" letter-spacing="2">HEADPHONES</text><text x="720" y="790" font-size="11">30Hz</text><text x="860" y="790" font-size="11">250Hz</text><text x="1000" y="790" font-size="11">1kHz</text><text x="1140" y="790" font-size="11">4kHz</text><text x="1280" y="790" font-size="11">10kHz</text><text x="1700" y="806" font-size="13" letter-spacing="4">PUSH · POWER</text></g>
    <circle cx="1490" cy="711" r="14" fill="url(#ma2375KnobSkirt)" stroke="#26292c" stroke-width="2"/><circle cx="1490" cy="711" r="9" fill="#2a1108"/><circle id="ampPwrLed" cx="1490" cy="711" r="7" fill="#3a2012"/><ellipse cx="1487" cy="707" rx="3" ry="2" fill="#fff" opacity=".35"/>
    <g pointer-events="none"><circle cx="125" cy="670" r="9" fill="#292c2f" stroke="#ecece8"/><circle cx="1875" cy="670" r="9" fill="#292c2f" stroke="#ecece8"/><circle cx="105" cy="930" r="8" fill="#232629" stroke="#dadbd8"/><circle cx="1895" cy="930" r="8" fill="#232629" stroke="#dadbd8"/></g>
    </g>
    ${mfaMa2375Knob(volumeX, volumeY, volumeR, { id: "ma2375Volume", mark: "ampVolMark", depth: volumeDepth })}
</svg>`;
}

AMP_MODELS.ma2375 = {
    pill: "KT88 · MA2375",
    desc: "올튜브 KT88 유니티 커플드 — 0.5% 이하 저왜율, 10Hz–50kHz 광대역과 DF 22의 강한 제동",
    vol: { cx: 1753.2, cy: 742.44, r: 102 },
    drive: 1, k: 0, asym: 0,
    bass: [65, .08], lowMid: [280, 0, .8], mid: [1000, 0, 1], presence: [3600, .08, .9], treble: [10000, .1], out: .97,
    circuit: AMP_CIRCUITS.ma2375UnityCoupled,
    svg: mfaMa2375Svg()
};
AMP_ORDER.push("ma2375");

function mfaTransportButtons(y, fill) {
    const defs = [
        [420, "deckBtnEject", "EJECT", "M456 462 H480 M456 470 H480 M468 446 V462"],
        // REW/FF는 겹 삼각형(◀◀/▶▶)으로 PLAY(▶)와 확실히 구별한다
        [524, "deckBtnRew", "REW", "M586 452 L566 466 L586 480 Z M608 452 L588 466 L608 480 Z"],
        [628, "deckBtnPlay", "PLAY", "M672 450 L708 466 L672 482 Z"],
        [752, "deckBtnFf", "FF", "M766 452 L786 466 L766 480 Z M788 452 L808 466 L788 480 Z"],
        [856, "deckBtnStop", "STOP", "M884 452 H916 V480 H884 Z"],
        [960, "deckBtnRec", "REC", ""]
    ];
    return '<g id="deckTransport">' + defs.map((d, i) => {
        const w = i === 2 ? 120 : 96;
        return '<rect id="' + d[1] + '" x="' + d[0] + '" y="' + y + '" width="' + w + '" height="72" rx="6" fill="' + fill + '" stroke="' + (i === 5 ? '#8d392f' : '#51545a') + '" style="cursor:pointer;touch-action:none"><title>' + d[2] + '</title></rect>' +
            (i === 5 ? '<circle cx="1008" cy="' + (y + 36) + '" r="14" fill="#d13c2d" pointer-events="none"/>' : '<path d="' + d[3] + '" fill="#d6d7d8" stroke="#d6d7d8" stroke-width="4" stroke-linejoin="round" pointer-events="none" transform="translate(0 ' + (y - 430) + ')"/>');
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
                : '<g>' + [0,1,2,3].map(i => mfaSvgKnob(104 + i * 78, 232, 27, null, 'url(#' + uid + 'Btn)', null)).join("") + '</g><g stroke="#d4d0c4" stroke-width="2.4">' + [0,1,2,3].map(i => '<line x1="' + (104 + i * 78) + '" y1="209" x2="' + (104 + i * 78) + '" y2="219"/>').join("") + '</g>';
    return '<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' 카세트 데크">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset=".5" stop-color="' + (pale ? '#b9b4a8' : '#17191d') + '"/><stop offset="1" stop-color="' + bot + '"/></linearGradient><linearGradient id="' + uid + 'Btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45484e"/><stop offset=".5" stop-color="#25282d"/><stop offset="1" stop-color="#101216"/></linearGradient></defs>' +
        (spec.wood ? '<rect width="2000" height="540" rx="10" fill="#5a321a"/><path d="M0 34 Q520 8 1050 36 T2000 28 M0 516 Q600 490 1120 514 T2000 498" fill="none" stroke="#98623b" stroke-width="6" opacity=".5"/>' : '') +
        '<rect x="' + (spec.wood ? 26 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1948 : 2000) + '" height="' + (spec.wood ? 508 : 540) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<text x="76" y="82" font-family="Arial" font-size="31" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text><text x="76" y="114" font-family="Arial" font-size="14" letter-spacing="3" fill="' + sub + '">' + spec.model + ' · 3 HEAD CASSETTE DECK</text>' +
        signature + tapeDoor + reels + meterBlock +
        '<text x="1120" y="332" font-family="Arial" font-size="10" letter-spacing="2" fill="' + sub + '">TAPE COUNTER</text><rect x="1120" y="340" width="200" height="58" rx="6" fill="#050608" stroke="#36393e"/><text id="deckCounter" x="1245" y="381" font-family="Courier New" font-size="30" font-weight="700" fill="' + (spec.display || '#ff4f34') + '" text-anchor="end">00:00</text><text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="11" fill="#686b70">/ 30:00</text><circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/><text x="1420" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="' + sub + '" text-anchor="middle">REC</text><circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"/><text x="1366" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="' + sub + '" text-anchor="middle">TIMER</text>' +
        mfaTransportButtons(430, 'url(#' + uid + 'Btn)') + '<g id="deckShelf"></g></svg>';
}

// PIONEER CT-F1250 전용 스킨 — 릴(610/850,260)·미터·트랜스포트 등 기능 좌표는 공용 레이아웃
// 그대로 두고, 우드 캐비닛·브러시드 알루미늄 페이스·플렉시 도어를 사진 기준 명암으로 다시 그린다.
function mfaCtf1250Svg() {
    // 브러시드 알루미늄 헤어라인 — 가로 결
    let hair = "";
    for (let y = 34; y <= 506; y += 8) {
        const dark = y % 16 === 2;
        hair += '<path d="M44 ' + y + ' H1956" stroke="' + (dark ? '#000' : '#fff') + '" stroke-width="1" opacity="' + (dark ? '.03' : '.028') + '"/>';
    }
    // 월넛 결 — 위상·굵기를 달리한 유선
    const grain = [[46, .5], [104, .38], [168, .3], [214, .46], [258, .3], [318, .42], [366, .3], [412, .5], [462, .36], [504, .44]].map(([y, o], i) =>
        '<path d="M0 ' + y + ' Q' + (360 + i * 130) + ' ' + (y + (i % 2 ? 9 : -8)) + ' ' + (900 + i * 90) + ' ' + (y + (i % 3 ? -5 : 7)) + ' T2000 ' + (y + (i % 2 ? 6 : -4)) + '" fill="none" stroke="#2e1a0d" stroke-width="' + (1.2 + (i % 3)) + '" opacity="' + o + '"/>'
    ).join("");
    const screw = (x, y, a) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + a + ')" pointer-events="none"><circle r="7.5" fill="url(#ctfScrew)" stroke="#4e5052" stroke-width="1"/><path d="M-4.6 0 H4.6" stroke="#1e2022" stroke-width="1.8"/><path d="M-4.2 1.4 H4.2" stroke="#e9eae8" stroke-width=".8" opacity=".5"/></g>';
    const knobs = ["DOLBY NR", "BIAS", "REC LEVEL", "OUTPUT"].map((lb, i) => {
        const x = 104 + i * 78;
        return mfaSvgKnob(x, 232, 27, null, "url(#ctfKnob)", null) +
            '<line x1="' + x + '" y1="209" x2="' + x + '" y2="219" stroke="#d8d4c8" stroke-width="2.4"/>' +
            '<text x="' + x + '" y="292" font-family="Arial" font-size="9" letter-spacing="1" fill="#4c4f52" text-anchor="middle">' + lb + '</text>';
    }).join("");
    const meterFrame = (x) => '<rect x="' + (x - 14) + '" y="94" width="312" height="202" rx="10" fill="#101114" stroke="url(#ctfChrome)" stroke-width="3"/>' +
        '<rect x="' + (x - 10) + '" y="98" width="304" height="194" rx="8" fill="none" stroke="#000" stroke-width="2" opacity=".6"/>';
    const meterGlass = (cx) => '<ellipse cx="' + cx + '" cy="146" rx="122" ry="28" fill="#fff" opacity=".06" pointer-events="none"/>';
    return `<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="PIONEER CT-F1250 카세트 데크">
    <defs>
        <linearGradient id="ctfWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#31190c"/><stop offset=".07" stop-color="#65381d"/><stop offset=".3" stop-color="#7a4826"/><stop offset=".55" stop-color="#5f3418"/><stop offset=".85" stop-color="#6d4021"/><stop offset="1" stop-color="#241208"/></linearGradient>
        <linearGradient id="ctfFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4ec"/><stop offset=".05" stop-color="#dedcd3"/><stop offset=".3" stop-color="#c9c7be"/><stop offset=".62" stop-color="#b1afa6"/><stop offset=".9" stop-color="#8f8e88"/><stop offset="1" stop-color="#63635f"/></linearGradient>
        <linearGradient id="ctfWell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#010203"/><stop offset=".16" stop-color="#0a0c0f"/><stop offset=".72" stop-color="#15181c"/><stop offset="1" stop-color="#20242a"/></linearGradient>
        <linearGradient id="ctfShell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23262d"/><stop offset=".5" stop-color="#15171c"/><stop offset="1" stop-color="#0b0c10"/></linearGradient>
        <linearGradient id="ctfGlass" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".17"/><stop offset=".3" stop-color="#fff" stop-opacity=".05"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="ctfBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#53565d"/><stop offset=".12" stop-color="#3a3d44"/><stop offset=".55" stop-color="#24272c"/><stop offset="1" stop-color="#0e1013"/></linearGradient>
        <linearGradient id="ctfTray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0f12"/><stop offset=".12" stop-color="#181b1f"/><stop offset=".88" stop-color="#22252b"/><stop offset="1" stop-color="#2c3037"/></linearGradient>
        <linearGradient id="ctfChrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5e6266"/><stop offset=".28" stop-color="#eff0ee"/><stop offset=".55" stop-color="#94989b"/><stop offset=".8" stop-color="#e4e5e2"/><stop offset="1" stop-color="#4a4e52"/></linearGradient>
        <linearGradient id="ctfCounter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#010407"/><stop offset=".6" stop-color="#041019"/><stop offset="1" stop-color="#08202f"/></linearGradient>
        <linearGradient id="ctfLabel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5efdc"/><stop offset=".55" stop-color="#e8e0c8"/><stop offset="1" stop-color="#cbc0a1"/></linearGradient>
        <radialGradient id="ctfKnob"><stop offset="0" stop-color="#f4f2ea"/><stop offset=".55" stop-color="#a8a7a1"/><stop offset="1" stop-color="#191b1e"/></radialGradient>
        <radialGradient id="ctfScrew"><stop offset="0" stop-color="#e6e7e5"/><stop offset=".6" stop-color="#9a9c9e"/><stop offset="1" stop-color="#43464a"/></radialGradient>
        <radialGradient id="ctfPack"><stop offset="0" stop-color="#332619"/><stop offset=".68" stop-color="#271d12"/><stop offset=".9" stop-color="#181109"/><stop offset="1" stop-color="#0a0704"/></radialGradient>
        <filter id="ctfBlur2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <rect width="2000" height="540" rx="12" fill="url(#ctfWood)"/>
    ${grain}
    <path d="M10 24 Q520 6 1030 22 T1990 18" fill="none" stroke="#c98d54" stroke-width="3" opacity=".4"/>
    <path d="M2 30 H1998" stroke="#fff" stroke-width="2" opacity=".12"/>
    <rect x="2" y="2" width="1996" height="536" rx="11" fill="none" stroke="#000" stroke-width="3" opacity=".45"/>
    <rect x="30" y="20" width="1940" height="504" rx="7" fill="#0c0805" opacity=".8"/>
    <rect x="36" y="16" width="1928" height="500" rx="6" fill="url(#ctfFace)"/>
    ${hair}
    <path d="M40 21 H1960" stroke="#fff" stroke-width="3" opacity=".65"/>
    <path d="M40 26 H1960" stroke="#5c5c58" stroke-width="1.5" opacity=".5"/>
    <path d="M40 512 H1960" stroke="#2f2f2c" stroke-width="4" opacity=".55"/>
    ${screw(58, 40, 20)}${screw(1942, 40, -14)}${screw(58, 494, 66)}${screw(1942, 494, 8)}
    <text x="76" y="83.5" font-family="Arial" font-size="31" font-weight="700" letter-spacing="2" fill="#ffffff" opacity=".5">PIONEER</text>
    <text x="76" y="82" font-family="Arial" font-size="31" font-weight="700" letter-spacing="2" fill="#26282a">PIONEER</text>
    <text x="76" y="115" font-family="Arial" font-size="14" letter-spacing="3" fill="#ffffff" opacity=".4">CT-F1250 · 3 HEAD CASSETTE DECK</text>
    <text x="76" y="114" font-family="Arial" font-size="14" letter-spacing="3" fill="#505356">CT-F1250 · 3 HEAD CASSETTE DECK</text>
    <rect x="62" y="172" width="316" height="136" rx="8" fill="#0d0d0f" opacity=".22" filter="url(#ctfBlur2)"/>
    <rect x="66" y="176" width="308" height="128" rx="7" fill="url(#ctfFace)" stroke="#7c7c77" stroke-width="1.4"/>
    <rect x="66" y="176" width="308" height="12" rx="6" fill="url(#lzInset)" opacity=".55"/>
    ${knobs}
    <text x="76" y="336" font-family="Arial" font-size="10" letter-spacing="2" fill="#6e6f6a">CLOSED LOOP DUAL CAPSTAN · DC SERVO</text>
    <rect x="76" y="350" width="110" height="26" rx="4" fill="#1c1e22" stroke="#54575c" stroke-width="1.2"/>
    <text x="131" y="368" font-family="Arial" font-size="11" letter-spacing="1.5" fill="#c8c5ba" text-anchor="middle">DOLBY NR</text>
    <rect x="424" y="102" width="612" height="290" rx="11" fill="#0a0a0c" opacity=".4" filter="url(#ctfBlur2)"/>
    <rect x="432" y="96" width="596" height="288" rx="10" fill="url(#ctfShell)" stroke="#585b61" stroke-width="2"/>
    <path d="M438 100 H1022" stroke="#8b8e93" stroke-width="1.5" opacity=".6"/>
    ${screw(452, 116, 40)}${screw(1008, 116, -30)}${screw(452, 364, 10)}${screw(1008, 364, 75)}
    <rect x="446" y="120" width="568" height="246" rx="8" fill="url(#ctfWell)" stroke="#000" stroke-width="2"/>
    <rect x="450" y="122" width="560" height="26" rx="6" fill="#000" opacity=".55" filter="url(#ctfBlur2)"/>
    <rect x="468" y="132" width="524" height="212" rx="9" fill="#181a1f" stroke="#31343a" stroke-width="2"/>
    <rect x="470" y="134" width="520" height="10" rx="5" fill="#fff" opacity=".05"/>
    <rect x="480" y="142" width="500" height="68" rx="4" fill="url(#ctfLabel)"/>
    <rect x="480" y="142" width="500" height="16" fill="#fff" opacity=".22"/>
    <text id="deckLabel" x="730" y="171" font-family="Arial" font-size="17" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text>
    <text id="deckLabelSub" x="730" y="196" font-family="Arial" font-size="11" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>
    <rect x="520" y="216" width="420" height="92" rx="46" fill="#08090b" stroke="#3f4248" stroke-width="2"/>
    <rect x="524" y="218" width="412" height="16" rx="8" fill="url(#lzInset)" opacity=".8"/>
    <circle id="deckPackL" cx="610" cy="260" r="40" fill="url(#ctfPack)" stroke="#070707" stroke-width="2"/>
    <circle id="deckPackR" cx="850" cy="260" r="24" fill="url(#ctfPack)" stroke="#070707" stroke-width="2"/>
    <circle cx="610" cy="260" r="21.5" fill="none" stroke="#000" stroke-width="1.5" opacity=".4"/>
    <circle cx="850" cy="260" r="21.5" fill="none" stroke="#000" stroke-width="1.5" opacity=".4"/>
    <g id="deckReelL"><circle cx="610" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M610 244 V276 M594 260 H626 M599 249 L621 271 M621 249 L599 271" stroke="#55585d" stroke-width="4"/><circle cx="610" cy="260" r="5" fill="#111317"/></g>
    <g id="deckReelR"><circle cx="850" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M850 244 V276 M834 260 H866 M839 249 L861 271 M861 249 L839 271" stroke="#55585d" stroke-width="4"/><circle cx="850" cy="260" r="5" fill="#111317"/></g>
    <rect x="640" y="330" width="180" height="26" rx="6" fill="#101216" stroke="#43464c"/>
    <rect x="700" y="336" width="60" height="14" rx="3" fill="#31353b"/>
    <circle cx="664" cy="343" r="6" fill="#22252a" stroke="#565a60"/><circle cx="796" cy="343" r="6" fill="#22252a" stroke="#565a60"/>
    <polygon points="446,120 726,120 566,366 446,366" fill="url(#ctfGlass)" pointer-events="none"/>
    <path d="M760 122 L636 364" stroke="#fff" stroke-width="7" opacity=".05" pointer-events="none"/>
    <path d="M786 122 L662 364" stroke="#fff" stroke-width="2.5" opacity=".1" pointer-events="none"/>
    <rect x="446" y="348" width="568" height="18" rx="4" fill="#000" opacity=".35"/>
    <text x="1000" y="361" font-family="Arial" font-size="11" letter-spacing="2" fill="#9fa3a8" text-anchor="end" opacity=".85">CT-F1250</text>
    ${meterFrame(1120)}${meterFrame(1430)}
    ${mfaMeter(1120, 110, 284, 172, "deckVuL", "LEVEL L", "#efe3b8", false)}${mfaMeter(1430, 110, 284, 172, "deckVuR", "LEVEL R", "#efe3b8", false)}
    ${meterGlass(1262)}${meterGlass(1572)}
    <text x="1120" y="330" font-family="Arial" font-size="10" letter-spacing="2" fill="#55585b">TAPE COUNTER</text>
    <rect x="1114" y="334" width="212" height="70" rx="8" fill="#0b0c0f" stroke="url(#ctfChrome)" stroke-width="2"/>
    <rect x="1120" y="340" width="200" height="58" rx="6" fill="url(#ctfCounter)" stroke="#0a2333" stroke-width="2"/>
    <rect x="1122" y="342" width="196" height="16" rx="5" fill="#fff" opacity=".06"/>
    <text id="deckCounter" x="1245" y="381" font-family="Courier New" font-size="30" font-weight="700" fill="#58b8ff" text-anchor="end">00:00</text>
    <text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="11" fill="#5d7f96">/ 30:00</text>
    <circle cx="1420" cy="369" r="13" fill="url(#ctfChrome)"/><circle cx="1420" cy="369" r="10" fill="#12080a"/><circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/><ellipse cx="1417" cy="365" rx="3.4" ry="2.2" fill="#fff" opacity=".3"/>
    <text x="1420" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#55585b" text-anchor="middle">REC</text>
    <circle cx="1366" cy="369" r="9" fill="url(#ctfChrome)"/><circle cx="1366" cy="369" r="7" fill="#12080a"/><circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"/>
    <text x="1366" y="404" font-family="Arial" font-size="10" letter-spacing="1.5" fill="#55585b" text-anchor="middle">TIMER</text>
    <rect x="404" y="416" width="668" height="104" rx="12" fill="#0b0805" opacity=".5" filter="url(#ctfBlur2)"/>
    <rect x="408" y="412" width="660" height="104" rx="10" fill="url(#ctfTray)" stroke="#3c4046" stroke-width="2"/>
    <rect x="410" y="413" width="656" height="14" rx="7" fill="#000" opacity=".5"/>
    ${mfaTransportButtons(430, "url(#ctfBtn)")}
    <rect x="1102" y="420" width="862" height="96" rx="10" fill="#0b0805" opacity=".35" filter="url(#ctfBlur2)"/>
    <rect x="1106" y="424" width="854" height="88" rx="8" fill="url(#ctfTray)" opacity=".85" stroke="#3a3e44" stroke-width="1.5"/>
    <text x="1120" y="443" font-family="Arial" font-size="9" letter-spacing="2" fill="#7c8085">TAPE RACK</text>
    <g id="deckShelf"></g></svg>`;
}

const DECK_MODELS = {
    dragon: { label: "Nakamichi DRAGON", windRate: 16, hissFloor: .004, blankHiss: .010, reelRate: 1 },
    b215: { label: "REVOX B215", windRate: 18, hissFloor: .003, blankHiss: .008, reelRate: 1.08, svg: mfaDeckSvg({ id: "b215", brand: "REVOX", model: "B215", face: "black", signature: "revox", openTransport: true, ledMeters: true, display: "#8ce9b6" }) },
    tcd3014: { label: "TANDBERG TCD 3014A", windRate: 14, hissFloor: .005, blankHiss: .012, reelRate: .92, svg: mfaDeckSvg({ id: "tcd3014", brand: "TANDBERG", model: "TCD 3014A", face: "black", wood: true, signature: "tandberg", openTransport: true, ledMeters: false, display: "#f0a348" }) },
    tcka7es: { label: "SONY TC-KA7ES", windRate: 16, hissFloor: .0025, blankHiss: .007, reelRate: 1.02, svg: mfaDeckSvg({ id: "tcka7es", brand: "SONY", model: "TC-KA7ES", face: "champagne", signature: "sony", openTransport: false, ledMeters: true, display: "#84e4ae" }) },
    ctf1250: { label: "PIONEER CT-F1250", windRate: 12, hissFloor: .006, blankHiss: .014, reelRate: .86, svg: mfaCtf1250Svg() }
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
