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
        const barW = Math.max(4, (w - 82) / 14);
        for (let i = 0; i < 14; i++) {
            const bx = (x + 42 + i * ((w - 62) / 14)).toFixed(1);
            const color = i > 11 ? '#f05b3c' : i > 8 ? '#e7be57' : '#67d59a';
            bars += '<rect x="' + bx + '" y="' + (y + h * .43).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + (h * .12).toFixed(1) + '" rx="1.5" fill="' + color + '" opacity="' + (.3 + i * .03).toFixed(2) + '"/>' +
                '<rect x="' + bx + '" y="' + (y + h * .6).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + (h * .12).toFixed(1) + '" rx="1.5" fill="' + color + '" opacity="' + (.24 + i * .025).toFixed(2) + '"/>';
        }
        return '<g>' +
            '<rect x="' + (x - 6) + '" y="' + (y + 7) + '" width="' + (w + 12) + '" height="' + h + '" rx="8" fill="#000" opacity=".42" filter="url(#lzSoft)"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" fill="#080b0d" stroke="#454a50" stroke-width="2.5"/>' +
            '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="' + (w - 16) + '" height="' + (h - 16) + '" rx="3" fill="#030608" stroke="#151b1d"/>' +
            '<path d="M' + (x + 12) + ' ' + (y + 13) + ' H' + (x + w - 12) + '" stroke="#fff" stroke-width="2" opacity=".13"/>' +
            '<g font-family="Arial" font-size="13" font-weight="700" fill="#77857f"><text x="' + (x + 22) + '" y="' + (y + h * .34).toFixed(1) + '">L</text><text x="' + (x + 22) + '" y="' + (y + h * .78).toFixed(1) + '">R</text></g>' +
            bars + '<text x="' + (x + w / 2) + '" y="' + (y + 27) + '" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2.2" fill="#95c8ae" text-anchor="middle">' + label + '</text>' +
            '<polygon points="' + (x + 10) + ',' + (y + 8) + ' ' + (x + w * .48) + ',' + (y + 8) + ' ' + (x + w * .26) + ',' + (y + h - 8) + ' ' + (x + 10) + ',' + (y + h - 8) + '" fill="url(#lzStreak)" opacity=".38" pointer-events="none"/></g>';
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
    const titleY = y + Math.max(24, h * .14);
    return '<g>' +
        '<rect x="' + (x - 5) + '" y="' + (y + 7) + '" width="' + (w + 10) + '" height="' + h + '" rx="7" fill="#000" opacity=".38" filter="url(#lzSoft)"/>' +
        '<rect x="' + (x - 3) + '" y="' + (y - 3) + '" width="' + (w + 6) + '" height="' + (h + 6) + '" rx="7" fill="#111316" stroke="#686b6e" stroke-width="2"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + face + '" stroke="#171719" stroke-width="2"/>' +
        '<rect class="ampLamp" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="url(#lzWarmFace)" opacity=".02"/>' +
        '<path d="' + arc(-42, 42, radius) + '" fill="none" stroke="#6a5a43" stroke-width="2"/>' +
        '<path d="' + arc(25, 42, radius) + '" fill="none" stroke="#bd392a" stroke-width="4.5" stroke-linecap="round"/>' +
        '<g stroke="#665a48" stroke-width="1.5">' + ticks + '</g>' +
        '<rect x="' + (cx - Math.min(w * .32, 78)).toFixed(1) + '" y="' + (titleY - 17).toFixed(1) + '" width="' + Math.min(w * .64, 156).toFixed(1) + '" height="22" rx="3" fill="' + face + '" opacity=".86"/>' +
        '<text x="' + cx + '" y="' + titleY.toFixed(1) + '" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.7" fill="#514535" text-anchor="middle">' + label + '</text>' +
        (needleId ? '<line id="' + needleId + '" data-cx="' + cx + '" data-cy="' + cy + '" x1="' + cx + '" y1="' + cy + '" x2="' + needleTip.x.toFixed(1) + '" y2="' + needleTip.y.toFixed(1) + '" stroke="#c63f27" stroke-width="3" transform="rotate(-42 ' + cx + ' ' + cy + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#211a12"/>' : '') +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h * .19) + '" fill="url(#lzInset)" opacity=".7"/>' +
        '<polygon points="' + x + ',' + y + ' ' + (x + w * .54) + ',' + y + ' ' + (x + w * .25) + ',' + (y + h) + ' ' + x + ',' + (y + h) + '" fill="url(#lzStreak)" opacity=".42"/>' +
        '<path d="M' + (x + 8) + ' ' + (y + 8) + ' H' + (x + w - 8) + '" stroke="#fff" stroke-width="2" opacity=".23"/>' +
        '</g>';
}

function mfaTunerSvg(spec) {
    const uid = "mfaT" + spec.id;
    const silver = spec.face === "silver";
    const champagne = spec.face === "champagne";
    const knob = spec.knob || { cx: 1846, cy: 220, r: 98 };
    const panelTop = silver ? "#ece9df" : spec.face === "champagne" ? "#d7c49c" : "#22242a";
    const panelBot = silver ? "#8b8c8c" : spec.face === "champagne" ? "#897750" : "#090a0d";
    const ink = silver || champagne ? "#282a2c" : "#ebe8de";
    const subInk = silver || champagne ? "#34383b" : "#c7cacf";
    const dialGlow = spec.glow || "#f0c76c";
    const lowerTop = spec.signature === "revox" ? "#1b1f23" : spec.signature === "luxman" ? "#17191d" : spec.signature === "accuphase" ? "#b7a477" : "#d2d0c8";
    const lowerBot = spec.signature === "revox" ? "#080a0d" : spec.signature === "luxman" ? "#050608" : spec.signature === "accuphase" ? "#7b6845" : "#898b8d";
    const lowerStroke = spec.signature === "revox" ? "#4d6559" : spec.signature === "luxman" ? "#9c763d" : spec.signature === "accuphase" ? "#9e824d" : "#62676c";
    let ticks = "";
    for (let i = 0; i <= 100; i++) {
        const x = 410 + i * 10.2;
        const major = i % 10 === 0;
        ticks += '<line x1="' + x.toFixed(1) + '" y1="' + (major ? 145 : 153) + '" x2="' + x.toFixed(1) + '" y2="170" stroke="' + dialGlow + '" stroke-width="' + (major ? 2 : .8) + '" opacity="' + (major ? .9 : .52) + '"/>';
    }
    const switchXs = [360, 500, 640, 780, 920, 1060];
    const switchIds = ["tsSwRec", "tsSwBlend", "tsSwMode", "tsSwMute", "tsSwIf", "tsSwRf"];
    const switchLabels = ["CAL", "BLEND", "MODE", "MUTING", "IF BAND", "RF ATT"];
    const switches = switchXs.map((x, i) =>
        '<path d="M' + (x - 25) + ' 342 H' + (x + 25) + '" stroke="' + (silver || champagne ? '#4c4f52' : '#d5d7d8') + '" opacity=".16"/>' +
        mfaSvgToggle(x, 306, switchIds[i], silver || champagne ? "#5c5f62" : "#b8bbc2") +
        '<text x="' + x + '" y="363" font-family="Arial" font-size="15" font-weight="700" letter-spacing=".6" fill="' + subInk + '" text-anchor="middle">' + switchLabels[i] + '</text>'
    ).join("");
    const meters = spec.digitalMeters
        ? '<g id="tsDigitalMeterBay">' + mfaMeter(1160, 240, 300, 112, null, "SIGNAL / CENTER", "#17120b", true) + '</g>'
        : mfaMeter(1140, 238, 170, 116, "tsSignalPtr", "SIGNAL", spec.meterFace || "#eadfb9", false) + mfaMeter(1326, 238, 170, 116, "tsTunePtr", "TUNING", spec.meterFace || "#eadfb9", false);
    const lowerFinish = '<g pointer-events="none"><rect x="38" y="218" width="1924" height="170" rx="5" fill="url(#' + uid + 'Lower)" stroke="' + lowerStroke + '" stroke-width="1.5" opacity="' + (spec.signature === 'pioneer' ? '.72' : '.9') + '"/>' +
        '<path d="M46 225H1954" stroke="#fff" stroke-width="1.5" opacity=".17"/><path d="M46 384H1954" stroke="#030405" stroke-width="2" opacity=".42"/>' +
        (spec.signature === 'revox' ? '<path d="M282 226V380 M1106 226V380 M1476 226V380 M1680 226V380" stroke="#62746b" opacity=".22"/>' : '') +
        (spec.signature === 'luxman' ? '<path d="M48 229H1952 M48 379H1952" stroke="#a67d3e" opacity=".55"/>' : '') + '</g>';
    const signature = spec.signature === "revox"
        ? '<g><rect x="66" y="232" width="202" height="116" rx="5" fill="#15171b" stroke="#555a60" stroke-width="2"/>' +
            '<g fill="url(#' + uid + 'Module)" stroke="#747981">' + [0, 1, 2].map(i => '<rect x="' + (78 + i * 62) + '" y="246" width="50" height="72" rx="4"/>').join("") + '</g>' +
            '<g fill="#91dfae">' + [0, 1, 2].map(i => '<circle cx="' + (103 + i * 62) + '" cy="260" r="4"/><rect x="' + (91 + i * 62) + '" y="287" width="24" height="3" rx="1.5" opacity=".65"/>').join("") + '</g>' +
            '<g font-family="Arial" font-size="13" font-weight="700" fill="#b6bac0" text-anchor="middle"><text x="103" y="337">AFC</text><text x="165" y="337">MONO</text><text x="227" y="337">PRESET</text></g></g>'
        : spec.signature === "luxman"
            ? '<g><rect x="66" y="232" width="202" height="116" rx="3" fill="#090a0c" stroke="#8d6c39" stroke-width="2"/>' +
                '<path d="M78 250 H256 M78 326 H256" stroke="#b58a45" stroke-width="2" opacity=".75"/>' +
                '<circle cx="111" cy="287" r="24" fill="url(#' + uid + 'Knob)" stroke="#c2a260"/><circle cx="215" cy="287" r="24" fill="url(#' + uid + 'Knob)" stroke="#c2a260"/>' +
                '<path d="M111 267 V277 M215 267 V277" stroke="#f0dfb7" stroke-width="3"/>' +
                '<g font-family="Arial" font-size="13" font-weight="700" fill="#c7aa70" text-anchor="middle"><text x="111" y="328">LEVEL</text><text x="215" y="328">METER</text></g></g>'
            : spec.signature === "accuphase"
                ? '<g><rect x="66" y="232" width="202" height="116" rx="4" fill="#252017" stroke="#9e824d" stroke-width="2"/>' +
                    '<rect x="78" y="246" width="178" height="38" rx="3" fill="#080908" stroke="#51472e"/>' +
                    '<text x="167" y="272" font-family="Georgia" font-size="21" font-style="italic" fill="#e7ca75" text-anchor="middle">Accuphase</text>' +
                    '<g fill="url(#' + uid + 'Module)" stroke="#7d6a42">' + [0, 1, 2, 3].map(i => '<rect x="' + (79 + i * 44) + '" y="296" width="35" height="25" rx="3"/>').join("") + '</g>' +
                    '<text x="167" y="340" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.3" fill="#b9a26b" text-anchor="middle">PRECISION TUNING</text></g>'
                : '<g><rect x="66" y="232" width="202" height="116" rx="4" fill="#b9b9b4" stroke="#66686b"/>' +
                    '<g fill="url(#' + uid + 'Module)" stroke="#50545a">' + [0, 1, 2].map(i => '<rect x="78" y="' + (246 + i * 27) + '" width="72" height="19" rx="2"/>').join("") + '</g>' +
                    '<circle cx="213" cy="286" r="37" fill="url(#' + uid + 'Knob)" stroke="#3a3d40" stroke-width="3"/><circle cx="213" cy="286" r="26" fill="none" stroke="#fff" opacity=".23"/>' +
                    '<path d="M213 252 V264" stroke="#f4eee0" stroke-width="3"/><text x="213" y="340" font-family="Arial" font-size="13" font-weight="700" letter-spacing=".9" fill="#4b4e51" text-anchor="middle">OUTPUT LEVEL</text></g>';
    const dialDetail = spec.signature === "revox"
        ? '<path d="M374 92 H1466 M374 181 H1466" stroke="#546c62" opacity=".35"/><g font-family="Arial" font-size="13" font-weight="700" fill="#6e9b81"><text x="382" y="102">87.5</text><text x="1434" y="102">108.0</text></g>'
        : spec.signature === "luxman"
            ? '<path d="M374 180 H1466" stroke="#b68c48" stroke-width="2"/><text x="382" y="193" font-family="Georgia" font-size="13" font-style="italic" fill="#c09a55">linear phase</text>'
            : spec.signature === "accuphase"
                ? '<path d="M374 91 H1466" stroke="#9e844d" stroke-width="2"/><path d="M374 181 H1466" stroke="#4e422c"/><text x="382" y="102" font-family="Arial" font-size="13" font-weight="700" fill="#bea35e">QUARTZ LOCK</text>'
                : '<path d="M374 91 H1466 M374 181 H1466" stroke="#d4c69f" opacity=".28"/><text x="382" y="102" font-family="Arial" font-size="13" font-weight="700" fill="#bfae83">WIDE LINEAR SCALE</text>';
    const lampCenters = spec.signature === "revox" ? [500, 780, 1060, 1340] : [510, 785, 1060, 1335];
    const dialIllumination = '<g clip-path="url(#' + uid + 'DialClip)" pointer-events="none">' +
        '<g opacity="' + (spec.signature === 'revox' ? '.43' : '.36') + '"><rect class="lampGlow" x="374" y="74" width="1092" height="104" rx="3" fill="url(#' + uid + 'DialLamp)" opacity=".045"/></g>' +
        '<g opacity="' + (spec.signature === 'revox' ? '.13' : '.11') + '" filter="url(#lzSoft)">' + lampCenters.map((cx) => '<ellipse class="lampGlow" cx="' + cx + '" cy="126" rx="185" ry="43" fill="url(#' + uid + 'DialPool)" opacity=".045"/>').join("") + '</g>' +
        '<rect x="374" y="70" width="1092" height="112" rx="2" fill="url(#' + uid + 'DialEdge)"/>' +
        (spec.signature === 'revox' ? '<g stroke="#07100c" stroke-width="2" opacity=".16"><path d="M646 77V176 M920 77V176 M1194 77V176"/></g>' : '') +
        '<path d="M382 78H1458" stroke="#fff" stroke-width="1.4" opacity=".075"/><path d="M382 174H1458" stroke="' + dialGlow + '" opacity=".09"/>' +
        '</g>';
    return '<svg class="tuner-svg" viewBox="0 0 2000 420" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' FM 튜너">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + panelTop + '"/><stop offset=".1" stop-color="' + (silver ? '#d9d7cf' : champagne ? '#c9b786' : '#1d1f24') + '"/><stop offset=".48" stop-color="' + (silver ? '#c3c2bb' : champagne ? '#b19c6f' : '#15171b') + '"/><stop offset=".88" stop-color="' + panelBot + '"/><stop offset="1" stop-color="' + (silver ? '#66686b' : champagne ? '#645437' : '#050609') + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Dial" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050608"/><stop offset=".62" stop-color="#10130f"/><stop offset="1" stop-color="#1d1d17"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b160a"/><stop offset=".18" stop-color="#754522"/><stop offset=".55" stop-color="#5b3218"/><stop offset=".82" stop-color="#7f4a24"/><stop offset="1" stop-color="#241106"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Module" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f7379"/><stop offset=".18" stop-color="#3d4147"/><stop offset="1" stop-color="#17191d"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Lower" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + lowerTop + '"/><stop offset=".18" stop-color="' + (spec.signature === 'pioneer' ? '#c4c4bf' : lowerTop) + '"/><stop offset="1" stop-color="' + lowerBot + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'DialLamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + dialGlow + '" stop-opacity=".02"/><stop offset=".2" stop-color="' + dialGlow + '" stop-opacity=".2"/><stop offset=".5" stop-color="' + dialGlow + '" stop-opacity=".58"/><stop offset=".82" stop-color="' + dialGlow + '" stop-opacity=".16"/><stop offset="1" stop-color="' + dialGlow + '" stop-opacity=".015"/></linearGradient>' +
        '<radialGradient id="' + uid + 'DialPool"><stop offset="0" stop-color="' + dialGlow + '" stop-opacity=".7"/><stop offset=".42" stop-color="' + dialGlow + '" stop-opacity=".28"/><stop offset="1" stop-color="' + dialGlow + '" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="' + uid + 'DialEdge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".78"/><stop offset=".075" stop-color="#000" stop-opacity=".2"/><stop offset=".18" stop-color="#000" stop-opacity="0"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset=".925" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></linearGradient>' +
        '<radialGradient id="' + uid + 'Knob" cx="35%" cy="27%"><stop offset="0" stop-color="' + (silver || champagne ? '#f4f2eb' : '#8a8e94') + '"/><stop offset=".52" stop-color="' + (silver || champagne ? '#a4a5a3' : '#393c42') + '"/><stop offset=".83" stop-color="#36393d"/><stop offset="1" stop-color="#111317"/></radialGradient>' +
        '<pattern id="' + uid + 'Hair" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5 H5 M0 3.5 H5" stroke="' + (silver || champagne ? '#fff' : '#cfd2d4') + '" stroke-width=".5" opacity=".1"/></pattern><clipPath id="' + uid + 'DialClip"><rect x="374" y="70" width="1092" height="112" rx="2"/></clipPath></defs>' +
        '<ellipse cx="1000" cy="407" rx="930" ry="20" fill="#000" opacity=".48" filter="url(#lzSoft)"/>' +
        (spec.wood ? '<rect width="2000" height="420" rx="10" fill="url(#' + uid + 'Wood)"/><path d="M0 34 Q500 8 1000 30 T2000 26 M0 395 Q560 370 1100 392 T2000 378 M0 118 Q380 94 790 116 T1510 104 T2000 112 M0 308 Q460 286 930 310 T2000 298" fill="none" stroke="#b0733e" stroke-width="3" opacity=".42"/>' : '') +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 388 : 420) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 388 : 420) + '" rx="8" fill="url(#' + uid + 'Hair)" opacity=".7"/>' +
        '<rect x="38" y="18" width="1924" height="4" fill="#fff" opacity=".36"/><path d="M38 397 H1962" stroke="#050607" stroke-width="5" opacity=".48"/>' +
        '<text x="72" y="80" font-family="Arial" font-size="30" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text>' +
        '<text x="72" y="112" font-family="Arial" font-size="17" font-weight="700" letter-spacing="2" fill="' + subInk + '">' + spec.model + '</text>' +
        '<text x="72" y="137" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1.7" fill="' + subInk + '">FM STEREO TUNER</text>' +
        '<rect x="352" y="54" width="1136" height="152" rx="8" fill="#08090b" stroke="' + (silver || champagne ? '#6e7072' : '#383c42') + '" stroke-width="3"/>' +
        '<rect x="360" y="62" width="1120" height="136" rx="5" fill="url(#' + uid + 'Dial)" stroke="#030405" stroke-width="3"/>' +
        dialIllumination +
        '<rect x="360" y="62" width="1120" height="22" fill="url(#lzInset)" opacity=".66"/><path d="M370 70 H1470" stroke="#fff" stroke-width="2" opacity=".1"/>' +
        dialDetail + '<g class="dialScale">' + ticks + '<g font-family="Arial" font-size="17" font-weight="700" fill="' + dialGlow + '" text-anchor="middle">' + [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108].map((n, i) => '<text x="' + (410 + i * 102) + '" y="128">' + n + '</text>').join("") + '</g></g>' +
        '<g id="tsStationMarks"></g><g id="tsDialPtr"><rect x="916" y="83" width="8" height="92" rx="2" fill="#ff4d32" filter="url(#lzSoft)"/><rect x="918" y="83" width="4" height="92" fill="#ffd1b7"/></g>' +
        '<text x="1448" y="188" font-family="Arial" font-size="13" font-weight="700" fill="' + dialGlow + '" text-anchor="end">MHz</text>' +
        '<rect x="1510" y="54" width="226" height="152" rx="7" fill="#090b0d" stroke="' + (silver || champagne ? '#777a7d' : '#343940') + '" stroke-width="3"/><rect x="1518" y="62" width="210" height="136" rx="5" fill="#030506" stroke="#20242a" stroke-width="2"/>' +
        '<text id="tsFreqGlow" x="1702" y="144" font-family="Courier New" font-size="45" font-weight="700" fill="' + dialGlow + '" opacity=".32" text-anchor="end" filter="url(#lzSoft)">--.-</text><text id="tsFreq" x="1702" y="144" font-family="Courier New" font-size="45" font-weight="700" fill="' + dialGlow + '" text-anchor="end">--.-</text>' +
        '<g font-family="Arial" font-size="14" font-weight="700" fill="' + subInk + '" text-anchor="middle"><text x="1548" y="193">STEREO</text><text x="1612" y="193">LOCK</text><text x="1680" y="193">BLEND</text></g>' +
        '<rect id="tsLedStereo" x="1530" y="164" width="36" height="8" rx="2" fill="#34120e"/><rect id="tsLedLock" x="1594" y="164" width="36" height="8" rx="2" fill="#34120e"/><rect id="tsLedBlend" x="1662" y="164" width="36" height="8" rx="2" fill="#34120e"/>' +
        lowerFinish + signature + switches + meters +
        '<g><rect x="282" y="266" width="50" height="76" rx="6" fill="#090b0e" stroke="#686c71" stroke-width="2"/><rect id="tsPwrTop" x="295" y="278" width="24" height="20" rx="3" fill="#25272b"/><rect id="tsPwrBot" x="295" y="304" width="24" height="24" rx="3" fill="#a4a5a5"/><text x="307" y="378" font-family="Arial" font-size="14" font-weight="700" fill="' + subInk + '" text-anchor="middle">POWER</text></g>' +
        (spec.digitalMeters ? '<g id="tsSignalPtr"><rect x="1248" y="263" width="3" height="63" fill="#d3472b"/></g><g id="tsTunePtr"><rect x="1400" y="263" width="3" height="63" fill="#d3472b"/></g>' : '') +
        mfaSvgKnob(knob.cx, knob.cy, knob.r, "tsKnob", 'url(#' + uid + 'Knob)', null) +
        '<text x="' + knob.cx + '" y="374" font-family="Arial" font-size="16" font-weight="700" letter-spacing="2.6" fill="' + subInk + '" text-anchor="middle">TUNING</text>' +
        '<g pointer-events="none"><circle cx="22" cy="52" r="8" fill="#303238" stroke="#a1a3a6"/><path d="M18 52 H26" stroke="#121416"/><circle cx="1978" cy="52" r="8" fill="#303238" stroke="#a1a3a6"/><path d="M1974 52 H1982" stroke="#121416"/><circle cx="22" cy="368" r="8" fill="#303238" stroke="#a1a3a6"/><path d="M18 368 H26" stroke="#121416"/><circle cx="1978" cy="368" r="8" fill="#303238" stroke="#a1a3a6"/><path d="M1974 368 H1982" stroke="#121416"/></g>' +
        '</svg>';
}

