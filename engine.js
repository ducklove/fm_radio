// 오디오 엔진 모듈 — Web Audio 그래프, EQ 체인, 앰프 보이싱, 크랙클/히스, 오디오 상태 머신.
// 클래식 스크립트 — 전역 렉시컬 스코프를 공유한다. 로드 순서: store→skins→engine→deck→app.

// 오디오 그래프: source → 입력 기준 레벨 → 앰프 → master gain(청취 볼륨) → 스피커.
// 청취 볼륨과 출력관 구동을 분리해 작은 음량에서도 모델 고유의 배음·댐핑이 유지된다.
let audioCtx = null;
let gainNode = null;
// 예약 녹음 전용 백그라운드 수신기 — 본체 <audio>(청취)와 완전히 분리된 히든 체인.
// bgRecAudio → MediaElementSource → 녹음 탭/분석기만 연결, 스피커에는 연결하지 않는다.
// 따라서 현재 재생(라디오·음반·테이프)과 무관하게 무음으로 녹음된다.
let bgRecAudio = null;
let bgRecPlayer = null;
let bgRecCtx = null;      // 전용 AudioContext — VU 레벨 표시용 (WebKit에선 무음 탭이라 참고용)
let bgRecSource = null;
let bgRecDest = null;
let bgRecAnalyser = null;
// 스트림 원본 바이트 캡처 — WebKit은 MediaElementSource가 MSE/HLS 요소에서 무음이라
// 오디오 스택을 태핑하는 녹음이 불가능하다. 대신 hls.js가 버퍼에 붙이는 fMP4/MP3
// 바이트를 그대로 이어붙여 원본 음질의 재생 가능한 파일을 만든다 (모든 엔진 공통 경로).
let bgRecCap = { active: false, mime: "", init: null, chunks: [], bytes: 0, rolling: [] };
// ----- 마이크 입력 (REC INPUT: LINE/MIC) -----
// 실제 데크의 MIC 단자 — 본체 그래프와 완전 분리된 getUserMedia 스트림을
// MediaRecorder로 직접 녹음한다 (MediaElementSource가 아니므로 WebKit에서도 동작).
// 모니터 출력은 연결하지 않는다 (스피커 하울링 방지) — 아날라이저는 VU 표시용.
let micStream = null;
let micCtx = null;
let micAnalyser = null;
let micArmed = false;    // REC INPUT 셀렉터가 MIC 위치인가 (세션 한정 — 영속하지 않는다)
let recIsMic = false;    // 진행 중인 recorder가 마이크 녹음인가 (소스 전환·pause에 안 죽는다)

async function micEnable() {
    if (micStream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    // 에코 제거·노이즈 억제·AGC 전부 끔 — 방을 있는 그대로 담는 것이 데크답다
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    micStream = stream;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        micCtx = new Ctx();
        micCtx.createMediaStreamSource(stream).connect(micAnalyser = micCtx.createAnalyser());
        micAnalyser.fftSize = 1024;
        if (micCtx.state === "suspended") micCtx.resume();
    } catch (e) { micAnalyser = null; }   // 미터 없이도 녹음은 가능
    // 브라우저 UI로 권한을 회수하면 트랙이 끝난다 — 셀렉터를 LINE으로 되돌린다
    stream.getTracks().forEach((t) => { t.onended = () => micDisable(); });
    return true;
}

function micDisable() {
    if (recorder && recIsMic) stopRecording();
    if (micStream) micStream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    if (micCtx) { try { micCtx.close(); } catch (e) {} }
    micStream = null;
    micCtx = null;
    micAnalyser = null;
    micArmed = false;
    if (typeof deckMicPaint === "function") deckMicPaint();
}
let ampInputTrim = null;
let recDest = null;
// 수동(LINE) 녹음 헤드룸 — 대부분의 데크는 큰 신호에서 살짝 포화되지만,
// TCD 3014A(Actilinear)만은 무포화로 받는다. 녹음 경로에만 걸린다 (청취 무관).
let recSatShaper = null;
let recSatCurveCache = null;

function recSatCurve() {
    if (recSatCurveCache) return recSatCurveCache;
    const n = 2048;
    const c = new Float32Array(n);
    const knee = 0.78, ceiling = 0.96;
    for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * 2 - 1;
        const sign = x < 0 ? -1 : 1;
        const mag = Math.abs(x);
        c[i] = sign * (mag <= knee ? mag : knee + (ceiling - knee) * Math.tanh((mag - knee) / (1 - knee)));
    }
    recSatCurveCache = c;
    return c;
}

