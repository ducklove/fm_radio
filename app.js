// 앱 모듈 — UI 상태·마운트·조작 바인딩·재생 제어·프레임 루프·초기화.

const stations = FMRadio.stations;
const getStreamUrl = FMRadio.getStreamUrl;

const audio = document.getElementById("audioPlayer");
const playIcon = document.getElementById("playIcon");
const nowStation = document.getElementById("nowStation");
const playerSubtext = document.getElementById("playerSubtext");
const btnRec = document.getElementById("btnRec");
const recTimeEl = document.getElementById("recTime");
const liveClock = document.getElementById("liveClock");
const recordingsGroup = document.getElementById("recordingsGroup");
const recordingsNote = document.getElementById("recordingsNote");
const recordingList = document.getElementById("recordingList");
const btnTimer = document.getElementById("btnTimer");
const timerLabel = document.getElementById("timerLabel");
const vuCanvas = document.getElementById("vuCanvas");
const vuCtx = vuCanvas.getContext("2d");
const favGroup = document.getElementById("favGroup");
const favNote = document.getElementById("favNote");
const favList = document.getElementById("favList");

// ----- 오디오 상태 표시 (engine.js 상태 머신 구독) -----
// 상태별 라벨·색·안내문은 여기 한 곳에서만 정의한다. 세부 문구가 필요한 곳은
// setAudioState 뒤에 직접 playerSubtext를 덮어써서 구체화한다.
const audioStateChip = document.getElementById("audioStateChip");
const AUDIO_STATE_UI = {
    idle:      { label: "대기",    cls: "" },
    resolving: { label: "연결 중", cls: "st-busy", text: "스트림에 연결 중입니다…" },
    buffering: { label: "버퍼링",  cls: "st-busy", text: "버퍼링 — 잠시만 기다려 주세요…" },
    playing:   { label: "재생 중", cls: "st-on" },
    blocked:   { label: "차단됨",  cls: "st-warn", text: "브라우저가 자동 재생을 막았습니다 — 재생 버튼을 눌러 주세요." },
    error:     { label: "오류",    cls: "st-err", text: "연결에 실패했습니다 — 채널을 다시 선택해 주세요." }
};
let busySince = 0;   // 연결/버퍼링 진입 시각 — 고착 워치독용 (ttFrame에서 검사)
document.addEventListener("audiostate", (e) => {
    const ui = AUDIO_STATE_UI[e.detail.state] || AUDIO_STATE_UI.idle;
    audioStateChip.hidden = e.detail.state === "idle";
    audioStateChip.textContent = ui.label + (e.detail.info ? " · " + e.detail.info : "");
    audioStateChip.className = "audio-state-chip " + (ui.cls || "");
    if (ui.text) playerSubtext.textContent = ui.text;
    busySince = (e.detail.state === "buffering" || e.detail.state === "resolving") ? performance.now() : 0;
});

// ----- 보기 모드 -----
// 하이파이 랙이 모든 기기의 기본이다 — 모바일도 랙 + 하단 슬림 플레이 바로 본다.
// ?view=simple 파라미터로만 간편 화면(목록+플레이어)을 쓸 수 있다.
const urlView = new URLSearchParams(location.search).get("view");
let viewMode = urlView === "simple" ? "simple" : "rack";

// ----- 바 오버레이 (맥 앱의 '간편 플레이어') -----
// 페이지를 리로드하지 않고 body 클래스만 토글한다 — 재생 중 전환해도 소리가 끊기지 않는다.
// 맥 앱이 evaluateJavaScript로 호출한다 (?view=bar 로 시작할 수도 있다).
// sessionStorage에 보존해 바 상태에서 새로고침해도 풀 랙 레이아웃으로 리셋되지 않는다.
let barOverlay = urlView === "bar" || sessionStorage.getItem("fmRadio.bar") === "1";

function setPopupBarMode(on) {
    barOverlay = !!on;
    document.body.classList.toggle("mode-bar", barOverlay);
    try { sessionStorage.setItem("fmRadio.bar", barOverlay ? "1" : "0"); } catch (e) {}
}

// ----- 전체 화면(몰입) 모드 — 컴포넌트만 남긴다 -----
// 브라우저 전체 화면 API를 쓰되, 미지원 환경(맥 앱 팝오버 등)에서는
// 클래스만 적용해 창 안에서 크롬을 걷어낸다.
function applyFocusMode(on) {
    document.body.classList.toggle("mode-focus", on);
}

function toggleFocusMode() {
    const on = !document.body.classList.contains("mode-focus");
    applyFocusMode(on);
    // 맥 앱 안에서는 WebKit의 엘리먼트 전체 화면 UI(회색 안내 박스)가 떠 버리므로
    // 네이티브 브리지로 패널 자체를 화면 크기로 키운다. 브라우저에서는 Fullscreen API.
    const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.focus;
    if (bridge) {
        try { bridge.postMessage(on); } catch (e) {}
    } else {
        const el = document.documentElement;
        try {
            if (on && !document.fullscreenElement) {
                (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
            } else if (!on && document.fullscreenElement) {
                (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
            }
        } catch (e) {}
    }
    gtag('event', 'focus_mode', { on: on });
}

// 네이티브 전체 화면이 아닌 환경(맥 앱 등)에서는 ESC로 몰입 모드를 닫는다
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("mode-focus") && !document.fullscreenElement) {
        toggleFocusMode();
    }
});

// ESC 등으로 네이티브 전체 화면이 풀리면 몰입 모드도 함께 해제
["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => {
    document.addEventListener(ev, () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) applyFocusMode(false);
    });
});

function applyViewMode() {
    document.body.classList.toggle("mode-simple", viewMode === "simple");
    document.body.classList.toggle("mode-rack", viewMode === "rack");
    document.body.classList.toggle("mode-bar", barOverlay);
    const btn = document.getElementById("viewModeBtn");
    if (btn) btn.textContent = viewMode === "simple" ? "랙 보기" : "간편 플레이어";
    if (viewMode === "simple") {
        // 간편 모드에서는 채널 목록이 곧 메인 화면 — 항상 펼친다
        document.getElementById("stationMain").classList.remove("collapsed");
        const toggle = document.getElementById("listToggle");
        if (toggle) toggle.setAttribute("aria-expanded", "true");
    }
}

function toggleViewMode() {
    viewMode = viewMode === "simple" ? "rack" : "simple";
    saveJson("fmRadio.viewMode", viewMode);
    applyViewMode();
    applyUnitVisibility();
    gtag('event', 'view_mode', { mode: viewMode });
}

applyViewMode();


function tsFreqToX(f) {
    const c = tunerCfg.freq;
    return c.x88 + (Math.max(88, Math.min(108, f)) - 88) * c.px;
}

function tunerSetStation(station) {
    if (!tsFreq) return;
    // 슬라이더 역할(다이얼·노브)의 현재값을 주파수로 노출
    ["tsDialHit", "tsKnobHit"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("aria-valuenow", station ? station.freq : 98);
    });
    const d = tunerCfg.digit;
    if (station) {
        const txt = station.freq.toFixed(1);
        tsFreq.textContent = txt;
        tsFreqGlow.textContent = txt;
        tsFreq.style.fill = d.lit;
        tsFreqGlow.style.fill = d.glow;
        tsDialPtr.setAttribute("transform", "translate(" + (tsFreqToX(station.freq) - tunerCfg.freq.drawX).toFixed(1) + ",0)");
        tunerKnobAngle(station.freq);
        highlightStationMark(station.id);
    } else {
        tsFreq.textContent = "--.-";
        tsFreqGlow.textContent = "--.-";
        tsFreq.style.fill = d.dim;
        tsFreqGlow.style.fill = d.dimGlow;
        tsDialPtr.setAttribute("transform", "translate(" + (tsFreqToX(88) - tunerCfg.freq.drawX).toFixed(1) + ",0)");
        tunerKnobAngle(98);
        highlightStationMark(null);
    }
}

function tunerSetLeds() {
    tsPanelState = "";   // 다음 동기화 때 강제 갱신
    tsSyncPanel();
}

function tunerKnobAngle(freq) {
    if (!tsKnob) return;
    const ang = (Math.max(88, Math.min(108, freq)) - 88) / 20 * 300 - 150;
    tsKnob.setAttribute("transform", "rotate(" + ang.toFixed(1) + " " + tunerCfg.knob.cx + " " + tunerCfg.knob.cy + ")");
}

function highlightStationMark(id) {
    if (!tsStationMarks) return;
    const m = tunerCfg.mark;
    tsStationMarks.querySelectorAll("rect").forEach((el) => {
        const on = el.getAttribute("data-station") === id;
        el.setAttribute("fill", on ? m.colorOn : m.color);
        el.setAttribute("height", on ? m.hOn : m.h);
    });
}

// 다이얼을 놓았을 때 — 근접국에 안착한다.
// 단, 어느 방송국도 살지 않는 105.2MHz 부근에 정확히 맞추면
// 국경 너머의 전파가 잡힌다 (이스터에그 — 조선중앙방송 평양 FM의 실제 주파수).
function tuneRelease(freq) {
    if (Math.abs(freq - 105.2) < 0.25) {
        playEasterEgg();
        return;
    }
    selectStation(nearestStation(freq).id);
}

function nearestStation(freq) {
    return stations.reduce((a, b) => Math.abs(b.freq - freq) < Math.abs(a.freq - freq) ? b : a);
}

function clientXToFreq(clientX) {
    const r = tunerSvgEl.getBoundingClientRect();
    const svgX = (clientX - r.left) / r.width * 2000;
    return 88 + (svgX - tunerCfg.freq.x88) / tunerCfg.freq.px;
}

// 드래그 중 미리보기 — 바늘·표시·노브를 임의 주파수로 (선택은 손 뗄 때)
function tunerPreview(freq) {
    freq = Math.max(88, Math.min(108, freq));
    tsPreviewUntil = performance.now() + 2500;   // 조작하는 동안 디스플레이가 깨어난다
    const d = tunerCfg.digit;
    tsDialPtr.setAttribute("transform", "translate(" + (tsFreqToX(freq) - tunerCfg.freq.drawX).toFixed(1) + ",0)");
    const txt = freq.toFixed(1);
    tsFreq.textContent = txt;
    tsFreqGlow.textContent = txt;
    tsFreq.style.fill = d.lit;
    tsFreqGlow.style.fill = d.glow;
    tunerKnobAngle(freq);
    // 105.2 부근(이스터에그 창)에서는 근접국을 발설하지 않는다 — 잡음뿐인 척
    if (Math.abs(freq - 105.2) < 0.25) {
        nowStation.textContent = "· · ·";
        playerSubtext.textContent = "치지직… 이 부근에는 등록된 방송이 없습니다.";
        return;
    }
    const near = nearestStation(freq);
    nowStation.textContent = near.name;
    playerSubtext.textContent = near.name + " · " + near.freq.toFixed(1) + "MHz — 손을 떼면 선택됩니다.";
}

function tunerLoop(now) {
    tsRaf = requestAnimationFrame(tunerLoop);
    ttFrame(now || performance.now());
    if (!tunerCfg) return;
    let target = 0;
    if (isPlaying) {
        if (analyser) {
            // 시간 영역 RMS — 실제 음량감에 대응 (스펙트럼 평균은 항상 높게 나온다)
            if (!tsTimeData) tsTimeData = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(tsTimeData);
            let sum2 = 0;
            for (let i = 0; i < tsTimeData.length; i++) {
                const d = (tsTimeData[i] - 128) / 128;
                sum2 += d * d;
            }
            const rms = Math.sqrt(sum2 / tsTimeData.length);   // 음악 RMS ≈ 0.05~0.3
            target = Math.min(1, rms * 2.6);
        } else {
            // 그래프가 없는 환경(사파리·맥 앱·iOS 네이티브 경로): 오디오 분석 불가.
            // 느린 악구(프레이즈) 곡선 위에 박자 펄스와 미세 흔들림을 얹어
            // 바늘이 음악을 타는 것처럼 움직이게 한다.
            const t = (now || performance.now()) / 1000;
            const phrase = 0.32 + 0.13 * Math.sin(t * 0.31) + 0.09 * Math.sin(t * 0.73 + 1.4);
            const beat = Math.pow(Math.max(0, Math.sin(t * 4.4)), 3) * 0.22
                + Math.pow(Math.max(0, Math.sin(t * 2.2 + 0.6)), 5) * 0.12;
            target = Math.max(0.04, Math.min(0.92, phrase + beat + (Math.random() - 0.5) * 0.05));
        }
    }
    // VU 탄도: 300ms급 관성으로 바늘이 음악을 타고, 피크는 즉시 튀고 천천히 내려온다
    tsSignal += (target - tsSignal) * 0.07;
    tsPeak = Math.max(target, tsPeak - ttLastDt * 0.7);
    const sc = tunerCfg.signal;
    // 튜너 미터는 튜너가 수신 중일 때만 산다 (포노/테이프 중엔 소스가 튜너가 아니다)
    const sigX = sc.baseX + Math.max(0, Math.min(1, tsSignal * tunerWarm)) * sc.travel;
    if (tsSignalPtr.dataset.cx) {
        const a = -42 + Math.max(0, Math.min(1, tsSignal * tunerWarm)) * 84;
        tsSignalPtr.setAttribute("transform", "rotate(" + a.toFixed(1) + " " + tsSignalPtr.dataset.cx + " " + tsSignalPtr.dataset.cy + ")");
    } else {
        tsSignalPtr.setAttribute("transform", "translate(" + (sigX - sc.drawX).toFixed(1) + ",0)");
    }

    const tuneTarget = (isPlaying && currentStation) ? 0 : 0.85;
    const jitter = isPlaying ? (Math.random() - 0.5) * 0.05 : 0;
    tsTune += (tuneTarget - tsTune) * 0.1 + jitter;
    tsTune = Math.max(-1, Math.min(1, tsTune));
    if (tsTunePtr.dataset.cx) {
        tsTunePtr.setAttribute("transform", "rotate(" + (tsTune * 42).toFixed(1) + " " + tsTunePtr.dataset.cx + " " + tsTunePtr.dataset.cy + ")");
    } else {
        tsTunePtr.setAttribute("transform", "translate(" + (tsTune * tunerCfg.tune.travel).toFixed(1) + ",0)");
    }
    tsSyncPanel();
}


function tsSyncPanel() {
    if (!tunerCfg || !tsFreq) return;
    const recOn = !!recorder;
    const timerOn = sleepIndex > 0;
    const listOpen = !document.getElementById("stationMain").classList.contains("collapsed");
    const state = [isPlaying, !!currentStation, recOn, blendOn, monoOn, audio.muted, timerOn, listOpen].join(",");
    if (state === tsPanelState) return;
    tsPanelState = state;

    // POWER: T-2 로커는 상/하 색 반전, 그 외 스킨은 액추에이터 이동
    const pwrTop = document.getElementById("tsPwrTop");
    const pwrBot = document.getElementById("tsPwrBot");
    if (pwrTop && pwrBot) {
        pwrTop.setAttribute("fill", isPlaying ? "#54525a" : "#1c1a20");
        pwrBot.setAttribute("fill", isPlaying ? "#1c1a20" : "#54525a");
    }
    const setSw = (id, down) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("transform", down ? "translate(0," + tunerCfg.swTravel + ")" : "translate(0,0)");
    };
    setSw("tsSwPwr", isPlaying);
    setSw("tsSwRec", recOn);
    setSw("tsSwBlend", blendOn);
    setSw("tsSwMode", monoOn);
    setSw("tsSwMute", audio.muted);
    setSw("tsSwIf", timerOn);
    setSw("tsSwRf", listOpen);

    const setLed = (id, on) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.fill = on
            ? (el.getAttribute("data-on") || tunerCfg.led.on)
            : (el.getAttribute("data-off") || tunerCfg.led.off);
    };
    const tunerLive = isPlaying && !!currentStation;   // 포노 재생 중엔 튜너 LED 소등
    setLed("tsLedStereo", tunerLive && !monoOn);
    setLed("tsLedLock", tunerLive);
    setLed("tsLedBlend", blendOn);
}

// ----- 조작 바인딩 (스킨 마운트마다 다시 연결) -----
// REVOX B760 — 방송국 프리셋 1–8. 신시사이저 튜너의 존재 이유.
// 짧게 누르면 호출, 길게(0.6초) 누르면 현재 국 저장. localStorage 영속.
let tunerPresets = loadJson("fmRadio.tunerPresets", {});

function mountB760Presets() {
    if (tunerSkinId !== "b760" || !tunerSvgEl || tunerSvgEl.querySelector("#tsPresetG")) return;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("id", "tsPresetG");
    let html = '<text x="1484" y="242" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.4" fill="#75a98c">STATION MEMORY &#183; HOLD</text>';
    for (let i = 1; i <= 8; i++) {
        const x = 1484 + ((i - 1) % 2) * 92;
        const y = 250 + Math.floor((i - 1) / 2) * 34;
        html += '<g id="tsPreset' + i + '" role="button" tabindex="0" aria-label="프리셋 ' + i + ' — 짧게 호출, 길게 저장" style="cursor:pointer">' +
            '<title>프리셋 ' + i + ' — 짧게 누르면 호출, 길게 누르면 현재 채널 저장</title>' +
            '<rect x="' + x + '" y="' + y + '" width="82" height="28" rx="3" fill="#111519" stroke="#41584b" stroke-width="1.3"/>' +
            '<path d="M' + (x + 4) + ' ' + (y + 4) + ' H' + (x + 78) + '" stroke="#fff" stroke-width="1" opacity=".13" pointer-events="none"/>' +
            '<circle id="tsPresetLed' + i + '" cx="' + (x + 10) + '" cy="' + (y + 9) + '" r="3" fill="#1c3527" pointer-events="none"/>' +
            '<text x="' + (x + 27) + '" y="' + (y + 20) + '" font-family="Arial" font-size="14" font-weight="700" fill="#9fe8bd" text-anchor="middle" pointer-events="none">' + i + '</text>' +
            '<text id="tsPresetFreq' + i + '" x="' + (x + 58) + '" y="' + (y + 19) + '" font-family="Arial" font-size="10" font-weight="700" fill="#75a98c" text-anchor="middle" pointer-events="none"></text></g>';
    }
    g.innerHTML = html;
    tunerSvgEl.appendChild(g);
    const paint = () => {
        for (let i = 1; i <= 8; i++) {
            const st = stations.find((x) => x.id === tunerPresets[i]);
            const led = document.getElementById("tsPresetLed" + i);
            const fq = document.getElementById("tsPresetFreq" + i);
            if (led) led.style.fill = st ? "#54d18a" : "#1c3527";
            if (fq) fq.textContent = st ? st.freq.toFixed(1) : "";
        }
    };
    for (let i = 1; i <= 8; i++) {
        const key = document.getElementById("tsPreset" + i);
        let downAt = 0, timer = 0;
        const store = () => {
            if (!currentStation) {
                playerSubtext.textContent = "저장할 채널이 없습니다 — 먼저 선국하세요.";
                return;
            }
            tunerPresets[i] = currentStation.id;
            saveJson("fmRadio.tunerPresets", tunerPresets);
            paint();
            playerSubtext.textContent = "프리셋 " + i + " ← " + currentStation.name + " (" + currentStation.freq.toFixed(1) + "MHz) 저장";
        };
        const recall = () => {
            const st = stations.find((x) => x.id === tunerPresets[i]);
            if (!st) {
                playerSubtext.textContent = "프리셋 " + i + "은 비어 있습니다 — 길게 누르면 현재 채널이 저장됩니다.";
                return;
            }
            selectStation(st.id);
            playerSubtext.textContent = "프리셋 " + i + " — " + st.name + " (" + st.freq.toFixed(1) + "MHz)";
        };
        key.addEventListener("pointerdown", (e) => {
            downAt = Date.now();
            timer = setTimeout(store, 600);
            try { key.setPointerCapture(e.pointerId); } catch (err) {}
            e.preventDefault();
        });
        key.addEventListener("pointerup", () => {
            clearTimeout(timer);
            if (Date.now() - downAt < 600) recall();
        });
        key.addEventListener("pointercancel", () => clearTimeout(timer));
        key.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); recall(); }
            if (e.key.toLowerCase() === "s") { e.preventDefault(); store(); }
        });
    }
    paint();
}

// MR-78 가변 선택도 — SELECTIVITY 노브 아래 3단 세그먼트 (WIDE/NORM/NARROW).
// NARROW는 고역을 접는 대신 정숙해진다 (약전계·이스터에그에서 진가). DSP는 Chromium 한정.
function mountMr78Selectivity() {
    if (tunerSkinId !== "mr78" || !tunerSvgEl || tunerSvgEl.querySelector("#tsSelG")) return;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("id", "tsSelG");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", "가변 선택도 — WIDE / NORMAL / NARROW");
    g.setAttribute("style", "cursor:pointer");
    const SEL_LBL = ["WIDE", "NORM", "NARROW"];
    g.innerHTML = '<title>SELECTIVITY — 누를 때마다 WIDE · NORMAL · NARROW</title>' +
        '<rect x="312" y="556" width="136" height="26" rx="5" fill="#0d1210" stroke="#31473b" stroke-width="1.4"/>' +
        SEL_LBL.map((t, i) =>
            '<rect id="tsSelSeg' + i + '" x="' + (315 + i * 44.5) + '" y="559" width="41.5" height="20" rx="3" fill="#14201a"/>' +
            '<text x="' + (336 + i * 44.5) + '" y="573" font-family="Arial" font-size="8.5" font-weight="700" letter-spacing=".5" fill="#7ca88e" text-anchor="middle" pointer-events="none">' + t + '</text>'
        ).join("");
    tunerSvgEl.appendChild(g);
    const paint = () => {
        for (let i = 0; i < 3; i++) {
            const seg = document.getElementById("tsSelSeg" + i);
            if (seg) seg.setAttribute("fill", i === tsSelectivity ? "#2c6a4a" : "#14201a");
        }
    };
    const cycle = () => {
        tsSelectivity = (tsSelectivity + 1) % 3;
        applyBlend();
        paint();
        playerSubtext.textContent = "선택도: " + ["WIDE — 개방적, 히스도 그대로", "NORMAL — 균형", "NARROW — 어둡지만 정숙 (약전계 유리)"][tsSelectivity];
    };
    g.addEventListener("click", cycle);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(); } });
    paint();
}

function bindTunerControls() {
    const dial = document.getElementById("tsDialHit");
    let dialDrag = false;
    dial.addEventListener("pointerdown", (e) => {
        dialDrag = true;
        try { dial.setPointerCapture(e.pointerId); } catch (err) {}
        tunerPreview(clientXToFreq(e.clientX));
        e.preventDefault();
    });
    dial.addEventListener("pointermove", (e) => { if (dialDrag) tunerPreview(clientXToFreq(e.clientX)); });
    dial.addEventListener("pointerup", (e) => {
        if (!dialDrag) return;
        dialDrag = false;
        tuneRelease(clientXToFreq(e.clientX));
    });
    dial.addEventListener("pointercancel", () => { dialDrag = false; });

    const knob = document.getElementById("tsKnobHit");
    let knobDrag = false, knobMoved = false, knobStartX = 0, knobStartFreq = 98;
    knob.addEventListener("pointerdown", (e) => {
        knobDrag = true;
        knobMoved = false;
        knobStartX = e.clientX;
        knobStartFreq = currentStation ? currentStation.freq : 98;
        try { knob.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    });
    knob.addEventListener("pointermove", (e) => {
        if (!knobDrag) return;
        const dx = e.clientX - knobStartX;
        if (Math.abs(dx) > 3) knobMoved = true;
        tunerPreview(knobStartFreq + dx / 14);
    });
    knob.addEventListener("pointerup", (e) => {
        if (!knobDrag) return;
        knobDrag = false;
        if (knobMoved) {
            tuneRelease(Math.max(88, Math.min(108, knobStartFreq + (e.clientX - knobStartX) / 14)));
        } else {
            // 가벼운 탭 — 디스플레이만 잠깐 깨운다
            tunerPreview(currentStation && currentStation.freq ? currentStation.freq : 98);
        }
    });
    knob.addEventListener("pointercancel", () => { knobDrag = false; });

    // 클릭 + 키보드(Enter/Space) 겸용 — SVG 요소는 네이티브 버튼이 아니라 직접 처리한다
    const on = (id, fn) => {
        const el = document.getElementById(id);
        el.addEventListener("click", fn);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fn();
            }
        });
    };

    // 다이얼·노브: 화살표 키로 인접 채널 선국
    const stepByKey = (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            stepStation(-1);
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            stepStation(1);
        }
    };
    dial.addEventListener("keydown", stepByKey);
    knob.addEventListener("keydown", stepByKey);

    on("tsPowerHit", () => { if (currentStation) togglePlay(); });
    // 녹음 실행은 카세트 데크 전담 — 튜너의 REC 스위치는 편성표·예약 녹음 입구다
    // (스위치 시각 상태는 tsSyncPanel이 녹음 중 표시로 계속 쓴다)
    on("tsRecHit", () => openSchedule());
    on("tsBlendHit", () => {
        blendOn = !blendOn;
        applyBlend();
        playerSubtext.textContent = blendOn ? "하이블렌드 ON — 고음 잡음을 줄입니다." : "하이블렌드 OFF";
    });
    on("tsModeHit", () => {
        monoOn = !monoOn;
        applyMono();
        playerSubtext.textContent = monoOn ? "모노 수신 모드" : "스테레오 수신 모드";
    });
    on("tsMuteHit", () => {
        audio.muted = !audio.muted;
        playerSubtext.textContent = audio.muted ? "음소거되었습니다." : "음소거를 해제했습니다.";
    });
    on("tsIfHit", () => cycleSleepTimer());
    on("tsRfHit", () => toggleStationList());
}

function initTunerSkin(id) {
    if (!TUNER_SKINS[id]) id = "t2";
    tunerSkinId = id;
    const skin = TUNER_SKINS[id];
    tunerCfg = skin.cfg;

    const stage = document.getElementById("tunerStage");
    stage.innerHTML = skin.svg;
    tunerSvgEl = stage.querySelector("svg");
    tsFreq = document.getElementById("tsFreq");
    tsFreqGlow = document.getElementById("tsFreqGlow");
    tsDialPtr = document.getElementById("tsDialPtr");
    tsSignalPtr = document.getElementById("tsSignalPtr");
    tsTunePtr = document.getElementById("tsTunePtr");
    tsKnob = document.getElementById("tsKnob");
    tsStationMarks = document.getElementById("tsStationMarks");
    if (tsStationMarks) tsStationMarks.setAttribute("class", "dialScale");

    // 히트 영역 생성 (cfg 좌표 기반, 투명)
    // 터치 기기는 손가락 크기만큼 히트 영역을 넓힌다 (겹치지 않는 한도 내에서)
    const hitPad = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? 18 : 0;
    Object.keys(TS_HIT_META).forEach((key) => {
        const box = tunerCfg.hits[key];
        if (!box) return;
        const meta = TS_HIT_META[key];
        const r = document.createElementNS(SVG_NS, "rect");
        r.setAttribute("id", "ts" + key.charAt(0).toUpperCase() + key.slice(1) + "Hit");
        r.setAttribute("x", box[0] - hitPad); r.setAttribute("y", box[1] - hitPad);
        r.setAttribute("width", box[2] + hitPad * 2); r.setAttribute("height", box[3] + hitPad * 2);
        r.setAttribute("fill", "#000"); r.setAttribute("fill-opacity", "0");
        r.setAttribute("style", "cursor:" + meta.cursor + ";touch-action:none");
        // 키보드 조작: 스위치는 버튼, 다이얼은 슬라이더로 노출
        r.setAttribute("tabindex", "0");
        r.setAttribute("role", key === "dial" ? "slider" : "button");
        r.setAttribute("aria-label", meta.title);
        if (key === "dial") {
            r.setAttribute("aria-valuemin", "88");
            r.setAttribute("aria-valuemax", "108");
            r.setAttribute("aria-valuenow", "98");
        }
        const t = document.createElementNS(SVG_NS, "title");
        t.textContent = meta.title;
        r.appendChild(t);
        tunerSvgEl.appendChild(r);
    });
    const kb = tunerCfg.hits.knob;
    const kc = document.createElementNS(SVG_NS, "circle");
    kc.setAttribute("id", "tsKnobHit");
    kc.setAttribute("cx", kb[0]); kc.setAttribute("cy", kb[1]); kc.setAttribute("r", kb[2]);
    kc.setAttribute("fill", "#000"); kc.setAttribute("fill-opacity", "0");
    kc.setAttribute("style", "cursor:grab;touch-action:none");
    kc.setAttribute("tabindex", "0");
    kc.setAttribute("role", "slider");
    kc.setAttribute("aria-label", "튜닝 노브 — 좌우 화살표로 선국");
    kc.setAttribute("aria-valuemin", "88");
    kc.setAttribute("aria-valuemax", "108");
    kc.setAttribute("aria-valuenow", "98");
    const kt = document.createElementNS(SVG_NS, "title");
    kt.textContent = "노브를 좌우로 드래그해 튜닝하세요";
    kc.appendChild(kt);
    tunerSvgEl.appendChild(kc);
    mountMr78Selectivity();
    mountB760Presets();

    // 방송국 마커 생성
    const m = tunerCfg.mark;
    stations.forEach((st) => {
        const mark = document.createElementNS(SVG_NS, "rect");
        mark.setAttribute("x", (tsFreqToX(st.freq) - 1.5).toFixed(1));
        mark.setAttribute("y", m.y);
        mark.setAttribute("width", "3");
        mark.setAttribute("height", m.h);
        mark.setAttribute("rx", "1");
        mark.setAttribute("fill", m.color);
        mark.setAttribute("data-station", st.id);
        tsStationMarks.appendChild(mark);
    });

    applyPanelLighting(tunerSvgEl);
    bindTunerControls();
    tsPanelState = "";
    tsSignal = 0;
    tsTune = 0.85;
    tunerSetStation(currentStation);
    tsSyncPanel();
    saveJson("fmRadio.skin", id);
    renderSkinPicker();
}

function renderSkinPicker() {
    const el = document.getElementById("skinPicker");
    el.innerHTML = "";
    SKIN_ORDER.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin-btn" + (unitShow.tuner && id === tunerSkinId ? " active" : "");
        b.textContent = TUNER_SKINS[id].label;
        b.addEventListener("click", () => {
            if (!unitShow.tuner) setUnitShow("tuner", true);
            if (id !== tunerSkinId) initTunerSkin(id);
            renderSkinPicker();
        });
        el.appendChild(b);
    });
    el.appendChild(hidePill("tuner"));
}

// ===================================================================
// 하이파이 랙: 이퀄라이저 · 앰프 · 턴테이블
// ===================================================================

// SVG 컨트롤을 키보드로도 조작 가능하게 — <title> 텍스트를 라벨로 쓰고
// Enter/Space를 클릭으로 매핑한다.
function svgButtonize(id, label) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    const t = el.querySelector("title");
    el.setAttribute("aria-label", label || (t ? t.textContent : ""));
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
    });
}

// ----- 그래픽 이퀄라이저 -----
const EQ_THEMES = {
    black: { top: "#292a30", mid: "#15161b", bot: "#08090c", ear: "#0b0c10", fieldA: "#0b0c10", fieldB: "#181a20", edge: "#555962", grid: "#777c86", fieldInk: "#ecece8", fieldMuted: "#a4a7ad", ink: "#f5f3ed", sub: "#c7c7c4", muted: "#8e9198", slot: "#020305", cap: "url(#eqCapBlack)", capTop: "#696d76", mark: "#f7f5ef", ledOff: "#11231b" },
    silver: { top: "#faf9f4", mid: "#d3d4d2", bot: "#8d9093", ear: "#aeb1b2", fieldA: "#25282c", fieldB: "#3c4045", edge: "#777b80", grid: "#959aa0", fieldInk: "#f1f2ee", fieldMuted: "#b8bdc0", ink: "#181a1d", sub: "#34373a", muted: "#565b60", slot: "#090b0d", cap: "url(#eqCapSilver)", capTop: "#ffffff", mark: "#25282c", ledOff: "#183027" },
    chrome: { top: "#fff9e9", mid: "#ccb985", bot: "#6d5a38", ear: "#796640", fieldA: "#17140e", fieldB: "#2a2418", edge: "#ead8a5", grid: "#897b5d", fieldInk: "#f8e9be", fieldMuted: "#bba978", ink: "#201b12", sub: "#423721", muted: "#615336", slot: "#070604", cap: "url(#eqCapGold)", capTop: "#fff5d4", mark: "#403318", ledOff: "#27251b" }
};
const EQ_MODELS = {
    ge5: { pill: "GE-5 · 5밴드", name: "GE-5", theme: "black", series: "WIDE RANGE", architecture: "wide", q: 1.0, capW: 64,
        freqs: [60, 250, 1000, 4000, 12000],
        labels: ["60", "250", "1k", "4k", "12k"],
        xs: [800, 1030, 1260, 1490, 1720] },
    ge10: { pill: "GE-10 · 10밴드", name: "GE-10", theme: "black", series: "STUDIO MONITOR", architecture: "studio", q: 1.4, capW: 46,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] },
    ge10silver: { pill: "SILVER · 10밴드", name: "GE-10S", theme: "silver", series: "PRECISION SERIES", architecture: "precision", q: 1.4, capW: 46,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] },
    ge10chrome: { pill: "CHAMPAGNE · 10밴드", name: "GE-10C", theme: "chrome", series: "SIGNATURE SERIES", architecture: "signature", q: 1.4, capW: 46,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] },
    // 메모리 EQ — 팩토리 프리셋·유저 슬롯·A/B 비교가 존재 이유 (Sansui SE-9/Technics SH-8058 오마주)
    se9: { pill: "SE-9 · 메모리", name: "SE-9", brand: "SANSUI", theme: "black", series: "COMPUTER MEMORY", architecture: "memory", q: 1.4, capW: 46,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] }
};
const EQ_ORDER = ["ge5", "ge10", "ge10silver", "ge10chrome", "se9"];

