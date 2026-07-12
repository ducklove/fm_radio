// FM 라디오 스모크 테스트
// 재생은 모의 HLS(MP3/TS)로 검증한다 — 실제 방송 스트림 연결은 환경(지역·정책)에
// 좌우되므로 테스트하지 않는다. 파이프라인(선국→URL 해석→hls.js→<audio>)이 대상이다.
const { test, expect } = require("@playwright/test");
const { mockExternal, collectErrors } = require("./fixtures");

test.describe("데스크톱", () => {
    test.use({ viewport: { width: 1440, height: 2200 } });

    let errors;
    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        errors = collectErrors(page);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");
    });

    test.afterEach(() => {
        expect(errors, "콘솔 오류·페이지 예외 없음").toEqual([]);
    });

    test("초기 렌더링: 랙 5기기·가로 오버플로 없음", async ({ page }) => {
        await expect(page).toHaveTitle(/FM 라디오/);
        for (const id of ["tunerStage", "eqStage", "ampStage", "deckStage", "ttStage"]) {
            await expect(page.locator(`#${id} svg`)).toBeVisible();
        }
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);
    });

    test("RF 스위치로 채널 목록 열기 → 전 채널 렌더링", async ({ page }) => {
        await page.click("#tsRfHit");
        await expect(page.locator("#stationMain")).not.toHaveClass(/collapsed/);
        const count = await page.locator(".station").count();
        const expected = await page.evaluate(() => window.FMRadio.stations.length);
        expect(count).toBe(expected);
    });

    test("선국 → 모의 스트림 실제 재생", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await expect(page.locator("#nowStation")).toHaveText("KBS 1FM");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });

    test("빠른 채널 전환에도 예외 없이 생존", async ({ page }) => {
        await page.click("#tsRfHit");
        const cards = page.locator("#stationMain .station");
        const n = Math.min(await cards.count(), 6);
        for (let i = 0; i < n; i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(120);
        }
        // KBS 채널로 복귀 → 재생 확인
        await cards.first().click();
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });

    test("튜너 전원 스위치 = 정지/재생 토글", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => !document.getElementById("audioPlayer").paused, null, { timeout: 15000 });

        await page.click("#tsPowerHit");
        await page.waitForFunction(() => document.getElementById("audioPlayer").paused);

        await page.click("#tsPowerHit");
        await page.waitForFunction(() => !document.getElementById("audioPlayer").paused, null, { timeout: 15000 });
    });

    test("설정 모달: 열기 → ESC로 닫기", async ({ page }) => {
        await page.click('button:has-text("설정")');
        await expect(page.locator("#settingsOverlay")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("#settingsOverlay")).toBeHidden();
    });
});

test.describe("모바일 390px", () => {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
    });

    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");
    });

    test("가로 오버플로 없음 + 선국·재생", async ({ page }) => {
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);

        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("초소형 320px", () => {
    test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

    test("가로 오버플로 없음", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);
    });
});

test.describe("iOS 폴백 (MSE 없음 + 네이티브 HLS)", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("audio.src에 m3u8 직접 할당", async ({ context, page }) => {
        await context.addInitScript(() => {
            delete window.MediaSource;
            const orig = HTMLMediaElement.prototype.canPlayType;
            HTMLMediaElement.prototype.canPlayType = function (t) {
                if (t && t.includes("mpegurl")) return "maybe";
                return orig.call(this, t);
            };
        });
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() =>
            document.getElementById("audioPlayer").src.includes("playlist.m3u8"));
    });
});

test.describe("키보드 조작", () => {
    test.use({ viewport: { width: 1440, height: 1200 } });

    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");
    });

    test("튜너 RF 스위치: 포커스 + Enter로 채널 목록 토글", async ({ page }) => {
        await page.evaluate(() => document.getElementById("tsRfHit").focus());
        await page.keyboard.press("Enter");
        await expect(page.locator("#stationMain")).not.toHaveClass(/collapsed/);
        await page.keyboard.press("Enter");
        await expect(page.locator("#stationMain")).toHaveClass(/collapsed/);
    });

    test("튜닝 노브: 화살표 키로 선국", async ({ page }) => {
        await page.evaluate(() => document.getElementById("tsKnobHit").focus());
        await page.keyboard.press("ArrowRight");
        await expect(page.locator("#nowStation")).not.toHaveText("방송을 선택하세요");
    });

    test("EQ 슬라이더: 화살표 키로 게인 조절 + 저장", async ({ page }) => {
        await page.evaluate(() => document.getElementById("eqHit0").focus());
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        const gain = await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).gains[0]);
        expect(gain).toBe(2);
        const valueNow = await page.getAttribute("#eqHit0", "aria-valuenow");
        expect(valueNow).toBe("2");
    });
});

