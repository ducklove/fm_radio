// 마이크 입력(REC INPUT) 테스트 — 크로미움 가짜 입력 장치(톤 발생기)로 검증한다.
// launchOptions는 describe 안에서 못 바꾸므로 별도 스펙 파일에 최상위로 둔다.
// WebKit 프로젝트는 grep에 걸리지 않아 제외된다 (Playwright WebKit은 가짜 마이크를 보장하지 않음).
const { test, expect } = require("@playwright/test");
const { mockExternal, collectErrors } = require("./fixtures");

test.use({
    viewport: { width: 1440, height: 2200 },
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    permissions: ["microphone"],
});

async function waitForMainApp(page) {
    await page.waitForFunction(() => typeof window.Hls !== "undefined");
    await page.waitForFunction(() => Array.isArray(window.MFA_RECORDS));
    await page.evaluate(() => window.MFA_READY);
    await page.waitForSelector("#tsKnobHit");
}

let errors;
test.beforeEach(async ({ context, page }) => {
    await mockExternal(context);
    errors = collectErrors(page);
    await page.goto("/");
    await waitForMainApp(page);
});
test.afterEach(() => {
    expect(errors, "콘솔 오류·페이지 예외 없음").toEqual([]);
});

test("MIC 셀렉터 → REC: 정지 상태에서 마이크를 테이프에 녹음, 선국에도 살아남는다", async ({ page }) => {
    // REC INPUT 셀렉터를 MIC로 — 가짜 장치라 권한 프롬프트 없이 무장된다
    await page.locator("#deckMicPanel").click();
    await page.waitForFunction(() => micArmed && !!micStream, null, { timeout: 10000 });
    expect(await page.evaluate(() => document.getElementById("deckMicKnob").getAttribute("y")), "셀렉터 노브가 MIC 위치").toBe("474");
    // 본체가 아무것도 재생하지 않아도 REC가 시작된다 (MIC가 소스)
    await page.evaluate(() => deckRec());
    await page.waitForFunction(() => !!recorder && recIsMic && deckMode === "rec", null, { timeout: 8000 });
    // 선국해도 마이크 녹음은 계속된다 — 입력 셀렉터는 본체 소스와 무관
    await page.evaluate(() => selectStation(window.FMRadio.stations[0].id));
    await page.waitForTimeout(2400);
    expect(await page.evaluate(() => !!recorder && recIsMic), "선국 후에도 녹음 유지").toBe(true);
    // 입력 모니터 — 데크 VU가 마이크 레벨(가짜 장치의 톤)을 따라간다.
    // 톤은 주기적으로 쉬므로 실시간 1.8초 창에서 피크를 샘플링한다.
    const lvl = await page.evaluate(async () => {
        let peak = 0;
        for (let k = 0; k < 12; k++) {
            const t0 = performance.now() - 200;
            ttLastTs = t0;
            for (let i = 1; i <= 4; i++) ttFrame(t0 + i * 50);
            peak = Math.max(peak, micSignal);
            await new Promise((r) => setTimeout(r, 150));
        }
        return peak;
    });
    expect(lvl, "마이크 레벨 감지").toBeGreaterThan(0.001);
    // REC 재누름 = 저장 — '마이크 녹음' 세그먼트가 장착 테이프에 실린다
    await page.evaluate(() => deckRec());
    await page.waitForFunction(() =>
        !recorder && deckTape && deckTape.segments.some((s) => s.name === "마이크 녹음"), null, { timeout: 8000 });
    const blobSize = await page.evaluate(async () => {
        const s = deckTape.segments.find((x) => x.name === "마이크 녹음");
        return fetch(s.url).then((r) => r.blob()).then((b) => b.size);
    });
    expect(blobSize, "녹음 파일 실데이터(>2KB)").toBeGreaterThan(2000);
    // 셀렉터를 LINE으로 되돌리면 마이크 스트림이 해제된다
    await page.evaluate(() => deckMicToggle());
    await page.waitForFunction(() => !micArmed && !micStream, null, { timeout: 5000 });
});