// ----- EQ 프리셋 — 커브는 (Hz, dB) 포인트로 선언하고 현재 모델 밴드로 리샘플한다 -----
// 5밴드(GE-5)에서도 10밴드에서도 같은 프리셋이 동작하고, 슬롯도 모델을 넘나든다.
const EQ_PRESETS = [
    { id: "night", key: "NIGHT", label: "LATE NIGHT", pts: [[31, 3], [62, 2], [125, 1], [250, 0], [500, 0], [1000, 0], [2000, .5], [4000, 1], [8000, 1], [16000, 0]] },
    { id: "vocal", key: "VOCAL", label: "VOCAL FOCUS", pts: [[31, -2], [62, -1.5], [125, -1], [250, -2], [500, 1], [1000, 2.5], [2000, 3], [4000, 2], [8000, -.5], [16000, -1]] },
    { id: "fmnr", key: "FM NR", label: "FM NOISE CUT", pts: [[31, 0], [62, 0], [125, .5], [250, 0], [500, 0], [1000, 0], [2000, 0], [4000, -1], [8000, -2.5], [16000, -5]] },
    { id: "vinyl", key: "VINYL", label: "VINYL RESTORE", pts: [[31, -4], [62, -1.5], [125, 0], [250, 0], [500, 0], [1000, 0], [2000, 0], [4000, 1], [8000, 1.5], [16000, 1]] },
    { id: "tape", key: "TAPE", label: "CASSETTE BRIGHT", pts: [[31, 0], [62, -1], [125, 0], [250, 0], [500, 0], [1000, 0], [2000, 1], [4000, 2], [8000, 3.5], [16000, 4]] },
    { id: "minisp", key: "MINI SP", label: "SMALL SPEAKER", pts: [[31, -5], [62, -3], [125, 1.5], [250, 2], [500, .5], [1000, 0], [2000, .5], [4000, 1], [8000, 0], [16000, -.5]] },
    { id: "bass", key: "BASS+", label: "BASS EXTENSION", pts: [[31, 5], [62, 4], [125, 2], [250, -.5], [500, 0], [1000, 0], [2000, 0], [4000, 0], [8000, 0], [16000, 0]] },
    { id: "y70", key: "'70s", label: "'70s HI-FI", pts: [[31, 1], [62, 2], [125, 1.5], [250, .5], [500, 0], [1000, -.5], [2000, -1], [4000, -.5], [8000, -1], [16000, -1.5]] },
    { id: "y80", key: "'80s", label: "'80s HI-FI", pts: [[31, 3], [62, 4], [125, 2], [250, 0], [500, -1], [1000, -2], [2000, -1], [4000, 1], [8000, 2], [16000, 3.5]] },
    { id: "modern", key: "MODERN", label: "MODERN HI-FI", pts: [[31, 1.5], [62, 1], [125, 0], [250, -.5], [500, 0], [1000, 0], [2000, 0], [4000, .5], [8000, .5], [16000, 1]] }
];

function eqCurveSample(pts, f) {
    if (f <= pts[0][0]) return pts[0][1];
    if (f >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
        if (f <= pts[i][0]) {
            const f0 = pts[i - 1][0], g0 = pts[i - 1][1], f1 = pts[i][0], g1 = pts[i][1];
            const t = (Math.log(f) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
            return g0 + (g1 - g0) * t;
        }
    }
    return 0;
}

function eqResample(pts) {
    return EQ_FREQS.map((f) => Math.max(-12, Math.min(12, Math.round(eqCurveSample(pts, f) * 2) / 2)));
}

function eqCurPts() {
    return EQ_FREQS.map((f, i) => [f, eqState.gains[eqModelId][i] || 0]);
}
const EQ_TOP = 100;
const EQ_BOT = 320;
const EQ_VB_H = 400;
let EQ_FREQS = [], EQ_LABELS = [], EQ_X = [], EQ_CAPW = 60;

const eqSaved = loadJson("fmRadio.eq", null);
let eqModelId = (eqSaved && EQ_MODELS[eqSaved.model]) ? eqSaved.model : "ge10";
let eqState = { on: !eqSaved || eqSaved.on !== false, gains: {} };
EQ_ORDER.forEach((k) => {
    const n = EQ_MODELS[k].freqs.length;
    const saved = eqSaved && eqSaved.gains && Array.isArray(eqSaved.gains[k]) && eqSaved.gains[k].length === n ? eqSaved.gains[k] : null;
    eqState.gains[k] = saved || new Array(n).fill(0);
});
// 구버전(단일 배열) 마이그레이션
if (eqSaved && Array.isArray(eqSaved.gains) && eqSaved.gains.length === 5) eqState.gains.ge5 = eqSaved.gains;

function eqApplyModelCfg() {
    const m = EQ_MODELS[eqModelId];
    EQ_FREQS = m.freqs;
    EQ_LABELS = m.labels;
    EQ_X = m.xs;
    EQ_CAPW = m.capW;
}
eqApplyModelCfg();

// 유저 슬롯 A–D (영속) · B 뱅크(오토-B, 세션) · MEMORY 무장 · 점등용 활성 프리셋
let eqSlots = (eqSaved && eqSaved.slots && typeof eqSaved.slots === "object") ? eqSaved.slots : {};
let eqBankB = null;
let eqBankOn = false;
let eqMemArmed = false;
let eqActivePreset = null;

function saveEq() {
    saveJson("fmRadio.eq", { on: eqState.on, model: eqModelId, gains: eqState.gains, slots: eqSlots });
}

// 모터라이즈드 전환 — 캡이 목표 커브로 미끄러져 이동 (SE-9 실물의 모터 슬라이더 오마주)
let eqMotorRaf = 0;
function eqMotorTo(target, done) {
    const from = eqState.gains[eqModelId].slice();
    const t0 = performance.now();
    cancelAnimationFrame(eqMotorRaf);
    const step = (now) => {
        const t = Math.min(1, (now - t0) / 320);
        const e = 1 - Math.pow(1 - t, 3);
        eqState.gains[eqModelId] = from.map((g, i) => g + (target[i] - g) * e);
        applyEq();
        updateEqVisuals();
        if (t < 1) {
            eqMotorRaf = requestAnimationFrame(step);
        } else {
            eqState.gains[eqModelId] = target.slice();
            applyEq();
            updateEqVisuals();
            saveEq();
            if (done) done();
        }
    };
    eqMotorRaf = requestAnimationFrame(step);
}

// 프리셋·슬롯 적용 — 직전 커브가 자동으로 B 뱅크에 담긴다 (오토-B)
function eqApplyCurvePts(pts, name, presetId) {
    eqBankB = { pts: eqCurPts() };
    eqBankOn = false;
    if (!eqState.on) eqState.on = true;
    eqActivePreset = presetId || null;
    eqMotorTo(eqResample(pts));
    eqPaintKeys();
    playerSubtext.textContent = "EQ 프리셋: " + name + " — A/B로 직전 커브와 비교할 수 있습니다.";
}

function eqToggleBank() {
    if (!eqBankB) {
        playerSubtext.textContent = "비교할 커브가 없습니다 — 프리셋을 적용하면 직전 커브가 B 뱅크에 담깁니다.";
        return;
    }
    const cur = { pts: eqCurPts() };
    eqMotorTo(eqResample(eqBankB.pts));
    eqBankB = cur;
    eqBankOn = !eqBankOn;
    eqActivePreset = null;
    eqPaintKeys();
    playerSubtext.textContent = eqBankOn ? "B 뱅크 — 바꾸기 전 커브를 듣는 중" : "A 뱅크 — 현재 커브를 듣는 중";
}

function eqSlotPress(slot) {
    if (eqMemArmed) {
        eqSlots[slot] = { pts: eqCurPts() };
        eqMemArmed = false;
        saveEq();
        eqPaintKeys();
        playerSubtext.textContent = "현재 커브를 슬롯 " + slot + "에 저장했습니다.";
        return;
    }
    if (!eqSlots[slot] || !Array.isArray(eqSlots[slot].pts)) {
        playerSubtext.textContent = "빈 슬롯입니다 — MEMORY를 누른 뒤 " + slot + "를 누르면 현재 커브가 저장됩니다.";
        return;
    }
    eqApplyCurvePts(eqSlots[slot].pts, "슬롯 " + slot, "slot" + slot);
}


function setEqModel(id) {
    if (!EQ_MODELS[id] || id === eqModelId) return;
    eqModelId = id;
    eqApplyModelCfg();
    buildEqChain();
    mountEq();
    saveEq();
    playerSubtext.textContent = "이퀄라이저: " + EQ_MODELS[id].pill;
}

// ----- 컴포넌트 표시 구성 -----
// 오디오 구성에서 랙 유닛을 개별로 숨길 수 있다. 숨김은 시각적일 뿐 —
// 오디오 체인(EQ 등)과 재생 중인 소리는 그대로다. EQ만 기본 숨김.
const UNIT_STAGES = { tuner: "tunerStage", eq: "eqStage", amp: "ampStage", deck: "deckStage", tt: "ttStage" };
let unitShow = loadJson("fmRadio.units", null);
if (!unitShow || typeof unitShow !== "object") {
    unitShow = { tuner: true, eq: loadJson("fmRadio.eqShow", false), amp: true, deck: true, tt: true };
}
Object.keys(UNIT_STAGES).forEach((k) => { if (typeof unitShow[k] !== "boolean") unitShow[k] = k !== "eq"; });

// 트랜스포트가 도는 동안(재생·녹음)은 데크를 숨겨 두었어도 보여준다 — 돌아가는 릴이 보이도록
let deckStageLive = false;

function applyUnitVisibility() {
    Object.entries(UNIT_STAGES).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.hidden = !unitShow[key] && !(key === "deck" && deckStageLive);
    });
    // 정체성: 편성표는 튜너에서(REC/CAL 스위치), 보관함은 데크에서(랙 서랍) 들어간다.
    // 헤더 버튼은 해당 기기가 화면에 없을 때(간편 모드·기기 숨김)만 나타나는 비상구다.
    const unitsOnScreen = viewMode !== "simple";
    const schedBtn = document.getElementById("headerSchedBtn");
    if (schedBtn) schedBtn.hidden = unitsOnScreen && unitShow.tuner;
    const tapeBtn = document.getElementById("headerTapeBtn");
    if (tapeBtn) tapeBtn.hidden = unitsOnScreen && unitShow.deck;
}

function syncDeckStageLive() {
    const live = deckMode === "play" || (deckMode === "rec" && !!recorder) || (recOnB && !!recorder);
    if (live === deckStageLive) return;
    deckStageLive = live;
    const el = document.getElementById(UNIT_STAGES.deck);
    if (el) el.classList.toggle("transport-live", live);
    applyUnitVisibility();
}

function setUnitShow(key, show) {
    unitShow[key] = !!show;
    saveJson("fmRadio.units", unitShow);
    applyUnitVisibility();
    renderSkinPicker();
    renderEqPicker();
    renderAmpPicker();
    renderDeckPicker();
    renderTtPicker();
}

// 피커 공통 '숨김' 알약
function hidePill(key) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "skin-btn" + (unitShow[key] ? "" : " active");
    b.textContent = "숨김";
    b.addEventListener("click", () => setUnitShow(key, false));
    return b;
}

// 모델이 한 종류뿐인 컴포넌트도 명칭 알약 + 숨김으로 구성한다
function renderSinglePicker(elId, key, label) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = "";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "skin-btn" + (unitShow[key] ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => setUnitShow(key, true));
    el.appendChild(b);
    el.appendChild(hidePill(key));
}

let ttModelId = loadJson("fmRadio.turntable", "pl12");
if (!TT_MODELS[ttModelId]) ttModelId = "pl12";

function renderDeckPicker() {
    const el = document.getElementById("deckPicker");
    if (!el) return;
    el.innerHTML = "";
    DECK_ORDER.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin-btn" + (unitShow.deck && id === deckModelId ? " active" : "");
        b.textContent = DECK_MODELS[id].label;
        b.addEventListener("click", () => {
            if (!unitShow.deck) setUnitShow("deck", true);
            if (id !== deckModelId) {
                deckModelId = id;
                saveJson("fmRadio.deck", id);
                mountDeck();
                deckRefreshShelf();
                playerSubtext.textContent = "카세트 데크: " + DECK_MODELS[id].label;
            }
            renderDeckPicker();
        });
        el.appendChild(b);
    });
    el.appendChild(hidePill("deck"));
}

function renderTtPicker() {
    const el = document.getElementById("ttPicker");
    if (!el) return;
    el.innerHTML = "";
    TT_ORDER.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin-btn" + (unitShow.tt && id === ttModelId ? " active" : "");
        b.textContent = TT_MODELS[id].label;
        b.addEventListener("click", () => {
            if (!unitShow.tt) setUnitShow("tt", true);
            if (id !== ttModelId) {
                ttModelId = id;
                saveJson("fmRadio.turntable", id);
                mountTurntable();
                playerSubtext.textContent = "턴테이블: " + TT_MODELS[id].label;
            }
            renderTtPicker();
        });
        el.appendChild(b);
    });
    el.appendChild(hidePill("tt"));
}

function renderEqPicker() {
    const el = document.getElementById("eqPicker");
    if (!el) return;
    el.innerHTML = "";
    EQ_ORDER.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin-btn" + (unitShow.eq && id === eqModelId ? " active" : "");
        b.textContent = EQ_MODELS[id].pill;
        b.addEventListener("click", () => {
            if (!unitShow.eq) setUnitShow("eq", true);
            setEqModel(id);
            renderEqPicker();
        });
        el.appendChild(b);
    });
    el.appendChild(hidePill("eq"));
}

function eqGainToY(g) {
    return EQ_TOP + (12 - g) / 24 * (EQ_BOT - EQ_TOP);
}

function mountEq() {
    const model = EQ_MODELS[eqModelId];
    const theme = EQ_THEMES[model.theme] || EQ_THEMES.black;
    const chrome = model.theme === "chrome";
    const silver = model.theme === "silver";
    const isFive = model.architecture === "wide";
    const fieldX = isFive ? 620 : 650;
    const fieldW = isFive ? 1320 : 1290;
    const fieldR = fieldX + fieldW;
    const screw = (x, y) => '<g transform="translate(' + x + ' ' + y + ')" pointer-events="none"><circle r="8" fill="url(#eqScrew)" stroke="#111319" stroke-width="1.4"/><path d="M-4 -1 L4 1" stroke="#1b1d21" stroke-width="1.4"/></g>';

    // 눈금은 실제 랙 폭에서도 읽히도록 주요 값의 대비와 굵기를 높인다.
    let grid = "";
    [-12, -9, -6, -3, 0, 3, 6, 9, 12].forEach((g) => {
        const y = eqGainToY(g);
        grid += '<line x1="' + (fieldX + 58) + '" y1="' + y + '" x2="' + (fieldR - 24) + '" y2="' + y + '" stroke="' + (g === 0 ? theme.fieldInk : theme.grid) + '" stroke-width="' + (g === 0 ? 2.4 : 1) + '" opacity="' + (g === 0 ? 0.78 : 0.34) + '"/>';
    });
    const bandW = isFive ? 170 : 92;
    const wideBandNames = ["SUB BASS", "LOW", "MID", "PRESENCE", "AIR"];
    const wideBandRanges = ["20–120", "120–500", "0.5–2k", "2–8k", "8–20k"];
    const bandFrames = EQ_X.map((x, i) => {
        const frame = '<rect x="' + (x - bandW / 2) + '" y="88" width="' + bandW + '" height="248" rx="8" fill="#000" opacity="' + (isFive ? '.2' : '.08') + '" stroke="' + theme.edge + '" stroke-opacity="' + (isFive ? '.46' : '.14') + '"/>';
        if (!isFive) return frame;
        return frame +
            '<path d="M' + (x - 77) + ' 98 H' + (x + 77) + '" stroke="#fff" stroke-width="1.4" opacity=".12"/>' +
            '<rect x="' + (x - 72) + '" y="101" width="144" height="24" rx="5" fill="#141820" stroke="' + theme.edge + '" stroke-opacity=".52"/>' +
            '<text x="' + (x - 68) + '" y="117" font-family="Arial" font-size="10.5" font-weight="700" letter-spacing="1" fill="' + theme.fieldInk + '">' + wideBandNames[i] + '</text>' +
            '<circle cx="' + (x + 59) + '" cy="113" r="3.8" fill="#54d18a" opacity=".82"/><circle cx="' + (x + 59) + '" cy="113" r="7" fill="#54d18a" opacity=".08"/>' +
            '<path d="M' + (x - 68) + ' 143 h18 M' + (x - 68) + ' 171 h12 M' + (x - 68) + ' 199 h18 M' + (x - 68) + ' 227 h12 M' + (x - 68) + ' 255 h18 M' + (x - 68) + ' 283 h12" stroke="' + theme.grid + '" stroke-width="1.2" opacity=".42"/>' +
            '<text x="' + (x - 68) + '" y="324" font-family="Arial" font-size="12" font-weight="700" letter-spacing=".8" fill="' + theme.muted + '">' + wideBandRanges[i] + ' Hz</text>';
    }).join("");
    const hw = EQ_CAPW / 2;
    const hitHw = Math.min(58, Math.floor((EQ_X[1] - EQ_X[0]) / 2) - 3);
    const sliders = EQ_FREQS.map((f, i) => {
        const x = EQ_X[i];
        const ledW = isFive ? 11 : 8;
        const spectrum = Array.from({ length: 8 }, (_, j) => {
            const on = j >= 6 ? "#f05a3a" : j >= 4 ? "#e4b33f" : "#54d18a";
            return '<rect id="eqBandLvl' + i + '_' + j + '" data-on="' + on + '" data-off="' + theme.ledOff + '" x="' + (x + hw + 10) + '" y="' + (292 - j * 23) + '" width="' + ledW + '" height="15" rx="2.5" fill="' + theme.ledOff + '" stroke="#000" stroke-opacity=".38"/>';
        }).join("");
        return '<rect x="' + (x - 13) + '" y="' + (EQ_TOP - 11) + '" width="26" height="' + (EQ_BOT - EQ_TOP + 22) + '" rx="13" fill="#000" opacity=".42" filter="url(#eqSlotShadow)"/>' +
            '<rect x="' + (x - 7) + '" y="' + (EQ_TOP - 8) + '" width="14" height="' + (EQ_BOT - EQ_TOP + 16) + '" rx="7" fill="url(#eqSlot)" stroke="' + theme.edge + '" stroke-width="1.3"/>' +
            '<line x1="' + x + '" y1="' + (EQ_TOP - 2) + '" x2="' + x + '" y2="' + (EQ_BOT + 2) + '" stroke="#000" stroke-width="2" opacity=".75"/>' +
            spectrum +
            '<g id="eqH' + i + '" filter="url(#eqHandleShadow)">' +
            '<rect x="' + (x - hw) + '" y="-19" width="' + EQ_CAPW + '" height="38" rx="6" fill="' + theme.cap + '" stroke="' + (chrome ? '#5f4e2e' : '#08090b') + '" stroke-width="1.8"/>' +
            '<rect x="' + (x - hw + 3) + '" y="-16" width="' + (EQ_CAPW - 6) + '" height="9" rx="3" fill="' + theme.capTop + '" opacity=".72"/>' +
            '<path d="M' + (x - hw + 5) + ' -12 H' + (x + hw - 5) + '" stroke="#fff" stroke-width="1.4" opacity=".35"/>' +
            '<rect x="' + (x - hw + 3) + '" y="-3" width="' + (EQ_CAPW - 6) + '" height="6" rx="2" fill="' + theme.mark + '"/>' +
            '<rect x="' + (x - hw + 4) + '" y="11" width="' + (EQ_CAPW - 8) + '" height="4" rx="2" fill="#000" opacity=".35"/>' +
            '</g>' +
            '<text id="eqV' + i + '" x="' + x + '" y="80" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="' + theme.fieldInk + '" text-anchor="middle">0</text>' +
            '<text x="' + x + '" y="358" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing=".4" fill="' + theme.fieldInk + '" text-anchor="middle">' + EQ_LABELS[i] + '</text>' +
            '<rect id="eqHit' + i + '" x="' + (x - hitHw) + '" y="66" width="' + (hitHw * 2) + '" height="300" fill="#000" fill-opacity="0" style="cursor:ns-resize;touch-action:none" tabindex="0" role="slider" aria-label="' + EQ_LABELS[i] + 'Hz 게인" aria-valuemin="-12" aria-valuemax="12"><title>' + EQ_LABELS[i] + 'Hz &#177;12dB</title></rect>';
    }).join("");
    let lvl = "";
    for (let i = 0; i < 12; i++) {
        lvl += '<rect id="eqLvl' + i + '" x="518" y="' + (300 - i * 19) + '" width="54" height="12" rx="2.5" fill="#1e1610" stroke="#050607" stroke-width="1"/>';
    }
    const isMemory = model.architecture === "memory";
    // SE-9: 레벨 LED 컬럼 자리에 프리셋 키 뱅크 — 팩토리 10 + 슬롯 A–D + MEMORY + A/B
    let keyBank = "";
    if (isMemory) {
        const keyDefs = EQ_PRESETS.map((preset) => ({ id: preset.id, key: preset.key, title: preset.label }))
            .concat([
                { id: "slotA", key: "A", title: "유저 슬롯 A" }, { id: "slotB", key: "B", title: "유저 슬롯 B" },
                { id: "slotC", key: "C", title: "유저 슬롯 C" }, { id: "slotD", key: "D", title: "유저 슬롯 D" },
                { id: "mem", key: "MEMORY", title: "MEMORY — 누른 뒤 A–D에 현재 커브 저장" },
                { id: "ab", key: "A / B", title: "A/B — 직전 커브와 비교" }
            ]);
        keyBank = '<rect x="392" y="70" width="202" height="276" rx="10" fill="#07090b" stroke="' + theme.edge + '" stroke-width="2"/>' +
            '<rect x="400" y="78" width="186" height="260" rx="6" fill="url(#eqField)" stroke="#000"/>' +
            '<text x="493" y="96" font-family="Arial" font-size="11.5" font-weight="700" letter-spacing="1.6" fill="#d4d7da" text-anchor="middle">PRESET MEMORY</text>' +
            keyDefs.map((keyDef, i) => {
                const col = Math.floor(i / 8), row = i % 8;
                const x = 405 + col * 94, y = 103 + row * 29;
                return '<g id="eqKey_' + keyDef.id + '" role="button" tabindex="0" aria-label="EQ 프리셋 ' + keyDef.title + '" style="cursor:pointer">' +
                    '<title>' + keyDef.title + '</title>' +
                    '<rect x="' + x + '" y="' + y + '" width="88" height="25" rx="4" fill="#191b21" stroke="#3a3e46" stroke-width="1.2"/>' +
                    '<path d="M' + (x + 4) + ' ' + (y + 3.5) + ' H' + (x + 84) + '" stroke="#fff" stroke-width="1.2" opacity=".16" pointer-events="none"/>' +
                    '<circle id="eqKeyLed_' + keyDef.id + '" cx="' + (x + 9) + '" cy="' + (y + 12.5) + '" r="2.8" fill="#1c3527" pointer-events="none"/>' +
                    '<text x="' + (x + 48) + '" y="' + (y + 17) + '" font-family="Arial" font-size="9.5" font-weight="700" letter-spacing=".6" fill="#c4c8ce" text-anchor="middle" pointer-events="none">' + keyDef.key + '</text></g>';
            }).join("");
    }
    let modelTrim = "";
    if (model.architecture === "wide") {
        modelTrim = '<rect x="336" y="78" width="44" height="244" rx="8" fill="#090a0d" stroke="#434750"/><path d="M358 98 V302" stroke="#b9bdc5" stroke-width="2" opacity=".45"/><text x="358" y="344" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="' + theme.muted + '" text-anchor="middle">WIDE</text>';
    } else if (model.architecture === "precision") {
        modelTrim = '<path d="M62 34 H1938 M62 374 H1938" stroke="#fff" stroke-width="2" opacity=".5"/><rect x="344" y="38" width="250" height="25" rx="3" fill="#9b9d9e" stroke="#f7f7f3"/><text x="469" y="55" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2.4" fill="#282b2e" text-anchor="middle">LABORATORY CALIBRATED</text>';
    } else if (model.architecture === "signature") {
        modelTrim = '<rect x="344" y="36" width="250" height="28" rx="14" fill="#4f422b" stroke="#f1deb0"/><text x="469" y="55" font-family="Georgia, serif" font-style="italic" font-size="13" fill="#fff0c5" text-anchor="middle">Signature Reference</text><path d="M62 29 H330 M608 29 H1938" stroke="#fff6db" stroke-width="2" opacity=".42"/>';
    } else if (model.architecture === "memory") {
        modelTrim = '<rect x="344" y="38" width="250" height="24" rx="3" fill="#0a1410" stroke="#2f5a44"/><text x="469" y="55" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2.2" fill="#6fe0a4" text-anchor="middle">COMPUTER MEMORY · MOTOR DRIVE</text>';
    } else {
        modelTrim = '<rect x="344" y="38" width="250" height="24" rx="3" fill="#0a0b0e" stroke="#494d55"/><text x="469" y="55" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2.2" fill="#bfc2c8" text-anchor="middle">DISCRETE ANALOG FILTERS</text>';
    }
    document.getElementById("eqStage").innerHTML =
        '<svg class="eq-svg" viewBox="0 0 2000 400" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + (model.brand || "YAMAHA") + ' ' + model.name + ' 스테레오 그래픽 이퀄라이저">' +
        '<defs>' +
        '<linearGradient id="eqFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + theme.top + '"/><stop offset=".18" stop-color="' + theme.mid + '"/><stop offset=".68" stop-color="' + theme.mid + '"/><stop offset="1" stop-color="' + theme.bot + '"/></linearGradient>' +
        '<linearGradient id="eqField" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + theme.fieldA + '"/><stop offset=".12" stop-color="' + theme.fieldB + '"/><stop offset=".82" stop-color="' + theme.fieldA + '"/><stop offset="1" stop-color="#050608"/></linearGradient>' +
        '<linearGradient id="eqSlot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".35" stop-color="' + theme.slot + '"/><stop offset=".62" stop-color="#252830"/><stop offset="1" stop-color="#000"/></linearGradient>' +
        '<linearGradient id="eqCapBlack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#777b84"/><stop offset=".18" stop-color="#383b42"/><stop offset=".62" stop-color="#17191e"/><stop offset="1" stop-color="#050608"/></linearGradient>' +
        '<linearGradient id="eqCapSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".2" stop-color="#b6b9bb"/><stop offset=".52" stop-color="#f0f0ed"/><stop offset=".78" stop-color="#8d9093"/><stop offset="1" stop-color="#55585c"/></linearGradient>' +
        '<linearGradient id="eqCapGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#705d37"/><stop offset=".18" stop-color="#fff1c3"/><stop offset=".42" stop-color="#b69c63"/><stop offset=".68" stop-color="#f7e7b9"/><stop offset="1" stop-color="#5c4a2a"/></linearGradient>' +
        '<linearGradient id="eqScrew" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f0"/><stop offset=".45" stop-color="#8b8e92"/><stop offset="1" stop-color="#34363a"/></linearGradient>' +
        '<pattern id="eqBrush" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0 1 H10 M0 4 H10" stroke="#fff" stroke-width=".45" opacity=".16"/><path d="M0 2.5 H10" stroke="#000" stroke-width=".4" opacity=".12"/></pattern>' +
        '<filter id="eqSlotShadow" x="-80%" y="-10%" width="260%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>' +
        '<filter id="eqHandleShadow" x="-45%" y="-60%" width="200%" height="230%"><feDropShadow dx="2.5" dy="5" stdDeviation="3" flood-color="#000" flood-opacity=".72"/></filter>' +
        '</defs>' +
        '<rect width="2000" height="400" rx="9" fill="url(#eqFace)"/>' +
        '<rect x="44" y="7" width="1912" height="380" rx="7" fill="url(#eqBrush)" opacity="' + (silver || chrome ? '.72' : '.22') + '"/>' +
        (chrome ? '<path d="M58 22 H1942 M58 377 H1942" stroke="#fff5d4" stroke-width="3" opacity=".55"/><path d="M120 0 L720 0 L430 400 H0 Z" fill="#fff" opacity=".07"/>' : '') +
        '<rect x="48" y="10" width="1904" height="378" rx="7" fill="none" stroke="' + (silver ? '#fdfdf9' : chrome ? '#f3dfad' : '#42454d') + '" stroke-width="2.5" opacity=".8"/>' +
        '<rect y="390" width="2000" height="10" fill="#000" opacity=".55"/>' +
        // 랙 이어
        '<rect x="0" y="0" width="44" height="400" rx="8" fill="' + theme.ear + '"/><rect x="1956" y="0" width="44" height="400" rx="8" fill="' + theme.ear + '"/>' +
        screw(22, 52) + screw(22, 348) + screw(1978, 52) + screw(1978, 348) + modelTrim +
        // 좌측 컨트롤 블록
        '<text x="78" y="82" font-family="Arial, sans-serif" font-size="32" font-weight="800" letter-spacing="2" fill="' + theme.ink + '">' + (model.brand || "YAMAHA") + '</text>' +
        '<text x="80" y="111" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2.1" fill="' + theme.sub + '">' + model.name + ' · ' + model.series + '</text>' +
        '<text x="80" y="137" font-family="Arial, sans-serif" font-size="11" letter-spacing="1.7" fill="' + theme.muted + '">NATURAL SOUND GRAPHIC EQUALIZER</text>' +
        '<text x="82" y="183" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.5" fill="' + theme.sub + '">POWER</text>' +
        '<rect x="80" y="194" width="50" height="74" rx="5" fill="#07080a" stroke="' + theme.edge + '" stroke-width="1.7"/>' +
        '<rect x="87" y="201" width="36" height="54" rx="4" fill="url(#eqCapSilver)" stroke="#111319"/><path d="M91 207 H119" stroke="#fff" stroke-width="3" opacity=".6"/>' +
        '<circle id="eqLed" cx="177" cy="210" r="8" fill="#3a2012" stroke="#160c08" stroke-width="2"/>' +
        '<text x="196" y="215" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.2" fill="' + theme.sub + '">EQ ACTIVE</text>' +
        '<text x="80" y="305" font-family="Arial" font-size="12" font-weight="700" letter-spacing="1.3" fill="' + theme.sub + '">SIGNAL PATH</text>' +
        '<rect id="eqDefeatBtn" x="80" y="316" width="218" height="50" rx="6" fill="#202229" stroke="' + theme.edge + '" stroke-width="1.7" style="cursor:pointer" tabindex="0" role="button" aria-label="EQ 켜기/끄기"><title>EQ 켜기/끄기 (DEFEAT)</title></rect>' +
        '<rect x="87" y="322" width="204" height="11" rx="3" fill="#555962" opacity=".7" pointer-events="none"/>' +
        '<text x="189" y="354" font-family="Arial" font-size="15" font-weight="800" letter-spacing="2.2" fill="#f2f2ee" text-anchor="middle" pointer-events="none">DEFEAT / ACTIVE</text>' +
        // 레벨 LED 컬럼 (SE-9는 같은 자리에 프리셋 키 뱅크)
        (isMemory ? keyBank :
            '<rect x="392" y="70" width="202" height="276" rx="10" fill="#07090b" stroke="' + theme.edge + '" stroke-width="2"/>' +
            '<rect x="402" y="80" width="182" height="256" rx="6" fill="url(#eqField)" stroke="#000"/>' +
            '<text x="545" y="101" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.8" fill="#d4d7da" text-anchor="middle">OUTPUT LEVEL</text>' +
            '<text x="503" y="113" font-family="Arial" font-size="11" fill="#9ca0a5" text-anchor="end">+12</text>' +
            '<text x="503" y="310" font-family="Arial" font-size="11" fill="#9ca0a5" text-anchor="end">-12</text>' +
            lvl) +
        // 슬라이더 필드
        '<rect x="' + (fieldX + 5) + '" y="58" width="' + fieldW + '" height="320" rx="10" fill="#000" opacity=".55" filter="url(#eqSlotShadow)"/>' +
        '<rect x="' + fieldX + '" y="52" width="' + fieldW + '" height="320" rx="9" fill="url(#eqField)" stroke="' + theme.edge + '" stroke-width="2.4"/>' +
        '<path d="M' + (fieldX + 10) + ' 64 H' + (fieldR - 10) + '" stroke="#fff" stroke-width="2" opacity=".15"/>' +
        bandFrames +
        grid +
        '<text x="' + (fieldX + 15) + '" y="' + (EQ_TOP + 6) + '" font-family="Arial" font-size="15" font-weight="700" fill="' + theme.fieldInk + '">+12</text>' +
        '<text x="' + (fieldX + 24) + '" y="' + (eqGainToY(6) + 5) + '" font-family="Arial" font-size="12" fill="' + theme.fieldMuted + '">+6</text>' +
        '<text x="' + (fieldX + 30) + '" y="' + (eqGainToY(0) + 5) + '" font-family="Arial" font-size="15" font-weight="700" fill="' + theme.fieldInk + '">0</text>' +
        '<text x="' + (fieldX + 28) + '" y="' + (eqGainToY(-6) + 5) + '" font-family="Arial" font-size="12" fill="' + theme.fieldMuted + '">-6</text>' +
        '<text x="' + (fieldX + 14) + '" y="' + (EQ_BOT + 6) + '" font-family="Arial" font-size="15" font-weight="700" fill="' + theme.fieldInk + '">-12</text>' +
        sliders + '<text x="' + (fieldR - 20) + '" y="79" font-family="Arial" font-size="12" font-weight="700" letter-spacing="1.8" fill="' + theme.fieldInk + '" text-anchor="end">REAL-TIME SPECTRUM</text>' +
        '<text x="' + (fieldR - 20) + '" y="359" font-family="Arial" font-size="14" font-weight="700" letter-spacing="1.5" fill="' + theme.fieldInk + '" text-anchor="end">Hz</text>' +
        '</svg>';

    const svg = document.querySelector("#eqStage svg");
    applyPanelLighting(svg);
    EQ_FREQS.forEach((f, i) => {
        const hit = document.getElementById("eqHit" + i);
        let drag = false;
        const setFromY = (clientY) => {
            const r = svg.getBoundingClientRect();
            const y = (clientY - r.top) / r.height * EQ_VB_H;
            let g = 12 - (y - EQ_TOP) / (EQ_BOT - EQ_TOP) * 24;
            g = Math.max(-12, Math.min(12, g));
            if (Math.abs(g) < 0.7) g = 0;      // 센터 디텐트
            eqState.gains[eqModelId][i] = Math.round(g * 2) / 2;
            applyEq();
            updateEqVisuals();
        };
        hit.addEventListener("pointerdown", (e) => { drag = true; try { hit.setPointerCapture(e.pointerId); } catch (err) {} setFromY(e.clientY); e.preventDefault(); });
        hit.addEventListener("pointermove", (e) => { if (drag) setFromY(e.clientY); });
        hit.addEventListener("pointerup", () => { drag = false; eqActivePreset = null; eqPaintKeys(); saveEq(); });
        hit.addEventListener("pointercancel", () => { drag = false; });
        hit.addEventListener("keydown", (e) => {
            const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            eqState.gains[eqModelId][i] = Math.max(-12, Math.min(12, eqState.gains[eqModelId][i] + step));
            eqActivePreset = null;
            eqPaintKeys();
            applyEq();
            updateEqVisuals();
            saveEq();
        });
    });
    const defeatBtn = document.getElementById("eqDefeatBtn");
    const toggleDefeat = () => {
        eqState.on = !eqState.on;
        applyEq();
        updateEqVisuals();
        saveEq();
        playerSubtext.textContent = eqState.on ? "이퀄라이저 ON" : "이퀄라이저 DEFEAT (바이패스)";
    };
    defeatBtn.addEventListener("click", toggleDefeat);
    defeatBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDefeat();
        }
    });
    if (isMemory) {
        const bindKey = (id, fn) => {
            const el = document.getElementById("eqKey_" + id);
            if (!el) return;
            el.addEventListener("click", fn);
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
            });
        };
        EQ_PRESETS.forEach((preset) => bindKey(preset.id, () => eqApplyCurvePts(preset.pts, preset.label, preset.id)));
        ["A", "B", "C", "D"].forEach((slot) => bindKey("slot" + slot, () => eqSlotPress(slot)));
        bindKey("mem", () => {
            eqMemArmed = !eqMemArmed;
            eqPaintKeys();
            playerSubtext.textContent = eqMemArmed
                ? "MEMORY — A–D 키를 누르면 현재 커브가 저장됩니다."
                : "MEMORY 취소";
        });
        bindKey("ab", eqToggleBank);
        eqPaintKeys();
    }
    renderEqPicker();
    updateEqVisuals();
}

