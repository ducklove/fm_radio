/*
 * Native-HLS byte capture for Safari/WKWebView.
 *
 * Safari plays HLS without Media Source Extensions, so hls.js cannot expose
 * BUFFER_APPENDING bytes. This small polling client follows the media
 * playlist and hands each new segment to the recording pipeline while the
 * native <audio> element remains responsible for playback.
 */
(function initNativeHlsCapture(global) {
    "use strict";

    function absoluteUrl(value, base) {
        try { return new URL(value, base).href; } catch (error) { return null; }
    }

    function attributeUri(line) {
        const quoted = line.match(/URI\s*=\s*"([^"]+)"/i);
        if (quoted) return quoted[1];
        const plain = line.match(/URI\s*=\s*([^,\s]+)/i);
        return plain ? plain[1] : null;
    }

    function parseHlsPlaylist(text, sourceUrl) {
        const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        let mediaSequence = 0;
        let targetDuration = 4;
        let pendingDuration = null;
        let expectVariant = false;
        let segmentIndex = 0;
        let initUrl = null;
        const variants = [];
        const segments = [];

        for (const line of lines) {
            if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) {
                mediaSequence = Number(line.slice(line.indexOf(":") + 1)) || 0;
                continue;
            }
            if (line.startsWith("#EXT-X-TARGETDURATION:")) {
                targetDuration = Number(line.slice(line.indexOf(":") + 1)) || targetDuration;
                continue;
            }
            if (line.startsWith("#EXT-X-STREAM-INF:")) {
                expectVariant = true;
                continue;
            }
            if (line.startsWith("#EXT-X-MAP:")) {
                const value = attributeUri(line);
                initUrl = value ? absoluteUrl(value, sourceUrl) : null;
                continue;
            }
            if (line.startsWith("#EXTINF:")) {
                pendingDuration = Number.parseFloat(line.slice(line.indexOf(":") + 1)) || 0;
                continue;
            }
            if (line.startsWith("#")) continue;

            const url = absoluteUrl(line, sourceUrl);
            if (!url) continue;
            if (expectVariant) {
                variants.push(url);
                expectVariant = false;
                continue;
            }
            if (pendingDuration != null) {
                segments.push({
                    url,
                    duration: pendingDuration,
                    sequence: mediaSequence + segmentIndex
                });
                segmentIndex += 1;
                pendingDuration = null;
            }
        }

        return Object.freeze({
            variants: Object.freeze(variants),
            segments: Object.freeze(segments),
            initUrl,
            targetDuration,
            endList: lines.includes("#EXT-X-ENDLIST")
        });
    }

    function sniffMime(bytes, url) {
        if (bytes && bytes.length > 8
                && bytes[4] === 0x66 && bytes[5] === 0x74
                && bytes[6] === 0x79 && bytes[7] === 0x70) return "audio/mp4";
        if (bytes && bytes[0] === 0x47) return "video/mp2t";
        const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch (error) { return ""; } })();
        if (/\.(?:m4s|mp4|m4a)$/.test(path)) return "audio/mp4";
        if (/\.(?:aac|adts)$/.test(path)) return "audio/aac";
        return "audio/mpeg";
    }

    function createNativeHlsCapture(options) {
        const opts = options || {};
        const fetchImpl = opts.fetch || global.fetch.bind(global);
        const setTimer = opts.setTimeout || global.setTimeout.bind(global);
        const clearTimer = opts.clearTimeout || global.clearTimeout.bind(global);
        const onChunk = typeof opts.onChunk === "function" ? opts.onChunk : () => {};
        const onError = typeof opts.onError === "function" ? opts.onError : () => {};
        const seen = new Set();
        let playlistUrl = String(opts.url || "");
        let stopped = false;
        let ready = false;
        let timerId = null;
        let controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        let initSeen = null;
        let lastError = null;
        let running = null;

        async function fetchResponse(url) {
            const response = await fetchImpl(url, {
                cache: "no-store",
                credentials: "omit",
                signal: controller ? controller.signal : undefined
            });
            if (!response.ok) throw new Error(`HLS capture response ${response.status}`);
            return response;
        }

        async function loadMediaPlaylist(url, depth) {
            if (depth > 3) throw new Error("HLS master playlist nesting is too deep");
            const response = await fetchResponse(url);
            const resolvedUrl = response.url || url;
            const parsed = parseHlsPlaylist(await response.text(), resolvedUrl);
            if (parsed.variants.length && !parsed.segments.length) {
                return loadMediaPlaylist(parsed.variants[0], depth + 1);
            }
            return { parsed, url: resolvedUrl };
        }

        async function emitBytes(url, duration, sequence) {
            const response = await fetchResponse(url);
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (stopped || !bytes.length) return;
            const mime = sniffMime(bytes, url);
            onChunk(Object.freeze({ bytes, duration, sequence, mime, url }));
            ready = true;
            lastError = null;
        }

        function schedule(seconds) {
            if (stopped || timerId !== null) return;
            const delay = Math.max(750, Math.min(10000, Number(seconds || 4) * 500));
            timerId = setTimer(() => {
                timerId = null;
                void poll();
            }, delay);
        }

        async function poll() {
            if (stopped || running) return running;
            running = (async () => {
                try {
                    const loaded = await loadMediaPlaylist(playlistUrl, 0);
                    if (stopped) return;
                    playlistUrl = loaded.url;
                    const playlist = loaded.parsed;
                    if (playlist.initUrl && playlist.initUrl !== initSeen) {
                        await emitBytes(playlist.initUrl, 0, `init:${playlist.initUrl}`);
                        initSeen = playlist.initUrl;
                    }
                    for (const segment of playlist.segments) {
                        if (stopped) return;
                        const key = `${segment.sequence}|${segment.url}`;
                        if (seen.has(key)) continue;
                        // Mark before awaiting so overlapping polls can never duplicate a segment.
                        seen.add(key);
                        try {
                            await emitBytes(segment.url, segment.duration, segment.sequence);
                        } catch (error) {
                            seen.delete(key);
                            throw error;
                        }
                    }
                    if (!playlist.endList) schedule(playlist.targetDuration);
                } catch (error) {
                    if (stopped || (error && error.name === "AbortError")) return;
                    lastError = error;
                    onError(error);
                    schedule(2);
                } finally {
                    running = null;
                }
            })();
            return running;
        }

        const api = Object.freeze({
            start() { void poll(); return api; },
            destroy() {
                if (stopped) return;
                stopped = true;
                if (timerId !== null) clearTimer(timerId);
                timerId = null;
                if (controller) controller.abort();
                controller = null;
            },
            get ready() { return ready; },
            get error() { return lastError; },
            get stopped() { return stopped; }
        });
        return api;
    }

    global.MFA = global.MFA || {};
    global.MFA.parseHlsPlaylist = parseHlsPlaylist;
    global.MFA.createNativeHlsCapture = createNativeHlsCapture;
})(window);
