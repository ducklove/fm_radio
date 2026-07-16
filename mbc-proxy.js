// 자가 프록시 — CORS가 없는 방송사 API를 대신 받아 준다.
//  1) ?channel=sfm|mfm            : MBC 스트림 URL 릴레이 (기존 기능)
//  2) ?schedule=<id>&date=YYYYMMDD: CBS·EBS·YTN 편성표 HTML을 파싱해 JSON으로 반환
// 배포: 홈 서버에서 mbc-proxy.service(systemd)로 상시 실행. 인증서가 없으면(로컬 개발) HTTP로 뜬다.
const fs = require("fs");
const https = require("https");
const http = require("http");

const ALLOWED_CHANNELS = new Set(["sfm", "mfm"]);
const PORT = 3689;

// ----- 원격 HTML/텍스트 가져오기 (타임아웃 포함) -----
function fetchText(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (fm-radio schedule proxy)" } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchText(new URL(res.headers.location, url).href));
            }
            if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode + " " + url));
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.setTimeout(12000, () => req.destroy(new Error("timeout " + url)));
    });
}

function stripTags(html) {
    return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function toMin(hhmm) {
    const m = String(hhmm || "").match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// ----- CBS: 주간 편성 페이지(SSR)에서 해당 날짜 열을 뽑는다 -----
async function scheduleCbs(type, ymd) {
    const html = await fetchText("https://www.cbs.co.kr/schedule?type=" + type + "&date=" + ymd);
    const cols = [...html.matchAll(/fulldate="(\d{8})"[^>]*>\s*<ul class="time-table">([\s\S]*?)<\/ul>/g)];
    const col = cols.find((c) => c[1] === ymd);
    if (!col) return [];
    const items = [];
    for (const li of col[2].split(/<li class="slide/).slice(1)) {
        const time = li.match(/class="time">([^<]*)</);
        const text = stripTags(li).replace(/^[^\d]*\d{2}:\d{2}\s*/, "");
        const startMin = time && toMin(time[1]);
        if (startMin != null && text) {
            items.push({ startMin, title: text.replace(/^-+>?\s*/, "").replace(/\s*ON AIR\s*$/i, ""), sub: "" });
        }
    }
    return items;
}

// ----- EBS FM: 온에어 페이지의 당일 타임라인 조각(HTML)을 파싱 -----
async function scheduleEbs() {
    const html = await fetchText("https://www.ebs.co.kr/onair/scheduleNew?channelCodeString=RADIO");
    const items = [];
    for (const li of html.split(/<li[\s>]/).slice(1)) {
        const time = li.match(/<span>\s*(\d{1,2}:\d{2})\s*<\/span>/);
        const title = li.match(/<strong>\s*(?:<a[^>]*>)?([^<]+)/);
        if (time && title) items.push({ startMin: toMin(time[1]), title: title[1].trim(), sub: "" });
    }
    return items;
}

// ----- YTN 라디오: 프로그램 목록의 [요일] HH:MM~HH:MM 패턴으로 해당 날짜 편성을 구성 -----
// 요일 태그는 [매일]/[평일]/[월~금]/[월-금]/[토,일]/[월] 꼴, 시간은 ~ 또는 - 로 잇는다.
// 한 프로그램에 재방 슬롯이 붙기도 한다: "[매일] 16:20~17:00 [평일] 21:20~22:00(재방)"
const YTN_DOW = "일월화수목금토";

function ytnDayMatch(pattern, dow) {
    const p = pattern.replace(/\s/g, "").replace(/평일/, "월~금").replace(/-/g, "~");
    if (p.includes("매일")) return true;
    const range = p.match(/([일월화수목금토])~([일월화수목금토])/);
    if (range) {
        const a = YTN_DOW.indexOf(range[1]);
        const b = YTN_DOW.indexOf(range[2]);
        if (a <= b) return dow >= a && dow <= b;
        return dow >= a || dow <= b;
    }
    return p.split(/[,·]/).some((d) => YTN_DOW.indexOf(d.trim()) === dow);
}

async function scheduleYtn(ymd) {
    const html = await fetchText("https://radio.ytn.co.kr/program/daily.php");
    const dow = new Date(parseInt(ymd.slice(0, 4), 10), parseInt(ymd.slice(4, 6), 10) - 1, parseInt(ymd.slice(6, 8), 10)).getDay();
    const items = [];
    for (const dl of html.split(/<dl[\s>]/).slice(1)) {
        const title = dl.match(/class="title">(?:\s*<a[^>]*>)?\s*([^<]+)</);
        const timeDd = dl.match(/class="time">([\s\S]*?)<\/dd>/);
        if (!title || !timeDd) continue;
        const name = title[1].replace(/^\[|\]$/g, "").trim();
        const timeText = stripTags(timeDd[1]);
        // 요일 태그별 구간으로 나눠 각각의 시간 범위를 뽑는다
        const segs = [...timeText.matchAll(/\[([^\]]+)\]([^[]*)/g)];
        for (const seg of segs) {
            if (!ytnDayMatch(seg[1], dow)) continue;
            const rerun = /재방/.test(seg[2]);
            for (const r of seg[2].matchAll(/(\d{1,2}:\d{2})\s*[~\^-]\s*(\d{1,2}:\d{2})/g)) {
                items.push({ startMin: toMin(r[1]), endMin: toMin(r[2]), title: name, sub: rerun ? "재방송" : "" });
            }
        }
    }
    items.sort((a, b) => a.startMin - b.startMin);
    return items;
}

const SCHEDULE_SOURCES = {
    cbsstd: (ymd) => scheduleCbs("fm", ymd),
    cbsmusic: (ymd) => scheduleCbs("musicFm", ymd),
    ebsfm: () => scheduleEbs(),
    ytn: (ymd) => scheduleYtn(ymd)
};

// 편성 응답 캐시 — 방송사 사이트에 부담을 주지 않도록 20분간 재사용
const schedCache = new Map();
const SCHED_TTL = 20 * 60 * 1000;

async function handleSchedule(url, res) {
    const id = url.searchParams.get("schedule");
    const ymd = (url.searchParams.get("date") || "").replace(/\D/g, "");
    const source = SCHEDULE_SOURCES[id];
    if (!source || !/^\d{8}$/.test(ymd)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "invalid schedule request" }));
    }
    const key = id + ":" + ymd;
    const hit = schedCache.get(key);
    if (hit && Date.now() - hit.at < SCHED_TTL) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(hit.body);
    }
    try {
        const items = await source(ymd);
        const body = JSON.stringify({ date: ymd, items });
        if (items.length) schedCache.set(key, { at: Date.now(), body });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
    } catch (error) {
        console.error("schedule " + key, error.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "failed to fetch schedule" }));
    }
}

function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `https://localhost:${PORT}`);

    if (url.searchParams.get("schedule")) {
        return handleSchedule(url, res);
    }

    const channel = url.searchParams.get("channel");
    if (!channel || !ALLOWED_CHANNELS.has(channel)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid channel");
    }

    const apiUrl = `https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=${channel}`;
    https.get(apiUrl, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => data += chunk);
        apiRes.on("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(data.trim());
        });
    }).on("error", () => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Failed to fetch MBC stream URL");
    });
}

// 인증서가 있으면 HTTPS(운영), 없으면 HTTP(로컬 개발)로 뜬다
let server;
try {
    server = https.createServer({
        cert: fs.readFileSync("/etc/letsencrypt/live/cantabile.tplinkdns.com/fullchain.pem"),
        key: fs.readFileSync("/etc/letsencrypt/live/cantabile.tplinkdns.com/privkey.pem"),
    }, handler);
} catch (error) {
    console.warn("인증서를 읽지 못해 HTTP로 시작합니다 (로컬 개발 모드)");
    server = http.createServer(handler);
}
server.listen(PORT, () => {
    console.log(`fm-radio proxy running on port ${PORT}`);
});
