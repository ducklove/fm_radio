/* Mad for Audio PWA 서비스워커
 * 원칙: 앱 셸(HTML/JS/아이콘/폰트/라이브러리)만 캐싱한다.
 * 라이브 스트림(.m3u8/.ts/.aac)과 방송사 API, 애널리틱스는 절대 가로채지 않고
 * 네트워크로 그대로 통과시킨다 — 오디오 range 요청과 실시간성을 깨지 않기 위함.
 */
const CACHE_PREFIX = "fm-radio-";
const CACHE = "fm-radio-v150";
// 일반 URL과 분리한 합성 키를 사용한다. manual.html 같은 다른 내비게이션 응답이
// 오프라인 앱 셸을 덮어쓰지 못하게 하기 위함이다.
const NAVIGATION_CACHE_KEY = new URL("__mfa_navigation_shell__", self.registration.scope).href;

// 같은 출처 필수 셸 — 설치가 실패하면 앱이 안 뜨므로 반드시 캐싱한다.
const CORE = [
    "./",
    "index.html",
    "manual.html",
    "widget.html",
    "turntable.html",
    "embed.html",
    "styles.css?v=150",
    "styles-foundation.css?v=150",
    "styles-library.css?v=150",
    "styles-schedule.css?v=150",
    "styles-tape.css?v=150",
    "stations.js?v=150",
    "player-core.js?v=150",
    "app-runtime-core.js?v=150",
    "native-hls-capture.js?v=150",
    "store.js?v=150",
    "schedule.js?v=150",
    "model-registry.js?v=150",
    "skins.js?v=150",
    "component-skins.js?v=150",
    "engine.js?v=150",
    "animation-scheduler.js?v=150",
    "deck.js?v=150",
    "ui-controls.js?v=150",
    "records.json?v=150",
    "bootstrap.js?v=150",
    "app.js?v=150",
    "manifest.webmanifest",
    "icons/icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png",
    "images/side-speaker.webp"
];

// 오프라인에서도 UI가 뜨도록 캐싱하는 CDN 라이브러리(버전 고정 = 불변).
// 일시적 실패가 설치를 막지 않도록 best-effort로 담는다.
const CDN = [
    "https://cdn.jsdelivr.net/npm/hls.js@1.5.17",
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
];

// 특정 셸에서만 쓰는 자산은 설치 실패를 유발하지 않게 best-effort로 캐싱한다.
// 트레이 iframe이 오프라인으로 열릴 때는 캐시가 있으면 그대로 사용할 수 있다.
const OPTIONAL = [
    "tray-bridge.js?v=150"
];

const CORE_PATHS = new Set(CORE.map((asset) => new URL(asset, self.registration.scope).pathname));
const STREAM_EXT_RE = /\.(?:m3u8|m3u|ts|aac|m4a|mp3|oga|ogg|opus|wav|flac)(?:$|\/)/i;

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE);
        const shell = await cache.match(new URL("index.html", self.registration.scope).href);
        if (shell) await cache.put(NAVIGATION_CACHE_KEY, shell.clone());
        await Promise.allSettled([...CDN, ...OPTIONAL].map((url) => cache.add(url)));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        // 이 앱이 만든 이전 세대만 정리한다. 같은 출처의 다른 PWA 캐시는 보존한다.
        await Promise.all(keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

// 업데이트 즉시 적용을 위한 훅
self.addEventListener("message", (event) => {
    if (event.data === "skipWaiting") self.skipWaiting();
});

function isJsdelivr(url) {
    return url.hostname === "cdn.jsdelivr.net";
}

function isStreamingRequest(request, url) {
    return request.destination === "audio"
        || request.destination === "video"
        || request.headers.has("range")
        || STREAM_EXT_RE.test(url.pathname);
}

function isAppShellNavigation(url) {
    const scope = new URL(self.registration.scope);
    const scopePath = scope.pathname.endsWith("/") ? scope.pathname : `${scope.pathname}/`;
    return url.pathname === scopePath || url.pathname === `${scopePath}index.html`;
}

function isKnownStaticRequest(request, url) {
    if (CORE_PATHS.has(url.pathname)) return true;
    return ["script", "style", "image", "font", "manifest"].includes(request.destination);
}

async function navigationResponse(request, url) {
    const cache = await caches.open(CACHE);
    try {
        const fresh = await fetch(request);
        // 서버 장애일 때는 설치된 셸로 복구하되, 정상적인 4xx는 그대로 보여 준다.
        if (fresh.status >= 500) throw new Error(`navigation response ${fresh.status}`);
        if (fresh.ok) {
            const key = isAppShellNavigation(url) ? NAVIGATION_CACHE_KEY : request;
            cache.put(key, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (error) {
        const exact = isAppShellNavigation(url)
            ? null
            : await cache.match(request, { ignoreSearch: true });
        return exact
            || await cache.match(NAVIGATION_CACHE_KEY)
            || await cache.match(new URL("index.html", self.registration.scope).href)
            || Response.error();
    }
}

self.addEventListener("fetch", (event) => {
    const request = event.request;

    // GET만 처리한다.
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    // 스트림·세그먼트·range 요청은 같은 출처 프록시를 쓰더라도 완전히 비개입한다.
    if (isStreamingRequest(request, url)) return;

    // 우리가 아는 자산(같은 출처 + jsdelivr)만 다룬다.
    // 그 외(스트림 세그먼트, 방송사 API, GA 등)는 손대지 않고 네트워크로 통과.
    if (!sameOrigin && !isJsdelivr(url)) return;

    // 내비게이션(페이지 이동): 네트워크 우선 → 실패 시 캐시된 셸.
    if (request.mode === "navigate") {
        event.respondWith(navigationResponse(request, url));
        return;
    }

    // jsdelivr 라이브러리/폰트: 캐시 우선(불변 자산).
    if (isJsdelivr(url)) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            const hit = await cache.match(request);
            if (hit) return hit;
            const res = await fetch(request);
            if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()).catch(() => {});
            return res;
        })());
        return;
    }

    // 알려진 같은 출처 정적 자산만 stale-while-revalidate. API 응답은 캐싱하지 않는다.
    if (!isKnownStaticRequest(request, url)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        const network = fetch(request).then((res) => {
            if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
            return res;
        }).catch(() => null);
        return hit || (await network) || Response.error();
    })());
});