function applyRecHeadroom() {
    if (!recSatShaper) return;
    recSatShaper.curve = (typeof deckModelId !== "undefined" && deckModelId === "tcd3014") ? null : recSatCurve();
}
let analyser = null;
let blendFilter = null;
// 소스 보이싱 — 튜너/턴테이블/데크 모델의 음색 시그니처를 싣는 셸프 한 쌍.
// 라디오면 TUNER_VOICE[스킨], 포노면 TT_VOICE[모델], 테이프면 아지무스 감쇠(외부 테이프).
let voiceLow = null;
let voiceHigh = null;
let monoGain = null;
// 하이파이 랙 체인: EQ → 전압증폭관 → 톤 → 출력관 → 전원 새그 → 출력트랜스/스피커 부하
let eqNodes = null;
let ampDrive = null;
let ampShaper = null;
let ampBass = null;
let ampLowMid = null;
let ampMid = null;
let ampPresence = null;
let ampTreble = null;
let ampPowerDrive = null;
let ampPowerShaper = null;
let ampSag = null;
let ampTransformerHP = null;
let ampTransformerLP = null;
let ampDampingBass = null;
let ampDampingHigh = null;
let ampSpeakerResonance = null;
let ampSpeakerDelay = null;
let ampSpeakerTone = null;
let ampSpeakerFeedback = null;
let ampSpeakerWet = null;
let ampOut = null;
// ----- 프런트패널 유저 컨트롤 스테이지 (ampOut → … → gainNode) -----
// 앰프별 톤 노브·밸런스·서브소닉·감쇠와 GE-5 SPATIAL 폭을 하나의 스테이지로 통일한다.
// 노브 값은 fmRadio.frontPanel(플랫 키)에 영속되고, 현재 장착된 모델의 컨트롤만 실효된다.
let fp = null;                                          // { bass, treble, slope, bands[5], subsonic, att, split, merge, mLL, mLR, mRL, mRR }
let frontPanel = loadJson("fmRadio.frontPanel", {});
let speakersOff = false;                                // SPEAKERS 스위치 (세션 한정 — 무음 고착 방지)
let ampMuting20 = false;                                // E-303 MUTING -20dB (세션 한정)
let monitorMuted = false;                               // 데크 MON/MONITOR — 녹음 모니터 소거 (세션 한정)
let eqPowerOn = loadJson("fmRadio.frontPanel", {})["eq.power"] !== false;
// 녹음 경로 유저 컨트롤 — MPX 필터·BIAS 틸트·REC LEVEL L/R. 예약 녹음(원본 바이트 캡처)은 통과하지 않는다.
let recMpx = null;
let recBias = null;
let recSplit = null;
let recMerge = null;
let recTrimL = null;
let recTrimR = null;
let crackleGain = null;
let crackleSrc = null;
let scratchGain = null;   // 바이닐 문지름(스크래치) 노이즈 — 드래그 세기에 비례해 게인이 올라간다
let scratchSrc = null;
let vuRaf = null;
let vuData = null;
let recorder = null;
let recStartMs = 0;
let recTimerId = null;
let recordingCount = 0;

// MR-78 가변 선택도 — 0=WIDE(개방) 1=NORMAL 2=NARROW(어둡고 정숙). DSP는 MSE 경로 한정.
let tsSelectivity = 0;

// ----- 소스 보이싱 테이블 (low/high 셸프 dB) — 같은 방송·같은 판이라도 기기마다 질감이 다르다 -----
// 실기 세평 기반의 은은한 값 (±1.5dB 안짝) — 착색이 아니라 체온 차이여야 한다.
const TUNER_VOICE = {
    t2: { low: 0, high: 0 },              // 기준기 — 무색
    mr78: { low: 0.5, high: -0.6 },       // 어두운 정숙
    m10b: { low: 1.2, high: -0.9 }        // 진공관 온기
};
const TT_VOICE = {
    sl1200: { low: 0, high: 0 },          // 쿼츠 DD — 중립
    td124: { low: 1.0, high: -0.6 },      // 아이들러의 도톰함
    g301: { low: 1.4, high: -0.4 },       // 방송국 모터의 박력
    lp12: { low: 0.8, high: -0.8 }        // 정숙하고 어두운 배경
};
// 외부(가져온) 테이프의 아지무스 어긋남 — DRAGON의 NAAC만 이를 보정해 평평하게 튼다
const AZIMUTH_LOSS_DB = -4.5;

let voiceSigLast = null;
function applySourceVoice() {
    if (!voiceLow || !voiceHigh || !audioCtx) return;
    let low = 0, high = 0, sig = "none";
    if (typeof phonoActive !== "undefined" && phonoActive) {
        const v = TT_VOICE[ttModelId] || { low: 0, high: 0 };
        low = v.low; high = v.high; sig = "tt:" + ttModelId;
    } else if (typeof deckMode !== "undefined" && deckMode === "play") {
        if (deckTape && deckTape.foreign && deckModelId !== "dragon") high = AZIMUTH_LOSS_DB;
        sig = "tape:" + deckModelId + ":" + !!(deckTape && deckTape.foreign);
    } else if (typeof currentStation !== "undefined" && currentStation) {
        const v = TUNER_VOICE[tunerSkinId] || { low: 0, high: 0 };
        low = v.low; high = v.high; sig = "tuner:" + tunerSkinId;
    }
    if (sig === voiceSigLast) return;
    voiceSigLast = sig;
    voiceLow.gain.setTargetAtTime(low, audioCtx.currentTime, 0.08);
    voiceHigh.gain.setTargetAtTime(high, audioCtx.currentTime, 0.08);
}