// SE-9 키 램프 — 활성 프리셋·저장된 슬롯·MEMORY 무장·B 뱅크 상태를 칠한다
function eqPaintKeys() {
    if (!document.getElementById("eqKey_mem")) return;
    const paint = (id, on, color) => {
        const led = document.getElementById("eqKeyLed_" + id);
        if (led) led.style.fill = on ? (color || "#54d18a") : "#1c3527";
    };
    EQ_PRESETS.forEach((preset) => paint(preset.id, eqActivePreset === preset.id));
    ["A", "B", "C", "D"].forEach((slot) => {
        const stored = !!(eqSlots[slot] && eqSlots[slot].pts);
        paint("slot" + slot, eqActivePreset === "slot" + slot || stored,
            eqActivePreset === "slot" + slot ? "#54d18a" : stored ? "#2c5c42" : null);
    });
    paint("mem", eqMemArmed, "#f0b43e");
    paint("ab", eqBankOn, "#f0b43e");
}

function updateEqVisuals() {
    EQ_FREQS.forEach((f, i) => {
        const h = document.getElementById("eqH" + i);
        const v = document.getElementById("eqV" + i);
        if (!h) return;
        h.setAttribute("transform", "translate(0," + eqGainToY(eqState.gains[eqModelId][i]).toFixed(1) + ")");
        h.style.opacity = eqState.on ? 1 : 0.4;
        const shown = Math.round(eqState.gains[eqModelId][i] * 2) / 2;
        v.textContent = (shown > 0 ? "+" : "") + shown;
        const hit = document.getElementById("eqHit" + i);
        if (hit) hit.setAttribute("aria-valuenow", eqState.gains[eqModelId][i]);
    });
    const led = document.getElementById("eqLed");
    if (led) led.style.fill = eqState.on ? "#ff7a3a" : "#3a2012";
}

// 8B 바이어스 미터 모드 — 0=VU · 1=CH A 바이어스 · 2=CH B 바이어스 (미터 클릭으로 순환)
let ampBiasMode = 0;
// 91E 정류관 지연 — 콜드 스타트 시 이 시각까지 출력 무음 (마지막 0.7초 페이드인)
let ampRectUntil = 0;
let ampModelId = loadJson("fmRadio.amp", "mc2105");
if (!AMP_MODELS[ampModelId]) ampModelId = "mc2105";


function updateVolKnob() {
    const vol = AMP_MODELS[ampModelId].vol;
    const mark = document.getElementById("ampVolMark");
    if (vol && mark) {
        // 7시(-135°) ~ 5시(+135°) 사이를 도는 클래식 볼륨 포지션
        const ang = -135 + volumeLevel * 270;
        mark.setAttribute("transform", "rotate(" + ang.toFixed(1) + " " + vol.cx + " " + vol.cy + ")");
    }
    updateMa2375Display();
}

function updateMa2375Display() {
    const source = phonoActive ? "Phone" : deckMode === "play" ? "CAS" : "Tuner";
    const volume = Math.round(volumeLevel * 100) + "%";
    [["ma2375SourceText", source], ["ma2375SourceGlow", source],
        ["ma2375VolumeText", volume], ["ma2375VolumeGlow", volume]].forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== value) el.textContent = value;
    });
}

function bindAmpVolume() {
    const vol = AMP_MODELS[ampModelId].vol;
    const svg = document.querySelector("#ampStage svg");
    if (!vol || !svg) return;
    const hit = document.createElementNS(SVG_NS, "circle");
    hit.setAttribute("cx", vol.cx);
    hit.setAttribute("cy", vol.cy);
    hit.setAttribute("r", vol.r);
    hit.setAttribute("fill", "#000");
    hit.setAttribute("fill-opacity", "0");
    hit.setAttribute("style", "cursor:ns-resize;touch-action:none");
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "slider");
    hit.setAttribute("aria-label", "볼륨");
    hit.setAttribute("aria-valuemin", "0");
    hit.setAttribute("aria-valuemax", "100");
    hit.setAttribute("aria-valuenow", Math.round(volumeLevel * 100));
    const t = document.createElementNS(SVG_NS, "title");
    t.textContent = "볼륨 — 위아래로 드래그";
    hit.appendChild(t);
    svg.appendChild(hit);
    let drag = false, startY = 0, startV = 1;
    hit.addEventListener("pointerdown", (e) => {
        drag = true;
        startY = e.clientY;
        startV = volumeLevel;
        try { hit.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    });
    hit.addEventListener("pointermove", (e) => {
        if (!drag) return;
        let v = startV + (startY - e.clientY) / 180;
        // 91E: 무단이 아니라 12스텝 어테뉴에이터 — 딸깍딸깍 스냅
        if (ampModelId === "300b") v = Math.round(Math.max(0, Math.min(1, v)) * 12) / 12;
        setVolumeLevel(v);
    });
    hit.addEventListener("pointerup", () => {
        drag = false;
        saveJson("fmRadio.volume", volumeLevel);
    });
    hit.addEventListener("pointercancel", () => { drag = false; });
    hit.addEventListener("keydown", (e) => {
        const step = (e.key === "ArrowUp" || e.key === "ArrowRight") ? 0.05
            : (e.key === "ArrowDown" || e.key === "ArrowLeft") ? -0.05 : 0;
        if (!step) return;
        e.preventDefault();
        setVolumeLevel(volumeLevel + step);
        saveJson("fmRadio.volume", volumeLevel);
        hit.setAttribute("aria-valuenow", Math.round(volumeLevel * 100));
    });
}

function mountAmp() {
    const stage = document.getElementById("ampStage");
    stage.classList.toggle("amp-stage-tall", !!AMP_MODELS[ampModelId].tall);
    stage.innerHTML = AMP_MODELS[ampModelId].svg;
    applyPanelLighting(document.querySelector("#ampStage svg"));
    bindAmpVolume();
    updateVolKnob();
    ampBiasMode = 0;
    ampRectUntil = 0;
    bindAmpBiasMeter();
    bindAmpLoudness();
    renderAmpPicker();
}

// E-303: 그려져 있던 LOUDNESS 노브 소생 — 클릭 토글, 저음량 등청감 보상 (Chromium DSP)
function bindAmpLoudness() {
    if (ampModelId !== "e303") { ampLoudnessOn = false; return; }
    const svg = document.querySelector("#ampStage svg");
    if (!svg) return;
    const hit = document.createElementNS(SVG_NS, "circle");
    hit.setAttribute("cx", "900");
    hit.setAttribute("cy", "444");
    hit.setAttribute("r", "40");
    hit.setAttribute("fill", "#000");
    hit.setAttribute("fill-opacity", "0");
    hit.setAttribute("style", "cursor:pointer");
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", "라우드니스 보상 켜기/끄기");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = "LOUDNESS — 저음량에서 저·고역을 보상합니다";
    hit.appendChild(title);
    const led = document.createElementNS(SVG_NS, "circle");
    led.setAttribute("id", "ampLoudnessLed");
    led.setAttribute("cx", "935");
    led.setAttribute("cy", "412");
    led.setAttribute("r", "4.5");
    led.setAttribute("fill", "#232018");
    svg.appendChild(led);
    svg.appendChild(hit);
    const toggle = () => {
        ampLoudnessOn = !ampLoudnessOn;
        applyLoudnessComp();
        led.style.fill = ampLoudnessOn ? "#f0b43e" : "#232018";
        playerSubtext.textContent = ampLoudnessOn
            ? "LOUDNESS ON — 볼륨이 낮을수록 저·고역을 보상합니다."
            : "LOUDNESS OFF";
    };
    hit.addEventListener("click", toggle);
    hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
}

// 8B: 죽어 있던 BIAS 미터 소생 — 미터를 누를 때마다 VU → CH A 바이어스 → CH B 바이어스 순환.
// 바이어스는 켠 직후 낮았다가 관이 달아오르며 정격(중앙 0)으로 올라온다 (tubeWarm 연동).
function bindAmpBiasMeter() {
    if (ampModelId !== "el34") return;
    const svg = document.querySelector("#ampStage svg");
    const lbl = document.getElementById("ampBiasLbl");
    if (!svg || !lbl) return;
    const hit = document.createElementNS(SVG_NS, "circle");
    hit.setAttribute("cx", "250");
    hit.setAttribute("cy", "406");
    hit.setAttribute("r", "70");
    hit.setAttribute("fill", "#000");
    hit.setAttribute("fill-opacity", "0");
    hit.setAttribute("style", "cursor:pointer");
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", "바이어스 미터 — VU와 채널별 바이어스 표시 전환");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = "METERING — 누를 때마다 VU · CH A BIAS · CH B BIAS";
    hit.appendChild(title);
    svg.appendChild(hit);
    const cycle = () => {
        ampBiasMode = (ampBiasMode + 1) % 3;
        lbl.textContent = ampBiasMode === 1 ? "BIAS · CH A" : ampBiasMode === 2 ? "BIAS · CH B" : "BIAS";
        playerSubtext.textContent = ampBiasMode
            ? "바이어스 모니터 — CH " + (ampBiasMode === 1 ? "A" : "B") + " (워밍업과 함께 정격으로 올라옵니다)"
            : "미터: VU 표시";
    };
    hit.addEventListener("click", cycle);
    hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(); } });
}

function renderAmpPicker() {
    const el = document.getElementById("ampPicker");
    el.innerHTML = "";
    AMP_ORDER.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin-btn" + (unitShow.amp && id === ampModelId ? " active" : "");
        b.textContent = AMP_MODELS[id].pill;
        b.title = AMP_MODELS[id].desc;
        b.addEventListener("click", () => {
            if (!unitShow.amp) setUnitShow("amp", true);
            if (id !== ampModelId) {
                ampModelId = id;
                applyAmp();
                mountAmp();
                saveJson("fmRadio.amp", id);
                playerSubtext.textContent = "앰프: " + AMP_MODELS[id].pill + " — " + AMP_MODELS[id].desc;
            }
            renderAmpPicker();
        });
        el.appendChild(b);
    });
    el.appendChild(hidePill("amp"));
}

// ----- 턴테이블 (YAHAMA PL-12) — 아날로그 감성 재현 -----
const PHONO_BASE = "https://upload.wikimedia.org/wikipedia/commons/";
// 클래식 녹음은 방송 스트림보다 레벨이 낮아 포노 재생 시 체인 게인을 보정한다 (Web Audio 경로에서만)
const PHONO_GAIN = 2.0;
// ----- 레코드 라이브러리 -----
// bootstrap.js가 records.json을 검증·로딩한 다음 이 스크립트를 실행한다.
// 트랙은 CORS가 열린 upload.wikimedia.org에서 스트리밍해야 Web Audio
// 체인(EQ·앰프·크랙클)을 통과할 수 있다.
const RECORDS = window.MFA_RECORDS;
if (!Array.isArray(RECORDS) || RECORDS.length === 0) {
    throw new Error("음반 카탈로그를 불러오지 못했습니다");
}
let recordIdx = loadJson("fmRadio.record", 0);
if (typeof recordIdx !== "number" || !RECORDS[recordIdx]) recordIdx = 0;
let RECORD = RECORDS[recordIdx];

// 음반 교체 — 실제로 판을 갈아 끼우듯, 돌고 있던 판은 내려놓는다
// 재킷 배경 밝기에 따라 잉크(글자·테두리) 색을 정한다 — 어두운 재킷에서도 인쇄가 읽히도록.
function jacketInk(bg) {
    const h = String(bg || "#cccccc").replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum < 135
        ? { title: "#f0e8d0", sub: "#cdbfa6", perf: "#e6dcc4", line: "#7a6d50", frame: "#6a5d45", inner: "#6a5d45" }
        : { title: "#3a2b1e", sub: "#5d4430", perf: "#3a2b1e", line: "#8a7d5a", frame: "#b3a988", inner: "#8a7d5a" };
}

function setRecord(i) {
    recordIdx = ((i % RECORDS.length) + RECORDS.length) % RECORDS.length;
    RECORD = RECORDS[recordIdx];
    saveJson("fmRadio.record", recordIdx);
    if (phonoActive) stopPlay();
    mountTurntable();
    playerSubtext.textContent = "음반 교체: " + RECORD.title + " (" + RECORD.performer + ")";
    gtag('event', 'change_record', { record: RECORD.bwv });
}
let phonoActive = false;
let radioStandby = null;   // 턴테이블 재생 중 튜닝해 둔 대기 방송국 (음반이 끝나면 연결)
let phonoTrack = -1;
let ttSpin = 0;
// 모델 고유 속도 조작 — SL-1200 피치·TD124 4속·GARRARD 트림이 쓰는 공용 배율 (33⅓ 기준 1)
let ttSpeedTrim = 1;
let ttPitch = 0;          // SL-1200 피치 페이더 값 (-0.08 ~ +0.08)
let ttSpeed124 = 33;      // TD124 속도 노브 위치 (16 · 33 · 45 · 78)
let ttStrobeAng = 0;      // SL-1200 스트로브 드리프트 각
let ttBraking = false;    // GARRARD 브레이크 레버 — 누르는 동안 플래터 급정지
let ttAngle = 0;
let ttArmAng = -26;
let ttArmDrag = false;   // 톤암을 손으로 잡고 있는 동안 자동 추적을 멈춘다
let ttRpm45 = false;
let ttLastTs = 0;
let ttDust = 0;           // 판에 쌓인 먼지 0..1 — 시간이 흐르면 랜덤하게 쌓이고, 크랙클이 비례해 커진다
let ttCleanUntil = 0;     // 브러시 클리닝이 끝나는 시각(ms) — 클리닝 동안 먼지가 닦여 나간다
let ttScratchEnergy = 0;  // 바이닐 문지름 세기 — 드래그 속도로 차오르고 빠르게 감쇠한다
let ttRubLast = null;     // 문지름 드래그의 직전 포인터 좌표
let tubeWarm = 0;    // 진공관 웜업 상태 0..1 (켜면 서서히 달아오르고, 꺼지면 더 천천히 식는다)
let tunerWarm = 0;   // 튜너 조명 상태 0..1 — 라디오 수신 중에만 점등 (포노/테이프 중엔 튜너는 꺼진 것)
let ampWarm = 0;     // 앰프·EQ·턴테이블 조명 0..1 — 실제 청취 중일 때만 점등
let bgRecSignal = 0; // 백그라운드 수신기 레벨 (예약 녹음 중 데크 VU 구동)
let micSignal = 0;   // 마이크 입력 레벨 (REC INPUT=MIC일 때 데크 VU 구동 — 입력 모니터)
let tsPreviewUntil = 0;   // 다이얼 조작 중 디스플레이 웨이크 시각

// 톤암 각도 → 트랙 번호 (-5° 미만 = 거치대)
function trackAtAngle(ang) {
    if (ang < -5) return -1;
    const seg = 21 / RECORD.tracks.length;
    return Math.max(0, Math.min(RECORD.tracks.length - 1, Math.floor((ang + 2) / seg)));
}

// 톤암 드래그 — 실물처럼 암을 들어 원하는 트랙 위에 내려놓으면 그 곡부터 재생.
// 거치대 쪽(-5° 미만)에 내려놓으면 연주를 멈춘다.
// 공용 33/45 버튼과 TD124 4속 노브의 상태 동기화
function ttSyncCommonSpeed(rpm) {
    if (ttModelId !== "td124") return;
    ttSpeed124 = rpm;
    ttSpeedTrim = 1;
    ttSyncSpeedPtr();
}

function ttSyncSpeedPtr() {
    const ptr = document.getElementById("ttSpeedPtr");
    if (!ptr) return;
    const ang = { 16: 0, 33: 36, 45: 72, 78: 108 }[ttSpeed124] || 36;
    ptr.setAttribute("transform", "rotate(" + ang + " 140 292)");
}

// ----- 죽은 조작부 재생: 모델 고유 컨트롤 바인딩 (mountTurntable에서 호출) -----
function bindTtModelControls() {
    const svg = document.querySelector("#ttStage svg");
    if (!svg) return;
    const vbY = (clientY) => {
        const r = svg.getBoundingClientRect();
        return (clientY - r.top) / r.height * svg.viewBox.baseVal.height;
    };
    // SL-1200: 피치 페이더 ±8% + QUARTZ LOCK. WebKit은 드래그 종료 시 1회 대입(원샷 규칙).
    const pitchHit = document.getElementById("ttPitchHit");
    const pitchKnob = document.getElementById("ttPitchKnob");
    if (pitchHit && pitchKnob) {
        const paintPitch = () => {
            pitchKnob.setAttribute("y", (363.5 + ttPitch / 0.08 * 61.5).toFixed(1));
            const lamp = document.getElementById("ttQuartzLamp");
            if (lamp) lamp.style.fill = Math.abs(ttPitch) < 0.0005 ? "#e94e35" : "#7e352a";
            pitchHit.setAttribute("aria-valuenow", (ttPitch * 100).toFixed(1));
        };
        const setPitchFromY = (clientY) => {
            const y = vbY(clientY);
            ttPitch = Math.max(-0.08, Math.min(0.08, (y - 396) / 61.5 * 0.08));
            if (Math.abs(ttPitch) < 0.003) ttPitch = 0;   // 센터 디텐트
            ttSpeedTrim = 1 + ttPitch;
            paintPitch();
            playerSubtext.textContent = "피치 " + (ttPitch >= 0 ? "+" : "") + (ttPitch * 100).toFixed(1) + "%";
        };
        let drag = false;
        pitchHit.addEventListener("pointerdown", (e) => { drag = true; try { pitchHit.setPointerCapture(e.pointerId); } catch (err) {} setPitchFromY(e.clientY); e.preventDefault(); });
        pitchHit.addEventListener("pointermove", (e) => { if (drag) setPitchFromY(e.clientY); });
        pitchHit.addEventListener("pointerup", () => { drag = false; applyRpmRate(); });
        pitchHit.addEventListener("pointercancel", () => { drag = false; applyRpmRate(); });
        pitchHit.addEventListener("keydown", (e) => {
            const d = e.key === "ArrowUp" ? -0.005 : e.key === "ArrowDown" ? 0.005 : 0;
            if (!d) return;
            e.preventDefault();
            ttPitch = Math.max(-0.08, Math.min(0.08, ttPitch + d));
            ttSpeedTrim = 1 + ttPitch;
            paintPitch();
            applyRpmRate();
        });
        const quartz = document.getElementById("ttQuartzHit");
        if (quartz) {
            const lock = () => {
                ttPitch = 0;
                ttSpeedTrim = 1;
                paintPitch();
                applyRpmRate();
                playerSubtext.textContent = "QUARTZ LOCK — 피치 0.0%";
            };
            quartz.addEventListener("click", lock);
            quartz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lock(); } });
        }
        paintPitch();
    }
    // TD124: 4속 노브 — 누를 때마다 16⅔ → 33⅓ → 45 → 78 순환 (모두 원샷 대입이라 WebKit 안전)
    const speedHit = document.getElementById("ttSpeedHit");
    if (speedHit) {
        const SPEEDS = [16, 33, 45, 78];
        const TRIMS = { 16: 0.5, 33: 1, 45: 1.35, 78: 2.34 };
        const NAMES = { 16: "16\u2154 RPM — 낭독·장시간", 33: "33\u2153 RPM", 45: "45 RPM — 빠르고 날카롭게", 78: "78 RPM — SP반의 속도" };
        const cycle = () => {
            ttSpeed124 = SPEEDS[(SPEEDS.indexOf(ttSpeed124) + 1) % SPEEDS.length];
            ttRpm45 = false;                  // 속도는 노브가 단일 소스
            ttSpeedTrim = TRIMS[ttSpeed124];
            ttSyncSpeedPtr();
            applyRpmRate();
            updatePhonoVisuals();
            playerSubtext.textContent = "회전 속도: " + NAMES[ttSpeed124];
        };
        speedHit.addEventListener("click", cycle);
        speedHit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(); } });
        ttSyncSpeedPtr();
    }
    // GARRARD 301: 와전류 속도 트림 ±3% + 기계식 브레이크(누르는 동안 즉정지)
    const trimHit = document.getElementById("ttTrimHit");
    if (trimHit) {
        let drag = false, startY = 0, startTrim = 0;
        const paintTrim = () => {
            const ptr = document.getElementById("ttTrimPtr");
            if (ptr) ptr.setAttribute("transform", "rotate(" + ((ttSpeedTrim - 1) / 0.03 * 40).toFixed(1) + " 122 370)");
            trimHit.setAttribute("aria-valuenow", ((ttSpeedTrim - 1) * 100).toFixed(1));
        };
        trimHit.addEventListener("pointerdown", (e) => { drag = true; startY = e.clientY; startTrim = ttSpeedTrim - 1; try { trimHit.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); });
        trimHit.addEventListener("pointermove", (e) => {
            if (!drag) return;
            let t = startTrim - (e.clientY - startY) * 0.0004;
            t = Math.max(-0.03, Math.min(0.03, t));
            if (Math.abs(t) < 0.0015) t = 0;
            ttSpeedTrim = 1 + t;
            paintTrim();
            playerSubtext.textContent = "속도 트림 " + (t >= 0 ? "+" : "") + (t * 100).toFixed(1) + "%";
        });
        trimHit.addEventListener("pointerup", () => { drag = false; applyRpmRate(); });
        trimHit.addEventListener("pointercancel", () => { drag = false; applyRpmRate(); });
        paintTrim();
    }
    const brakeHit = document.getElementById("ttBrakeHit");
    if (brakeHit) {
        let resume = false;
        const lever = () => document.getElementById("ttBrakeLever");
        const down = () => {
            ttBraking = true;
            if (lever()) lever().setAttribute("transform", "rotate(16 198 348)");
            resume = phonoActive && isPlaying;
            if (resume) audio.pause();
            playerSubtext.textContent = "브레이크 — 플래터를 세웠습니다.";
        };
        const up = () => {
            if (!ttBraking) return;
            ttBraking = false;
            if (lever()) lever().setAttribute("transform", "");
            if (resume && phonoActive) {
                audio.play().then(() => { isPlaying = true; updatePlayButton(); }).catch(() => {});
                playerSubtext.textContent = "브레이크 해제 — 플래터가 다시 돕니다.";
            }
            resume = false;
        };
        brakeHit.addEventListener("pointerdown", (e) => { down(); try { brakeHit.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); });
        brakeHit.addEventListener("pointerup", up);
        brakeHit.addEventListener("pointercancel", up);
        brakeHit.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); down(); } });
        brakeHit.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") up(); });
    }
}

function bindArmDrag() {
    const hit = document.getElementById("ttArmHit");
    if (!hit) return;
    const angleAt = (e) => {
        const svg = document.querySelector("#ttStage svg");
        const r = svg.getBoundingClientRect();
        const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
        const x = vb[0] + (e.clientX - r.left) / r.width * vb[2];
        const y = vb[1] + (e.clientY - r.top) / r.height * vb[3];
        let deg = (Math.atan2(y - 120, x - 1065) - Math.atan2(428 - 120, 768 - 1065)) * 180 / Math.PI;
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        return Math.max(-30, Math.min(24, deg));
    };
    let dragging = false;
    hit.addEventListener("pointerdown", (e) => {
        dragging = true;
        ttArmDrag = true;
        try { hit.setPointerCapture(e.pointerId); } catch (err) {}
        if (phonoActive && isPlaying) audio.pause();   // 바늘을 들었다 — 소리도 멈춘다
        e.preventDefault();
    });
    hit.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        ttArmAng = angleAt(e);
        const i = trackAtAngle(ttArmAng);
        playerSubtext.textContent = i >= 0 ? "여기 놓으면 재생: " + RECORD.tracks[i].t : "톤암 거치대 — 놓으면 연주를 멈춥니다";
    });
    const drop = (e) => {
        if (!dragging) return;
        dragging = false;
        ttArmDrag = false;
        const i = trackAtAngle(angleAt(e));
        if (i >= 0) {
            playPhonoTrack(i);
        } else if (phonoActive) {
            stopPhono();
            isPlaying = false;
            updatePlayButton();
            playerSubtext.textContent = "톤암을 거치대에 올렸습니다.";
        }
    };
    hit.addEventListener("pointerup", drop);
    hit.addEventListener("pointercancel", () => { dragging = false; ttArmDrag = false; });
}

// ----- 재킷 크게 보기 -----
function openJacketView() {
    const art = document.getElementById("jacketBigArt");
    const cap = document.getElementById("jacketBigCap");
    const jc = jacketInk(RECORD.jacketBg);
    if (RECORD.cover) {
        art.style.background = "#101010 url('" + PHONO_BASE + RECORD.cover + "') center/cover no-repeat";
        art.innerHTML = "";
    } else {
        art.style.background = RECORD.jacketBg;
        art.innerHTML = '<div class="jbig-type"><div class="jbig-title" style="color:' + jc.title + '">' + RECORD.jTitle +
            '</div><div class="jbig-sub" style="color:' + jc.sub + '">' + RECORD.jSub1 + " · " + RECORD.jSub2 + "</div></div>";
    }
    cap.textContent = RECORD.title + " — " + RECORD.performer + " · SIDE " + (RECORD.side || "A");
    document.getElementById("jacketOverlay").hidden = false;
}

function closeJacketView() {
    document.getElementById("jacketOverlay").hidden = true;
}

document.getElementById("jacketOverlay").addEventListener("click", closeJacketView);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("jacketOverlay").hidden) closeJacketView();
});

// WebKit(사파리·맥 앱·iOS)은 OGG(Vorbis)를 재생하지 못한다 —
// 커먼즈가 자동 생성하는 mp3 트랜스코드로 대체한다 (같은 호스트, CORS 동일).
// 주의: WebKit은 canPlayType('audio/ogg')에 "probably"라 답해 놓고 실제로는
// readyState 0에서 오류도 없이 영원히 멈춘다 (실측: webprobe). 답변을 믿지 말고
// 엔진으로 판단한다 — 크롬/파이어폭스 계열만 Vorbis를 정말 재생한다.
const CAN_OGG = !SAFARI_LIKE;

function phonoSrc(f) {
    if (CAN_OGG || !/\.(ogg|oga)$/i.test(f)) return PHONO_BASE + f;
    const name = f.split("/").pop();
    return PHONO_BASE + "transcoded/" + f + "/" + name + ".mp3";
}

// 45회전 배속 — WebKit에서는 프레임 루프 대입이 금지라 전환 순간에만 1회 대입한다
function applyRpmRate() {
    if (!SAFARI_LIKE || !phonoActive) return;
    try { audio.playbackRate = (ttRpm45 ? 1.35 : 1) * ttSpeedTrim; } catch (e) {}
}

// 턴테이블 전원 — 일시정지와 달리 완전히 내려놓는다:
// 톤암 복귀·플래터 런다운·소스 해제. 대기 중이던 방송국이 있으면 이어서 연결한다.
function phonoPower() {
    if (phonoActive) {
        audio.pause();
        stopPhono();
        isPlaying = false;
        streamLoaded = false;
        updatePlayButton();
        if (radioStandby) {
            const next = radioStandby;
            radioStandby = null;
            playerSubtext.textContent = "턴테이블 전원 OFF — 대기 중이던 " + next.name + "에 연결합니다.";
            selectStation(next.id);
        } else {
            setAudioState("idle");
            playerSubtext.textContent = "턴테이블 전원을 껐습니다.";
        }
    } else {
        playPhonoTrack(0);
    }
}

