const { test, expect } = require("@playwright/test");
const { mockExternal } = require("./fixtures");

async function loadApp(context, page, path = "/") {
    await mockExternal(context);
    await page.goto(path);
    await page.waitForFunction(() => window.MFA_READY && typeof window.MFA_READY.then === "function");
    await page.evaluate(() => window.MFA_READY);
    await page.waitForFunction(() => typeof window.MFA_PlaybackController === "object");
}

test.describe("안전성 코어 경계", () => {
    test("HLS 재시도 예산은 정상 프래그먼트 뒤 회복되고 오래된 핸들은 무시된다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const nativeSetTimeout = window.setTimeout;
            const nativeClearTimeout = window.clearTimeout;
            const timers = [];
            window.setTimeout = (fn) => { timers.push(fn); return timers.length; };
            window.clearTimeout = () => {};

            class FakeHls {
                static Events = {
                    MANIFEST_PARSED: "manifest",
                    FRAG_BUFFERED: "frag-buffered",
                    ERROR: "error"
                };
                static ErrorTypes = { NETWORK_ERROR: "network", MEDIA_ERROR: "media" };
                static isSupported() { return true; }
                constructor() { this.handlers = new Map(); FakeHls.instances.push(this); }
                on(name, fn) { this.handlers.set(name, fn); }
                emit(name, data) { const fn = this.handlers.get(name); if (fn) fn(name, data); }
                loadSource() {}
                attachMedia() {}
                startLoad() { this.starts = (this.starts || 0) + 1; }
                recoverMediaError() {}
                destroy() { this.destroyed = true; }
            }
            FakeHls.instances = [];
            window.Hls = FakeHls;
            const audio = new EventTarget();
            audio.play = () => Promise.resolve();
            audio.canPlayType = () => "";
            audio.error = null;
            const retries = [];
            const fatals = [];
            const first = PlayerCore.attach(audio, "https://test/one.m3u8", {
                onRetry: (n) => retries.push(n), onFatal: (data) => fatals.push(data)
            });
            const firstHls = FakeHls.instances[0];
            firstHls.emit("error", { fatal: true, type: "network", details: "old" });

            // 같은 audio에 새 핸들이 붙으면 첫 핸들의 예약/오류는 더 이상 효력이 없다.
            const second = PlayerCore.attach(audio, "https://test/two.m3u8", {
                onRetry: (n) => retries.push(n), onFatal: (data) => fatals.push(data)
            });
            if (timers.length) timers.shift()();
            firstHls.emit("error", { fatal: true, type: "network", details: "stale" });

            const hls = FakeHls.instances[1];
            hls.emit("error", { fatal: true, type: "network", details: "outage-a" });
            timers.shift()();
            hls.emit("frag-buffered", {}); // 연속 장애가 끝났으므로 예산 충전
            hls.emit("error", { fatal: true, type: "network", details: "outage-b" });
            timers.shift()();
            hls.emit("error", { fatal: true, type: "network", details: "outage-b2" });
            timers.shift()();
            hls.emit("error", { fatal: true, type: "network", details: "outage-b3" });
            timers.shift()();
            hls.emit("error", { fatal: true, type: "network", details: "exhausted" });

            window.setTimeout = nativeSetTimeout;
            window.clearTimeout = nativeClearTimeout;
            first.destroy();
            second.destroy();
            return { retries, fatals: fatals.map((x) => x.details), starts: hls.starts || 0 };
        });
        expect(result.retries).toEqual([1, 1, 1, 2, 3]);
        expect(result.fatals).toEqual(["exhausted"]);
        expect(result.starts).toBe(4);
    });

    test("재생 성공은 playing 이벤트에서만 확정되고 이전 요청 콜백은 폐기된다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const originalAttach = PlayerCore.attach;
            const originalSupported = Hls.isSupported;
            const callbacks = [];
            Hls.isSupported = () => false;
            PlayerCore.attach = (_audio, _url, cb) => {
                const handle = {
                    kind: "hls", destroyed: false, hls: null,
                    isCurrent() { return !this.destroyed; },
                    destroy() { this.destroyed = true; }
                };
                callbacks.push({ cb, handle });
                return handle;
            };

            await selectStation("kbs1fm");
            const beforeEvent = { playing: isPlaying, phase: MFA_PlaybackController.inspect().phase };
            audio.dispatchEvent(new Event("playing"));
            const afterEvent = { playing: isPlaying, phase: MFA_PlaybackController.inspect().phase };
            const old = callbacks[0];
            await selectStation("kbs2fm");
            old.cb.onFatal({ details: "late-old-request" });
            const afterStale = {
                station: currentStation && currentStation.id,
                state: audioState,
                phase: MFA_PlaybackController.inspect().phase
            };

            PlayerCore.attach = originalAttach;
            Hls.isSupported = originalSupported;
            return { beforeEvent, afterEvent, afterStale };
        });
        expect(result.beforeEvent).toEqual({ playing: false, phase: "buffering" });
        expect(result.afterEvent).toEqual({ playing: true, phase: "playing" });
        expect(result.afterStale.station).toBe("kbs2fm");
        expect(result.afterStale.state).not.toBe("error");
        expect(result.afterStale.phase).toBe("buffering");
    });

    test("예약 수신기 generation이 이전 채널 rolling buffer와 늦은 청크를 격리한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(() => {
            const oldGeneration = MFA_BackgroundCaptureSession.begin("kbs1fm");
            bgRecCap.rolling.push({ t: Date.now(), bytes: new Uint8Array([9]), sec: 1 });
            const newGeneration = MFA_BackgroundCaptureSession.begin("kbs2fm");
            bgRecOnChunk(null, {
                type: "audio", data: new Uint8Array([1, 2, 3]), frag: { sn: 1, duration: 4 }
            }, oldGeneration);
            const afterOld = MFA_BackgroundCaptureSession.inspect();
            bgRecOnChunk(null, {
                type: "audio", data: new Uint8Array([4, 5, 6]), frag: { sn: 2, duration: 4 }
            }, newGeneration);
            const afterNew = MFA_BackgroundCaptureSession.inspect();
            return { afterOld, afterNew, rollingSec: bgRecCap.rolling.map((chunk) => chunk.sec) };
        });
        expect(result.afterOld.stationId).toBe("kbs2fm");
        expect(result.afterOld.rollingChunks).toBe(0);
        expect(result.afterNew.rollingChunks).toBe(1);
        expect(result.rollingSec).toEqual([4]);
    });

    test("녹음 삭제는 테이프 양면을 함께 정리하고 저장 API는 Result를 반환한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const url = "blob:test-recording";
            tapes = [{
                id: "two-sided", label: "TEST", side: "A", len: 1800, pos: 0,
                segments: [{ start: 0, dur: 10, url, dbId: 77 }],
                segmentsB: [{ start: 20, dur: 10, url, dbId: 77 }]
            }];
            const removed = MFA_TapeRepository.removeRecording({ url, dbId: 77 });
            recDb = null;
            const saved = await MFA_RecordingRepository.save({ blob: new Blob(["x"], { type: "audio/webm" }) });
            return {
                removed,
                a: tapes[0].segments.length,
                b: tapes[0].segmentsB.length,
                saved: { ok: saved.ok, id: saved.id, reason: saved.reason }
            };
        });
        expect(result).toEqual({ removed: 2, a: 0, b: 0, saved: { ok: false, id: null, reason: "unavailable" } });
    });

    test("영속 테이프 라벨과 ID는 SVG 문자열이 아니라 안전한 DOM 텍스트로 렌더된다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(() => {
            window.__tapeInjectionRan = false;
            const maliciousLabel = '<image id="tape-xss" href="x" onerror="window.__tapeInjectionRan=true">';
            const maliciousId = 'bad-id"><image id="id-xss" href="x" onerror="window.__tapeInjectionRan=true">';
            const current = newBlankTape(1800);
            const imported = newBlankTape(1800);
            imported.id = maliciousId;
            imported.label = maliciousLabel;
            tapes = [current, imported];
            deckTape = current;
            deckBTape = null;
            deckRefreshShelf();
            const label = document.querySelector('#deckShelf text[data-tape-label-index="0"]');
            return {
                text: label && label.textContent,
                injectedNodes: document.querySelectorAll("#deckShelf image").length,
                ran: window.__tapeInjectionRan
            };
        });
        expect(result.text).toBe('<image id="');
        expect(result.injectedNodes).toBe(0);
        expect(result.ran).toBe(false);
    });

    test("영속 저장 실패는 녹음 카드를 명시하고 다운로드 폴백을 제공한다", async ({ context, page }) => {
        await loadApp(context, page);
        const downloadPromise = page.waitForEvent("download");
        const statePromise = page.evaluate(async () => {
            recDb = null;
            const tape = newBlankTape(1800);
            const record = {
                stationId: "test", stationName: "저장 실패 테스트",
                startedAt: new Date().toISOString(), durationMs: 1000,
                type: "audio/webm", tapeId: tape.id, tapeStart: 0, tapeLen: 1800,
                side: "A", blob: new Blob(["recording"], { type: "audio/webm" })
            };
            const item = addRecordingItem(record);
            const saved = await persistRecording(record);
            finalizeRecordingPersistence(record, item, saved);
            return {
                persistence: item.item.dataset.persistence,
                text: item.meta.textContent,
                notice: playerSubtext.textContent
            };
        });
        const [download, state] = await Promise.all([downloadPromise, statePromise]);
        expect(download.suggestedFilename()).toMatch(/\.webm$/);
        expect(state.persistence).toBe("volatile");
        expect(state.text).toContain("브라우저 저장 실패");
        expect(state.notice).toContain("다운로드");
    });

    test("AudioContext 그래프 중간 실패는 한 번만 초기화하고 직결 폴백으로 고정한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(() => {
            let mediaSourceCalls = 0;
            let directConnections = 0;
            class BrokenContext {
                constructor() { this.destination = {}; this.state = "running"; }
                createMediaElementSource() {
                    mediaSourceCalls += 1;
                    return {
                        disconnect() {},
                        connect(target) { if (target) directConnections += 1; }
                    };
                }
                createGain() { throw new Error("synthetic graph failure"); }
                close() { return Promise.resolve(); }
            }
            window.AudioContext = BrokenContext;
            const first = ensureAudioGraph();
            const second = ensureAudioGraph();
            return { first, second, mediaSourceCalls, directConnections, state: MFA_AudioGraph.inspect() };
        });
        expect(result.first).toBe(false);
        expect(result.second).toBe(false);
        expect(result.mediaSourceCalls).toBe(1);
        expect(result.directConnections).toBe(1);
        expect(result.state).toMatchObject({ state: "failed", ready: false, fallback: true });
    });

    test("타이머 워커 장애 뒤에도 기존 커스텀 ID로 네이티브 폴백 타이머를 취소한다", async ({ page }) => {
        await page.goto("/manual.html");
        await page.addScriptTag({ url: "/store.js" });
        const result = await page.evaluate(async () => {
            let timeoutRuns = 0;
            let intervalRuns = 0;
            const timeoutId = setTimeout(() => { timeoutRuns += 1; }, 20);
            const intervalId = setInterval(() => { intervalRuns += 1; }, 10);
            MFA_TimerShim.failOver();
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            await new Promise((resolve) => setTimeout(resolve, 60));
            return { timeoutRuns, intervalRuns, mode: MFA_TimerShim.mode };
        });
        expect(result).toEqual({ timeoutRuns: 0, intervalRuns: 0, mode: "native-fallback" });
    });

    test("네이티브 HLS 캡처는 master playlist를 따라 새 세그먼트를 순서대로 전달한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const masterUrl = "https://capture.test/master.m3u8";
            const mediaUrl = "https://capture.test/live/media.m3u8";
            const bodies = new Map([
                [masterUrl, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=64000\nlive/media.m3u8\n"],
                [mediaUrl, "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:42\n#EXT-X-TARGETDURATION:5\n#EXTINF:4,\na.ts\n#EXTINF:5,\nb.ts\n#EXT-X-ENDLIST\n"],
                ["https://capture.test/live/a.ts", new Uint8Array([0x47, 1, 2, 3])],
                ["https://capture.test/live/b.ts", new Uint8Array([0x47, 4, 5, 6])]
            ]);
            const requested = [];
            const chunks = [];
            const capture = MFA.createNativeHlsCapture({
                url: masterUrl,
                fetch: async (url) => {
                    requested.push(url);
                    const body = bodies.get(url);
                    return new Response(body, { status: body == null ? 404 : 200 });
                },
                onChunk: (chunk) => chunks.push({
                    sequence: chunk.sequence,
                    duration: chunk.duration,
                    mime: chunk.mime,
                    bytes: [...chunk.bytes]
                })
            }).start();
            for (let i = 0; i < 40 && !capture.ready; i++) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            capture.destroy();
            return { ready: capture.ready, requested, chunks };
        });
        expect(result.ready).toBe(true);
        expect(result.requested).toEqual([
            "https://capture.test/master.m3u8",
            "https://capture.test/live/media.m3u8",
            "https://capture.test/live/a.ts",
            "https://capture.test/live/b.ts"
        ]);
        expect(result.chunks).toEqual([
            { sequence: 42, duration: 4, mime: "video/mp2t", bytes: [0x47, 1, 2, 3] },
            { sequence: 43, duration: 5, mime: "video/mp2t", bytes: [0x47, 4, 5, 6] }
        ]);
    });

    test("반복 예약 계산은 전달한 기준시각만 사용한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(() => {
            const now = new Date(2031, 2, 11, 12, 0, 0, 0);
            const occ = MFA_ReservationSchedule.occurrence({ repeat: "daily", startMin: 600, endMin: 660 }, now.getTime());
            const date = new Date(occ.startTs);
            return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), h: date.getHours(), ymd: occ.ymd };
        });
        expect(result).toEqual({ y: 2031, m: 2, d: 12, h: 10, ymd: "20310312" });
    });

    test("트레이 제어 메시지는 정확한 parent source와 origin에서만 받는다", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/manual.html");
        await page.evaluate(() => {
            const target = document.createElement("iframe");
            target.id = "target";
            target.src = "/index.html?chrome=tray";
            document.body.appendChild(target);
            const attacker = document.createElement("iframe");
            attacker.id = "attacker";
            attacker.srcdoc = "<!doctype html><title>attacker</title>";
            document.body.appendChild(attacker);
        });
        const target = page.frameLocator("#target");
        await target.locator("#audioPlayer").waitFor({ state: "attached" });
        const targetFrame = page.frames().find((frame) => frame.url().includes("chrome=tray"));
        await targetFrame.evaluate(() => window.MFA_READY);
        const initial = await targetFrame.evaluate(() => volumeLevel);

        await page.evaluate(() => {
            const attacker = document.getElementById("attacker");
            attacker.contentWindow.eval("parent.frames[0].postMessage({type:'fmRadio:setVolume',value:7}, '*')");
        });
        await page.waitForTimeout(50);
        expect(await targetFrame.evaluate(() => volumeLevel)).toBe(initial);

        await page.evaluate(() => {
            document.getElementById("target").contentWindow.postMessage({ type: "fmRadio:setVolume", value: 37 }, location.origin);
        });
        await expect.poll(() => targetFrame.evaluate(() => Math.round(volumeLevel * 100))).toBe(37);
    });
});