function applyBlend() {
    // 하이블렌드: 고음을 깎아 약전계 잡음을 줄이는 효과 (MSE 경로에서만 실제 적용)
    // MR78의 NORMAL/NARROW/SUPER NARROW와 블렌드 중 더 좁은 쪽이 이긴다.
    if (!blendFilter) return;
    const selCap = tsSelectivity === 2 ? 10500 : tsSelectivity === 1 ? 15000 : 20000;
    blendFilter.frequency.value = Math.min(blendOn ? 5000 : 20000, selCap);
}

function applyMono() {
    // 모노: 게인 노드 입력을 1채널로 강제해 다운믹스
    if (monoGain) {
        monoGain.channelCount = 1;
        monoGain.channelCountMode = monoOn ? "explicit" : "max";
    }
}

let eqBufferShaper = null;
let eqBufferCurveCache = null;
function eqBufferCurve() {
    if (eqBufferCurveCache) return eqBufferCurveCache;
    const n = 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * 2 - 1;
        // 아주 순한 비대칭 tanh — 낮은 2차 배음의 윤기만 남긴다
        c[i] = Math.tanh(x * 1.06 + 0.02 * x * x) / Math.tanh(1.06);
    }
    eqBufferCurveCache = c;
    return c;
}

function applyEq() {
    if (!eqNodes) return;
    if (eqBufferShaper) eqBufferShaper.curve = eqLive() ? eqBufferCurve() : null;
    const g = eqState.gains[eqModelId];
    eqNodes.forEach((b, i) => {
        const v = eqLive() ? (g[i] || 0) : 0;
        // 짧은 타임 콘스턴트로 램프 — 프리셋 전환·A/B 비교 시 지퍼 노이즈 방지
        if (audioCtx) b.gain.setTargetAtTime(v, audioCtx.currentTime, 0.03);
        else b.gain.value = v;
    });
}

// EQ 밴드를 현재 모델로 (재)구성해 monoGain→EQ→ampDrive로 연결한다.
// 크랙클·히스처럼 EQ 입력에 물리는 소스도 함께 재연결한다.
function buildEqChain() {
    if (!audioCtx || !monoGain || !ampDrive) return;
    try { monoGain.disconnect(); } catch (e) {}
    if (eqNodes) eqNodes.forEach((n) => { try { n.disconnect(); } catch (e) {} });
    if (crackleGain) { try { crackleGain.disconnect(); } catch (e) {} }
    if (scratchGain) { try { scratchGain.disconnect(); } catch (e) {} }
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
    eqBufferShaper = null;
    head.connect(ampDrive);
    if (crackleGain) crackleGain.connect(eqNodes[0]);
    if (scratchGain) scratchGain.connect(eqNodes[0]);
    if (hissGain) hissGain.connect(eqNodes[0]);
    applyEq();
}

// 진공관 스테이지 전달함수. 양/음 반주기의 곡률 차이로 싱글엔디드의 짝수 배음과
// 푸시풀의 대칭적인 홀수 배음을 구분한다. 생기는 DC는 출력 트랜스 HP가 차단한다.
const valveCurveCache = new WeakMap();
function valveCurve(stage) {
    if (!stage || ((!stage.k || stage.k <= 0) && stage.knee == null)) return null;
    if (valveCurveCache.has(stage)) return valveCurveCache.get(stage);
    const n = 4096;
    const c = new Float32Array(n);
    const kind = stage.kind || "pentode";
    const asym = Math.max(-.8, Math.min(.8, stage.asym || 0));
    const even = Math.max(-.15, Math.min(.15, stage.even || 0));
    const body = Math.max(0, Math.min(.14, stage.body || 0));
    const crossover = Math.max(0, Math.min(.025, stage.crossover || 0));
    const transfer = (mag, k) => {
        if (mag <= 0) return 0;
        if (kind === "triode") return (1 - Math.exp(-k * mag)) / (1 - Math.exp(-k));
        if (kind === "beam") return Math.atan(k * mag) / Math.atan(k);
        return Math.tanh(k * mag) / Math.tanh(k);
    };
    for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * 2 - 1;
        const sign = x < 0 ? -1 : 1;
        let mag = Math.abs(x);
        // 클래스 AB 바이어스 전환부의 아주 작은 gm 노치. 정상 레벨에서는 거의 사라지고
        // 잔향과 저레벨 신호에서만 푸시풀 특유의 결을 남긴다.
        if (crossover > 0) {
            const loss = crossover * (1 - mag) * Math.exp(-mag * 18);
            mag = Math.max(0, mag - loss);
        }
        let shaped;
        if (stage.knee != null) {
            // ADI SHARC의 smootherstep 클리퍼를 하이파이용 C² 소프트 니로 변형했다.
            // knee 아래는 정확히 선형이고, ±1에서 1·2차 미분이 모두 0이 되어
            // 파형의 위아래가 모서리 없이 둥글게 포화한다.
            const knee = Math.max(.5, Math.min(.96, stage.knee));
            const ceiling = Math.max(knee, Math.min(.99, stage.ceiling || .95));
            if (mag <= knee) {
                shaped = mag;
            } else {
                const width = 1 - knee;
                const t = (mag - knee) / width;
                const q = (ceiling - knee) / width;
                const soft = t + (10 * q - 6) * t ** 3 + (8 - 15 * q) * t ** 4 + (6 * q - 3) * t ** 5;
                shaped = knee + width * soft;
            }
            // 정상 청취 레벨에서도 관종별 gm 곡률이 사라지지 않도록 아주 완만한
            // 3차 압축 성분을 남긴다. 소프트 니의 C² 연속성은 그대로 유지된다.
            shaped -= body * shaped * shaped * shaped;
            // 싱글엔디드 300B에만 작은 제곱항을 남겨 2차 배음을 만든다.
            // 포화 곡선 자체는 양·음 모두 같은 C² 소프트 니를 유지한다.
            c[i] = sign * shaped + even * shaped * shaped;
        } else {
            shaped = transfer(mag, Math.max(.05, stage.k));
            // 기존 솔리드스테이트 스킨과의 호환용 전달함수.
            c[i] = (sign * shaped + asym * shaped * shaped) / (1 + Math.abs(asym));
        }
    }
    valveCurveCache.set(stage, c);
    return c;
}