// 레코드/재킷 기능은 공통으로 유지하되, 본체 하드웨어는 모델마다 별도 조형한다.
// 회전과 톤암 드래그 계산이 의존하는 중심(560,330), 피벗(1065,120), 바늘(768,428)은 고정한다.
function ttVisualSpec(id, skin) {
    const strobe = [0, 1, 2].map((row) => Array.from({ length: 54 }, (_, i) => {
        const a = i / 54 * Math.PI * 2;
        const r = 264 + row * 5.5;
        const x = (560 + Math.cos(a) * r).toFixed(1);
        const y = (330 + Math.sin(a) * r).toFixed(1);
        return '<circle cx="' + x + '" cy="' + y + '" r="' + (row === 1 ? 2.4 : 1.7) + '" fill="#e4e5e2" opacity="' + (row === 1 ? '.9' : '.65') + '"/>';
    }).join("")).join("");
    const modelScrew = (x, y, light) => '<g transform="translate(' + x + ' ' + y + ')" pointer-events="none"><circle r="9" fill="' + (light ? 'url(#ttChrome)' : '#202126') + '" stroke="' + (light ? '#4e5054' : '#666970') + '" stroke-width="1.5"/><path d="M-4 -1 L4 1" stroke="' + (light ? '#323438' : '#c8c9cc') + '" stroke-width="1.5"/></g>';
    const hit = '<circle id="ttArmHit" cx="768" cy="428" r="58" fill="#000" fill-opacity="0" style="cursor:grab"><title>톤암 — 잡아서 원하는 트랙 위에 내려놓으세요</title></circle>';
    const specs = {
        pl12: {
            body: '<rect x="34" y="-10" width="1126" height="654" rx="14" fill="url(#ttWalnut)" stroke="#21150e" stroke-width="5"/><rect x="58" y="16" width="1078" height="602" rx="8" fill="url(#ttBlackPlate)" stroke="#706252" stroke-width="2"/><path d="M48 4 H1144 M48 630 H1144" stroke="#bd8657" stroke-width="3" opacity=".35"/><rect x="48" y="-2" width="1096" height="638" rx="11" fill="url(#ttWoodLines)" opacity=".55" pointer-events="none"/>',
            brand: '<text x="72" y="72" font-family="Arial" font-size="28" font-weight="800" letter-spacing="2.5" fill="#e5ddd0">YAHAMA</text><text x="72" y="101" font-family="Arial" font-size="15" font-weight="700" letter-spacing="3" fill="#a99d8d">PL-12 · BELT DRIVE</text>',
            platterBase: '<ellipse cx="570" cy="348" rx="289" ry="282" fill="#000" opacity=".58" filter="url(#ttShadow)"/><circle cx="560" cy="330" r="281" fill="#111216" stroke="#707179" stroke-width="3"/><circle cx="560" cy="330" r="273" fill="url(#ttRubber)"/><circle cx="560" cy="330" r="266" fill="#17181c" stroke="#050607" stroke-width="2"/>',
            spinTrim: '<circle cx="560" cy="330" r="263" fill="none" stroke="#a8a9ad" stroke-width="3" stroke-dasharray="2 10" opacity=".6"/>',
            armBase: '<ellipse cx="1070" cy="130" rx="58" ry="54" fill="#000" opacity=".55" filter="url(#ttShadow)"/><circle cx="1065" cy="120" r="49" fill="#17181c" stroke="#777982" stroke-width="2"/><circle cx="1065" cy="120" r="35" fill="url(#ttMetal)"/><circle cx="1065" cy="120" r="17" fill="#22242a" stroke="#c4c5c8"/><rect x="916" y="478" width="29" height="47" rx="6" fill="#18191d" stroke="#5b5e64"/><rect x="911" y="477" width="39" height="11" rx="4" fill="url(#ttChrome)"/>',
            arm: '<g id="ttArmG"><circle cx="1134" cy="77" r="27" fill="url(#ttDarkMetal)" stroke="#8b8d94" stroke-width="2"/><rect x="1124" y="61" width="46" height="31" rx="13" fill="url(#ttDarkMetal)"/><line x1="1122" y1="89" x2="1065" y2="120" stroke="#45474d" stroke-width="13" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#33353a" stroke-width="12" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="url(#ttArmSilver)" stroke-width="7" stroke-linecap="round"/><g transform="rotate(-46 762 434)"><rect x="732" y="418" width="62" height="28" rx="5" fill="#17191e" stroke="#7b7e84"/><rect x="740" y="444" width="16" height="9" rx="2" fill="#b33128"/></g>' + hit + '</g>',
            detail: '<g pointer-events="none"><text x="72" y="294" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#988d7e">SPEED SELECTOR</text><circle cx="118" cy="342" r="37" fill="#090a0c" stroke="#777982" stroke-width="2"/><circle cx="118" cy="342" r="27" fill="url(#ttDarkMetal)"/><path d="M118 342 L104 320" stroke="#e8e5dc" stroke-width="4" stroke-linecap="round"/><text x="75" y="398" font-family="Arial" font-size="12" fill="#b6aa99">33</text><text x="143" y="398" font-family="Arial" font-size="12" fill="#b6aa99">45</text><rect x="60" y="430" width="174" height="46" rx="6" fill="#0c0d10" stroke="#454851"/><text x="147" y="459" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1.8" fill="#c4baab" text-anchor="middle">BELT / MANUAL</text></g>' + modelScrew(76, 568, false) + modelScrew(1114, 568, false)
        },
        sl1200: {
            body: '<path d="M48 18 Q48 0 68 0 H1118 Q1144 0 1144 28 V596 Q1144 622 1118 622 H68 Q44 622 44 596 Z" fill="url(#ttCastSilver)" stroke="#5a5d61" stroke-width="4"/><path d="M68 28 H1118 V590 H68 Z" fill="none" stroke="#fff" stroke-width="2" opacity=".45"/><path d="M84 44 H1098" stroke="#fff" stroke-width="4" opacity=".28"/><rect x="48" y="2" width="1094" height="618" rx="18" fill="url(#ttMetalGrain)" opacity=".46" pointer-events="none"/>',
            brand: '<text x="70" y="68" font-family="Arial" font-size="28" font-style="italic" font-weight="800" letter-spacing="-1" fill="#25272a">Technics</text><text x="72" y="98" font-family="Arial" font-size="13" font-weight="700" letter-spacing="2.3" fill="#45484c">SL-1200MK2 · QUARTZ DIRECT DRIVE</text>',
            platterBase: '<ellipse cx="570" cy="348" rx="294" ry="286" fill="#000" opacity=".42" filter="url(#ttShadow)"/><circle cx="560" cy="330" r="288" fill="url(#ttChrome)" stroke="#33353a" stroke-width="3"/><circle cx="560" cy="330" r="278" fill="#1c1e21"/><circle cx="560" cy="330" r="273" fill="url(#ttRubber)"/>',
            spinTrim: '<g id="ttStrobeRing">' + strobe + '</g><circle cx="560" cy="330" r="257" fill="none" stroke="#090a0c" stroke-width="6"/>',
            armBase: '<ellipse cx="1070" cy="132" rx="64" ry="60" fill="#000" opacity=".4" filter="url(#ttShadow)"/><circle cx="1065" cy="120" r="55" fill="url(#ttChrome)" stroke="#42454a" stroke-width="3"/><circle cx="1065" cy="120" r="40" fill="#303338" stroke="#f2f2ee" stroke-width="2"/><path d="M1027 120 H1103 M1065 82 V158" stroke="#9ea1a5" stroke-width="4"/><circle cx="1065" cy="120" r="19" fill="url(#ttDarkMetal)"/><rect x="916" y="476" width="30" height="51" rx="7" fill="#292c30" stroke="#6f7277"/><rect x="908" y="474" width="46" height="13" rx="5" fill="url(#ttChrome)"/>',
            arm: '<g id="ttArmG"><rect x="1118" y="59" width="72" height="36" rx="16" fill="url(#ttDarkMetal)" stroke="#777a80" stroke-width="2"/><circle cx="1127" cy="77" r="18" fill="#15171a"/><path d="M1125 88 L1070 115" stroke="#4b4e53" stroke-width="13" stroke-linecap="round"/><path d="M1065 120 C1018 145 1020 204 966 240 S850 337 768 428" fill="none" stroke="#3d4045" stroke-width="13" stroke-linecap="round"/><path d="M1065 120 C1018 145 1020 204 966 240 S850 337 768 428" fill="none" stroke="url(#ttArmSilver)" stroke-width="7" stroke-linecap="round"/><g transform="rotate(-46 762 434)"><rect x="730" y="416" width="66" height="30" rx="4" fill="#292b30" stroke="#e1e2e0"/><rect x="740" y="444" width="17" height="9" rx="2" fill="#d4402f"/></g>' + hit + '</g>',
            detail: '<g pointer-events="none"><circle cx="190" cy="330" r="45" fill="#24262a" stroke="#63666b" stroke-width="3"/><circle cx="190" cy="330" r="32" fill="#111214"/><path d="M190 330 L190 303" stroke="#f1f1ed" stroke-width="5" stroke-linecap="round"/><text x="190" y="394" font-family="Arial" font-size="12" font-weight="700" fill="#35383c" text-anchor="middle">START · STOP</text><rect x="936" y="272" width="62" height="252" rx="9" fill="#27292d" stroke="#74777b" stroke-width="2"/><rect x="946" y="300" width="42" height="192" rx="7" fill="#151619"/><rect id="ttPitchKnob" x="950" y="332" width="34" height="65" rx="6" fill="url(#ttChrome)" stroke="#34363a"/><text x="967" y="545" font-family="Arial" font-size="11" font-weight="700" letter-spacing="1.4" fill="#383b3f" text-anchor="middle">PITCH ADJ.</text><circle cx="1028" cy="544" r="18" fill="#17191c" stroke="#6f7277"/><circle id="ttQuartzLamp" cx="1028" cy="544" r="7" fill="#e94e35"/><path d="M1018 516 Q1028 500 1038 516" fill="none" stroke="#313439" stroke-width="5"/></g>' +
                '<rect id="ttPitchHit" x="930" y="266" width="74" height="264" fill="#000" fill-opacity="0" style="cursor:ns-resize;touch-action:none" tabindex="0" role="slider" aria-label="피치 조정 ±8%"><title>PITCH ADJ. — 위아래로 끌어 ±8%</title></rect>' +
                '<circle id="ttQuartzHit" cx="1028" cy="544" r="24" fill="#000" fill-opacity="0" style="cursor:pointer" tabindex="0" role="button" aria-label="쿼츠 록 — 피치 0으로 복귀"><title>QUARTZ LOCK — 피치를 0으로 되돌립니다</title></circle>' + modelScrew(86, 566, true) + modelScrew(1100, 566, true)
        },
        td124: {
            body: '<rect x="30" y="-12" width="1136" height="658" rx="12" fill="url(#ttWalnutDark)" stroke="#27160d" stroke-width="5"/><path d="M58 20 H1110 Q1138 20 1138 48 V574 Q1138 614 1098 614 H58 Z" fill="url(#ttIvoryCast)" stroke="#6b665b" stroke-width="3"/><path d="M76 40 H1096 M76 594 H1082" stroke="#fffdf4" stroke-width="3" opacity=".65"/>',
            brand: '<rect x="66" y="43" width="234" height="59" rx="4" fill="#e7e1d3" stroke="#5e594f"/><text x="183" y="72" font-family="Arial" font-size="24" font-weight="800" letter-spacing="3" fill="#3f3b34" text-anchor="middle">THORENS</text><text x="183" y="92" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2.2" fill="#625c52" text-anchor="middle">TD 124 · SWISS MADE</text>',
            platterBase: '<ellipse cx="570" cy="350" rx="297" ry="289" fill="#000" opacity=".48" filter="url(#ttShadow)"/><circle cx="560" cy="330" r="291" fill="url(#ttChrome)" stroke="#4b4d50" stroke-width="3"/><circle cx="560" cy="330" r="282" fill="#7d7b74"/><circle cx="560" cy="330" r="275" fill="#242529"/><circle cx="560" cy="330" r="268" fill="url(#ttRubber)"/>',
            spinTrim: '<circle cx="560" cy="330" r="267" fill="none" stroke="#c9c5ba" stroke-width="5" stroke-dasharray="1 7"/><circle cx="560" cy="330" r="259" fill="none" stroke="#4c4b47" stroke-width="3"/>',
            armBase: '<ellipse cx="1070" cy="132" rx="58" ry="58" fill="#000" opacity=".42" filter="url(#ttShadow)"/><circle cx="1065" cy="120" r="52" fill="#d7d1c3" stroke="#58544c" stroke-width="3"/><circle cx="1065" cy="120" r="34" fill="url(#ttChrome)"/><circle cx="1065" cy="120" r="14" fill="#2b2c30"/><rect x="916" y="480" width="28" height="46" rx="4" fill="#393a3d" stroke="#77756f"/><path d="M910 481 H950" stroke="#d8d2c5" stroke-width="12" stroke-linecap="round"/>',
            arm: '<g id="ttArmG"><circle cx="1134" cy="77" r="27" fill="#25262a" stroke="#aba79d" stroke-width="3"/><rect x="1126" y="62" width="54" height="30" rx="13" fill="url(#ttDarkMetal)"/><line x1="1122" y1="89" x2="1065" y2="120" stroke="#4d4f52" stroke-width="12" stroke-linecap="round"/><path d="M1065 120 C1000 166 938 252 880 324 S808 400 768 428" fill="none" stroke="#494b50" stroke-width="12" stroke-linecap="round"/><path d="M1065 120 C1000 166 938 252 880 324 S808 400 768 428" fill="none" stroke="url(#ttArmSilver)" stroke-width="6.5" stroke-linecap="round"/><g transform="rotate(-46 762 434)"><path d="M731 418 H793 L788 447 H736 Z" fill="#3a3b3e" stroke="#d5d0c4"/><rect x="741" y="444" width="16" height="9" rx="2" fill="#7f2d24"/></g>' + hit + '</g>',
            detail: '<g pointer-events="none"><path d="M67 292 A73 73 0 0 1 213 292" fill="none" stroke="#5d584e" stroke-width="4"/><path d="M91 287 L75 266 M113 268 L105 240 M140 260 V228 M167 268 L177 240 M190 287 L207 266" stroke="#5d584e" stroke-width="3"/><circle cx="140" cy="292" r="43" fill="#e2dccf" stroke="#58544c" stroke-width="3"/><circle cx="140" cy="292" r="28" fill="url(#ttDarkMetal)"/><path id="ttSpeedPtr" d="M140 292 L118 276" stroke="#eee9de" stroke-width="5" stroke-linecap="round"/><text x="140" y="354" font-family="Arial" font-size="12" font-weight="700" fill="#4f4a42" text-anchor="middle">16 · 33 · 45 · 78</text><rect x="66" y="392" width="205" height="78" rx="8" fill="#c8c1b3" stroke="#5b564d" stroke-width="2"/><circle cx="108" cy="431" r="22" fill="#3a3938"/><path d="M108 431 L123 418" stroke="#f2ede3" stroke-width="4"/><text x="178" y="424" font-family="Arial" font-size="10" font-weight="700" letter-spacing="1.3" fill="#4e4941" text-anchor="middle">FINE SPEED</text><text x="178" y="445" font-family="Arial" font-size="9" fill="#665f55" text-anchor="middle">IDLER ENGAGED</text></g>' +
                '<circle id="ttSpeedHit" cx="140" cy="292" r="52" fill="#000" fill-opacity="0" style="cursor:pointer" tabindex="0" role="button" aria-label="회전 속도 전환 16·33·45·78"><title>SPEED — 누를 때마다 16&#8532; · 33&#8531; · 45 · 78</title></circle>' + modelScrew(76, 560, true) + modelScrew(1092, 560, true)
        },
        g301: {
            body: '<rect x="28" y="-14" width="1140" height="660" rx="9" fill="url(#ttWalnutDark)" stroke="#24140c" stroke-width="6"/><path d="M58 20 H812 Q854 20 884 50 L920 86 H1128 V594 H58 Z" fill="url(#ttHammerCream)" stroke="#5d584e" stroke-width="3"/><path d="M78 42 H804 Q842 42 870 70" fill="none" stroke="#fffdf3" stroke-width="3" opacity=".55"/>',
            brand: '<path d="M65 40 H288 Q305 40 305 57 V102 H65 Z" fill="#c7c0ae" stroke="#5c574d" stroke-width="2"/><text x="185" y="77" font-family="Georgia, serif" font-size="31" font-style="italic" font-weight="700" fill="#3c3933" text-anchor="middle">Garrard</text><text x="185" y="96" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2" fill="#5b564d" text-anchor="middle">MODEL 301 · TRANSCRIPTION</text>',
            platterBase: '<ellipse cx="570" cy="350" rx="298" ry="291" fill="#000" opacity=".5" filter="url(#ttShadow)"/><circle cx="560" cy="330" r="292" fill="#8d8b84" stroke="#37383a" stroke-width="4"/><circle cx="560" cy="330" r="284" fill="url(#ttChrome)"/><circle cx="560" cy="330" r="274" fill="#1c1d20"/><circle cx="560" cy="330" r="268" fill="url(#ttRubber)"/>',
            spinTrim: '<circle cx="560" cy="330" r="267" fill="none" stroke="#dedbd2" stroke-width="4" stroke-dasharray="3 5"/><circle cx="560" cy="330" r="260" fill="none" stroke="#4a4a47" stroke-width="4"/>',
            armBase: '<ellipse cx="1070" cy="134" rx="61" ry="62" fill="#000" opacity=".48" filter="url(#ttShadow)"/><rect x="1018" y="69" width="94" height="104" rx="36" fill="#28292d" stroke="#77756e" stroke-width="3"/><circle cx="1065" cy="120" r="38" fill="#17181b" stroke="#b7b2a7" stroke-width="2"/><circle cx="1065" cy="120" r="17" fill="url(#ttGoldMetal)"/><rect x="916" y="479" width="28" height="49" rx="4" fill="#28292c" stroke="#807b70"/><path d="M910 481 H950" stroke="#b5aa92" stroke-width="11" stroke-linecap="round"/>',
            arm: '<g id="ttArmG"><rect x="1118" y="59" width="76" height="38" rx="15" fill="#1d1e21" stroke="#9b9485" stroke-width="2"/><circle cx="1127" cy="78" r="18" fill="url(#ttGoldMetal)"/><line x1="1122" y1="90" x2="1065" y2="120" stroke="#2b2d31" stroke-width="14" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#1e2024" stroke-width="13" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#8b806d" stroke-width="7" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#d7ceb9" stroke-width="2" stroke-linecap="round" opacity=".7"/><g transform="rotate(-46 762 434)"><rect x="728" y="416" width="69" height="31" rx="3" fill="#242529" stroke="#b3aa98"/><rect x="740" y="444" width="18" height="10" rx="2" fill="#8e2e21"/></g>' + hit + '</g>',
            detail: '<g pointer-events="none"><rect x="62" y="278" width="214" height="218" rx="16" fill="#bcb5a4" stroke="#555047" stroke-width="3"/><rect x="78" y="295" width="182" height="184" rx="11" fill="url(#ttHammerCream)" stroke="#eae5da"/><text x="169" y="320" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#4a463f" text-anchor="middle">SPEED CONTROL</text><circle cx="122" cy="370" r="33" fill="#2b2d30" stroke="#77756e" stroke-width="2"/><path id="ttTrimPtr" d="M122 370 L106 345" stroke="#e6e0d5" stroke-width="5" stroke-linecap="round"/><text x="122" y="421" font-family="Arial" font-size="10" fill="#514d45" text-anchor="middle">33 · 45 · 78</text><path id="ttBrakeLever" d="M198 348 L226 410" stroke="#303236" stroke-width="15" stroke-linecap="round"/><circle cx="198" cy="348" r="15" fill="#25272a" stroke="#8c887f"/><text x="211" y="438" font-family="Arial" font-size="10" font-weight="700" fill="#514d45" text-anchor="middle">BRAKE</text></g>' +
                '<circle id="ttTrimHit" cx="122" cy="370" r="42" fill="#000" fill-opacity="0" style="cursor:ns-resize;touch-action:none" tabindex="0" role="slider" aria-label="와전류 속도 미세 조정 ±3%"><title>SPEED CONTROL — 위아래로 끌어 ±3%</title></circle>' +
                '<rect id="ttBrakeHit" x="176" y="330" width="72" height="102" fill="#000" fill-opacity="0" style="cursor:pointer;touch-action:none" tabindex="0" role="button" aria-label="브레이크 — 누르는 동안 플래터 정지"><title>BRAKE — 누르는 동안 플래터를 즉시 세웁니다</title></rect>' + modelScrew(84, 562, true) + modelScrew(1094, 562, true)
        },
        lp12: {
            body: '<rect x="30" y="-14" width="1138" height="662" rx="8" fill="url(#ttRosewood)" stroke="#21120b" stroke-width="6"/><rect x="58" y="18" width="1080" height="598" rx="3" fill="#121316" stroke="#666970" stroke-width="2"/><path d="M44 4 H1152 M44 630 H1152" stroke="#df9561" stroke-width="3" opacity=".38"/><rect x="42" y="-2" width="1112" height="638" rx="6" fill="url(#ttWoodLines)" opacity=".5" pointer-events="none"/>',
            brand: '<text x="72" y="75" font-family="Arial" font-size="31" font-weight="300" letter-spacing="7" fill="#efede6">LINN</text><text x="74" y="103" font-family="Arial" font-size="12" font-weight="700" letter-spacing="3.2" fill="#9b9c9c">SONDEK LP12 · SUSPENDED SUBCHASSIS</text>',
            platterBase: '<ellipse cx="570" cy="348" rx="286" ry="280" fill="#000" opacity=".62" filter="url(#ttShadow)"/><circle cx="560" cy="330" r="279" fill="#08090b" stroke="#5c5e62" stroke-width="2"/><circle cx="560" cy="330" r="273" fill="#202125"/><circle cx="560" cy="330" r="266" fill="url(#ttRubber)"/>',
            spinTrim: '<circle cx="560" cy="330" r="263" fill="none" stroke="#55575c" stroke-width="2"/><circle cx="560" cy="330" r="258" fill="none" stroke="#0a0b0d" stroke-width="5"/>',
            armBase: '<ellipse cx="1070" cy="130" rx="52" ry="51" fill="#000" opacity=".6" filter="url(#ttShadow)"/><circle cx="1065" cy="120" r="45" fill="#111216" stroke="#666970" stroke-width="2"/><circle cx="1065" cy="120" r="28" fill="#25272c"/><circle cx="1065" cy="120" r="11" fill="url(#ttChrome)"/><rect x="919" y="480" width="24" height="46" rx="4" fill="#111216" stroke="#55585d"/><path d="M913 482 H949" stroke="#383a3f" stroke-width="10" stroke-linecap="round"/>',
            arm: '<g id="ttArmG"><rect x="1121" y="61" width="66" height="32" rx="14" fill="#101115" stroke="#5d6066" stroke-width="2"/><circle cx="1128" cy="77" r="15" fill="#25272c"/><line x1="1122" y1="89" x2="1065" y2="120" stroke="#18191d" stroke-width="12" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#08090b" stroke-width="11" stroke-linecap="round"/><line x1="1065" y1="120" x2="768" y2="428" stroke="#a8aaad" stroke-width="4.5" stroke-linecap="round"/><g transform="rotate(-46 762 434)"><path d="M733 419 H794 L787 446 H738 Z" fill="#0c0d0f" stroke="#74777d"/><rect x="742" y="444" width="15" height="8" rx="2" fill="#c53a2b"/></g>' + hit + '</g>',
            detail: '<g pointer-events="none"><circle cx="196" cy="550" r="24" fill="url(#ttChrome)" stroke="#282a2e" stroke-width="2"/><circle cx="196" cy="550" r="8" fill="#111216"/><text x="240" y="556" font-family="Arial" font-size="12" font-weight="700" letter-spacing="2.4" fill="#c8c5bc">33 / 45</text><path d="M71 282 H239" stroke="#47494e" stroke-width="1"/><text x="72" y="310" font-family="Arial" font-size="11" letter-spacing="2" fill="#787a7e">SINGLE POINT BEARING</text><text x="72" y="334" font-family="Arial" font-size="10" letter-spacing="1.6" fill="#65676b">LOW NOISE · HIGH TORQUE</text></g>' + modelScrew(78, 572, false) + modelScrew(1104, 572, false)
        }
    };
    return specs[id] || specs.pl12;
}

