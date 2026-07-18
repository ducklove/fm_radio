// 재생 코어 — index.html(본체)과 widget.html(미니 플레이어)이 공유한다.
// HLS(MSE)·네이티브 HLS(iOS Safari)·일반 파일 세 경로를 하나의 API로 감싸고,
// 치명 오류 복구(재시도 상한·백오프·recoverMediaError)와
// 파괴된 인스턴스의 늦은 이벤트 무시를 공통으로 처리한다.
(function () {
    const NET_RETRY_MAX = 3;
    const activeHandleByAudio = new WeakMap();
    let handleSeq = 0;

    // audio 엘리먼트에 url을 붙이고 재생을 시작한다.
    // 반환 핸들: { kind: "hls"|"native"|"direct"|"unsupported", hls, destroy() }
    // 콜백: onBlocked(자동재생 차단·재생 실패), onRetry(n, max), onFatal(data), onUnsupported()
    // cb.hlsConfig: hls.js 생성 옵션 오버라이드 (예: 예약 녹음 수신기의 버퍼 정책)
    function attach(audio, url, cb) {
        cb = cb || {};
        const previous = activeHandleByAudio.get(audio);
        if (previous) previous.destroy();
        const isHlsUrl = url.indexOf(".m3u8") !== -1;
        const generation = ++handleSeq;
        let retryTimer = null;
        const mediaListeners = [];
        const handle = {
            generation,
            kind: "direct",
            hls: null,
            destroyed: false,
            isCurrent() {
                return !handle.destroyed && activeHandleByAudio.get(audio) === handle;
            },
            destroy() {
                if (handle.destroyed) return;
                handle.destroyed = true;
                if (retryTimer !== null) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
                mediaListeners.forEach(([name, listener]) => audio.removeEventListener(name, listener));
                mediaListeners.length = 0;
                if (handle.hls) {
                    handle.hls.destroy();
                    handle.hls = null;
                }
                if (activeHandleByAudio.get(audio) === handle) activeHandleByAudio.delete(audio);
            }
        };
        activeHandleByAudio.set(audio, handle);

        function whenCurrent(fn) {
            return function () {
                if (!handle.isCurrent()) return;
                return fn.apply(null, arguments);
            };
        }

        function listen(name, fn) {
            const listener = whenCurrent(fn);
            mediaListeners.push([name, listener]);
            audio.addEventListener(name, listener);
        }

        // 네이티브 HLS와 일반 파일도 HLS.js와 같은 오류 계약으로 수렴한다.
        // 공유 audio 요소에서 이전 핸들의 늦은 이벤트가 와도 isCurrent()가 폐기한다.
        listen("error", () => {
            if (handle.kind === "hls") return; // HLS.js ERROR가 복구/재시도 정책을 단독 소유한다
            if (cb.onError) cb.onError({
                kind: handle.kind,
                mediaError: audio.error || null,
                url
            });
        });

        if (isHlsUrl && typeof Hls !== "undefined" && Hls.isSupported()) {
            handle.kind = "hls";
            const hls = new Hls(Object.assign({ enableWorker: true, lowLatencyMode: true }, cb.hlsConfig || {}));
            handle.hls = hls;
            let netRetries = 0;
            let mediaRecovered = false;
            const recoverBudget = () => {
                if (retryTimer !== null) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
                netRetries = 0;
                mediaRecovered = false;
            };
            hls.loadSource(url);
            hls.attachMedia(audio);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (!handle.isCurrent()) return;
                recoverBudget();
                audio.play().catch(() => {
                    if (handle.isCurrent() && cb.onBlocked) cb.onBlocked();
                });
            });
            // 재시도 상한은 플레이어 수명 전체가 아니라 연속 장애 한 번의 예산이다.
            // 프래그먼트가 다시 버퍼에 들어오면 다음 독립 장애를 복구할 수 있게 충전한다.
            if (Hls.Events.FRAG_BUFFERED) hls.on(Hls.Events.FRAG_BUFFERED, recoverBudget);
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (!handle.isCurrent() || !data.fatal) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < NET_RETRY_MAX) {
                    // 무한 재시도 대신 백오프를 두고 상한을 건다
                    if (retryTimer !== null) return;
                    netRetries += 1;
                    if (cb.onRetry) cb.onRetry(netRetries, NET_RETRY_MAX);
                    retryTimer = setTimeout(() => {
                        retryTimer = null;
                        if (handle.isCurrent()) hls.startLoad();
                    }, 1000 * netRetries);
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
                    // 일시적 버퍼/디코딩 문제는 한 번 복구를 시도한다
                    mediaRecovered = true;
                    hls.recoverMediaError();
                } else {
                    handle.destroy();
                    if (cb.onFatal) cb.onFatal(data);
                }
            });
            return handle;
        }

        if (isHlsUrl && !audio.canPlayType("application/vnd.apple.mpegurl")) {
            handle.kind = "unsupported";
            if (handle.isCurrent() && cb.onUnsupported) cb.onUnsupported();
            return handle;
        }

        // 네이티브 HLS(사파리) 또는 일반 오디오 파일
        handle.kind = isHlsUrl ? "native" : "direct";
        audio.src = url;
        audio.play().catch(() => {
            if (handle.isCurrent() && cb.onBlocked) cb.onBlocked();
        });
        return handle;
    }

    window.PlayerCore = { attach };
})();