// 댐핑 팩터를 실제 시간축 스피커 부하로 변환한다. 낮은 DF일수록 우퍼 공진 Q,
// 저역 에너지의 짧은 피드백 꼬리와 회복 시간이 커진다. 방 잔향을 더하는 리버브가
// 아니라 출력 임피던스가 높은 앰프에 물린 드라이버의 에너지 저장을 근사한 것이다.
function speakerLoadProfile(circuit) {
    const damping = circuit && circuit.damping || { factor: 80, bass: [70, 0, .8] };
    const factor = Math.max(1, damping.factor || 80);
    const looseness = Math.max(0, Math.min(1, (24 - factor) / 22));
    return {
        factor,
        looseness,
        resonance: damping.bass[0] || 70,
        q: .75 + looseness * .7,
        delay: .0055 + looseness * .0065,
        feedback: looseness * .55,
        wet: looseness * .14,
        tone: 900 + (1 - looseness) * 700
    };
}

function sampleValveStage(stage, x) {
    const curve = valveCurve(stage);
    if (!curve) return x;
    const clamped = Math.max(-1, Math.min(1, x));
    const index = Math.round((clamped + 1) * .5 * (curve.length - 1));
    return curve[index];
}

// 자동 검증과 설명서 수치 확인용 읽기 전용 진단 표면.
window.MFA_AmpDSP = Object.freeze({
    inspect(id) {
        const model = AMP_MODELS[id];
        const c = model && model.circuit;
        if (!c) return null;
        const speaker = speakerLoadProfile(c);
        return {
            topology: c.topology,
            dampingFactor: c.damping.factor,
            sagRatio: c.sag.ratio,
            transformerBand: [c.transformer.low, c.transformer.high],
            drive: [c.pre.drive, c.power.drive],
            knees: [c.pre.knee, c.power.knee],
            speakerMemory: speaker
        };
    },
    sample(id, stageName, x) {
        const model = AMP_MODELS[id];
        const stage = model && model.circuit && model.circuit[stageName];
        return sampleValveStage(stage, x);
    },
    sampleChain(id, x) {
        const model = AMP_MODELS[id];
        const circuit = model && model.circuit;
        if (!circuit) return x;
        const pre = sampleValveStage(circuit.pre, x * circuit.pre.drive);
        return sampleValveStage(circuit.power, pre * circuit.power.drive);
    },
    runtime() {
        return {
            graphReady: !!audioCtx,
            masterGain: gainNode ? gainNode.gain.value : null,
            inputTrim: ampInputTrim ? ampInputTrim.gain.value : null,
            speakerWet: ampSpeakerWet ? ampSpeakerWet.gain.value : null,
            speakerFeedback: ampSpeakerFeedback ? ampSpeakerFeedback.gain.value : null,
            speakerResonance: ampSpeakerResonance ? ampSpeakerResonance.frequency.value : null
        };
    }
});

function setAudioParam(param, value, time) {
    if (!param) return;
    const now = audioCtx ? audioCtx.currentTime : 0;
    try {
        param.cancelScheduledValues(now);
        param.setTargetAtTime(value, now, time || .012);
    } catch (e) { param.value = value; }
}