function mountTurntable() {
    // 모델 교체 시 고유 조작 상태 초기화 — 물건이 바뀌면 손잡이도 제자리
    ttSpeedTrim = 1;
    ttPitch = 0;
    ttSpeed124 = 33;
    ttBraking = false;
    applyRpmRate();
    const ttSkin = TT_MODELS[ttModelId];
    const ttVisual = ttVisualSpec(ttModelId, ttSkin);
    let grooves = "";
    for (let r = 108; r <= 246; r += 7) {
        grooves += '<circle cx="560" cy="330" r="' + r + '" fill="none" stroke="#000" stroke-width="0.8" opacity="0.5"/>';
    }
    for (let i = 0; i < 6; i++) {
        grooves += '<circle cx="560" cy="330" r="' + (116 + i * 22) + '" fill="none" stroke="#2e2e33" stroke-width="4" opacity="0.5"/>';
    }
    // 먼지 알갱이 — 홈 위에 흩뿌려 두고 ttFrame이 먼지량(ttDust)에 따라 불투명도를 올린다
    let dustSpecks = '<g id="ttDustG" opacity="0" pointer-events="none">';
    for (let i = 0; i < 48; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 100 + Math.random() * 148;
        const sx = (560 + Math.cos(a) * r).toFixed(1), sy = (330 + Math.sin(a) * r).toFixed(1);
        dustSpecks += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (0.7 + Math.random() * 1.6).toFixed(1) + '" fill="#c9c2b4" opacity="' + (0.35 + Math.random() * 0.5).toFixed(2) + '"/>';
    }
    dustSpecks += '</g>';
    // 트랙 수에 따라 행 간격을 조인다 (최대 13트랙 — 슈만 어린이 정경까지 수용)
    const nTracks = RECORD.tracks.length;
    const jc = jacketInk(RECORD.jacketBg);
    // 라벨 인쇄 — 실물 LP처럼 스핀들 홀 아래에 곡 리스트를 인쇄한다.
    // 8곡까지는 한 컬럼, 그 이상은 두 컬럼. 원 밖으로 나가는 긴 제목은 ttLabelClip이 자른다.
    const labelTracks = (() => {
        if (nTracks <= 8) {
            const f = nTracks <= 4 ? 8.5 : nTracks <= 6 ? 7.5 : 6.8;
            const step = nTracks <= 4 ? 13.5 : nTracks <= 6 ? 11 : 9.2;
            return RECORD.tracks.map((tr, i) =>
                '<text x="560" y="' + (344 + i * step) + '" font-family="Arial" font-size="' + f + '" fill="#3a2b1e" text-anchor="middle">' + (i + 1) + '. ' + tr.t + '</text>'
            ).join("");
        }
        const rowsN = Math.ceil(nTracks / 2);
        const step = rowsN > 6 ? 8.6 : 9.5;
        return RECORD.tracks.map((tr, i) => {
            const x = i < rowsN ? 516 : 604;
            const row = i < rowsN ? i : i - rowsN;
            return '<text x="' + x + '" y="' + (342 + row * step) + '" font-family="Arial" font-size="5.8" fill="#3a2b1e" text-anchor="middle">' + (i + 1) + '. ' + tr.t + '</text>';
        }).join("");
    })();
    // 트랙 리스트는 큰 재킷 오른쪽의 좁은 컬럼(x1690, 폭 286)으로 — 긴 제목은 ttListClip이 자른다
    const rowStep = nTracks > 12 ? 38 : nTracks > 8 ? 42 : nTracks > 6 ? 46 : 54;
    const rowFont = nTracks > 12 ? 13 : nTracks > 8 ? 14 : nTracks > 6 ? 15 : 16;
    const rows = RECORD.tracks.map((tr, i) => {
        const y = 128 + i * rowStep;
        return '<rect id="ttTrackBg' + i + '" x="1690" y="' + (y - 26) + '" width="286" height="' + (rowStep - 6) + '" rx="6" fill="#d36a42" opacity="0"/>' +
            '<text x="1700" y="' + y + '" font-family="Arial" font-size="' + (rowFont + 1) + '" font-weight="700" fill="' + (ttSkin.muted || "#8a7d70") + '">' + (i + 1) + '</text>' +
            '<text x="1728" y="' + y + '" font-family="Georgia, serif" font-size="' + rowFont + '" fill="' + (ttSkin.ink || "#d9cfc0") + '">' + tr.t + '</text>' +
            '<rect id="ttTrackHit' + i + '" x="1690" y="' + (y - 26) + '" width="286" height="' + (rowStep - 4) + '" fill="#000" fill-opacity="0" style="cursor:pointer"><title>' + tr.t + ' 재생</title></rect>';
    }).join("");
    document.getElementById("ttStage").innerHTML =
        // viewBox를 위아래로 40씩 넓혀(640→720) 콘텐츠 좌표는 그대로 두고 여백만 확보한다
        '<svg class="tt-svg" viewBox="0 -40 2000 720" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="' + ttSkin.label + ' 턴테이블">' +
        '<defs>' +
        '<linearGradient id="ttWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d4430"/><stop offset="0.5" stop-color="#4a3524"/><stop offset="1" stop-color="#33241a"/></linearGradient>' +
        '<linearGradient id="ttWalnut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5b38"/><stop offset=".18" stop-color="#5b3822"/><stop offset=".55" stop-color="#75482b"/><stop offset="1" stop-color="#2b190f"/></linearGradient>' +
        '<linearGradient id="ttWalnutDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#724326"/><stop offset=".32" stop-color="#3e2416"/><stop offset=".67" stop-color="#5a321c"/><stop offset="1" stop-color="#211109"/></linearGradient>' +
        '<linearGradient id="ttRosewood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d482e"/><stop offset=".22" stop-color="#3e2018"/><stop offset=".48" stop-color="#773a28"/><stop offset=".76" stop-color="#291513"/><stop offset="1" stop-color="#6b321f"/></linearGradient>' +
        '<linearGradient id="ttBlackPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2e34"/><stop offset=".2" stop-color="#17181d"/><stop offset=".78" stop-color="#111216"/><stop offset="1" stop-color="#050608"/></linearGradient>' +
        '<linearGradient id="ttCastSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f2ef"/><stop offset=".12" stop-color="#c8cac9"/><stop offset=".55" stop-color="#a5a8aa"/><stop offset="1" stop-color="#686b6f"/></linearGradient>' +
        '<linearGradient id="ttIvoryCast" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3eee2"/><stop offset=".2" stop-color="#d8d1c3"/><stop offset=".75" stop-color="#bbb4a7"/><stop offset="1" stop-color="#817b70"/></linearGradient>' +
        '<linearGradient id="ttHammerCream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4decf"/><stop offset=".18" stop-color="#c9c2b2"/><stop offset=".7" stop-color="#aaa493"/><stop offset="1" stop-color="#777166"/></linearGradient>' +
        '<radialGradient id="ttVinyl" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1c1c1f"/><stop offset="0.35" stop-color="#141416"/><stop offset="0.85" stop-color="#0d0d0f"/><stop offset="1" stop-color="#131316"/></radialGradient>' +
        '<radialGradient id="ttRubber" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#303237"/><stop offset=".62" stop-color="#17181b"/><stop offset="1" stop-color="#07080a"/></radialGradient>' +
        '<linearGradient id="ttSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="ttMetal" cx="0.4" cy="0.35" r="0.9"><stop offset="0" stop-color="#d8d8dc"/><stop offset="0.6" stop-color="#9a9aa2"/><stop offset="1" stop-color="#5c5c64"/></radialGradient>' +
        '<linearGradient id="ttChrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f5257"/><stop offset=".16" stop-color="#f4f4f0"/><stop offset=".36" stop-color="#8d9094"/><stop offset=".58" stop-color="#e9e9e5"/><stop offset=".82" stop-color="#62656a"/><stop offset="1" stop-color="#25272b"/></linearGradient>' +
        '<linearGradient id="ttDarkMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#74777e"/><stop offset=".25" stop-color="#303238"/><stop offset=".68" stop-color="#121318"/><stop offset="1" stop-color="#4e5157"/></linearGradient>' +
        '<linearGradient id="ttGoldMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#54452b"/><stop offset=".22" stop-color="#ead8a5"/><stop offset=".48" stop-color="#90784a"/><stop offset=".72" stop-color="#d7c28c"/><stop offset="1" stop-color="#453820"/></linearGradient>' +
        '<linearGradient id="ttArmSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4d5055"/><stop offset=".24" stop-color="#f5f5f1"/><stop offset=".5" stop-color="#92959a"/><stop offset=".72" stop-color="#dededb"/><stop offset="1" stop-color="#55585e"/></linearGradient>' +
        '<pattern id="ttWoodLines" width="180" height="22" patternUnits="userSpaceOnUse"><path d="M0 4 C34 0 68 10 112 4 S158 1 180 7 M0 16 C42 10 76 22 130 15 S164 13 180 18" fill="none" stroke="#f2b879" stroke-width="1.2" opacity=".22"/><path d="M0 9 C38 14 72 3 122 10 S164 14 180 10" fill="none" stroke="#170b07" stroke-width="1" opacity=".35"/></pattern>' +
        '<pattern id="ttMetalGrain" width="16" height="7" patternUnits="userSpaceOnUse"><path d="M0 1 H16 M0 3.5 H16 M0 6 H16" stroke="#fff" stroke-width=".5" opacity=".22"/><path d="M0 2.2 H16 M0 5 H16" stroke="#202226" stroke-width=".35" opacity=".16"/></pattern>' +
        '<filter id="ttShadow" x="-35%" y="-35%" width="190%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>' +
        '<clipPath id="ttLabelClip"><circle cx="560" cy="330" r="83"/></clipPath>' +
        '<path id="ttLabelArc" d="M 488 330 A 72 72 0 0 1 632 330" fill="none"/>' +
        '<clipPath id="ttJacketClip"><rect x="1170" y="76" width="508" height="508" rx="4"/></clipPath>' +
        '<clipPath id="ttListClip"><rect x="1690" y="56" width="286" height="590"/></clipPath>' +
        '</defs>' +
        '<rect x="0" y="-40" width="2000" height="720" rx="10" fill="' + ttSkin.plinth + '"/>' +
        '<rect x="24" y="-16" width="1952" height="672" rx="8" fill="' + ttSkin.deck + '" stroke="#0a0a0c" stroke-width="2"/>' +
        '<rect x="1147" y="-16" width="7" height="672" fill="#000" opacity=".36"/><path d="M1155 -8 V648" stroke="#fff" stroke-width="1" opacity=".13"/>' +
        ttVisual.body + ttVisual.brand +
        // 레코드 브러시 — 쌓인 먼지를 닦아낸다. 게이지는 현재 먼지량.
        '<rect id="ttCleanBtn" x="44" y="150" width="200" height="56" rx="8" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>레코드 브러시 — 판의 먼지를 닦아냅니다</title></rect>' +
        '<rect x="60" y="170" width="44" height="16" rx="4" fill="#4a3524" pointer-events="none"/>' +
        '<rect x="60" y="166" width="44" height="6" rx="2" fill="#6b5138" pointer-events="none"/>' +
        '<text x="170" y="185" font-family="Arial" font-size="15" font-weight="700" letter-spacing="1" fill="#e6e5e8" text-anchor="middle" pointer-events="none">클리닝</text>' +
        '<text x="44" y="238" font-family="Arial" font-size="10" letter-spacing="2" fill="#8a7d70">DUST</text>' +
        '<rect x="88" y="229" width="156" height="10" rx="5" fill="#101013" stroke="#3a3a40"/>' +
        '<rect id="ttDustBar" x="88" y="229" width="0" height="10" rx="5" fill="#b06a2a"/>' +
        // 플래터
        ttVisual.platterBase +
        '<g id="ttSpinG">' +
        ttVisual.spinTrim +
        '<circle cx="560" cy="330" r="252" fill="url(#ttVinyl)"/>' +
        grooves +
        '<path d="M 560 330 L 560 78 A 252 252 0 0 1 738 156 Z" fill="url(#ttSheen)"/>' +
        '<path d="M 560 330 L 560 582 A 252 252 0 0 1 382 504 Z" fill="url(#ttSheen)" opacity="0.6"/>' +
        '<circle cx="560" cy="330" r="86" fill="' + RECORD.labelBg + '"/>' +
        '<circle cx="560" cy="330" r="86" fill="none" stroke="' + RECORD.accent + '" stroke-width="3"/>' +
        '<circle cx="560" cy="330" r="79" fill="none" stroke="' + RECORD.accent + '" stroke-width="0.6" opacity="0.5"/>' +
        // 브랜드는 실물처럼 라벨 상단 원호를 따라 인쇄한다
        '<text font-family="Arial" font-size="7" letter-spacing="1.5" fill="' + RECORD.accent + '"><textPath href="#ttLabelArc" startOffset="50%" text-anchor="middle">YAHAMA RECORDS · STEREO · 33&#8531; RPM</textPath></text>' +
        '<text x="560" y="281" font-family="Georgia, serif" font-size="' + (RECORD.labelBig.length > 9 ? 14 : RECORD.labelBig.length > 6 ? 17 : 20) + '" font-weight="700" fill="' + RECORD.accent + '" text-anchor="middle">' + RECORD.labelBig + '</text>' +
        '<text x="560" y="295" font-family="Arial" font-size="9.5" fill="#3a2b1e" text-anchor="middle">' + RECORD.labelTitle + '</text>' +
        '<text x="560" y="307" font-family="Arial" font-size="7.5" fill="#6b5d4a" text-anchor="middle">' + RECORD.labelArtist + '</text>' +
        '<text x="560" y="319" font-family="Arial" font-size="7.5" font-weight="700" fill="' + RECORD.accent + '" text-anchor="middle">' + RECORD.bwv + ' · SIDE ' + (RECORD.side || 'A') + '</text>' +
        '<g clip-path="url(#ttLabelClip)">' + labelTracks + '</g>' +
        '<circle cx="560" cy="330" r="7" fill="#c9c2ae" stroke="#55504a"/><circle cx="560" cy="330" r="2.5" fill="#111"/>' +
        dustSpecks +
        '</g>' +
        // 바이닐 문지름 히트존 — 회전 중 드래그하면 마찰 스크래치가 난다 (스핀 그룹 밖, 정지 좌표)
        '<circle id="ttVinylHit" cx="560" cy="330" r="252" fill="#000" fill-opacity="0" style="cursor:grab"><title>회전 중인 판을 문지르면 치직거립니다</title></circle>' +
        // 클리닝 브러시 패드 — 클리닝하는 동안만 판 위에 얹힌다
        '<g id="ttBrushPad" opacity="0" pointer-events="none" transform="rotate(-24 560 330)">' +
        '<rect x="380" y="140" width="120" height="26" rx="8" fill="#4a3524" stroke="#2c1f14" stroke-width="2"/>' +
        '<rect x="380" y="132" width="120" height="10" rx="4" fill="#6b5138"/>' +
        '<rect x="418" y="108" width="44" height="26" rx="6" fill="#26262b" stroke="#0a0a0c"/>' +
        '</g>' +
        // 모델별 조작부는 플래터 위 레이어에서, 플래터 바깥쪽에 배치한다.
        ttVisual.detail +
        // 톤암
        ttVisual.armBase + ttVisual.arm +
        // 앨범 재킷 — 바이닐 지름(504)급 508×508. 수납장 버튼은 위, 컨트롤·화살표는 아래 한 줄로.
        '<g id="ttCrateBtn" style="cursor:pointer"><title>음반 수납장 열기</title>' +
        '<rect x="1280" y="28" width="288" height="32" rx="7" fill="#26262b" stroke="#4a4a52" stroke-width="1.5"/>' +
        '<text x="1424" y="49" font-family="Arial" font-size="13" fill="#d9cfc0" text-anchor="middle" pointer-events="none">▤ 음반 수납장 · ' + (recordIdx + 1) + ' / ' + RECORDS.length + '</text></g>' +
        '<rect x="1178" y="86" width="508" height="508" rx="4" fill="#000000" opacity="0.4" filter="url(#lzSoft)"/>' +
        '<rect x="1170" y="76" width="508" height="508" rx="4" fill="' + RECORD.jacketBg + '"/>' +
        (RECORD.cover
            // 실제 이미지 재킷 — 위 3/4는 커버(초상·실물 커버), 아래 밴드에 인쇄 정보
            ? '<image x="1170" y="76" width="508" height="396" href="' + PHONO_BASE + RECORD.cover + '" preserveAspectRatio="xMidYMin slice" clip-path="url(#ttJacketClip)"/>' +
              '<rect x="1170" y="472" width="508" height="3" fill="' + RECORD.accent + '"/>' +
              '<text x="1424" y="510" font-family="Georgia, serif" font-size="' + (RECORD.jTitle.length > 16 ? 20 : RECORD.jTitle.length > 11 ? 24 : 28) + '" font-weight="700" fill="' + jc.title + '" text-anchor="middle">' + RECORD.jTitle + '</text>' +
              '<text x="1424" y="535" font-family="Arial" font-size="13" fill="' + jc.sub + '" text-anchor="middle">' + RECORD.jSub1 + ' · ' + RECORD.jSub2 + '</text>' +
              '<text x="1424" y="558" font-family="Georgia, serif" font-style="italic" font-size="13" fill="' + jc.perf + '" text-anchor="middle">' + RECORD.performer + '</text>' +
              '<text x="1424" y="577" font-family="Arial" font-size="9" letter-spacing="2" fill="' + jc.sub + '" text-anchor="middle" opacity="0.8">YAHAMA RECORDS &#183; STEREO</text>'
            // 커버가 없는 음반 — 활자 중심의 인쇄 재킷
            : '<rect x="1186" y="92" width="476" height="476" fill="none" stroke="' + jc.inner + '" stroke-width="1" opacity="0.6"/>' +
              '<text x="1424" y="230" font-family="Georgia, serif" font-size="' + (RECORD.jTitle.length > 16 ? 32 : RECORD.jTitle.length > 11 ? 40 : RECORD.jTitle.length > 6 ? 58 : 84) + '" font-weight="700" fill="' + jc.title + '" text-anchor="middle">' + RECORD.jTitle + '</text>' +
              '<text x="1424" y="286" font-family="Arial" font-size="26" fill="' + jc.sub + '" text-anchor="middle">' + RECORD.jSub1 + '</text>' +
              '<text x="1424" y="322" font-family="Arial" font-size="20" fill="' + jc.sub + '" text-anchor="middle">' + RECORD.jSub2 + '</text>' +
              '<line x1="1280" y1="352" x2="1568" y2="352" stroke="' + jc.line + '" stroke-width="1"/>' +
              '<text x="1424" y="392" font-family="Georgia, serif" font-style="italic" font-size="21" fill="' + jc.perf + '" text-anchor="middle">' + RECORD.performer + '</text>' +
              '<rect x="1186" y="500" width="476" height="56" fill="' + RECORD.accent + '"/>' +
              '<text x="1424" y="536" font-family="Arial" font-size="17" letter-spacing="2" fill="#f0e8d0" text-anchor="middle">YAHAMA RECORDS &#183; STEREO</text>') +
        '<rect x="1170" y="76" width="508" height="508" rx="4" fill="none" stroke="' + jc.frame + '" stroke-width="2"/>' +
        // 트랙 리스트
        '<text x="1690" y="86" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2" fill="' + (ttSkin.muted || "#8a7d70") + '">SIDE ' + (RECORD.side || 'A') + '</text>' +
        '<g clip-path="url(#ttListClip)">' + rows + '</g>' +
        // 컨트롤 — 재킷 아래 한 줄: START · 33 · 45 · 이전/다음 음반
        '<rect id="ttPowerBtn" x="1046" y="592" width="110" height="58" rx="8" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>턴테이블 전원 — 끄면 톤암이 복귀하고, 대기 중인 방송이 있으면 연결됩니다</title></rect>' +
        '<circle id="ttPwrLed" cx="1072" cy="621" r="6" fill="#3a2012"/>' +
        '<text x="1114" y="627" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.5" fill="#e6e5e8" text-anchor="middle" pointer-events="none">POWER</text>' +
        '<rect id="ttStartBtn" x="1170" y="592" width="180" height="58" rx="8" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>START/STOP</title></rect>' +
        '<text id="ttStartLabel" x="1260" y="628" font-family="Arial" font-size="18" font-weight="700" letter-spacing="3" fill="#e6e5e8" text-anchor="middle" pointer-events="none">START</text>' +
        '<rect id="tt33" x="1370" y="595" width="85" height="52" rx="8" fill="#26262b" stroke="#4a4a52" style="cursor:pointer"><title>33 1/3 RPM</title></rect>' +
        '<text x="1413" y="627" font-family="Arial" font-size="15" font-weight="700" fill="#e6e5e8" text-anchor="middle" pointer-events="none">33&#8531;</text>' +
        '<rect id="tt45" x="1470" y="595" width="85" height="52" rx="8" fill="#26262b" stroke="#4a4a52" style="cursor:pointer"><title>45 RPM (빠른 재생)</title></rect>' +
        '<text x="1513" y="627" font-family="Arial" font-size="15" font-weight="700" fill="#e6e5e8" text-anchor="middle" pointer-events="none">45</text>' +
        '<circle id="ttPrevRec" cx="1600" cy="621" r="24" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>이전 음반</title></circle>' +
        '<text x="1600" y="630" font-family="Georgia, serif" font-size="26" fill="#d9cfc0" text-anchor="middle" pointer-events="none">&#8249;</text>' +
        '<circle id="ttNextRec" cx="1656" cy="621" r="24" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>다음 음반</title></circle>' +
        '<rect id="ttJacketHit" x="1170" y="76" width="508" height="508" fill="#000000" fill-opacity="0" style="cursor:zoom-in"><title>재킷 크게 보기</title></rect>' +
        '<text x="1656" y="630" font-family="Georgia, serif" font-size="26" fill="#d9cfc0" text-anchor="middle" pointer-events="none">&#8250;</text>' +
        '<text x="60" y="648" font-family="Arial" font-size="12" fill="' + (ttSkin.muted || "#8a7d70") + '">' + RECORD.credit + '</text>' +
        '</svg>';

    applyPanelLighting(document.querySelector("#ttStage svg"));
    RECORD.tracks.forEach((tr, i) => {
        document.getElementById("ttTrackHit" + i).addEventListener("click", () => playPhonoTrack(i));
    });
    document.getElementById("ttStartBtn").addEventListener("click", () => {
        if (phonoActive) togglePlay();
        else playPhonoTrack(0);
    });
    document.getElementById("tt33").addEventListener("click", () => { ttRpm45 = false; ttSyncCommonSpeed(33); applyRpmRate(); updatePhonoVisuals(); });
    document.getElementById("tt45").addEventListener("click", () => { ttRpm45 = true; ttSyncCommonSpeed(45); applyRpmRate(); updatePhonoVisuals(); });
    document.getElementById("ttPrevRec").addEventListener("click", () => setRecord(recordIdx - 1));
    document.getElementById("ttNextRec").addEventListener("click", () => setRecord(recordIdx + 1));
    document.getElementById("ttCrateBtn").addEventListener("click", openCrate);
    document.getElementById("ttCleanBtn").addEventListener("click", cleanRecord);
    // 바이닐 문지름 — 드래그 이동 속도가 스크래치 세기로 쌓인다 (회전 중일 때만 소리)
    const vinylHit = document.getElementById("ttVinylHit");
    vinylHit.addEventListener("pointerdown", (e) => {
        vinylHit.setPointerCapture(e.pointerId);
        vinylHit.style.cursor = "grabbing";
        ttRubLast = { x: e.clientX, y: e.clientY };
    });
    vinylHit.addEventListener("pointermove", (e) => {
        if (!ttRubLast) return;
        const dist = Math.hypot(e.clientX - ttRubLast.x, e.clientY - ttRubLast.y);
        ttRubLast = { x: e.clientX, y: e.clientY };
        // 손으로 문지르면 지문·유분이 묻어 먼지가 급격히 쌓인다 (자연 축적의 수백 배)
        ttDust = Math.min(1, ttDust + dist * 0.0016);
        if (phonoActive && isPlaying && ttSpin > 0.5) {
            ttScratchEnergy = Math.min(1, ttScratchEnergy + dist * 0.012);
        }
    });
    const rubEnd = () => { ttRubLast = null; vinylHit.style.cursor = "grab"; };
    vinylHit.addEventListener("pointerup", rubEnd);
    vinylHit.addEventListener("pointercancel", rubEnd);
    document.getElementById("ttJacketHit").addEventListener("click", openJacketView);
    svgButtonize("ttJacketHit", "재킷 크게 보기");
    bindArmDrag();
    bindTtModelControls();
    document.getElementById("ttPowerBtn").addEventListener("click", phonoPower);
    svgButtonize("ttPowerBtn", "턴테이블 전원");
    svgButtonize("ttStartBtn", "턴테이블 START/STOP");
    svgButtonize("ttCleanBtn", "레코드 브러시 클리닝");
    svgButtonize("tt33", "33⅓ RPM");
    svgButtonize("tt45", "45 RPM");
    svgButtonize("ttPrevRec", "이전 음반");
    svgButtonize("ttNextRec", "다음 음반");
    svgButtonize("ttCrateBtn", "음반 수납장 열기");
    RECORD.tracks.forEach((tr, i) => svgButtonize("ttTrackHit" + i, tr.t + " 재생"));
    updatePhonoVisuals();
}

// auto=true는 한 면을 이어 재생하는 자동 곡 넘김 — 바늘을 새로 놓는 게 아니므로 낙침음을 내지 않는다
function playPhonoTrack(i, auto) {
    if (!recIsMic) stopRecording();   // MIC 녹음은 본체 소스와 무관 — 계속 담는다
    stopDeck();
    if (player) { player.destroy(); player = null; }
    // 그래프는 MSE 지원 브라우저에서만 (iOS 네이티브 HLS 충돌 회피 — 라디오와 동일한 기준)
    if (typeof Hls !== "undefined" && Hls.isSupported() && !SAFARI_LIKE) ensureAudioGraph();
    phonoActive = true;
    phonoTrack = i;
    if (gainNode) applyGainStaging();
    currentStation = null;
    tunerSetStation(null);
    document.querySelectorAll(".station").forEach((el) => el.classList.remove("active", "playing", "loading"));
    streamLoaded = true;
    try { audio.preservesPitch = false; audio.webkitPreservesPitch = false; } catch (e) {}
    setAudioState("resolving", "PHONO");
    audio.src = phonoSrc(RECORD.tracks[i].f);
    audio.play().catch(() => { isPlaying = false; setAudioState("blocked"); updatePlayButton(); });
    isPlaying = true;
    if (SAFARI_LIKE && ttRpm45) applyRpmRate();
    if (!auto) needleThump();
    nowStation.textContent = RECORD.tracks[i].t + " — " + RECORD.composer;
    playerSubtext.textContent = "PHONO · " + RECORD.title + " (" + RECORD.performer + ")";
    updatePlayButton();
    updateMediaSession();
    updatePhonoVisuals();
    gtag('event', 'play_phono', { track: RECORD.tracks[i].t });
}

// 브러시 클리닝 — 1.4초 동안 브러시 패드가 판에 얹히고, 그 사이 먼지가 닦여 나간다 (ttFrame이 감쇠 처리)
function cleanRecord() {
    ttCleanUntil = performance.now() + 1400;
    playerSubtext.textContent = "레코드 브러시로 먼지를 닦아냅니다…";
    gtag('event', 'clean_record', { dust: Math.round(ttDust * 100) });
}

function stopPhono() {
    if (!phonoActive) return;
    phonoActive = false;
    phonoTrack = -1;
    try { audio.preservesPitch = true; audio.webkitPreservesPitch = true; } catch (e) {}
    try { audio.playbackRate = 1; } catch (e) {}
    if (crackleGain) crackleGain.gain.value = 0;
    if (scratchGain) scratchGain.gain.value = 0;
    ttScratchEnergy = 0;
    if (gainNode) applyGainStaging();
    updatePhonoVisuals();
}

function updatePhonoVisuals() {
    const pwrLed = document.getElementById("ttPwrLed");
    if (pwrLed) pwrLed.setAttribute("fill", phonoActive ? "#ff7a2a" : "#3a2012");
    RECORD.tracks.forEach((tr, i) => {
        const bg = document.getElementById("ttTrackBg" + i);
        if (bg) bg.setAttribute("opacity", i === phonoTrack ? "0.22" : "0");
    });
    const lbl = document.getElementById("ttStartLabel");
    if (lbl) lbl.textContent = (phonoActive && isPlaying) ? "STOP" : "START";
    const p33 = document.getElementById("tt33");
    const p45 = document.getElementById("tt45");
    if (p33) p33.setAttribute("fill", ttRpm45 ? "#26262b" : "#6b3a22");
    if (p45) p45.setAttribute("fill", ttRpm45 ? "#6b3a22" : "#26262b");
}