test.describe("모바일 컨트롤 바", () => {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });

    test("이전/다음 채널 버튼으로 선국", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");

        await expect(page.locator(".player-bar")).toBeVisible();
        await page.locator('button[aria-label="다음 채널"]').click();
        await expect(page.locator("#nowStation")).toHaveText("KBS 1FM");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("채널 검색", () => {
    test.use({ viewport: { width: 1440, height: 1600 } });

    test("검색어로 카드·그룹 필터링", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");
        await page.click("#tsRfHit");

        // offsetParent 기준 = 실제 렌더링 가시성 (hidden 속성이 CSS에 지는 회귀를 잡는다)
        await page.fill("#stationSearch", "클래식");
        const visible = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .station")].filter((el) => el.offsetParent !== null).length);
        expect(visible).toBe(1);
        const visibleGroups = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .group")].filter((el) => el.offsetParent !== null).length);
        expect(visibleGroups).toBe(1);

        await page.fill("#stationSearch", "");
        const restored = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .station")].filter((el) => el.offsetParent !== null).length);
        const total = await page.evaluate(() => window.FMRadio.stations.length);
        expect(restored).toBe(total);
    });
});

test.describe("미니 플레이어 (widget.html)", () => {
    test("PlayerCore로 선국·재생", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/widget.html?station=kbs1fm");
        await page.waitForFunction(() => typeof window.Hls !== "undefined" && typeof window.PlayerCore !== "undefined");
        await page.click("#btnPlay");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("턴테이블 음반 컬렉션", () => {
    test.use({ viewport: { width: 1440, height: 1800 } });

    // RECORDS/recordIndex/RECORD/availableRecords는 스크립트 최상위 const/let이라
    // window에는 없지만 전역 렉시컬 스코프에 있어 bare 식별자로 접근 가능.
    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof RECORDS !== "undefined");
    });

    test("여러 장의 음반이 정의되어 있다", async ({ page }) => {
        const count = await page.evaluate(() => RECORDS.length);
        expect(count).toBeGreaterThanOrEqual(6);
    });

    test("commonsPath: Suite 1 Prélude 경로가 검증된 해시와 일치", async ({ page }) => {
        const p = await page.evaluate(() =>
            commonsPath("JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg"));
        expect(p).toBe("4/43/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg");
    });

    test("프로브 통과 시 모든 음반이 보관함에 노출된다", async ({ page }) => {
        // mock에서 Wikimedia 요청이 성공하므로 전곡 프로브 통과
        await page.waitForFunction(() => availableRecords.length === RECORDS.length, null, { timeout: 15000 });
        const spines = await page.locator("#ttCrate .ttSpine").count();
        expect(spines).toBe(await page.evaluate(() => RECORDS.length));
    });

    test("음반 교체 → 재킷·트랙 라벨·판 라벨이 바뀐다", async ({ page }) => {
        await page.waitForFunction(() => availableRecords.length >= 3, null, { timeout: 15000 });
        await page.evaluate(() => setRecord(2)); // Suite 3
        const idx = await page.evaluate(() => recordIndex);
        expect(idx).toBe(2);
        // Suite 3의 5번 곡은 Bourrée
        const hasBourree = await page.evaluate(() =>
            RECORDS[recordIndex].tracks.some((t) => t.t.includes("Bourrée")));
        expect(hasBourree).toBe(true);
        // 재킷 부제도 갱신
        await expect(page.locator("#ttStage svg")).toContainText("제3번");
    });

    test("음반 트랙 재생 (mock 음원)", async ({ page }) => {
        await page.locator("#ttStartBtn").click();
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.3;
        }, null, { timeout: 15000 });
        const label = await page.evaluate(() => RECORD.title);
        expect(label).toContain("첼로 모음곡");
    });

    test("보관함 스파인 클릭으로 음반 교체 + 저장", async ({ page }) => {
        await page.waitForFunction(() => availableRecords.length >= 3, null, { timeout: 15000 });
        await page.locator('#ttCrate .ttSpine[data-rec="1"]').click();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.record")));
        expect(saved).toBe(await page.evaluate(() => RECORDS[1].id));
    });
});

test.describe("접근성", () => {
    test("axe-core: 심각/치명 위반 없음", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        await page.evaluate(() => document.getElementById("stationMain").classList.remove("collapsed"));
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
            const res = await axe.run(document, { resultTypes: ["violations"] });
            return res.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length }));
        });
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious, JSON.stringify(violations)).toEqual([]);
    });
});