// 공용 템플릿으로 만든 네 튜너는 실기 고유 배치를 충분히 재현하지 못해 피커에서 퇴역한다.
const MFA_TUNERS = [];

MFA_TUNERS.forEach((spec) => {
    TUNER_SKINS[spec.id] = {
        label: spec.brand + " " + spec.model,
        cfg: {
            freq: { x88: 410, px: 51, drawX: 920 },
            mark: { y: 176, h: 7, hOn: 13, color: spec.glow, colorOn: "#ff5a3a" },
            signal: { drawX: 1248, baseX: 1170, travel: 156 },
            tune: { travel: 74 },
            knob: { cx: spec.knob.cx, cy: spec.knob.cy },
            swTravel: 18,
            led: { on: "#ff5137", off: "#34120e" },
            digit: { lit: spec.glow, glow: spec.glow, dim: "#263127", dimGlow: "#172019" },
            hits: { power: [286, 270, 42, 68], dial: [360, 62, 1120, 136], rec: [330, 270, 60, 86], blend: [470, 270, 60, 86], mode: [610, 270, 60, 86], mute: [750, 270, 60, 86], if: [890, 270, 60, 86], rf: [1030, 270, 60, 86], knob: [spec.knob.cx, spec.knob.cy, spec.knob.r + 12] }
        },
        svg: mfaTunerSvg(spec)
    };
    SKIN_ORDER.push(spec.id);
});

