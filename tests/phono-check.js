// 턴테이블 음반 오디오 URL 점검 (로컬 전용 — CI/클라우드에서는 Wikimedia가 막혀 돌지 않는다)
// 실제 앱의 RECORDS/commonsPath 로직을 그대로 읽어 URL을 뽑고, 각 트랙을 실제로 요청해 본다.
// 사용법: node phono-check.js   (별도 서버 불필요 — 내부에서 정적 서버를 띄운다)
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("@playwright/test");

const PORT = 8199;
const ROOT = path.join(__dirname, "..");

function startServer() {
    const p = spawn("npx", ["http-server", ROOT, "-p", String(PORT), "-s", "-c-1"], { stdio: "ignore" });
    return p;
}

async function waitFor(url, tries = 40) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(url);
            if (r.ok) return true;
        } catch (e) { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("정적 서버가 뜨지 않았습니다");
}

async function checkUrl(url) {
    try {
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 fm-radio phono-check" } });
        const ct = res.headers.get("content-type") || "";
        return { ok: res.ok && /audio|ogg|mpeg|octet/i.test(ct), status: res.status, ct };
    } catch (e) {
        return { ok: false, status: 0, ct: String(e.message || e).slice(0, 40) };
    }
}

(async () => {
    const server = startServer();
    let code = 0;
    try {
        await waitFor(`http://127.0.0.1:${PORT}/index.html`);
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
        await page.waitForFunction(() => typeof RECORDS !== "undefined");
        const records = await page.evaluate(() =>
            RECORDS.map((r) => ({ id: r.id, title: r.title, urls: r.tracks.map((t) => PHONO_BASE + t.f) })));
        await browser.close();

        console.log(`음반 점검 — ${records.length}장\n`);
        for (const rec of records) {
            const results = await Promise.all(rec.urls.map(checkUrl));
            const okCount = results.filter((r) => r.ok).length;
            const bad = results.filter((r) => !r.ok);
            const mark = okCount === results.length ? "✅" : (okCount === 0 ? "❌" : "⚠️ ");
            console.log(`${mark} ${rec.title.padEnd(26)} ${okCount}/${results.length} 트랙`);
            bad.forEach((b, i) => {
                const url = rec.urls[results.indexOf(b)];
                console.log(`     - ${b.status} ${b.ct} · ${decodeURIComponent(url.split("/").pop())}`);
            });
            if (okCount === 0) code = 1;
        }
        console.log("\n깨진 음반은 index.html의 RECORDS에서 파일명만 고치면 됩니다 (경로는 자동 계산).");
    } catch (e) {
        console.error("점검 실패:", e.message);
        code = 1;
    } finally {
        server.kill();
    }
    process.exit(code);
})();
