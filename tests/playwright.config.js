// FM 라디오 테스트 설정 — 저장소 루트를 정적 서빙하고 크로미움 전체 + WebKit 핵심 흐름을 검증한다.
// WebKit 프로젝트를 두는 이유: 이 앱의 주 사용 환경이 Safari 계열(iPhone PWA·WKWebView)인데,
// 크로미움에서만 통과하고 Safari에서 조용히 죽는 회귀(예: SAFARI_LIKE 그래프 가드)가 실제로 있었다.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: __dirname,
    testMatch: "**/*.spec.js",
    timeout: 60000,
    retries: 1,
    reporter: [["list"]],
    use: {
        baseURL: "http://127.0.0.1:8123/",
        // CI에서만 재현되는 플레이키 추적용 — 재시도에서 트레이스를 남겨
        // 워크플로가 아티팩트로 올린다 (평상시 실행 비용은 없음).
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
                launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
            },
        },
        {
            // Safari 경로 회귀 방지 — 예약·테이프와 Mac 전체 화면/DRAGON 기하를 WebKit으로 한 번 더
            name: "webkit",
            use: { browserName: "webkit" },
            grep: /예약 녹음|예약 발화|테이프 보관함|테이프 가져오기|몰입 모드|DRAGON 릴 정렬|스코프된 하드웨어 필터|실물 정체성|프런트패널 소생|음반 장르/,
        },
    ],
    webServer: {
        command: "npx http-server .. -p 8123 -s -c-1",
        url: "http://127.0.0.1:8123/index.html",
        reuseExistingServer: true,
    },
});
