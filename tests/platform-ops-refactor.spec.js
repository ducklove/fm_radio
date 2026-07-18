const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test.describe("플랫폼 운영 리팩토링", () => {
    test("서비스워커는 소유 캐시만 정리하고 스트림을 가로채지 않는다", () => {
        const source = read("sw.js");

        expect(source).toContain('const CACHE_PREFIX = "fm-radio-"');
        expect(source).toContain("key.startsWith(CACHE_PREFIX) && key !== CACHE");
        expect(source).toContain("NAVIGATION_CACHE_KEY");
        expect(source).toContain("isStreamingRequest(request, url)");
        expect(source).toContain('request.headers.has("range")');
        expect(source.indexOf("if (isStreamingRequest(request, url)) return"))
            .toBeLessThan(source.indexOf("event.respondWith(navigationResponse(request, url))"));
    });

    test("Electron 셸은 격리·탐색·권한 보안 계약을 명시한다", () => {
        const main = read("tray/main.js");
        const preload = read("tray/preload.js");
        const shell = read("tray/shell.html");
        const pkg = JSON.parse(read("tray/package.json"));

        expect(main).toMatch(/contextIsolation:\s*true/);
        expect(main).toMatch(/nodeIntegration:\s*false/);
        expect(main).toMatch(/sandbox:\s*true/);
        expect(main).toMatch(/webSecurity:\s*true/);
        expect(main).toContain("setPermissionRequestHandler");
        expect(main).toContain("setPermissionCheckHandler");
        expect(main).toContain("setWindowOpenHandler");
        expect(main).toContain('on("will-navigate"');
        expect(main).toContain('on("will-frame-navigate"');
        expect(preload).toContain("Object.freeze");
        expect(shell).toContain("event.source !== load.frame.contentWindow");
        expect(shell).toContain("event.origin !== load.origin");
        expect(shell).toContain("previousFrame.replaceWith(nextFrame)");
        expect(shell).toContain("data.nonce !== load.nonce");
        expect(shell).toContain('origin: isOpaqueFile ? "null" : url.origin');
        expect(shell).toContain('targetOrigin: target.opaque ? "*" : target.origin');
        expect(pkg.devDependencies.electron).toBe("43.1.1");
        expect(pkg.devDependencies["electron-builder"]).toBe("26.15.3");
        expect(pkg.engines.node).toBe(">=22.12.0");
    });

    test("트레이 셸은 현재 iframe의 source·origin·generation·nonce만 IPC로 전달한다", async ({ page }) => {
        await page.addInitScript(() => {
            window.__trayEvents = { states: [], views: [] };
            window.trayBridge = Object.freeze({
                sendState(message) {
                    window.__trayEvents.states.push(Object.assign({}, message));
                },
                sendView(view) {
                    window.__trayEvents.views.push(view);
                },
                requestFull() {},
                onCommand(callback) {
                    window.__trayCommand = callback;
                    return () => {};
                }
            });
        });

        await page.route("**/tests/.shell-frame*", async (route) => {
            await route.fulfill({
                contentType: "text/html; charset=utf-8",
                body: `<!doctype html><meta charset="utf-8"><script>
                    const params = new URLSearchParams(location.search);
                    const view = params.get("view");
                    const message = {
                        type: "fmRadio:ready",
                        stationName: view,
                        playing: false,
                        loading: false
                    };
                    if (view === "tuner") message.nonce = params.get("nonce");
                    parent.postMessage(message, location.origin);
                <\/script>`
            });
        });

        const baseUrl = test.info().project.use.baseURL;
        const tunerUrl = new URL("tests/.shell-frame?view=tuner", baseUrl).href;
        const systemUrl = new URL("tests/.shell-frame?view=system", baseUrl).href;
        await page.goto(`/tray/shell.html?tuner=${encodeURIComponent(tunerUrl)}&system=${encodeURIComponent(systemUrl)}`);

        await expect.poll(() => page.evaluate(() => window.__trayEvents.states.length)).toBe(1);
        const initial = await page.evaluate(() => {
            const active = document.getElementById("widgetFrame");
            const url = new URL(active.src);
            return {
                generation: active.dataset.loadGeneration,
                nonce: url.searchParams.get("nonce"),
                shellGeneration: url.searchParams.get("shellGeneration"),
                stationName: window.__trayEvents.states[0].stationName
            };
        });
        expect(initial.generation).toBe("1");
        expect(initial.shellGeneration).toBe("1");
        expect(initial.nonce).toMatch(/^[0-9a-f-]{36}$/i);
        expect(initial.stationName).toBe("tuner");

        const filteredCount = await page.evaluate(() => {
            const active = document.getElementById("widgetFrame");
            const activeUrl = new URL(active.src);
            const nonce = activeUrl.searchParams.get("nonce");
            const origin = activeUrl.origin;
            window.dispatchEvent(new MessageEvent("message", {
                source: active.contentWindow,
                origin,
                data: { type: "fmRadio:state", stationName: "wrong nonce", nonce: "wrong" }
            }));
            window.dispatchEvent(new MessageEvent("message", {
                source: window,
                origin,
                data: { type: "fmRadio:state", stationName: "wrong source", nonce }
            }));
            window.dispatchEvent(new MessageEvent("message", {
                source: active.contentWindow,
                origin: "https://attacker.invalid",
                data: { type: "fmRadio:state", stationName: "wrong origin", nonce }
            }));
            return window.__trayEvents.states.length;
        });
        expect(filteredCount).toBe(1);

        await page.evaluate(() => {
            const active = document.getElementById("widgetFrame");
            const activeUrl = new URL(active.src);
            window.__staleFrame = {
                source: active.contentWindow,
                origin: activeUrl.origin,
                nonce: activeUrl.searchParams.get("nonce")
            };
            window.dispatchEvent(new MessageEvent("message", {
                source: active.contentWindow,
                origin: activeUrl.origin,
                data: {
                    type: "fmRadio:state",
                    stationName: "current tuner",
                    nonce: activeUrl.searchParams.get("nonce")
                }
            }));
            window.__trayCommand({ setView: "system" });
        });

        await expect.poll(() => page.evaluate(() => window.__trayEvents.states.length)).toBe(3);
        await expect.poll(() => page.evaluate(() => window.__trayEvents.views.join(","))).toBe("system");

        const finalState = await page.evaluate(() => {
            const current = document.getElementById("widgetFrame");
            const currentOrigin = new URL(current.src).origin;
            const before = window.__trayEvents.states.length;

            // 제거된 이전 프레임은 올바른 옛 nonce와 origin을 알아도 상태와 openView를 전달할 수 없다.
            window.dispatchEvent(new MessageEvent("message", {
                source: window.__staleFrame.source,
                origin: window.__staleFrame.origin,
                data: {
                    type: "fmRadio:openView",
                    view: "tuner",
                    nonce: window.__staleFrame.nonce
                }
            }));
            window.dispatchEvent(new MessageEvent("message", {
                source: window.__staleFrame.source,
                origin: window.__staleFrame.origin,
                data: {
                    type: "fmRadio:state",
                    stationName: "stale tuner",
                    nonce: window.__staleFrame.nonce
                }
            }));

            // 전체 랙의 기존 계약은 nonce 없는 상태 메시지를 보낸다. 현재 source/origin이면 계속 허용한다.
            window.dispatchEvent(new MessageEvent("message", {
                source: current.contentWindow,
                origin: currentOrigin,
                data: { type: "fmRadio:state", stationName: "current system" }
            }));

            return {
                before,
                after: window.__trayEvents.states.length,
                last: window.__trayEvents.states.at(-1).stationName,
                generation: current.dataset.loadGeneration,
                views: window.__trayEvents.views.slice()
            };
        });
        expect(finalState).toEqual({
            before: 3,
            after: 4,
            last: "current system",
            generation: "2",
            views: ["system"]
        });
    });

    test("음반 카탈로그 장애는 포노만 degraded 상태로 격리한다", async ({ browser }) => {
        const context = await browser.newContext({ serviceWorkers: "block" });
        const page = await context.newPage();
        await page.route("**/records.json*", (route) => route.abort("failed"));

        try {
            await page.goto("/index.html", { waitUntil: "domcontentloaded" });
            const state = await page.evaluate(async () => {
                const ready = await window.MFA_READY;
                return {
                    phase: ready.phase,
                    catalog: ready.catalog.status,
                    phono: ready.capabilities.phono,
                    records: window.MFA_RECORDS.length,
                    stationShell: !!document.getElementById("nowStation")
                };
            });

            expect(state).toEqual({
                phase: "ready",
                catalog: "degraded",
                phono: false,
                records: 0,
                stationShell: true
            });
            await expect(page.locator("#audioStateChip")).toContainText("포노 제한");
        } finally {
            await context.close();
        }
    });

    test("설치된 앱 셸은 오프라인에서 부팅되고 스트림 요청은 실패를 그대로 전달한다", async ({ context, page }) => {
        await page.goto("/index.html", { waitUntil: "load" });
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);

        const streamUrl = new URL("tests/.stream/playlist.m3u8", test.info().project.use.baseURL).href;
        const online = await page.evaluate(async (url) => {
            const response = await fetch(url, { cache: "no-store" });
            return { ok: response.ok, text: await response.text() };
        }, streamUrl);
        expect(online.ok).toBe(true);
        expect(online.text).toContain("#EXTM3U");

        await context.setOffline(true);
        try {
            const intercepted = await page.evaluate(async (url) => {
                try {
                    const response = await fetch(url, { cache: "no-store" });
                    return { served: true, status: response.status };
                } catch (error) {
                    return { served: false, name: error.name };
                }
            }, streamUrl);
            expect(intercepted.served).toBe(false);

            await page.reload({ waitUntil: "domcontentloaded" });
            const offlineState = await page.evaluate(async () => {
                const ready = await window.MFA_READY;
                return {
                    controlled: !!navigator.serviceWorker.controller,
                    phase: ready.phase,
                    catalog: ready.catalog.status,
                    stationShell: !!document.getElementById("nowStation")
                };
            });
            expect(offlineState).toEqual({
                controlled: true,
                phase: "ready",
                catalog: "ready",
                stationShell: true
            });

            for (const [pathname, title] of [
                ["/manual.html", "사용설명서 — Mad for Audio"],
                ["/widget.html", "Mad for Audio 미니 플레이어"],
                ["/embed.html", "FM 라디오 위젯 · 임베드 안내"]
            ]) {
                await page.goto(pathname, { waitUntil: "domcontentloaded" });
                await expect(page).toHaveTitle(title);
            }
        } finally {
            await context.setOffline(false);
        }
    });
});