// ----- 랙 프레임 루프 (플래터 회전·톤암·와우플러터·크랙클·진공관 글로우·VU) -----
function ttFrame(now) {
    const dt = Math.min(0.05, ttLastTs ? (now - ttLastTs) / 1000 : 0.016);
    ttLastTs = now;
    ttLastDt = dt;

    // 상태 머신 → 랙 표시: 연결/버퍼링 중엔 LOCKED LED가 깜박인다
    const lockLed = document.getElementById("tsLedLock");
    if (lockLed) {
        const busy = audioState === "buffering" || audioState === "resolving";
        lockLed.style.opacity = busy ? ((now / 300 | 0) % 2 ? "1" : "0.25") : "";
    }

    // 고착 워치독 — 12초 넘게 연결/버퍼링에 머물면 정리한다:
    // 소리가 흐르고 있으면 재생 중으로 승격, 멈춰 있으면 오류로 내려 재시도를 유도
    if (busySince && performance.now() - busySince > 12000) {
        busySince = 0;
        if (!audio.paused && streamLoaded) {
            setAudioState("playing", currentStation ? currentStation.name : "");
        } else if (streamLoaded) {
            setAudioState("error", "응답 없음");
            playerSubtext.textContent = "스트림 응답이 없습니다 — 채널을 다시 선택해 주세요.";
        }
    }

    const ttSpec = TT_MODELS[ttModelId] || TT_MODELS.pl12;
    const rpm = (ttRpm45 ? 45 : 100 / 3) * ttSpeedTrim;
    const spinTarget = (phonoActive && isPlaying && !ttBraking) ? 1 : 0;
    // 브레이크(GARRARD)는 기계식 즉정지 — 런다운을 기다리지 않는다
    const step = spinTarget > ttSpin ? dt / ttSpec.spinUp : dt / (ttBraking ? 0.3 : ttSpec.runDown);
    ttSpin = Math.max(0, Math.min(1, ttSpin + (spinTarget > ttSpin ? 1 : -1) * step));
    if (ttSpin > 0.002) {
        ttAngle = (ttAngle + rpm / 60 * 360 * ttSpin * dt) % 360;
        const g = document.getElementById("ttSpinG");
        if (g) g.setAttribute("transform", "rotate(" + ttAngle.toFixed(2) + " 560 330)");
    }
    // SL-1200 스트로브 — 도트는 플래터와 함께 돌지만, 스트로브 조명 아래에서는
    // 정속(피치 0)일 때 멈춰 보인다: 역회전으로 상쇄하고 편차만큼만 흐르게 한다.
    if (ttModelId === "sl1200") {
        const ring = document.getElementById("ttStrobeRing");
        if (ring) {
            const effRate = ttSpeedTrim * (ttSpin < 0.999 ? (0.5 + 0.5 * ttSpin) : 1);
            if (ttSpin > 0.002) ttStrobeAng = (ttStrobeAng + dt * (effRate - 1) * 200) % 360;
            ring.setAttribute("transform", "rotate(" + (((-ttAngle + ttStrobeAng) % 360)).toFixed(2) + " 560 330)");
        }
    }

    // 톤암: 정지 시 암레스트, 재생 시 트랙 진행에 따라 안쪽으로
    let armTarget = -26;
    if (phonoActive && phonoTrack >= 0) {
        const p = (audio.duration > 0 && isFinite(audio.duration)) ? Math.min(1, audio.currentTime / audio.duration) : 0;
        const seg = 21 / RECORD.tracks.length;
        armTarget = -2 + seg * (phonoTrack + p);
    }
    if (!ttArmDrag) ttArmAng += (armTarget - ttArmAng) * Math.min(1, dt * 3.5);
    const arm = document.getElementById("ttArmG");
    if (arm) arm.setAttribute("transform", "rotate(" + ttArmAng.toFixed(2) + " 1065 120)");

    // 와우·플러터 + 스핀업 피치 + 45회전
    // 주의(실측 webprobe): WebKit은 playbackRate를 대입하는 것만으로 스트림을 리셋하고,
    // 리셋이 pause 이벤트를 불러 스핀업이 재계산되는 피드백 루프에 빠진다.
    // 사파리 계열에서는 프레임 루프에서 절대 건드리지 않는다 (45회전은 전환 시 1회 대입).
    if (phonoActive && isPlaying && !SAFARI_LIKE) {
        const t = now / 1000;
        const wow = 1 + 0.0022 * Math.sin(t * 2 * Math.PI * 0.43) + 0.0007 * Math.sin(t * 2 * Math.PI * 3.1);
        const spinPitch = ttSpin < 0.999 ? (0.5 + 0.5 * ttSpin) : 1;
        const mult = (ttRpm45 ? 1.35 : 1) * ttSpeedTrim;
        try { audio.playbackRate = wow * spinPitch * mult; } catch (e) {}
    }
    // 먼지 — 시간이 흐르면 랜덤하게 쌓인다 (판이 도는 동안 3배 빨리). 클리닝 중엔 빠르게 닦인다.
    const cleaning = now < ttCleanUntil;
    if (cleaning) {
        ttDust = Math.max(0, ttDust - dt * 1.2);
        if (ttDust === 0 && ttCleanUntil - now < 200) playerSubtext.textContent = "먼지를 말끔히 닦아냈습니다.";
    } else {
        // 자연 축적은 아주 느리게 — 먼지는 주로 판을 만질 때 쌓인다 (문지름 핸들러 참고)
        ttDust = Math.min(1, ttDust + dt * (0.0008 + Math.random() * 0.0016) / 30 * (phonoActive && isPlaying ? 3 : 1));
    }
    const dustG = document.getElementById("ttDustG");
    if (dustG) dustG.setAttribute("opacity", (ttDust * 0.85).toFixed(2));
    const dustBar = document.getElementById("ttDustBar");
    if (dustBar) dustBar.setAttribute("width", (ttDust * 156).toFixed(1));
    const brushPad = document.getElementById("ttBrushPad");
    if (brushPad) brushPad.setAttribute("opacity", cleaning ? "1" : "0");

    if (phonoActive && crackleGain) {
        ensureCrackle();
        // 크랙클(장작 소리)은 먼지량에 비례 — 깨끗한 판은 은은하게, 먼지 낀 판은 타닥거린다
        const target = (isPlaying && !audio.muted) ? (0.006 + ttDust * 0.048) * ttSpec.noise : 0;
        crackleGain.gain.value += (target - crackleGain.gain.value) * 0.08;
    }
    // 바이닐 문지름 — 드래그로 쌓인 에너지가 마찰음 게인으로, 손을 멈추면 빠르게 잦아든다
    if (scratchGain) {
        if (ttScratchEnergy > 0.001) ensureScratch();
        const sTarget = (phonoActive && isPlaying && !audio.muted) ? Math.min(0.3, ttScratchEnergy * 0.3) : 0;
        scratchGain.gain.value += (sTarget - scratchGain.gain.value) * 0.5;
        ttScratchEnergy *= Math.exp(-dt * 10);
    }

    // 진공관 웜업: 켜면 ~2초에 걸쳐 달아오르고, 꺼지면 열이 식듯 더 천천히 어두워진다
    // (테이프 트랜스포트가 도는 동안은 빈 구간이라도 시스템이 켜져 있는 것으로 본다)
    const warmTarget = (isPlaying || deckMode === "play" || !!recorder) ? 1 : 0;
    // 91E 정류관 지연 — 차가운 상태에서 소리를 걸면 2.6초간 정류관이 먼저 서고, 그 뒤 페이드인
    if (ampModelId === "300b" && gainNode && warmTarget === 1 && ttFrame.prevWarmTarget === 0 && tubeWarm < 0.05) {
        ampRectUntil = now + 2600;
        playerSubtext.textContent = "정류관 예열 중 — 잠시 후 소리가 나옵니다 (300B 싱글엔디드의 아침 의식).";
    }
    ttFrame.prevWarmTarget = warmTarget;
    if (ampRectUntil) {
        if (ampModelId !== "300b" || !gainNode) {
            ampRectUntil = 0;
        } else if (now >= ampRectUntil) {
            ampRectUntil = 0;
            applyGainStaging();
        } else {
            const remain = ampRectUntil - now;
            applyGainStaging();
            gainNode.gain.value *= remain > 700 ? 0 : (1 - remain / 700);
        }
    }
    const warmRate = warmTarget > tubeWarm ? dt / 2.0 : dt / 3.5;
    tubeWarm = Math.max(0, Math.min(1, tubeWarm + (warmTarget > tubeWarm ? 1 : -1) * warmRate));
    // 앰프·EQ·턴테이블은 실제로 듣고 있을 때만 점등 — 백그라운드 예약 녹음은 앰프를 쓰지 않는다
    const ampTarget = (isPlaying || deckMode === "play") ? 1 : 0;
    const ampRate = ampTarget > ampWarm ? dt / 2.0 : dt / 3.5;
    ampWarm = Math.max(0, Math.min(1, ampWarm + (ampTarget > ampWarm ? 1 : -1) * ampRate));
    updateMa2375Display();

    // 튜너 램프: 라디오 수신 중에만 (백열등이라 진공관보다 빠르게 켜지고 꺼진다)
    const tnTarget = ((isPlaying && currentStation) || (recorder && activeResRec)) ? 1 : 0;
    const tnRate = tnTarget > tunerWarm ? dt / 0.9 : dt / 1.4;
    tunerWarm = Math.max(0, Math.min(1, tunerWarm + (tnTarget > tunerWarm ? 1 : -1) * tnRate));

    // 앰프: 진공관 글로우(웜업 연동)·갤러리 어둠·VU 바늘·전원 LED
    // 유리 할로·주변광은 은은하게, 필라멘트는 백열로 뜨겁게 (실제 진공관의 빛 분포)
    document.querySelectorAll(".ampGlow").forEach((el) => {
        el.style.opacity = (0.012 + ampWarm * (0.32 + tsSignal * 0.34)).toFixed(3);
    });
    const filBloom = ampWarm > 0.04
        ? "drop-shadow(0 0 5px rgba(255,150,50," + ampWarm.toFixed(2) + ")) drop-shadow(0 0 14px rgba(255,110,35," + (0.6 * ampWarm).toFixed(2) + "))"
        : "none";
    document.querySelectorAll(".ampFil").forEach((el) => {
        el.style.opacity = (0.02 + ampWarm * (0.85 + tsSignal * 0.15)).toFixed(3);
        el.style.filter = filBloom;
    });
    // 필라멘트 핫코어 — 유리 안에서 작열하는 백열점. 큰 블룸으로 유리 전체에 번진다.
    const hotBloom = ampWarm > 0.04
        ? "drop-shadow(0 0 10px rgba(255,170,70," + (0.85 * ampWarm).toFixed(2) + ")) drop-shadow(0 0 26px rgba(255,120,40," + (0.45 * ampWarm).toFixed(2) + "))"
        : "none";
    document.querySelectorAll(".ampFilHot").forEach((el) => {
        el.style.opacity = (ampWarm * (0.8 + tsSignal * 0.2)).toFixed(3);
        el.style.filter = hotBloom;
    });
    // 켜지면 스모크 유리가 거의 걷힌다 — 달아오른 관은 노출된 유리처럼 보여야 한다
    document.querySelectorAll(".tubeDark").forEach((el) => {
        el.style.opacity = (0.76 - ampWarm * 0.7).toFixed(3);
    });
    // VU 바늘: 앰프 미터는 앰프 전원(ampWarm)을 따르고, 데크 미터는 녹음 소스 신호를 따른다.
    // 예약 녹음(백그라운드 수신) 중에는 데크 미터가 백그라운드 수신기의 레벨을 보여준다.
    const vuSig = Math.max(0, Math.min(1, tsSignal));
    if (recorder && activeResRec && bgRecAnalyser) {
        if (!ttFrame.bgTime || ttFrame.bgTime.length !== bgRecAnalyser.fftSize) ttFrame.bgTime = new Uint8Array(bgRecAnalyser.fftSize);
        bgRecAnalyser.getByteTimeDomainData(ttFrame.bgTime);
        let sum2 = 0;
        for (let i = 0; i < ttFrame.bgTime.length; i++) {
            const dv = (ttFrame.bgTime[i] - 128) / 128;
            sum2 += dv * dv;
        }
        const target = Math.min(1, Math.sqrt(sum2 / ttFrame.bgTime.length) * 2.6);
        bgRecSignal += (target - bgRecSignal) * Math.min(1, dt * 8);
    } else if (bgRecSignal > 0) {
        bgRecSignal = Math.max(0, bgRecSignal - dt * 1.5);
    }
    // MIC 입력 모니터 — 셀렉터가 MIC이면 데크 VU는 마이크 레벨을 보여준다 (녹음 전에도)
    if (micArmed && micAnalyser) {
        if (!ttFrame.micTime || ttFrame.micTime.length !== micAnalyser.fftSize) ttFrame.micTime = new Uint8Array(micAnalyser.fftSize);
        micAnalyser.getByteTimeDomainData(ttFrame.micTime);
        let msum2 = 0;
        for (let i = 0; i < ttFrame.micTime.length; i++) {
            const dv = (ttFrame.micTime[i] - 128) / 128;
            msum2 += dv * dv;
        }
        const mTarget = Math.min(1, Math.sqrt(msum2 / ttFrame.micTime.length) * 2.6);
        micSignal += (mTarget - micSignal) * Math.min(1, dt * 8);
    } else if (micSignal > 0) {
        micSignal = Math.max(0, micSignal - dt * 1.5);
    }
    // 데크 VU 우선순위: 예약(백그라운드 수신) > 진행 중인 LINE 녹음(본체 신호) > MIC 모니터 > 본체
    const deckSig = (recorder && activeResRec) ? bgRecSignal
        : (micArmed && (!recorder || recIsMic)) ? micSignal
        : vuSig;
    ["ampVuL", "ampVuR", "deckVuL", "deckVuR"].forEach((id, idx) => {
        const n = document.getElementById(id);
        if (!n) return;
        let sig = id.startsWith("amp") ? vuSig * ampWarm : deckSig;
        if (id.startsWith("amp") && ampRectUntil && now < ampRectUntil) sig = 0;   // 정류관 예열 중
        // 8B: BIAS 모드에서는 좌측 미터가 신호 대신 채널 바이어스를 가리킨다 —
        // 켠 직후엔 낮았다가 관이 달아오르며 정격(중앙)으로 올라온다
        if (id === "ampVuL" && ampModelId === "el34" && ampBiasMode) {
            sig = tubeWarm * (ampBiasMode === 2 ? 0.485 : 0.5) + 0.008 * Math.sin(now / 300);
        }
        if (n.getAttribute("data-meter-style") === "segments") {
            const level = Math.max(0, Math.min(1, sig * (idx % 2 ? .96 : 1)));
            const segments = n.querySelectorAll("[data-meter-segment]");
            const lit = Math.round(level * segments.length);
            segments.forEach((segment, segmentIndex) => {
                const on = segmentIndex < lit;
                const color = on ? segment.dataset.on : segment.dataset.off;
                segment.style.fill = color;
                segment.style.filter = on ? "drop-shadow(0 0 3px " + color + ")" : "none";
            });
            return;
        }
        const ang = -42 + sig * 84;
        n.setAttribute("transform", "rotate(" + (ang * (idx % 2 ? 0.96 : 1)).toFixed(1) + " " + n.getAttribute("data-cx") + " " + n.getAttribute("data-cy") + ")");
    });

    // 카세트 데크: 테이프 트랜스포트 (위치·릴·감김량·카운터·히스·REC 램프)
    if (deckMode === "rec" && recorder) {
        tapePos = Math.min(tapeLenOf(deckTape), deckRecStartPos + (Date.now() - recStartMs) / 1000);
        if (tapePos >= tapeLenOf(deckTape)) {
            stopRecording();
            playerSubtext.textContent = "테이프 끝 — 녹음이 정지되었습니다.";
        }
    } else if (deckMode === "play") {
        if (deckSegPlaying) {
            if (isFinite(audio.currentTime)) tapePos = deckSegPlaying.start + Math.max(0, audio.currentTime - (deckSegPlaying.offset || 0));
        } else {
            tapePos += dt;   // 빈 구간: 히스만 내며 계속 감긴다
            // 위치가 이미 세그먼트 안이면 그 자리에서 시작 — IndexedDB 복원이 늦게
            // 도착한 경우(릴만 돌고 무음)와 구간 중간 재개를 모두 살린다
            const inSeg = deckTape ? segmentAt(deckTape, tapePos) : null;
            if (inSeg) {
                deckStartSegment(inSeg, tapePos - inSeg.start);
            } else {
                const nx = deckTape ? nextSegmentAfter(deckTape, tapePos) : null;
                if (nx && tapePos >= nx.start) deckStartSegment(nx, tapePos - nx.start);
            }
        }
        if (tapePos >= tapeLenOf(deckTape)) {
            tapePos = tapeLenOf(deckTape);
            // DRAGON 오토 리버스 — 반대 면에 수록이 있으면 헤드가 그대로 뒤집혀 SIDE B 재생
            // (실물의 자동 반전). 반대 면이 공면이면 되감기 리피트로 폴백.
            if (deckModelId === "dragon" && dragonRepeat && deckTape && !recorder
                && deckTape.segmentsB && deckTape.segmentsB.length) {
                tapeFlipArrays(deckTape);
                tapePos = 0;
                deckSegPlaying = null;
                tapeMetaSave();
                updateDeckLabel();
                deckRefreshShelf();
                const revSeg = segmentAt(deckTape, 0) || nextSegmentAfter(deckTape, 0);
                if (revSeg && revSeg.start < 1) deckStartSegment(revSeg, Math.max(0, -revSeg.start));
                nowStation.textContent = deckTape.label + " — TAPE";
                playerSubtext.textContent = "AUTO REVERSE — SIDE " + deckTape.side + " 재생으로 반전했습니다.";
            } else if (deckModelId === "dragon" && dragonRepeat && deckTape && deckTape.segments.length && !recorder) {
                deckAutoResume = true;
                deckSegPlaying = null;
                audio.pause();
                deckAutoWind(0, "AUTO REVERSE");
            } else
            // REV MODE 릴레이 — A면이 끝나면 B웰 카세트를 A웰로 옮겨 이어 재생 (W-990RX)
            if (isDoubleDeck() && w990ContPlay && deckBTape && deckBTape.segments.length && !recorder) {
                deckTape.pos = tapeLenOf(deckTape);
                const nextTape = deckBTape;
                deckBTape = null;
                deckTape = nextTape;
                tapePos = 0;
                deckSegPlaying = null;
                deckRefreshShelf();
                const relaySeg = segmentAt(deckTape, 0) || nextSegmentAfter(deckTape, 0);
                if (relaySeg) deckStartSegment(relaySeg, Math.max(0, 0 - relaySeg.start));
                nowStation.textContent = deckTape.label + " — TAPE";
                playerSubtext.textContent = "릴레이 재생 — B웰 카세트 「" + deckTape.label + "」로 이어 갑니다.";
            } else {
                deckStopTransport();
                playerSubtext.textContent = "테이프가 끝났습니다 — 되감으세요.";
                if (radioStandby) {
                    const nx2 = radioStandby;
                    radioStandby = null;
                    selectStation(nx2.id);
                }
            }
        }
        const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
        if (hissGain) hissGain.gain.value += ((deckSegPlaying ? deckSpec.hissFloor : deckSpec.blankHiss) * (deckTape && deckTape.cal ? 0.55 : 1) - hissGain.gain.value) * 0.1;
    } else if (deckMode === "wind") {
        const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
        tapePos = Math.max(0, Math.min(tapeLenOf(deckTape), tapePos + windDir * deckSpec.windRate * dt));
        // LOC 자동 와인딩 — 목표 지점에 도달하면 스스로 정지 (B215 컴퓨터 컨트롤)
        if (deckWindTarget != null && ((windDir > 0 && tapePos >= deckWindTarget) || (windDir < 0 && tapePos <= deckWindTarget))) {
            tapePos = deckWindTarget;
            deckWindTarget = null;
            deckMode = "stop";
            windDir = 0;
            deckSyncTape();
            if (deckAutoResume) {
                deckAutoResume = false;
                deckPlay();
                playerSubtext.textContent = "AUTO REVERSE — 되감기 완료, 처음부터 이어 재생합니다.";
            } else {
                playerSubtext.textContent = "LOC — " + formatDuration(tapePos * 1000) + " 위치에 도착했습니다.";
            }
        }
        if (tapePos <= 0 || tapePos >= tapeLenOf(deckTape)) { deckMode = "stop"; windDir = 0; deckWindTarget = null; }
    }
    const deckRolling = (deckMode === "play") || (deckMode === "rec" && recorder);
    syncDeckStageLive();
    const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
    const dubbing = w990DubUntil > Date.now();
    const spinRate = (dubbing ? 900 : deckMode === "wind" ? 900 * windDir : (deckRolling ? 210 : 0)) * deckSpec.reelRate;
    if (spinRate) deckReelAngle = (deckReelAngle + dt * spinRate + 360) % 360;
    const rl = document.getElementById("deckReelL");
    if (rl) {
        rl.setAttribute("transform", "rotate(" + deckReelAngle.toFixed(1) + " 610 260)");
        const rr = document.getElementById("deckReelR");
        if (rr) rr.setAttribute("transform", "rotate(" + (deckReelAngle * 0.82).toFixed(1) + " 850 260)");
        const p = tapePos / tapeLenOf(deckTape);
        const pl = document.getElementById("deckPackL");
        const pr = document.getElementById("deckPackR");
        if (pl) pl.setAttribute("r", (24 + (1 - p) * 16).toFixed(1));
        if (pr) pr.setAttribute("r", (24 + p * 16).toFixed(1));
        const cnt = document.getElementById("deckCounter");
        if (cnt) {
            const txt = formatDuration(tapePos * 1000);
            if (cnt.textContent !== txt) cnt.textContent = txt;
        }
        const led = document.getElementById("deckRecLed");
        if (led) led.style.fill = recorder ? ((now % 1000) < 550 ? "#ff2a1a" : "#7a1a10") : "#3a1210";
        // TIMER 램프: 예약 대기 중 은은히 점등, 예약 녹음 중 점멸 (실물 데크의 타이머 스탠바이)
        const tled = document.getElementById("deckTimerLed");
        if (tled) {
            const recActive = activeResRec && activeResRec.started;
            const recPending = activeResRec && !activeResRec.started;   // 발화됐지만 아직 시작 전 (튠·차단 대기)
            tled.style.fill = recActive ? ((now % 1000) < 550 ? "#ff2a1a" : "#7a1a10")
                : recPending ? ((now % 460) < 250 ? "#ff2a1a" : "#5a1a10")
                : reservations.some((r) => r.enabled) ? "#c24530" : "#3a1210";
        }
    }
    // 더블데크 B웰 — 녹음이 도는 동안 릴·팩·카운터가 독립적으로 움직인다
    const brl = document.getElementById("deckBReelL");
    if (brl) {
        const bLen = tapeLenOf(deckBTape);
        if (dubbing) {
            deckBReelAngle = (deckBReelAngle + dt * 900 + 360) % 360;
            deckBPos = Math.min(bLen, deckBPos + dt * (w990DubHigh ? 30 : 15));
        }
        if (recOnB && recorder) {
            deckBPos = Math.min(bLen, deckBRecStartPos + (Date.now() - recStartMs) / 1000);
            deckBReelAngle = (deckBReelAngle + dt * 210 + 360) % 360;
            if (deckBPos >= bLen) {
                stopRecording();
                playerSubtext.textContent = "B웰 테이프 끝 — 녹음이 정지되었습니다.";
            }
        }
        brl.setAttribute("transform", "rotate(" + deckBReelAngle.toFixed(1) + " " + brl.getAttribute("data-cx") + " " + brl.getAttribute("data-cy") + ")");
        const brr = document.getElementById("deckBReelR");
        if (brr) brr.setAttribute("transform", "rotate(" + (deckBReelAngle * 0.82).toFixed(1) + " " + brr.getAttribute("data-cx") + " " + brr.getAttribute("data-cy") + ")");
        const pB = deckBPos / bLen;
        const bpl = document.getElementById("deckBPackL");
        const bpr = document.getElementById("deckBPackR");
        if (bpl) bpl.setAttribute("r", (24 + (1 - pB) * 16).toFixed(1));
        if (bpr) bpr.setAttribute("r", (24 + pB * 16).toFixed(1));
        const bcnt = document.getElementById("deckBCounter");
        if (bcnt) {
            const btxt = formatDuration(deckBPos * 1000);
            if (bcnt.textContent !== btxt) bcnt.textContent = btxt;
        }
        const blabel = document.getElementById("deckBLabel");
        if (blabel) {
            const want = deckBTape ? deckBTape.label : (activeResRec ? "예약 대기" : "REC STANDBY");
            if (blabel.textContent !== want) blabel.textContent = want;
        }
    }
    const pled = document.getElementById("ampPwrLed");
    if (pled) pled.style.fill = isPlaying ? "#ff7a3a" : "#3a2012";

    // 소스 보이싱 — 라디오/포노/테이프 소스와 모델 시그니처를 따라 셸프를 튼다
    applySourceVoice();
    // 10B 오실로스코프 — 미동조에선 유영하는 타원, 동조·재생 중엔 중앙의 안정된 정현파
    const scopeCore = document.getElementById("tsScopeCore");
    if (scopeCore) {
        const scopeGlow = document.getElementById("tsScopeGlow");
        const locked = isPlaying && currentStation;
        const ts = now / 1000;
        const amp = locked ? 22 + Math.max(0, Math.min(1, tsSignal)) * 36 : 13;
        const drift = locked ? 0 : Math.sin(ts * 0.9) * 34;
        let d = "";
        for (let i = 0; i <= 26; i++) {
            const ph = i / 26 * Math.PI * 2;
            const x = 445 + i * 10 + (locked ? 0 : drift * Math.sin(ph) * 0.5);
            const y = 268 - Math.sin(ph * 2 + ts * (locked ? 2.2 : 6.1)) * amp
                - (locked ? 0 : Math.sin(ph * 5 + ts * 9) * 6);
            d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
        }
        scopeCore.setAttribute("d", d);
        if (scopeGlow) scopeGlow.setAttribute("d", d);
        const scopeOp = (0.12 + tunerWarm * 0.88).toFixed(2);
        scopeCore.style.opacity = scopeOp;
        if (scopeGlow) scopeGlow.style.opacity = scopeOp * 0.8;
    }
    // DRAGON NAAC LED — 외부 테이프를 보정 중일 때 점멸, 평소엔 고정 점등
    const naacLed = document.getElementById("deckNaacLed");
    if (naacLed) {
        const correcting = deckMode === "play" && deckTape && deckTape.foreign;
        naacLed.style.fill = correcting ? ((now % 700) < 380 ? "#8dffb0" : "#2c5c42") : "#6ee58b";
    }
    // SE-9 맥락 점등 — 지금 소스에 맞는 프리셋 키가 은은히 글로우 ("기계가 알고 있다")
    const eqCtx = (currentStation && isPlaying) ? "fmnr" : phonoActive ? "vinyl" : deckMode === "play" ? "tape" : null;
    if (eqCtx !== ttFrame.eqCtxLast && document.getElementById("eqKey_mem")) {
        ["fmnr", "vinyl", "tape"].forEach((id) => {
            const g = document.getElementById("eqKey_" + id);
            if (!g) return;
            const rect = g.querySelector("rect");
            if (rect) {
                rect.setAttribute("stroke", id === eqCtx ? "#54d18a" : "#3a3e46");
                rect.setAttribute("stroke-width", id === eqCtx ? "1.8" : "1.2");
            }
        });
        ttFrame.eqCtxLast = eqCtx;
    }
    // EQ 레벨 LED 컬럼 — 점등 시 발광(블룸), 소등 시 거의 꺼진 상태
    for (let i = 0; i < 12; i++) {
        const el = document.getElementById("eqLvl" + i);
        if (!el) break;
        const on = eqState.on && isPlaying && (i / 12) < tsPeak;
        const color = i >= 10 ? "#ff5a3a" : "#ffb03a";
        el.style.fill = on ? color : "#1e1610";
        el.style.filter = on ? "drop-shadow(0 0 5px " + color + ") drop-shadow(0 0 12px " + color + "66)" : "none";
    }

    // 밴드별 실시간 스펙트럼 — 분석기 FFT bin을 현재 EQ 중심 주파수에 대응시킨다.
    if (analyser && eqState.on && isPlaying) {
        if (!ttFrame.eqSpectrum || ttFrame.eqSpectrum.length !== analyser.frequencyBinCount) {
            ttFrame.eqSpectrum = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(ttFrame.eqSpectrum);
    }
    EQ_FREQS.forEach((freq, i) => {
        let level = 0;
        if (analyser && ttFrame.eqSpectrum && eqState.on && isPlaying) {
            const nyquist = (audioCtx ? audioCtx.sampleRate : 48000) / 2;
            const center = Math.max(0, Math.min(ttFrame.eqSpectrum.length - 1, Math.round(freq / nyquist * ttFrame.eqSpectrum.length)));
            const raw = Math.max(ttFrame.eqSpectrum[Math.max(0, center - 1)] || 0, ttFrame.eqSpectrum[center] || 0, ttFrame.eqSpectrum[Math.min(ttFrame.eqSpectrum.length - 1, center + 1)] || 0);
            level = Math.pow(raw / 255, .72);
        }
        for (let j = 0; j < 8; j++) {
            const el = document.getElementById("eqBandLvl" + i + "_" + j);
            if (!el) continue;
            const on = eqState.on && isPlaying && (j + 1) / 8 <= level;
            const color = on ? el.dataset.on : el.dataset.off;
            el.style.fill = color;
            el.style.filter = on ? "drop-shadow(0 0 4px " + color + ")" : "none";
        }
    });

    // 튜너 조명값: 수신 램프 + 다이얼 조작 중 웨이크
    const previewOn = now < tsPreviewUntil;
    const tunerLight = Math.max(tunerWarm, previewOn ? 0.85 : 0);

    // 다이얼 백라이트·눈금·주파수 디지트 — 튜너 램프에 연동
    document.querySelectorAll(".lampGlow").forEach((el) => {
        el.style.opacity = (0.06 + tunerLight * 0.69).toFixed(3);
    });
    // 미터 백라이트 라이트박스 — 켜지면 면 전체가 발광한다.
    // 튜너 유닛의 미터는 튜너 램프에, 나머지는 시스템 웜업에 연동된다.
    document.querySelectorAll(".ampLamp").forEach((el) => {
        const w = el.closest("#tunerStage") ? tunerLight : el.closest("#deckStage") ? tubeWarm : ampWarm;
        el.style.opacity = (0.03 + w * 0.97).toFixed(3);
    });
    // 그린 레전드(맥킨토시 패널 문자) — 백라이트 연동 (앰프 전원 기준)
    document.querySelectorAll(".ampLegend").forEach((el) => {
        el.style.opacity = (0.2 + ampWarm * 0.8).toFixed(3);
    });
    document.querySelectorAll(".dialScale").forEach((el) => {
        el.style.opacity = (0.32 + tunerLight * 0.68).toFixed(2);
    });
    const digitOp = Math.max(0.08 + tunerWarm * 0.92, previewOn ? 1 : 0).toFixed(2);
    if (tsFreq) { tsFreq.style.opacity = digitOp; tsFreqGlow.style.opacity = digitOp; }

    // 전원 연동 조명: 튜너는 수신 램프를, 나머지 유닛은 시스템 웜업을 따른다
    document.querySelectorAll(".lzPowerDim").forEach((el) => {
        const w = el.closest("#tunerStage") ? tunerLight : el.closest("#deckStage") ? tubeWarm : ampWarm;
        el.style.opacity = (0.22 * (1 - w)).toFixed(3);
    });
    // 미터 백라이트: 꺼진 미터 면은 어둡다
    document.querySelectorAll(".meterDark").forEach((el) => {
        const w = el.closest("#tunerStage") ? tunerLight : el.closest("#deckStage") ? tubeWarm : ampWarm;
        el.style.opacity = (0.55 * (1 - w)).toFixed(3);
    });
}

// 채널 목록 접기/펼치기 (기본 접힘 — 튜너 중심)
function toggleStationList() {
    const main = document.getElementById("stationMain");
    const collapsed = main.classList.toggle("collapsed");
    document.getElementById("listToggle").setAttribute("aria-expanded", String(!collapsed));
    document.getElementById("listToggleLabel").textContent = collapsed ? "전체 채널 목록" : "목록 접기";
}

// 설정 모달 (튜너/앰프 모델 선택)
function toggleSettings(show) {
    document.getElementById("settingsOverlay").hidden = !show;
}

function openListFromSettings() {
    const main = document.getElementById("stationMain");
    if (main.classList.contains("collapsed")) toggleStationList();
    main.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("settingsOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) toggleSettings(false);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("settingsOverlay").hidden) {
        toggleSettings(false);
    }
});

// 입력 모달리티 추적 — SVG 컨트롤의 포커스 링은 키보드 사용 중에만 보여준다
document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") document.body.classList.add("kbd-nav");
});
document.addEventListener("pointerdown", () => {
    document.body.classList.remove("kbd-nav");
});

// ===== 음반 수납장 (레코드 크레이트) =====
// 34장을 재킷 그리드로 펼쳐 검색·선택한다. 재킷 인쇄색은 배경 밝기로 자동 결정.
function jacketCard(rec, idx) {
    const jc = jacketInk(rec.jacketBg);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "crate-jacket" + (idx === recordIdx ? " is-current" : "");
    btn.style.background = rec.jacketBg;
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-label", rec.title + " · " + rec.performer);
    if (rec.cover) {
        // 턴테이블 큰 재킷과 같은 구성 — 위쪽은 커버 이미지, 글자는 아래 단색 밴드에만 얹는다
        btn.classList.add("has-cover");
        const art = document.createElement("span");
        art.className = "cj-art";
        art.style.backgroundImage = "url('" + PHONO_BASE + rec.cover + "')";
        btn.appendChild(art);
    }
    const badgeInk = rec.cover ? "#f0e8d0" : jc.sub;  // 배지가 이미지 위에 놓이므로 밝은 잉크 + CSS 배경띠
    const parts = [
        ["cj-num", badgeInk, String(idx + 1)],
        ["cj-side", badgeInk, "SIDE " + (rec.side || "A")],
        ["cj-title", jc.title, rec.jTitle],
        ["cj-sub", jc.sub, rec.jSub1],
        ["cj-perf", jc.perf, rec.performer]
    ];
    for (const [cls, color, text] of parts) {
        const el = document.createElement("span");
        el.className = cls;
        el.style.color = color;
        el.textContent = text;
        btn.appendChild(el);
    }
    const bar = document.createElement("span");
    bar.className = "cj-bar";
    bar.style.background = rec.accent;
    bar.textContent = rec.composer;
    btn.appendChild(bar);
    // 펼침: 높이 = 폭 (아무리 길어도 1:1 정사각) — 수치 대입이라 height 전환이 매끄럽다
    const expand = () => { btn.style.height = btn.offsetWidth + "px"; };
    const collapse = () => { btn.style.height = ""; };
    btn.addEventListener("pointerenter", expand);
    btn.addEventListener("pointerleave", collapse);
    btn.addEventListener("focus", expand);
    btn.addEventListener("blur", collapse);
    btn.addEventListener("click", () => pickRecord(idx));
    return btn;
}

function renderCrate(q) {
    const grid = document.getElementById("crateGrid");
    const empty = document.getElementById("crateEmpty");
    grid.innerHTML = "";
    const needle = (q || "").trim().toLowerCase();
    let shown = 0;
    RECORDS.forEach((rec, idx) => {
        if (needle) {
            const hay = [rec.title, rec.composer, rec.performer, rec.jTitle,
                rec.jSub1, rec.jSub2, rec.bwv, rec.labelTitle].join(" ").toLowerCase();
            if (!hay.includes(needle)) return;
        }
        grid.appendChild(jacketCard(rec, idx));
        shown++;
    });
    empty.hidden = shown > 0;
    document.getElementById("crateCount").textContent =
        needle ? (shown + " / " + RECORDS.length + "장") : (RECORDS.length + "장");
}

function openCrate() {
    document.getElementById("crateOverlay").hidden = false;
    const search = document.getElementById("crateSearch");
    search.value = "";
    renderCrate("");
    const cur = document.querySelector(".crate-jacket.is-current");
    if (cur) cur.scrollIntoView({ block: "nearest" });
    search.focus();
    gtag('event', 'open_crate', {});
}

function closeCrate() {
    document.getElementById("crateOverlay").hidden = true;
}

function pickRecord(i) {
    setRecord(i);
    closeCrate();
}

document.getElementById("crateSearch").addEventListener("input", (e) => renderCrate(e.target.value));
document.getElementById("crateOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCrate();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("crateOverlay").hidden) closeCrate();
});

let currentStation = null;
let isPlaying = false;
let player = null; // PlayerCore 핸들 (hls 인스턴스 포함)
let streamLoaded = false;
let volumeLevel = loadJson("fmRadio.volume", 1.0);
if (typeof volumeLevel !== "number" || !(volumeLevel >= 0 && volumeLevel <= 1)) volumeLevel = 1.0;
let accentColor = "#d36a42";
let favorites = loadJson("fmRadio.favorites", []);


const SLEEP_STEPS = [0, 15, 30, 60, 90];
let sleepIndex = 0;
let sleepDeadline = 0;
let sleepTicker = null;

// 예약 녹음 상태 — ttFrame(데크 TIMER 램프)·updateRecTime이 초기화 직후부터 읽으므로
// 파일 끝(편성표 섹션)이 아니라 여기서 선언한다. 로직은 '편성표 & 예약 녹음' 섹션에.
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
let schedState = { stationId: null, day: 0, view: "list", seq: 0 };
let reservations = loadJson("fmRadio.reservations", []);
let activeResRec = null;                                // 진행 중 예약 녹음 { res, occ, key, endTs, tapeId, started }
let resFiredOcc = loadJson("fmRadio.resFired", {});     // 회차별 기록 (key: resId:ymd) — 1 발화, 2 사용자 취소, 3 완료.
                                                        // 1인데 진행 중인 녹음이 없으면 앱이 죽었다 살아난 것 — 남은 시간을 이어 녹음한다.
const resAlerted = {};                                  // 5분 전 알림 중복 방지 (세션 한정)
let pendingRecName = null;                              // 다음 toggleRecording()이 쓸 녹음 이름 (프로그램명)
let recSavedMsgOverride = null;                         // 녹음 저장(onstop) 시 일반 문구 대신 보여줄 안내 (예약 완료용)
let resFormReady = false;


audio.volume = volumeLevel;

if (!window.MediaRecorder) {
    btnRec.hidden = true;
}

function stationInitial(name) {
    const lastWord = name.split(" ").pop() || name;
    if (/^[가-힣]{4,}$/.test(lastWord)) {
        return lastWord.substring(0, 2);
    }
    return lastWord.substring(0, 4).toUpperCase();
}

function stationCard(station) {
    const faved = favorites.includes(station.id);
    return `
        <div class="station" data-station="${station.id}">
            <button class="station-main" type="button" onclick="selectStation('${station.id}')">
                <div class="station-icon" style="background:linear-gradient(135deg, ${shadeColor(station.color, 16)}, ${shadeColor(station.color, -18)})">${stationInitial(station.name)}</div>
                <div class="station-info">
                    <div class="station-name">${station.name}</div>
                    <div class="station-desc">${station.desc}</div>
                </div>
                <div class="station-status">
                    <div class="loading-spinner" aria-hidden="true"></div>
                    <div class="station-eq" aria-hidden="true">
                        <div class="eq-bar"></div>
                        <div class="eq-bar"></div>
                        <div class="eq-bar"></div>
                        <div class="eq-bar"></div>
                    </div>
                </div>
            </button>
            <button class="station-fav${faved ? " faved" : ""}" type="button" aria-pressed="${faved}" aria-label="${station.name} 즐겨찾기 ${faved ? "해제" : "추가"}" onclick="toggleFavorite('${station.id}')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.3l-6.2 3.7 1.6-7.1L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.4 4.7 1.6 7.1z"></path></svg>
            </button>
        </div>
    `;
}

function renderStations() {
    // 그룹 섹션은 stations.js의 groupLabels 순서대로 생성한다 — 채널 추가는 stations.js만 고치면 된다.
    const mount = document.getElementById("groupsMount");
    mount.innerHTML = Object.entries(FMRadio.groupLabels).map(([group, label]) => {
        const groupStations = stations.filter((station) => station.group === group);
        if (!groupStations.length) return "";
        return `<section class="group">
            <div class="group-header">
                <div class="group-title">${label}</div>
                <div class="group-note">${groupStations.length}개 채널</div>
            </div>
            <div class="station-list" id="${group}List">${groupStations.map((station) => stationCard(station)).join("")}</div>
        </section>`;
    }).join("");

    const favStations = favorites
        .map((id) => stations.find((station) => station.id === id))
        .filter(Boolean);
    favGroup.hidden = favStations.length === 0;
    favNote.textContent = `${favStations.length}개 채널`;
    favList.innerHTML = favStations.map((station) => stationCard(station)).join("");

    reapplyStationState();
}

function cardsOf(id) {
    return document.querySelectorAll(`[data-station="${id}"]`);
}

function reapplyStationState() {
    if (!currentStation) return;
    cardsOf(currentStation.id).forEach((element) => {
        element.classList.add("active");
        if (isPlaying) element.classList.add("playing");
    });
}

// 채널 검색 — 이름·설명·주파수로 카드를 거르고, 빈 그룹은 숨긴다
document.getElementById("stationSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll("#groupsMount .station").forEach((el) => {
        const st = stations.find((s) => s.id === el.dataset.station);
        if (!st) return;
        const hay = (st.name + " " + (st.desc || "") + " " + st.freq).toLowerCase();
        el.hidden = q !== "" && !hay.includes(q);
    });
    document.querySelectorAll("#groupsMount .group").forEach((sec) => {
        sec.hidden = ![...sec.querySelectorAll(".station")].some((el) => !el.hidden);
    });
});

function toggleFavorite(id) {
    const index = favorites.indexOf(id);
    if (index >= 0) {
        favorites.splice(index, 1);
    } else {
        favorites.push(id);
    }
    saveJson("fmRadio.favorites", favorites);
    renderStations();
    gtag('event', 'toggle_favorite', {
        station_id: id,
        favorited: index < 0
    });
}

function applyStationTheme(station) {
    const accent = station ? station.color : "#d36a42";
    accentColor = accent;
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-strong", shadeColor(accent, 18));
    // 모바일 주소창·PWA 프레임 색을 채널 색으로 어둡게 물들인다
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", station ? shadeColor(accent, -70) : "#121110");
}

function shadeColor(hex, amount) {
    const sanitized = hex.replace("#", "");
    const num = parseInt(sanitized, 16);
    const clamp = (value) => Math.max(0, Math.min(255, value));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00ff) + amount);
    const b = clamp((num & 0x0000ff) + amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

function playStream(url) {
    if (player) {
        player.destroy();
        player = null;
    }

    if (typeof Hls !== "undefined" && Hls.isSupported() && !SAFARI_LIKE && url.indexOf(".m3u8") !== -1) {
        // MSE 경로에서는 미리 그래프를 만들어 VU 미터를 켠다.
        // (Safari 네이티브 HLS는 MediaElementSource와 충돌할 수 있어 제외)
        ensureAudioGraph();
    }

    streamLoaded = true;
    player = PlayerCore.attach(audio, url, {
        onBlocked: () => {
            isPlaying = false;
            updatePlayButton();
            setAudioState("blocked");
        },
        onRetry: (n, max) => {
            setAudioState("buffering", `재시도 ${n}/${max}`);
            playerSubtext.textContent = `연결이 불안정합니다. 다시 시도 중… (${n}/${max})`;
        },
        onFatal: (data) => {
            stopPlay();
            setAudioState("error", "스트림 중단");
            playerSubtext.textContent = "스트림이 중단되었습니다. 채널을 다시 선택해 주세요.";
            gtag('event', 'stream_error', {
                station_id: currentStation ? currentStation.id : null,
                stage: 'playback',
                message: data && data.details ? String(data.details).slice(0, 100) : 'fatal'
            });
        },
        onUnsupported: () => {
            streamLoaded = false;
            setAudioState("error", "HLS 미지원");
            playerSubtext.textContent = "이 브라우저는 HLS 스트리밍을 지원하지 않습니다.";
        }
    });
}

let selectSeq = 0;

async function selectStation(id) {
    const station = stations.find((item) => item.id === id);
    if (!station) return;

    // 미디어 우선: 음반/테이프가 도는 동안 튜너는 소스를 빼앗지 않고 대기 선국만 한다
    if ((phonoActive && isPlaying) || deckMode === "play") {
        radioStandby = station;
        tunerSetStation(station);
        playerSubtext.textContent = phonoActive
            ? station.name + " 대기 — 턴테이블이 재생 중입니다. 지금 들으려면 턴테이블 POWER를 꺼 주세요. (음반이 끝나면 자동 연결)"
            : station.name + " 대기 — 테이프가 재생 중입니다. 지금 들으려면 데크를 정지(\u25a0)해 주세요.";
        return;
    }

    const mySeq = ++selectSeq;

    if (!recIsMic) stopRecording();   // MIC 녹음은 선국과 무관 — 계속 담는다
    stopPhono();
    stopDeck();
    radioStandby = null;

    // 이전 스트림을 먼저 내린다 — 연결 실패 시
    // '이전 채널 소리 + 새 채널 실패 표시'가 엇갈리지 않도록
    if (player) {
        player.destroy();
        player = null;
    }
    audio.pause();
    streamLoaded = false;

    document.querySelectorAll(".station").forEach((element) => {
        element.classList.remove("active", "playing", "loading");
    });

    cardsOf(id).forEach((element) => element.classList.add("active", "loading"));
    currentStation = station;
    nowStation.textContent = station.name;
    setAudioState("resolving", station.name);
    playerSubtext.textContent = `${station.desc} 스트림에 연결 중입니다.`;
    applyStationTheme(station);
    tunerSetStation(station);

    try {
        const url = await getStreamUrl(station);
        if (mySeq !== selectSeq) return; // 그 사이 다른 선국이 시작됨 — 늦은 응답은 버린다
        cardsOf(id).forEach((element) => {
            element.classList.remove("loading");
            element.classList.add("playing");
        });
        playStream(url);
        isPlaying = true;
        updatePlayButton();
        updateMediaSession();
        updateNowProgram();
        saveJson("fmRadio.lastStation", station.id);
        gtag('event', 'play_station', {
            station_id: station.id,
            station_name: station.name,
            station_group: station.group
        });
    } catch (error) {
        if (mySeq !== selectSeq) return;
        cardsOf(id).forEach((element) => element.classList.remove("loading"));
        nowStation.textContent = `${station.name} 연결 실패`;
        setAudioState("error", "주소 확인 실패");
        playerSubtext.textContent = "스트림 응답이 없거나 브라우저 정책 때문에 재생이 차단되었습니다. 채널을 다시 눌러 재시도할 수 있습니다.";
        console.error(error);
        gtag('event', 'stream_error', {
            station_id: station.id,
            stage: 'resolve',
            message: String(error && error.message || error).slice(0, 100)
        });
    }
}

function togglePlay() {
    // 최초 방문 — 아직 선국된 채널이 없다. 죽은 버튼 대신 기본 채널(첫 방송국)부터 건다
    if (!currentStation && !phonoActive && deckMode !== "play") {
        if (stations.length) selectStation(stations[0].id);
        return;
    }
    const sourceName = currentStation ? currentStation.name : phonoActive ? "레코드" : "테이프";

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playerSubtext.textContent = `${sourceName} 재생을 일시정지했습니다.`;
    } else {
        // 라이브 라디오의 '재개'는 이어듣기가 아니라 재선국이다 — 멈춘 사이 라이브 엣지가
        // 지나가 버려, 낡은 버퍼를 resume하면 무반응·긴 지연이 잦다. 전원을 다시 올리듯 새로 붙는다.
        if (currentStation) {
            selectStation(currentStation.id);
            return;
        }
        // 테이프: 현재 카운터 위치의 세그먼트를 다시 건다 — 묵은 src(직전 라디오 등)를
        // 그대로 재생하면 릴은 테이프인데 소리는 딴 데서 나는 괴리가 생긴다
        if (deckMode === "play") {
            const seg = deckTape ? segmentAt(deckTape, tapePos) : null;
            if (seg) {
                deckStartSegment(seg, tapePos - seg.start);
                playerSubtext.textContent = "테이프 재생 재개 (" + formatDuration(tapePos * 1000) + " 위치)";
                updatePlayButton();
                updateActiveStation();
            } else {
                playerSubtext.textContent = deckTape && deckTape.segments.length
                    ? "테이프의 빈 구간입니다 — 릴은 감기는 중. REW로 되감으면 수록 구간부터 재생됩니다."
                    : "공테이프입니다 — TAPE RACK에서 녹음된 테이프를 눌러 장착하세요.";
            }
            return;
        }
        // 포노는 멈춘 자리에서 그대로 이어 재생
        audio.play().then(() => {
            isPlaying = true;
            playerSubtext.textContent = `${sourceName} 재생 중입니다.`;
            updatePlayButton();
            updateActiveStation();
        }).catch(() => {
            isPlaying = false;
            setAudioState("blocked");
            updatePlayButton();
        });
        return;
    }

    updatePlayButton();
    updateActiveStation();
}

