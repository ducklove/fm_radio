// 오디오 엔진 모듈 — Web Audio 그래프, EQ 체인, 앰프 보이싱, 크랙클/히스, 오디오 상태 머신.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// 오디오 그래프: source → gain(청취 볼륨) → 스피커, source → recDest(원음 레벨) → MediaRecorder, source → analyser(VU)
let audioCtx = null;
let gainNode = null;
let recDest = null;
let analyser = null;
let blendFilter = null;
let monoGain = null;
// 하이파이 랙 체인: EQ(5밴드) → 앰프(드라이브→쉐이퍼→톤→출력), 크랙클(포노 전용)
let eqNodes = null;
let ampDrive = null;
let ampShaper = null;
let ampBass = null;
let ampMid = null;
let ampTreble = null;
let ampOut = null;
let crackleGain = null;
let crackleSrc = null;
let vuRaf = null;
let vuData = null;
let recorder = null;
let recStartMs = 0;
let recTimerId = null;
let recordingCount = 0;

function applyBlend() {
    // 하이블렌드: 고음을 깎아 약전계 잡음을 줄이는 효과 (MSE 경로에서만 실제 적용)
    if (blendFilter) blendFilter.frequency.value = blendOn ? 5000 : 20000;
}

function applyMono() {
    // 모노: 게인 노드 입력을 1채널로 강제해 다운믹스
    if (monoGain) {
        monoGain.channelCount = 1;
        monoGain.channelCountMode = monoOn ? "explicit" : "max";
    }
}

function applyEq() {
    if (!eqNodes) return;
    const g = eqState.gains[eqModelId];
    eqNodes.forEach((b, i) => { b.gain.value = eqState.on ? (g[i] || 0) : 0; });
}

// EQ 밴드를 현재 모델로 (재)구성해 monoGain→EQ→ampDrive로 연결한다.
// 크랙클·히스처럼 EQ 입력에 물리는 소스도 함께 재연결한다.
function buildEqChain() {
    if (!audioCtx || !monoGain || !ampDrive) return;
    try { monoGain.disconnect(); } catch (e) {}
    if (eqNodes) eqNodes.forEach((n) => { try { n.disconnect(); } catch (e) {} });
    if (crackleGain) { try { crackleGain.disconnect(); } catch (e) {} }
    if (hissGain) { try { hissGain.disconnect(); } catch (e) {} }
    const m = EQ_MODELS[eqModelId];
    eqNodes = m.freqs.map((f) => {
        const b = audioCtx.createBiquadFilter();
        b.type = "peaking";
        b.frequency.value = f;
        b.Q.value = m.q;
        return b;
    });
    let head = monoGain;
    eqNodes.forEach((b) => { head = head.connect(b); });
    head.connect(ampDrive);
    if (crackleGain) crackleGain.connect(eqNodes[0]);
    if (hissGain) hissGain.connect(eqNodes[0]);
    applyEq();
}

function tubeCurve(k, asym) {
    const n = 1024;
    const c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * 2 - 1;
        const shifted = x + asym * (1 - x * x);   // 비대칭 → 짝수 배음
        c[i] = Math.tanh(k * shifted) / norm;
    }
    return c;
}

function applyAmp() {
    if (!ampDrive) return;
    const m = AMP_MODELS[ampModelId];
    ampDrive.gain.value = m.drive;
    ampShaper.curve = m.k > 0 ? tubeCurve(m.k, m.asym) : null;
    ampBass.frequency.value = m.bass[0];
    ampBass.gain.value = m.bass[1];
    ampMid.frequency.value = m.mid[0];
    ampMid.gain.value = m.mid[1];
    ampMid.Q.value = m.mid[2];
    ampTreble.frequency.value = m.treble[0];
    ampTreble.gain.value = m.treble[1];
    ampOut.gain.value = m.out;
}

function setVolumeLevel(v) {
    volumeLevel = Math.max(0, Math.min(1, v));
    if (gainNode) {
        gainNode.gain.value = volumeLevel * (phonoActive ? PHONO_GAIN : 1);
    } else {
        try { audio.volume = volumeLevel; } catch (e) {}
    }
    updateVolKnob();
}