function applyAmp() {
    if (!ampDrive) return;
    const m = AMP_MODELS[ampModelId];
    const circuit = m.circuit || {};
    const pre = circuit.pre || { drive: m.drive, k: m.k, asym: m.asym, kind: "pentode" };
    const power = circuit.power || { drive: 1, k: 0, asym: 0, kind: "pentode" };
    const sag = circuit.sag || { threshold: 0, knee: 0, ratio: 1, attack: .003, release: .08 };
    const transformer = circuit.transformer || { low: 10, lowQ: .707, high: 36000, highQ: .707 };
    const damping = circuit.damping || { factor: 80, bass: [70, 0, .8], high: [4500, 0] };
    const speaker = speakerLoadProfile(circuit);

    setAudioParam(ampDrive.gain, pre.drive || 1);
    ampShaper.curve = valveCurve(pre);
    ampBass.frequency.value = m.bass[0];
    ampBass.gain.value = m.bass[1];
    const lowMid = m.lowMid || [280, 0, .8];
    ampLowMid.frequency.value = lowMid[0];
    ampLowMid.gain.value = lowMid[1];
    ampLowMid.Q.value = lowMid[2];
    ampMid.frequency.value = m.mid[0];
    ampMid.gain.value = m.mid[1];
    ampMid.Q.value = m.mid[2];
    const presence = m.presence || [3400, 0, .9];
    ampPresence.frequency.value = presence[0];
    ampPresence.gain.value = presence[1];
    ampPresence.Q.value = presence[2];
    ampTreble.frequency.value = m.treble[0];
    ampTreble.gain.value = m.treble[1];
    applyLoudnessComp();

    setAudioParam(ampPowerDrive.gain, power.drive || 1);
    ampPowerShaper.curve = valveCurve(power);
    ampSag.threshold.value = sag.threshold;
    ampSag.knee.value = sag.knee;
    ampSag.ratio.value = sag.ratio;
    ampSag.attack.value = sag.attack;
    ampSag.release.value = sag.release;
    ampTransformerHP.frequency.value = transformer.low;
    ampTransformerHP.Q.value = transformer.lowQ || .707;
    ampTransformerLP.frequency.value = transformer.high;
    ampTransformerLP.Q.value = transformer.highQ || .707;
    ampDampingBass.frequency.value = damping.bass[0];
    ampDampingBass.gain.value = damping.bass[1];
    ampDampingBass.Q.value = damping.bass[2];
    ampDampingHigh.frequency.value = damping.high[0];
    ampDampingHigh.gain.value = damping.high[1];
    ampSpeakerResonance.frequency.value = speaker.resonance;
    ampSpeakerResonance.Q.value = speaker.q;
    ampSpeakerDelay.delayTime.value = speaker.delay;
    ampSpeakerTone.frequency.value = speaker.tone;
    setAudioParam(ampSpeakerFeedback.gain, speaker.feedback, .03);
    setAudioParam(ampSpeakerWet.gain, speaker.wet, .03);
    setAudioParam(ampOut.gain, m.out);
}

function applyGainStaging() {
    if (!gainNode) return;
    // 포노 보정은 앰프 입력에, 사용자의 청취 볼륨은 모든 회로 뒤에 적용한다.
    // 따라서 작은 청취 음량에서도 출력관 구동과 스피커 댐핑 특성이 사라지지 않는다.
    if (ampInputTrim) setAudioParam(ampInputTrim.gain, (phonoActive ? PHONO_GAIN : 1) * fpSourceTrim(), .02);
    setAudioParam(gainNode.gain, volumeLevel, .012);
}

// ----- 프런트패널 상태 (모델별 노브·스위치 영속) -----

function fpGet(key, def) {
    const v = frontPanel[key];
    return v === undefined || v === null ? def : v;
}

function fpSet(key, val) {
    frontPanel[key] = val;
    saveJson("fmRadio.frontPanel", frontPanel);
    applyFrontPanel();
    applyRecPanel();
    applyGainStaging();
}

// MA2375 INPUT TRIM(소스별 게인 기억)과 데크 OUTPUT 노브 — 앰프 입력단에 곱해진다
function fpSourceTrim() {
    let t = 1;
    if (typeof ampModelId !== "undefined" && ampModelId === "ma2375") {
        const src = typeof deckPlaying !== "undefined" && deckPlaying ? "tape"
            : typeof phonoActive !== "undefined" && phonoActive ? "phono" : "radio";
        t *= fpGet("ma2375.trim." + src, 1);
    }
    if (typeof deckPlaying !== "undefined" && deckPlaying) t *= fpGet("deck.out", 1);
    return t;
}

// EQ 실효 상태 — DEFEAT(eqState.on)와 별개로 GE-5/SE-9의 POWER 로커가 회로 전체를 끊는다
function eqLive() {
    return eqState.on && eqPowerOn;
}

