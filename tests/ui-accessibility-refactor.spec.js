const { test, expect } = require("@playwright/test");
const { mockExternal, collectErrors } = require("./fixtures");

async function loadMain(page) {
    await mockExternal(page.context());
    await page.addInitScript(() => localStorage.setItem("fmRadio.coachDone", "true"));
    await page.goto("/index.html");
    await page.evaluate(() => window.MFA_READY);
}

test.describe("UI 접근성 제어 계층", () => {
    test("모달 포커스를 가두고 배경을 비활성화한 뒤 호출자로 돌려보낸다", async ({ page }) => {
        const errors = collectErrors(page);
        await loadMain(page);

        const opener = page.locator('button[onclick="toggleSettings(true)"]');
        await opener.click();
        const overlay = page.locator("#settingsOverlay");
        const dialog = overlay.getByRole("dialog", { name: "오디오 구성" });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-dialog-initial]")).toBeFocused();
        await expect(page.locator("body")).toHaveClass(/dialog-open/);
        expect(await page.locator(".page-shell").evaluate((element) => ({
            inert: element.inert,
            ariaHidden: element.getAttribute("aria-hidden")
        }))).toEqual({ inert: true, ariaHidden: "true" });

        const focusable = dialog.locator("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]");
        await focusable.last().focus();
        await page.keyboard.press("Tab");
        await expect(focusable.first()).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(focusable.last()).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(overlay).toBeHidden();
        await expect(opener).toBeFocused();
        await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
        expect(await page.locator(".page-shell").evaluate((element) => element.inert)).toBe(false);
        expect(errors).toEqual([]);
    });

    test("편성표 탭은 선택 상태와 방향키 탐색을 함께 갱신한다", async ({ page }) => {
        await loadMain(page);
        await page.locator("#headerSchedBtn").evaluate((button) => {
            button.hidden = false;
            button.click();
        });

        const today = page.getByRole("tab", { name: "오늘" });
        const tomorrow = page.getByRole("tab", { name: "내일" });
        const reservations = page.getByRole("tab", { name: /예약 녹음/ });
        await expect(today).toHaveAttribute("aria-selected", "true");
        await expect(today).toHaveAttribute("aria-controls", "schedList");
        await expect(today).toBeFocused();

        await page.keyboard.press("ArrowRight");
        await expect(tomorrow).toBeFocused();
        await expect(tomorrow).toHaveAttribute("aria-selected", "true");
        await expect(today).toHaveAttribute("tabindex", "-1");

        await page.keyboard.press("End");
        await expect(reservations).toBeFocused();
        await expect(reservations).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("#schedResPane")).toBeVisible();
        await expect(page.locator("#schedResPane")).toHaveAttribute("role", "tabpanel");
    });

    test("동적 모델 피커·녹음·확대 버튼의 토글 의미를 정규화한다", async ({ page }) => {
        await loadMain(page);
        await page.locator('button[onclick="toggleSettings(true)"]').click();

        await expect.poll(() => page.locator(".skin-picker .skin-btn").count()).toBeGreaterThan(5);
        const pickerStates = await page.locator(".skin-picker .skin-btn").evaluateAll((buttons) =>
            buttons.map((button) => ({
                active: button.classList.contains("active"),
                pressed: button.getAttribute("aria-pressed")
            })));
        expect(pickerStates.every(({ active, pressed }) => pressed === String(active))).toBe(true);

        const record = page.locator("#btnRec");
        await expect(record).toHaveAttribute("aria-pressed", "false");
        await record.evaluate((button) => button.classList.add("recording"));
        await expect(record).toHaveAttribute("aria-pressed", "true");

        await page.keyboard.press("Escape");
        await expect(page.locator('button[onclick="toggleSettings(true)"]')).toBeFocused();
        const zoom = page.locator(".unit-zoom-btn").first();
        await expect(zoom).toHaveAttribute("aria-pressed", "false");
        await zoom.focus();
        await expect(zoom).toBeFocused();
        const focusStyle = await zoom.evaluate((button) => {
            const style = getComputedStyle(button);
            return { opacity: style.opacity, outlineWidth: style.outlineWidth };
        });
        expect(focusStyle).toEqual({ opacity: "1", outlineWidth: "3px" });
    });

    test("모바일 고정 플레이어 높이에 맞춰 본문 하단 여백을 계산한다", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 700 });
        await loadMain(page);

        await expect.poll(() => page.evaluate(() =>
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mobile-player-clearance")) || 0
        )).toBeGreaterThan(0);
        const metrics = await page.evaluate(() => {
            const wrapHeight = document.querySelector(".hero-player-wrap").getBoundingClientRect().height;
            const clearance = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue("--mobile-player-clearance"));
            const paddingBottom = parseFloat(getComputedStyle(document.querySelector(".page-shell")).paddingBottom);
            return { wrapHeight, clearance, paddingBottom };
        });
        expect(metrics.clearance).toBeGreaterThanOrEqual(metrics.wrapHeight + 27);
        expect(metrics.paddingBottom).toBeGreaterThanOrEqual(metrics.clearance);
    });
});

