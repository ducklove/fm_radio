const { test, expect } = require("@playwright/test");
const { mockExternal } = require("./fixtures");

async function loadApp(context, page) {
    await mockExternal(context);
    await page.goto("/");
    await page.waitForFunction(() => window.MFA_READY && typeof window.MFA_READY.then === "function");
    await page.evaluate(() => window.MFA_READY);
    await page.waitForFunction(() => typeof window.MFA_RecordingLifecycle === "object");
}

test.describe("녹음 영속화와 삭제 원자성", () => {
    test("저장 pending 중 카드 삭제는 늦게 생긴 IDB 행까지 지운 뒤 로컬 상태를 정리한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const originalPersist = window.persistRecording;
            const originalDeleteMany = window.deleteRecordings;
            let finishSave;
            const deletedIds = [];
            window.persistRecording = () => new Promise((resolve) => { finishSave = resolve; });
            window.deleteRecordings = async (ids) => {
                deletedIds.push(...ids);
                return { ok: true, ids, reason: null, error: null };
            };

            const tape = newBlankTape(1800);
            const record = {
                stationId: "race", stationName: "저장 경합",
                startedAt: new Date().toISOString(), durationMs: 1000,
                type: "audio/webm", tapeId: tape.id, tapeStart: 0, tapeLen: 1800,
                side: "A", blob: new Blob(["pending"], { type: "audio/webm" })
            };
            const handle = addRecordingItem(record);
            const saving = MFA_RecordingLifecycle.start(record, handle);
            const removing = MFA_RecordingLifecycle.remove(handle);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const whilePending = {
                connected: handle.item.isConnected,
                deletion: handle.item.dataset.deletion,
                segments: tape.segments.length,
                buttonDisabled: handle.remove.disabled
            };
            finishSave({ ok: true, id: 901, reason: null, error: null });
            await saving;
            const removed = await removing;
            const after = {
                connected: handle.item.isConnected,
                segments: tape.segments.length + tape.segmentsB.length,
                lifecycle: MFA_RecordingLifecycle.inspect(handle.url)
            };

            window.persistRecording = originalPersist;
            window.deleteRecordings = originalDeleteMany;
            return { whilePending, removed, deletedIds, after };
        });

        expect(result.whilePending).toEqual({ connected: true, deletion: "pending", segments: 1, buttonDisabled: true });
        expect(result.removed).toBe(true);
        expect(result.deletedIds).toEqual([901]);
        expect(result.after).toEqual({ connected: false, segments: 0, lifecycle: null });
    });

    test("IDB 삭제 실패 시 카드·테이프 메타·Blob URL을 유지하고 재시도 성공 뒤 정리한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const originalDeleteMany = window.deleteRecordings;
            const originalRevoke = URL.revokeObjectURL;
            let attempts = 0;
            const revoked = [];
            window.deleteRecordings = async (ids) => {
                attempts += 1;
                return attempts === 1
                    ? { ok: false, ids, reason: "delete-failed", error: new Error("blocked") }
                    : { ok: true, ids, reason: null, error: null };
            };
            URL.revokeObjectURL = (url) => { revoked.push(url); };

            const tape = newBlankTape(1800);
            const record = {
                id: 77, dbId: 77, stationId: "saved", stationName: "저장된 녹음",
                startedAt: new Date().toISOString(), durationMs: 1000,
                type: "audio/webm", tapeId: tape.id, tapeStart: 0, tapeLen: 1800,
                side: "A", blob: new Blob(["saved"], { type: "audio/webm" })
            };
            const handle = addRecordingItem(record);
            const first = await MFA_RecordingLifecycle.remove(handle);
            const afterFailure = {
                connected: handle.item.isConnected,
                segments: tape.segments.length,
                revoked: revoked.length,
                button: handle.remove.textContent,
                deletion: handle.item.dataset.deletion
            };
            const second = await MFA_RecordingLifecycle.remove(handle);
            const afterRetry = {
                connected: handle.item.isConnected,
                segments: tape.segments.length + tape.segmentsB.length,
                revoked: revoked.length
            };

            window.deleteRecordings = originalDeleteMany;
            URL.revokeObjectURL = originalRevoke;
            return { first, second, attempts, afterFailure, afterRetry };
        });

        expect(result.first).toBe(false);
        expect(result.afterFailure).toEqual({
            connected: true, segments: 1, revoked: 0, button: "다시 삭제", deletion: "failed"
        });
        expect(result.second).toBe(true);
        expect(result.attempts).toBe(2);
        expect(result.afterRetry).toEqual({ connected: false, segments: 0, revoked: 1 });
    });

    test("테이프 삭제는 저장 실패 때 전 상태를 유지하고 성공 뒤 B웰 릴레이 참조까지 해제한다", async ({ context, page }) => {
        await loadApp(context, page);
        const result = await page.evaluate(async () => {
            const originalDeleteMany = window.deleteRecordings;
            const originalRevoke = URL.revokeObjectURL;
            let mode = "fail";
            let deleteCalls = 0;
            const batches = [];
            const revoked = [];
            window.deleteRecordings = async (ids) => {
                deleteCalls += 1;
                batches.push(ids.slice().sort((a, b) => a - b));
                return mode === "fail"
                    ? { ok: false, ids, reason: "delete-failed", error: new Error("blocked") }
                    : { ok: true, ids, reason: null, error: null };
            };
            URL.revokeObjectURL = (url) => { revoked.push(url); };

            const tape = newBlankTape(1800);
            tape.named = true;
            tape.label = "B WELL TEST";
            deckBTape = tape;
            deckBPos = 12;
            w990ContPlay = true;
            const record = {
                id: 88, dbId: 88, stationId: "relay", stationName: "릴레이 녹음",
                startedAt: new Date().toISOString(), durationMs: 1000,
                type: "audio/webm", tapeId: tape.id, tapeStart: 0, tapeLen: 1800,
                side: "A", blob: new Blob(["relay"], { type: "audio/webm" })
            };
            const handle = addRecordingItem(record);
            const deckOnlyUrl = URL.createObjectURL(new Blob(["deck-only"], { type: "audio/webm" }));
            tapeAddSegment(tape, {
                start: 2, dur: 1, url: deckOnlyUrl, name: "카드 없는 더빙", dbId: 89, type: "audio/webm"
            });
            tapeMetaSave();

            w990DubBusy = true;
            await tapeCaseDelete(tape.id, null);
            const whileDubbing = { exists: tapes.includes(tape), bRef: deckBTape === tape, deleteCalls };
            w990DubBusy = false;

            await tapeCaseDelete(tape.id, null);
            const afterFailure = {
                exists: tapes.includes(tape),
                bRef: deckBTape === tape,
                card: handle.item.isConnected,
                segments: tape.segments.length,
                revoked: revoked.length,
                meta: !!loadJson("fmRadio.tapeMeta", {})[tape.id]
            };

            mode = "ok";
            await tapeCaseDelete(tape.id, null);
            const afterRetry = {
                exists: tapes.includes(tape),
                bRef: deckBTape === null,
                bPos: deckBPos,
                relayMode: w990ContPlay,
                card: handle.item.isConnected,
                revoked: revoked.length,
                meta: !!loadJson("fmRadio.tapeMeta", {})[tape.id]
            };

            window.deleteRecordings = originalDeleteMany;
            URL.revokeObjectURL = originalRevoke;
            return { whileDubbing, afterFailure, afterRetry, deleteCalls, batches };
        });

        expect(result.whileDubbing).toEqual({ exists: true, bRef: true, deleteCalls: 0 });
        expect(result.afterFailure).toEqual({
            exists: true, bRef: true, card: true, segments: 2, revoked: 0, meta: true
        });
        expect(result.afterRetry).toEqual({
            exists: false, bRef: true, bPos: 0, relayMode: true, card: false, revoked: 2, meta: false
        });
        expect(result.deleteCalls).toBe(2);
        expect(result.batches).toEqual([[88, 89], [88, 89]]);
    });
});
