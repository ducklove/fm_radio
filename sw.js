/* FM 라디오 PWA 서비스워커
 * 원칙: 앱 셸(HTML/JS/아이콘/폰트/라이브러리)만 캐싱한다.
 * 라이브 스트림(.m3u8/.ts/.aac)과 방송사 API, 애널리틱스는 절대 가로채지 않고
 * 네트워크로 그대로 통과시킨다 — 오디오 range 요청과 실시간성을 깨지 않기 위함.
 */
const CACHE = "fm-radio-v5";

// 같은 출처 필수 셸 — 설치가 실패하면 앱이 안 뜨므로 반드시 캐싱한다.
const CORE = [
    "./",
    "index.html",
    "stations.js",
    "player-core.js",
    "manifest.webmanifest",
    "icons/icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png"
];

// 오프라인에서도 UI가 뜨도록 캐싱하는 CDN 라이브러리(버전 고정 = 불변).
// 일시적 실패가 설치를 막지 않도록 best-effort로 담는다.
const CDN = [
    "https://cdn.jsdelivr.net/npm/hls.js@1.5.17",
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE);
        await Promise.allSettled(CDN.map((url) => cache.add(url)));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
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

self.addEventListener("fetch", (event) => {
    const request = event.request;

    // GET만 처리한다.
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    // 우리가 아는 자산(같은 출처 + jsdelivr)만 다룬다.
    // 그 외(스트림 세그먼트, 방송사 API, GA 등)는 손대지 않고 네트워크로 통과.
    if (!sameOrigin && !isJsdelivr(url)) return;

    // 내비게이션(페이지 이동): 네트워크 우선 → 실패 시 캐시된 셸.
    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE);
                cache.put("./", fresh.clone()).catch(() => {});
                return fresh;
            } catch (err) {
                const cache = await caches.open(CACHE);
                return (await cache.match("./"))
                    || (await cache.match("index.html"))
                    || Response.error();
            }
        })());
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

    // 같은 출처 정적 자산: stale-while-revalidate.
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