test.describe("위젯 계약", () => {
    test("설명서와 임베드 예제가 실제 view·보안 계약을 안내한다", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/manual.html");
        const manualText = await page.locator("body").innerText();
        expect(manualText).toContain("?view=simple");
        expect(manualText).toContain("?view=bar");
        expect(manualText).toContain("랙 화면이 기본");
        expect(manualText).not.toContain("기본으로 간편 플레이어 모드");

        await page.goto("/embed.html");
        await expect(page.locator("body")).toContainText("allowedOrigin");
        await expect(page.locator("body")).toContainText("event.source");
        const snippets = await page.locator("pre code").allInnerTexts();
        expect(snippets.join("\n")).not.toMatch(/postMessage\([^\n]+,\s*['"]\*['"]\)/);
    });

    test("랜드마크·상태 알림과 reduced-motion 정지 상태를 제공한다", async ({ page }) => {
        await mockExternal(page.context());
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/widget.html?skin=tuner&station=kbs1fm");

        await expect(page.getByRole("main", { name: "Mad for Audio 미니 플레이어" })).toBeVisible();
        await expect(page.locator("#wStatus")).toHaveAttribute("role", "status");
        await expect(page.locator("#wStatus")).toHaveAttribute("aria-live", "polite");
        await expect(page.locator("#btnPlay")).toHaveAttribute("aria-pressed", "false");
        expect(await page.locator(".eq i").first().evaluate((bar) => getComputedStyle(bar).animationName)).toBe("none");

        const meter = await page.evaluate(() => {
            isPlaying = true;
            updateUi();
            return { rafStopped: meterRaf === null, transform: meterNeedle.getAttribute("transform") };
        });
        expect(meter.rafStopped).toBe(true);
        expect(meter.transform).not.toBe("rotate(-42 33 40)");
    });

    test("postMessage는 부모 source·정확한 origin·nonce가 모두 맞을 때만 처리한다", async ({ page }) => {
        await mockExternal(page.context());
        await page.goto("/embed.html");
        await page.evaluate(() => {
            document.body.innerHTML = '<iframe id="target" title="target"></iframe><iframe id="attacker" title="attacker"></iframe>';
            const nonce = "ui-contract-test";
            const url = new URL("/widget.html", location.href);
            url.searchParams.set("allowedOrigin", location.origin);
            url.searchParams.set("nonce", nonce);
            document.getElementById("target").src = url.href;
            window.__widgetTest = { nonce, origin: url.origin };
        });

        const widgetFrame = page.frameLocator("#target");
        await expect(widgetFrame.locator("#volume")).toHaveValue("80");

        await page.evaluate(() => {
            const frame = document.getElementById("target");
            frame.contentWindow.postMessage(
                { type: "fmRadio:setVolume", value: 10, nonce: "wrong" },
                window.__widgetTest.origin
            );
        });
        await page.waitForTimeout(50);
        await expect(widgetFrame.locator("#volume")).toHaveValue("80");

        await page.evaluate(() => {
            const frame = document.getElementById("target");
            frame.contentWindow.postMessage(
                { type: "fmRadio:setVolume", value: 25, nonce: window.__widgetTest.nonce },
                window.__widgetTest.origin
            );
        });
        await expect(widgetFrame.locator("#volume")).toHaveValue("25");

        await page.evaluate(() => {
            document.getElementById("attacker").contentWindow.eval(`
                parent.document.getElementById("target").contentWindow.postMessage(
                    { type: "fmRadio:setVolume", value: 5, nonce: parent.__widgetTest.nonce },
                    parent.__widgetTest.origin
                );
            `);
        });
        await page.waitForTimeout(50);
        await expect(widgetFrame.locator("#volume")).toHaveValue("25");
    });
});
