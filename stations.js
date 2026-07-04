// 채널 정의와 스트림 URL 해석 — index.html(본체)과 widget.html(미니 플레이어)이 공유한다.
(function () {
    const stations = [
        { id: "kbs1fm", name: "KBS 1FM", desc: "클래식 FM", group: "kbs", color: "#7b6a57", type: "kbs-api", apiUrl: "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/24" },
        { id: "kbs2fm", name: "KBS 2FM", desc: "Cool FM", group: "kbs", color: "#9b5d44", type: "kbs-api", apiUrl: "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/25" },
        { id: "kbs1r", name: "KBS 1라디오", desc: "뉴스·시사", group: "kbs", color: "#5d6877", type: "kbs-api", apiUrl: "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/21" },
        { id: "kbs2r", name: "KBS 2라디오", desc: "해피FM", group: "kbs", color: "#8a4335", type: "kbs-api", apiUrl: "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/22" },
        { id: "kbs3r", name: "KBS 3라디오", desc: "사회교육방송", group: "kbs", color: "#596f6a", type: "kbs-api", apiUrl: "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/23" },
        { id: "mbcsfm", name: "MBC 표준FM", desc: "95.9MHz", group: "mbc", color: "#3b6d9e", type: "mbc-api", apiUrl: "https://cantabile.tplinkdns.com:3689/?channel=sfm" },
        { id: "mbcfm4u", name: "MBC FM4U", desc: "91.9MHz", group: "mbc", color: "#2e8b7a", type: "mbc-api", apiUrl: "https://cantabile.tplinkdns.com:3689/?channel=mfm" },
        { id: "cbsstd", name: "CBS 표준FM", desc: "98.1MHz", group: "cbs", color: "#6d7f49", type: "direct", streamUrl: "https://m-aac.cbs.co.kr/mweb_cbs981/_definst_/cbs981.stream/playlist.m3u8" },
        { id: "cbsmusic", name: "CBS 음악FM", desc: "93.9MHz", group: "cbs", color: "#5c6f8d", type: "direct", streamUrl: "https://m-aac.cbs.co.kr/mweb_cbs939/_definst_/cbs939.stream/playlist.m3u8" },
        { id: "sbslove", name: "SBS 러브FM", desc: "103.5MHz", group: "sbs", color: "#5e667d", type: "sbs-api", apiUrl: "https://apis.sbs.co.kr/play-api/1.0/livestream/lovepc/lovefm?protocol=hls&ssl=Y" },
        { id: "sbspower", name: "SBS 파워FM", desc: "107.7MHz", group: "sbs", color: "#6e7b98", type: "sbs-api", apiUrl: "https://apis.sbs.co.kr/play-api/1.0/livestream/powerpc/powerfm?protocol=hls&ssl=Y" },
        { id: "ebsfm", name: "EBS FM", desc: "104.5MHz", group: "etc", color: "#65735d", type: "direct", streamUrl: "https://ebsonair.ebs.co.kr/fmradiofamilypc/familypc1m/playlist.m3u8" },
        { id: "ytn", name: "YTN 라디오", desc: "94.5MHz", group: "etc", color: "#9b6e34", type: "direct", streamUrl: "https://radiolive.ytn.co.kr/radio/_definst_/20211118_fmlive/playlist.m3u8" },
        { id: "gugak", name: "국악방송", desc: "99.1MHz", group: "etc", color: "#7d5b78", type: "direct", streamUrl: "https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/playlist.m3u8" },
        { id: "febc", name: "극동방송", desc: "FEBC Seoul", group: "etc", color: "#8b5d3f", type: "direct", streamUrl: "https://mlive3.febc.net/live5/mplive/playlist.m3u8" }
    ];

    const groupLabels = { kbs: "KBS", mbc: "MBC", cbs: "CBS", sbs: "SBS", etc: "기타" };

    async function getStreamUrl(station) {
        if (station.type === "direct") {
            return station.streamUrl;
        }

        const response = await fetch(station.apiUrl);

        if (station.type === "kbs-api") {
            const data = await response.json();
            if (data.channel_item && data.channel_item.length > 0) {
                return data.channel_item[0].service_url;
            }
            throw new Error("KBS 스트림 URL을 가져올 수 없습니다");
        }

        if (station.type === "sbs-api" || station.type === "mbc-api") {
            const url = (await response.text()).trim();
            if (url.startsWith("http")) {
                return url;
            }
            throw new Error("스트림 URL을 가져올 수 없습니다");
        }

        throw new Error("알 수 없는 스트림 타입");
    }

    window.FMRadio = { stations, groupLabels, getStreamUrl };
})();