function stopPlay() {
    if (!recIsMic) stopRecording();   // MIC 녹음은 본체 정지와 무관 — 계속 담는다
    stopPhono();
    stopDeck();

    if (player) {
        player.destroy();
        player = null;
    }

    audio.pause();
    // src=""는 페이지 URL을 소스로 지정해 MEDIA_ERR_SRC_NOT_SUPPORTED를 유발한다
    audio.removeAttribute("src");
    audio.load();
    streamLoaded = false;
    isPlaying = false;
    setAudioState("idle");
    updatePlayButton();
    updateActiveStation();
}

function updatePlayButton() {
    if (isPlaying) {
        playIcon.setAttribute("d", "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
    } else {
        playIcon.setAttribute("d", "M8 5v14l11-7z");
    }
    updateRecButton();
}

function updateActiveStation() {
    document.querySelectorAll(".station").forEach((element) => {
        element.classList.remove("playing");
    });

    if (currentStation && isPlaying) {
        cardsOf(currentStation.id).forEach((element) => element.classList.add("playing"));
    }
}

function playEasterEgg() {
    if (!recIsMic) stopRecording();
    stopPhono();
    stopDeck();

    if (player) {
        player.destroy();
        player = null;
    }

    document.querySelectorAll(".station").forEach((element) => {
        element.classList.remove("active", "playing", "loading");
    });

    currentStation = { id: "pyongyang", name: "평양 FM", desc: "조선중앙방송", freq: 105.2, color: "#8b2020" };
    nowStation.textContent = "평양 FM";
    playerSubtext.textContent = "…국경 너머의 전파가 잡혔습니다. 조선중앙방송에 연결 중입니다.";
    applyStationTheme(currentStation);
    tunerSetStation(currentStation);

    audio.src = "https://listen7.myradio24.com/69366";
    streamLoaded = true;
    audio.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        updateMediaSession();
        gtag('event', 'play_station', {
            station_id: 'pyongyang',
            station_name: '평양 FM',
            station_group: 'easter_egg'
        });
    }).catch(() => {
        isPlaying = false;
        updatePlayButton();
        setAudioState("error", "연결 실패");
    });
}

function setVolume(value) {
    setVolumeLevel(value / 100);
}

// ----- 녹음 -----


function toggleRecording(opts) {
    if (recorder) {
        stopRecording();
        // 손으로 정지한 것 — 진행 중이던 예약 회차는 되살리지 않는다
        if (activeResRec && activeResRec.started) {
            cancelReservedRecording("예약 녹음을 중단했습니다 — " + activeResRec.res.title);
        }
        return;
    }

    // 예약 녹음은 백그라운드 수신기에서 녹음한다 — 본체가 꺼져 있어도 무방
    const bgRec = !!(opts && opts.source === "bg");
    // REC INPUT이 MIC이면 마이크가 소스 — 본체 재생 여부와 무관하게 녹음할 수 있다
    const micRec = !bgRec && micArmed && !!micStream;
    if (!bgRec && !micRec && !isPlaying) {
        // 예약 시각인데 아직 시작 전이면 REC 누름(제스처)이 곧 시동이다
        if (activeResRec && !activeResRec.started) {
            playerSubtext.textContent = "예약 녹음을 시작합니다 — " + activeResRec.res.title;
            bgRecKick();
        }
        return;
    }

    // 더블데크: 녹음(예약·수동)은 B웰 전담 — A웰이 재생 중이어도 무방 (수동 REC = 더빙)
    const wellB = isDoubleDeck();
    if (wellB) {
        if (!bgRec) {
            // 수동 녹음은 B웰 테이프 끝에 이어 붙인다 — 없거나 가득이면 새 C-60
            if (!deckBTape || tapeUsedSec(deckBTape) >= tapeLenOf(deckBTape) - 5) deckBTape = newBlankTape(3600);
            deckBPos = tapeUsedSec(deckBTape);
        }
        if (!deckBTape) deckBTape = newBlankTape(3600);
    } else {
        // 싱글 데크: 녹음은 장착 테이프의 현재 위치에 기록된다 (덮어쓰기)
        if (deckMode === "play") {
            playerSubtext.textContent = "테이프 재생 중에는 녹음할 수 없습니다 — 라디오나 턴테이블을 재생하세요.";
            return;
        }
        if (tapePos >= tapeLenOf(deckTape) - 1) {
            playerSubtext.textContent = "테이프 끝입니다 — 되감거나 EJECT로 새 테이프를 넣으세요.";
            return;
        }
        if (!deckTape) deckTape = newBlankTape();
    }

    // 백그라운드 녹음은 스트림 바이트 캡처라 WebAudio·MediaRecorder가 필요 없다.
    // 본체 그래프는 Safari 계열에서 의도적으로 꺼져 있으므로 bg 경로에서 요구하면 안 된다.
    let rec;
    if (bgRec) {
        if (!bgRecPlayer || !bgRecPlayer.hls) {
            playerSubtext.textContent = "이 브라우저에서는 백그라운드 녹음을 지원하지 않습니다.";
            return;
        }
        bgCapStart();
        // MediaRecorder와 같은 사용법의 캡처 심 — stop() 시 모아 둔 바이트를 내보낸다
        rec = {
            state: "recording",
            mimeType: bgRecCap.mime || "audio/mp4",
            ondataavailable: null,
            onstop: null,
            start() {},
            stop() {
                this.state = "inactive";
                const blob = bgCapStop();
                this.mimeType = blob.type;
                if (this.ondataavailable && blob.size) this.ondataavailable({ data: blob });
                if (this.onstop) this.onstop();
            }
        };
    } else if (micRec) {
        // 마이크는 getUserMedia 스트림을 직접 녹음 — MediaElementSource가 아니므로
        // Safari 계열에서도 동작한다 (본체 그래프 불필요)
        const mime = pickRecMime();
        try {
            rec = new MediaRecorder(micStream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
        } catch (error) {
            console.error(error);
            playerSubtext.textContent = "마이크 녹음을 시작할 수 없습니다.";
            return;
        }
        if (micCtx && micCtx.state === "suspended") micCtx.resume();
    } else {
        if (!ensureAudioGraph()) {
            playerSubtext.textContent = "이 브라우저에서는 녹음을 지원하지 않습니다.";
            return;
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
        const mime = pickRecMime();
        try {
            rec = new MediaRecorder(recDest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
        } catch (error) {
            console.error(error);
            playerSubtext.textContent = "녹음을 시작할 수 없습니다.";
            return;
        }
    }

    const chunks = [];
    const base = bgRec && activeResRec
        ? (stations.find((st) => st.id === activeResRec.res.stationId) || { id: activeResRec.res.stationId, name: activeResRec.res.title })
        : micRec ? { id: "mic", name: "마이크 녹음" }
        : currentStation || {
            id: "phono",
            name: (phonoActive && phonoTrack >= 0) ? RECORD.tracks[phonoTrack].t : "레코드"
        };
    // 예약 녹음이면 파일·테이프 이름을 방송 프로그램명으로 (채널 id는 그대로)
    const station = { id: base.id, name: pendingRecName || base.name };
    pendingRecName = null;
    const startMs = Date.now();
    const startDate = new Date();
    const tapeTarget = wellB ? deckBTape : deckTape;
    const tapeStartPos = wellB ? deckBPos : tapePos;
    const tapeId = tapeTarget.id;
    const tapeSide = tapeTarget.side || "A";   // 어느 면에 녹음되는지 — 복원 시 같은 면으로

    rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = async () => {
        if (!chunks.length) return;
        const durationMs = Date.now() - startMs;
        const type = rec.mimeType || chunks[0].type || "audio/mp4";
        const record = {
            stationId: station.id,
            stationName: station.name,
            startedAt: startDate.toISOString(),
            durationMs,
            type,
            tapeId,
            tapeStart: tapeStartPos,
            tapeLen: tapeLenOf(tapeTarget),
            side: tapeSide,
            blob: new Blob(chunks, { type })
        };
        record.dbId = await persistRecording(record);
        addRecordingItem(record);
        // 예약 녹음 완료 안내(카세트 보관 위치)가 방금 표시됐다면 일반 저장 문구로 덮지 않는다
        playerSubtext.textContent = recSavedMsgOverride || `${station.name} → 테이프 ${formatDuration(tapeStartPos * 1000)} 위치에 녹음되었습니다.`;
        recSavedMsgOverride = null;
        gtag('event', 'record_save', {
            station_id: station.id,
            station_name: station.name,
            duration_seconds: Math.round(durationMs / 1000)
        });
    };

    recorder = rec;
    recIsMic = micRec;
    recSavedMsgOverride = null;
    recStartMs = startMs;
    if (wellB) {
        recOnB = true;
        deckBRecStartPos = tapeStartPos;
    } else {
        deckRecStartPos = tapeStartPos;
        deckMode = "rec";
    }
    rec.start(1000);

    recTimerId = setInterval(updateRecTime, 500);
    updateRecTime();
    btnRec.classList.add("recording");
    btnRec.setAttribute("aria-label", "녹음 정지 및 저장");
    playerSubtext.textContent = micRec
        ? "MIC 녹음 중입니다 — 재생·선국과 무관하게 계속 담깁니다. REC를 다시 누르면 저장됩니다."
        : `${station.name} 녹음 중입니다. 정지하거나 채널을 바꾸면 자동 저장됩니다.`;

    gtag('event', 'record_start', {
        station_id: station.id,
        station_name: station.name
    });
}

function stopRecording() {
    if (!recorder) return;

    const active = recorder;
    recorder = null;
    recIsMic = false;
    if (recOnB) {
        recOnB = false;
        if (deckBTape) {
            deckBTape.pos = 0;   // 되감아 랙으로 — B웰은 정지 즉시 배출한다
            if (!w990ContPlay) deckBTape = null;   // REV MODE 릴레이면 이어 재생을 위해 웰에 남긴다
        }
        deckBPos = 0;
        deckRefreshShelf();
        // 예약 종료(finishReservedRecording)가 아니면 이 안내가 저장 시점에 표시된다
        recSavedMsgOverride = "B웰 녹음 완료 — 카세트를 되감아 테이프 랙에 보관했습니다. TAPE RACK에서 누르면 A웰에 장착됩니다.";
    } else if (deckMode === "rec") {
        deckMode = "stop";
        tapePos = Math.min(tapeLenOf(deckTape), deckRecStartPos + (Date.now() - recStartMs) / 1000);
        if (deckTape) deckTape.pos = tapePos;
    }

    clearInterval(recTimerId);
    recTimerId = null;
    btnRec.classList.remove("recording");
    btnRec.setAttribute("aria-label", "녹음 시작");
    recTimeEl.textContent = "REC";
    updateRecButton();

    if (active.state !== "inactive") {
        active.stop();
    }
}

function recFileExtension(mimeType) {
    if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("flac")) return "flac";
    return "webm";
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function updateRecTime() {
    recTimeEl.textContent = formatDuration(Date.now() - recStartMs);
    updateResDiag();
    // 예약 녹음: 프로그램 종료 시각에 자동 정지
    if (activeResRec && recorder && Date.now() >= activeResRec.endTs) {
        finishReservedRecording();
    }
}

function updateRecButton() {
    // 예약 회차가 대기 중(자동재생 차단 등으로 시작 전)이면 REC가 시동 버튼이 된다
    btnRec.disabled = !recorder && !isPlaying && !activeResRec;
}

function addRecordingItem(record) {
    recordingCount += 1;
    const startDate = new Date(record.startedAt);
    const url = URL.createObjectURL(record.blob);
    const ext = recFileExtension(record.type);
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}_${pad(startDate.getHours())}${pad(startDate.getMinutes())}${pad(startDate.getSeconds())}`;
    const safeName = record.stationName.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
    const fileName = `${safeName}_${stamp}.${ext}`;
    const startLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())} 시작`;

    // 테이프에 세그먼트로 기록 (복원 시에는 tapeId 기준으로 테이프를 재구성한다)
    let tape = record.tapeId ? tapes.find((t) => t.id === record.tapeId) : null;
    if (!tape) {
        const len = record.tapeLen || TAPE_LEN;
        tape = { id: record.tapeId || ("tape-legacy-" + (record.dbId || Math.random())), label: tapeSizeName(len) + " · TAPE " + tapeSeq, segments: [], segmentsB: [], side: "A", pos: 0, len, blank: true, createdAt: Date.parse(record.startedAt) || Date.now() };
        tapeSeq += 1;
        tapes.push(tape);
    }
    tapeAddSegmentSide(tape, { start: record.tapeStart || 0, dur: record.durationMs / 1000, url, name: record.stationName, dbId: record.dbId, type: record.type }, record.side);
    if (!deckTape) deckTape = tape;
    tapeMetaSave();
    deckRefreshShelf();

    const item = document.createElement("div");
    item.className = "recording";

    const badge = document.createElement("div");
    badge.className = "rec-badge";
    badge.textContent = "REC";

    const info = document.createElement("div");
    info.className = "rec-info";

    const name = document.createElement("div");
    name.className = "rec-name";
    name.textContent = record.stationName;

    const meta = document.createElement("div");
    meta.className = "rec-meta";
    meta.textContent = `${startLabel} · ${formatDuration(record.durationMs)} · ${formatSize(record.blob.size)}`;

    const preview = document.createElement("audio");
    preview.controls = true;
    preview.preload = "metadata";
    preview.src = url;

    info.append(name, meta, preview);

    const actions = document.createElement("div");
    actions.className = "rec-actions";

    const download = document.createElement("a");
    download.className = "rec-btn";
    download.href = url;
    download.download = fileName;
    download.textContent = "저장";

    const remove = document.createElement("button");
    remove.className = "rec-btn danger";
    remove.type = "button";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => {
        preview.pause();
        // 모든 테이프에서 해당 세그먼트를 지운다 (재생 중이면 그 구간은 침묵으로)
        tapes.forEach((t) => { t.segments = t.segments.filter((sg) => sg.url !== url); });
        if (deckSegPlaying && deckSegPlaying.url === url) {
            audio.pause();
            deckSegPlaying = null;
        }
        tapeMetaSave();
        deckRefreshShelf();
        URL.revokeObjectURL(url);
        deleteRecording(record.dbId);
        item.remove();
        recordingCount -= 1;
        updateRecordingsNote();
    });

    actions.append(download, remove);
    item.append(badge, info, actions);
    recordingList.prepend(item);
    updateRecordingsNote();
}

function updateRecordingsNote() {
    recordingsGroup.hidden = recordingCount === 0;
    const keepNote = recDb
        ? "녹음 파일은 이 브라우저에 보관됩니다."
        : "페이지를 닫으면 목록이 사라집니다. 필요한 파일은 저장해 두세요.";
    recordingsNote.textContent = `${recordingCount}개 · ${keepNote}`;
}


// ----- 취침 타이머 -----

function cycleSleepTimer() {
    sleepIndex = (sleepIndex + 1) % SLEEP_STEPS.length;
    const minutes = SLEEP_STEPS[sleepIndex];

    clearInterval(sleepTicker);
    sleepTicker = null;

    if (!minutes) {
        sleepDeadline = 0;
        btnTimer.classList.remove("armed");
        btnTimer.setAttribute("aria-label", "취침 타이머 설정");
        timerLabel.textContent = "타이머";
        return;
    }

    sleepDeadline = Date.now() + minutes * 60000;
    btnTimer.classList.add("armed");
    btnTimer.setAttribute("aria-label", `취침 타이머 ${minutes}분, 누르면 변경`);
    updateSleepLabel();
    sleepTicker = setInterval(() => {
        if (Date.now() >= sleepDeadline) {
            expireSleepTimer();
        } else {
            updateSleepLabel();
        }
    }, 1000);

    gtag('event', 'set_sleep_timer', { minutes });
}

function updateSleepLabel() {
    timerLabel.textContent = formatDuration(sleepDeadline - Date.now());
}

function expireSleepTimer() {
    clearInterval(sleepTicker);
    sleepTicker = null;
    sleepIndex = 0;
    sleepDeadline = 0;
    btnTimer.classList.remove("armed");
    btnTimer.setAttribute("aria-label", "취침 타이머 설정");
    timerLabel.textContent = "타이머";
    stopPlay();
    playerSubtext.textContent = "취침 타이머가 끝나 재생을 정지했습니다.";
}

// ----- VU 미터 -----

function startVu() {
    if (!analyser || vuRaf) return;
    // 랙 전용 모드에서 VU 캔버스는 항상 숨겨져 있다 — 보이지 않으면 그리지 않는다
    if (vuCanvas.offsetParent === null) return;
    vuData = new Uint8Array(analyser.frequencyBinCount);
    vuRaf = requestAnimationFrame(drawVu);
}

function stopVu() {
    if (vuRaf) cancelAnimationFrame(vuRaf);
    vuRaf = null;
    vuCtx.setTransform(1, 0, 0, 1, 0, 0);
    vuCtx.clearRect(0, 0, vuCanvas.width, vuCanvas.height);
}

function drawVu() {
    vuRaf = requestAnimationFrame(drawVu);

    const dpr = window.devicePixelRatio || 1;
    const width = vuCanvas.clientWidth;
    const height = vuCanvas.clientHeight;
    if (vuCanvas.width !== Math.round(width * dpr) || vuCanvas.height !== Math.round(height * dpr)) {
        vuCanvas.width = Math.round(width * dpr);
        vuCanvas.height = Math.round(height * dpr);
    }

    vuCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vuCtx.clearRect(0, 0, width, height);
    analyser.getByteFrequencyData(vuData);

    const bars = 48;
    const gap = 3;
    const barWidth = (width - gap * (bars - 1)) / bars;
    vuCtx.fillStyle = accentColor;
    for (let i = 0; i < bars; i++) {
        // 라디오 음성 대역이 몰려 있는 저·중역(하위 72% bin)만 사용
        const value = vuData[Math.floor((i / bars) * vuData.length * 0.72)] / 255;
        const barHeight = Math.max(2, value * (height - 6));
        vuCtx.globalAlpha = 0.22 + value * 0.6;
        vuCtx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
    }
    vuCtx.globalAlpha = 1;
}

// ----- Media Session / 시계 -----

function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const artwork = [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ];
    try {
        if (deckPlaying && deckTape) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: deckTape.label,
                artist: "CASSETTE TAPE · C-30",
                album: "FM 라디오 모음",
                artwork
            });
            return;
        }
        if (phonoActive && phonoTrack >= 0) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: RECORD.tracks[phonoTrack].t,
                artist: RECORD.composer + " · " + RECORD.performer,
                album: RECORD.title + " (" + RECORD.bwv + ")",
                artwork
            });
            return;
        }
        if (!currentStation) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentStation.name,
            artist: currentStation.desc || "FM 라디오",
            album: "FM 라디오 모음",
            artwork
        });
    } catch (error) {
        console.error(error);
    }
}

if ("mediaSession" in navigator) {
    try {
        navigator.mediaSession.setActionHandler("play", togglePlay);
        navigator.mediaSession.setActionHandler("pause", togglePlay);
        navigator.mediaSession.setActionHandler("previoustrack", () => stepStation(-1));
        navigator.mediaSession.setActionHandler("nexttrack", () => stepStation(1));
    } catch (error) {
        console.error(error);
    }
}

function tickClock() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    liveClock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

setInterval(tickClock, 1000);
tickClock();

function stepStation(delta) {
    let index = currentStation ? stations.findIndex((item) => item.id === currentStation.id) : -1;
    index = (index + delta + stations.length) % stations.length;
    selectStation(stations[index].id);
}

document.addEventListener("keydown", (event) => {
    const onBody = event.target === document.body;
    const onStation = event.target.closest && event.target.closest(".station");

    if (event.code === "Space" && onBody) {
        event.preventDefault();
        togglePlay();
    } else if ((event.code === "ArrowDown" || event.code === "ArrowUp") && (onBody || onStation)) {
        event.preventDefault();
        stepStation(event.code === "ArrowDown" ? 1 : -1);
    }
});

audio.addEventListener("pause", () => {
    // 수동 녹음(본체 소스 탭)만 소스 정지에 따라 멈춘다 —
    // 백그라운드 예약 녹음은 본체 재생과 무관하므로 계속 굴러가야 한다
    if (!(recorder && (activeResRec || recIsMic))) stopRecording();
    stopVu();
    isPlaying = false;
    // 재생 중이었다면 대기로 — 버퍼링/오류 등 전환 중 상태는 건드리지 않는다
    if (audioState === "playing") setAudioState("idle");
    updatePlayButton();
    updateActiveStation();
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    tunerSetLeds(false);
});

// 버퍼 고갈 — 스트림은 살아 있지만 데이터가 늦게 온다
["waiting", "stalled"].forEach((ev) => audio.addEventListener(ev, () => {
    if (streamLoaded && (isPlaying || audioState === "playing")) setAudioState("buffering");
}));

audio.addEventListener("ended", () => {
    // 카세트: 세그먼트가 끝나도 테이프는 계속 감긴다 (빈 구간은 히스, 정지는 30:00에서)
    if (deckMode === "play" && deckSegPlaying) {
        tapePos = deckSegPlaying.start + deckSegPlaying.dur;
        deckSegPlaying = null;
        isPlaying = false;
        updatePlayButton();
        return;
    }
    // 포노: 트랙이 끝나면 다음 트랙으로 (음반 한 면을 이어 재생 — 바늘은 그대로, 낙침음 없음)
    if (phonoActive && phonoTrack >= 0 && phonoTrack < RECORD.tracks.length - 1) {
        playPhonoTrack(phonoTrack + 1, true);
    } else if (phonoActive) {
        const done = phonoTrack;
        stopPhono();
        isPlaying = false;
        updatePlayButton();
        gtag('event', 'phono_side_end', { last_track: done });
        // 대기 중이던 방송국이 있으면 자동 연결 (입력 셀렉터가 튜너로 돌아가듯)
        if (radioStandby) {
            const next = radioStandby;
            radioStandby = null;
            playerSubtext.textContent = "음반이 끝나 " + next.name + "에 연결합니다.";
            selectStation(next.id);
        } else {
            playerSubtext.textContent = "음반 한 면이 끝났습니다. 톤암이 복귀합니다.";
        }
    }
});

// 일부 엔진(특히 WebKit 네이티브 HLS)은 버퍼링 복구 후 'playing' 이벤트를 건너뛴다 —
// 실제로 재생 시간이 흐르고 있으면 재생 중으로 승격한다 (최초 POWER 후 '버퍼링' 고착 수정)
audio.addEventListener("timeupdate", () => {
    if (!audio.paused && streamLoaded && (audioState === "buffering" || audioState === "resolving")) {
        setAudioState("playing", currentStation ? currentStation.name
            : phonoActive ? "PHONO" : deckMode === "play" ? "TAPE" : "");
    }
});

audio.addEventListener("playing", () => {
    isPlaying = true;
    setAudioState("playing", currentStation ? currentStation.name
        : phonoActive ? "PHONO" : deckMode === "play" ? "TAPE" : "");
    updatePlayButton();
    updateActiveStation();
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    tunerSetLeds(true);
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    startVu();
    if (currentStation) {
        playerSubtext.textContent = `${currentStation.name} 재생 중입니다.`;
    }
});

function openWidget() {
    const query = new URLSearchParams({ skin: "tuner" });
    if (currentStation && stations.some((item) => item.id === currentStation.id)) {
        query.set("station", currentStation.id);
    }
    window.open(`widget.html?${query.toString()}`, "fmRadioWidget", "width=480,height=330,resizable=yes");
    gtag('event', 'open_widget', {
        station_id: currentStation ? currentStation.id : null
    });
}

// ----- 첫 방문 코치마크 -----
// 랙 전용(데스크톱) 모드에서만 보여준다 — 모바일은 플레이어 바가 이미 보인다.
function mountCoach() {
    if (loadJson("fmRadio.coachDone", false)) return;
    if (!window.matchMedia("(min-width: 721px) and (pointer: fine)").matches) return;
    const stage = document.getElementById("tunerStage");
    const svg = stage.querySelector("svg");
    if (!svg || !tunerCfg) return;

    const vb = (svg.getAttribute("viewBox") || "0 0 2000 269").split(/\s+/).map(Number);
    const layer = document.createElement("div");
    layer.className = "coach-layer";
    [
        { key: "power", label: "전원 — 재생/정지" },
        { key: "dial", label: "다이얼을 드래그해 선국" },
        { key: "rec", label: "편성표·예약 녹음" },
        { key: "rf", label: "채널 목록 열기" }
    ].forEach(({ key, label }) => {
        const box = tunerCfg.hits[key];
        if (!box) return;
        const chip = document.createElement("div");
        chip.className = "coach-chip";
        chip.textContent = label;
        chip.style.left = ((box[0] + box[2] / 2) / vb[2] * 100).toFixed(1) + "%";
        chip.style.top = (((box[1] + box[3]) / vb[3] * 100) + 4).toFixed(1) + "%";
        layer.appendChild(chip);
    });
    const done = document.createElement("button");
    done.type = "button";
    done.className = "coach-dismiss";
    done.textContent = "알겠어요";
    done.addEventListener("click", dismissCoach);
    layer.appendChild(done);
    stage.appendChild(layer);
    svg.addEventListener("pointerdown", dismissCoach, { once: true });
}

function dismissCoach() {
    const layer = document.querySelector(".coach-layer");
    if (layer) layer.remove();
    saveJson("fmRadio.coachDone", true);
}

function restoreLastStation() {
    const lastId = loadJson("fmRadio.lastStation", null);
    const station = stations.find((item) => item.id === lastId);
    if (!station) return;

    currentStation = station;
    nowStation.textContent = station.name;
    playerSubtext.textContent = "마지막으로 듣던 채널입니다. 재생 버튼을 누르면 연결합니다.";
    applyStationTheme(station);
    reapplyStationState();
}

renderStations();
restoreLastStation();
updateRecButton();
openRecordingDb();
initTunerSkin(loadJson("fmRadio.skin", "mr78"));
mountEq();
mountAmp();
mountDeck();
mountTurntable();
applyUnitVisibility();
renderDeckPicker();
renderTtPicker();
tunerLoop();
mountCoach();

// ----- 트레이 앱 연동 (chrome=tray) -----
// 윈도우 트레이 앱의 셸 iframe 안에서 돌 때: 재생 상태를 부모(셸)에 브로드캐스트하고
// 위젯과 같은 원격 제어 API(fmRadio:*)를 받는다. 셸은 이 상태로 슬림 바·트레이 메뉴를 그린다.
(function () {
    if (new URLSearchParams(location.search).get("chrome") !== "tray") return;
    if (window.parent === window) return;

    function trayBroadcast(type) {
        try {
            window.parent.postMessage({
                type: type || "fmRadio:state",
                mode: "radio",
                station: currentStation ? currentStation.id : null,
                stationName: (nowStation.textContent || "").trim() || (currentStation ? currentStation.name : ""),
                playing: isPlaying,
                loading: false,
                volume: Math.round(volumeLevel * 100)
            }, "*");
        } catch (error) {
            console.error(error);
        }
    }

    // isPlaying을 바꾸는 경로(선국·토글·포노·데크·오류)는 전부 audio 엘리먼트를 거친다
    ["playing", "pause", "ended", "emptied"].forEach((name) =>
        audio.addEventListener(name, () => trayBroadcast()));

    window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || typeof data.type !== "string" || !data.type.startsWith("fmRadio:")) return;
        switch (data.type) {
            case "fmRadio:play":
                if (data.station) selectStation(data.station);
                else if (!isPlaying) togglePlay();
                break;
            case "fmRadio:pause":
                if (isPlaying) togglePlay();
                break;
            case "fmRadio:toggle":
                togglePlay();
                break;
            case "fmRadio:setStation":
                if (data.station) selectStation(data.station);
                break;
            case "fmRadio:setVolume":
                if (typeof data.value === "number") {
                    setVolumeLevel(data.value / 100);
                    saveJson("fmRadio.volume", volumeLevel);
                    trayBroadcast();
                }
                break;
            case "fmRadio:getState":
                trayBroadcast();
                break;
        }
    });

    trayBroadcast("fmRadio:ready");
})();

// ===== 편성표 & 예약 녹음 =====
// 편성 데이터는 schedule.js(FMSchedule)가 가져오고, 여기서는 표시와 예약을 다룬다.
// 예약 녹음은 실물 데크의 TIMER REC와 같은 규칙으로 동작한다 — 시각이 되면 자동 선국,
// 프로그램 길이에 맞는 공테이프를 장착해 REC, 종료 시각에 자동 정지.
// '전원(앱)이 켜져 있어야 작동한다'는 제약까지 실물 오디오 타이머 그대로다.

const schedOverlayEl = document.getElementById("schedOverlay");
const schedListEl = document.getElementById("schedList");
const schedChipsEl = document.getElementById("schedChips");
const schedResPane = document.getElementById("schedResPane");
const resListEl = document.getElementById("resList");
const btnResChip = document.getElementById("btnRes");
const nowProgramEl = document.getElementById("nowProgram");

function resSave() { saveJson("fmRadio.reservations", reservations); }

function ymdToDate(ymd) {
    return new Date(parseInt(ymd.slice(0, 4), 10), parseInt(ymd.slice(4, 6), 10) - 1, parseInt(ymd.slice(6, 8), 10));
}

function minutesNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

// 예약의 현재(진행 중 포함) 또는 다음 회차. once는 지정 날짜 고정,
// 반복 예약은 어제(자정 넘김 진행분)부터 일주일 안에서 endTs가 남아 있는 첫 회차.
function resOccurrence(res, nowTs) {
    const mk = (base) => ({
        startTs: base.getTime() + res.startMin * 60000,
        endTs: base.getTime() + res.endMin * 60000,
        ymd: FMSchedule.ymdOf(base)
    });
    if (res.repeat === "once") return mk(ymdToDate(res.ymd));
    for (let i = -1; i <= 7; i++) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        if (res.repeat === "weekly" && d.getDay() !== res.dow) continue;
        const occ = mk(d);
        if (occ.endTs > nowTs) return occ;
    }
    return null;
}

function resRepeatLabel(res) {
    if (res.repeat === "daily") return "매일";
    if (res.repeat === "weekly") return "매주 " + DOW_KO[res.dow];
    const d = ymdToDate(res.ymd);
    return (d.getMonth() + 1) + "/" + d.getDate() + " 한 번";
}

function ensureNotifyPermission() {
    try {
        if (window.Notification && Notification.permission === "default") Notification.requestPermission();
    } catch (e) {}
}

function notifyRes(title, body) {
    try {
        if (window.Notification && Notification.permission === "granted" && document.visibilityState !== "visible") {
            new Notification(title, { body, icon: "icons/icon-192.png" });
        }
    } catch (e) {}
}

// ----- 오버레이 -----

function openSchedule(view) {
    if (currentStation) schedState.stationId = currentStation.id;
    else if (!schedState.stationId) schedState.stationId = "kbs1fm";
    schedState.day = 0;
    schedOverlayEl.hidden = false;
    renderSchedChips();
    populateResForm();
    schedSetView(view === "res" ? "res" : "list");
    gtag('event', 'open_schedule', { station_id: schedState.stationId });
}

function closeSchedule() {
    schedOverlayEl.hidden = true;
}

function schedSetDay(day) {
    schedState.day = day;
    schedSetView("list");
}

function schedSetView(view) {
    schedState.view = view;
    schedListEl.hidden = view !== "list";
    schedChipsEl.hidden = view !== "list";
    schedResPane.hidden = view !== "res";
    if (view === "list") renderSched();
    else renderResList();
    updateSchedTabs();
}

function updateSchedTabs() {
    const d0 = document.getElementById("schedTabD0");
    if (!d0) return;
    d0.classList.toggle("active", schedState.view === "list" && schedState.day === 0);
    document.getElementById("schedTabD1").classList.toggle("active", schedState.view === "list" && schedState.day === 1);
    document.getElementById("schedTabRes").classList.toggle("active", schedState.view === "res");
    const n = reservations.filter((r) => r.enabled).length;
    const count = document.getElementById("schedResCount");
    count.hidden = !n;
    count.textContent = n ? String(n) : "";
}

function renderSchedChips() {
    schedChipsEl.innerHTML = "";
    stations.forEach((st) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sched-chip" + (st.id === schedState.stationId ? " active" : "") + (FMSchedule.supports(st.id) ? "" : " nosched");
        chip.style.setProperty("--chip-accent", st.color);
        chip.textContent = st.name;
        chip.title = FMSchedule.supports(st.id) ? st.name + " 편성표" : st.name + " — 편성 미지원 (직접 입력 예약)";
        chip.addEventListener("click", () => {
            schedState.stationId = st.id;
            renderSchedChips();
            renderSched();
        });
        schedChipsEl.appendChild(chip);
    });
}

