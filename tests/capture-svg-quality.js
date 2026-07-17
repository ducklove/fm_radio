const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.MFA_CAPTURE_BASE || "http://127.0.0.1:8147/";
const runtimeScale = process.argv.includes("--runtime");
const OUT = runtimeScale ? "/tmp/mfa-svg-eval-runtime" : "/tmp/mfa-svg-eval";

const groups = {
    tuner: ["t2", "mr78", "m10b", "tu9900", "tx9500", "t110", "t100", "b760"],
    eq: ["ge5", "ge10", "ge10silver", "ge10chrome"],
    amp: ["tr", "mc2105", "el34", "300b", "kt88", "sa9900", "au111", "l550", "e303", "ma2375"],
    deck: ["dragon", "b215", "tcd3014", "tcka7es", "ctf1250", "w990"],
    turntable: ["pl12", "sl1200", "td124", "g301", "lp12"],
};

const selectors = {
    tuner: "#tunerStage svg",
    eq: "#eqStage svg",
    amp: "#ampStage svg",
    deck: "#deckStage svg",
    turntable: "#ttStage svg",
};

const pickers = {
    eq: "#eqPicker button",
    amp: "#ampPicker button",
    deck: "#deckPicker button",
    turntable: "#ttPicker button",
};

async function forcePoweredAppearance(page, selector) {
    await page.evaluate((sel) => {
        try {
            isPlaying = true;
            tunerWarm = 1;
            ampWarm = 1;
            tubeWarm = 1;
        } catch (error) {}
        const svg = document.querySelector(sel);
        if (!svg) return;
        svg.querySelectorAll(".lzPowerDim, .meterDark").forEach((el) => { el.style.opacity = "0"; });
        svg.querySelectorAll(".lampGlow, .ampLamp, .ampLegend, .dialScale").forEach((el) => { el.style.opacity = "1"; });
        svg.querySelectorAll("#tsFreq, #tsFreqGlow").forEach((el) => { el.style.opacity = "1"; });
    }, selector);
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: runtimeScale ? 1440 : 2200, height: 1500 },
        deviceScaleFactor: 1,
        colorScheme: "dark",
        reducedMotion: "reduce",
        serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("PAGEERROR", error.message));
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("fmRadio.coachDone", "true");
        localStorage.setItem("fmRadio.lastStation", JSON.stringify("kbs1fm"));
        localStorage.setItem("fmRadio.units", JSON.stringify({ tuner: true, eq: true, amp: true, deck: true, tt: true }));
        localStorage.setItem("fmRadio.eq", JSON.stringify({ on: true, model: "ge10", gains: {} }));
        localStorage.setItem("fmRadio.record", JSON.stringify(0));
    });
    await page.goto(BASE + "index.html", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(() => window.MFA_READY);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForSelector("#tunerStage svg", { timeout: 30000 });
    await page.evaluate((widePreview) => {
        document.body.className = "mode-rack";
        const shell = document.querySelector(".page-shell");
        if (shell && widePreview) {
            shell.style.width = "2140px";
            shell.style.maxWidth = "2140px";
            shell.style.padding = "20px";
        }
        const hero = document.querySelector(".hero-visual");
        if (hero) hero.style.overflow = "visible";
    }, !runtimeScale);

    for (const [group, ids] of Object.entries(groups)) {
        for (let index = 0; index < ids.length; index += 1) {
            const id = ids[index];
            if (group === "tuner") {
                await page.evaluate((modelId) => initTunerSkin(modelId), id);
            } else {
                await page.evaluate(({ picker, itemIndex }) => {
                    const button = document.querySelectorAll(picker)[itemIndex];
                    if (!button) throw new Error("picker item missing: " + picker + " #" + itemIndex);
                    button.click();
                }, { picker: pickers[group], itemIndex: index });
            }
            // W-990RX는 좌우 도어·브러시드 패널·다수 하드웨어 필터를 한 번에 구성한다.
            // Chromium이 합성 레이어를 완성하기 전에 캡처하면 검은 타일이 섞일 수 있어 한 프레임 더 안정화한다.
            await page.waitForTimeout(id === "w990" ? 700 : 240);
            await forcePoweredAppearance(page, selectors[group]);
            const target = page.locator(selectors[group]);
            await target.waitFor({ state: "visible" });
            const outPath = path.join(OUT, group + "-" + id + ".png");
            await target.screenshot({ path: outPath, animations: "disabled" });
            const box = await target.boundingBox();
            console.log(group + "/" + id, box && Math.round(box.width) + "x" + Math.round(box.height));
        }
    }

    const iconPage = await context.newPage();
    await iconPage.goto(BASE + "icons/icon.svg", { waitUntil: "load", timeout: 30000 });
    const icon = iconPage.locator("svg");
    await icon.waitFor({ state: "visible" });
    await icon.screenshot({ path: path.join(OUT, "icon.png"), animations: "disabled" });
    console.log("icon/icon", await icon.getAttribute("viewBox"));

    await browser.close();
    console.log("OUT", OUT);
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