function mfaAmpSvg(spec) {
    const uid = "mfaA" + spec.id;
    const pale = spec.face === "silver" || spec.face === "champagne";
    const theme = spec.signature === "pioneer"
        ? { top: "#f1eee5", mid: "#c8c5bd", bot: "#777b80", edge: "#6c7074", ink: "#20252a", sub: "#495159", accent: "#304b5d", accent2: "#d66a38", wood: "#713f1d" }
        : spec.signature === "sansui"
            ? { top: "#30343a", mid: "#13161a", bot: "#050608", edge: "#020304", ink: "#f0eee7", sub: "#c7c0ae", accent: "#c49a51", accent2: "#e19a45", wood: "#572812" }
            : spec.signature === "luxman"
                ? { top: "#ead9ad", mid: "#bca77b", bot: "#796747", edge: "#6d5e42", ink: "#28261f", sub: "#5f5846", accent: "#a77732", accent2: "#e7a73c", wood: "#75431f" }
                : { top: "#eee0b8", mid: "#c4af7e", bot: "#816c48", edge: "#776446", ink: "#27271f", sub: "#5c5745", accent: "#997537", accent2: "#d98c31", wood: "#65401f" };
    const top = theme.top;
    const bot = theme.bot;
    const ink = pale ? "#222426" : "#e6e4df";
    const sub = theme.sub;
    const controlInk = pale ? "#262b2f" : "#dbcda9";
    const visibleVolumeR = spec.visibleVolumeR || 124;
    const hairPath = spec.signature === "luxman"
        ? '<path d="M.5 0V8 M4.5 0V8" stroke="#fff" stroke-width=".45" opacity=".08"/><path d="M2.5 0V8" stroke="#201d17" stroke-width=".4" opacity=".07"/>'
        : spec.signature === "accuphase"
            ? '<path d="M0 1L8 5 M-2 5L4 8 M5 0L8 2" stroke="#fff" stroke-width=".45" opacity=".065"/>'
            : spec.signature === "sansui"
                ? '<path d="M0 .5H8 M0 4.5H8" stroke="#d7d9db" stroke-width=".35" opacity=".045"/>'
                : '<path d="M0 .5H8 M0 2.5H8 M0 5.5H8" stroke="#fff" stroke-width=".45" opacity=".09"/><path d="M0 4H8" stroke="#1b1d20" stroke-width=".4" opacity=".08"/>';
    const controlLabels = spec.signature === "sansui"
        ? ["POWER", "PHONES", "BASS", "TREBLE", "BALANCE", "MODE", "TAPE", "SELECTOR"]
        : spec.signature === "luxman"
            ? ["POWER", "PHONES", "BASS", "TREBLE", "BALANCE", "LINE STRAIGHT", "REC OUT", "INPUT"]
            : spec.signature === "accuphase"
                ? ["POWER", "PHONES", "BASS", "TREBLE", "BALANCE", "LOUDNESS", "REC OUT", "INPUT"]
                : ["POWER", "PHONES", "BASS", "TREBLE", "TONE", "FILTER", "TAPE", "INPUT"];
    const smallScale = (cx, cy, r, color) => '<g fill="none" stroke="' + color + '" opacity=".62">' +
        Array.from({ length: 7 }, (_, i) => {
            const a = (-105 + i * 35) * Math.PI / 180;
            return '<path d="M' + (cx + Math.sin(a) * (r + 8)).toFixed(1) + ' ' + (cy - Math.cos(a) * (r + 8)).toFixed(1) + ' L' + (cx + Math.sin(a) * (r + 14)).toFixed(1) + ' ' + (cy - Math.cos(a) * (r + 14)).toFixed(1) + '" stroke-width="1.6"/>';
        }).join("") + '</g>';
    const controlXs = [102, 260, 420, 580, 740, 900, 1060, 1220];
    let lowerControls = '<g><rect x="56" y="394" width="1222" height="102" rx="5" fill="url(#' + uid + 'ControlBay)" stroke="' + theme.accent + '" stroke-width="1.5"/>' +
        '<path d="M62 399 H1272" stroke="' + (pale ? '#fff' : theme.accent) + '" stroke-width="2" opacity=".35"/>';
    for (let i = 0; i < 8; i++) {
        const x = controlXs[i];
        if (i === 0) {
            lowerControls += '<ellipse cx="102" cy="477" rx="36" ry="9" fill="#000" opacity=".28" filter="url(#' + uid + 'Soft)"/><rect x="72" y="409" width="60" height="75" rx="6" fill="#080a0d" stroke="' + theme.accent + '" stroke-width="2"/><rect class="lz-hardware-switch" x="86" y="420" width="32" height="40" rx="4" fill="url(#' + uid + 'Switch)" stroke="#181a1d"/><path d="M90 425 H114" stroke="#fff" stroke-width="3" opacity=".42"/>';
        } else if (i === 1) {
            lowerControls += '<ellipse cx="' + x + '" cy="461" rx="31" ry="9" fill="#000" opacity=".3" filter="url(#' + uid + 'Soft)"/><circle cx="' + x + '" cy="444" r="30" fill="url(#' + uid + 'Metal)" stroke="#292c2f" stroke-width="2"/><circle cx="' + x + '" cy="444" r="19" fill="#07090b" stroke="#8b9093"/><circle cx="' + x + '" cy="444" r="8" fill="#010203"/><path d="M' + (x - 14) + ' 430 A20 20 0 0 1 ' + (x + 12) + ' 429" fill="none" stroke="#fff" stroke-width="2" opacity=".32"/>';
        } else if ((spec.signature === "pioneer" && (i === 5 || i === 6)) || (spec.signature === "luxman" && (i === 5 || i === 6)) || (spec.signature === "accuphase" && i === 5)) {
            lowerControls += '<ellipse cx="' + x + '" cy="469" rx="34" ry="8" fill="#000" opacity=".25" filter="url(#' + uid + 'Soft)"/><rect x="' + (x - 31) + '" y="417" width="62" height="55" rx="5" fill="#0a0c0e" stroke="' + theme.accent + '" stroke-width="2"/><rect class="lz-hardware-switch" x="' + (x - 21) + '" y="425" width="42" height="29" rx="3" fill="url(#' + uid + 'Switch)"/><path d="M' + (x - 16) + ' 430 H' + (x + 16) + '" stroke="#fff" stroke-width="2" opacity=".4"/>';
        } else {
            const r = spec.signature === "sansui" ? (i === 7 ? 31 : 27) : i === 7 ? 30 : 25;
            lowerControls += smallScale(x, 445, r, theme.accent) +
                (spec.signature === "sansui" ? '<circle cx="' + x + '" cy="445" r="' + (r + 7) + '" fill="#070809" stroke="#a67c39" stroke-width="2"/>' : '') +
                mfaSvgKnob(x, 445, r, null, 'url(#' + uid + 'SmallKnob)', null);
        }
        lowerControls += '<text x="' + x + '" y="516" font-family="Arial" font-size="15" font-weight="700" letter-spacing=".45" fill="' + controlInk + '" text-anchor="middle">' + controlLabels[i] + '</text>';
    }
    lowerControls += '</g>';
    const signature = spec.signature === "sansui"
        ? '<g filter="url(#' + uid + 'PanelShadow)"><rect x="58" y="45" width="628" height="264" rx="10" fill="#030405" stroke="#3f3322" stroke-width="5"/>' +
            '<rect x="69" y="56" width="606" height="242" rx="7" fill="url(#' + uid + 'Glass)" stroke="#b58a44" stroke-width="2.5"/>' +
            '<rect x="82" y="68" width="580" height="216" rx="4" fill="#06080a" stroke="#4d4028"/>' +
            '<path d="M102 105 H642 M102 249 H642" stroke="#c89a4e" stroke-width="2" opacity=".9"/>' +
            '<path d="M112 112 C176 126 210 102 274 116 S402 104 466 116 S574 102 632 114" fill="none" stroke="#c68e3c" stroke-width="1.5" opacity=".3"/>' +
            '<g>' + [174, 372, 570].map((cx, i) => smallScale(cx, 175, 48, '#c69c56') + '<ellipse cx="' + (cx + 4) + '" cy="200" rx="50" ry="12" fill="#000" opacity=".45" filter="url(#' + uid + 'Soft)"/><circle cx="' + cx + '" cy="175" r="51" fill="#08090a" stroke="#ba8a3e" stroke-width="3"/><circle cx="' + cx + '" cy="175" r="37" fill="url(#' + uid + 'SmallKnob)" stroke="#484b4e"/><path d="M' + cx + ' 140 V155" stroke="#f1d69c" stroke-width="4"/><path d="M' + (cx - 23) + ' 153 Q' + cx + ' 132 ' + (cx + 23) + ' 153" fill="none" stroke="#fff" opacity=".2"/><text x="' + cx + '" y="267" font-family="Arial" font-size="14" font-weight="700" letter-spacing="1.4" fill="#d2b06f" text-anchor="middle">' + ["BASS", "PRESENCE", "TREBLE"][i] + '</text>').join("") + '</g>' +
            '<text x="372" y="95" font-family="Georgia" font-style="italic" font-size="22" fill="#e0c17f" text-anchor="middle">AU-111 · 6L6GC</text><circle cx="98" cy="82" r="4" fill="#e5a743"/><circle cx="646" cy="82" r="4" fill="#e5a743"/></g>'
        : spec.signature === "luxman"
            ? '<g filter="url(#' + uid + 'PanelShadow)"><rect x="58" y="45" width="628" height="264" rx="8" fill="#1a1712" stroke="#795f35" stroke-width="4"/>' +
                '<rect x="70" y="57" width="604" height="240" rx="5" fill="url(#' + uid + 'Glass)" stroke="#c59b55" stroke-width="2"/>' +
                '<path d="M92 106 H652" stroke="#d2a85f" stroke-width="2"/><text x="372" y="96" font-family="Georgia" font-size="21" font-style="italic" fill="#edcf91" text-anchor="middle">DUO-&#946; · PURE CLASS A</text>' +
                '<g>' + [0, 1, 2, 3, 4].map(i => {
                    const x = 108 + i * 108;
                    const lit = 3 + (i % 3);
                    return '<rect x="' + x + '" y="126" width="76" height="104" rx="5" fill="#171a1e" stroke="#77736a" stroke-width="2"/><path d="M' + (x + 8) + ' 136 H' + (x + 68) + '" stroke="#fff" opacity=".18"/>' +
                        Array.from({ length: 6 }, (_, j) => '<rect x="' + (x + 16) + '" y="' + (205 - j * 12) + '" width="44" height="6" rx="2" fill="' + (j < lit ? (j > 3 ? '#e6a340' : '#8cc57a') : '#343a3c') + '" opacity="' + (j < lit ? '.88' : '.45') + '"/>').join("") +
                        '<text x="' + (x + 38) + '" y="246" font-family="Arial" font-size="13" font-weight="700" fill="#c5b68e" text-anchor="middle">' + ["L BIAS", "L TEMP", "DC", "R TEMP", "R BIAS"][i] + '</text>';
                }).join("") + '</g><text x="372" y="276" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2.5" fill="#d4c39a" text-anchor="middle">THERMAL STABILITY · 50 W CLASS A</text></g>'
        : spec.signature === "accuphase"
            ? '<g filter="url(#' + uid + 'PanelShadow)"><rect x="55" y="46" width="630" height="260" rx="10" fill="#211b10" stroke="#765b2c" stroke-width="4"/><rect x="67" y="58" width="606" height="236" rx="7" fill="#0c0d0c" stroke="#c6a05a" stroke-width="2"/>' + mfaMeter(82, 76, 270, 186, "ampVuL", "PEAK POWER · L", "#ead9a5", false) + mfaMeter(382, 76, 270, 186, "ampVuR", "PEAK POWER · R", "#ead9a5", false) + '<circle cx="370" cy="272" r="8" fill="#251609" stroke="#b28645"/><circle class="ampLamp" cx="370" cy="272" r="5" fill="#d48b32" opacity=".08"/></g>'
            : '<g filter="url(#' + uid + 'PanelShadow)"><rect x="55" y="46" width="630" height="260" rx="10" fill="#15181b" stroke="#4b535a" stroke-width="4"/><rect x="67" y="58" width="606" height="236" rx="7" fill="#080a0c" stroke="#8b9297" stroke-width="2"/>' + mfaMeter(82, 76, 270, 186, "ampVuL", "POWER · LEFT", "#e8dfc7", false) + mfaMeter(382, 76, 270, 186, "ampVuR", "POWER · RIGHT", "#e8dfc7", false) + '<path d="M78 286 H662" stroke="#dce3e6" opacity=".26"/><text x="370" y="285" font-family="Arial" font-size="12" font-weight="700" letter-spacing="3" fill="#9fa8ad" text-anchor="middle">DUAL MONO POWER DISPLAY</text></g>';
    const metersOnLeft = spec.signature === "accuphase" || spec.signature === "pioneer";
    const brandX = metersOnLeft ? 744 : 714;
    const modelAccent = spec.signature === "pioneer"
        ? '<rect x="722" y="153" width="520" height="4" fill="#202327" opacity=".65"/><text x="1228" y="149" font-family="Arial" font-size="13" font-weight="700" fill="#4c4f53" text-anchor="end">DUAL MONO · DC COUPLED</text>'
        : spec.signature === "sansui"
            ? '<path d="M704 153 H1245" stroke="#a47b42" stroke-width="2"/><text x="1228" y="149" font-family="Georgia" font-size="13" font-style="italic" fill="#b89357" text-anchor="end">tube control amplifier</text>'
            : spec.signature === "luxman"
                ? '<path d="M704 153 H1245" stroke="#8f6e3b" stroke-width="2"/><text x="1228" y="149" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.7" fill="#715b38" text-anchor="end">PURE CLASS A</text>'
                : '<path d="M722 153 H1245" stroke="#927b4b" stroke-width="2"/><text x="1228" y="149" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.7" fill="#715b38" text-anchor="end">PRECISION CONTROL</text>';
    const consoleTitle = spec.signature === "pioneer" ? "DIRECT COUPLED CONTROL" : spec.signature === "sansui" ? "TUBE CONTROL BAY" : spec.signature === "luxman" ? "DUO-BETA CONTROL" : "LOGIC CONTROL CENTER";
    const consoleDetail = spec.signature === "pioneer"
        ? '<rect x="930" y="289" width="116" height="18" rx="2" fill="#10171b"/><text x="988" y="303" font-family="monospace" font-size="13" font-weight="700" fill="#8fb0bd" text-anchor="middle">PHONO 1</text>'
        : spec.signature === "sansui"
            ? '<path d="M946 285 H1030" stroke="#b88a44" stroke-width="2"/><text x="988" y="305" font-family="Georgia" font-size="14" font-style="italic" fill="#d2b16e" text-anchor="middle">6L6GC push-pull</text>'
            : spec.signature === "luxman"
                ? '<g><circle cx="972" cy="297" r="5" fill="#332314" stroke="#9c7437"/><circle class="ampLamp" cx="972" cy="297" r="3" fill="#f1a637" opacity=".1"/><text x="988" y="303" font-family="Arial" font-size="13" font-weight="700" fill="#6d5835">BIAS OK</text></g>'
                : '<rect x="928" y="287" width="120" height="22" rx="3" fill="#312718" stroke="#8f7138"/><text x="988" y="303" font-family="monospace" font-size="13" font-weight="700" fill="#e0ae58" text-anchor="middle">INPUT · CD</text>';
    const centerConsole = '<g><rect x="690" y="166" width="600" height="160" rx="7" fill="url(#' + uid + 'Console)" stroke="' + theme.accent + '" stroke-width="2"/>' +
        '<path d="M704 184 H1276" stroke="' + (pale ? '#fff' : theme.accent) + '" opacity=".32"/><text x="988" y="181" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2.1" fill="' + controlInk + '" text-anchor="middle">' + consoleTitle + '</text>' +
        '<path d="M974 190 V280" stroke="' + theme.accent + '" opacity=".3"/>' + consoleDetail + '</g>';
    const volumeTicks = '<g fill="none" stroke="' + theme.accent + '">' + Array.from({ length: 31 }, (_, i) => {
        const a = (-135 + i * 9) * Math.PI / 180;
        const major = i % 5 === 0;
        const r1 = visibleVolumeR + (major ? 19 : 25), r2 = visibleVolumeR + 34;
        return '<line x1="' + (1595 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (244 - Math.cos(a) * r1).toFixed(1) + '" x2="' + (1595 + Math.sin(a) * r2).toFixed(1) + '" y2="' + (244 - Math.cos(a) * r2).toFixed(1) + '" stroke-width="' + (major ? 2.6 : 1.2) + '" opacity="' + (major ? '.8' : '.48') + '"/>';
    }).join("") + '<path d="M' + (1595 - (visibleVolumeR + 18) * .73).toFixed(1) + ' ' + (244 + (visibleVolumeR + 18) * .68).toFixed(1) + ' A' + (visibleVolumeR + 18) + ' ' + (visibleVolumeR + 18) + ' 0 1 1 ' + (1595 + (visibleVolumeR + 18) * .73).toFixed(1) + ' ' + (244 + (visibleVolumeR + 18) * .68).toFixed(1) + '" stroke-width="3" opacity=".52"/></g>';
    return '<svg class="amp-svg" viewBox="0 0 2000 560" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' 앰프">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset=".07" stop-color="' + (pale ? '#e4dfd0' : '#24282d') + '"/><stop offset=".48" stop-color="' + theme.mid + '"/><stop offset=".88" stop-color="' + bot + '"/><stop offset="1" stop-color="' + theme.edge + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#291308"/><stop offset=".2" stop-color="' + theme.wood + '"/><stop offset=".5" stop-color="#4d2914"/><stop offset=".82" stop-color="' + theme.wood + '"/><stop offset="1" stop-color="#200e05"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#20242a"/><stop offset=".35" stop-color="#07090c"/><stop offset=".58" stop-color="#181c20"/><stop offset="1" stop-color="#030405"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Switch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f0eb"/><stop offset=".25" stop-color="#aaaeb0"/><stop offset="1" stop-color="#34373b"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#faf9f4"/><stop offset=".34" stop-color="#929699"/><stop offset=".7" stop-color="#3b3f43"/><stop offset="1" stop-color="#dedfdd"/></linearGradient>' +
        '<radialGradient id="' + uid + 'Knob" cx="35%" cy="28%"><stop offset="0" stop-color="' + (pale ? '#f7f4ea' : '#8c9096') + '"/><stop offset=".5" stop-color="' + (pale ? '#a3a39e' : '#393c42') + '"/><stop offset=".82" stop-color="#35383c"/><stop offset="1" stop-color="#111316"/></radialGradient>' +
        '<radialGradient id="' + uid + 'SmallKnob" cx="34%" cy="25%"><stop offset="0" stop-color="' + (pale ? '#eeeae0' : '#6d7177') + '"/><stop offset=".58" stop-color="' + (pale ? '#929596' : '#2d3035') + '"/><stop offset="1" stop-color="#101215"/></radialGradient>' +
        '<linearGradient id="' + uid + 'Console" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (pale ? '#aaa18c' : '#1e2024') + '"/><stop offset=".12" stop-color="' + (pale ? '#7f7765' : '#111317') + '"/><stop offset=".82" stop-color="' + (pale ? '#665e4e' : '#050608') + '"/><stop offset="1" stop-color="' + (pale ? '#a29a86' : '#202226') + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'ControlBay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (pale ? '#aaa390' : '#1b1d20') + '"/><stop offset=".14" stop-color="' + (pale ? '#8f8876' : '#101216') + '"/><stop offset="1" stop-color="' + (pale ? '#716a5c' : '#050608') + '"/></linearGradient>' +
        '<pattern id="' + uid + 'Hair" width="8" height="8" patternUnits="userSpaceOnUse">' + hairPath + '</pattern>' +
        '<pattern id="' + uid + 'WoodGrain" width="180" height="86" patternUnits="userSpaceOnUse"><path d="M-20 18 C28 2 72 33 126 14 S206 11 226 23 M-10 49 C38 31 70 66 125 45 S202 40 218 53 M18 74 C58 58 100 83 164 67" fill="none" stroke="#d09859" stroke-width="2" opacity=".32"/><path d="M8 25 C42 14 65 36 96 24" fill="none" stroke="#2b1207" opacity=".4"/></pattern>' +
        '<filter id="' + uid + 'PanelShadow" x="-20%" y="-25%" width="150%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".48"/></filter><filter id="' + uid + 'Soft" x="-50%" y="-70%" width="200%" height="240%"><feGaussianBlur stdDeviation="5"/></filter></defs>' +
        '<ellipse cx="1000" cy="548" rx="928" ry="22" fill="#000" opacity=".52" filter="url(#lzSoft)"/>' +
        (spec.wood ? '<rect width="2000" height="560" rx="11" fill="url(#' + uid + 'Wood)"/><rect width="2000" height="560" rx="11" fill="url(#' + uid + 'WoodGrain)"/><path d="M4 24 H1996 M5 536 H1995" stroke="#dfaa68" stroke-width="3" opacity=".38"/><path d="M2 8 H1998" stroke="#fff" stroke-width="2" opacity=".11"/>' : '') +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 18 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 524 : 560) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<rect x="' + (spec.wood ? 28 : 0) + '" y="' + (spec.wood ? 18 : 0) + '" width="' + (spec.wood ? 1944 : 2000) + '" height="' + (spec.wood ? 524 : 560) + '" rx="8" fill="url(#' + uid + 'Hair)"/>' +
        '<rect x="38" y="20" width="1924" height="5" fill="#fff" opacity=".42"/><path d="M38 529 H1962" stroke="#08090b" stroke-width="7" opacity=".55"/><path d="M39 32 V518 M1961 32 V518" stroke="#fff" opacity=".14"/>' + signature + centerConsole +
        '<text x="' + brandX + '" y="91" font-family="Arial" font-size="37" font-weight="700" letter-spacing="2.4" fill="' + ink + '">' + spec.brand + '</text>' +
        '<text x="' + brandX + '" y="126" font-family="Arial" font-size="16" font-weight="700" letter-spacing="2.5" fill="' + sub + '">STEREO INTEGRATED AMPLIFIER · ' + spec.model + '</text>' + modelAccent +
        '<g font-family="Arial" font-size="14" font-weight="700" letter-spacing=".9" fill="' + controlInk + '" text-anchor="end">' +
        '<text x="810" y="201">SPEAKERS</text><text x="810" y="263">MUTING</text><text x="1055" y="201">TAPE MONITOR</text><text x="1055" y="263">SUBSONIC</text></g>' +
        mfaSvgToggle(850, 196, uid + "Spk", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(850, 258, uid + "Mute", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(1095, 196, uid + "Tape", pale ? '#5f6265' : '#b6b9bf') + mfaSvgToggle(1095, 258, uid + "Sub", pale ? '#5f6265' : '#b6b9bf') +
        '<circle cx="1240" cy="115" r="15" fill="url(#' + uid + 'Metal)"/><circle cx="1240" cy="115" r="11" fill="#1d0d08"/><circle id="ampPwrLed" cx="1240" cy="115" r="7" fill="#3a2012"/><ellipse cx="1237" cy="112" rx="3" ry="2" fill="#fff" opacity=".38"/><circle class="ampLamp" cx="1240" cy="115" r="20" fill="' + theme.accent2 + '" opacity=".02" filter="url(#' + uid + 'Soft)"/>' +
        volumeTicks + '<ellipse cx="1599" cy="' + (244 + visibleVolumeR * .88).toFixed(1) + '" rx="' + (visibleVolumeR * .94).toFixed(1) + '" ry="' + (visibleVolumeR * .2).toFixed(1) + '" fill="#000" opacity=".32" filter="url(#' + uid + 'Soft)"/>' + mfaSvgKnob(1595, 244, visibleVolumeR, null, 'url(#' + uid + 'Knob)', 'ampVolMark') +
        '<g font-family="Arial" font-size="14" font-weight="700" fill="' + sub + '" text-anchor="middle">' + Array.from({ length: 11 }, (_, i) => {
            const a = (-135 + i * 27) * Math.PI / 180;
            return '<text x="' + (1595 + Math.sin(a) * (visibleVolumeR + 48)).toFixed(1) + '" y="' + (250 - Math.cos(a) * (visibleVolumeR + 48)).toFixed(1) + '">' + i + '</text>';
        }).join("") + '</g><text x="1595" y="' + (244 + visibleVolumeR + 59) + '" font-family="Arial" font-size="15" font-weight="700" letter-spacing="3.1" fill="' + controlInk + '" text-anchor="middle">MASTER VOLUME</text>' +
        lowerControls + '<text x="1900" y="510" font-family="Georgia" font-size="20" font-style="italic" fill="' + sub + '" text-anchor="end">' + spec.tagline + '</text>' +
        '<g pointer-events="none" fill="#2d3034" stroke="#a5a7a8"><circle cx="48" cy="48" r="7"/><circle cx="1952" cy="48" r="7"/><circle cx="48" cy="512" r="7"/><circle cx="1952" cy="512" r="7"/></g>' +
        '</svg>';
}

const MFA_AMPS = [
    { id: "e303", brand: "ACCUPHASE", model: "E-303", pill: "TR · E-303 TRIBUTE", face: "champagne", wood: true, signature: "accuphase", visibleVolumeR: 126, tagline: "precision stereo control", desc: "빠른 과도응답과 개방적인 상단을 노린 정밀 제어형 사운드", drive: 1.03, k: .06, asym: 0, bass: [65, .2], lowMid: [250, 0, .82], mid: [1100, 0, 1], presence: [3400, .4, .9], treble: [11000, .6], out: .96 }
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
        '<rect x="' + (x - 7) + '" y="167" width="398" height="216" rx="7" fill="#010305" stroke="#2c343b" stroke-width="6"/>' +
        '<rect x="' + x + '" y="174" width="384" height="202" rx="4" fill="#05080b" stroke="#10151a" stroke-width="12"/>' +
        '<rect x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="url(#ma2375MeterBlue)" opacity=".34"/>' +
        '<g opacity=".74"><rect class="ampLamp ma2375-meter-light" data-lz-off=".018" data-lz-on=".48" x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="url(#ma2375MeterLamp)" opacity=".018" filter="url(#ma2375BlueGlow)"/></g>' +
        '<rect x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="url(#ma2375MeterVignette)" opacity=".76" pointer-events="none"/>' +
        '<rect x="' + (x + 22) + '" y="196" width="340" height="158" rx="2" fill="none" stroke="#8edcff" stroke-width="1.5" opacity=".15"/>' +
        '<path class="ma2375-meter-arc" d="M' + (x + 51) + ' 288 A150 50 0 0 1 ' + (x + 333) + ' 288" fill="none" stroke="#153e5b" stroke-width="2"/>' + ticks +
        '<g font-family="Arial" fill="#11334d" text-anchor="middle"><text x="' + (x + 57) + '" y="282" font-size="14" font-weight="700">.075</text><text x="' + (x + 126) + '" y="252" font-size="14" font-weight="700">.75</text><text x="' + (x + 258) + '" y="252" font-size="14" font-weight="700">7.5</text><text x="' + (x + 327) + '" y="282" font-size="14" font-weight="700">75</text><text x="' + cx + '" y="213" font-size="13" font-weight="700" letter-spacing="3">WATTS</text><text x="' + cx + '" y="316" font-size="13" font-weight="700" letter-spacing="2.5">DECIBELS</text><text x="' + cx + '" y="340" font-size="16" font-weight="700" letter-spacing="2">POWER OUTPUT</text></g>' +
        '<line id="' + needleId + '" data-cx="' + cx + '" data-cy="' + cy + '" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="248" stroke="#071019" stroke-width="4" transform="rotate(-42 ' + cx + ' ' + cy + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#101820" stroke="#5c829c" stroke-width="2"/>' +
        '<rect class="meterDark" x="' + (x + 15) + '" y="189" width="354" height="172" rx="2" fill="#02070c" opacity=".56" pointer-events="none"/>' +
        '<path d="M' + (x + 24) + ' 199 H' + (x + 360) + '" stroke="#fff" stroke-width="2" opacity=".14"/>' +
        '<path d="M' + (x + 24) + ' 199 L' + (x + 158) + ' 199 L' + (x + 96) + ' 354 L' + (x + 24) + ' 354 Z" fill="#fff" opacity=".035" pointer-events="none"/>' +
        '<path d="M' + (x + 34) + ' 207 C' + (x + 118) + ' 190 ' + (x + 220) + ' 195 ' + (x + 326) + ' 217" fill="none" stroke="#dff7ff" stroke-width="3" opacity=".075" pointer-events="none"/>' +
        '</g>';
}

function mfaMa2375Tube(cx, baseY, scale, cage) {
    const w = 92 * scale, h = 220 * scale, top = baseY - h;
    const cageRx = w * .74, cageRy = 12 * scale;
    const ringYs = Array.from({ length: 6 }, (_, i) => top + 24 * scale + i * 32 * scale);
    const cageRear = cage ?
        '<g fill="none" stroke="url(#ma2375Cage)" stroke-width="' + (4.8 * scale).toFixed(1) + '" opacity=".27">' +
        ringYs.map((y) => '<ellipse cx="' + cx + '" cy="' + y.toFixed(1) + '" rx="' + cageRx.toFixed(1) + '" ry="' + cageRy.toFixed(1) + '"/>').join("") +
        '<path d="M' + (cx - w * .67).toFixed(1) + ' ' + (top + 20 * scale).toFixed(1) + ' V' + baseY + ' M' + (cx + w * .67).toFixed(1) + ' ' + (top + 20 * scale).toFixed(1) + ' V' + baseY + '"/></g>' : '';
    const cageFront = cage ?
        '<g fill="none" stroke="url(#ma2375Cage)" stroke-width="' + (5.2 * scale).toFixed(1) + '" opacity=".64" stroke-linecap="round">' +
        ringYs.map((y) => '<path d="M' + (cx - cageRx).toFixed(1) + ' ' + y.toFixed(1) + ' A' + cageRx.toFixed(1) + ' ' + cageRy.toFixed(1) + ' 0 0 0 ' + (cx + cageRx).toFixed(1) + ' ' + y.toFixed(1) + '"/>').join("") +
        '<path d="M' + (cx - w * .22).toFixed(1) + ' ' + (top + 10 * scale).toFixed(1) + ' V' + baseY + ' M' + (cx + w * .22).toFixed(1) + ' ' + (top + 10 * scale).toFixed(1) + ' V' + baseY + '"/>' +
        '<path d="M' + (cx - w * .82).toFixed(1) + ' ' + baseY + ' A' + (w * .82).toFixed(1) + ' ' + (15 * scale).toFixed(1) + ' 0 0 0 ' + (cx + w * .82).toFixed(1) + ' ' + baseY + '"/></g>' : '';
    return '<g>' +
        '<ellipse cx="' + cx + '" cy="' + (baseY + 8 * scale).toFixed(1) + '" rx="' + (w * .72).toFixed(1) + '" ry="' + (13 * scale).toFixed(1) + '" fill="#000" opacity=".62" filter="url(#ma2375KnobShadow)"/>' +
        cageRear +
        '<ellipse class="ampGlow" data-lz-off=".008" data-lz-on=".105" cx="' + cx + '" cy="' + (baseY - h * .19).toFixed(1) + '" rx="' + (w * .43).toFixed(1) + '" ry="' + (h * .16).toFixed(1) + '" fill="#66c985" opacity=".008" filter="url(#ma2375TubeGlow)"/>' +
        '<rect x="' + (cx - w * .46).toFixed(1) + '" y="' + (top + h * .18).toFixed(1) + '" width="' + (w * .92).toFixed(1) + '" height="' + (h * .73).toFixed(1) + '" rx="' + (w * .38).toFixed(1) + '" fill="url(#ma2375TubeGlass)" stroke="#aab3ba" stroke-width="2" opacity=".86"/>' +
        '<ellipse cx="' + cx + '" cy="' + (top + h * .19).toFixed(1) + '" rx="' + (w * .44).toFixed(1) + '" ry="' + (w * .18).toFixed(1) + '" fill="#cad1d4" opacity=".32"/>' +
        '<ellipse cx="' + (cx + w * .08).toFixed(1) + '" cy="' + (top + h * .27).toFixed(1) + '" rx="' + (w * .3).toFixed(1) + '" ry="' + (w * .11).toFixed(1) + '" fill="#b7c1c0" opacity=".13"/>' +
        '<rect x="' + (cx - w * .24).toFixed(1) + '" y="' + (top + h * .34).toFixed(1) + '" width="' + (w * .48).toFixed(1) + '" height="' + (h * .46).toFixed(1) + '" rx="5" fill="#272d30" stroke="#777f81" opacity=".82"/>' +
        '<g stroke="#8b9294" stroke-width="' + Math.max(1, 1.2 * scale).toFixed(1) + '" opacity=".58"><path d="M' + (cx - w * .2).toFixed(1) + ' ' + (top + h * .44).toFixed(1) + ' H' + (cx + w * .2).toFixed(1) + ' M' + (cx - w * .2).toFixed(1) + ' ' + (top + h * .52).toFixed(1) + ' H' + (cx + w * .2).toFixed(1) + ' M' + (cx - w * .2).toFixed(1) + ' ' + (top + h * .6).toFixed(1) + ' H' + (cx + w * .2).toFixed(1) + ' M' + cx + ' ' + (top + h * .37).toFixed(1) + ' V' + (baseY - h * .14).toFixed(1) + '"/></g>' +
        '<path d="M' + (cx - w * .28).toFixed(1) + ' ' + (top + h * .28).toFixed(1) + ' Q' + (cx - w * .42).toFixed(1) + ' ' + (top + h * .52).toFixed(1) + ' ' + (cx - w * .24).toFixed(1) + ' ' + (top + h * .72).toFixed(1) + '" fill="none" stroke="#fff" stroke-width="' + (2.2 * scale).toFixed(1) + '" opacity=".25"/>' +
        '<path class="ampFil" d="M' + (cx - w * .14).toFixed(1) + ' ' + (baseY - h * .18).toFixed(1) + ' Q' + cx + ' ' + (baseY - h * .48).toFixed(1) + ' ' + (cx + w * .14).toFixed(1) + ' ' + (baseY - h * .18).toFixed(1) + '" fill="none" stroke="#ff913d" stroke-width="' + (5 * scale).toFixed(1) + '" opacity=".04"/>' +
        '<circle class="ampFilHot" cx="' + cx + '" cy="' + (baseY - h * .22).toFixed(1) + '" r="' + (7 * scale).toFixed(1) + '" fill="#ffd27a" opacity=".02"/>' +
        '<rect x="' + (cx - w * .52).toFixed(1) + '" y="' + (baseY - h * .1).toFixed(1) + '" width="' + (w * 1.04).toFixed(1) + '" height="' + (h * .12).toFixed(1) + '" rx="7" fill="#111416" stroke="#8d9295" stroke-width="2"/>' + cageFront + '</g>';
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
        '<path d="M' + (x - 40) + ' 654 L' + (x + 40) + ' 654 L' + (x + 52) + ' 802 L' + (x - 52) + ' 802 Z" fill="#171b1f" opacity=".2" filter="url(#ma2375Smudge)"/>' +
        '<path d="M' + (x - 18) + ' 656 L' + (x + 18) + ' 656 L' + (x + 24) + ' 796 L' + (x - 24) + ' 796 Z" fill="#0b0e11" opacity=".16" filter="url(#ma2375Smudge)"/>' +
        '<g opacity=".12"><ellipse class="ampGlow" data-lz-off=".004" data-lz-on=".045" cx="' + x + '" cy="686" rx="28" ry="15" fill="#66c985" opacity=".004" filter="url(#ma2375TubeGlow)"/></g>'
    ).join("") +
        '<g opacity=".07"><ellipse class="ampLamp" data-lz-off=".006" data-lz-on=".12" cx="442" cy="706" rx="142" ry="36" fill="url(#ma2375MeterBlue)" opacity=".006" filter="url(#ma2375Smudge)"/><ellipse class="ampLamp" data-lz-off=".006" data-lz-on=".12" cx="1558" cy="706" rx="142" ry="36" fill="url(#ma2375MeterBlue)" opacity=".006" filter="url(#ma2375Smudge)"/></g>';
    const eqKnobs = [720, 860, 1000, 1140, 1280].map((x) => mfaMa2375Knob(x, 690, 34, { depth: 40 })).join("");
    const scale = 1.076, offsetX = -76;
    const volumeX = offsetX + 1700 * scale;
    const volumeY = 690 * scale;
    const volumeR = 70 * scale;
    const volumeDepth = 70 * scale;
    return `<svg class="amp-svg ma2375-svg" viewBox="0 0 2000 1080" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="McIntosh MA2375 KT88 진공관 인티그레이티드 앰프 정면">
    <defs>
        <linearGradient id="ma2375Backdrop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14171b"/><stop offset=".68" stop-color="#07090c"/><stop offset="1" stop-color="#020304"/></linearGradient>
        <linearGradient id="ma2375Glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03070b"/><stop offset=".35" stop-color="#111820"/><stop offset=".55" stop-color="#020406"/><stop offset="1" stop-color="#0b0e12"/></linearGradient>
        <linearGradient id="ma2375Steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#545a5e"/><stop offset=".07" stop-color="#899094"/><stop offset=".16" stop-color="#d5d8d6"/><stop offset=".31" stop-color="#b7bcbd"/><stop offset=".47" stop-color="#d9dcda"/><stop offset=".64" stop-color="#979da0"/><stop offset=".78" stop-color="#cbd0ce"/><stop offset=".91" stop-color="#a9afb0"/><stop offset="1" stop-color="#6d7478"/></linearGradient>
        <linearGradient id="ma2375SteelBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#555b5e"/><stop offset=".14" stop-color="#d4d7d4"/><stop offset=".5" stop-color="#8f9597"/><stop offset=".82" stop-color="#d9dbd8"/><stop offset="1" stop-color="#50565a"/></linearGradient>
        <linearGradient id="ma2375LowerFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dcda"/><stop offset=".1" stop-color="#c5c9c8"/><stop offset=".26" stop-color="#9ea5a8"/><stop offset=".46" stop-color="#747c81"/><stop offset=".62" stop-color="#626a70"/><stop offset=".78" stop-color="#aeb3b2"/><stop offset=".9" stop-color="#8c9396"/><stop offset="1" stop-color="#343a3e"/></linearGradient>
        <linearGradient id="ma2375GlassRefl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14181c" stop-opacity=".62"/><stop offset="1" stop-color="#14181c" stop-opacity="0"/></linearGradient>
        <linearGradient id="ma2375Edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#63666a"/><stop offset=".35" stop-color="#f0f0ed"/><stop offset=".62" stop-color="#96999c"/><stop offset="1" stop-color="#3d4044"/></linearGradient>
        <linearGradient id="ma2375Cage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34383b"/><stop offset=".2" stop-color="#cfd3d1"/><stop offset=".45" stop-color="#777d80"/><stop offset=".72" stop-color="#d7dad7"/><stop offset="1" stop-color="#43494c"/></linearGradient>
        <radialGradient id="ma2375Chrome"><stop offset="0" stop-color="#d9dcda"/><stop offset=".42" stop-color="#92989b"/><stop offset=".75" stop-color="#34393d"/><stop offset="1" stop-color="#c3c7c5"/></radialGradient>
        <linearGradient id="ma2375KnobSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101214"/><stop offset=".08" stop-color="#5d6164"/><stop offset=".17" stop-color="#f1f2f0"/><stop offset=".25" stop-color="#fdfdfb"/><stop offset=".36" stop-color="#8d9296"/><stop offset=".5" stop-color="#43474b"/><stop offset=".63" stop-color="#c6c9c9"/><stop offset=".78" stop-color="#f2f2ef"/><stop offset=".9" stop-color="#787d81"/><stop offset="1" stop-color="#0c0e10"/></linearGradient>
        <linearGradient id="ma2375KnobSkirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#191b1d"/><stop offset=".1" stop-color="#8d9194"/><stop offset=".2" stop-color="#f7f7f4"/><stop offset=".34" stop-color="#b1b5b8"/><stop offset=".5" stop-color="#585d61"/><stop offset=".66" stop-color="#d4d6d5"/><stop offset=".8" stop-color="#fafaf7"/><stop offset=".92" stop-color="#84888c"/><stop offset="1" stop-color="#121416"/></linearGradient>
        <linearGradient id="ma2375KnobBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#c8cbcc"/><stop offset=".62" stop-color="#5d6266"/><stop offset=".85" stop-color="#9ea3a6"/><stop offset="1" stop-color="#e8e9e7"/></linearGradient>
        <radialGradient id="ma2375KnobCap" cx="34%" cy="26%" r="82%"><stop offset="0" stop-color="#484d52"/><stop offset=".3" stop-color="#212529"/><stop offset=".62" stop-color="#0d0f12"/><stop offset="1" stop-color="#010203"/></radialGradient>
        <linearGradient id="ma2375MeterBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04131f"/><stop offset=".09" stop-color="#0b3450"/><stop offset=".3" stop-color="#279cc7"/><stop offset=".64" stop-color="#157daf"/><stop offset=".9" stop-color="#0a426b"/><stop offset="1" stop-color="#03121e"/></linearGradient>
        <radialGradient id="ma2375MeterLamp" cx="46%" cy="38%" r="78%"><stop offset="0" stop-color="#65c7df"/><stop offset=".48" stop-color="#2c99c1"/><stop offset=".82" stop-color="#0d547f"/><stop offset="1" stop-color="#04253d"/></radialGradient>
        <radialGradient id="ma2375MeterVignette" cx="50%" cy="48%" r="72%"><stop offset=".54" stop-color="#000" stop-opacity="0"/><stop offset=".84" stop-color="#00111f" stop-opacity=".34"/><stop offset="1" stop-color="#00070d" stop-opacity=".88"/></radialGradient>
        <linearGradient id="ma2375TubeGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101519"/><stop offset=".25" stop-color="#e8f1ef" stop-opacity=".34"/><stop offset=".48" stop-color="#252b2f" stop-opacity=".82"/><stop offset=".75" stop-color="#dfe8e7" stop-opacity=".28"/><stop offset="1" stop-color="#090d10"/></linearGradient>
        <pattern id="ma2375Brush" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5 H7 M0 3.5 H7 M0 6.5 H7" stroke="#fff" stroke-width=".55" opacity=".16"/><path d="M0 2 H7 M0 5 H7" stroke="#202326" stroke-width=".45" opacity=".12"/></pattern>
        <pattern id="ma2375Vent" width="22" height="18" patternUnits="userSpaceOnUse"><ellipse cx="6" cy="6" rx="3.2" ry="2.2" fill="#010203"/><ellipse cx="17" cy="15" rx="3.2" ry="2.2" fill="#010203"/><ellipse cx="6" cy="6" rx="2" ry="1.2" fill="#3a4045" opacity=".4"/></pattern>
        <filter id="ma2375Shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="24"/></filter>
        <filter id="ma2375BlueGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="ma2375TubeGlow" x="-80%" y="-60%" width="260%" height="240%"><feGaussianBlur stdDeviation="16"/></filter>
        <filter id="ma2375LetterGlow" x="-80%" y="-120%" width="260%" height="340%"><feGaussianBlur stdDeviation="4.5"/></filter>
        <filter id="ma2375DisplayGlow" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter>
        <filter id="ma2375DisplayShadow" x="-20%" y="-40%" width="140%" height="200%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity=".78"/></filter>
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
    <rect x="222" y="390" width="1556" height="218" rx="5" fill="url(#ma2375Vent)" opacity=".52"/>
    <path d="M230 144 L610 144 L420 626 H230 Z" fill="#fff" opacity=".025" pointer-events="none"/><path d="M1310 144 H1768 V626 H1456 Z" fill="#8ad6ff" opacity=".018" pointer-events="none"/>
    <rect x="180" y="112" width="36" height="536" fill="url(#ma2375SteelBand)" opacity=".92"/>
    <rect x="1784" y="112" width="36" height="536" fill="url(#ma2375SteelBand)" opacity=".92"/>
    <path d="M218 139 H1782" stroke="#fff" stroke-width="4" opacity=".11"/>
    ${mfaMa2375Meter(250, "ampVuL")}${mfaMa2375Meter(1366, "ampVuR")}
    <g class="ampLegend ma2375-lettering" data-lz-off=".18" data-lz-on=".78" text-anchor="middle">
        <g fill="#62c783" opacity=".14" filter="url(#ma2375LetterGlow)"><text x="1000" y="252" font-family="Georgia" font-size="58" font-style="italic">McIntosh</text><text x="1000" y="291" font-family="Arial" font-size="19" font-weight="700" letter-spacing="8">MA2375</text><text x="1000" y="320" font-family="Arial" font-size="14" font-weight="700" letter-spacing="3.5">TUBE INTEGRATED AMPLIFIER</text></g>
        <text x="1000" y="252" font-family="Georgia" font-size="58" font-style="italic" fill="#66cc86" stroke="#235437" stroke-width="1">McIntosh</text><text x="1000" y="291" font-family="Arial" font-size="19" font-weight="700" letter-spacing="8" fill="#56b975">MA2375</text><text x="1000" y="320" font-family="Arial" font-size="14" font-weight="700" letter-spacing="3.5" fill="#51aa6d">TUBE INTEGRATED AMPLIFIER</text>
    </g><circle cx="1000" cy="344" r="4" fill="#b52c27"/>
    <g filter="url(#ma2375DisplayShadow)"><rect x="740" y="402" width="520" height="112" rx="4" fill="#010405" stroke="#202b30" stroke-width="3"/><rect x="750" y="412" width="500" height="92" rx="2" fill="#02090b" stroke="#0b2026" stroke-width="1.5"/>
        <path d="M760 420 H1240" stroke="#8ceaf1" stroke-width="1.5" opacity=".09"/><path d="M760 496 H1240" stroke="#051417" stroke-width="2"/><path d="M920 422 V494 M1080 422 V494" stroke="#153037" opacity=".42"/>
        <g font-family="Arial" font-size="10" font-weight="700" letter-spacing="2" fill="#527b81"><text x="770" y="438">INPUT</text><text x="1230" y="438" text-anchor="end">LEVEL</text><text x="1000" y="438" text-anchor="middle">UNITY COUPLED</text></g>
        <text x="1000" y="474" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#3c7779" text-anchor="middle">5-BAND TONE CONTROL</text>
        <path d="M756 418 L900 418 L860 500 H756 Z" fill="#a9eff5" opacity=".018" pointer-events="none"/>
    </g>
    <g class="ampLegend ma2375-display-readout" data-lz-off=".15" data-lz-on=".74" font-family="monospace" font-size="27">
        <g fill="#66cbd0" opacity=".18" filter="url(#ma2375DisplayGlow)"><text id="ma2375SourceGlow" x="770" y="472">Tuner</text><text id="ma2375VolumeGlow" x="1230" y="472" text-anchor="end">100%</text></g>
        <g fill="#71cdd1"><text id="ma2375SourceText" x="770" y="472">Tuner</text><text id="ma2375VolumeText" x="1230" y="472" text-anchor="end">100%</text></g>
    </g>
    ${powerTubes}
    <path d="M103 632 H1897 L1920 812 H80 Z" fill="url(#ma2375Steel)" stroke="#202326" stroke-width="8"/>
    <path d="M103 632 H1897 L1920 812 H80 Z" fill="url(#ma2375Brush)" opacity=".18" pointer-events="none"/>
    <path d="M104 634 H1896 L1903 700 H97 Z" fill="url(#ma2375GlassRefl)"/>
    ${tubeRefl}
    <path d="M113 649 H1887" stroke="#fff" stroke-width="3" opacity=".46"/>
    <path d="M113 654 H1887" stroke="#4a4f53" stroke-width="2" opacity=".5"/>
    <rect class="ma2375-lower-chassis" x="80" y="812" width="1840" height="153" fill="url(#ma2375LowerFace)" stroke="#24272a" stroke-width="7"/>
    <rect x="84" y="816" width="1832" height="143" fill="url(#ma2375Brush)" opacity=".16" pointer-events="none"/>
    <path d="M80 808 H1920" stroke="#4d5357" stroke-width="4" opacity=".9"/><path d="M84 815 H1916" stroke="#e1e3e0" stroke-width="2" opacity=".42"/><path d="M84 958 H1916" stroke="#1b1e21" stroke-width="7" opacity=".8"/>
    <g pointer-events="none" fill="#111417" stroke="#444a4d" stroke-width="2"><rect x="142" y="942" width="172" height="34" rx="8"/><rect x="1686" y="942" width="172" height="34" rx="8"/></g>
    ${mfaMa2375Knob(300, 690, 70, { depth: 70 })}
    <circle cx="540" cy="707" r="26" fill="url(#ma2375KnobSkirt)" stroke="#212427" stroke-width="2"/><circle cx="540" cy="707" r="17" fill="#0b0d0e"/><circle cx="540" cy="707" r="10" fill="#010203"/><ellipse cx="534" cy="700" rx="6" ry="4" fill="#fff" opacity=".2"/>
    ${eqKnobs}
    <g font-family="Arial" font-weight="700" text-anchor="middle" fill="#2b3033"><text x="300" y="806" font-size="15" letter-spacing="3.5">PUSH · TRIM</text><text x="540" y="674" font-size="14" letter-spacing="1.7">HEADPHONES</text><text x="720" y="780" font-size="14">30Hz</text><text x="860" y="780" font-size="14">250Hz</text><text x="1000" y="780" font-size="14">1kHz</text><text x="1140" y="780" font-size="14">4kHz</text><text x="1280" y="780" font-size="14">10kHz</text><text x="1700" y="806" font-size="15" letter-spacing="3.5">PUSH · POWER</text></g>
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
        return '<rect x="' + (d[0] + 3) + '" y="' + (y + 7) + '" width="' + w + '" height="72" rx="7" fill="#000" opacity=".38" filter="url(#lzSoft)" pointer-events="none"/>' +
            '<rect id="' + d[1] + '" x="' + d[0] + '" y="' + y + '" width="' + w + '" height="72" rx="6" fill="' + fill + '" stroke="' + (i === 5 ? '#9a473d' : '#62666c') + '" stroke-width="2" style="cursor:pointer;touch-action:none"><title>' + d[2] + '</title></rect>' +
            '<path d="M' + (d[0] + 8) + ' ' + (y + 8) + ' H' + (d[0] + w - 8) + '" stroke="#fff" stroke-width="2" opacity=".2" pointer-events="none"/>' +
            (i === 5 ? '<circle cx="1008" cy="' + (y + 36) + '" r="14" fill="#d13c2d" pointer-events="none"/>' : '<path d="' + d[3] + '" fill="#d6d7d8" stroke="#d6d7d8" stroke-width="4" stroke-linejoin="round" pointer-events="none" transform="translate(0 ' + (y - 430) + ')"/>');
    }).join("") + '</g>';
}

function mfaDeckSvg(spec) {
    const uid = "mfaD" + spec.id;
    const pale = spec.face === "silver" || spec.face === "champagne";
    const top = spec.face === "silver" ? "#e8e6df" : spec.face === "champagne" ? "#d9c59b" : "#23252a";
    const bot = spec.face === "silver" ? "#85878a" : spec.face === "champagne" ? "#8d7850" : "#090a0d";
    const ink = pale ? "#242628" : "#ece9e2";
    const sub = pale ? "#505357" : "#b1b4bb";
    const doorStroke = spec.signature === "tandberg" ? "#8a714a" : spec.signature === "sony" ? "#8a816c" : "#60656b";
    const tapeDoor = spec.openTransport
        ? '<g><rect x="438" y="112" width="584" height="262" rx="10" fill="#000" opacity=".42" filter="url(#lzSoft)"/>' +
            '<rect x="442" y="116" width="576" height="254" rx="9" fill="url(#' + uid + 'DoorFrame)" stroke="' + doorStroke + '" stroke-width="3"/>' +
            '<rect x="454" y="126" width="552" height="230" rx="6" fill="url(#' + uid + 'Well)" stroke="#090a0c" stroke-width="3"/>' +
            '<path d="M464 136 H996" stroke="#fff" stroke-width="2" opacity=".11"/><circle cx="470" cy="342" r="5" fill="#2a2d31" stroke="#8c9095"/><circle cx="990" cy="342" r="5" fill="#2a2d31" stroke="#8c9095"/>' +
            '<rect x="480" y="142" width="500" height="68" rx="4" fill="url(#' + uid + 'Label)"/><path d="M486 150 H974" stroke="#fff" stroke-width="2" opacity=".3"/>' +
            '<text id="deckLabel" x="730" y="171" font-family="Arial" font-size="18" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text><text id="deckLabelSub" x="730" y="198" font-family="Arial" font-size="13" font-weight="700" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text></g>'
        : '<g><rect x="412" y="82" width="636" height="326" rx="12" fill="#000" opacity=".4" filter="url(#lzSoft)"/>' +
            '<rect x="416" y="86" width="628" height="318" rx="11" fill="url(#' + uid + 'DoorFrame)" stroke="' + doorStroke + '" stroke-width="3"/>' +
            '<rect x="440" y="104" width="580" height="280" rx="8" fill="url(#' + uid + 'Well)" stroke="#111317" stroke-width="3"/>' +
            '<path d="M450 114 H1010" stroke="#fff" stroke-width="3" opacity=".12"/><rect x="480" y="134" width="500" height="70" rx="4" fill="url(#' + uid + 'Label)"/>' +
            '<text id="deckLabel" x="730" y="165" font-family="Arial" font-size="18" font-weight="700" fill="#3a2b1e" text-anchor="middle">C-30 공테이프</text><text id="deckLabelSub" x="730" y="192" font-family="Arial" font-size="13" font-weight="700" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>' +
            '<polygon points="445,108 720,108 590,382 445,382" fill="url(#' + uid + 'Glass)" opacity=".75" pointer-events="none"/></g>';
    const reels = '<rect x="512" y="208" width="436" height="108" rx="54" fill="#07090b" stroke="#52565c" stroke-width="2"/>' +
        '<rect x="520" y="216" width="420" height="92" rx="46" fill="#0d0e11" stroke="#24272c"/><path d="M532 226 H928" stroke="#fff" stroke-width="2" opacity=".08"/>' +
        '<circle id="deckPackL" cx="610" cy="260" r="40" fill="url(#' + uid + 'Pack)" stroke="#070707" stroke-width="2"/><circle id="deckPackR" cx="850" cy="260" r="24" fill="url(#' + uid + 'Pack)" stroke="#070707" stroke-width="2"/>' +
        '<g id="deckReelL"><circle cx="610" cy="260" r="20" fill="url(#' + uid + 'Reel)" stroke="#55585d"/><path d="M610 244 V276 M594 260 H626 M599 249 L621 271 M621 249 L599 271" stroke="#55585d" stroke-width="4"/><circle cx="610" cy="260" r="5" fill="#111317"/></g>' +
        '<g id="deckReelR"><circle cx="850" cy="260" r="20" fill="url(#' + uid + 'Reel)" stroke="#55585d"/><path d="M850 244 V276 M834 260 H866 M839 249 L861 271 M861 249 L839 271" stroke="#55585d" stroke-width="4"/><circle cx="850" cy="260" r="5" fill="#111317"/></g>' +
        '<path d="M630 293 Q730 312 830 293" fill="none" stroke="#4b321d" stroke-width="3" opacity=".8"/>' +
        '<rect x="640" y="327" width="180" height="32" rx="7" fill="#0b0d10" stroke="#45494f"/><rect x="696" y="334" width="68" height="17" rx="3" fill="#30343a" stroke="#55595f"/>' +
        '<circle cx="663" cy="343" r="7" fill="#202328" stroke="#6d7176"/><circle cx="797" cy="343" r="7" fill="#202328" stroke="#6d7176"/><circle cx="677" cy="343" r="4" fill="#08090b"/><circle cx="783" cy="343" r="4" fill="#08090b"/>';
    const deckLedRow = (id, y) => '<g id="' + id + '" data-meter-style="segments">' + Array.from({ length: 22 }, (_, i) => {
        const hot = i >= 20;
        const warn = i >= 17 && !hot;
        const on = hot ? '#ff4c3f' : warn ? '#e5bd58' : spec.signature === 'sony' ? '#76e7ad' : '#86d0a6';
        const off = hot ? '#321617' : warn ? '#302817' : spec.signature === 'sony' ? '#10291f' : '#15251f';
        return '<rect data-meter-segment="' + i + '" data-on="' + on + '" data-off="' + off + '" x="' + (1170 + i * 23.2).toFixed(1) + '" y="' + y + '" width="17" height="18" rx="2" fill="' + off + '"/>';
    }).join('') + '</g>';
    const meterBlock = spec.ledMeters
        ? '<g><rect x="1106" y="98" width="622" height="198" rx="9" fill="#07090b" stroke="' + doorStroke + '" stroke-width="3"/>' +
            '<rect x="1118" y="110" width="598" height="174" rx="6" fill="#030607" stroke="#20262a" stroke-width="2"/><path d="M1128 120H1706" stroke="#fff" stroke-width="2" opacity=".09"/>' +
            '<text x="1417" y="139" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2.4" fill="' + (spec.signature === 'sony' ? '#80dca9' : '#86b79e') + '" text-anchor="middle">PEAK PROGRAM · dB' + (spec.signature === 'sony' ? ' · PEAK HOLD' : '') + '</text>' +
            '<g font-family="Arial" font-size="12" font-weight="700" fill="#64736d"><text x="1143" y="178">L</text><text x="1143" y="226">R</text><text x="1170" y="261">-30</text><text x="1402" y="261">-10</text><text x="1564" y="261">0</text><text x="1668" y="261" fill="#a85845">+6</text></g>' +
            deckLedRow('deckVuL', 162) + deckLedRow('deckVuR', 210) +
            '<polygon points="1124,116 1390,116 1298,278 1124,278" fill="url(#' + uid + 'Glass)" opacity=".34" pointer-events="none"/></g>'
        : mfaMeter(1120, 110, 284, 172, "deckVuL", "LEVEL L", "#e9dcb5", false) + mfaMeter(1430, 110, 284, 172, "deckVuR", "LEVEL R", "#e9dcb5", false);
    const signature = spec.signature === "revox"
        ? '<g><rect x="64" y="166" width="320" height="166" rx="6" fill="#111317" stroke="#5c6168" stroke-width="2"/>' +
            '<g fill="url(#' + uid + 'Key)" stroke="#747981">' + Array.from({length: 12}, (_, i) => '<rect id="deckKeyR' + i + '" x="' + (78 + (i % 6) * 49) + '" y="' + (184 + Math.floor(i / 6) * 60) + '" width="39" height="46" rx="4"' + ([6, 7, 9, 11].includes(i) ? ' style="cursor:pointer"' : '') + '/>').join("") + '</g>' +
            '<g fill="#86d4ad">' + Array.from({length: 6}, (_, i) => '<circle cx="' + (97 + i * 49) + '" cy="197" r="3.5"/>').join("") + '</g>' +
            '<g font-family="Arial Narrow,Arial" font-size="13" font-weight="700" fill="#adb2b8" text-anchor="middle"><text x="97" y="222">BIAS</text><text x="146" y="222">EQ</text><text x="195" y="222">CAL</text><text x="244" y="222">MON</text><text x="293" y="222">MPX</text><text x="342" y="222">NR</text><text x="97" y="282">MEM</text><text x="146" y="282">CUE</text><text x="195" y="282">REP</text><text x="244" y="282">AUTO</text><text x="293" y="282">TIME</text><text x="342" y="282">RST</text></g></g>'
        : spec.signature === "tandberg"
            ? '<g><rect x="64" y="166" width="320" height="166" rx="6" fill="#0a0b0d" stroke="#8a714a" stroke-width="2"/><path d="M78 186 H370 M78 309 H370" stroke="#a78651" opacity=".7"/>' +
                '<g>' + [0, 1, 2, 3].map(i => '<circle cx="' + (106 + i * 74) + '" cy="238" r="29" fill="#111317" stroke="#8a8d91"/><circle cx="' + (106 + i * 74) + '" cy="238" r="21" fill="url(#' + uid + 'Reel)"/><path d="M' + (106 + i * 74) + ' 220 V228" stroke="#403a2e" stroke-width="3"/>').join("") + '</g>' +
                '<g font-family="Arial" font-size="13" font-weight="700" fill="#c3ad81" text-anchor="middle"><text x="106" y="293">BIAS</text><text x="180" y="293">LEVEL L</text><text x="254" y="293">LEVEL R</text><text x="328" y="293">OUTPUT</text></g></g>'
            : spec.signature === "sony"
                ? '<g><rect x="64" y="166" width="320" height="166" rx="6" fill="#17191c" stroke="#756d5b" stroke-width="2"/>' +
                    '<rect x="78" y="182" width="292" height="62" rx="4" fill="#030607" stroke="#35433c"/><text x="224" y="219" font-family="Courier New" font-size="21" font-weight="700" fill="#85e7b0" text-anchor="middle">AUTO CAL · HX PRO</text>' +
                    '<circle cx="130" cy="284" r="31" fill="url(#' + uid + 'Reel)" stroke="#4d5054" stroke-width="2"/><path d="M130 257 V271" stroke="#33363a" stroke-width="4"/>' +
                    '<g fill="url(#' + uid + 'Key)" stroke="#777a7f"><rect x="190" y="262" width="48" height="42" rx="4"/><rect x="250" y="262" width="48" height="42" rx="4"/><rect x="310" y="262" width="48" height="42" rx="4"/></g>' +
                    '<g font-family="Arial" font-size="13" font-weight="700" fill="#c1bba9" text-anchor="middle"><text x="130" y="327">CAL LEVEL</text><text x="214" y="324">BIAS</text><text x="274" y="324">EQ</text><text x="334" y="324">NR</text></g></g>'
                : '<g>' + [0,1,2,3].map(i => mfaSvgKnob(104 + i * 78, 232, 27, null, 'url(#' + uid + 'Btn)', null)).join("") + '</g><g stroke="#d4d0c4" stroke-width="2.4">' + [0,1,2,3].map(i => '<line x1="' + (104 + i * 78) + '" y1="209" x2="' + (104 + i * 78) + '" y2="219"/>').join("") + '</g>';
    const doorIdentity = spec.signature === "revox"
        ? '<text x="988" y="347" font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.8" fill="#879c91" text-anchor="end">DIRECT DRIVE · 4 MOTOR</text>'
        : spec.signature === "tandberg"
            ? '<text x="988" y="347" font-family="Georgia" font-size="11" font-style="italic" letter-spacing="1.2" fill="#b79b68" text-anchor="end">ACTILINEAR · DYNEQ</text>'
            : spec.signature === "sony"
                ? '<g pointer-events="none"><text x="936" y="374" font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.5" fill="#9b8b67" text-anchor="end">CLOSED LOOP · DUAL CAPSTAN</text><rect x="952" y="353" width="47" height="25" rx="3" fill="#332d21" stroke="#b19b69"/><text x="975.5" y="371" font-family="Georgia" font-size="16" font-weight="700" font-style="italic" fill="#d7c286" text-anchor="middle">ES</text></g>'
                : '';
    const architecture = spec.signature === "revox" ? "3 HEAD · DIRECT DRIVE · 4 MOTOR"
        : spec.signature === "tandberg" ? "3 HEAD · ACTILINEAR · DYNEQ"
            : spec.signature === "sony" ? "3 HEAD · CLOSED LOOP · DUAL CAPSTAN" : "3 HEAD CASSETTE DECK";
    const modelDetail = spec.signature === "revox"
        ? '<path d="M400 44 V404 M1060 44 V404" stroke="#5f6369" stroke-width="2" opacity=".5"/><text x="1940" y="89" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#9ca1a7" text-anchor="end">MICROPROCESSOR CONTROL</text>'
        : spec.signature === "tandberg"
            ? '<path d="M48 146 H1952 M48 402 H1952" stroke="#9e7b45" stroke-width="2" opacity=".65"/><text x="1940" y="89" font-family="Georgia" font-size="14" font-style="italic" fill="#c2a268" text-anchor="end">Actilinear recording system</text>'
            : '<path d="M48 146 H1952" stroke="#826e45" stroke-width="2" opacity=".55"/><text x="1940" y="89" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#6d624b" text-anchor="end">CLOSED LOOP DUAL CAPSTAN</text>';
    return '<svg class="deck-svg" viewBox="0 0 2000 540" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + spec.brand + ' ' + spec.model + ' 카세트 데크">' +
        '<defs><linearGradient id="' + uid + 'Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset=".08" stop-color="' + (pale ? '#d5cdbb' : '#202329') + '"/><stop offset=".5" stop-color="' + (pale ? '#b9b4a8' : '#17191d') + '"/><stop offset=".9" stop-color="' + bot + '"/><stop offset="1" stop-color="' + (pale ? '#62563f' : '#030405') + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#281208"/><stop offset=".18" stop-color="#74421f"/><stop offset=".55" stop-color="#553018"/><stop offset=".84" stop-color="#78451f"/><stop offset="1" stop-color="#1e0d05"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565a60"/><stop offset=".12" stop-color="#41454b"/><stop offset=".55" stop-color="#25282d"/><stop offset="1" stop-color="#0d0f12"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555960"/><stop offset=".2" stop-color="#3b3f45"/><stop offset="1" stop-color="#15171b"/></linearGradient>' +
        '<linearGradient id="' + uid + 'DoorFrame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#666a70"/><stop offset=".16" stop-color="#24272c"/><stop offset=".72" stop-color="#111317"/><stop offset="1" stop-color="#73777c"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Well" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020304"/><stop offset=".15" stop-color="#0a0c0f"/><stop offset=".75" stop-color="#171a1f"/><stop offset="1" stop-color="#24282e"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Glass" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".34" stop-color="#fff" stop-opacity=".045"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + uid + 'Label" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4eedc"/><stop offset=".55" stop-color="#e2dac3"/><stop offset="1" stop-color="#c7b999"/></linearGradient>' +
        '<radialGradient id="' + uid + 'Pack"><stop offset="0" stop-color="#37291b"/><stop offset=".7" stop-color="#251b11"/><stop offset="1" stop-color="#080603"/></radialGradient>' +
        '<radialGradient id="' + uid + 'Reel" cx="35%" cy="28%"><stop offset="0" stop-color="#faf9f3"/><stop offset=".48" stop-color="#aeb1b2"/><stop offset=".8" stop-color="#53575b"/><stop offset="1" stop-color="#e3e4e2"/></radialGradient>' +
        '<pattern id="' + uid + 'Hair" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5 H5 M0 3.5 H5" stroke="' + (pale ? '#fff' : '#d8dade') + '" stroke-width=".45" opacity=".085"/></pattern></defs>' +
        '<ellipse cx="1000" cy="528" rx="930" ry="20" fill="#000" opacity=".5" filter="url(#lzSoft)"/>' +
        (spec.wood ? '<rect width="2000" height="540" rx="10" fill="url(#' + uid + 'Wood)"/><path d="M0 34 Q520 8 1050 36 T2000 28 M0 516 Q600 490 1120 514 T2000 498 M0 166 Q460 138 940 164 T2000 150 M0 392 Q520 368 1100 394 T2000 380" fill="none" stroke="#a66a35" stroke-width="4" opacity=".42"/>' : '') +
        '<rect x="' + (spec.wood ? 26 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1948 : 2000) + '" height="' + (spec.wood ? 508 : 540) + '" rx="8" fill="url(#' + uid + 'Face)"/>' +
        '<rect x="' + (spec.wood ? 26 : 0) + '" y="' + (spec.wood ? 16 : 0) + '" width="' + (spec.wood ? 1948 : 2000) + '" height="' + (spec.wood ? 508 : 540) + '" rx="8" fill="url(#' + uid + 'Hair)"/>' +
        '<path d="M40 22 H1960" stroke="#fff" stroke-width="3" opacity=".3"/><path d="M40 516 H1960" stroke="#050607" stroke-width="6" opacity=".45"/>' +
        '<text x="76" y="76" font-family="Arial" font-size="31" font-weight="700" letter-spacing="2" fill="' + ink + '">' + spec.brand + '</text>' +
        '<text x="76" y="108" font-family="Arial" font-size="16" font-weight="700" letter-spacing="2.2" fill="' + sub + '">' + spec.model + '</text>' +
        '<text x="76" y="132" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1.35" fill="' + sub + '" textLength="300" lengthAdjust="spacingAndGlyphs">' + architecture + '</text>' + modelDetail +
        signature + tapeDoor + reels + doorIdentity + meterBlock +
        '<text x="1120" y="330" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="' + sub + '">TAPE COUNTER</text><rect x="1112" y="334" width="216" height="72" rx="8" fill="#111317" stroke="#65696e" stroke-width="2"/><rect x="1120" y="340" width="200" height="58" rx="6" fill="#030608" stroke="#27343a"/><path d="M1128 347 H1312" stroke="#fff" stroke-width="2" opacity=".08"/><text id="deckCounter" x="1245" y="381" font-family="Courier New" font-size="30" font-weight="700" fill="' + (spec.display || '#ff4f34') + '" text-anchor="end">00:00</text><text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="13" font-weight="700" fill="#777b80">/ 30:00</text>' +
        '<circle cx="1420" cy="369" r="13" fill="url(#' + uid + 'Reel)"/><circle cx="1420" cy="369" r="10" fill="#16090a"/><circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/><text x="1420" y="406" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.3" fill="' + sub + '" text-anchor="middle">REC</text>' +
        '<circle cx="1366" cy="369" r="10" fill="url(#' + uid + 'Reel)"/><circle cx="1366" cy="369" r="7" fill="#16090a"/><circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"/><text x="1366" y="406" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.3" fill="' + sub + '" text-anchor="middle">TIMER</text>' +
        '<rect x="406" y="418" width="666" height="98" rx="10" fill="#08090b" opacity=".45" filter="url(#lzSoft)"/><rect x="410" y="414" width="658" height="100" rx="9" fill="url(#' + uid + 'Well)" stroke="#4f5359" stroke-width="2"/><path d="M418 422 H1060" stroke="#fff" stroke-width="2" opacity=".08"/>' +
        mfaTransportButtons(430, 'url(#' + uid + 'Btn)') + '<g pointer-events="none" fill="#292c30" stroke="#a4a7aa"><circle cx="48" cy="48" r="7"/><circle cx="1952" cy="48" r="7"/><circle cx="48" cy="492" r="7"/><circle cx="1952" cy="492" r="7"/></g><g id="deckShelf"></g></svg>';
}

// PIONEER CT-F1250 전용 스킨 — 릴(610/850,260)·미터·트랜스포트 등 기능 좌표는 공용 레이아웃
// 그대로 두고, 우드 캐비닛·브러시드 알루미늄 페이스·플렉시 도어를 사진 기준 명암으로 다시 그린다.
// CT-F1250 플루로스캔 — 실물의 청록 형광 바 미터 (세그먼트 드라이버가 구동)
function ctfFluro(id, x, ch) {
    const segs = Array.from({ length: 20 }, (_, i) => {
        const hot = i > 16;
        const warn = i > 13 && !hot;
        const on = hot ? "#ff5040" : warn ? "#f2c355" : "#6fe8c8";
        const off = hot ? "#331a18" : warn ? "#33290f" : "#0d2b24";
        return '<rect data-meter-segment="' + i + '" data-on="' + on + '" data-off="' + off + '" x="' + (x + 16 + i * 12.8) + '" y="176" width="10" height="46" rx="1.5" fill="' + off + '"/>';
    }).join("");
    const scale = [["-20", 0], ["-10", 5], ["-5", 9], ["0", 14], ["+3", 18]].map(([t, i]) =>
        '<text x="' + (x + 21 + i * 12.8) + '" y="248" font-family="Arial" font-size="9" font-weight="700" fill="#3f6f5f" text-anchor="middle">' + t + '</text>').join("");
    return '<rect x="' + (x + 6) + '" y="116" width="272" height="160" rx="5" fill="#04100d"/>' +
        '<path d="M' + (x + 12) + ' 122 H' + (x + 270) + '" stroke="#6fe8c8" stroke-width="1" opacity=".14"/>' +
        '<text x="' + (x + 16) + '" y="146" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2.4" fill="#57c7a8">FLUROSCAN</text>' +
        '<text x="' + (x + 266) + '" y="146" font-family="Arial" font-size="12" font-weight="700" fill="#7de9cb" text-anchor="end">' + ch + '</text>' +
        '<path d="M' + (x + 16) + ' 158 H' + (x + 268) + '" stroke="#1b4a3d" stroke-width="1.4"/>' +
        '<g id="' + id + '" data-meter-style="segments">' + segs + '</g>' + scale +
        '<text x="' + (x + 142) + '" y="266" font-family="Arial" font-size="8" letter-spacing="2" fill="#2e5548" text-anchor="middle">FLUORESCENT PEAK LEVEL &#183; dB</text>';
}

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
            '<text x="' + x + '" y="294" font-family="Arial Narrow,Arial" font-size="13" font-weight="700" letter-spacing="0" fill="#414447" text-anchor="middle">' + lb + '</text>';
    }).join("");
    const meterFrame = (x) => '<rect x="' + (x - 18) + '" y="102" width="320" height="202" rx="12" fill="#000" opacity=".45" filter="url(#ctfContact)"/>' +
        '<rect x="' + (x - 14) + '" y="94" width="312" height="202" rx="10" fill="#101114" stroke="url(#ctfChrome)" stroke-width="3"/>' +
        '<rect x="' + (x - 10) + '" y="98" width="304" height="194" rx="8" fill="none" stroke="#000" stroke-width="2" opacity=".6"/>' +
        '<circle cx="' + (x + 1) + '" cy="109" r="4.5" fill="url(#ctfScrew)"/><circle cx="' + (x + 283) + '" cy="109" r="4.5" fill="url(#ctfScrew)"/>';
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
        <filter id="ctfContact" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <ellipse cx="1000" cy="528" rx="944" ry="18" fill="#000" opacity=".62" filter="url(#ctfContact)"/>
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
    <text x="76" y="338" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.6" fill="#595c5e">CLOSED LOOP DUAL CAPSTAN · DC SERVO</text>
    <rect x="76" y="350" width="110" height="26" rx="4" fill="#1c1e22" stroke="#54575c" stroke-width="1.2"/>
    <text x="131" y="369" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.1" fill="#d4d0c4" text-anchor="middle">DOLBY NR</text>
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
    <text id="deckLabelSub" x="730" y="197" font-family="Arial" font-size="13" font-weight="700" fill="#6b5d4a" text-anchor="middle">사용 0:00 / 30:00</text>
    <rect x="520" y="216" width="420" height="92" rx="46" fill="#08090b" stroke="#3f4248" stroke-width="2"/>
    <rect x="524" y="218" width="412" height="16" rx="8" fill="url(#lzInset)" opacity=".8"/>
    <circle id="deckPackL" cx="610" cy="260" r="40" fill="url(#ctfPack)" stroke="#070707" stroke-width="2"/>
    <circle id="deckPackR" cx="850" cy="260" r="24" fill="url(#ctfPack)" stroke="#070707" stroke-width="2"/>
    <circle cx="610" cy="260" r="21.5" fill="none" stroke="#000" stroke-width="1.5" opacity=".4"/>
    <circle cx="850" cy="260" r="21.5" fill="none" stroke="#000" stroke-width="1.5" opacity=".4"/>
    <g id="deckReelL"><circle cx="610" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M610 244 V276 M594 260 H626 M599 249 L621 271 M621 249 L599 271" stroke="#55585d" stroke-width="4"/><circle cx="610" cy="260" r="5" fill="#111317"/></g>
    <g id="deckReelR"><circle cx="850" cy="260" r="19" fill="#e4e5e6" stroke="#55585d"/><path d="M850 244 V276 M834 260 H866 M839 249 L861 271 M861 249 L839 271" stroke="#55585d" stroke-width="4"/><circle cx="850" cy="260" r="5" fill="#111317"/></g>
    <path d="M632 293 Q730 310 828 293" fill="none" stroke="#5a391e" stroke-width="3" opacity=".85"/>
    <rect x="640" y="330" width="180" height="26" rx="6" fill="#101216" stroke="#43464c"/>
    <rect x="700" y="336" width="60" height="14" rx="3" fill="#31353b"/>
    <circle cx="664" cy="343" r="8" fill="#15171a" stroke="#777b80"/><circle cx="664" cy="343" r="3" fill="#050607"/><circle cx="796" cy="343" r="8" fill="#15171a" stroke="#777b80"/><circle cx="796" cy="343" r="3" fill="#050607"/>
    <polygon points="446,120 726,120 566,366 446,366" fill="url(#ctfGlass)" pointer-events="none"/>
    <path d="M760 122 L636 364" stroke="#fff" stroke-width="7" opacity=".05" pointer-events="none"/>
    <path d="M786 122 L662 364" stroke="#fff" stroke-width="2.5" opacity=".1" pointer-events="none"/>
    <rect x="446" y="348" width="568" height="18" rx="4" fill="#000" opacity=".35"/>
    <text x="1000" y="362" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#adb1b5" text-anchor="end" opacity=".9">CT-F1250</text>
    ${meterFrame(1120)}${meterFrame(1430)}
    ${ctfFluro("deckVuL", 1120, "L")}${ctfFluro("deckVuR", 1430, "R")}
    ${meterGlass(1262)}${meterGlass(1572)}
    <text x="1120" y="330" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#4b4e51">TAPE COUNTER</text>
    <rect x="1114" y="334" width="212" height="70" rx="8" fill="#0b0c0f" stroke="url(#ctfChrome)" stroke-width="2"/>
    <rect x="1120" y="340" width="200" height="58" rx="6" fill="url(#ctfCounter)" stroke="#0a2333" stroke-width="2"/>
    <rect x="1122" y="342" width="196" height="16" rx="5" fill="#fff" opacity=".06"/>
    <text id="deckCounter" x="1245" y="381" font-family="Courier New" font-size="30" font-weight="700" fill="#58b8ff" text-anchor="end">00:00</text>
    <text id="deckCounterMax" x="1254" y="381" font-family="Arial" font-size="13" font-weight="700" fill="#6689a0">/ 30:00</text>
    <circle cx="1420" cy="369" r="13" fill="url(#ctfChrome)"/><circle cx="1420" cy="369" r="10" fill="#12080a"/><circle id="deckRecLed" cx="1420" cy="369" r="9" fill="#3a1210"/><ellipse cx="1417" cy="365" rx="3.4" ry="2.2" fill="#fff" opacity=".3"/>
    <text x="1420" y="406" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.3" fill="#4b4e51" text-anchor="middle">REC</text>
    <circle cx="1366" cy="369" r="9" fill="url(#ctfChrome)"/><circle cx="1366" cy="369" r="7" fill="#12080a"/><circle id="deckTimerLed" cx="1366" cy="369" r="6" fill="#3a1210"/>
    <text x="1366" y="406" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.1" fill="#4b4e51" text-anchor="middle">TIMER</text>
    <rect x="404" y="416" width="668" height="104" rx="12" fill="#0b0805" opacity=".5" filter="url(#ctfBlur2)"/>
    <rect x="408" y="412" width="660" height="104" rx="10" fill="url(#ctfTray)" stroke="#3c4046" stroke-width="2"/>
    <rect x="410" y="413" width="656" height="14" rx="7" fill="#000" opacity=".5"/>
    ${mfaTransportButtons(430, "url(#ctfBtn)")}
    <rect x="1102" y="420" width="862" height="96" rx="10" fill="#0b0805" opacity=".35" filter="url(#ctfBlur2)"/>
    <rect x="1106" y="424" width="854" height="88" rx="8" fill="url(#ctfTray)" opacity=".85" stroke="#3a3e44" stroke-width="1.5"/>
    <text x="1120" y="446" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2" fill="#8d9196">TAPE RACK</text>
    <g id="deckShelf"></g></svg>`;
}


// TEAC W-990RX — 더블 카세트 데크. A웰(좌)은 재생 트랜스포트, B웰(우)은 녹음 전담.
// 예약·수동 녹음이 B웰에서 돌므로 A웰 재생과 충돌하지 않는다 (엔진의 recOnB 참조).
// A웰 릴은 공용 애니메이션의 610/850,260 회전축을 부모 transform으로 실물 위치에 옮긴다.
// B웰과 LED 미터는 data 속성으로 독립 구동한다.
function mfaW990Svg() {
    const reel = (id, cx, cy, data) => `<g id="${id}" ${data || ""}>
        <circle cx="${cx}" cy="${cy}" r="21" fill="url(#w9Hub)" stroke="#303236" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="15" fill="#e2e0d9" stroke="#666b70"/>
        <path d="M${cx} ${cy - 13}V${cy + 13} M${cx - 13} ${cy}H${cx + 13} M${cx - 9} ${cy - 9}L${cx + 9} ${cy + 9} M${cx + 9} ${cy - 9}L${cx - 9} ${cy + 9}" stroke="#50545a" stroke-width="4"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#121417" stroke="#74787d"/>
    </g>`;
    const ledMeter = (id, y) => `<g id="${id}" data-meter-style="segments">
        ${Array.from({ length: 14 }, (_, i) => {
            const x = 1048 + i * 15;
            const hot = i > 11;
            const warn = i > 9 && !hot;
            const on = hot ? "#ff3a35" : warn ? "#f6b64b" : "#e8f3e7";
            const off = hot ? "#35191a" : warn ? "#362a19" : "#1d2928";
            return `<rect data-meter-segment="${i}" data-on="${on}" data-off="${off}" x="${x}" y="${y}" width="10" height="9" rx="1.5" fill="${off}"/>`;
        }).join("")}
    </g>`;
    const modeKeys = ["COUNTER", "DOLBY B", "DOLBY C", "REV MODE", "DUBBING", "SYNC", "BLANK SCAN"]
        .map((label, i) => `<g><rect id="deckModeKey${i}" x="${735 + i * 76}" y="186" width="68" height="30" rx="3" fill="url(#w9MiniBtn)" stroke="#4e5155"${i === 3 || i === 4 ? ' style="cursor:pointer"' : ''}/><path d="M${742 + i * 76} 191H${796 + i * 76}" stroke="#fff" opacity=".18"/><text x="${769 + i * 76}" y="232" font-family="Arial" font-size="8.5" font-weight="700" fill="#898d90" text-anchor="middle">${label}</text></g>`).join("");
    const transport = (id, x, label, symbol, rec) => `<g>
        <rect id="${id}" x="${x}" y="252" width="86" height="42" rx="3" fill="url(#w9Btn)" stroke="${rec ? "#9b4037" : "#5d6065"}" stroke-width="1.5" style="cursor:pointer;touch-action:none"><title>${label}</title></rect>
        <text x="${x + 43}" y="279" font-family="Arial" font-size="18" font-weight="700" fill="${rec ? "#ff4a3a" : "#d6d7d6"}" text-anchor="middle" pointer-events="none">${symbol}</text>
        <text x="${x + 43}" y="311" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.3" fill="#8d9193" text-anchor="middle">${label}</text>
    </g>`;
    return `<svg class="deck-svg" viewBox="0 0 2000 520" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="TEAC W-990RX 더블 카세트 데크">
    <defs>
        <linearGradient id="w9Face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8c9c7"/><stop offset=".06" stop-color="#8f9294"/><stop offset=".2" stop-color="#66696d"/><stop offset=".72" stop-color="#494c50"/><stop offset="1" stop-color="#26282c"/></linearGradient>
        <linearGradient id="w9Apron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5e62"/><stop offset=".08" stop-color="#3e4146"/><stop offset=".62" stop-color="#25282d"/><stop offset="1" stop-color="#101216"/></linearGradient>
        <linearGradient id="w9Frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17191d"/><stop offset=".08" stop-color="#35383d"/><stop offset=".18" stop-color="#17191d"/><stop offset="1" stop-color="#050608"/></linearGradient>
        <linearGradient id="w9Well" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030405"/><stop offset=".35" stop-color="#111419"/><stop offset="1" stop-color="#080a0d"/></linearGradient>
        <linearGradient id="w9Glass" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".2" stop-color="#fff" stop-opacity=".06"/><stop offset=".52" stop-color="#9bd6e8" stop-opacity=".015"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="w9Display" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020304"/><stop offset=".55" stop-color="#090e10"/><stop offset="1" stop-color="#11181a"/></linearGradient>
        <linearGradient id="w9DisplayGlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dff8ef" stop-opacity=".02"/><stop offset=".55" stop-color="#effff9" stop-opacity=".16"/><stop offset="1" stop-color="#ff473c" stop-opacity=".08"/></linearGradient>
        <linearGradient id="w9Btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55585d"/><stop offset=".12" stop-color="#3e4146"/><stop offset=".55" stop-color="#25282d"/><stop offset="1" stop-color="#101216"/></linearGradient>
        <linearGradient id="w9MiniBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f5257"/><stop offset=".25" stop-color="#35383d"/><stop offset="1" stop-color="#17191d"/></linearGradient>
        <linearGradient id="w9CassA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eee5c8"/><stop offset=".45" stop-color="#d6cba9"/><stop offset="1" stop-color="#998e73"/></linearGradient>
        <linearGradient id="w9CassB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ead7d3"/><stop offset=".5" stop-color="#caa6a2"/><stop offset="1" stop-color="#90716f"/></linearGradient>
        <linearGradient id="w9LabelA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eadfbf"/><stop offset=".55" stop-color="#cfc29d"/><stop offset="1" stop-color="#b2a27d"/></linearGradient>
        <linearGradient id="w9LabelB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ead4d1"/><stop offset=".58" stop-color="#c9a3a4"/><stop offset="1" stop-color="#aa7f82"/></linearGradient>
        <linearGradient id="w9Hub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8f7f1"/><stop offset=".28" stop-color="#9da1a4"/><stop offset=".58" stop-color="#ecebe4"/><stop offset="1" stop-color="#5f6368"/></linearGradient>
        <radialGradient id="w9Tape"><stop offset="0" stop-color="#513924"/><stop offset=".68" stop-color="#332214"/><stop offset=".9" stop-color="#1c120c"/><stop offset="1" stop-color="#090604"/></radialGradient>
        <radialGradient id="w9Knob"><stop offset="0" stop-color="#7e8185"/><stop offset=".3" stop-color="#303338"/><stop offset=".72" stop-color="#15171a"/><stop offset="1" stop-color="#050608"/></radialGradient>
        <pattern id="w9Brush" width="12" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5H12 M0 3.5H12" stroke="#fff" stroke-opacity=".045"/><path d="M0 2H12 M0 4.5H12" stroke="#000" stroke-opacity=".045"/></pattern>
        <clipPath id="w9ALabelClip"><rect x="226" y="104" width="396" height="48" rx="2"/></clipPath>
        <clipPath id="w9BLabelClip"><rect x="1378" y="104" width="396" height="48" rx="2"/></clipPath>
        <filter id="w9Blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
        <filter id="w9Glow" x="-70%" y="-100%" width="240%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
        <filter id="w9Contact" x="-20%" y="-30%" width="150%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/><feOffset dy="6" result="o"/><feFlood flood-color="#000" flood-opacity=".65"/><feComposite in2="o" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    <rect x="16" y="10" width="1968" height="498" rx="10" fill="#08090b" opacity=".75" filter="url(#w9Blur)"/>
    <rect x="4" y="2" width="1992" height="504" rx="9" fill="url(#w9Face)" stroke="#202226" stroke-width="3"/>
    <rect x="6" y="4" width="1988" height="502" rx="8" fill="url(#w9Brush)" opacity=".9" pointer-events="none"/>
    <path d="M14 6H1986" stroke="#fff" stroke-width="3" opacity=".62"/>
    <path d="M16 43H1984" stroke="#16181b" stroke-width="4"/><path d="M18 47H1982" stroke="#d9d9d4" stroke-width="1" opacity=".38"/>
    <text x="184" y="32" font-family="Georgia,serif" font-size="18" font-style="italic" font-weight="700" letter-spacing="1.2" fill="#3e3424">W-990RX Stereo Double Reverse Cassette Deck</text>
    <text x="1818" y="32" font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.6" fill="#393b3d" text-anchor="end">HX PRO &#183; DOLBY NOISE REDUCTION SYSTEM</text>

    <!-- 좌측 조작 레일 -->
    <rect x="20" y="56" width="120" height="334" rx="5" fill="#696c70" stroke="#323438" stroke-width="2"/>
    <rect x="24" y="60" width="112" height="326" rx="4" fill="url(#w9Brush)" opacity=".62"/>
    <text x="80" y="86" font-family="Georgia,serif" font-size="24" font-weight="700" fill="#242526" stroke="#c9b880" stroke-width=".7" paint-order="stroke" text-anchor="middle">TEAC</text>
    <text x="80" y="101" font-family="Arial" font-size="8.5" font-weight="700" letter-spacing="2" fill="#3a3c3f" text-anchor="middle">DECK I</text>
    <rect id="deckBtnEject" x="38" y="112" width="84" height="38" rx="3" fill="url(#w9Btn)" stroke="#222429" stroke-width="2" style="cursor:pointer"><title>EJECT</title></rect>
    <path d="M60 140H100 M67 132L80 121L93 132" fill="none" stroke="#d5d5d1" stroke-width="3" pointer-events="none"/>
    <text x="80" y="168" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.4" fill="#343639" text-anchor="middle">EJECT</text>
    <text x="80" y="205" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.4" fill="#343639" text-anchor="middle">POWER</text>
    <rect x="38" y="216" width="84" height="42" rx="2" fill="#17191c" stroke="#292c30"/><rect x="45" y="222" width="70" height="15" rx="2" fill="#55585b"/><path d="M48 224H112" stroke="#fff" opacity=".25"/>
    <circle cx="80" cy="292" r="8" fill="#321814" stroke="#27292c"/><circle cx="80" cy="292" r="4" fill="#7e2d20"/>
    <text x="80" y="315" font-family="Arial" font-size="8" font-weight="700" letter-spacing="1.1" fill="#343639" text-anchor="middle">TIMER STANDBY</text>
    <circle cx="43" cy="366" r="5" fill="#34363a" stroke="#b7b8b5"/><circle cx="117" cy="366" r="5" fill="#34363a" stroke="#b7b8b5"/>

    <!-- DECK A 도어와 카세트 -->
    <g filter="url(#w9Contact)">
        <rect x="154" y="56" width="540" height="276" rx="5" fill="url(#w9Frame)" stroke="#25272b" stroke-width="3"/>
        <rect x="166" y="68" width="516" height="240" rx="3" fill="url(#w9Well)" stroke="#050607" stroke-width="3"/>
        <path d="M176 78H672" stroke="#fff" opacity=".14"/>
        <path d="M198 92H650L666 108V272L650 288H198L182 272V108Z" fill="url(#w9CassA)" stroke="#8d836b" stroke-width="2"/>
        <rect x="216" y="100" width="416" height="58" rx="3" fill="url(#w9LabelA)" stroke="#776b51"/>
        <path d="M224 109H624" stroke="#f7f0dc" stroke-width="4" opacity=".7"/><path d="M224 150H624" stroke="#af3d2d" stroke-width="5" opacity=".72"/>
        <rect x="230" y="111" width="84" height="35" rx="2" fill="#203b46" opacity=".36"/><path d="M240 141L266 114L292 141Z" fill="#c37445" opacity=".7"/>
        <text id="deckLabel" x="430" y="128" font-family="Arial" font-size="14" font-weight="700" letter-spacing=".4" fill="#362e21" text-anchor="middle" clip-path="url(#w9ALabelClip)">C-30 공테이프</text>
        <text id="deckLabelSub" x="430" y="146" font-family="Arial" font-size="10" font-weight="700" fill="#6b5c43" text-anchor="middle" clip-path="url(#w9ALabelClip)">사용 0:00 / 30:00</text>
        <text x="606" y="145" font-family="Arial" font-size="20" font-weight="700" fill="#7b2f25">A</text>
        <rect id="deckWindowA" x="264" y="166" width="320" height="72" rx="31" fill="#171719" stroke="#746b5c" stroke-width="2"/>
        <circle id="deckPackL" cx="304" cy="202" r="40" fill="url(#w9Tape)" stroke="#17100b" stroke-width="2"/>
        <circle id="deckPackR" cx="544" cy="202" r="24" fill="url(#w9Tape)" stroke="#17100b" stroke-width="2"/>
        <g transform="translate(-306 -58)">${reel("deckReelL", 610, 260)}${reel("deckReelR", 850, 260)}</g>
        <path id="deckHeadA" d="M296 249H552L530 284H318Z" fill="#c5b998" stroke="#675e4f"/><rect x="383" y="257" width="82" height="17" rx="4" fill="#313236" stroke="#6c6b67"/><circle cx="340" cy="266" r="7" fill="#232528"/><circle cx="508" cy="266" r="7" fill="#232528"/>
        <g fill="#504b42" stroke="#d8ccb0" stroke-width="1.2"><circle cx="206" cy="112" r="4"/><circle cx="644" cy="112" r="4"/><circle cx="206" cy="270" r="4"/><circle cx="644" cy="270" r="4"/></g>
        <path d="M170 72H410L286 304H170Z" fill="url(#w9Glass)" pointer-events="none"/>
    </g>
    <rect x="154" y="338" width="540" height="50" rx="3" fill="#303338" stroke="#1d1f22"/>
    <path d="M166 345H682" stroke="#fff" opacity=".13"/>
    <g font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.2"><text x="180" y="361" fill="#55a87c">&#9664;</text><text x="212" y="361" fill="#b54b42">REC</text><text x="254" y="361" fill="#8e9297">PAUSE</text><text x="634" y="361" fill="#d1b747">&#9654;</text></g>
    <text x="424" y="379" font-family="Arial" font-size="9.5" font-weight="700" letter-spacing="1.5" fill="#8d9093" text-anchor="middle">COMPU AUTO REVERSE CASSETTE DECK &#183; PLAY I</text>

    <!-- 중앙 표시창과 조작부 -->
    <rect x="708" y="56" width="584" height="332" rx="5" fill="#272a2f" stroke="#1a1c20" stroke-width="3"/>
    <rect x="720" y="68" width="560" height="106" rx="4" fill="url(#w9Display)" stroke="#050607" stroke-width="3"/>
    <rect class="ampLamp" x="723" y="71" width="554" height="100" rx="3" fill="url(#w9DisplayGlow)" opacity=".03"/>
    <path d="M726 74H1274" stroke="#d7ffff" stroke-width="1.5" opacity=".12"/>
    <text x="742" y="91" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.5" fill="#7b8584">A COUNTER</text>
    <text id="deckCounter" x="844" y="125" font-family="Courier New,monospace" font-size="28" font-weight="700" letter-spacing="2" fill="#edf8ee" text-anchor="end">00:00</text>
    <text id="deckCounterMax" x="748" y="151" font-family="Arial" font-size="9" font-weight="700" fill="#87908e">/ 30:00</text>
    <path d="M865 104H897 M889 96L899 104L889 112" fill="none" stroke="#edf8ee" stroke-width="3"/>
    <text x="914" y="91" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.5" fill="#7b8584">B REC</text>
    <text id="deckBCounter" x="1022" y="125" font-family="Courier New,monospace" font-size="28" font-weight="700" letter-spacing="2" fill="#edf8ee" text-anchor="end">00:00</text>
    <text x="1048" y="88" font-family="Arial" font-size="8" font-weight="700" fill="#828a88">L</text>${ledMeter("deckVuL", 81)}
    <text x="1048" y="105" font-family="Arial" font-size="8" font-weight="700" fill="#828a88">R</text>${ledMeter("deckVuR", 98)}
    <g fill="#eef5ed" font-family="Arial" font-size="7.5" font-weight="700"><text x="1048" y="124">-30</text><text x="1120" y="124">-10</text><text x="1195" y="124">0</text><text x="1241" y="124" fill="#d05a48">+6</text></g>
    <circle cx="1196" cy="149" r="7" fill="#251313" stroke="#5c3a36"/><circle id="deckTimerLed" cx="1196" cy="149" r="4.5" fill="#3a1210"/>
    <circle cx="1242" cy="149" r="9" fill="#251313" stroke="#633c37"/><circle id="deckRecLed" cx="1242" cy="149" r="6" fill="#3a1210"/>
    <text x="1170" y="152" font-family="Arial" font-size="7.5" font-weight="700" fill="#8c8f8e" text-anchor="end">TIMER</text><text x="1228" y="152" font-family="Arial" font-size="7.5" font-weight="700" fill="#8c8f8e" text-anchor="end">REC</text>
    <rect class="meterDark" x="722" y="70" width="556" height="102" rx="3" fill="#030506" opacity=".55" pointer-events="none"/>
    ${modeKeys}
    <path d="M724 240H1276" stroke="#16181b" stroke-width="2"/><path d="M726 242H1274" stroke="#fff" opacity=".14"/>
    <g id="deckTransport">
    ${transport("deckBtnRew", 750, "REW", "◀◀", false)}
    ${transport("deckBtnPlay", 842, "PLAY", "▶", false)}
    ${transport("deckBtnFf", 934, "FF", "▶▶", false)}
    ${transport("deckBtnStop", 1026, "STOP", "■", false)}
    ${transport("deckBtnRec", 1118, "REC B", "●", true)}
    <rect x="1210" y="252" width="48" height="42" rx="3" fill="url(#w9Btn)" stroke="#5d6065"/><text x="1234" y="279" font-family="Arial" font-size="18" fill="#d6d7d6" text-anchor="middle">Ⅱ</text><text x="1234" y="311" font-family="Arial" font-size="9" font-weight="700" fill="#8d9193" text-anchor="middle">PAUSE</text>
    </g>
    <g font-family="Arial" font-size="9" font-weight="700" fill="#a6a9a8"><text x="732" y="342">DECK I &#183; PLAY / AUTO REVERSE</text><text x="1268" y="342" text-anchor="end">DECK II &#183; RECORD / DUBBING</text></g>
    <path d="M724 354H1276" stroke="#9c8659" opacity=".46"/><text x="1000" y="375" font-family="Arial" font-size="10" font-weight="700" font-style="italic" letter-spacing="1.4" fill="#b59f70" text-anchor="middle">FULL LOGIC &#183; HIGH SPEED SYNCHRO DUBBING</text>

    <!-- DECK B 도어와 카세트 -->
    <g filter="url(#w9Contact)">
        <rect x="1306" y="56" width="540" height="276" rx="5" fill="url(#w9Frame)" stroke="#25272b" stroke-width="3"/>
        <rect x="1318" y="68" width="516" height="240" rx="3" fill="url(#w9Well)" stroke="#050607" stroke-width="3"/>
        <path d="M1328 78H1824" stroke="#fff" opacity=".14"/>
        <path d="M1350 92H1802L1818 108V272L1802 288H1350L1334 272V108Z" fill="url(#w9CassB)" stroke="#896d6e" stroke-width="2"/>
        <rect x="1368" y="100" width="416" height="58" rx="3" fill="url(#w9LabelB)" stroke="#79585c"/>
        <path d="M1376 109H1776" stroke="#fff0ec" stroke-width="4" opacity=".62"/><path d="M1376 150H1776" stroke="#4b8b7e" stroke-width="5" opacity=".72"/>
        <rect x="1382" y="111" width="84" height="35" rx="2" fill="#61343a" opacity=".3"/><path d="M1392 141L1418 114L1444 141Z" fill="#cf8c78" opacity=".72"/>
        <text id="deckBLabel" x="1582" y="129" font-family="Arial" font-size="14" font-weight="700" letter-spacing=".4" fill="#43292c" text-anchor="middle" clip-path="url(#w9BLabelClip)">REC STANDBY</text>
        <text x="1582" y="146" font-family="Arial" font-size="10" font-weight="700" fill="#765357" text-anchor="middle">RECORD CASSETTE &#183; SIDE B</text>
        <text x="1758" y="145" font-family="Arial" font-size="20" font-weight="700" fill="#843d45">B</text>
        <rect id="deckWindowB" x="1416" y="166" width="320" height="72" rx="31" fill="#171719" stroke="#71595b" stroke-width="2"/>
        <circle id="deckBPackL" cx="1456" cy="202" r="40" fill="url(#w9Tape)" stroke="#17100b" stroke-width="2"/>
        <circle id="deckBPackR" cx="1696" cy="202" r="24" fill="url(#w9Tape)" stroke="#17100b" stroke-width="2"/>
        ${reel("deckBReelL", 1456, 202, 'data-cx="1456" data-cy="202"')}${reel("deckBReelR", 1696, 202, 'data-cx="1696" data-cy="202"')}
        <path id="deckHeadB" d="M1448 249H1704L1682 284H1470Z" fill="#c0a2a0" stroke="#685052"/><rect x="1535" y="257" width="82" height="17" rx="4" fill="#313236" stroke="#6c6b67"/><circle cx="1492" cy="266" r="7" fill="#232528"/><circle cx="1660" cy="266" r="7" fill="#232528"/>
        <g fill="#514345" stroke="#e1c5c2" stroke-width="1.2"><circle cx="1358" cy="112" r="4"/><circle cx="1796" cy="112" r="4"/><circle cx="1358" cy="270" r="4"/><circle cx="1796" cy="270" r="4"/></g>
        <path d="M1322 72H1562L1438 304H1322Z" fill="url(#w9Glass)" pointer-events="none"/>
    </g>
    <rect x="1306" y="338" width="540" height="50" rx="3" fill="#303338" stroke="#1d1f22"/>
    <path d="M1318 345H1834" stroke="#fff" opacity=".13"/>
    <g font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.2"><text x="1332" y="361" fill="#55a87c">&#9664;</text><text x="1370" y="361" fill="#b54b42">REC</text><text x="1414" y="361" fill="#8e9297">PAUSE</text><text x="1790" y="361" fill="#55a87c">&#9654;</text></g>
    <text x="1576" y="379" font-family="Arial" font-size="9.5" font-weight="700" letter-spacing="1.5" fill="#8d9093" text-anchor="middle">COMPU AUTO REVERSE CASSETTE DECK &#183; REC II</text>

    <!-- 우측 조작 레일 -->
    <rect x="1860" y="56" width="120" height="334" rx="5" fill="#696c70" stroke="#323438" stroke-width="2"/>
    <rect x="1864" y="60" width="112" height="326" rx="4" fill="url(#w9Brush)" opacity=".62"/>
    <text x="1920" y="96" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.4" fill="#343639" text-anchor="middle">EJECT II</text>
    <rect x="1878" y="108" width="84" height="38" rx="3" fill="url(#w9Btn)" stroke="#222429" stroke-width="2"/><path d="M1900 136H1940 M1907 128L1920 117L1933 128" fill="none" stroke="#d5d5d1" stroke-width="3"/>
    <text x="1920" y="180" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.2" fill="#343639" text-anchor="middle">REC LEVEL</text>
    <circle class="lz-hardware-knob" cx="1920" cy="218" r="32" fill="#111317" stroke="#292b2e" stroke-width="3"/><circle cx="1920" cy="218" r="25" fill="url(#w9Knob)" stroke="#7b7d7e"/><path d="M1920 196V207" stroke="#d5c69f" stroke-width="3"/>
    <g stroke="#383a3d" stroke-width="2"><path d="M1888 190L1895 197"/><path d="M1952 190L1945 197"/><path d="M1878 218H1888"/><path d="M1962 218H1952"/></g>
    <text x="1920" y="271" font-family="Arial" font-size="9" font-weight="700" letter-spacing="1.3" fill="#343639" text-anchor="middle">PHONES</text>
    <circle cx="1920" cy="302" r="18" fill="#222529" stroke="#9a9b98" stroke-width="3"/><circle cx="1920" cy="302" r="10" fill="#050607"/><ellipse cx="1914" cy="296" rx="4" ry="3" fill="#fff" opacity=".17"/>
    <text x="1920" y="350" font-family="Arial" font-size="8" font-weight="700" fill="#3a3c3f" text-anchor="middle">MIN &#183; MAX</text>
    <circle cx="1883" cy="366" r="5" fill="#34363a" stroke="#b7b8b5"/><circle cx="1957" cy="366" r="5" fill="#34363a" stroke="#b7b8b5"/>

    <!-- 앱 기능용 하단 베이: MIC 입력과 테이프 랙은 mountDeck 이후 이 위에 주입된다. -->
    <rect x="4" y="404" width="1992" height="102" fill="url(#w9Apron)"/>
    <path d="M12 406H1988" stroke="#c5c7c6" opacity=".35"/><path d="M12 414H1988" stroke="#08090b" stroke-width="3" opacity=".7"/>
    <rect x="92" y="420" width="304" height="86" rx="6" fill="#15171b" stroke="#3e4146"/>
    <rect x="410" y="420" width="680" height="86" rx="6" fill="#17191d" stroke="#3e4146"/>
    <text x="430" y="443" font-family="Arial" font-size="9" font-weight="700" letter-spacing="2" fill="#7f8387">INDEPENDENT DUBBING BUS</text>
    <g pointer-events="none">
        <rect x="438" y="453" width="116" height="38" rx="4" fill="#090b0e" stroke="#41454a"/><text x="496" y="468" font-family="Arial" font-size="8" font-weight="700" letter-spacing="1.2" fill="#8d9295" text-anchor="middle">DECK I</text><text x="496" y="484" font-family="Arial" font-size="11" font-weight="700" fill="#d2d6d4" text-anchor="middle">PLAY</text>
        <path d="M566 472H638 M626 462L640 472L626 482" fill="none" stroke="#b9a46f" stroke-width="3"/>
        <rect x="652" y="453" width="116" height="38" rx="4" fill="#090b0e" stroke="#5c3a36"/><text x="710" y="468" font-family="Arial" font-size="8" font-weight="700" letter-spacing="1.2" fill="#8d9295" text-anchor="middle">DECK II</text><text x="710" y="484" font-family="Arial" font-size="11" font-weight="700" fill="#d35a4d" text-anchor="middle">RECORD</text>
        <g font-family="Arial" font-size="8" font-weight="700" fill="#8d9295"><text x="806" y="460">DUB SPEED</text><text x="806" y="490">MONITOR</text></g>
        <rect x="892" y="450" width="26" height="18" rx="3" fill="#43464a"/><rect x="898" y="454" width="14" height="10" rx="2" fill="#aaaead"/><text x="928" y="461" font-family="Arial" font-size="8" font-weight="700" fill="#c6c9c7">NORMAL</text>
        <rect x="892" y="478" width="26" height="18" rx="3" fill="#43464a"/><rect x="898" y="482" width="14" height="10" rx="2" fill="#aaaead"/><text x="928" y="489" font-family="Arial" font-size="8" font-weight="700" fill="#c6c9c7">SOURCE</text>
        <circle cx="1048" cy="459" r="5" fill="#6f2a22"/><circle cx="1048" cy="487" r="5" fill="#274f3d"/>
    </g>
    <rect x="1102" y="420" width="870" height="86" rx="6" fill="#17191d" stroke="#3e4146"/>
    <text x="1120" y="443" font-family="Arial" font-size="9" font-weight="700" letter-spacing="2" fill="#7f8387">TAPE LIBRARY</text>
    <g id="deckShelf"></g>
    <ellipse cx="140" cy="512" rx="80" ry="7" fill="#000" opacity=".55"/><ellipse cx="1860" cy="512" rx="80" ry="7" fill="#000" opacity=".55"/>
    <rect x="78" y="500" width="124" height="16" rx="4" fill="#111317"/><rect x="1798" y="500" width="124" height="16" rx="4" fill="#111317"/>
    </svg>`;
}

const DECK_MODELS = {
    dragon: { label: "Nakamichi DRAGON", windRate: 80, hissFloor: .004, blankHiss: .010, reelRate: 1 },
    b215: { label: "REVOX B215", windRate: 90, hissFloor: .003, blankHiss: .008, reelRate: 1.08, svg: mfaDeckSvg({ id: "b215", brand: "REVOX", model: "B215", face: "black", signature: "revox", openTransport: true, ledMeters: true, display: "#8ce9b6" }) },
    tcd3014: { label: "TANDBERG TCD 3014A", windRate: 70, hissFloor: .005, blankHiss: .012, reelRate: .92, svg: mfaDeckSvg({ id: "tcd3014", brand: "TANDBERG", model: "TCD 3014A", face: "black", wood: true, signature: "tandberg", openTransport: true, ledMeters: false, display: "#f0a348" }) },
    ctf1250: { label: "PIONEER CT-F1250", windRate: 60, hissFloor: .006, blankHiss: .014, reelRate: .86, svg: mfaCtf1250Svg() },
    w990: { label: "TEAC W-990RX", windRate: 75, hissFloor: .0035, blankHiss: .009, reelRate: 1, doubleDeck: true, svg: mfaW990Svg() }
};
const DECK_ORDER = ["dragon", "b215", "tcd3014", "ctf1250", "w990"];

const TT_MODELS = {
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
const TT_ORDER = ["sl1200", "td124", "g301", "lp12"];

// PIONEER DT-540 오디오 타이머 (1983) — 420×52mm 슬림 유닛의 비례를 2000×248로 옮겼다.
// 실물의 문법: 중앙 형광(VFD) 표시창에 시계·프로그램, 우측에 타이머 암 스위치와 버튼,
// 후면 스위치드 아웃렛으로 튜너·데크 전원을 제어. 여기서는 예약 녹음 엔진의 전면이 된다.
// 동적 id: dtClockH/M/Sec·dtClockColon(시계), dtDayText(요일), dtProgText(다음 예약),
// dtSleepText(취침 잔여), dtLampTimer/Rec/Sleep(LED), dtSwTimer(암 스위치),
// dtBtnProg/dtBtnSleep(버튼), dtHitTimer/dtHitDisplay(히트).
const TIMER_FINISHES = {
    black: {
        label: "DT-540 · BLACK FINISH",
        face: ["#30353a", "#252a2f", "#171b20", "#0d1014", "#06080a"],
        ink: "#d8dddf", sub: "#8c969c", edge: "#4d555c", edge2: "#090b0e",
        highlight: "#e8edef", highlightOp: ".12", screw: "#0b0d10", screwEdge: "#81888d",
        vfd: "#72c8ae", vfdDim: "#294b40"
    },
    silver: {
        label: "DT-540 · SILVER FINISH",
        face: ["#d9d8d2", "#c8c8c3", "#aaacab", "#818588", "#666b6f"],
        ink: "#272a2d", sub: "#555b5f", edge: "#74797c", edge2: "#e4e5df",
        highlight: "#ffffff", highlightOp: ".22", screw: "#2b2e31", screwEdge: "#c1c4c4",
        vfd: "#72c8ae", vfdDim: "#294b40"
    }
};

function mfaDt540Svg(finish) {
    const key = TIMER_FINISHES[finish] ? finish : "black";
    const theme = TIMER_FINISHES[key];
    const vfd = theme.vfd;
    const vfdDim = theme.vfdDim;
    const faceStops = theme.face.map((color, i) =>
        '<stop offset="' + [0, .09, .48, .86, 1][i] + '" stop-color="' + color + '"/>'
    ).join("");
    const legend = (x, y, id, label) =>
        '<circle cx="' + x + '" cy="' + (y - 4) + '" r="4.5" fill="#0a1b13" stroke="#1a3529" stroke-width="1"/>' +
        '<circle id="' + id + '" cx="' + x + '" cy="' + (y - 4) + '" r="2.8" fill="#12301f"/>' +
        '<text x="' + (x + 15) + '" y="' + y + '" font-family="Arial" font-size="14" font-weight="700" letter-spacing="1.4" fill="' + vfdDim + '">' + label + '</text>';
    const button = (x, id, label, title) =>
        '<rect x="' + (x - 1) + '" y="104" width="118" height="47" rx="4" fill="#000" opacity=".22"/>' +
        '<rect id="' + id + '" x="' + x + '" y="98" width="116" height="46" rx="4" fill="url(#dtBtn)" stroke="#0b0d10" stroke-width="1.5" style="cursor:pointer"><title>' + title + '</title></rect>' +
        '<path d="M' + (x + 6) + ' 103H' + (x + 110) + '" stroke="#fff" opacity=".16" pointer-events="none"/>' +
        '<text x="' + (x + 58) + '" y="127" font-family="Arial" font-size="14" font-weight="700" letter-spacing="1.4" fill="#dfe2e2" text-anchor="middle" pointer-events="none">' + label + '</text>';
    return '<svg class="timer-svg timer-' + key + '" data-finish="' + key + '" viewBox="0 0 2000 248" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="PIONEER DT-540 오디오 타이머 ' + key + ' 마감">' +
        '<defs>' +
        '<linearGradient id="dtFace" x1="0" y1="0" x2="0" y2="1">' + faceStops + '</linearGradient>' +
        '<linearGradient id="dtBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4c55"/><stop offset=".12" stop-color="#33353d"/><stop offset=".55" stop-color="#1f2127"/><stop offset="1" stop-color="#0e0f13"/></linearGradient>' +
        '<linearGradient id="dtGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03130b"/><stop offset=".5" stop-color="#061009"/><stop offset="1" stop-color="#020a06"/></linearGradient>' +
        '<linearGradient id="dtDisplayFrame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#596066"/><stop offset=".14" stop-color="#22272c"/><stop offset=".55" stop-color="#101318"/><stop offset="1" stop-color="#050609"/></linearGradient>' +
        '<pattern id="dtBrush" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H7 M0 3.5H7 M0 6.5H7" stroke="#fff" stroke-width=".45" opacity=".11"/><path d="M0 2H7 M0 5H7" stroke="#000" stroke-width=".45" opacity=".16"/></pattern>' +
        '<clipPath id="dtProgClip"><rect x="684" y="165" width="618" height="34" rx="2"/></clipPath>' +
        '</defs>' +
        '<rect width="2000" height="248" rx="8" fill="url(#dtFace)"/>' +
        '<rect width="2000" height="248" rx="8" fill="url(#dtBrush)" opacity=".5"/>' +
        '<rect x="0" y="2" width="2000" height="3" fill="' + theme.highlight + '" opacity="' + theme.highlightOp + '"/>' +
        '<rect x="24" y="16" width="1952" height="216" rx="5" fill="none" stroke="' + theme.edge + '" stroke-width="2" opacity=".62"/>' +
        '<rect x="28" y="20" width="1944" height="208" rx="4" fill="none" stroke="' + theme.edge2 + '" stroke-width="1" opacity=".38"/>' +
        '<rect x="0" y="236" width="2000" height="12" fill="#020304" opacity=".38"/>' +
        '<g fill="' + theme.screw + '" stroke="' + theme.screwEdge + '" stroke-width="1.2"><circle cx="46" cy="40" r="6"/><circle cx="1954" cy="40" r="6"/><circle cx="46" cy="208" r="6"/><circle cx="1954" cy="208" r="6"/></g>' +
        // 브랜드 블록
        '<text x="80" y="111" font-family="Arial" font-size="32" font-weight="700" letter-spacing="3" fill="' + theme.ink + '">PIONEER</text>' +
        '<text x="80" y="144" font-family="Arial" font-size="14" font-weight="600" letter-spacing="1.9" fill="' + theme.sub + '">AUDIO DIGITAL TIMER &#183; DT-540</text>' +
        '<path d="M446 48 V200" stroke="' + theme.edge + '" stroke-width="1.5" opacity=".58"/><path d="M448 48 V200" stroke="' + theme.highlight + '" stroke-width="1" opacity=".14"/>' +
        // VFD 표시창
        '<rect x="472" y="42" width="984" height="174" rx="8" fill="#000" opacity=".34"/>' +
        '<rect x="468" y="36" width="984" height="174" rx="8" fill="url(#dtDisplayFrame)" stroke="#0b0d10" stroke-width="2"/>' +
        '<rect x="472" y="39" width="976" height="3" rx="1.5" fill="#fff" opacity=".12"/>' +
        '<rect x="484" y="50" width="952" height="146" rx="5" fill="url(#dtGlass)"/>' +
        '<g id="dtVfdGroup" opacity=".78">' +
        legend(512, 88, "dtLampTimer", "TIMER") + legend(512, 128, "dtLampRec", "REC") + legend(512, 168, "dtLampSleep", "SLEEP") +
        '<g transform="skewX(-3)" style="filter: drop-shadow(0 0 4px rgba(102,215,168,.22))" font-family="Arial" font-weight="700" fill="' + vfd + '">' +
        '<text id="dtClockH" x="927" y="153" font-size="86" letter-spacing="4" text-anchor="end">--</text>' +
        '<text id="dtClockColon" x="953" y="148" font-size="78" text-anchor="middle">:</text>' +
        '<text id="dtClockM" x="980" y="153" font-size="86" letter-spacing="4">--</text>' +
        '<text id="dtClockSec" x="1213" y="153" font-size="34" letter-spacing="2">--</text>' +
        '<text id="dtDayText" x="1414" y="82" font-size="20" letter-spacing="2.5" text-anchor="end">---</text>' +
        '</g>' +
        '<title id="dtProgTitle">PROGRAM --:--</title>' +
        '<text id="dtProgText" x="994" y="188" font-family="Arial" font-size="18" font-weight="650" letter-spacing=".8" fill="#66b993" text-anchor="middle" clip-path="url(#dtProgClip)">PROGRAM --:--</text>' +
        '<text id="dtSleepText" x="1414" y="188" font-family="Arial" font-size="17" font-weight="700" letter-spacing="1.2" fill="' + vfd + '" text-anchor="end"></text>' +
        '</g>' +
        '<polygon points="484,50 744,50 632,196 484,196" fill="url(#lzGlassSweep)" opacity=".3" pointer-events="none"/>' +
        '<rect x="484" y="50" width="952" height="18" fill="url(#lzInset)" opacity=".48" pointer-events="none"/>' +
        '<rect id="dtHitDisplay" x="468" y="36" width="984" height="174" rx="8" fill="#000" fill-opacity="0" style="cursor:pointer"><title>편성표와 예약 녹음 — 표시창을 누르면 열립니다</title></rect>' +
        // TIMER 암 스위치
        mfaSvgToggle(1540, 118, "dtSwTimer", key === "black" ? "#858d91" : "#b8babd") +
        '<g font-family="Arial" font-size="10" font-weight="700" fill="' + theme.sub + '"><text x="1572" y="104">ON</text><text x="1572" y="152">OFF</text></g>' +
        '<text x="1540" y="196" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.8" fill="' + theme.ink + '" text-anchor="middle">TIMER</text>' +
        '<rect id="dtHitTimer" x="1500" y="70" width="88" height="110" fill="#000" fill-opacity="0" style="cursor:pointer"><title>TIMER 스위치 — 올리면 예약 녹음 대기, 내리면 예약을 쉬게 합니다</title></rect>' +
        // PROGRAM · SLEEP 버튼
        button(1642, "dtBtnProg", "PROGRAM", "예약 녹음 목록과 편성표를 엽니다") +
        button(1780, "dtBtnSleep", "SLEEP", "취침 타이머 — 누를 때마다 15·30·60·90분 순환") +
        '<text x="1700" y="175" font-family="Arial" font-size="11" font-weight="600" letter-spacing="1.4" fill="' + theme.sub + '" text-anchor="middle">RESERVE</text>' +
        '<text x="1838" y="175" font-family="Arial" font-size="11" font-weight="600" letter-spacing="1.4" fill="' + theme.sub + '" text-anchor="middle">AUTO OFF</text>' +
        '<text x="1924" y="220" font-family="Arial" font-size="10" font-weight="600" letter-spacing="1.1" fill="' + theme.sub + '" opacity=".48" text-anchor="end">SWITCHED OUTLETS &#183; TUNER / CASSETTE DECK</text>' +
        '</svg>';
}

const TIMER_MODELS = {
    dt540: { label: "PIONEER DT-540", render: mfaDt540Svg }
};

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

["t2", "mr78", "m10b"].forEach((id) => {
    if (TUNER_SKINS[id]) TUNER_SKINS[id].svg = mfaPolishLegacySvg(TUNER_SKINS[id].svg);
});
["el34", "300b"].forEach((id) => {
    if (AMP_MODELS[id]) AMP_MODELS[id].svg = mfaPolishLegacySvg(AMP_MODELS[id].svg);
});