function schedMsg(text, withResLink) {
    schedListEl.innerHTML = "";
    const div = document.createElement("div");
    div.className = "sched-msg";
    div.textContent = text;
    if (withResLink) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sp-rec";
        btn.style.marginLeft = "8px";
        btn.textContent = "● 직접 입력 예약";
        btn.addEventListener("click", () => {
            schedSetView("res");
            toggleResForm(true);
        });
        div.appendChild(document.createElement("br"));
        div.appendChild(btn);
    }
    schedListEl.appendChild(div);
}

// 이 프로그램에 걸린 예약을 찾는다 (once는 날짜까지, 반복은 요일 규칙으로 대조)
function findReservationFor(stationId, ymd, item) {
    const dow = ymdToDate(ymd).getDay();
    return reservations.find((r) => r.enabled && r.stationId === stationId && r.startMin === item.startMin
        && (r.repeat === "daily" || (r.repeat === "weekly" ? r.dow === dow : r.ymd === ymd)));
}

async function renderSched() {
    updateSchedTabs();
    const st = stations.find((s) => s.id === schedState.stationId);
    if (!st) return;
    if (!FMSchedule.supports(st.id)) {
        schedMsg(st.name + "은(는) 편성 정보를 제공하는 공개 소스가 없습니다. 시간을 직접 지정해 예약할 수 있어요.", true);
        return;
    }
    if (schedState.day === 1 && FMSchedule.todayOnly(st.id)) {
        schedMsg(st.name + "은(는) 오늘 편성만 제공됩니다.");
        return;
    }
    const mySeq = ++schedState.seq;
    schedMsg("편성표를 불러오는 중…");
    let data;
    try {
        data = await FMSchedule.getSchedule(st.id, schedState.day);
    } catch (error) {
        console.error(error);
        if (mySeq === schedState.seq) schedMsg("편성표를 불러오지 못했습니다 — 잠시 후 다시 시도해 주세요.");
        return;
    }
    if (mySeq !== schedState.seq) return;
    if (!data.items.length) {
        schedMsg("편성 정보가 없습니다.");
        return;
    }

    schedListEl.innerHTML = "";
    const isToday = schedState.day === 0;
    const nmin = minutesNow();
    let onairRow = null;

    data.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "sp-row";
        const past = isToday && item.endMin <= nmin;
        const onair = isToday && nmin >= item.startMin && nmin < item.endMin;
        if (past) row.classList.add("past");
        if (onair) { row.classList.add("onair"); onairRow = row; }

        const time = document.createElement("div");
        time.className = "sp-time";
        time.textContent = FMSchedule.fmtHM(item.startMin);

        const main = document.createElement("div");
        main.className = "sp-main";
        const title = document.createElement("div");
        title.className = "sp-title";
        title.textContent = item.title;
        main.appendChild(title);
        const subText = [FMSchedule.fmtHM(item.startMin) + "–" + FMSchedule.fmtHM(item.endMin), item.sub].filter(Boolean).join(" · ");
        const sub = document.createElement("div");
        sub.className = "sp-sub";
        sub.textContent = subText;
        main.appendChild(sub);

        row.append(time, main);

        if (onair) {
            const badge = document.createElement("span");
            badge.className = "sp-badge";
            badge.textContent = "ON AIR";
            row.appendChild(badge);
        }

        if (!past) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sp-rec";
            const existing = findReservationFor(st.id, data.ymd, item);
            if (existing) {
                row.classList.add("reserved");
                btn.classList.add("armed");
                // 이 회차가 지금 진행 중이면 '예약됨' 대신 실제 상태를 보여준다
                const mine = activeResRec && activeResRec.res.id === existing.id;
                if (mine && activeResRec.started && recorder) {
                    btn.classList.add("rec-live");
                    btn.textContent = "● 녹음 중 — 중단";
                    btn.title = "백그라운드에서 녹음하고 있습니다 — 누르면 중단하고 여기까지 저장합니다";
                    btn.addEventListener("click", () => {
                        removeReservation(existing.id);
                        renderSched();
                    });
                } else if (mine) {
                    // 발화됐지만 아직 시작 전 (선국·버퍼링, 또는 자동재생 차단 대기)
                    btn.classList.add("rec-live");
                    btn.textContent = "● 시작 대기 — 시동";
                    btn.title = "수신을 준비 중입니다 — 브라우저가 자동 시작을 막았다면 눌러서 바로 시작하세요";
                    btn.addEventListener("click", () => bgRecKick());
                } else {
                    btn.textContent = "● 예약됨";
                    btn.title = "누르면 예약을 취소합니다";
                    btn.addEventListener("click", () => {
                        removeReservation(existing.id);
                        renderSched();
                    });
                }
            } else {
                btn.textContent = onair ? "● 지금부터 녹음" : "● 예약";
                btn.title = onair ? "지금부터 프로그램 종료까지 녹음합니다" : "이 프로그램을 예약 녹음합니다";
                btn.addEventListener("click", () => {
                    addReservation({
                        stationId: st.id,
                        title: item.title,
                        startMin: item.startMin,
                        endMin: item.endMin,
                        repeat: "once",
                        ymd: data.ymd
                    });
                    renderSched();
                });
            }
            row.appendChild(btn);
        }

        schedListEl.appendChild(row);
    });

    if (onairRow) onairRow.scrollIntoView({ block: "center" });
}

// ----- 예약 관리 -----

function addReservation(data) {
    const res = {
        // 시간 기반 고유 ID — max+1 방식은 삭제 후 재생성 시 ID가 재사용되어,
        // localStorage의 발화 기록(취소=2)이 새 예약을 영원히 침묵시키는 버그가 있었다
        id: Math.max(Date.now(), reservations.reduce((a, r) => Math.max(a, r.id || 0), 0) + 1),
        stationId: data.stationId,
        title: data.title,
        startMin: data.startMin,
        endMin: data.endMin,
        repeat: data.repeat || "once",
        ymd: data.ymd,
        dow: ymdToDate(data.ymd).getDay(),
        enabled: true,
        createdAt: Date.now()
    };
    reservations.push(res);
    resSave();
    ensureNotifyPermission();
    renderResList();
    updateResChip();
    updateSchedTabs();
    const nowTs = Date.now();
    const occ = resOccurrence(res, nowTs);
    // 새 예약은 백지에서 시작한다 — 과거 ID 재사용으로 남았을 수 있는 발화 기록 제거
    if (occ && resFiredOcc[res.id + ":" + occ.ymd]) {
        delete resFiredOcc[res.id + ":" + occ.ymd];
        saveJson("fmRadio.resFired", resFiredOcc);
    }
    // '지금부터 녹음'인데 시작도 못 한 채 자리만 차지한 이전 회차(pending)가 있으면
    // 비켜 준다 — 사용자가 방금 명시적으로 누른 쪽이 우선이다
    if (occ && nowTs >= occ.startTs && activeResRec && !activeResRec.started && activeResRec.res.id !== res.id) {
        cancelReservedRecording("대기 중이던 예약을 내리고 새 녹음을 시작합니다 — " + res.title);
    }
    playerSubtext.textContent = occ && nowTs >= occ.startTs
        ? "지금부터 녹음합니다 — " + res.title
        : "예약되었습니다 — " + res.title + " (" + resRepeatLabel(res) + " " + FMSchedule.fmtHM(res.startMin) + "). 앱만 켜 두면 됩니다 — 편성표 창은 닫아도 돼요.";
    gtag('event', 'reserve_add', { station_id: res.stationId, repeat: res.repeat });
    reservationTick();
    return res;
}

function removeReservation(id) {
    if (activeResRec && activeResRec.res.id === id) {
        finishReservedRecording();
    }
    reservations = reservations.filter((r) => r.id !== id);
    resSave();
    renderResList();
    updateResChip();
    updateSchedTabs();
}

function toggleReservationEnabled(id) {
    const res = reservations.find((r) => r.id === id);
    if (!res) return;
    if (res.enabled && activeResRec && activeResRec.res.id === id) finishReservedRecording();
    res.enabled = !res.enabled;
    if (res.enabled) {
        res.missed = false;
        res.done = false;
        // 다시 켠 예약은 이번 회차를 새로 시도한다 — 과거 취소/완료 기록 제거
        const occNow = resOccurrence(res, Date.now());
        if (occNow && resFiredOcc[res.id + ":" + occNow.ymd]) {
            delete resFiredOcc[res.id + ":" + occNow.ymd];
            saveJson("fmRadio.resFired", resFiredOcc);
        }
        // 한 번 예약을 다시 켰는데 시각이 이미 지났다면 다음 날로 옮긴다
        if (res.repeat === "once") {
            const occ = resOccurrence(res, Date.now());
            if (occ && occ.endTs <= Date.now()) {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                if (res.startMin <= minutesNow()) d.setDate(d.getDate() + 1);
                res.ymd = FMSchedule.ymdOf(d);
                res.dow = d.getDay();
            }
        }
    }
    resSave();
    renderResList();
    updateResChip();
    updateSchedTabs();
}

function cycleReservationRepeat(id) {
    const res = reservations.find((r) => r.id === id);
    if (!res) return;
    res.repeat = res.repeat === "once" ? "daily" : res.repeat === "daily" ? "weekly" : "once";
    if (res.repeat === "weekly") res.dow = ymdToDate(res.ymd).getDay();
    resSave();
    renderResList();
}

function updateResDiag() {
    const ver = (document.getElementById("appVersion") || {}).textContent || "?";
    const parts = [ver];
    if (activeResRec) {
        parts.push(activeResRec.started ? "● 녹음 중" : (activeResRec.tuning ? "선국 중" : "시작 대기"));
        parts.push("「" + activeResRec.res.title + "」");
        if (bgRecPlayer) parts.push("수신 " + (bgRecPlayer.hls ? "hls" : "native") + (bgRecAudio && !bgRecAudio.paused ? "·재생" : "·정지"));
        if (recorder && bgRecCap.bytes) parts.push((bgRecCap.bytes / 1024).toFixed(0) + "KB 캡처");
        if (recorder && recorder.mimeType) parts.push(recorder.mimeType.split(";")[0]);
    } else {
        parts.push("진행 중 회차 없음");
    }
    const text = parts.join(" · ");
    const el = document.getElementById("resDiag");
    if (el) el.textContent = text;
    // 편성표 리스트 뷰 상단에도 — 회차가 살아 있을 때만 띄운다
    const sd = document.getElementById("schedDiag");
    if (sd) {
        sd.textContent = text;
        sd.hidden = !activeResRec;
        sd.classList.toggle("live", !!(activeResRec && activeResRec.started && recorder));
    }
}

function renderResList() {
    updateResDiag();
    resListEl.innerHTML = "";
    if (!reservations.length) {
        const empty = document.createElement("div");
        empty.className = "res-empty";
        empty.textContent = "예약이 없습니다 — 편성표에서 ● 예약을 누르거나 아래에서 직접 추가하세요.";
        resListEl.appendChild(empty);
        return;
    }
    const sorted = reservations.slice().sort((a, b) => {
        const oa = resOccurrence(a, Date.now());
        const ob = resOccurrence(b, Date.now());
        return (oa ? oa.startTs : Infinity) - (ob ? ob.startTs : Infinity);
    });
    sorted.forEach((res) => {
        const st = stations.find((s) => s.id === res.stationId);
        const row = document.createElement("div");
        row.className = "res-row" + (res.enabled ? "" : " off") + (res.missed ? " missed" : "");

        const main = document.createElement("div");
        main.className = "res-main";
        const title = document.createElement("div");
        title.className = "res-title";
        title.textContent = res.title;
        const meta = document.createElement("div");
        meta.className = "res-meta";
        const state = activeResRec && activeResRec.res.id === res.id && activeResRec.started ? "녹음 중"
            : res.missed ? "놓침 — 앱이 꺼져 있었어요"
            : res.done ? "완료"
            : res.enabled ? "" : "꺼짐";
        meta.textContent = [(st ? st.name : res.stationId),
            FMSchedule.fmtHM(res.startMin) + "–" + FMSchedule.fmtHM(res.endMin),
            resRepeatLabel(res), state].filter(Boolean).join(" · ");
        main.append(title, meta);

        const btnRepeat = document.createElement("button");
        btnRepeat.type = "button";
        btnRepeat.className = "res-btn";
        btnRepeat.textContent = resRepeatLabel(res);
        btnRepeat.title = "반복 방식 바꾸기 (한 번 → 매일 → 매주)";
        btnRepeat.addEventListener("click", () => cycleReservationRepeat(res.id));

        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.className = "res-btn";
        btnToggle.textContent = res.enabled ? "끄기" : "켜기";
        btnToggle.title = res.enabled
            ? "예약을 지우지 않고 잠시 쉬게 합니다 — 매일·매주 반복 예약을 이번엔 건너뛸 때"
            : "쉬고 있는 예약을 다시 켭니다";
        btnToggle.addEventListener("click", () => toggleReservationEnabled(res.id));

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "res-btn";
        btnDel.textContent = "삭제";
        btnDel.addEventListener("click", () => removeReservation(res.id));

        row.append(main, btnRepeat, btnToggle, btnDel);
        resListEl.appendChild(row);
    });
}

// 직접 입력 폼은 평소 접어 둔다 — 예약 목록 옆에 늘 펼쳐져 있으면
// 폼의 기본 시간이 선택된 예약의 녹음 시간처럼 잘못 읽힌다
function toggleResForm(show) {
    const form = document.getElementById("resForm");
    const open = show != null ? show : form.hidden;
    form.hidden = !open;
    document.getElementById("resFormToggle").textContent = open ? "－ 직접 입력 접기" : "＋ 직접 입력 예약";
    if (open) {
        // 기본값: 다음 정시부터 1시간
        const startH = (new Date().getHours() + 1) % 24;
        document.getElementById("resFormStart").value = String(startH).padStart(2, "0") + ":00";
        document.getElementById("resFormEnd").value = String((startH + 1) % 24).padStart(2, "0") + ":00";
    }
}

function populateResForm() {
    if (resFormReady) return;
    resFormReady = true;
    const select = document.getElementById("resFormStation");
    stations.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st.id;
        opt.textContent = st.name + (FMSchedule.supports(st.id) ? "" : " (편성 미지원)");
        select.appendChild(opt);
    });
    document.getElementById("resForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const stId = select.value;
        const st = stations.find((s) => s.id === stId);
        const startMin = (document.getElementById("resFormStart").value || "20:00").split(":").reduce((h, m) => h * 60 + +m, 0) * 1;
        let endMin = (document.getElementById("resFormEnd").value || "22:00").split(":").reduce((h, m) => h * 60 + +m, 0) * 1;
        if (endMin <= startMin) endMin += 1440;   // 자정 넘김
        const repeat = document.getElementById("resFormRepeat").value;
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        if (repeat === "once" && startMin <= minutesNow()) d.setDate(d.getDate() + 1);
        addReservation({
            stationId: stId,
            title: st.name + " " + FMSchedule.fmtHM(startMin) + " 예약",
            startMin, endMin, repeat,
            ymd: FMSchedule.ymdOf(d)
        });
        toggleResForm(false);
    });
}

function updateResChip() {
    updateRecButton();
    const n = reservations.filter((r) => r.enabled).length;
    const recording = activeResRec && activeResRec.started && recorder;
    btnResChip.hidden = !n && !recording;
    document.getElementById("resChipLabel").textContent = recording ? "예약 녹음 중" : "예약 " + n;
    btnResChip.classList.toggle("armed", n > 0 || !!recording);
}

// ----- 예약 실행 엔진 -----

function pruneFired() {
    const limit = FMSchedule.ymdOf(new Date(Date.now() - 3 * 86400000));
    Object.keys(resFiredOcc).forEach((key) => {
        const ymd = key.split(":")[1];
        if (!ymd || ymd < limit) delete resFiredOcc[key];
    });
}

function fireReservation(res, occ, key) {
    resFiredOcc[key] = 1;
    pruneFired();
    saveJson("fmRadio.resFired", resFiredOcc);
    activeResRec = { res, occ, key, endTs: occ.endTs, tapeId: null, started: false };
    playerSubtext.textContent = "예약 녹음을 시작합니다 — 지금 재생과는 별개로 백그라운드에서 녹음됩니다: " + res.title;
    notifyRes("예약 녹음 시작", res.title);
    gtag('event', 'reserve_fire', { station_id: res.stationId });
    updateResChip();
    serviceReservationRecording(Date.now());
}

// 예약 회차 전용 테이프 준비 — 프로그램 길이에 맞는 규격(C-30/60/90/120…)의 새 공테이프를 장착.
// 스트림이 끊겨 녹음이 재시작되면 같은 테이프에 이어 붙인다.
function prepareReservedTape(active) {
    if (isDoubleDeck()) {
        // B웰 전용 — A웰(재생)은 그대로 둔다. 스트림이 끊겨 재시작하면 같은 테이프에 이어 붙인다.
        if (active.tapeId) {
            const t = tapes.find((x) => x.id === active.tapeId);
            if (t && tapeUsedSec(t) < tapeLenOf(t) - 5) {
                deckBTape = t;
                deckBPos = Math.min(tapeUsedSec(t), tapeLenOf(t) - 1);
                deckRefreshShelf();
                return;
            }
        }
        const remainSec = Math.ceil((active.endTs - Date.now()) / 1000) + 60;
        const len = [1800, 3600, 5400, 7200].find((sz) => sz >= remainSec) || Math.ceil(remainSec / 1800) * 1800;
        deckBTape = newBlankTape(len);
        deckBPos = 0;
        active.tapeId = deckBTape.id;
        deckRefreshShelf();
        return;
    }
    if (active.tapeId) {
        if (deckTape && deckTape.id === active.tapeId) return;
        const t = tapes.find((x) => x.id === active.tapeId);
        if (t && tapeUsedSec(t) < tapeLenOf(t) - 5) {
            if (deckTape) deckTape.pos = tapePos;
            deckTape = t;
            tapePos = Math.min(tapeUsedSec(t), tapeLenOf(t) - 1);
            deckRefreshShelf();
            return;
        }
    }
    const remainSec = Math.ceil((active.endTs - Date.now()) / 1000) + 60;
    const len = [1800, 3600, 5400, 7200].find((s) => s >= remainSec) || Math.ceil(remainSec / 1800) * 1800;
    if (deckTape) deckTape.pos = tapePos;
    deckTape = newBlankTape(len);
    tapePos = 0;
    active.tapeId = deckTape.id;
    deckRefreshShelf();
}

// ----- 예약 전용 백그라운드 수신기 -----
// 본체 <audio>(청취)와 분리된 히든 수신 체인. 스피커에 연결하지 않으므로
// 현재 재생(라디오·음반·테이프)과 무관하게 무음으로 녹음된다.
function bgRecStop() {
    if (bgRecPlayer) {
        bgRecPlayer.destroy();
        bgRecPlayer = null;
    }
    if (bgRecAudio) {
        bgRecAudio.pause();
        bgRecAudio.removeAttribute("src");
        try { bgRecAudio.load(); } catch (e) {}
    }
}

function bgRecReady() {
    return !!(bgRecAudio && !bgRecAudio.paused && bgRecAudio.readyState >= 2
        && bgRecPlayer && bgRecPlayer.hls);
}

// 자동재생 차단 대응 — 페이지를 새로 연 뒤 조작이 없으면 백그라운드 수신기의
// play()가 거부될 수 있다. 사용자 제스처(탭·클릭) 안에서 다시 시동을 건다.
let bgRecGestureArmed = false;

function bgRecKick() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (bgRecCtx && bgRecCtx.state === "suspended") bgRecCtx.resume();
    if (bgRecAudio && bgRecAudio.paused && bgRecPlayer) bgRecAudio.play().catch(() => {});
    serviceReservationRecording(Date.now());
}

function bgRecArmGestureRetry() {
    if (bgRecGestureArmed) return;
    bgRecGestureArmed = true;
    document.addEventListener("pointerdown", () => {
        bgRecGestureArmed = false;
        bgRecKick();
    }, { once: true, capture: true });
}

// 백그라운드 수신 엘리먼트 — 녹음은 오디오 스택이 아니라 스트림 바이트 캡처로 하므로
// WebAudio 없이도 성립한다. Safari 계열은 탭이 어차피 무음(WebKit 제약)이니
// 뮤트로 돌린다 — 뮤트 재생은 자동재생 정책도 통과해 제스처 없이 시작된다.
function ensureBgRecElement() {
    if (bgRecAudio) return true;
    bgRecAudio = document.createElement("audio");
    bgRecAudio.crossOrigin = "anonymous";
    bgRecAudio.preload = "auto";
    if (SAFARI_LIKE) bgRecAudio.muted = true;
    // VU 레벨용 탭 — 실패해도(또는 WebKit처럼 무음이어도) 녹음에는 지장 없다
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx && !SAFARI_LIKE) {
            bgRecCtx = new Ctx();
            bgRecSource = bgRecCtx.createMediaElementSource(bgRecAudio);
            bgRecDest = bgRecCtx.createMediaStreamDestination();
            bgRecAnalyser = bgRecCtx.createAnalyser();
            bgRecAnalyser.fftSize = 512;
            bgRecSource.connect(bgRecDest);
            bgRecSource.connect(bgRecAnalyser);
        }
    } catch (error) {
        console.warn("VU 탭 생성 실패 (녹음은 계속):", error);
        bgRecCtx = null;
        bgRecSource = null;
        bgRecDest = null;
        bgRecAnalyser = null;
    }
    return true;
}

// hls.js가 미디어 버퍼에 붙이는 오디오 바이트를 그대로 캡처한다.
// fMP4(init: 'ftyp' 박스)면 audio/mp4, 아니면 MP3 패스스루(audio/mpeg).
function bgRecOnChunk(event, data) {
    if (!data || data.type !== "audio" || !data.data) return;
    const src = data.data instanceof Uint8Array ? data.data : new Uint8Array(data.data);
    const bytes = src.slice();   // hls.js가 버퍼를 재사용하므로 복사 필수
    const isInit = bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
    if (isInit) {
        bgRecCap.init = bytes;
        bgRecCap.mime = "audio/mp4";
        if (bgRecCap.active) { bgRecCap.chunks.push(bytes); bgRecCap.bytes += bytes.length; }
        return;
    }
    if (!bgRecCap.mime) bgRecCap.mime = "audio/mpeg";
    if (bgRecCap.active) {
        bgRecCap.chunks.push(bytes);
        bgRecCap.bytes += bytes.length;
    }
    // 롤링 프리버퍼 — hls는 재생보다 앞서 버퍼를 붙여 두므로, 녹음 시작 시점에는
    // 새 청크가 한동안 안 올 수 있다. 최근 청크를 보관했다가 시작 시 시드한다.
    bgRecCap.rolling.push({ t: Date.now(), bytes });
    let rollBytes = 0;
    for (const c of bgRecCap.rolling) rollBytes += c.bytes.length;
    while (bgRecCap.rolling.length > 1 && rollBytes > 4 * 1024 * 1024) {
        rollBytes -= bgRecCap.rolling.shift().bytes.length;
    }
}

function bgCapStart() {
    bgRecCap.chunks = [];
    bgRecCap.bytes = 0;
    if (bgRecCap.init) {
        bgRecCap.chunks.push(bgRecCap.init);
        bgRecCap.bytes += bgRecCap.init.length;
    }
    // 이미 버퍼에 붙어 있던 직전 구간(≤8초 전 수신분)을 시드 — 첫 초 누락 방지
    const cutoff = Date.now() - 8000;
    bgRecCap.rolling.forEach((c) => {
        if (c.t >= cutoff) {
            bgRecCap.chunks.push(c.bytes);
            bgRecCap.bytes += c.bytes.length;
        }
    });
    bgRecCap.active = true;
}

function bgCapStop() {
    bgRecCap.active = false;
    const blob = new Blob(bgRecCap.chunks, { type: bgRecCap.mime || "audio/mp4" });
    bgRecCap.chunks = [];
    bgRecCap.bytes = 0;
    return blob;
}

async function bgRecTune(station) {
    ensureBgRecElement();
    if (bgRecCtx && bgRecCtx.state === "suspended") bgRecCtx.resume();
    const url = await getStreamUrl(station);
    bgRecStop();
    bgRecCap.init = null;
    bgRecCap.mime = "";
    bgRecPlayer = PlayerCore.attach(bgRecAudio, url, {
        onBlocked: bgRecArmGestureRetry,   // 자동재생 차단 — 다음 제스처에서 재시동
        onFatal: () => bgRecStop()         // 다음 재시도 주기가 다시 튠한다
    });
    if (bgRecPlayer && bgRecPlayer.hls) {
        bgRecPlayer.hls.on(Hls.Events.BUFFER_APPENDING, bgRecOnChunk);
    }
    try { await bgRecAudio.play(); } catch (e) { bgRecArmGestureRetry(); }
}

// 매 틱: 예약 녹음을 굴린다. 백그라운드 수신기를 튠하고, 스트림이 열리면 REC.
// 데크가 재생·감기 중이면 점유하지 않고 기다린다 (정지하면 다음 재시도에 시작).
function serviceReservationRecording(nowTs) {
    updateResDiag();
    if (!activeResRec) return;
    if (nowTs >= activeResRec.endTs) {
        finishReservedRecording();
        return;
    }
    if (recorder) return;
    const res = activeResRec.res;
    if (!isDoubleDeck() && (deckMode === "play" || deckMode === "wind")) {
        if (!activeResRec.deckBusyWarned) {
            activeResRec.deckBusyWarned = true;
            playerSubtext.textContent = "예약 녹음 대기 — 데크가 사용 중입니다. 정지(\u25a0)하면 시작됩니다: " + res.title;
        }
        return;
    }
    if (bgRecPlayer && !bgRecPlayer.hls && !activeResRec.noCapWarned) {
        // 구형 iOS 등 MSE가 없어 네이티브 HLS로 떨어진 경우 — 바이트 캡처가 불가능하다
        activeResRec.noCapWarned = true;
        playerSubtext.textContent = "이 브라우저에서는 백그라운드 녹음을 지원하지 않습니다 (스트림 캡처 불가).";
    }
    if (bgRecReady()) {
        prepareReservedTape(activeResRec);
        pendingRecName = res.title;
        toggleRecording({ source: "bg" });
        if (recorder) {
            activeResRec.started = true;
            // 본체가 놀고 있으면 튜너 다이얼도 예약 채널을 가리킨다 — 수신기는 튜너다
            const st = stations.find((s) => s.id === res.stationId);
            if (st && !isPlaying && !currentStation) tunerSetStation(st);
            updateResChip();
            // 편성표가 열려 있으면 '녹음 중' 상태가 바로 보이게 갱신
            if (!schedOverlayEl.hidden) schedSetView(schedState.view);
        }
        return;
    }
    // 죽은 어태치 감지 — 수신기가 붙었는데 바이트가 전혀 흐르지 않으면(스로틀된 WebKit에서
    // 간헐 발생) 15초를 기다리지 말고 6초 만에 재튠한다. 짧은 예약 회차도 살릴 수 있다.
    const bgStuck = bgRecPlayer && bgRecAudio && bgRecCap.bytes === 0 && !bgRecCap.rolling.length
        && bgRecAudio.currentTime < 0.3;
    const retuneAfterMs = bgStuck ? 6000 : 15000;
    if (!activeResRec.tuning && (!bgRecPlayer || nowTs - (activeResRec.tunedAt || 0) > retuneAfterMs)) {
        activeResRec.tuning = true;
        activeResRec.tunedAt = nowTs;
        // 주의: 재시도는 반드시 매크로태스크(setTimeout)로 — .finally에서 곧바로 재귀하면
        // 동기 반환 경로에서 마이크로태스크 무한 루프가 되어 UI 전체가 얼어붙는다.
        const st = stations.find((s) => s.id === res.stationId);
        Promise.resolve(st ? bgRecTune(st) : null).catch((e) => console.warn("예약 튠 실패, 재시도 예정:", e)).finally(() => {
            if (!activeResRec) return;
            activeResRec.tuning = false;
            setTimeout(() => serviceReservationRecording(Date.now()), 800);
        });
        return;
    }
    // 튠은 걸려 있고 스트림이 열리길 기다린다 — 완만한 매크로태스크 재시도
    if (!activeResRec.tuning && (!activeResRec.nudgeAt || nowTs - activeResRec.nudgeAt > 700)) {
        activeResRec.nudgeAt = nowTs;
        setTimeout(() => serviceReservationRecording(Date.now()), 800);
    }
}

function finishReservedRecording() {
    const done = activeResRec;
    activeResRec = null;
    if (recorder) stopRecording();
    bgRecStop();
    if (!done) return;
    resFiredOcc[done.key] = 3;
    saveJson("fmRadio.resFired", resFiredOcc);
    const res = done.res;
    if (res.repeat === "once") {
        res.enabled = false;
        res.done = true;
        resSave();
    }
    if (!done.started && done.deckBusyWarned) {
        playerSubtext.textContent = "예약 시간이 끝나 녹음하지 못했습니다 — 데크가 계속 사용 중이었어요: " + res.title;
    }
    if (done.started) {
        // 녹음된 카세트는 되감아 테이프 랙에 보관한다 — 랙에서 누르면 장착되고, PLAY로 바로 재생
        const tape = done.tapeId ? tapes.find((t) => t.id === done.tapeId) : null;
        if (tape) {
            tape.pos = 0;
            if (deckTape === tape) {
                deckTape = newBlankTape();
                tapePos = 0;
            }
            deckRefreshShelf();
        }
        recSavedMsgOverride = "예약 녹음 완료 — 카세트 「" + res.title + "」를 되감아 테이프 랙에 보관했습니다. 데크 TAPE RACK에서 눌러 장착한 뒤 PLAY를 누르세요.";
        playerSubtext.textContent = recSavedMsgOverride;
        notifyRes("예약 녹음 완료", res.title + " — 카세트가 테이프 랙에 보관되었습니다.");
        gtag('event', 'reserve_done', { station_id: res.stationId });
    }
    renderResList();
    updateResChip();
    updateSchedTabs();
    if (!schedOverlayEl.hidden && schedState.view === "list") renderSched();
}

// 사용자가 손으로 REC/STOP을 눌러 멈춘 경우 — 이 회차는 다시 살리지 않는다
function cancelReservedRecording(msg) {
    if (!activeResRec) return;
    const res = activeResRec.res;
    resFiredOcc[activeResRec.key] = 2;
    saveJson("fmRadio.resFired", resFiredOcc);
    activeResRec = null;
    bgRecStop();
    if (res.repeat === "once") {
        res.enabled = false;
        res.done = true;
        resSave();
    }
    if (msg) playerSubtext.textContent = msg;
    renderResList();
    updateResChip();
    updateSchedTabs();
    if (!schedOverlayEl.hidden && schedState.view === "list") renderSched();
}

function reservationTick() {
    const nowTs = Date.now();
    serviceReservationRecording(nowTs);
    let changed = false;
    let missedFound = false;
    reservations.forEach((res) => {
        if (!res.enabled) return;
        const occ = resOccurrence(res, nowTs);
        if (!occ) return;
        const key = res.id + ":" + occ.ymd;
        // 한 번 예약의 시간이 통째로 지나갔다 — 앱이 꺼져 있었던 것
        if (res.repeat === "once" && occ.endTs <= nowTs) {
            res.enabled = false;
            if (!res.done && !resFiredOcc[key]) {
                res.missed = true;
                missedFound = true;
            }
            changed = true;
            return;
        }
        if (nowTs >= occ.startTs && nowTs < occ.endTs - 5000) {
            const mark = resFiredOcc[key];
            if (!activeResRec && (!mark || mark === 1 || mark === true)) fireReservation(res, occ, key);
        } else if (occ.startTs > nowTs && occ.startTs - nowTs <= 300000 && !resAlerted[key]) {
            resAlerted[key] = true;
            playerSubtext.textContent = "5분 뒤 예약 녹음이 시작됩니다 — " + res.title;
            notifyRes("예약 녹음 예정", res.title + " — 5분 뒤 시작됩니다. 앱을 켜 두세요.");
        }
    });
    if (changed) {
        resSave();
        renderResList();
        updateResChip();
        updateSchedTabs();
    }
    if (missedFound) {
        playerSubtext.textContent = "놓친 예약 녹음이 있습니다 — 편성표의 예약 탭에서 확인하세요.";
    }
}

// ----- 현재 프로그램 표시 (Now Playing 아래 한 줄) -----

async function updateNowProgram() {
    if (!currentStation || !FMSchedule.supports(currentStation.id)) {
        nowProgramEl.hidden = true;
        return;
    }
    const stId = currentStation.id;
    try {
        const data = await FMSchedule.getSchedule(stId, 0);
        if (!currentStation || currentStation.id !== stId) return;
        const prog = FMSchedule.programAt(data.items, minutesNow());
        if (prog) {
            nowProgramEl.textContent = "▤ " + prog.title + " · ~" + FMSchedule.fmtHM(prog.endMin);
            nowProgramEl.hidden = false;
        } else {
            nowProgramEl.hidden = true;
        }
    } catch (error) {
        nowProgramEl.hidden = true;
    }
}

schedOverlayEl.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSchedule();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !schedOverlayEl.hidden) closeSchedule();
});

setInterval(reservationTick, 10000);
setInterval(updateNowProgram, 30000);
updateResChip();
reservationTick();
updateNowProgram();