function needleThump() {
    if (!audioCtx) return;
    try {
        const dur = 0.22;
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, Math.floor(sr * dur), sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            const t = i / sr;
            d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 28) * 0.6 + Math.sin(2 * Math.PI * 38 * t) * Math.exp(-t * 18) * 0.5;
        }
        const s = audioCtx.createBufferSource();
        s.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.value = 0.22;
        s.connect(g);
        g.connect(eqNodes ? eqNodes[0] : audioCtx.destination);
        s.start();
    } catch (e) {}
}

function ensureCrackle() {
    if (!audioCtx || !crackleGain || crackleSrc) return;
    try {
        const dur = 3;
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, sr * dur, sr);
        const d = buf.getChannelData(0);
        let dust = 0;
        for (let i = 0; i < d.length; i++) {
            let v = (Math.random() * 2 - 1) * 0.012;      // 표면 노이즈
            if (Math.random() < 0.00012) dust = 0.25 + Math.random() * 0.75;  // 먼지 팝
            if (dust > 0.001) { v += (Math.random() * 2 - 1) * dust; dust *= 0.72; }
            d[i] = v;
        }
        crackleSrc = audioCtx.createBufferSource();
        crackleSrc.buffer = buf;
        crackleSrc.loop = true;
        crackleSrc.connect(crackleGain);
        crackleSrc.start();
    } catch (e) { crackleSrc = null; }
}

function ensureAudioGraph() {
    if (audioCtx) return true;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !window.MediaRecorder) return false;

    try {
        audioCtx = new Ctx();
        const source = audioCtx.createMediaElementSource(audio);
        gainNode = audioCtx.createGain();
        recDest = audioCtx.createMediaStreamDestination();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        // BLEND(고음 감쇠)·MODE(모노 다운믹스) 스위치용 노드를 청취 경로에 삽입
        blendFilter = audioCtx.createBiquadFilter();
        blendFilter.type = "lowpass";
        monoGain = audioCtx.createGain();
        // 앰프 스테이지: drive → 진공관 쉐이퍼 → 톤(저/중/고) → 출력
        ampDrive = audioCtx.createGain();
        ampShaper = audioCtx.createWaveShaper();
        ampShaper.oversample = "4x";
        ampBass = audioCtx.createBiquadFilter();
        ampBass.type = "lowshelf";
        ampMid = audioCtx.createBiquadFilter();
        ampMid.type = "peaking";
        ampTreble = audioCtx.createBiquadFilter();
        ampTreble.type = "highshelf";
        ampOut = audioCtx.createGain();
        source.connect(gainNode).connect(blendFilter).connect(monoGain);
        ampDrive.connect(ampShaper).connect(ampBass).connect(ampMid).connect(ampTreble).connect(ampOut).connect(audioCtx.destination);
        // 바이닐 크랙클 (포노 재생 시에만 게인이 올라간다) — EQ 앞에 섞어 앰프 음색까지 입힌다
        crackleGain = audioCtx.createGain();
        crackleGain.gain.value = 0;
        // EQ 밴드는 현재 모델(GE-5/GE-10)로 구성 — monoGain→EQ→ampDrive + 크랙클/히스 연결
        buildEqChain();
        source.connect(recDest);
        source.connect(analyser);
        applyBlend();
        applyMono();
        applyAmp();
        gainNode.gain.value = volumeLevel * (phonoActive ? PHONO_GAIN : 1);
        audio.volume = 1;
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        if (isPlaying) startVu();
        return true;
    } catch (error) {
        console.error(error);
        audioCtx = null;
        gainNode = null;
        recDest = null;
        analyser = null;
        blendFilter = null;
        monoGain = null;
        eqNodes = null;
        ampDrive = null;
        ampShaper = null;
        ampBass = null;
        ampMid = null;
        ampTreble = null;
        ampOut = null;
        crackleGain = null;
        return false;
    }
}

function pickRecMime() {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/ogg;codecs=opus"
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}


// ----- 오디오 상태 머신 -----
// idle | resolving | buffering | playing | blocked | error
// 상태 변경은 반드시 setAudioState로 — 표시는 audiostate 이벤트를 구독하는 쪽(app.js)이 담당한다.
let audioState = "idle";
let audioStateInfo = "";
function setAudioState(state, info) {
    info = info || "";
    if (audioState === state && audioStateInfo === info) return;
    audioState = state;
    audioStateInfo = info;
    document.dispatchEvent(new CustomEvent("audiostate", { detail: { state: state, info: info } }));
}