// 현재 장착된 모델의 컨트롤만 실효 — 모델을 바꾸면 그 모델의 저장값이 적용되고 나머지는 중립
function applyFrontPanel() {
    if (!fp || !audioCtx) return;
    const m = typeof ampModelId !== "undefined" ? ampModelId : "";
    const tc = 0.03;
    fp.bass.gain.setTargetAtTime(m === "e303" ? fpGet("e303.bass", 0) : 0, audioCtx.currentTime, tc);
    fp.treble.gain.setTargetAtTime(m === "e303" ? fpGet("e303.treble", 0) : 0, audioCtx.currentTime, tc);
    fp.bands.forEach((b, i) => {
        b.gain.setTargetAtTime(m === "ma2375" ? fpGet("ma2375.tone" + i, 0) : 0, audioCtx.currentTime, tc);
    });
    fp.subsonic.frequency.setTargetAtTime(m === "e303" && fpGet("e303.subsonic", false) ? 30 : 12, audioCtx.currentTime, tc);
    // 감쇠: SPEAKERS OFF(무음) × E-303 MUTING(-20dB) — 모두 세션 한정이라 무음 고착이 없다
    fp.att.gain.setTargetAtTime((speakersOff ? 0 : 1) * (m === "e303" && ampMuting20 ? 0.1 : 1), audioCtx.currentTime, tc);
    // 스테레오 매트릭스: 채널 트림(MC2105 L/R GAIN) × 밸런스(E-303) × 폭(GE-5 SPATIAL)
    const gl = m === "mc2105" ? fpGet("mc2105.gainL", 1) : 1;
    const gr = m === "mc2105" ? fpGet("mc2105.gainR", 1) : 1;
    const bal = m === "e303" ? fpGet("e303.balance", 0) : 0;
    const width = typeof eqModelId !== "undefined" && eqModelId === "ge5" && eqLive() ? fpGet("ge5.spatial", 0) : 0;
    const balL = Math.min(1, 1 - bal);
    const balR = Math.min(1, 1 + bal);
    const s = 1 + width * 0.9;   // 폭 0 = 원신호 (LL=1, LR=0)
    fp.mLL.gain.setTargetAtTime(gl * balL * (1 + s) / 2, audioCtx.currentTime, tc);
    fp.mRL.gain.setTargetAtTime(gl * balL * (1 - s) / 2, audioCtx.currentTime, tc);
    fp.mRR.gain.setTargetAtTime(gr * balR * (1 + s) / 2, audioCtx.currentTime, tc);
    fp.mLR.gain.setTargetAtTime(gr * balR * (1 - s) / 2, audioCtx.currentTime, tc);
}

// 녹음 유저 컨트롤 — MPX 필터·BIAS 틸트·REC LEVEL. 수동(더빙) 녹음에만 실효.
function applyRecPanel() {
    if (!recMpx || !audioCtx) return;
    const tc = 0.03;
    recMpx.frequency.setTargetAtTime(fpGet("rec.mpx", false) ? 16000 : 21000, audioCtx.currentTime, tc);
    recBias.gain.setTargetAtTime(fpGet("rec.bias", 0) * 4, audioCtx.currentTime, tc);         // -1..1 → ±4dB
    const lvl = fpGet("rec.level", 1);                                                        // 0.4..2.2
    recTrimL.gain.setTargetAtTime(lvl * fpGet("rec.levelL", 1), audioCtx.currentTime, tc);
    recTrimR.gain.setTargetAtTime(lvl * fpGet("rec.levelR", 1), audioCtx.currentTime, tc);
}

// E-303 LOUDNESS COMP — 저음량 등청감 보상. 볼륨이 낮을수록 저·고역 셸프를 올린다.
// (그려져 있던 LOUDNESS 노브 소생 — 실물 E-303의 컴펜세이터)
let ampLoudnessOn = false;

function applyLoudnessComp() {
    if (!ampBass || !ampTreble) return;
    const m = AMP_MODELS[ampModelId];
    if (!m) return;
    const comp = (ampModelId === "e303" && ampLoudnessOn) ? Math.max(0, 1 - volumeLevel) : 0;
    ampBass.gain.value = m.bass[1] + comp * 6;
    ampTreble.gain.value = m.treble[1] + comp * 2.5;
}

function setVolumeLevel(v) {
    volumeLevel = Math.max(0, Math.min(1, v));
    if (gainNode) {
        applyGainStaging();
    } else {
        try { audio.volume = volumeLevel; } catch (e) {}
    }
    if (ampLoudnessOn) applyLoudnessComp();
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

// 스크래치 노이즈 — 회전 중인 판을 손으로 문지를 때의 마찰음.
// 거친 노이즈를 밴드패스(2.4kHz)로 걸러 "치직" 대역만 남긴다. 게인은 ttFrame이 드래그 세기로 구동.
function ensureScratch() {
    if (!audioCtx || !scratchGain || scratchSrc) return;
    try {
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, sr * 2, sr);
        const d = buf.getChannelData(0);
        let burst = 0;
        for (let i = 0; i < d.length; i++) {
            let v = (Math.random() * 2 - 1) * 0.35;
            if (Math.random() < 0.004) burst = 0.5 + Math.random() * 0.5;   // 굵은 마찰 알갱이
            if (burst > 0.01) { v += (Math.random() * 2 - 1) * burst; burst *= 0.86; }
            d[i] = v;
        }
        scratchSrc = audioCtx.createBufferSource();
        scratchSrc.buffer = buf;
        scratchSrc.loop = true;
        const bp = audioCtx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2400;
        bp.Q.value = 0.7;
        scratchSrc.connect(bp);
        bp.connect(scratchGain);
        scratchSrc.start();
    } catch (e) { scratchSrc = null; }
}

