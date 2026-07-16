// 편성표 모듈 — 방송사별 편성 데이터를 공통 모델로 정규화한다.
// 공통 모델: { startMin, endMin, title, sub } — 요청한 날짜 0시 기준 분(자정을 넘으면 1440 이상).
// KBS·MBC·SBS는 CORS가 열려 있어 브라우저에서 직접 가져오고,
// CBS·EBS·YTN은 CORS가 없어 자가 프록시(mbc-proxy.js)가 HTML을 파싱해 준다.
(function () {
    const PROXY_BASE = "https://cantabile.tplinkdns.com:3689";
    const CACHE_TTL_MS = 3 * 60 * 60 * 1000;   // 편성은 자주 안 바뀐다 — 3시간 캐시

    // 채널별 데이터 소스. 여기 없는 채널(국악방송·극동방송)은 편성 미지원 — 직접 입력 예약만 가능.
    const SOURCES = {
        kbs1fm:  { type: "kbs", code: "24" },
        kbs2fm:  { type: "kbs", code: "25" },
        kbs1r:   { type: "kbs", code: "21" },
        kbs2r:   { type: "kbs", code: "22" },
        kbs3r:   { type: "kbs", code: "23" },
        mbcsfm:  { type: "mbc", code: "FM" },
        mbcfm4u: { type: "mbc", code: "FM4U" },
        sbslove: { type: "sbs", code: "Love" },
        sbspower:{ type: "sbs", code: "Power" },
        cbsstd:  { type: "proxy", code: "cbsstd" },
        cbsmusic:{ type: "proxy", code: "cbsmusic" },
        ebsfm:   { type: "proxy", code: "ebsfm", todayOnly: true },   // EBS는 당일 편성만 제공
        ytn:     { type: "proxy", code: "ytn" }
    };

    function supports(stationId) { return !!SOURCES[stationId]; }
    function todayOnly(stationId) { return !!(SOURCES[stationId] && SOURCES[stationId].todayOnly); }

    function ymdOf(date) {
        const p = (v) => String(v).padStart(2, "0");
        return "" + date.getFullYear() + p(date.getMonth() + 1) + p(date.getDate());
    }

    function fmtHM(min) {
        const m = ((min % 1440) + 1440) % 1440;
        return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    }

    function fetchJson(url) {
        return fetch(url, {
            signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
        }).then((res) => {
            if (!res.ok) throw new Error("편성 API 응답 오류: " + res.status);
            return res.json();
        });
    }

    // "HHMM" 또는 "HH:MM" → 분. 파싱 불가면 null.
    function toMin(str) {
        if (!str) return null;
        const m = String(str).match(/^(\d{1,2}):?(\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }

    // 항목 정리: 시간순 정렬, 자정 넘김 보정, 빈 제목 제거
    function finalize(items) {
        const out = items.filter((it) => it && it.title && it.startMin != null);
        out.sort((a, b) => a.startMin - b.startMin);
        out.forEach((it) => {
            if (it.endMin != null && it.endMin <= it.startMin) it.endMin += 1440;
        });
        // 종료 시각이 없는 항목은 다음 프로그램 시작까지로 본다 (마지막은 24:00)
        out.forEach((it, i) => {
            if (it.endMin == null) it.endMin = i < out.length - 1 ? out[i + 1].startMin : 1440;
        });
        return out;
    }

    async function fetchKbs(code, ymd) {
        const url = "https://static.api.kbs.co.kr/mediafactory/v1/schedule/weekly" +
            "?local_station_code=00&channel_code=" + code +
            "&program_planned_date_from=" + ymd + "&program_planned_date_to=" + ymd;
        const data = await fetchJson(url);
        const day = (Array.isArray(data) ? data : []).find((d) => d.program_planned_date === ymd);
        const list = (day && day.schedules) || [];
        return finalize(list.map((s) => ({
            startMin: toMin(String(s.program_planned_start_time || "").slice(0, 4)),
            endMin: toMin(String(s.program_planned_end_time || "").slice(0, 4)),
            title: s.programming_table_title || s.program_title || "",
            sub: [s.program_subtitle, s.rerun_classification === "재방" ? "재방송" : ""].filter(Boolean).join(" · ")
        })));
    }

    async function fetchMbc(code, ymd) {
        const url = "https://control.imbc.com/Schedule/Radio?sDate=" + ymd + "&sType=" + code;
        const data = await fetchJson(url);
        const dashed = ymd.slice(0, 4) + "-" + ymd.slice(4, 6) + "-" + ymd.slice(6, 8);
        return finalize((Array.isArray(data) ? data : [])
            .filter((it) => !it.BroadDate || it.BroadDate === dashed)
            .map((it) => ({
                startMin: toMin(it.StartTime),
                endMin: toMin(it.EndTime),
                title: it.Title || "",
                sub: it.Players || ""
            })));
    }

    async function fetchSbs(code, ymd) {
        const y = parseInt(ymd.slice(0, 4), 10);
        const m = parseInt(ymd.slice(4, 6), 10);
        const d = parseInt(ymd.slice(6, 8), 10);
        const data = await fetchJson("https://static.cloud.sbs.co.kr/schedule/" + y + "/" + m + "/" + d + "/" + code + ".json");
        return finalize((Array.isArray(data) ? data : []).map((it) => ({
            startMin: toMin(it.start_time),
            endMin: toMin(it.end_time),
            title: it.title || "",
            sub: it.guest || ""
        })));
    }

    async function fetchProxy(code, ymd) {
        const data = await fetchJson(PROXY_BASE + "/?schedule=" + code + "&date=" + ymd);
        return finalize((data.items || []).map((it) => ({
            startMin: it.startMin != null ? it.startMin : toMin(it.start),
            endMin: it.endMin != null ? it.endMin : toMin(it.end),
            title: it.title || "",
            sub: it.sub || ""
        })));
    }

    // 편성표 조회 — dayOffset: 0=오늘, 1=내일. 성공 결과는 localStorage에 캐싱.
    async function getSchedule(stationId, dayOffset) {
        const src = SOURCES[stationId];
        if (!src) throw new Error("편성 미지원 채널");
        const date = new Date();
        date.setDate(date.getDate() + (dayOffset || 0));
        const ymd = ymdOf(date);

        const cacheKey = "fmRadio.sched." + stationId + "." + ymd;
        const cached = loadJson(cacheKey, null);
        if (cached && cached.at && Date.now() - cached.at < CACHE_TTL_MS && Array.isArray(cached.items) && cached.items.length) {
            return { ymd, items: cached.items };
        }

        let items;
        if (src.type === "kbs") items = await fetchKbs(src.code, ymd);
        else if (src.type === "mbc") items = await fetchMbc(src.code, ymd);
        else if (src.type === "sbs") items = await fetchSbs(src.code, ymd);
        else items = await fetchProxy(src.code, ymd);

        if (items.length) {
            saveJson(cacheKey, { at: Date.now(), items });
            // 오래된 캐시 청소 — 당일·전일 이외 키는 지운다
            try {
                const keep = new Set([ymdOf(new Date()), ymd]);
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith("fmRadio.sched.") && !keep.has(k.slice(-8))) localStorage.removeItem(k);
                }
            } catch (e) {}
        }
        return { ymd, items };
    }

    // 현재(분) 방송 중인 프로그램 — 전날에서 자정을 넘어온 프로그램도 잡는다
    function programAt(items, min) {
        return items.find((it) => min >= it.startMin && min < it.endMin)
            || items.find((it) => min + 1440 >= it.startMin && min + 1440 < it.endMin)
            || null;
    }

    window.FMSchedule = { supports, todayOnly, getSchedule, programAt, fmtHM, ymdOf };
})();
