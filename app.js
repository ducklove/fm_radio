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
    const el = document.documentElement;
    try {
        if (on && !document.fullscreenElement) {
            (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
        } else if (!on && document.fullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
        }
    } catch (e) {}
    gtag('event', 'focus_mode', { on: on });
}

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
    // 녹음은 카세트 데크 전담 — 튜너의 REC 계열 스위치는 녹음 상태 표시등으로만 남는다
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
    black: { top: "#1b1b1f", mid: "#121215", bot: "#0b0b0d", ear: "#101013", fieldA: "#0e0e11", fieldB: "#141419", edge: "#3c3c44", ink: "#f0f0f2", sub: "#8a8a94", slot: "#050506", cap: "#26262c", capTop: "#3c3c44", mark: "#f2f2f4", ledOff: "#16221c" },
    silver: { top: "#f2f1ec", mid: "#c8c8c5", bot: "#85878a", ear: "#a5a7a8", fieldA: "#484b4e", fieldB: "#56595c", edge: "#6d7073", ink: "#202225", sub: "#4f5255", slot: "#1b1d1f", cap: "#bfc1c2", capTop: "#f4f4f1", mark: "#2c2e31", ledOff: "#213129" },
    chrome: { top: "#fff8e6", mid: "#b9a475", bot: "#655638", ear: "#756342", fieldA: "#191712", fieldB: "#252117", edge: "#efdfb5", ink: "#2a2418", sub: "#5a4d34", slot: "#0a0805", cap: "#d9c596", capTop: "#fff4d3", mark: "#514321", ledOff: "#29261b" }
};
const EQ_MODELS = {
    ge5: { pill: "GE-5 · 5밴드", name: "GE-5", theme: "black", q: 1.0, capW: 60,
        freqs: [60, 250, 1000, 4000, 12000],
        labels: ["60", "250", "1k", "4k", "12k"],
        xs: [800, 1030, 1260, 1490, 1720] },
    ge10: { pill: "GE-10 · 10밴드", name: "GE-10", theme: "black", q: 1.4, capW: 44,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] },
    ge10silver: { pill: "SILVER · 10밴드", name: "GE-10S", theme: "silver", q: 1.4, capW: 44,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] },
    ge10chrome: { pill: "CHAMPAGNE · 10밴드", name: "GE-10C", theme: "chrome", q: 1.4, capW: 44,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] }
};
const EQ_ORDER = ["ge5", "ge10", "ge10silver", "ge10chrome"];
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

