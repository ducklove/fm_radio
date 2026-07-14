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
    tsSignalPtr.setAttribute("transform", "translate(" + (sigX - sc.drawX).toFixed(1) + ",0)");

    const tuneTarget = (isPlaying && currentStation) ? 0 : 0.85;
    const jitter = isPlaying ? (Math.random() - 0.5) * 0.05 : 0;
    tsTune += (tuneTarget - tsTune) * 0.1 + jitter;
    tsTune = Math.max(-1, Math.min(1, tsTune));
    tsTunePtr.setAttribute("transform", "translate(" + (tsTune * tunerCfg.tune.travel).toFixed(1) + ",0)");
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

// ----- 그래픽 이퀄라이저 (YAHAMA GE-5) -----
// EQ 모델: GE-5(5밴드) / GE-10(옥타브 10밴드)
const EQ_MODELS = {
    ge5: { pill: "GE-5 · 5밴드", name: "GE-5", q: 1.0, capW: 60,
        freqs: [60, 250, 1000, 4000, 12000],
        labels: ["60", "250", "1k", "4k", "12k"],
        xs: [800, 1030, 1260, 1490, 1720] },
    ge10: { pill: "GE-10 · 10밴드", name: "GE-10", q: 1.4, capW: 44,
        freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        labels: ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"],
        xs: [755, 880, 1005, 1130, 1255, 1380, 1505, 1630, 1755, 1880] }
};
const EQ_ORDER = ["ge5", "ge10"];
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