// WebKit(사파리·맥 앱 WKWebView)의 MediaElementSource는 크로스오리진 미디어에서
// CORS가 열려 있어도 무음을 내는 문제가 있다. 크롬 계열에서만 Web Audio 체인을 쓰고,
// 그 외에는 iOS처럼 네이티브 직결 경로로 소리를 보장한다 (음색·이펙트는 계기 표시만).
const SAFARI_LIKE = /AppleWebKit/i.test(navigator.userAgent) && !/Chrome|CriOS|Edg|OPR/i.test(navigator.userAgent);

function ensureAudioGraph() {
    if (SAFARI_LIKE) return false;
    if (audioCtx) return true;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !window.MediaRecorder) return false;

    try {
        audioCtx = new Ctx();
        const source = audioCtx.createMediaElementSource(audio);
        gainNode = audioCtx.createGain();
        recDest = audioCtx.createMediaStreamDestination();
        analyser = audioCtx.createAnalyser();
        // 31Hz부터 밴드별 스펙트럼을 분리할 수 있도록 충분한 FFT 해상도를 확보한다.
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.76;
        // BLEND(고음 감쇠)·MODE(모노 다운믹스) 스위치용 노드를 청취 경로에 삽입
        blendFilter = audioCtx.createBiquadFilter();
        blendFilter.type = "lowpass";
        monoGain = audioCtx.createGain();
        ampInputTrim = audioCtx.createGain();
        // 앰프: 전압 증폭단 → 5단 보이싱 → 출력관 → 정류/전원 새그 → OPT → 스피커 부하
        ampDrive = audioCtx.createGain();
        ampShaper = audioCtx.createWaveShaper();
        ampShaper.oversample = "4x";
        ampBass = audioCtx.createBiquadFilter();
        ampBass.type = "lowshelf";
        ampLowMid = audioCtx.createBiquadFilter();
        ampLowMid.type = "peaking";
        ampMid = audioCtx.createBiquadFilter();
        ampMid.type = "peaking";
        ampPresence = audioCtx.createBiquadFilter();
        ampPresence.type = "peaking";
        ampTreble = audioCtx.createBiquadFilter();
        ampTreble.type = "highshelf";
        ampPowerDrive = audioCtx.createGain();
        ampPowerShaper = audioCtx.createWaveShaper();
        ampPowerShaper.oversample = "4x";
        ampSag = audioCtx.createDynamicsCompressor();
        ampTransformerHP = audioCtx.createBiquadFilter();
        ampTransformerHP.type = "highpass";
        ampTransformerLP = audioCtx.createBiquadFilter();
        ampTransformerLP.type = "lowpass";
        ampDampingBass = audioCtx.createBiquadFilter();
        ampDampingBass.type = "peaking";
        ampDampingHigh = audioCtx.createBiquadFilter();
        ampDampingHigh.type = "highshelf";
        ampSpeakerResonance = audioCtx.createBiquadFilter();
        ampSpeakerResonance.type = "bandpass";
        ampSpeakerDelay = audioCtx.createDelay(.05);
        ampSpeakerTone = audioCtx.createBiquadFilter();
        ampSpeakerTone.type = "lowpass";
        ampSpeakerFeedback = audioCtx.createGain();
        ampSpeakerWet = audioCtx.createGain();
        ampOut = audioCtx.createGain();
        voiceLow = audioCtx.createBiquadFilter();
        voiceLow.type = "lowshelf";
        voiceLow.frequency.value = 130;
        voiceHigh = audioCtx.createBiquadFilter();
        voiceHigh.type = "highshelf";
        voiceHigh.frequency.value = 7200;
        source.connect(ampInputTrim).connect(blendFilter).connect(voiceLow).connect(voiceHigh).connect(monoGain);
        ampDrive.connect(ampShaper).connect(ampBass).connect(ampLowMid).connect(ampMid).connect(ampPresence).connect(ampTreble)
            .connect(ampPowerDrive).connect(ampPowerShaper).connect(ampSag).connect(ampTransformerHP).connect(ampTransformerLP)
            .connect(ampDampingBass).connect(ampDampingHigh);
        ampDampingHigh.connect(ampOut);
        ampDampingHigh.connect(ampSpeakerResonance);
        ampSpeakerResonance.connect(ampSpeakerDelay);
        ampSpeakerDelay.connect(ampSpeakerTone).connect(ampSpeakerWet).connect(ampOut);
        ampSpeakerDelay.connect(ampSpeakerFeedback).connect(ampSpeakerResonance);
        // 프런트패널 스테이지: 톤 → 5밴드 → 서브소닉 → 감쇠 → 스테레오 매트릭스
        fp = { bands: [] };
        fp.bass = audioCtx.createBiquadFilter();
        fp.bass.type = "lowshelf";
        fp.bass.frequency.value = 110;
        fp.treble = audioCtx.createBiquadFilter();
        fp.treble.type = "highshelf";
        fp.treble.frequency.value = 8000;
        [30, 250, 1000, 4000, 10000].forEach((f, i) => {
            const b = audioCtx.createBiquadFilter();
            b.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
            b.frequency.value = f;
            b.Q.value = 0.9;
            fp.bands.push(b);
        });
        fp.subsonic = audioCtx.createBiquadFilter();
        fp.subsonic.type = "highpass";
        fp.subsonic.frequency.value = 12;
        fp.att = audioCtx.createGain();
        fp.split = audioCtx.createChannelSplitter(2);
        fp.merge = audioCtx.createChannelMerger(2);
        fp.mLL = audioCtx.createGain();
        fp.mLR = audioCtx.createGain();
        fp.mRL = audioCtx.createGain();
        fp.mRR = audioCtx.createGain();
        ampOut.connect(fp.bass).connect(fp.treble);
        let fpHead = fp.treble;
        fp.bands.forEach((b) => { fpHead = fpHead.connect(b); });
        fpHead.connect(fp.subsonic).connect(fp.att).connect(fp.split);
        fp.split.connect(fp.mLL, 0);
        fp.split.connect(fp.mLR, 0);
        fp.split.connect(fp.mRL, 1);
        fp.split.connect(fp.mRR, 1);
        fp.mLL.connect(fp.merge, 0, 0);
        fp.mRL.connect(fp.merge, 0, 0);
        fp.mLR.connect(fp.merge, 0, 1);
        fp.mRR.connect(fp.merge, 0, 1);
        fp.merge.connect(gainNode).connect(audioCtx.destination);
        // 바이닐 크랙클 (포노 재생 시에만 게인이 올라간다) — EQ 앞에 섞어 앰프 음색까지 입힌다
        crackleGain = audioCtx.createGain();
        crackleGain.gain.value = 0;
        scratchGain = audioCtx.createGain();
        scratchGain.gain.value = 0;
        // EQ 밴드는 현재 모델(GE-5/GE-10)로 구성 — monoGain→EQ→ampDrive + 크랙클/히스 연결
        buildEqChain();
        recSatShaper = audioCtx.createWaveShaper();
        recSatShaper.oversample = "2x";
        // 녹음 유저 컨트롤: MPX 필터 → BIAS 틸트 → 채널별 REC LEVEL → 새추레이션 → recDest
        recMpx = audioCtx.createBiquadFilter();
        recMpx.type = "lowpass";
        recMpx.frequency.value = 21000;
        recBias = audioCtx.createBiquadFilter();
        recBias.type = "highshelf";
        recBias.frequency.value = 9000;
        recSplit = audioCtx.createChannelSplitter(2);
        recMerge = audioCtx.createChannelMerger(2);
        recTrimL = audioCtx.createGain();
        recTrimR = audioCtx.createGain();
        source.connect(recMpx).connect(recBias).connect(recSplit);
        recSplit.connect(recTrimL, 0);
        recSplit.connect(recTrimR, 1);
        recTrimL.connect(recMerge, 0, 0);
        recTrimR.connect(recMerge, 0, 1);
        recMerge.connect(recSatShaper).connect(recDest);
        applyRecHeadroom();
        applyFrontPanel();
        applyRecPanel();
        source.connect(analyser);
        applyBlend();
        applyMono();
        applyAmp();
        applyGainStaging();
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
        ampInputTrim = null;
        recDest = null;
        analyser = null;
        blendFilter = null;
        monoGain = null;
        eqNodes = null;
        ampDrive = null;
        ampShaper = null;
        ampBass = null;
        ampLowMid = null;
        ampMid = null;
        ampPresence = null;
        ampTreble = null;
        ampPowerDrive = null;
        ampPowerShaper = null;
        ampSag = null;
        ampTransformerHP = null;
        ampTransformerLP = null;
        ampDampingBass = null;
        ampDampingHigh = null;
        ampSpeakerResonance = null;
        ampSpeakerDelay = null;
        ampSpeakerTone = null;
        ampSpeakerFeedback = null;
        ampSpeakerWet = null;
        ampOut = null;
        fp = null;
        recMpx = null;
        recBias = null;
        recSplit = null;
        recMerge = null;
        recTrimL = null;
        recTrimR = null;
        crackleGain = null;
        scratchGain = null;
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