function saveEq() {
    saveJson("fmRadio.eq", { on: eqState.on, model: eqModelId, gains: eqState.gains });
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

function applyUnitVisibility() {
    Object.entries(UNIT_STAGES).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.hidden = !unitShow[key];
    });
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
    // 필드 배경: dB 그리드 라인
    let grid = "";
    [-12, -9, -6, -3, 0, 3, 6, 9, 12].forEach((g) => {
        const y = eqGainToY(g);
        grid += '<line x1="700" y1="' + y + '" x2="1900" y2="' + y + '" stroke="' + theme.edge + '" stroke-width="' + (g === 0 ? 2 : 0.8) + '" opacity="' + (g === 0 ? 0.9 : 0.5) + '"/>';
    });
    const hw = EQ_CAPW / 2;
    const hitHw = Math.min(58, Math.floor((EQ_X[1] - EQ_X[0]) / 2) - 3);
    const sliders = EQ_FREQS.map((f, i) => {
        const x = EQ_X[i];
        const spectrum = Array.from({ length: 8 }, (_, j) => {
            const on = j >= 6 ? "#f05a3a" : j >= 4 ? "#e4b33f" : "#54d18a";
            return '<rect id="eqBandLvl' + i + '_' + j + '" data-on="' + on + '" data-off="' + theme.ledOff + '" x="' + (x + hw + 8) + '" y="' + (292 - j * 23) + '" width="7" height="15" rx="2" fill="' + theme.ledOff + '"/>';
        }).join("");
        return '<rect x="' + (x - 5) + '" y="' + (EQ_TOP - 8) + '" width="10" height="' + (EQ_BOT - EQ_TOP + 16) + '" rx="5" fill="' + theme.slot + '" stroke="' + theme.edge + '" stroke-width="1.2"/>' +
            '<rect x="' + (x - 5) + '" y="' + (EQ_TOP - 8) + '" width="10" height="14" rx="5" fill="#000000" opacity="0.6"/>' +
            spectrum +
            '<g id="eqH' + i + '">' +
            '<rect x="' + (x - hw + 2) + '" y="-11" width="' + EQ_CAPW + '" height="30" rx="4" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>' +
            '<rect x="' + (x - hw) + '" y="-15" width="' + EQ_CAPW + '" height="30" rx="4" fill="' + (chrome ? 'url(#eqChromeCap)' : theme.cap) + '" stroke="#0a0a0c" stroke-width="1.5"/>' +
            '<rect x="' + (x - hw) + '" y="-15" width="' + EQ_CAPW + '" height="6" rx="3" fill="' + theme.capTop + '"/>' +
            '<rect x="' + (x - hw) + '" y="-2.5" width="' + EQ_CAPW + '" height="5" fill="' + theme.mark + '"/>' +
            '</g>' +
            '<text id="eqV' + i + '" x="' + x + '" y="78" font-family="Arial" font-size="13" font-weight="700" fill="' + theme.sub + '" text-anchor="middle">0</text>' +
            '<text x="' + x + '" y="354" font-family="Arial" font-size="14" font-weight="600" letter-spacing="0.5" fill="' + theme.sub + '" text-anchor="middle">' + EQ_LABELS[i] + '</text>' +
            '<rect id="eqHit' + i + '" x="' + (x - hitHw) + '" y="66" width="' + (hitHw * 2) + '" height="300" fill="#000" fill-opacity="0" style="cursor:ns-resize;touch-action:none" tabindex="0" role="slider" aria-label="' + EQ_LABELS[i] + 'Hz 게인" aria-valuemin="-12" aria-valuemax="12"><title>' + EQ_LABELS[i] + 'Hz &#177;12dB</title></rect>';
    }).join("");
    let lvl = "";
    for (let i = 0; i < 12; i++) {
        lvl += '<rect id="eqLvl' + i + '" x="530" y="' + (300 - i * 19) + '" width="46" height="12" rx="2" fill="#33251a"/>';
    }
    document.getElementById("eqStage").innerHTML =
        '<svg class="eq-svg" viewBox="0 0 2000 400" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="YAMAHA ' + model.name + ' 스테레오 그래픽 이퀄라이저">' +
        '<defs>' +
        '<linearGradient id="eqPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + theme.top + '"/><stop offset="0.5" stop-color="' + theme.mid + '"/><stop offset="1" stop-color="' + theme.bot + '"/></linearGradient>' +
        (chrome ? '<linearGradient id="eqChromeBands" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9e8"/><stop offset=".08" stop-color="#c5b184"/><stop offset=".18" stop-color="#f2e4c2"/><stop offset=".34" stop-color="#bda978"/><stop offset=".48" stop-color="#f8edcf"/><stop offset=".62" stop-color="#958155"/><stop offset=".76" stop-color="#ddc99f"/><stop offset=".9" stop-color="#aa976d"/><stop offset="1" stop-color="#67583a"/></linearGradient><linearGradient id="eqChromeSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e7c986" stop-opacity=".1"/><stop offset=".18" stop-color="#fff8e3" stop-opacity="0"/><stop offset=".46" stop-color="#fff5d8" stop-opacity=".24"/><stop offset=".49" stop-color="#fffdf2" stop-opacity=".52"/><stop offset=".52" stop-color="#d7bb78" stop-opacity=".08"/><stop offset=".82" stop-color="#bfa464" stop-opacity="0"/><stop offset="1" stop-color="#dbc07d" stop-opacity=".14"/></linearGradient><linearGradient id="eqChromeCap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#786641"/><stop offset=".18" stop-color="#fff2c9"/><stop offset=".42" stop-color="#bda774"/><stop offset=".68" stop-color="#f4e4bd"/><stop offset="1" stop-color="#665536"/></linearGradient>' : '') +
        '<pattern id="eqRidge" width="14" height="8" patternUnits="userSpaceOnUse"><rect width="7" height="8" fill="' + theme.fieldA + '"/><rect x="7" width="7" height="8" fill="' + theme.fieldB + '"/></pattern>' +
        '</defs>' +
        '<rect width="2000" height="400" rx="8" fill="' + (chrome ? 'url(#eqChromeBands)' : 'url(#eqPanel)') + '"/>' +
        (chrome ? '<rect x="45" y="8" width="1910" height="380" rx="7" fill="url(#eqChromeSweep)"/><rect x="52" y="14" width="1896" height="368" rx="6" fill="none" stroke="#f2dfad" stroke-width="3" opacity=".72"/><path d="M58 24 H1942 M58 376 H1942" stroke="#fff8df" stroke-width="2" opacity=".58"/>' : '') +
        '<rect width="2000" height="6" fill="#ffffff" opacity="0.06"/>' +
        '<rect y="388" width="2000" height="12" fill="#000" opacity="0.4"/>' +
        // 랙 이어
        '<rect x="0" y="0" width="44" height="400" rx="8" fill="' + theme.ear + '"/><circle cx="22" cy="52" r="9" fill="#26262c" stroke="' + theme.edge + '"/><circle cx="22" cy="348" r="9" fill="#26262c" stroke="' + theme.edge + '"/>' +
        '<rect x="1956" y="0" width="44" height="400" rx="8" fill="' + theme.ear + '"/><circle cx="1978" cy="52" r="9" fill="#26262c" stroke="' + theme.edge + '"/><circle cx="1978" cy="348" r="9" fill="#26262c" stroke="' + theme.edge + '"/>' +
        // 좌측 컨트롤 블록
        '<text x="90" y="96" font-family="Arial" font-size="30" font-weight="700" letter-spacing="1.5" fill="' + theme.ink + '">YAMAHA</text>' +
        '<text x="90" y="126" font-family="Arial" font-size="14" letter-spacing="1.5" fill="' + theme.sub + '">Stereo Graphic Equalizer ' + model.name + '</text>' +
        (chrome ? '<rect x="88" y="142" width="244" height="30" rx="15" fill="#54472f" stroke="#ead8a8"/><text x="210" y="162" font-family="Arial" font-size="11" font-weight="700" letter-spacing="2" fill="#fff1c9" text-anchor="middle">CHAMPAGNE GOLD</text>' : '') +
        '<text x="92" y="196" font-family="Arial" font-size="11" letter-spacing="1" fill="#8a8a94">power</text>' +
        '<rect x="90" y="206" width="34" height="64" rx="3" fill="#e8e8ec" stroke="#0a0a0c" stroke-width="1.5"/>' +
        '<text x="92" y="304" font-family="Arial" font-size="11" letter-spacing="1" fill="#8a8a94">tape monitor</text>' +
        '<rect x="90" y="314" width="34" height="40" rx="3" fill="#3c3c44" stroke="#0a0a0c"/>' +
        '<circle id="eqLed" cx="206" cy="216" r="6" fill="#3a2012"/>' +
        '<text x="222" y="221" font-family="Arial" font-size="11" letter-spacing="1" fill="#8a8a94">EQ on</text>' +
        '<rect id="eqDefeatBtn" x="200" y="234" width="96" height="44" rx="4" fill="#26262c" stroke="#3c3c44" style="cursor:pointer" tabindex="0" role="button" aria-label="EQ 켜기/끄기"><title>EQ 켜기/끄기 (DEFEAT)</title></rect>' +
        '<rect x="206" y="240" width="84" height="10" rx="2" fill="#3c3c44" pointer-events="none"/>' +
        '<text x="248" y="268" font-family="Arial" font-size="13" font-weight="700" letter-spacing="1.5" fill="#d8d8dc" text-anchor="middle" pointer-events="none">DEFEAT</text>' +
        // 레벨 LED 컬럼
        '<text x="553" y="78" font-family="Arial" font-size="11" letter-spacing="1.5" fill="#8a8a94" text-anchor="middle">level</text>' +
        '<text x="512" y="98" font-family="Arial" font-size="10" fill="#5a5a62" text-anchor="end">+dB</text>' +
        '<text x="512" y="310" font-family="Arial" font-size="10" fill="#5a5a62" text-anchor="end">-dB</text>' +
        lvl +
        // 슬라이더 필드
        '<rect x="680" y="60" width="1240" height="310" rx="6" fill="url(#eqRidge)" stroke="' + theme.edge + '" stroke-width="1.5"/>' +
        grid +
        '<text x="694" y="' + (EQ_TOP + 5) + '" font-family="Arial" font-size="12" fill="#8a8a94">+12</text>' +
        '<text x="694" y="' + (eqGainToY(0) + 4) + '" font-family="Arial" font-size="12" fill="#8a8a94">0</text>' +
        '<text x="694" y="' + (EQ_BOT + 5) + '" font-family="Arial" font-size="12" fill="#8a8a94">-12</text>' +
        sliders + '<text x="1900" y="82" font-family="Arial" font-size="10" letter-spacing="1.5" fill="' + theme.sub + '" text-anchor="end">REAL-TIME SPECTRUM</text>' +
        '<text x="1900" y="354" font-family="Arial" font-size="12" letter-spacing="1" fill="#5a5a62" text-anchor="end">Hz</text>' +
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
        hit.addEventListener("pointerup", () => { drag = false; saveEq(); });
        hit.addEventListener("pointercancel", () => { drag = false; });
        hit.addEventListener("keydown", (e) => {
            const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            eqState.gains[eqModelId][i] = Math.max(-12, Math.min(12, eqState.gains[eqModelId][i] + step));
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
    renderEqPicker();
    updateEqVisuals();
}

function updateEqVisuals() {
    EQ_FREQS.forEach((f, i) => {
        const h = document.getElementById("eqH" + i);
        const v = document.getElementById("eqV" + i);
        if (!h) return;
        h.setAttribute("transform", "translate(0," + eqGainToY(eqState.gains[eqModelId][i]).toFixed(1) + ")");
        h.style.opacity = eqState.on ? 1 : 0.4;
        v.textContent = (eqState.gains[eqModelId][i] > 0 ? "+" : "") + eqState.gains[eqModelId][i];
        const hit = document.getElementById("eqHit" + i);
        if (hit) hit.setAttribute("aria-valuenow", eqState.gains[eqModelId][i]);
    });
    const led = document.getElementById("eqLed");
    if (led) led.style.fill = eqState.on ? "#ff7a3a" : "#3a2012";
}

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
        if (drag) setVolumeLevel(startV + (startY - e.clientY) / 180);
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
    renderAmpPicker();
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
let tsPreviewUntil = 0;   // 다이얼 조작 중 디스플레이 웨이크 시각

// 톤암 각도 → 트랙 번호 (-5° 미만 = 거치대)
function trackAtAngle(ang) {
    if (ang < -5) return -1;
    const seg = 21 / RECORD.tracks.length;
    return Math.max(0, Math.min(RECORD.tracks.length - 1, Math.floor((ang + 2) / seg)));
}

// 톤암 드래그 — 실물처럼 암을 들어 원하는 트랙 위에 내려놓으면 그 곡부터 재생.
// 거치대 쪽(-5° 미만)에 내려놓으면 연주를 멈춘다.
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
    try { audio.playbackRate = ttRpm45 ? 1.35 : 1; } catch (e) {}
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

function mountTurntable() {
    const ttSkin = TT_MODELS[ttModelId];
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
        '<radialGradient id="ttVinyl" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1c1c1f"/><stop offset="0.35" stop-color="#141416"/><stop offset="0.85" stop-color="#0d0d0f"/><stop offset="1" stop-color="#131316"/></radialGradient>' +
        '<linearGradient id="ttSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="ttMetal" cx="0.4" cy="0.35" r="0.9"><stop offset="0" stop-color="#d8d8dc"/><stop offset="0.6" stop-color="#9a9aa2"/><stop offset="1" stop-color="#5c5c64"/></radialGradient>' +
        '<clipPath id="ttLabelClip"><circle cx="560" cy="330" r="83"/></clipPath>' +
        '<path id="ttLabelArc" d="M 488 330 A 72 72 0 0 1 632 330" fill="none"/>' +
        '<clipPath id="ttJacketClip"><rect x="1170" y="76" width="508" height="508" rx="4"/></clipPath>' +
        '<clipPath id="ttListClip"><rect x="1690" y="56" width="286" height="590"/></clipPath>' +
        '</defs>' +
        '<rect x="0" y="-40" width="2000" height="720" rx="10" fill="' + ttSkin.plinth + '"/>' +
        '<rect x="24" y="-16" width="1952" height="672" rx="8" fill="' + ttSkin.deck + '" stroke="#0a0a0c" stroke-width="2"/>' +
        ttSkin.detail +
        '<text x="60" y="72" font-family="Arial" font-size="26" font-weight="700" letter-spacing="1.5" fill="' + ttSkin.accent + '">' + ttSkin.brand + '</text>' +
        '<text x="60" y="98" font-family="Arial" font-size="12" letter-spacing="2.5" fill="' + ttSkin.accent + '">' + ttSkin.subtitle + '</text>' +
        // 레코드 브러시 — 쌓인 먼지를 닦아낸다. 게이지는 현재 먼지량.
        '<rect id="ttCleanBtn" x="44" y="150" width="200" height="56" rx="8" fill="#26262b" stroke="#4a4a52" stroke-width="2" style="cursor:pointer"><title>레코드 브러시 — 판의 먼지를 닦아냅니다</title></rect>' +
        '<rect x="60" y="170" width="44" height="16" rx="4" fill="#4a3524" pointer-events="none"/>' +
        '<rect x="60" y="166" width="44" height="6" rx="2" fill="#6b5138" pointer-events="none"/>' +
        '<text x="170" y="185" font-family="Arial" font-size="15" font-weight="700" letter-spacing="1" fill="#e6e5e8" text-anchor="middle" pointer-events="none">클리닝</text>' +
        '<text x="44" y="238" font-family="Arial" font-size="10" letter-spacing="2" fill="#8a7d70">DUST</text>' +
        '<rect x="88" y="229" width="156" height="10" rx="5" fill="#101013" stroke="#3a3a40"/>' +
        '<rect id="ttDustBar" x="88" y="229" width="0" height="10" rx="5" fill="#b06a2a"/>' +
        // 플래터
        '<ellipse cx="566" cy="342" rx="282" ry="280" fill="#000" opacity="0.5"/>' +
        '<circle cx="560" cy="330" r="278" fill="' + ttSkin.platter + '"/>' +
        '<circle cx="560" cy="330" r="272" fill="#0c0c0e" stroke="#3a3a40" stroke-width="2"/>' +
        '<g id="ttSpinG">' +
        '<circle cx="560" cy="330" r="264" fill="none" stroke="#3c3c44" stroke-width="4" stroke-dasharray="3 9"/>' +
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
        // 톤암
        '<circle cx="1065" cy="120" r="46" fill="#1f1f24" stroke="#0a0a0c" stroke-width="2"/>' +
        '<circle cx="1065" cy="120" r="34" fill="url(#ttMetal)"/>' +
        '<rect x="920" y="486" width="10" height="34" rx="3" fill="#26262b"/>' +
        '<rect x="912" y="480" width="26" height="10" rx="4" fill="#3a3a40"/>' +
        '<g id="ttArmG">' +
        '<circle cx="1132" cy="78" r="24" fill="#26262b" stroke="#4a4a52" stroke-width="2"/>' +
        '<line x1="1122" y1="88" x2="1065" y2="120" stroke="#55555c" stroke-width="12" stroke-linecap="round"/>' +
        '<line x1="1065" y1="120" x2="768" y2="428" stroke="#3c3c44" stroke-width="11" stroke-linecap="round"/>' +
        '<line x1="1065" y1="120" x2="768" y2="428" stroke="#b8b8c0" stroke-width="7" stroke-linecap="round"/>' +
        '<g transform="rotate(-46 762 434)"><rect x="734" y="420" width="58" height="26" rx="5" fill="#1c1c22" stroke="#4a4a52"/><rect x="742" y="444" width="14" height="8" rx="2" fill="#8a2020"/></g>' +
        '<circle id="ttArmHit" cx="768" cy="428" r="58" fill="#000000" fill-opacity="0" style="cursor:grab"><title>톤암 — 잡아서 원하는 트랙 위에 내려놓으세요</title></circle>' +
        '</g>' +
        '<circle cx="1065" cy="120" r="8" fill="#0d0d10"/>' +
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
    document.getElementById("tt33").addEventListener("click", () => { ttRpm45 = false; applyRpmRate(); updatePhonoVisuals(); });
    document.getElementById("tt45").addEventListener("click", () => { ttRpm45 = true; applyRpmRate(); updatePhonoVisuals(); });
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
    stopRecording();
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
    const rpm = ttRpm45 ? 45 : 100 / 3;
    const spinTarget = (phonoActive && isPlaying) ? 1 : 0;
    const step = spinTarget > ttSpin ? dt / ttSpec.spinUp : dt / ttSpec.runDown;
    ttSpin = Math.max(0, Math.min(1, ttSpin + (spinTarget > ttSpin ? 1 : -1) * step));
    if (ttSpin > 0.002) {
        ttAngle = (ttAngle + rpm / 60 * 360 * ttSpin * dt) % 360;
        const g = document.getElementById("ttSpinG");
        if (g) g.setAttribute("transform", "rotate(" + ttAngle.toFixed(2) + " 560 330)");
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
        const mult = ttRpm45 ? 1.35 : 1;
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
    const warmRate = warmTarget > tubeWarm ? dt / 2.0 : dt / 3.5;
    tubeWarm = Math.max(0, Math.min(1, tubeWarm + (warmTarget > tubeWarm ? 1 : -1) * warmRate));
    updateMa2375Display();

    // 튜너 램프: 라디오 수신 중에만 (백열등이라 진공관보다 빠르게 켜지고 꺼진다)
    const tnTarget = (isPlaying && currentStation) ? 1 : 0;
    const tnRate = tnTarget > tunerWarm ? dt / 0.9 : dt / 1.4;
    tunerWarm = Math.max(0, Math.min(1, tunerWarm + (tnTarget > tunerWarm ? 1 : -1) * tnRate));

    // 앰프: 진공관 글로우(웜업 연동)·갤러리 어둠·VU 바늘·전원 LED
    // 유리 할로·주변광은 은은하게, 필라멘트는 백열로 뜨겁게 (실제 진공관의 빛 분포)
    document.querySelectorAll(".ampGlow").forEach((el) => {
        el.style.opacity = (0.012 + tubeWarm * (0.32 + tsSignal * 0.34)).toFixed(3);
    });
    const filBloom = tubeWarm > 0.04
        ? "drop-shadow(0 0 5px rgba(255,150,50," + tubeWarm.toFixed(2) + ")) drop-shadow(0 0 14px rgba(255,110,35," + (0.6 * tubeWarm).toFixed(2) + "))"
        : "none";
    document.querySelectorAll(".ampFil").forEach((el) => {
        el.style.opacity = (0.02 + tubeWarm * (0.85 + tsSignal * 0.15)).toFixed(3);
        el.style.filter = filBloom;
    });
    // 필라멘트 핫코어 — 유리 안에서 작열하는 백열점. 큰 블룸으로 유리 전체에 번진다.
    const hotBloom = tubeWarm > 0.04
        ? "drop-shadow(0 0 10px rgba(255,170,70," + (0.85 * tubeWarm).toFixed(2) + ")) drop-shadow(0 0 26px rgba(255,120,40," + (0.45 * tubeWarm).toFixed(2) + "))"
        : "none";
    document.querySelectorAll(".ampFilHot").forEach((el) => {
        el.style.opacity = (tubeWarm * (0.8 + tsSignal * 0.2)).toFixed(3);
        el.style.filter = hotBloom;
    });
    // 켜지면 스모크 유리가 거의 걷힌다 — 달아오른 관은 노출된 유리처럼 보여야 한다
    document.querySelectorAll(".tubeDark").forEach((el) => {
        el.style.opacity = (0.76 - tubeWarm * 0.7).toFixed(3);
    });
    const vuAng = -42 + Math.max(0, Math.min(1, tsSignal)) * 84;
    ["ampVuL", "ampVuR", "deckVuL", "deckVuR"].forEach((id, idx) => {
        const n = document.getElementById(id);
        if (n) n.setAttribute("transform", "rotate(" + (vuAng * (idx % 2 ? 0.96 : 1)).toFixed(1) + " " + n.getAttribute("data-cx") + " " + n.getAttribute("data-cy") + ")");
    });

    // 카세트 데크: 테이프 트랜스포트 (위치·릴·감김량·카운터·히스·REC 램프)
    if (deckMode === "rec" && recorder) {
        tapePos = Math.min(TAPE_LEN, deckRecStartPos + (Date.now() - recStartMs) / 1000);
        if (tapePos >= TAPE_LEN) {
            stopRecording();
            playerSubtext.textContent = "테이프 끝 — 녹음이 정지되었습니다.";
        }
    } else if (deckMode === "play") {
        if (deckSegPlaying) {
            if (isFinite(audio.currentTime)) tapePos = deckSegPlaying.start + Math.max(0, audio.currentTime - (deckSegPlaying.offset || 0));
        } else {
            tapePos += dt;   // 빈 구간: 히스만 내며 계속 감긴다
            const nx = deckTape ? nextSegmentAfter(deckTape, tapePos) : null;
            if (nx && tapePos >= nx.start) deckStartSegment(nx, tapePos - nx.start);
        }
        if (tapePos >= TAPE_LEN) {
            tapePos = TAPE_LEN;
            deckStopTransport();
            playerSubtext.textContent = "테이프가 끝났습니다 — 되감으세요.";
            if (radioStandby) {
                const nx2 = radioStandby;
                radioStandby = null;
                selectStation(nx2.id);
            }
        }
        const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
        if (hissGain) hissGain.gain.value += ((deckSegPlaying ? deckSpec.hissFloor : deckSpec.blankHiss) - hissGain.gain.value) * 0.1;
    } else if (deckMode === "wind") {
        const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
        tapePos = Math.max(0, Math.min(TAPE_LEN, tapePos + windDir * deckSpec.windRate * dt));
        if (tapePos <= 0 || tapePos >= TAPE_LEN) { deckMode = "stop"; windDir = 0; }
    }
    const deckRolling = (deckMode === "play") || (deckMode === "rec" && recorder);
    const deckSpec = DECK_MODELS[deckModelId] || DECK_MODELS.dragon;
    const spinRate = (deckMode === "wind" ? 900 * windDir : (deckRolling ? 210 : 0)) * deckSpec.reelRate;
    if (spinRate) deckReelAngle = (deckReelAngle + dt * spinRate + 360) % 360;
    const rl = document.getElementById("deckReelL");
    if (rl) {
        rl.setAttribute("transform", "rotate(" + deckReelAngle.toFixed(1) + " 610 260)");
        const rr = document.getElementById("deckReelR");
        if (rr) rr.setAttribute("transform", "rotate(" + (deckReelAngle * 0.82).toFixed(1) + " 850 260)");
        const p = tapePos / TAPE_LEN;
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
    }
    const pled = document.getElementById("ampPwrLed");
    if (pled) pled.style.fill = isPlaying ? "#ff7a3a" : "#3a2012";

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
        const w = el.closest("#tunerStage") ? tunerLight : tubeWarm;
        el.style.opacity = (0.03 + w * 0.97).toFixed(3);
    });
    // 그린 레전드(맥킨토시 패널 문자) — 백라이트 연동
    document.querySelectorAll(".ampLegend").forEach((el) => {
        el.style.opacity = (0.2 + tubeWarm * 0.8).toFixed(3);
    });
    document.querySelectorAll(".dialScale").forEach((el) => {
        el.style.opacity = (0.32 + tunerLight * 0.68).toFixed(2);
    });
    const digitOp = Math.max(0.08 + tunerWarm * 0.92, previewOn ? 1 : 0).toFixed(2);
    if (tsFreq) { tsFreq.style.opacity = digitOp; tsFreqGlow.style.opacity = digitOp; }

    // 전원 연동 조명: 튜너는 수신 램프를, 나머지 유닛은 시스템 웜업을 따른다
    document.querySelectorAll(".lzPowerDim").forEach((el) => {
        const w = el.closest("#tunerStage") ? tunerLight : tubeWarm;
        el.style.opacity = (0.22 * (1 - w)).toFixed(3);
    });
    // 미터 백라이트: 꺼진 미터 면은 어둡다
    document.querySelectorAll(".meterDark").forEach((el) => {
        const w = el.closest("#tunerStage") ? tunerLight : tubeWarm;
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

    stopRecording();
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
    if (!currentStation && !phonoActive) return;
    const sourceName = currentStation ? currentStation.name : "레코드";

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playerSubtext.textContent = `${sourceName} 재생을 일시정지했습니다.`;
    } else {
        if (!streamLoaded) {
            selectStation(currentStation.id);
            return;
        }
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
    stopRecording();
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
    stopRecording();
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


function toggleRecording() {
    if (recorder) {
        stopRecording();
        return;
    }

    if (!isPlaying) return;

    // 녹음은 항상 장착된 테이프의 현재 위치에 기록된다 (덮어쓰기)
    if (deckMode === "play") {
        playerSubtext.textContent = "테이프 재생 중에는 녹음할 수 없습니다 — 라디오나 턴테이블을 재생하세요.";
        return;
    }
    if (tapePos >= TAPE_LEN - 1) {
        playerSubtext.textContent = "테이프 끝입니다 — 되감거나 EJECT로 새 테이프를 넣으세요.";
        return;
    }
    if (!deckTape) deckTape = newBlankTape();

    if (!ensureAudioGraph()) {
        playerSubtext.textContent = "이 브라우저에서는 녹음을 지원하지 않습니다.";
        return;
    }

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const mime = pickRecMime();
    let rec;
    try {
        rec = new MediaRecorder(recDest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
    } catch (error) {
        console.error(error);
        playerSubtext.textContent = "녹음을 시작할 수 없습니다.";
        return;
    }

    const chunks = [];
    const station = currentStation || {
        id: "phono",
        name: (phonoActive && phonoTrack >= 0) ? RECORD.tracks[phonoTrack].t : "레코드"
    };
    const startMs = Date.now();
    const startDate = new Date();
    const tapeStartPos = tapePos;
    const tapeId = deckTape.id;

    rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = async () => {
        if (!chunks.length) return;
        const durationMs = Date.now() - startMs;
        const type = rec.mimeType || chunks[0].type || "audio/webm";
        const record = {
            stationId: station.id,
            stationName: station.name,
            startedAt: startDate.toISOString(),
            durationMs,
            type,
            tapeId,
            tapeStart: tapeStartPos,
            blob: new Blob(chunks, { type })
        };
        record.dbId = await persistRecording(record);
        addRecordingItem(record);
        playerSubtext.textContent = `${station.name} → 테이프 ${formatDuration(tapeStartPos * 1000)} 위치에 녹음되었습니다.`;
        gtag('event', 'record_save', {
            station_id: station.id,
            station_name: station.name,
            duration_seconds: Math.round(durationMs / 1000)
        });
    };

    recorder = rec;
    recStartMs = startMs;
    deckRecStartPos = tapeStartPos;
    deckMode = "rec";
    rec.start(1000);

    recTimerId = setInterval(updateRecTime, 500);
    updateRecTime();
    btnRec.classList.add("recording");
    btnRec.setAttribute("aria-label", "녹음 정지 및 저장");
    playerSubtext.textContent = `${station.name} 녹음 중입니다. 정지하거나 채널을 바꾸면 자동 저장됩니다.`;

    gtag('event', 'record_start', {
        station_id: station.id,
        station_name: station.name
    });
}

function stopRecording() {
    if (!recorder) return;

    const active = recorder;
    recorder = null;
    if (deckMode === "rec") {
        deckMode = "stop";
        tapePos = Math.min(TAPE_LEN, deckRecStartPos + (Date.now() - recStartMs) / 1000);
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
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("ogg")) return "ogg";
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
}

function updateRecButton() {
    btnRec.disabled = !recorder && !isPlaying;
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
        tape = { id: record.tapeId || ("tape-legacy-" + (record.dbId || Math.random())), label: "C-30 · TAPE " + tapeSeq, segments: [], pos: 0 };
        tapeSeq += 1;
        tapes.push(tape);
    }
    tapeAddSegment(tape, { start: record.tapeStart || 0, dur: record.durationMs / 1000, url, name: record.stationName });
    if (!deckTape) deckTape = tape;
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
    stopRecording();
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