function renderDeckPicker() { renderSinglePicker("deckPicker", "deck", "Nakamichy DRAGON"); }
function renderTtPicker() { renderSinglePicker("ttPicker", "tt", "YAHAMA PL-12"); }

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
    // 필드 배경: dB 그리드 라인
    let grid = "";
    [-12, -9, -6, -3, 0, 3, 6, 9, 12].forEach((g) => {
        const y = eqGainToY(g);
        grid += '<line x1="700" y1="' + y + '" x2="1900" y2="' + y + '" stroke="#3a3a40" stroke-width="' + (g === 0 ? 2 : 0.8) + '" opacity="' + (g === 0 ? 0.9 : 0.5) + '"/>';
    });
    const hw = EQ_CAPW / 2;
    const hitHw = Math.min(58, Math.floor((EQ_X[1] - EQ_X[0]) / 2) - 3);
    const sliders = EQ_FREQS.map((f, i) => {
        const x = EQ_X[i];
        return '<rect x="' + (x - 5) + '" y="' + (EQ_TOP - 8) + '" width="10" height="' + (EQ_BOT - EQ_TOP + 16) + '" rx="5" fill="#050506" stroke="#2e2e34" stroke-width="1.2"/>' +
            '<rect x="' + (x - 5) + '" y="' + (EQ_TOP - 8) + '" width="10" height="14" rx="5" fill="#000000" opacity="0.6"/>' +
            '<g id="eqH' + i + '">' +
            '<rect x="' + (x - hw + 2) + '" y="-11" width="' + EQ_CAPW + '" height="30" rx="4" fill="#000000" opacity="0.42" filter="url(#lzSoft)"/>' +
            '<rect x="' + (x - hw) + '" y="-15" width="' + EQ_CAPW + '" height="30" rx="4" fill="#26262c" stroke="#0a0a0c" stroke-width="1.5"/>' +
            '<rect x="' + (x - hw) + '" y="-15" width="' + EQ_CAPW + '" height="6" rx="3" fill="#3c3c44"/>' +
            '<rect x="' + (x - hw) + '" y="-2.5" width="' + EQ_CAPW + '" height="5" fill="#f2f2f4"/>' +
            '</g>' +
            '<text id="eqV' + i + '" x="' + x + '" y="78" font-family="Arial" font-size="13" font-weight="700" fill="#9a9aa2" text-anchor="middle">0</text>' +
            '<text x="' + x + '" y="354" font-family="Arial" font-size="14" font-weight="600" letter-spacing="0.5" fill="#8a8a94" text-anchor="middle">' + EQ_LABELS[i] + '</text>' +
            '<rect id="eqHit' + i + '" x="' + (x - hitHw) + '" y="66" width="' + (hitHw * 2) + '" height="300" fill="#000" fill-opacity="0" style="cursor:ns-resize;touch-action:none" tabindex="0" role="slider" aria-label="' + EQ_LABELS[i] + 'Hz 게인" aria-valuemin="-12" aria-valuemax="12"><title>' + EQ_LABELS[i] + 'Hz &#177;12dB</title></rect>';
    }).join("");
    let lvl = "";
    for (let i = 0; i < 12; i++) {
        lvl += '<rect id="eqLvl' + i + '" x="530" y="' + (300 - i * 19) + '" width="46" height="12" rx="2" fill="#33251a"/>';
    }
    document.getElementById("eqStage").innerHTML =
        '<svg class="eq-svg" viewBox="0 0 2000 400" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="YAHAMA GE-5 스테레오 그래픽 이퀄라이저">' +
        '<defs>' +
        '<linearGradient id="eqPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b1f"/><stop offset="0.5" stop-color="#121215"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>' +
        '<pattern id="eqRidge" width="14" height="8" patternUnits="userSpaceOnUse"><rect width="7" height="8" fill="#0e0e11"/><rect x="7" width="7" height="8" fill="#141419"/></pattern>' +
        '</defs>' +
        '<rect width="2000" height="400" rx="8" fill="url(#eqPanel)"/>' +
        '<rect width="2000" height="6" fill="#ffffff" opacity="0.06"/>' +
        '<rect y="388" width="2000" height="12" fill="#000" opacity="0.4"/>' +
        // 랙 이어
        '<rect x="0" y="0" width="44" height="400" rx="8" fill="#101013"/><circle cx="22" cy="52" r="9" fill="#26262c" stroke="#3c3c44"/><circle cx="22" cy="348" r="9" fill="#26262c" stroke="#3c3c44"/>' +
        '<rect x="1956" y="0" width="44" height="400" rx="8" fill="#101013"/><circle cx="1978" cy="52" r="9" fill="#26262c" stroke="#3c3c44"/><circle cx="1978" cy="348" r="9" fill="#26262c" stroke="#3c3c44"/>' +
        // 좌측 컨트롤 블록
        '<text x="90" y="96" font-family="Arial" font-size="30" font-weight="700" letter-spacing="1.5" fill="#f0f0f2">YAHAMA</text>' +
        '<text x="90" y="126" font-family="Arial" font-size="14" letter-spacing="1.5" fill="#8a8a94">Stereo Graphic Equalizer ' + EQ_MODELS[eqModelId].name + '</text>' +
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
        '<rect x="680" y="60" width="1240" height="310" rx="6" fill="url(#eqRidge)" stroke="#26262c" stroke-width="1.5"/>' +
        grid +
        '<text x="694" y="' + (EQ_TOP + 5) + '" font-family="Arial" font-size="12" fill="#8a8a94">+12</text>' +
        '<text x="694" y="' + (eqGainToY(0) + 4) + '" font-family="Arial" font-size="12" fill="#8a8a94">0</text>' +
        '<text x="694" y="' + (EQ_BOT + 5) + '" font-family="Arial" font-size="12" fill="#8a8a94">-12</text>' +
        sliders +
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
    document.getElementById("ampStage").innerHTML = AMP_MODELS[ampModelId].svg;
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
// 수집한 음원은 여기에 음반 단위로 추가한다. 모든 음원은 CORS가 열린
// upload.wikimedia.org(Access-Control-Allow-Origin: *)에서 스트리밍해야
// Web Audio 체인(EQ·앰프·크랙클)을 통과할 수 있다.
// labelBg/jacketBg/accent로 음반마다 라벨·재킷 인쇄색이 달라진다.
const RECORDS = [
    {
        title: "무반주 첼로 모음곡 제1번 G장조", bwv: "BWV 1007", composer: "J. S. BACH",
        performer: "John Michel, violoncello",
        credit: "음원: John Michel · CC BY-SA 3.0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "무반주 첼로 모음곡 1번", labelArtist: "JOHN MICHEL, CELLO",
        jTitle: "BACH", jSub1: "무반주 첼로 모음곡", jSub2: "제1번 G장조 · BWV 1007",
        labelBg: "#ddd2b4", jacketBg: "#ddd2b4", accent: "#8a2020", cover: "thumb/4/4b/Violoncello_MET_DT7705.jpg/960px-Violoncello_MET_DT7705.jpg",
        tracks: [
            { t: "I. Prélude", f: "4/43/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg" },
            { t: "II. Allemande", f: "6/6c/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Allemande.ogg" },
            { t: "III. Courante", f: "0/08/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Courante.ogg" },
            { t: "IV. Sarabande", f: "3/30/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Sarabande.ogg" },
            { t: "V. Menuet I & II", f: "6/67/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Minuets.ogg" },
            { t: "VI. Gigue", f: "e/e6/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Gigue.ogg" }
        ]
    },
    {
        title: "무반주 첼로 모음곡 제3번 C장조", bwv: "BWV 1009", composer: "J. S. BACH",
        performer: "John Michel, violoncello",
        credit: "음원: John Michel · CC BY-SA 3.0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "무반주 첼로 모음곡 3번", labelArtist: "JOHN MICHEL, CELLO",
        jTitle: "BACH", jSub1: "무반주 첼로 모음곡", jSub2: "제3번 C장조 · BWV 1009",
        labelBg: "#d6dde6", jacketBg: "#cfd8e2", accent: "#1f4e79", cover: "thumb/4/4b/Violoncello_MET_DT7705.jpg/960px-Violoncello_MET_DT7705.jpg",
        tracks: [
            { t: "I. Prélude", f: "5/56/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_C_Prelude.ogg" },
            { t: "II. Allemande", f: "4/49/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_C_Allemande.ogg" },
            { t: "III. Courante", f: "9/9f/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_C_Courante.ogg" },
            { t: "IV. Sarabande", f: "c/c0/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_C_Sarabande.ogg" },
            { t: "V. Bourrée I & II", f: "e/e9/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_G_Bourees.ogg" },
            { t: "VI. Gigue", f: "b/b6/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_3_in_C_Gigue.ogg" }
        ]
    },
    {
        title: "골드베르크 변주곡 — A면", bwv: "BWV 988", composer: "J. S. BACH",
        performer: "Kimiko Ishizaka, piano",
        credit: "음원: Open Goldberg Variations · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "골드베르크 변주곡", labelArtist: "KIMIKO ISHIZAKA, PIANO",
        jTitle: "GOLDBERG", jSub1: "바흐 골드베르크 변주곡", jSub2: "Aria & Var. 1–7 · BWV 988",
        labelBg: "#ece8dc", jacketBg: "#ece9e0", accent: "#8a6a1f", cover: "thumb/b/b6/Cover_of_the_Open_Goldberg_Variations.jpg/960px-Cover_of_the_Open_Goldberg_Variations.jpg",
        tracks: [
            { t: "Aria", f: "5/59/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_01_Aria.mp3" },
            { t: "Variatio 1", f: "6/6c/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_02_Variatio_1_a_1_Clav.mp3" },
            { t: "Variatio 2", f: "a/a9/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_03_Variatio_2_a_1_Clav.mp3" },
            { t: "Variatio 3 — Canone all'Unisono", f: "7/76/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_04_Variatio_3_a_1_Clav._Canone_all_Unisuono.mp3" },
            { t: "Variatio 4", f: "d/d3/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_05_Variatio_4_a_1_Clav.mp3" },
            { t: "Variatio 5", f: "6/63/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_06_Variatio_5_a_1_ovvero_2_Clav.mp3" },
            { t: "Variatio 6 — Canone alla Seconda", f: "1/19/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_07_Variatio_6_a_1_Clav._Canone_alla_Seconda.mp3" },
            { t: "Variatio 7 — al tempo di Giga", f: "e/e3/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_08_Variatio_7_a_1_ovvero_2_Clav.mp3" }
        ]
    }
,
    {
        title: "골드베르크 변주곡 — B면", bwv: "BWV 988", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Goldberg Variations · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "골드베르크 변주곡", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "GOLDBERG", jSub1: "바흐 골드베르크 변주곡", jSub2: "Var. 8–15 · BWV 988",
        labelBg: "#e4dccb", jacketBg: "#e6ded0", accent: "#7a5a24", side: "B", cover: "thumb/b/b6/Cover_of_the_Open_Goldberg_Variations.jpg/960px-Cover_of_the_Open_Goldberg_Variations.jpg",
        tracks: [
            { t: "Variatio 8", f: "d/d8/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_09_Variatio_8_a_2_Clav.mp3" },
            { t: "Variatio 9 Canone alla Terza", f: "9/99/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_10_Variatio_9_a_1_Clav._Canone_alla_Terza.mp3" },
            { t: "Variatio 10 Fughetta", f: "8/88/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_11_Variatio_10_a_1_Clav._Fughetta.mp3" },
            { t: "Variatio 11", f: "3/37/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_12_Variatio_11_a_2_Clav.mp3" },
            { t: "Variatio 12 Canone alla Quarta", f: "9/94/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_13_Variatio_12_Canone_alla_Quarta.mp3" },
            { t: "Variatio 13", f: "3/3e/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_14_Variatio_13_a_2_Clav.mp3" },
            { t: "Variatio 14", f: "1/1d/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_15_Variatio_14_a_2_Clav.mp3" },
            { t: "Variatio 15 Canone alla Quinta", f: "5/50/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_16_Variatio_15_a_1_Clav._Canone_alla_Quinta.mp3" },
        ]
    },
    {
        title: "골드베르크 변주곡 — C면", bwv: "BWV 988", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Goldberg Variations · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "골드베르크 변주곡", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "GOLDBERG", jSub1: "바흐 골드베르크 변주곡", jSub2: "Var. 16–23 · BWV 988",
        labelBg: "#dcd6c4", jacketBg: "#e0d8c8", accent: "#6e5320", side: "C", cover: "thumb/b/b6/Cover_of_the_Open_Goldberg_Variations.jpg/960px-Cover_of_the_Open_Goldberg_Variations.jpg",
        tracks: [
            { t: "Variatio 16 Ouverture", f: "6/62/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_17_Variatio_16_a_1_Clav._Ouverture.mp3" },
            { t: "Variatio 17", f: "6/6e/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_18_Variatio_17_a_2_Clav.mp3" },
            { t: "Variatio 18 Canone alla Sexta", f: "6/6a/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_19_Variatio_18_a_1_Clav._Canone_alla_Sexta.mp3" },
            { t: "Variatio 19", f: "5/57/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_20_Variatio_19_a_1_Clav.mp3" },
            { t: "Variatio 20", f: "e/e5/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_21_Variatio_20_a_2_Clav.mp3" },
            { t: "Variatio 21 Canone alla Settima", f: "6/65/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_22_Variatio_21_Canone_alla_Settima.mp3" },
            { t: "Variatio 22", f: "e/e7/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_23_Variatio_22_a_1_Clav.mp3" },
            { t: "Variatio 23", f: "c/c8/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_24_Variatio_23_a_2_Clav.mp3" },
        ]
    },
    {
        title: "골드베르크 변주곡 — D면", bwv: "BWV 988", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Goldberg Variations · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "골드베르크 변주곡", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "GOLDBERG", jSub1: "바흐 골드베르크 변주곡", jSub2: "Var. 24–30, Aria da Capo",
        labelBg: "#e8e0cf", jacketBg: "#eae2d2", accent: "#7f6026", side: "D", cover: "thumb/b/b6/Cover_of_the_Open_Goldberg_Variations.jpg/960px-Cover_of_the_Open_Goldberg_Variations.jpg",
        tracks: [
            { t: "Variatio 24 Canone all Ottava", f: "f/f6/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_25_Variatio_24_a_1_Clav._Canone_all_Ottava.mp3" },
            { t: "Variatio 25", f: "2/26/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_26_Variatio_25_a_2_Clav.mp3" },
            { t: "Variatio 26", f: "1/13/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_27_Variatio_26_a_2_Clav.mp3" },
            { t: "Variatio 27", f: "6/6a/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_28_Variatio_27_a_2_Clav._Canone_alla_Nona_-_Variatio_28_a_2_Clav.mp3" },
            { t: "Variatio 29", f: "9/98/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_29_Variatio_29_a_1_ovvero_2_Clav.mp3" },
            { t: "Variatio 30 Quodlibet", f: "4/42/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_30_Variatio_30_a_1_Clav._Quodlibet.mp3" },
            { t: "Aria da Capo è Fine", f: "d/db/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_31_Aria_da_Capo_%C3%A8_Fine.mp3" },
        ]
    },
    {
        title: "평균율 클라비어곡집 1권 — 제1집", bwv: "BWV 846–869", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Well-Tempered Clavier · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "평균율 1권 · No.1–6", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "WTC I", jSub1: "Well-Tempered Clavier, Book I", jSub2: "Prelude & Fugue No. 1–6",
        labelBg: "#e7e2d6", jacketBg: "#e9e4d8", accent: "#3a5a3f", side: "I", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",
        tracks: [
            { t: "Prelude 1 · C major", f: "b/b6/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_01_Prelude_No._1_in_C_major%2C_BWV_846.ogg" },
            { t: "Fugue 1 · C major", f: "e/e1/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_02_Fugue_No._1_in_C_major%2C_BWV_846.ogg" },
            { t: "Prelude 2 · C minor", f: "4/4d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_03_Prelude_No._2_in_C_minor%2C_BWV_847.ogg" },
            { t: "Fugue 2 · C minor", f: "b/b0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_04_Fugue_No._2_in_C_minor%2C_BWV_847.ogg" },
            { t: "Prelude 3 · C-sharp major", f: "5/59/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_05_Prelude_No._3_in_C-sharp_major%2C_BWV_848.ogg" },
            { t: "Fugue 3 · C-sharp major", f: "b/b7/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_06_Fugue_No._3_in_C-sharp_major%2C_BWV_848.ogg" },
            { t: "Prelude 4 · C-sharp minor", f: "f/f9/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_07_Prelude_No._4_in_C-sharp_minor%2C_BWV_849.ogg" },
            { t: "Fugue 4 · C-sharp minor", f: "2/21/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_08_Fugue_No._4_in_C-sharp_minor%2C_BWV_849.ogg" },
            { t: "Prelude 5 · D major", f: "a/a0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_09_Prelude_No._5_in_D_major%2C_BWV_850.ogg" },
            { t: "Fugue 5 · D major", f: "d/d4/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_10_Fugue_No._5_in_D_major%2C_BWV_850.ogg" },
            { t: "Prelude 6 · D minor", f: "7/71/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_11_Prelude_No._6_in_D_minor%2C_BWV_851.ogg" },
            { t: "Fugue 6 · D minor", f: "9/97/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_12_Fugue_No._6_in_D_minor%2C_BWV_851.ogg" },
        ]
    },
    {
        title: "평균율 클라비어곡집 1권 — 제2집", bwv: "BWV 846–869", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Well-Tempered Clavier · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "평균율 1권 · No.7–12", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "WTC I", jSub1: "Well-Tempered Clavier, Book I", jSub2: "Prelude & Fugue No. 7–12",
        labelBg: "#e2ddd0", jacketBg: "#e4dfd2", accent: "#2f5555", side: "II", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",
        tracks: [
            { t: "Prelude 7 · E-flat major", f: "a/aa/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_13_Prelude_No._7_in_E-flat_major%2C_BWV_852.ogg" },
            { t: "Fugue 7 · E-flat major", f: "7/7b/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_14_Fugue_No._7_in_E-flat_major%2C_BWV_852.ogg" },
            { t: "Prelude 8 · E-flat minor", f: "3/35/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_15_Prelude_No._8_in_E-flat_minor%2C_BWV_853.ogg" },
            { t: "Fugue 8 · D-sharp minor", f: "1/16/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_16_Fugue_No._8_in_D-sharp_minor%2C_BWV_853.ogg" },
            { t: "Prelude 9 · E major", f: "b/bc/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_17_Prelude_No._9_in_E_major%2C_BWV_854.ogg" },
            { t: "Fugue 9 · E major", f: "2/2d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_18_Fugue_No._9_in_E_major%2C_BWV_854.ogg" },
            { t: "Prelude 10 · E minor", f: "c/cb/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_19_Prelude_No._10_in_E_minor%2C_BWV_855.ogg" },
            { t: "Fugue 10 · E minor", f: "5/5c/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_20_Fugue_No._10_in_E_minor%2C_BWV_855.ogg" },
            { t: "Prelude 11 · F major", f: "4/4a/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_21_Prelude_No._11_in_F_major%2C_BWV_856.ogg" },
            { t: "Fugue 11 · F major", f: "b/bd/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_22_Fugue_No._11_in_F_major%2C_BWV_856.ogg" },
            { t: "Prelude 12 · F minor", f: "f/f3/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_23_Prelude_No._12_in_F_minor%2C_BWV_857.ogg" },
            { t: "Fugue 12 · F minor", f: "b/b9/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_24_Fugue_No._12_in_F_minor%2C_BWV_857.ogg" },
        ]
    },
    {
        title: "평균율 클라비어곡집 1권 — 제3집", bwv: "BWV 846–869", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Well-Tempered Clavier · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "평균율 1권 · No.13–18", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "WTC I", jSub1: "Well-Tempered Clavier, Book I", jSub2: "Prelude & Fugue No. 13–18",
        labelBg: "#e5e0d2", jacketBg: "#e7e2d4", accent: "#4a4a72", side: "III", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",
        tracks: [
            { t: "Prelude 13 · F-sharp major", f: "e/e0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_25_Prelude_No._13_in_F-sharp_major%2C_BWV_858.ogg" },
            { t: "Fugue 13 · F-sharp major", f: "4/46/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_26_Fugue_No._13_in_F-sharp_major%2C_BWV_858.ogg" },
            { t: "Prelude 14 · F-sharp minor", f: "f/fc/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_27_Prelude_No._14_in_F-sharp_minor%2C_BWV_859.ogg" },
            { t: "Fugue 14 · F-sharp minor", f: "0/0d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_28_Fugue_No._14_in_F-sharp_minor%2C_BWV_859.ogg" },
            { t: "Prelude 15 · G major", f: "8/81/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_29_Prelude_No._15_in_G_major%2C_BWV_860.ogg" },
            { t: "Fugue 15 · G major", f: "d/d0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_30_Fugue_No._15_in_G_major%2C_BWV_860.ogg" },
            { t: "Prelude 16 · G minor", f: "1/19/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_31_Prelude_No._16_in_G_minor%2C_BWV_861.ogg" },
            { t: "Fugue 16 · G minor", f: "2/23/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_32_Fugue_No._16_in_G_minor%2C_BWV_861.ogg" },
            { t: "Prelude 17 · A-flat major", f: "8/86/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_33_Prelude_No._17_in_A-flat_major%2C_BWV_862.ogg" },
            { t: "Fugue 17 · A-flat major", f: "f/fd/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_34_Fugue_No._17_in_A-flat_major%2C_BWV_862.ogg" },
            { t: "Prelude 18 · G-sharp minor", f: "5/5c/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_35_Prelude_No._18_in_G-sharp_minor%2C_BWV_863.ogg" },
            { t: "Fugue 18 · G-sharp minor", f: "c/c6/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_36_Fugue_No._18_in_G-sharp_minor%2C_BWV_863.ogg" },
        ]
    },
    {
        title: "평균율 클라비어곡집 1권 — 제4집", bwv: "BWV 846–869", composer: "J. S. BACH", performer: "Kimiko Ishizaka, piano", credit: "음원: Open Well-Tempered Clavier · Kimiko Ishizaka · CC0 · Wikimedia Commons",
        labelBig: "BACH", labelTitle: "평균율 1권 · No.19–24", labelArtist: "KIMIKO ISHIZAKA, PIANO", jTitle: "WTC I", jSub1: "Well-Tempered Clavier, Book I", jSub2: "Prelude & Fugue No. 19–24",
        labelBg: "#e3ddce", jacketBg: "#e5dfd0", accent: "#6b4a6a", side: "IV", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",
        tracks: [
            { t: "Prelude 19 · A major", f: "b/be/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_37_Prelude_No._19_in_A_major%2C_BWV_864.ogg" },
            { t: "Fugue 19 · A major", f: "2/24/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_38_Fugue_No._19_in_A_major%2C_BWV_864.ogg" },
            { t: "Prelude 20 · A minor", f: "9/9f/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_39_Prelude_No._20_in_A_minor%2C_BWV_865.ogg" },
            { t: "Fugue 20 · A minor", f: "c/c0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_40_Fugue_No._20_in_A_minor%2C_BWV_865.ogg" },
            { t: "Prelude 21 · B-flat major", f: "b/b0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_41_Prelude_No._21_in_B-flat_major%2C_BWV_866.ogg" },
            { t: "Fugue 21 · B-flat major", f: "5/57/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_42_Fugue_No._21_in_B-flat_major%2C_BWV_866.ogg" },
            { t: "Prelude 22 · B-flat minor", f: "1/16/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_43_Prelude_No._22_in_B-flat_minor%2C_BWV_867.ogg" },
            { t: "Fugue 22 · B-flat minor", f: "5/5d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_44_Fugue_No._22_in_B-flat_minor%2C_BWV_867.ogg" },
            { t: "Prelude 23 · B major", f: "6/63/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_45_Prelude_No._23_in_B_major%2C_BWV_868.ogg" },
            { t: "Fugue 23 · B major", f: "8/88/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_46_Fugue_No._23_in_B_major%2C_BWV_868.ogg" },
            { t: "Prelude 24 · B minor", f: "2/2e/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_47_Prelude_No._24_in_B_minor%2C_BWV_869.ogg" },
            { t: "Fugue 24 · B minor", f: "5/5d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_48_Fugue_No._24_in_B_minor%2C_BWV_869.ogg" },
        ]
    },
    {
        title: "사계", bwv: "Op. 8 · RV 269–297", composer: "A. VIVALDI", performer: "The Modena Chamber Orchestra", credit: "음원: Modena Chamber Orchestra · Musopen · PD · Wikimedia Commons",
        labelBig: "VIVALDI", labelTitle: "사계 (Le quattro stagioni)", labelArtist: "MODENA CHAMBER ORCH.", jTitle: "LE QUATTRO STAGIONI", jSub1: "비발디 · 사계", jSub2: "The Four Seasons · Op. 8",
        labelBg: "#dfe7d3", jacketBg: "#e2e9d7", accent: "#3f6b34", side: "A", cover: "9/98/Antonio_Vivaldi_portrait.jpg",
        tracks: [
            { t: "La primavera I · Allegro", f: "1/18/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Spring%2C_RV_269_-_I._Allegro.ogg" },
            { t: "La primavera II · Largo", f: "3/39/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Spring%2C_RV_269_-_II._Largo.ogg" },
            { t: "La primavera III · Allegro", f: "7/7c/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Spring%2C_RV_269_-_III._Allegro.ogg" },
            { t: "L'estate I · Allegro non molto", f: "3/3d/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Summer%2C_RV_315_-_I._Allegro_non_molto.ogg" },
            { t: "L'estate II · Adagio", f: "1/17/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Summer%2C_RV_315_-_II._Adagio.ogg" },
            { t: "L'estate III · Presto", f: "1/17/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Summer%2C_RV_315_-_III._Presto.ogg" },
            { t: "L'autunno I · Allegro", f: "c/c4/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Autumn%2C_RV_293_-_I._Allegro.ogg" },
            { t: "L'autunno II · Adagio molto", f: "8/83/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Autumn%2C_RV_293_-_II._Adagio_molto.ogg" },
            { t: "L'autunno III · Allegro", f: "7/79/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Autumn%2C_RV_293_-_III._Allegro.ogg" },
            { t: "L'inverno I · Allegro non molto", f: "9/9c/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Winter%2C_RV_297_-_I._Allegro_non_molto.ogg" },
            { t: "L'inverno II · Largo", f: "8/8b/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Winter%2C_RV_297_-_II._Largo.ogg" },
            { t: "L'inverno III · Allegro", f: "3/3d/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Winter%2C_RV_297_-_III._Allegro.ogg" },
        ]
    },
    {
        title: "비발디 협주곡집", bwv: "RV 498 · 532 · 536", composer: "A. VIVALDI", performer: "The Modena Chamber Orchestra", credit: "음원: Modena Chamber Orchestra · Musopen · PD · Wikimedia Commons",
        labelBig: "VIVALDI", labelTitle: "협주곡집", labelArtist: "MODENA CHAMBER ORCH.", jTitle: "CONCERTI", jSub1: "비발디 협주곡집", jSub2: "Bassoon · Mandolins · Oboes",
        labelBg: "#d8e0e6", jacketBg: "#dbe3e9", accent: "#2f5a72", side: "A", cover: "9/98/Antonio_Vivaldi_portrait.jpg",
        tracks: [
            { t: "바순 협주곡 RV 498 · I", f: "2/26/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Bassoon_Concerto_in_A_minor%2C_RV_498_-_I._Allegro_%28ma_molto_moderato%29.ogg" },
            { t: "바순 협주곡 RV 498 · II", f: "a/a7/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Bassoon_Concerto_in_A_minor%2C_RV_498_-_II._Larghetto.ogg" },
            { t: "바순 협주곡 RV 498 · III", f: "a/a2/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Bassoon_Concerto_in_A_minor%2C_RV_498_-_III._Allegro.ogg" },
            { t: "2대의 만돌린 RV 532 · I", f: "c/c7/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Mandolins_in_G_major%2C_RV_532_-_I._Allegro.ogg" },
            { t: "2대의 만돌린 RV 532 · II", f: "b/b3/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Mandolins_in_G_major%2C_RV_532_-_II._Andante.ogg" },
            { t: "2대의 만돌린 RV 532 · III", f: "8/8c/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Mandolins_in_G_major%2C_RV_532_-_III._Allegro.ogg" },
            { t: "2대의 오보에 RV 536 · I", f: "6/6e/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Oboes_in_A_minor%2C_RV_536_-_I._Allegro.ogg" },
            { t: "2대의 오보에 RV 536 · II", f: "0/0a/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Oboes_in_A_minor%2C_RV_536_-_II._Largo.ogg" },
            { t: "2대의 오보에 RV 536 · III", f: "c/c0/The_Modena_Chamber_Orchestra_-_Vivaldi%27s_Concerto_for_2_Oboes_in_A_minor%2C_RV_536_-_III._Allegro.ogg" },
        ]
    },
    {
        title: "교향곡 제5번 '운명'", bwv: "Op. 67", composer: "L. van BEETHOVEN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BEETHOVEN", labelTitle: "교향곡 5번 c단조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SYMPHONY No.5", jSub1: "베토벤 교향곡 5번 '운명'", jSub2: "C minor · Op. 67",
        labelBg: "#e0cfc0", jacketBg: "#2a1f1a", accent: "#8a2020", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",
        tracks: [
            { t: "I. Allegro con brio", f: "e/e6/Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor%2C_op._67_-_i._allegro_con_brio.ogg" },
            { t: "II. Andante con moto", f: "c/c0/Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor%2C_op._67_-_ii._andante_con_moto.ogg" },
            { t: "III. Allegro", f: "5/5b/Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor%2C_op._67_-_iii._allegro.ogg" },
            { t: "IV. Allegro", f: "4/47/Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor%2C_op._67_-_iv._allegro.ogg" },
        ]
    },
    {
        title: "교향곡 제6번 '전원'", bwv: "Op. 68", composer: "L. van BEETHOVEN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BEETHOVEN", labelTitle: "교향곡 6번 F장조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "PASTORAL", jSub1: "베토벤 교향곡 6번 '전원'", jSub2: "F major · Op. 68",
        labelBg: "#d7e0cd", jacketBg: "#33402c", accent: "#4a7a3a", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",
        tracks: [
            { t: "I. Allegro ma non troppo", f: "d/d5/Ludwig_van_Beethoven_-_symphony_no._6_in_f_major_%27pastoral%27%2C_op._68_-_i._allegro_non_troppo.ogg" },
            { t: "II. Andante molto mosso", f: "a/a9/Ludwig_van_Beethoven_-_symphony_no._6_in_f_major_%27pastoral%27%2C_op._68_-_ii._andante_molto_mosso.ogg" },
            { t: "III. Allegro", f: "b/ba/Ludwig_van_Beethoven_-_symphony_no._6_in_f_major_%27pastoral%27%2C_op._68_-_iii._allegro.ogg" },
            { t: "IV. Allegro (Storm)", f: "1/15/Ludwig_van_Beethoven_-_symphony_no._6_in_f_major_%27pastoral%27%2C_op._68_-_iv._allegro.ogg" },
            { t: "V. Allegretto", f: "6/67/Ludwig_van_Beethoven_-_symphony_no._6_in_f_major_%27pastoral%27%2C_op._68_-_v._allegretto.ogg" },
        ]
    },
    {
        title: "피아노 소나타 제8번 '비창'", bwv: "Op. 13", composer: "L. van BEETHOVEN", performer: "Paul Pitman, piano", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BEETHOVEN", labelTitle: "비창 소나타 c단조", labelArtist: "PAUL PITMAN, PIANO", jTitle: "PATHÉTIQUE", jSub1: "베토벤 피아노 소나타 8번 '비창'", jSub2: "C minor · Op. 13",
        labelBg: "#d9d2cc", jacketBg: "#2b2b30", accent: "#5a2a4a", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",
        tracks: [
            { t: "I. Grave – Allegro di molto e con brio", f: "2/26/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_I._Grave_-_Allegro_di_molto_e_con_brio.ogg" },
            { t: "II. Adagio cantabile", f: "6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg" },
            { t: "III. Rondo – Allegro", f: "8/87/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_III._Rondo_-_Allegro.ogg" },
        ]
    },
    {
        title: "피아노 협주곡 제1번", bwv: "Op. 15", composer: "L. van BEETHOVEN", performer: "Musopen Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BEETHOVEN", labelTitle: "피아노 협주곡 1번 C장조", labelArtist: "MUSOPEN ORCHESTRA", jTitle: "CONCERTO No.1", jSub1: "베토벤 피아노 협주곡 1번", jSub2: "C major · Op. 15",
        labelBg: "#e0d6c2", jacketBg: "#2e2a22", accent: "#8a6a2a", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",
        tracks: [
            { t: "I. Allegro con brio", f: "6/6f/Ludwig_van_Beethoven_-_piano_concerto_no._1_in_c_major%2C_op._15_-_i._allegro_con_brio.ogg" },
            { t: "II. Largo", f: "b/b4/Ludwig_van_Beethoven_-_piano_concerto_no._1_in_c_major%2C_op._15_-_ii._largo.ogg" },
            { t: "III. Rondo (Allegro scherzando)", f: "c/c4/Ludwig_van_Beethoven_-_piano_concerto_no._1_in_c_major%2C_op._15_-_iii._rondo_%28allegro_scherzando%29.ogg" },
        ]
    },
    {
        title: "교향곡 제1번", bwv: "Op. 68", composer: "J. BRAHMS", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BRAHMS", labelTitle: "교향곡 1번 c단조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SYMPHONY No.1", jSub1: "브람스 교향곡 1번", jSub2: "C minor · Op. 68",
        labelBg: "#d5d8cf", jacketBg: "#26302a", accent: "#3a5a44", side: "A", cover: "1/11/Johannes_Brahms_1853.jpg",
        tracks: [
            { t: "I. Un poco sostenuto – Allegro", f: "a/a7/Brahms%2C_Symphony_No._1_in_C_Minor%2C_Op._68_-_I._Un_poco_sostenuto_-_Allegro.ogg" },
            { t: "II. Andante sostenuto", f: "1/1f/Brahms%2C_Symphony_No._1_in_C_Minor%2C_Op._68_-_II._Andante_sostenuto.ogg" },
            { t: "III. Un poco allegretto e grazioso", f: "9/99/Brahms%2C_Symphony_No._1_in_C_Minor%2C_Op._68_-_III._Un_poco_allegretto_e_grazioso.ogg" },
            { t: "IV. Adagio – Allegro non troppo", f: "9/98/Brahms%2C_Symphony_No._1_in_C_Minor%2C_Op._68_-_IV._Adagio_-_Pi%C3%B9_andante_-_Allegro_non_troppo%2C_ma_con_brio.ogg" },
        ]
    },
    {
        title: "교향곡 제4번", bwv: "Op. 98", composer: "J. BRAHMS", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "BRAHMS", labelTitle: "교향곡 4번 e단조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SYMPHONY No.4", jSub1: "브람스 교향곡 4번", jSub2: "E minor · Op. 98",
        labelBg: "#d8d4cd", jacketBg: "#2c281f", accent: "#6b4a2a", side: "A", cover: "a/a2/Johannes_Brahms_portrait.jpg",
        tracks: [
            { t: "I. Allegro non troppo", f: "7/79/Brahms%2C_Symphony_No._4_in_E_Minor%2C_Op._98_-_I._Allegro_Non_Troppo.ogg" },
            { t: "II. Andante moderato", f: "a/a1/Brahms%2C_Symphony_No._4_in_E_Minor%2C_Op._98_-_II._Andante_Moderato.ogg" },
            { t: "III. Allegro giocoso", f: "7/7a/Brahms%2C_Symphony_No._4_in_E_Minor%2C_Op._98_-_III._Allegro_Giocoso.ogg" },
            { t: "IV. Allegro energico e passionato", f: "e/e0/Brahms%2C_Symphony_No._4_in_E_Minor%2C_Op._98_-_IV._Allegro_Energico_e_Passionato.ogg" },
        ]
    },
    {
        title: "교향곡 제6번 '비창'", bwv: "Op. 74", composer: "P. I. TCHAIKOVSKY", performer: "Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "TCHAIKOVSKY", labelTitle: "교향곡 6번 b단조", labelArtist: "SYMPHONY ORCHESTRA", jTitle: "PATHÉTIQUE", jSub1: "차이코프스키 교향곡 6번", jSub2: "B minor · Op. 74",
        labelBg: "#cdd4e0", jacketBg: "#20283a", accent: "#3a4a8a", side: "A", cover: "5/51/Pyotr_Tchaikovsky_%D1%81._1870.jpg",
        tracks: [
            { t: "I. Adagio – Allegro non troppo", f: "b/b7/Tchaikovsky%2C_Symphony_No._6_In_B_Minor%2C_Op._74%2C_%27Pathetique%27_-_I._Adagio%2C_Allegro_Non_Troppo.ogg" },
            { t: "II. Allegro con grazia", f: "a/aa/Tchaikovsky%2C_Symphony_No._6_in_B_minor%2C_Op._74%2C_%27Pathetique%27_-_II._Allegro_con_gracia.ogg" },
            { t: "III. Allegro molto vivace", f: "c/c4/Tchaikovsky%2C_Symphony_No._6_in_B_minor%2C_Op._74%2C_%27Pathetique%27_-_III._Allegro_molto_vivace.ogg" },
            { t: "IV. Finale – Adagio lamentoso", f: "e/e8/Tchaikovsky%2C_Symphony_No._6_in_B_minor%2C_Op._74%2C_%27Pathetique%27_-_IV._Finale_Adagio_lamentoso.ogg" },
        ]
    },
    {
        title: "피아노 협주곡 제1번", bwv: "Op. 23", composer: "P. I. TCHAIKOVSKY", performer: "Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "TCHAIKOVSKY", labelTitle: "피아노 협주곡 1번", labelArtist: "SYMPHONY ORCHESTRA", jTitle: "CONCERTO No.1", jSub1: "차이코프스키 피아노 협주곡 1번", jSub2: "B-flat minor · Op. 23",
        labelBg: "#d4cfe0", jacketBg: "#241f30", accent: "#5a3a8a", side: "A", cover: "5/51/Pyotr_Tchaikovsky_%D1%81._1870.jpg",
        tracks: [
            { t: "I. Allegro non troppo e molto maestoso", f: "4/48/Tchaikovsky%2C_Concerto_No.1_in_B-flat_minor_Op.23%2C_I._Allegro.ogg" },
            { t: "II. Andantino semplice", f: "e/e2/Tchaikovsky%2C_Concerto_No.1_in_B-flat_minor_Op.23%2C_II._Andantino.ogg" },
            { t: "III. Allegro con fuoco", f: "0/01/Tchaikovsky%2C_Concerto_No.1_in_B-flat_minor_Op.23%2C_III._Allegro.ogg" },
        ]
    },
    {
        title: "교향곡 제9번 '신세계로부터'", bwv: "Op. 95", composer: "A. DVOŘÁK", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "DVOŘÁK", labelTitle: "교향곡 9번 e단조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "NEW WORLD", jSub1: "드보르작 교향곡 9번", jSub2: "'From the New World' · Op. 95",
        labelBg: "#d5ddd0", jacketBg: "#232f26", accent: "#3a6b4a", side: "A", cover: "9/94/Anton%C3%ADn_Dvo%C5%99%C3%A1k%2C_portrait.jpg",
        tracks: [
            { t: "I. Adagio – Allegro molto", f: "5/5c/Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27%2C_op._95_-_i._adagio_-_allegro_molto.ogg" },
            { t: "II. Largo", f: "c/c3/Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27%2C_op._95_-_ii._largo.ogg" },
            { t: "III. Molto vivace", f: "b/bd/Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27%2C_op._95_-_iii._molto_vivace.ogg" },
            { t: "IV. Allegro con fuoco", f: "1/17/Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27%2C_op._95_-_iv._allegro_con_fuoco.ogg" },
        ]
    },
    {
        title: "아이네 클라이네 나흐트무지크", bwv: "K. 525", composer: "W. A. MOZART", performer: "Serenade Ensemble", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "MOZART", labelTitle: "세레나데 13번 G장조", labelArtist: "SERENADE ENSEMBLE", jTitle: "K. 525", jSub1: "아이네 클라이네 나흐트무지크", jSub2: "Serenade No. 13 · G major",
        labelBg: "#eadfc4", jacketBg: "#e9e0c8", accent: "#8a6a1f", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",
        tracks: [
            { t: "I. Allegro", f: "6/68/Mozart_K525_Serenade_in_G_Major_1_-_Allegro.ogg" },
            { t: "II. Romanze", f: "b/be/Mozart_K525_Serenade_in_G_Major_2_-_Romance.ogg" },
            { t: "III. Menuetto", f: "a/a0/Mozart_K525_Serenade_in_G_Major_3_-_Minuet.ogg" },
            { t: "IV. Rondo", f: "3/3b/Mozart_K525_Serenade_in_G_Major_4_-_Rondo.ogg" },
        ]
    },
    {
        title: "교향곡 제35번 '하프너'", bwv: "K. 385", composer: "W. A. MOZART", performer: "European Archive", credit: "음원: European Archive · Musopen · PD · Wikimedia Commons",
        labelBig: "MOZART", labelTitle: "교향곡 35번 D장조", labelArtist: "EUROPEAN ARCHIVE", jTitle: "HAFFNER", jSub1: "모차르트 교향곡 35번 '하프너'", jSub2: "D major · K. 385",
        labelBg: "#e6dcc0", jacketBg: "#2c2820", accent: "#8a6a2a", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",
        tracks: [
            { t: "I. Allegro con spirito", f: "7/78/Symphony_no._35_in_D_%27Haffner%27_K._385_I._Allegro_con_spirito_%28Mozart%29_European_Archive.ogg" },
            { t: "II. Andante", f: "a/a1/Symphony_no._35_in_D_%27Haffner%27_K._385_II._Andante_%28Mozart%29_European_Archive.ogg" },
            { t: "III. Minuetto", f: "c/cc/Symphony_no._35_in_D_%27Haffner%27_K._385_III._Minuetto_%28Mozart%29_European_Archive.ogg" },
            { t: "IV. Finale · Presto", f: "7/7a/Symphony_no._35_in_D_%27Haffner%27_K._385_IV._Finale_Presto_%28Mozart%29_European_Archive.ogg" },
        ]
    },
    {
        title: "교향곡 제4번 '이탈리아'", bwv: "Op. 90", composer: "F. MENDELSSOHN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "MENDELSSOHN", labelTitle: "교향곡 4번 A장조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "ITALIAN", jSub1: "멘델스존 교향곡 4번 '이탈리아'", jSub2: "A major · Op. 90",
        labelBg: "#e6dcc2", jacketBg: "#2e2820", accent: "#b07a1f", side: "A", cover: "thumb/c/c2/Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg/960px-Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg",
        tracks: [
            { t: "I. Allegro vivace", f: "6/67/Mendelssohn%2C_Symphony_No._4_in_A_Major%2C_Op._90_%27Italian%27_-_I._Allegro_vivace.ogg" },
            { t: "II. Andante con moto", f: "9/9f/Mendelssohn%2C_Symphony_No._4_in_A_Major%2C_Op._90_%27Italian%27_-_II._Andante_con_moto.ogg" },
            { t: "III. Con moto moderato", f: "3/3f/Mendelssohn%2C_Symphony_No._4_in_A_Major%2C_Op._90_%27Italian%27_-_III._Con_moto_moderato.ogg" },
            { t: "IV. Saltarello (Presto)", f: "1/1d/Mendelssohn%2C_Symphony_No._4_in_A_Major%2C_Op._90_%27Italian%27_-_IV._Saltarello_%28Presto%29.ogg" },
        ]
    },
    {
        title: "피아노 협주곡 a단조", bwv: "Op. 16", composer: "E. GRIEG", performer: "Musopen Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "GRIEG", labelTitle: "피아노 협주곡 a단조", labelArtist: "MUSOPEN ORCHESTRA", jTitle: "CONCERTO", jSub1: "그리그 피아노 협주곡", jSub2: "A minor · Op. 16",
        labelBg: "#cfdae0", jacketBg: "#1f2a30", accent: "#2f6a8a", side: "A", cover: "thumb/a/ad/Hans_Heyerdahl_-_Portrett_av_Edvard_Grieg_-_Oslo_Museum_-_OB.00036.jpg/960px-Hans_Heyerdahl_-_Portrett_av_Edvard_Grieg_-_Oslo_Museum_-_OB.00036.jpg",
        tracks: [
            { t: "I. Allegro molto moderato", f: "9/9a/Edvard_Grieg_-_piano_concerto_in_a_minor%2C_op._16_-_i._allegro_molto_moderato.ogg" },
            { t: "II. Adagio", f: "9/9d/Edvard_Grieg_-_piano_concerto_in_a_minor%2C_op._16_-_ii._adagio.ogg" },
            { t: "III. Allegro moderato molto e marcato", f: "1/11/Edvard_Grieg_-_piano_concerto_in_a_minor%2C_op._16_-_iii._allegro_moderato_molto.ogg" },
        ]
    },
    {
        title: "방랑자 환상곡", bwv: "D. 760", composer: "F. SCHUBERT", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "SCHUBERT", labelTitle: "환상곡 C장조 '방랑자'", labelArtist: "PIANO SOLO", jTitle: "WANDERER", jSub1: "슈베르트 방랑자 환상곡", jSub2: "C major · Op. 15 · D. 760",
        labelBg: "#e0d2d4", jacketBg: "#2c2226", accent: "#8a3a5a", side: "A", cover: "f/fb/Franz_Schubert_by_Wilhelm_August_Rieder.jpeg",
        tracks: [
            { t: "I. Allegro con fuoco", f: "4/41/Franz_Schubert_-_fantasy_in_c_major_op.15_d.760_%27wanderer%27_-_i._allegro_con_fuoco.ogg" },
            { t: "II. Adagio", f: "1/1f/Franz_Schubert_-_fantasy_in_c_major_op.15_d.760_%27wanderer%27_-_ii._adagio.ogg" },
            { t: "III. Presto", f: "a/a4/Franz_Schubert_-_fantasy_in_c_major_op.15_d.760_%27wanderer%27_-_iii._presto.ogg" },
            { t: "IV. Allegro", f: "1/1e/Franz_Schubert_-_fantasy_in_c_major_op.15_d.760_%27wanderer%27_-_iv._allegro.ogg" },
        ]
    },
    {
        title: "어린이 정경", bwv: "Op. 15", composer: "R. SCHUMANN", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "SCHUMANN", labelTitle: "어린이 정경", labelArtist: "PIANO SOLO", jTitle: "KINDERSZENEN", jSub1: "슈만 어린이 정경", jSub2: "Scenes from Childhood · Op. 15",
        labelBg: "#e2d8cc", jacketBg: "#2a241e", accent: "#7a5236", side: "A", cover: "7/78/Schumann-photo1850.jpg",
        tracks: [
            { t: "1. 낯선 나라와 사람들", f: "c/ce/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_i._of_foreign_lands_and_peoples.ogg" },
            { t: "2. 이상한 이야기", f: "2/2d/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_ii._a_curious_story.ogg" },
            { t: "3. 술래잡기", f: "b/b3/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_iii._blind_man%27s_buff.ogg" },
            { t: "4. 조르는 아이", f: "4/49/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_iv._pleading_child.ogg" },
            { t: "5. 만족", f: "0/04/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_v._happiness.ogg" },
            { t: "6. 중대한 사건", f: "1/14/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_vi._an_important_event.ogg" },
            { t: "7. 트로이메라이", f: "0/06/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_vii._dreaming.ogg" },
            { t: "8. 난롯가에서", f: "0/0a/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_viii._at_the_fireside.ogg" },
            { t: "9. 목마의 기사", f: "7/78/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_ix._knight_of_the_hobbyhorse.ogg" },
            { t: "10. 지나치게 진지하게", f: "5/5a/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_x._almost_too_serious.ogg" },
            { t: "11. 무서움", f: "f/f9/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_xi._frightening.ogg" },
            { t: "12. 잠자는 아이", f: "f/fa/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_xii._child_falling_asleep.ogg" },
            { t: "13. 시인은 말한다", f: "4/42/Robert_Schumann_-_scenes_from_childhood%2C_op._15_-_xiii._the_poet_speaks.ogg" },
        ]
    },
    {
        title: "발라드 전곡", bwv: "Op. 23·38·47·52", composer: "F. CHOPIN", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "CHOPIN", labelTitle: "4개의 발라드", labelArtist: "PIANO SOLO", jTitle: "BALLADES", jSub1: "쇼팽 발라드 전곡", jSub2: "Four Ballades",
        labelBg: "#ddd0d4", jacketBg: "#241c20", accent: "#7a2a4a", side: "A", cover: "thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg",
        tracks: [
            { t: "No. 1 in G minor, Op. 23", f: "3/33/Frederic_Chopin_-_ballade_no._1_in_g_minor%2C_op._23.ogg" },
            { t: "No. 2 in F major, Op. 38", f: "c/cf/Frederic_Chopin_-_ballade_no._2_in_f_major%2C_op._38.ogg" },
            { t: "No. 3 in A-flat major, Op. 47", f: "c/c8/Frederic_Chopin_-_ballade_no._3_in_a_flat_major%2C_op._47.ogg" },
            { t: "No. 4 in F minor, Op. 52", f: "4/4f/Chopin%2C_Fr%C3%A9d%C3%A9ric_-_Ballade_no._4_in_f_minor%2C_op._52.ogg" },
        ]
    },
    {
        title: "스케르초 전곡", bwv: "Op. 20·31·39·54", composer: "F. CHOPIN", performer: "Alice Gi-Young Hwang, piano", credit: "음원: Alice Gi-Young Hwang · Musopen · CC · Wikimedia Commons",
        labelBig: "CHOPIN", labelTitle: "4개의 스케르초", labelArtist: "ALICE GI-YOUNG HWANG", jTitle: "SCHERZI", jSub1: "쇼팽 스케르초 전곡", jSub2: "Four Scherzi",
        labelBg: "#d4d0dd", jacketBg: "#1e1c26", accent: "#4a3a7a", side: "A", cover: "thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg",
        tracks: [
            { t: "No. 1 in B minor, Op. 20", f: "f/f3/Chopin_Scherzo_no._1_in_B_minor%2C_Op._20%2C_Alice_Gi-Young_Hwang.ogg" },
            { t: "No. 2 in B-flat minor, Op. 31", f: "4/45/Chopin_Scherzo_no._2_in_B_flat_minor%2C_Op._31%2C_Alice_Gi-Young_Hwang.ogg" },
            { t: "No. 3 in C-sharp minor, Op. 39", f: "9/91/Chopin_Scherzo_no._3_in_C_sharp_minor%2C_Op._39%2C_Alice_Gi-Young_Hwang.ogg" },
            { t: "No. 4 in E major, Op. 54", f: "8/80/Chopin_Scherzo_no._4_in_E_major%2C_Op._54%2C_Alice_Gi-Young_Hwang.ogg" },
        ]
    },
    {
        title: "피아노 소나타 제2번 '장송'", bwv: "Op. 35", composer: "F. CHOPIN", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "CHOPIN", labelTitle: "소나타 2번 b♭단조", labelArtist: "PIANO SOLO", jTitle: "Op. 35", jSub1: "쇼팽 피아노 소나타 2번", jSub2: "'Funeral March' · B-flat minor",
        labelBg: "#d2ccce", jacketBg: "#1c1a1c", accent: "#5a2a3a", side: "A", cover: "thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg",
        tracks: [
            { t: "I. Grave – Doppio movimento", f: "3/39/Frederic_Chopin_Piano_Sonata_No.2_in_B_flat_minor_Op35_-_I_Grave_Doppio_Movimento.ogg" },
            { t: "II. Scherzo", f: "f/f7/Frederic_Chopin_Piano_Sonata_No.2_in_B_flat_minor_Op35_-_II_Scherzo.ogg" },
            { t: "III. Marche funèbre", f: "b/b2/Frederic_Chopin_Piano_Sonata_No.2_in_B_flat_minor_Op35_-_III_Marche_Funebre.ogg" },
            { t: "IV. Finale · Presto", f: "7/73/Frederic_Chopin_Piano_Sonata_No.2_in_B_flat_minor_Op35_-_IV_Finale_Presto.ogg" },
        ]
    },
    {
        title: "녹턴집", bwv: "Op. 9·15·48·55·72", composer: "F. CHOPIN", performer: "Piano solo", credit: "음원: Musopen · PD/CC · Wikimedia Commons",
        labelBig: "CHOPIN", labelTitle: "녹턴 선집", labelArtist: "PIANO SOLO", jTitle: "NOCTURNES", jSub1: "쇼팽 녹턴집", jSub2: "Selected Nocturnes",
        labelBg: "#cdd0d8", jacketBg: "#161822", accent: "#3a4a6a", side: "A", cover: "thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg",
        tracks: [
            { t: "Op. 9 No. 1 in B-flat minor", f: "b/bf/Chopin%2C_Nocturne_No._1_in_B_Flat_Minor%2C_Op._9.ogg" },
            { t: "Op. 9 No. 2 in E-flat major", f: "0/04/Chopin_Nocturne_No._2_in_E_Flat_Major%2C_Op._9.ogg" },
            { t: "Op. 15 No. 1 in F major", f: "5/56/Chopin_-_Nocturne_Op._15_no._1_in_F_major.ogg" },
            { t: "Op. 15 No. 2 in F-sharp major", f: "2/29/Chopin_-_Nocturne_Op._15_no._2_in_F_sharp_major.ogg" },
            { t: "Op. 48 No. 1 in C minor", f: "e/e7/Chopin_Nocturne_in_C_minor_Op._48_no._1_Luke_Faulkner.ogg" },
            { t: "Op. 48 No. 2 in F-sharp minor", f: "a/a0/Chopin_Nocturne_in_F_sharp_minor_Op_48_no_2_Luke_Faulkner.ogg" },
            { t: "Op. 55 No. 1 in F minor", f: "2/2f/Chopin_-_Nocturne-op-55-no-1.ogg" },
            { t: "Op. 55 No. 2 in E-flat major", f: "8/8f/Chopin_-_Nocturne-op-55-no-2.ogg" },
            { t: "Op. posth. 72 No. 1 in E minor", f: "c/c2/Chopin_-_Nocturne_Op._posth._72_no._1.ogg" },
        ]
    },
    {
        title: "현악 4중주 '종달새'", bwv: "Op. 64-5", composer: "J. HAYDN", performer: "String Quartet", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "HAYDN", labelTitle: "현악 4중주 D장조", labelArtist: "STRING QUARTET", jTitle: "THE LARK", jSub1: "하이든 현악 4중주 '종달새'", jSub2: "D major · Op. 64 No. 5",
        labelBg: "#dce0d2", jacketBg: "#282e22", accent: "#5a6a2a", side: "A", cover: "e/e5/Joseph_Haydn%2C_portrait_by_Thomas_Hardy.jpg",
        tracks: [
            { t: "I. Allegro moderato", f: "1/11/Haydn_StringQuartetInDMajorOp.64_JosephHaydn-StringQuartetInDOp.645H363Lark-01-AllegroModerato.ogg" },
            { t: "II. Adagio cantabile", f: "f/f0/Haydn_StringQuartetInDMajorOp.64_JosephHaydn-StringQuartetInDOp.645H363Lark-02-AdagioCantabile.ogg" },
            { t: "III. Menuetto · Allegretto", f: "0/01/Haydn_StringQuartetInDMajorOp.64_JosephHaydn-StringQuartetInDOp.645H363Lark-03-MenuettoAllegretto.ogg" },
            { t: "IV. Finale · Vivace", f: "4/4d/Haydn_StringQuartetInDMajorOp.64_JosephHaydn-StringQuartetInDOp.645H363Lark-04-FinaleVivace.ogg" },
        ]
    },
    {
        title: "비엔나 왈츠집", bwv: "Waltzes", composer: "J. STRAUSS II", performer: "Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",
        labelBig: "J. STRAUSS", labelTitle: "비엔나 왈츠집", labelArtist: "ORCHESTRA", jTitle: "WIENER WALZER", jSub1: "요한 슈트라우스 2세", jSub2: "Viennese Waltzes",
        labelBg: "#eaddc2", jacketBg: "#2e2618", accent: "#b0862a", side: "A", cover: "thumb/6/67/Johann_Strauss_II_by_Fritz_Luckhardt.jpg/960px-Johann_Strauss_II_by_Fritz_Luckhardt.jpg",
        tracks: [
            { t: "아름답고 푸른 도나우", f: "9/91/Strauss%2C_An_der_sch%C3%B6nen_blauen_Donau.ogg" },
            { t: "황제 왈츠", f: "a/a6/Strauss%2C_Kaiserwalzer.ogg" },
            { t: "비엔나 기질", f: "a/a9/Johann_Strauss_-_Wiener_Blut_Op._354.ogg" },
            { t: "남국의 장미", f: "b/bd/Strauss%2C_Rosen_aus_dem_S%C3%BCden.ogg" },
            { t: "예술가의 생애", f: "e/ea/Strauss%2C_K%C3%BCnstlerleben.ogg" },
            { t: "빈 숲속의 이야기", f: "1/19/Johann_Strauss_-_G%27schichten_aus_dem_Wienerwald%2C_Op.325.ogg" },
        ]
    },
    {
        title: "첼로 소품집", bwv: "Cello Encores", composer: "CELLO RECITAL", performer: "John Michel, violoncello", credit: "음원: John Michel · CC BY-SA 3.0 · Wikimedia Commons",
        labelBig: "ENCORES", labelTitle: "첼로 앙코르 소품집", labelArtist: "JOHN MICHEL, CELLO", jTitle: "CELLO", jSub1: "존 미셸 첼로 소품집", jSub2: "Encores & Miniatures",
        labelBg: "#d8c8b0", jacketBg: "#2a2018", accent: "#7a4a24", side: "A", cover: "thumb/4/4b/Violoncello_MET_DT7705.jpg/960px-Violoncello_MET_DT7705.jpg",
        tracks: [
            { t: "Saint-Saëns · 백조", f: "d/db/JOHN_MICHEL_CELLO-SAINT_SAENS_CARNIVAL_OF_ANIMALS_THE_SWAN.ogg" },
            { t: "Bach · 아베 마리아", f: "d/d4/JOHN_MICHEL_CELLO-BACH_AVE_MARIA.ogg" },
            { t: "Cassadó · Requiebros", f: "6/6a/CELLO_ENCORES_JOHN_MICHEL-Cassado_Requiebros.ogg" },
            { t: "Popper · 요정의 춤", f: "5/55/CELLO_ENCORES_JOHN_MICHEL-Popper_Dance_of_the_Elves.ogg" },
            { t: "Goens · Scherzo", f: "3/31/CELLO_ENCORES_JOHN_MICHEL-Goens_Scherzo.ogg" },
            { t: "de Falla · 스페인 모음곡 1", f: "7/7f/CELLO_ENCORES_JOHN_MICHEL-da_Falla_Suite_Populaire_Espagnole_1st.ogg" },
            { t: "de Falla · 스페인 모음곡 5", f: "9/90/CELLO_ENCORES_JOHN_MICHEL-da_Falla_Suite_Populaire_Espagnole_5th.ogg" },
            { t: "Lidström · Tango", f: "e/e1/CELLO_ENCORES_JOHN_MICHEL-Mats_Lidstrom_Tango.ogg" },
            { t: "Paganini · 한 줄을 위한 변주곡", f: "3/39/CELLO_ENCORES_JOHN_MICHEL-Paganini_Variations_on_One_String.ogg" },
        ]
    },
    {

        title: "교향곡 제3번 '영웅'", bwv: "Op. 55", composer: "L. van BEETHOVEN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "교향곡 3번 E♭장조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "EROICA", jSub1: "베토벤 교향곡 3번 '영웅'", jSub2: "E-flat major · Op. 55",

        labelBg: "#e6dcc0", jacketBg: "#2a2c34", accent: "#7a2e28", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Allegro con brio", f: "d/da/Beethoven_SymphonyNo.3Eroica_LudwigVanBeethoven-SymphonyNo.3InEFlatMajorEroicaOp.55-01-AllegroConBrio.ogg" },

            { t: "II. Marcia funebre", f: "1/14/Beethoven_SymphonyNo.3Eroica_LudwigVanBeethoven-SymphonyNo.3InEFlatMajorEroicaOp.55-02-MarciaFunebreAdagioAssai.ogg" },

            { t: "III. Scherzo. Allegro", f: "0/07/Beethoven_SymphonyNo.3Eroica_LudwigVanBeethoven-SymphonyNo.3InEFlatMajorEroicaOp.55-03-ScherzoAllegroVivace.ogg" },

            { t: "IV. Finale. Allegro molto", f: "6/6e/Beethoven_SymphonyNo.3Eroica_LudwigVanBeethoven-SymphonyNo.3InEFlatMajorEroicaOp.55-04-FinaleAllegroMolto.ogg" },

        ]

    },

    {

        title: "교향곡 제8번", bwv: "Op. 93", composer: "L. van BEETHOVEN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "교향곡 8번 F장조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SYMPHONY No.8", jSub1: "베토벤 교향곡 8번", jSub2: "F major · Op. 93",

        labelBg: "#dfe3d0", jacketBg: "#3a4a3f", accent: "#4a6741", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Allegro vivace e con brio", f: "2/28/Ludwig_van_Beethoven_-_symphony_no._8_in_f_major%2C_op._93_-_i._allegro_vivace_e_con_brio.ogg" },

            { t: "II. Allegretto scherzando", f: "8/89/Ludwig_van_Beethoven_-_symphony_no._8_in_f_major%2C_op._93_-_ii._allegretto_scherzando.ogg" },

            { t: "III. Tempo di menuetto", f: "f/fe/Ludwig_van_Beethoven_-_symphony_no._8_in_f_major%2C_op._93_-_iii._tempo_di_menuetto.ogg" },

            { t: "IV. Allegro vivace", f: "2/2d/Ludwig_van_Beethoven_-_symphony_no._8_in_f_major%2C_op._93_-_iv._allegro_vivace.ogg" },

        ]

    },

    {

        title: "피아노 협주곡 제5번 '황제'", bwv: "Op. 73", composer: "L. van BEETHOVEN", performer: "Piano and orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "피아노 협주곡 5번 E♭장조", labelArtist: "MUSOPEN", jTitle: "EMPEROR", jSub1: "베토벤 피아노 협주곡 5번 '황제'", jSub2: "E-flat major · Op. 73",

        labelBg: "#ece2c8", jacketBg: "#1f2733", accent: "#8a6d2f", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Allegro", f: "5/57/Beethoven_Op._73_-_1_Allegro.ogg" },

            { t: "II. Adagio un poco mosso", f: "4/43/Beethoven_Op._73_-_2_Adagio.ogg" },

            { t: "III. Rondo. Allegro", f: "2/2c/Beethoven_Op._73_-_3_Rondo.ogg" },

        ]

    },

    {

        title: "관악 6중주", bwv: "Op. 71", composer: "L. van BEETHOVEN", performer: "Wind ensemble", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "관악 6중주 E♭장조", labelArtist: "MUSOPEN", jTitle: "WIND SEXTET", jSub1: "베토벤 관악 6중주", jSub2: "E-flat major · Op. 71",

        labelBg: "#e4e0cf", jacketBg: "#45473f", accent: "#6b5b3e", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Adagio - Allegro", f: "0/03/Ludwig_van_Beethoven_-_wind_sextet_in_e_flat%2C_op._71_-_i._adagio_-_allegro.ogg" },

            { t: "II. Adagio", f: "4/46/Ludwig_van_Beethoven_-_wind_sextet_in_e_flat%2C_op._71_-_ii._adagio.ogg" },

            { t: "III. Menuetto", f: "2/24/Ludwig_van_Beethoven_-_wind_sextet_in_e_flat%2C_op._71_-_iii._menuetto_-_quasi_allegretto.ogg" },

            { t: "IV. Rondo - Allegro", f: "b/bf/Ludwig_van_Beethoven_-_wind_sextet_in_e_flat%2C_op._71_-_iv._rondo_-_allegro.ogg" },

        ]

    },

    {

        title: "피아노 소나타 제15번 '전원'", bwv: "Op. 28", composer: "L. van BEETHOVEN", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "피아노 소나타 15번 '전원'", labelArtist: "PIANO SOLO", jTitle: "PASTORALE", jSub1: "베토벤 피아노 소나타 15번 '전원'", jSub2: "D major · Op. 28",

        labelBg: "#dde7d3", jacketBg: "#33402f", accent: "#4d6b3a", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Allegro", f: "5/54/Ludwig_van_Beethoven_-_sonata_no._15_in_d_major%2C_op._28_%27pastorale%27_-_i._allegro.ogg" },

            { t: "II. Andante", f: "4/49/Ludwig_van_Beethoven_-_sonata_no._15_in_d_major%2C_op._28_%27pastorale%27_-_ii._andante.ogg" },

            { t: "III. Scherzo. Allegro vivace", f: "e/e6/Ludwig_van_Beethoven_-_sonata_no._15_in_d_major%2C_op._28_%27pastorale%27_-_iii._scherzo._allegro_vivace.ogg" },

            { t: "IV. Rondo. Allegro", f: "c/c6/Ludwig_van_Beethoven_-_sonata_no._15_in_d_major%2C_op._28_%27pastorale%27_-_iv._rondo._allegro%2C_ma_non_troppo.ogg" },

        ]

    },

    {

        title: "현악 4중주 제6번", bwv: "Op. 18 No. 6", composer: "L. van BEETHOVEN", performer: "Musopen String Quartet", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BEETHOVEN", labelTitle: "현악 4중주 6번 B♭장조", labelArtist: "MUSOPEN QUARTET", jTitle: "QUARTET No.6", jSub1: "베토벤 현악 4중주 6번", jSub2: "B-flat major · Op. 18/6",

        labelBg: "#e6dfd0", jacketBg: "#35323c", accent: "#5b4a6b", side: "A", cover: "thumb/6/6f/Beethoven.jpg/960px-Beethoven.jpg",

        tracks: [

            { t: "I. Allegro con brio", f: "e/eb/Beethoven_StringQuartetNo.6inBFlatMajorOp.18_LudwigVanBeethoven-StringQuartetNo.6InBFlatMajorOp.18No.6-01-AllegroConBrio.ogg" },

            { t: "II. Adagio, ma non troppo", f: "7/7d/Beethoven_StringQuartetNo.6inBFlatMajorOp.18_LudwigVanBeethoven-StringQuartetNo.6InBFlatMajorOp.18No.6-02-AdagioMaNonTroppo.ogg" },

            { t: "III. Scherzo. Allegro", f: "d/d1/Beethoven_StringQuartetNo.6inBFlatMajorOp.18_LudwigVanBeethoven-StringQuartetNo.6InBFlatMajorOp.18No.6-03-ScherzoAllegro.ogg" },

            { t: "IV. La malinconia", f: "7/75/Beethoven_StringQuartetNo.6inBFlatMajorOp.18_LudwigVanBeethoven-StringQuartetNo.6InBFlatMajorOp.18No.6-04-adagioLaMalinconia.ogg" },

        ]

    },

    {

        title: "교향곡 제2번", bwv: "Op. 73", composer: "J. BRAHMS", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BRAHMS", labelTitle: "교향곡 2번 D장조", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SYMPHONY No.2", jSub1: "브람스 교향곡 2번", jSub2: "D major · Op. 73",

        labelBg: "#e3ddcd", jacketBg: "#2f2a26", accent: "#6b4a2e", side: "A", cover: "a/a2/Johannes_Brahms_portrait.jpg",

        tracks: [

            { t: "I. Allegro non troppo", f: "e/e6/Brahms%2C_Symphony_No._2_in_D_Major%2C_Op._73_-_I._Allegro_non_troppo.ogg" },

            { t: "II. Adagio non troppo", f: "7/77/Brahms%2C_Symphony_No._2_in_D_Major%2C_Op._73_-_II._Adagio_non_troppo.ogg" },

            { t: "III. Allegretto grazioso", f: "8/83/Brahms%2C_Symphony_No._2_in_D_Major%2C_Op._73_-_III._Allegretto_Grazioso.ogg" },

            { t: "IV. Allegro con spirito", f: "7/76/Brahms%2C_Symphony_No._2_in_D_Major%2C_Op._73_-_IV._Allegro_Con_Spirito.ogg" },

        ]

    },

    {

        title: "이중 협주곡", bwv: "Op. 102", composer: "J. BRAHMS", performer: "Violin, cello and orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BRAHMS", labelTitle: "이중 협주곡 A단조", labelArtist: "MUSOPEN", jTitle: "DOUBLE CONCERTO", jSub1: "브람스 이중 협주곡", jSub2: "A minor · Op. 102",

        labelBg: "#e0dccb", jacketBg: "#2a2e33", accent: "#4a5a6b", side: "A", cover: "1/11/Johannes_Brahms_1853.jpg",

        tracks: [

            { t: "I. Allegro", f: "5/52/Johannes_Brahms_-_concerto_in_a_minor%2C_op._102_%27double_concerto%27_-_i._allegro.ogg" },

            { t: "II. Andante", f: "4/47/Johannes_Brahms_-_concerto_in_a_minor%2C_op._102_%27double_concerto%27_-_ii._andante.ogg" },

            { t: "III. Vivace non troppo", f: "2/29/Johannes_Brahms_-_concerto_in_a_minor%2C_op._102_%27double_concerto%27_-_iii._vivace_non_troppo.ogg" },

        ]

    },

    {

        title: "교향곡 제29번", bwv: "K. 201", composer: "W. A. MOZART", performer: "Chamber orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "MOZART", labelTitle: "교향곡 29번 A장조", labelArtist: "MUSOPEN", jTitle: "SYMPHONY No.29", jSub1: "모차르트 교향곡 29번", jSub2: "A major · K. 201",

        labelBg: "#efe6d6", jacketBg: "#3a3550", accent: "#8a5a3a", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",

        tracks: [

            { t: "I. Allegro moderato", f: "b/b6/IMSLP348253-PMLP01555-Mozart_29-1.ogg" },

            { t: "II. Andante", f: "e/e7/IMSLP348254-PMLP01555-Mozart_29-2.ogg" },

            { t: "III. Menuetto", f: "8/80/IMSLP348255-PMLP01555-Mozart_29-3.ogg" },

            { t: "IV. Allegro con spirito", f: "1/1d/IMSLP348256-PMLP01555-Mozart_29-4.ogg" },

        ]

    },

    {

        title: "오보에 협주곡", bwv: "K. 314", composer: "W. A. MOZART", performer: "European Archive", credit: "음원: · European Archive · Musopen · PD ·",

        labelBig: "MOZART", labelTitle: "오보에 협주곡 C장조", labelArtist: "EUROPEAN ARCHIVE", jTitle: "OBOE CONCERTO", jSub1: "모차르트 오보에 협주곡", jSub2: "C major · K. 314",

        labelBg: "#e7ecdc", jacketBg: "#45543f", accent: "#5a7a4a", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",

        tracks: [

            { t: "I. Allegro", f: "7/7d/Oboe_Concerto_in_C_K.314_271k_I._Allegro_%28Mozart%29_European_Archive.ogg" },

            { t: "II. Andantino", f: "8/86/Oboe_Concerto_in_C_K.314_271k_II._Andantino_%28Mozart%29_European_Archive.ogg" },

            { t: "III. Rondo. Allegro", f: "0/00/Oboe_Concerto_in_C_K.314_271k_III._Rondo_Allegro_%28Mozart%29_European_Archive.ogg" },

        ]

    },

    {

        title: "피아노 협주곡 제17번", bwv: "K. 453", composer: "W. A. MOZART", performer: "Piano and orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "MOZART", labelTitle: "피아노 협주곡 17번 G장조", labelArtist: "MUSOPEN", jTitle: "CONCERTO No.17", jSub1: "모차르트 피아노 협주곡 17번", jSub2: "G major · K. 453",

        labelBg: "#ece3d8", jacketBg: "#40384a", accent: "#7a4a6a", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",

        tracks: [

            { t: "I. Allegro", f: "3/38/Mozart_-_Concerto_No.17_in_G_-_I._Allegro.ogg" },

            { t: "II. Andante", f: "e/ef/Mozart_-_Concerto_No.17_in_G_-_II._Andante.ogg" },

            { t: "III. Allegretto", f: "c/c7/Mozart_-_Concerto_No.17_in_G_-_III._Allegretto.ogg" },

        ]

    },

    {

        title: "피아노 소나타 제13번", bwv: "K. 333", composer: "W. A. MOZART", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "MOZART", labelTitle: "피아노 소나타 13번 B♭장조", labelArtist: "PIANO SOLO", jTitle: "SONATA No.13", jSub1: "모차르트 피아노 소나타 13번", jSub2: "B-flat major · K. 333",

        labelBg: "#ede8d6", jacketBg: "#4a4436", accent: "#8a6a3a", side: "A", cover: "thumb/f/fc/Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg/960px-Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_%281819%29.jpg",

        tracks: [

            { t: "I. Allegro", f: "d/d1/Wolfgang_Amadeus_Mozart_-_sonata_no._13_in_b_flat_major%2C_k.333_-_i._allegro.ogg" },

            { t: "II. Andante cantabile", f: "7/78/Wolfgang_Amadeus_Mozart_-_sonata_no._13_in_b_flat_major%2C_k.333_-_ii._andante_cantabile.ogg" },

            { t: "III. Allegretto grazioso", f: "1/14/Wolfgang_Amadeus_Mozart_-_sonata_no._13_in_b_flat_major%2C_k.333_-_iii._allegretto_grazioso.ogg" },

        ]

    },

    {

        title: "교향곡 제3번 '스코틀랜드'", bwv: "Op. 56", composer: "F. MENDELSSOHN", performer: "Musopen Symphony Orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "MENDELSSOHN", labelTitle: "교향곡 3번 '스코틀랜드'", labelArtist: "MUSOPEN SYMPHONY", jTitle: "SCOTTISH", jSub1: "멘델스존 교향곡 3번 '스코틀랜드'", jSub2: "A minor · Op. 56",

        labelBg: "#dde3d5", jacketBg: "#2e3a34", accent: "#3e5a4a", side: "A", cover: "thumb/c/c2/Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg/960px-Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg",

        tracks: [

            { t: "I. Andante con moto - Allegro", f: "8/82/The_Musopen_Symphony_Orchestra_-_Mendelssohn%27s_Symphony_No._3_in_A_minor%2C_Op._56%2C_MWV_N_18_-_I._Andante_con_moto-Allegro_un_poco_agitato.ogg" },

            { t: "II. Vivace non troppo", f: "d/d0/The_Musopen_Symphony_Orchestra_-_Mendelssohn%27s_Symphony_No._3_in_A_minor%2C_Op._56%2C_MWV_N_18_-_II._Vivace_non_troppo.ogg" },

            { t: "III. Adagio", f: "c/cf/The_Musopen_Symphony_Orchestra_-_Mendelssohn%27s_Symphony_No._3_in_A_minor%2C_Op._56%2C_MWV_N_18_-_III._Adagio.ogg" },

            { t: "IV. Allegro vivacissimo", f: "f/f1/The_Musopen_Symphony_Orchestra_-_Mendelssohn%27s_Symphony_No._3_in_A_minor%2C_Op._56%2C_MWV_N_18_-_IV._Allegro_vivacissimo-Allegro_maestoso_assai.ogg" },

        ]

    },

    {

        title: "한여름 밤의 꿈", bwv: "Op. 61", composer: "F. MENDELSSOHN", performer: "European Archive", credit: "음원: · European Archive · Musopen · PD ·",

        labelBig: "MENDELSSOHN", labelTitle: "한여름 밤의 꿈 모음곡", labelArtist: "EUROPEAN ARCHIVE", jTitle: "MIDSUMMER", jSub1: "멘델스존 '한여름 밤의 꿈'", jSub2: "Incidental music · Op. 61",

        labelBg: "#dce6dd", jacketBg: "#27352c", accent: "#4a6b4f", side: "A", cover: "thumb/c/c2/Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg/960px-Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg",

        tracks: [

            { t: "Overture", f: "b/b0/A_Midsummer_Night%27s_Dream_Op._61_Overture_%28Mendelssohn%29_European_Archive.ogg" },

            { t: "Scherzo", f: "7/71/A_Midsummer_Night%27s_Dream_Op._61_Scherzo_%28Mendelssohn%29_European_Archive.ogg" },

            { t: "Song with Choir", f: "2/2e/A_Midsummer_Night%27s_Dream_Op._61_Song_with_choir_%28Mendelssohn%29_European_Archive.ogg" },

            { t: "Wedding March", f: "c/cb/A_Midsummer_Night%27s_Dream_Op._61_Wedding_March_%28Mendelssohn%29_European_Archive.ogg" },

            { t: "Dance of the Clowns", f: "4/4f/A_Midsummer_Night%27s_Dream_Op._61_Dance_of_Clowns_%28Mendelssohn%29_European_Archive.ogg" },

        ]

    },

    {

        title: "현악 4중주 제6번", bwv: "Op. 80", composer: "F. MENDELSSOHN", performer: "String quartet", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "MENDELSSOHN", labelTitle: "현악 4중주 6번 F단조", labelArtist: "STRING QUARTET", jTitle: "QUARTET No.6", jSub1: "멘델스존 현악 4중주 6번", jSub2: "F minor · Op. 80",

        labelBg: "#e2ddcf", jacketBg: "#382e30", accent: "#6b3a4a", side: "A", cover: "thumb/c/c2/Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg/960px-Felix_Mendelssohn_Bartholdy_by_Eduard_Magnus_%281833%29.jpg",

        tracks: [

            { t: "I. Allegro vivace assai", f: "6/66/IMSLP247103-PMLP27022-String_Quartet_No._6_in_F_minor%2C_Op._80_-_I._Allegro_vivace_assai.ogg" },

            { t: "II. Allegro assai", f: "1/1e/IMSLP247104-PMLP27022-String_Quartet_No._6_in_F_minor%2C_Op._80_-_II._Allegro_assai.ogg" },

            { t: "III. Adagio", f: "0/04/IMSLP247105-PMLP27022-String_Quartet_No._6_in_F_minor%2C_Op._80_-_III._Adagio.ogg" },

            { t: "IV. Finale. Allegro molto", f: "3/3d/IMSLP247106-PMLP27022-String_Quartet_No._6_in_F_minor%2C_Op._80_-_IV._Fuga.ogg" },

        ]

    },

    {

        title: "피아노 소나타 제13번", bwv: "D. 664", composer: "F. SCHUBERT", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "SCHUBERT", labelTitle: "피아노 소나타 13번 A장조", labelArtist: "PIANO SOLO", jTitle: "SONATA D.664", jSub1: "슈베르트 피아노 소나타 13번", jSub2: "A major · D. 664",

        labelBg: "#e6e0d0", jacketBg: "#33303a", accent: "#5a4a7a", side: "A", cover: "f/fb/Franz_Schubert_by_Wilhelm_August_Rieder.jpeg",

        tracks: [

            { t: "I. Allegro moderato", f: "2/24/Schubert%2C_Sonata_A_Major%2C_D._664_-_I._Allegro_moderato.ogg" },

            { t: "II. Andante", f: "6/62/Schubert%2C_Sonata_A_Major%2C_D._664_-_II._Andante.ogg" },

            { t: "III. Allegro", f: "7/7e/Schubert%2C_Sonata_A_Major%2C_D._664_-_III._Allegro.ogg" },

        ]

    },

    {

        title: "피아노 협주곡", bwv: "Op. 54", composer: "R. SCHUMANN", performer: "Piano and orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "SCHUMANN", labelTitle: "피아노 협주곡 A단조", labelArtist: "MUSOPEN", jTitle: "CONCERTO", jSub1: "슈만 피아노 협주곡", jSub2: "A minor · Op. 54",

        labelBg: "#e4dece", jacketBg: "#2e2a34", accent: "#7a4a3a", side: "A", cover: "7/78/Schumann-photo1850.jpg",

        tracks: [

            { t: "I. Allegro affettuoso", f: "e/ea/Schumann_-_Piano_Concerto_in_A_minor_Op.54_-_I._Allegro.ogg" },

            { t: "II. Intermezzo & III. Allegro vivace", f: "9/9e/Schumann_-_Piano_Concerto_in_A_minor_Op.54_-_II._Intermezzo_and_III._Allegro_vivace.ogg" },

        ]

    },

    {

        title: "교향곡 제4번", bwv: "Op. 36", composer: "P. I. TCHAIKOVSKY", performer: "European Archive", credit: "음원: · European Archive · Musopen · PD ·",

        labelBig: "TCHAIKOVSKY", labelTitle: "교향곡 4번 F단조", labelArtist: "EUROPEAN ARCHIVE", jTitle: "SYMPHONY No.4", jSub1: "차이콥스키 교향곡 4번", jSub2: "F minor · Op. 36",

        labelBg: "#e0dccb", jacketBg: "#2a2f3a", accent: "#5a3a4a", side: "A", cover: "5/51/Pyotr_Tchaikovsky_%D1%81._1870.jpg",

        tracks: [

            { t: "I. Andante sostenuto", f: "d/dc/P.I._Tchalkovsky_Symphony_No.4_in_F_Minor_Op.36_I._Andante_sossenuto_%28Tchaikovsky%29_European_Archive.ogg" },

            { t: "II. Andantino", f: "9/97/P.I._Tchalkovsky_Symphony_No.4_in_F_Minor_Op.36_II._Andantino_%28Tchaikovsky%29_European_Archive.ogg" },

            { t: "III. Scherzo. Pizzicato ostinato", f: "f/f6/P.I._Tchaikovsky_Symphony_No.4_in_F_minor_Op.36_III._Scherzo_%28Tchaikovsky%29_European_Archive.ogg" },

            { t: "IV. Finale. Allegro con fuoco", f: "5/5e/P.I._Tchalkovsky_Symphony_No.4_in_F_Minor_Op.36_IV._Finale_Allegro_con_fuocco_%28Tchaikovsky%29_European_Archive.ogg" },

        ]

    },

    {

        title: "백조의 호수 (발췌)", bwv: "Op. 20", composer: "P. I. TCHAIKOVSKY", performer: "Ballet orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "TCHAIKOVSKY", labelTitle: "발레 '백조의 호수'", labelArtist: "MUSOPEN", jTitle: "SWAN LAKE", jSub1: "차이콥스키 '백조의 호수'", jSub2: "Ballet · Op. 20",

        labelBg: "#dfe4ea", jacketBg: "#26303f", accent: "#3a5a7a", side: "A", cover: "5/51/Pyotr_Tchaikovsky_%D1%81._1870.jpg",

        tracks: [

            { t: "Act I - Introduction", f: "4/4f/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_I_Intro.ogg" },

            { t: "Act II - Part 1", f: "8/82/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_II_Pt.1.ogg" },

            { t: "Act II - Conclusion", f: "8/81/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_II_Concl.ogg" },

            { t: "Act III - Part 1", f: "b/b4/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_III_Pt.1.ogg" },

            { t: "Act III - Conclusion", f: "2/2b/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_III_Concl%2C_Allegro.ogg" },

            { t: "Act IV - Introduction", f: "5/51/Tchaikovsky_-_Swan_Lake_Op.20_-_Act_IV_Intro.ogg" },

        ]

    },

    {

        title: "이탈리아 협주곡", bwv: "BWV 971", composer: "J. S. BACH", performer: "Harpsichord solo", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BACH", labelTitle: "이탈리아 협주곡 F장조", labelArtist: "HARPSICHORD", jTitle: "ITALIAN CONCERTO", jSub1: "바흐 이탈리아 협주곡", jSub2: "F major · BWV 971",

        labelBg: "#e8e0cc", jacketBg: "#33302a", accent: "#7a5a2e", side: "A", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",

        tracks: [

            { t: "I. (Allegro)", f: "a/a8/J._S._Bach_-_Italian_Concerto%2C_BWV._971_-_1._Without_tempo_indication.ogg" },

            { t: "II. Andante", f: "c/c4/J._S._Bach_-_Italian_Concerto%2C_BWV._971_-_2._Andante.ogg" },

            { t: "III. Presto", f: "1/1c/J._S._Bach_-_Italian_Concerto%2C_BWV._971_-_3._Presto.ogg" },

        ]

    },

    {

        title: "하프시코드 협주곡 제5번", bwv: "BWV 1056", composer: "J. S. BACH", performer: "Harpsichord and strings", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "BACH", labelTitle: "하프시코드 협주곡 5번", labelArtist: "MUSOPEN", jTitle: "BWV 1056", jSub1: "바흐 하프시코드 협주곡 5번", jSub2: "F minor · BWV 1056",

        labelBg: "#e5ddc9", jacketBg: "#2e2b26", accent: "#6b4a2a", side: "A", cover: "thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg",

        tracks: [

            { t: "I. Allegro", f: "e/eb/Harpsichord_Concerto_no._5_in_F_minor%2C_BWV_1056_-_I._Allegro.ogg" },

            { t: "II. Largo", f: "a/aa/Harpsichord_Concerto_no._5_in_F_minor%2C_BWV_1056_-_II._Largo.ogg" },

            { t: "III. Presto", f: "9/95/Harpsichord_Concerto_no._5_in_F_minor%2C_BWV_1056_-_III._Presto.ogg" },

        ]

    },

    {

        title: "합주 협주곡 (Op. 3)", bwv: "HWV 312-317", composer: "G. F. HANDEL", performer: "Baroque orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "HANDEL", labelTitle: "합주 협주곡 Op. 3", labelArtist: "MUSOPEN", jTitle: "CONCERTI GROSSI", jSub1: "헨델 합주 협주곡 Op. 3", jSub2: "HWV 312-317",

        labelBg: "#e9e1cd", jacketBg: "#35302a", accent: "#8a6a3a", side: "A", cover: "9/9f/George_Frideric_Handel_by_Thomas_Hudson_-_1756.jpg",

        tracks: [

            { t: "No. 1 in B-flat, HWV 312", f: "3/32/Concerto_Grosso_in_B-flat_major_HWV_312.mp3" },

            { t: "No. 2 in B-flat, HWV 313", f: "4/4b/Concerto_Grosso_in_B-flat_major%2C_HWV_313.mp3" },

            { t: "No. 3 in G, HWV 314", f: "a/a0/Concerto_Grosso_in_G_major%2C_HWV_314.mp3" },

            { t: "No. 4 in F, HWV 315", f: "d/da/Concerto_Grosso_in_F_major%2C_HWV_315.mp3" },

            { t: "No. 5 in D minor, HWV 316", f: "2/2b/Concerto_Grosso_in_D_minor_HWV_316.mp3" },

            { t: "No. 6 in D, HWV 317", f: "3/3e/Concerto_Grosso_in_D_major_HWV_317.mp3" },

        ]

    },

    {

        title: "첼로 협주곡 제1번", bwv: "Op. 33", composer: "C. SAINT-SAËNS", performer: "Cello and orchestra", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "SAINT-SAENS", labelTitle: "첼로 협주곡 1번 A단조", labelArtist: "MUSOPEN", jTitle: "CELLO CONCERTO", jSub1: "생상스 첼로 협주곡 1번", jSub2: "A minor · Op. 33",

        labelBg: "#e2ddd0", jacketBg: "#2c2a30", accent: "#6b3a3a", side: "A", cover: "thumb/a/a0/Portrait_of_Camille_Saint-Sa%C3%ABns_by_Henri_Manuel.jpg/960px-Portrait_of_Camille_Saint-Sa%C3%ABns_by_Henri_Manuel.jpg",

        tracks: [

            { t: "I. Allegro non troppo", f: "d/d1/Camille_Saint-Saens_-_cello_concerto_no._1_in_a_minor%2C_op._33_-_i._allegro_non_troppo.ogg" },

            { t: "II. Allegretto con moto", f: "9/97/Camille_Saint-Saens_-_cello_concerto_no._1_in_a_minor%2C_op._33_-_ii._allegretto_con_mot.ogg" },

            { t: "III. Tempo primo", f: "2/2e/Camille_Saint-Saens_-_cello_concerto_no._1_in_a_minor%2C_op._33_-_iii._%28tempo_primo%29.ogg" },

        ]

    },

    {

        title: "즉흥곡 전곡", bwv: "Op. 29·36·51·66", composer: "F. CHOPIN", performer: "Piano solo", credit: "음원: Musopen · PD · Wikimedia Commons",

        labelBig: "CHOPIN", labelTitle: "즉흥곡 (Impromptus)", labelArtist: "PIANO SOLO", jTitle: "IMPROMPTUS", jSub1: "쇼팽 즉흥곡 전곡", jSub2: "Op. 29 · 36 · 51 · 66",

        labelBg: "#ece0e0", jacketBg: "#2e2830", accent: "#7a3a5a", side: "A", cover: "thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg",

        tracks: [

            { t: "No. 1 in A-flat, Op. 29", f: "9/9a/Impromptu_no._1_-_Op._29.mp3" },

            { t: "No. 2 in F-sharp, Op. 36", f: "1/1e/Impromptu_no._2_-_Op._36.mp3" },

            { t: "No. 3 in G-flat, Op. 51", f: "1/1e/Impromptu_no._3_-_Op._51.mp3" },

            { t: "No. 4 Fantaisie-Impromptu, Op. 66", f: "2/2b/Fantaisie_Impromptu_Op._66.mp3" },

        ]

    }

];
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
            '<text x="1700" y="' + y + '" font-family="Arial" font-size="' + (rowFont + 1) + '" font-weight="700" fill="#8a7d70">' + (i + 1) + '</text>' +
            '<text x="1728" y="' + y + '" font-family="Georgia, serif" font-size="' + rowFont + '" fill="#d9cfc0">' + tr.t + '</text>' +
            '<rect id="ttTrackHit' + i + '" x="1690" y="' + (y - 26) + '" width="286" height="' + (rowStep - 4) + '" fill="#000" fill-opacity="0" style="cursor:pointer"><title>' + tr.t + ' 재생</title></rect>';
    }).join("");
    document.getElementById("ttStage").innerHTML =
        // viewBox를 위아래로 40씩 넓혀(640→720) 콘텐츠 좌표는 그대로 두고 여백만 확보한다
        '<svg class="tt-svg" viewBox="0 -40 2000 720" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="YAHAMA PL-12 턴테이블">' +
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
        '<rect x="0" y="-40" width="2000" height="720" rx="10" fill="url(#ttWood)"/>' +
        '<rect x="24" y="-16" width="1952" height="672" rx="8" fill="#17161a" stroke="#0a0a0c" stroke-width="2"/>' +
        '<text x="60" y="72" font-family="Arial" font-size="26" font-weight="700" letter-spacing="1.5" fill="#e6e5e8">YAHAMA PL-12</text>' +
        '<text x="60" y="98" font-family="Arial" font-size="12" letter-spacing="2.5" fill="#8a7d70">BELT-DRIVE TURNTABLE</text>' +
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
        '<circle cx="560" cy="330" r="278" fill="#26262b"/>' +
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
        '<text x="1690" y="86" font-family="Arial" font-size="14" font-weight="700" letter-spacing="2" fill="#8a7d70">SIDE ' + (RECORD.side || 'A') + '</text>' +
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
        '<text x="60" y="648" font-family="Arial" font-size="12" fill="#8a7d70">' + RECORD.credit + '</text>' +
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
    if (gainNode) gainNode.gain.value = volumeLevel * PHONO_GAIN;
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
    if (gainNode) gainNode.gain.value = volumeLevel;
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

    const rpm = ttRpm45 ? 45 : 100 / 3;
    const spinTarget = (phonoActive && isPlaying) ? 1 : 0;
    const step = spinTarget > ttSpin ? dt / 1.4 : dt / 2.6;   // 스핀업은 빠르게, 런다운은 관성으로
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
        const target = (isPlaying && !audio.muted) ? (0.006 + ttDust * 0.048) : 0;
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
        if (hissGain) hissGain.gain.value += ((deckSegPlaying ? 0.004 : 0.01) - hissGain.gain.value) * 0.1;
    } else if (deckMode === "wind") {
        tapePos = Math.max(0, Math.min(TAPE_LEN, tapePos + windDir * 16 * dt));
        if (tapePos <= 0 || tapePos >= TAPE_LEN) { deckMode = "stop"; windDir = 0; }
    }
    const deckRolling = (deckMode === "play") || (deckMode === "rec" && recorder);
    const spinRate = deckMode === "wind" ? 900 * windDir : (deckRolling ? 210 : 0);
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
    volumeLevel = value / 100;
    if (gainNode) {
        gainNode.gain.value = volumeLevel * (phonoActive ? PHONO_GAIN : 1);
    } else {
        audio.volume = volumeLevel;
    }
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
