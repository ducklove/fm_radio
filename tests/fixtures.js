// 공용 픽스처: 외부 의존(CDN·방송사 API·스트림)을 전부 로컬로 모킹한다.
// - jsdelivr → node_modules에서 동일 파일 주입 (오프라인·결정적)
// - KBS API → 모의 스트림 URL 반환
// - 모의 스트림 → gen-stream.js가 만든 로컬 HLS(MP3/TS)
// - 그 외 외부 요청 → 즉시 실패 (테스트가 네트워크 상태에 좌우되지 않도록)
const fs = require("fs");
const path = require("path");

const NM = path.join(__dirname, "node_modules");
const STREAM_DIR = path.join(__dirname, ".stream");
const MOCK_STREAM_URL = "https://mockstream.test/playlist.m3u8";
const MOCK_AUDIO_URL = "https://mockstream.test/sample.mp3";

function contentType(p) {
    if (p.endsWith(".js")) return "application/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".woff2")) return "font/woff2";
    if (p.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
    if (p.endsWith(".ts")) return "video/mp2t";
    if (p.endsWith(".mp3")) return "audio/mpeg";
    return "application/octet-stream";
}

async function mockExternal(context) {
    await context.route("https://cdn.jsdelivr.net/npm/hls.js@1.5.17", (route) =>
        route.fulfill({
            body: fs.readFileSync(path.join(NM, "hls.js/dist/hls.min.js")),
            contentType: "application/javascript",
        }));

    await context.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/**", (route) => {
        const rel = new URL(route.request().url()).pathname
            .replace("/gh/orioncactus/pretendard@v1.3.9/", "")
            .replace(".min.css", ".css");
        const file = path.join(NM, "pretendard", rel);
        if (fs.existsSync(file)) {
            return route.fulfill({ body: fs.readFileSync(file), contentType: contentType(file) });
        }
        return route.fulfill({ status: 404, body: "" });
    });

    await context.route("https://cfpwwwapi.kbs.co.kr/**", (route) =>
        route.fulfill({ json: { channel_item: [{ service_url: MOCK_STREAM_URL }] } }));

    await context.route("https://mockstream.test/**", (route) => {
        const name = path.basename(new URL(route.request().url()).pathname);
        const file = path.join(STREAM_DIR, name);
        if (fs.existsSync(file)) {
            return route.fulfill({ body: fs.readFileSync(file), contentType: contentType(file) });
        }
        return route.fulfill({ status: 404, body: "" });
    });

    await context.route("https://www.googletagmanager.com/**", (route) =>
        route.fulfill({ body: "window.__gtagStub=1;", contentType: "application/javascript" }));

    await context.route(
        /^https?:\/\/(?!127\.0\.0\.1|mockstream\.test|cdn\.jsdelivr\.net|cfpwwwapi\.kbs\.co\.kr|www\.googletagmanager\.com).*/,
        (route) => route.abort("connectionrefused"));
}

// 테스트 실패 원인 추적용: 콘솔 오류·페이지 예외를 수집한다.
// 모킹으로 의도적으로 끊은 외부 요청의 네트워크 오류는 잡음이라 거른다.
function collectErrors(page) {
    const errors = [];
    page.on("console", (msg) => {
        const text = msg.text();
        if (msg.type() === "error"
            && !text.includes("ERR_CONNECTION_REFUSED")
            && !text.includes("ERR_FAILED")
            && !text.includes("Failed to fetch")
            && !text.includes("Failed to load resource")) {
            errors.push(`[console] ${text}`);
        }
    });
    page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
    return errors;
}

module.exports = { mockExternal, collectErrors, MOCK_STREAM_URL, MOCK_AUDIO_URL };
