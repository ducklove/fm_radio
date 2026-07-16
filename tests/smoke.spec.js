// FM 라디오 스모크 테스트
// 재생은 모의 HLS(MP3/TS)로 검증한다 — 실제 방송 스트림 연결은 환경(지역·정책)에
// 좌우되므로 테스트하지 않는다. 파이프라인(선국→URL 해석→hls.js→<audio>)이 대상이다.
const { test, expect } = require("@playwright/test");
const { mockExternal, collectErrors } = require("./fixtures");

// 포노 트랙(위키미디어) 대역 — 재생이 지속되어야 하는 테스트용 합성 WAV (220Hz 사인)
function makeWav(seconds) {
    const rate = 8000, n = rate * seconds;
    const buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 220) * 8000), 44 + i * 2);
    return buf;
}

async function waitForMainApp(page) {
    await page.waitForFunction(() => typeof window.Hls !== "undefined");
    await page.waitForFunction(() => Array.isArray(window.MFA_RECORDS));
    await page.evaluate(() => window.MFA_READY);
    await page.waitForSelector("#tsKnobHit");
}

test.describe("데스크톱", () => {
    test.use({ viewport: { width: 1440, height: 2200 } });

    let errors;
    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        errors = collectErrors(page);
        await page.goto("/");
        await waitForMainApp(page);
    });

    test.afterEach(() => {
        expect(errors, "콘솔 오류·페이지 예외 없음").toEqual([]);
    });

    test("초기 렌더링: 기본 랙 4기기·숨김 EQ·가로 오버플로 없음", async ({ page }) => {
        await expect(page).toHaveTitle(/Mad for Audio/);
        for (const id of ["tunerStage", "ampStage", "deckStage", "ttStage"]) {
            await expect(page.locator(`#${id} svg`)).toBeVisible();
        }
        await expect(page.locator("#eqStage svg")).toHaveCount(1);
        await expect(page.locator("#eqStage")).toBeHidden();
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);
    });

    test("음반 카탈로그 JSON 로드·기본 형식 검증", async ({ page }) => {
        const catalog = await page.evaluate(() => ({
            count: window.MFA_RECORDS.length,
            valid: window.MFA_RECORDS.every((record) =>
                record.title && record.composer && record.performer && record.credit &&
                Array.isArray(record.tracks) && record.tracks.length > 0 &&
                record.tracks.every((track) => track.t && track.f)),
        }));
        expect(catalog.count).toBeGreaterThanOrEqual(58);
        expect(catalog.valid).toBe(true);
    });

    test("RF 스위치로 채널 목록 열기 → 전 채널 렌더링", async ({ page }) => {
        await page.click("#tsRfHit");
        await expect(page.locator("#stationMain")).not.toHaveClass(/collapsed/);
        const count = await page.locator(".station").count();
        const expected = await page.evaluate(() => window.FMRadio.stations.length);
        expect(count).toBe(expected);
    });

    test("최초 방문: 재생 버튼 한 번으로 기본 채널 연결", async ({ page }) => {
        // beforeEach가 새 컨텍스트(빈 저장소)로 로드 — 선국 이력이 없는 첫 방문 상태
        expect(await page.evaluate(() => currentStation), "선국 전").toBe(null);
        // 데스크톱 랙 모드는 플레이어바를 숨긴다(기기로 조작) — 바가 보이는
        // 간편 플레이어/트레이 화면 기준으로 첫 재생을 검증한다
        await page.evaluate(() => { viewMode = "simple"; applyViewMode(); applyUnitVisibility(); });
        await page.click("#btnPlay");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return currentStation && !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
        // 재생/정지 상태 표기가 실제와 일치해야 한다
        expect(await page.evaluate(() => isPlaying)).toBe(true);
        expect(await page.evaluate(() => document.getElementById("playIcon").getAttribute("d"))).toContain("M6 19h4V5H6v14z");
    });

    test("선국 → 모의 스트림 실제 재생", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await expect(page.locator("#nowStation")).toHaveText("KBS 1FM");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });

    test("빠른 채널 전환에도 예외 없이 생존", async ({ page }) => {
        await page.click("#tsRfHit");
        const cards = page.locator("#stationMain .station");
        const n = Math.min(await cards.count(), 6);
        for (let i = 0; i < n; i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(120);
        }
        // KBS 채널로 복귀 → 재생 확인
        await cards.first().click();
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });

    test("튜너 전원 스위치 = 정지/재생 토글", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => !document.getElementById("audioPlayer").paused, null, { timeout: 15000 });

        await page.click("#tsPowerHit");
        await page.waitForFunction(() => document.getElementById("audioPlayer").paused);

        await page.click("#tsPowerHit");
        await page.waitForFunction(() => !document.getElementById("audioPlayer").paused, null, { timeout: 15000 });
    });

    test("설정 모달: 열기 → ESC로 닫기", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await expect(page.locator("#settingsOverlay")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("#settingsOverlay")).toBeHidden();
    });

    test("추가 하이파이 18종: 피커 등록·기기군별 스킨 전환", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await expect(page.locator("#skinPicker .skin-btn")).toHaveCount(9);
        await expect(page.locator("#ampPicker .skin-btn")).toHaveCount(11);
        await expect(page.locator("#deckPicker .skin-btn")).toHaveCount(6);
        await expect(page.locator("#ttPicker .skin-btn")).toHaveCount(6);
        await expect(page.locator("#eqPicker .skin-btn")).toHaveCount(5);

        await page.locator('#skinPicker .skin-btn', { hasText: "REVOX B760" }).click();
        await expect(page.locator('#tunerStage svg[aria-label*="REVOX B760"]')).toHaveCount(1);
        await page.locator('#ampPicker .skin-btn', { hasText: "TR · CA-100" }).click();
        await expect(page.locator("#ca100RedL")).toHaveAttribute("d", "M 329 306 A 122 122 0 0 1 368 342");
        await expect(page.locator("#ca100RedR")).toHaveAttribute("d", "M 701 306 A 122 122 0 0 1 740 342");
        await page.locator('#ampPicker .skin-btn', { hasText: "CLASS A · L-550" }).click();
        await expect(page.locator('#ampStage svg[aria-label*="LUXMAN L-550"]')).toHaveCount(1);
        await page.locator('#ampPicker .skin-btn', { hasText: "KT88 · MA2375" }).click();
        await expect(page.locator('#ampStage svg[aria-label*="McIntosh MA2375"]')).toHaveCount(1);
        await expect(page.locator("#ampStage")).not.toHaveClass(/amp-stage-tall/);
        expect(await page.locator("#ampStage svg").getAttribute("viewBox")).toBe("0 0 2000 1080");
        await expect(page.locator("#ampStage .ma2375-cylinder-knob")).toHaveCount(7);
        await expect(page.locator("#ampStage .ma2375-lower-chassis")).toHaveAttribute("x", "80");
        await expect(page.locator("#ampStage .ma2375-lower-chassis")).toHaveAttribute("width", "1840");
        await expect(page.locator("#ampStage .ma2375-meter-arc")).toHaveCount(2);
        await expect(page.locator("#ampStage .ma2375-meter-arc").first()).toHaveAttribute("d", "M301 288 A150 50 0 0 1 583 288");
        await expect(page.locator("#ampVuL")).toHaveAttribute("y2", "248");
        await expect(page.locator("#ampStage .ma2375-meter-light")).toHaveCount(2);
        await expect(page.locator("#ampStage .meterDark")).toHaveCount(2);
        await expect(page.locator("#ampStage .ma2375-lettering")).toHaveCount(1);
        await expect(page.locator("#ampStage .ma2375-display-readout")).toHaveCount(1);
        await expect(page.locator("#ma2375SourceText")).toHaveText("Tuner");
        await expect(page.locator("#ma2375VolumeText")).toHaveText("100%");
        expect(await page.locator("#ampStage").evaluate((stage) =>
            [...stage.querySelectorAll("rect")].filter((el) => el.getAttribute("y") === "458" && el.getAttribute("width") === "13").length)).toBe(0);
        const knobDimensions = await page.locator("#ampStage .ma2375-cylinder-knob").first().evaluate((el) => ({
            body: Number(el.dataset.bodyRx),
            face: Number(el.dataset.faceRx),
        }));
        expect(knobDimensions.body).toBeGreaterThan(knobDimensions.face);
        await expect(page.locator("#ma2375Volume #ampVolMark")).toHaveCount(1);
        const maVolume = page.locator('#ampStage [role="slider"][aria-label="볼륨"]');
        await expect(maVolume).toHaveAttribute("cx", "1753.2");
        await expect(maVolume).toHaveAttribute("cy", "742.44");
        await expect(page.locator("#ampVolMark")).toHaveAttribute("transform", /1753\.2 742\.44/);
        await page.locator('#deckPicker .skin-btn', { hasText: "PIONEER CT-F1250" }).click();
        await expect(page.locator('#deckStage svg[aria-label*="PIONEER CT-F1250"]')).toHaveCount(1);
        await expect(page.locator("#deckBtnPlay")).toHaveClass(/lz-hardware-button/);
        await expect(page.locator("#deckTransport .lz-hardware-side")).toHaveCount(6);
        await expect(page.locator("#deckTransport .lz-hardware-gloss")).toHaveCount(6);
        await expect(page.locator("#deckStage .lz-hardware-knob")).toHaveCount(4);
        await page.locator('#deckPicker .skin-btn', { hasText: "REVOX B215" }).click();
        await expect(page.locator('#deckStage svg[aria-label*="REVOX B215"]')).toHaveCount(1);
        await page.locator('#ttPicker .skin-btn', { hasText: "TECHNICS SL-1200MK2" }).click();
        await expect(page.locator('#ttStage svg[aria-label*="TECHNICS SL-1200MK2"]')).toHaveCount(1);
        await page.locator('#eqPicker .skin-btn', { hasText: "CHAMPAGNE · 10밴드" }).click();
        await expect(page.locator('#eqStage svg[aria-label*="GE-10C"]')).toHaveCount(1);
        await expect(page.locator('[id^="eqBandLvl"]')).toHaveCount(80);

        const saved = await page.evaluate(() => ({
            tuner: JSON.parse(localStorage.getItem("fmRadio.skin")),
            amp: JSON.parse(localStorage.getItem("fmRadio.amp")),
            deck: JSON.parse(localStorage.getItem("fmRadio.deck")),
            turntable: JSON.parse(localStorage.getItem("fmRadio.turntable")),
        }));
        expect(saved).toEqual({ tuner: "b760", amp: "ma2375", deck: "b215", turntable: "sl1200" });
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).model)).toBe("ge10chrome");
    });

    test("MA2375 미터·레터 백라이트: 전원 OFF는 흐리고 ON은 선명함", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await page.locator('#ampPicker .skin-btn', { hasText: "KT88 · MA2375" }).click();
        await page.locator('.settings-close').click();

        const lighting = () => page.evaluate(() => ({
            meter: Number(document.querySelector("#ampStage .ma2375-meter-light").style.opacity),
            lettering: Number(document.querySelector("#ampStage .ma2375-lettering").style.opacity),
            dark: Number(document.querySelector("#ampStage .meterDark").style.opacity),
        }));
        await page.waitForFunction(() => Number(document.querySelector("#ampStage .meterDark").style.opacity) > .5);
        const off = await lighting();
        expect(off.meter).toBeLessThan(.1);
        expect(off.lettering).toBeLessThan(.3);
        expect(off.dark).toBeGreaterThan(.5);

        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => {
            const audio = document.getElementById("audioPlayer");
            return !audio.paused && Number(document.querySelector("#ampStage .ma2375-meter-light").style.opacity) > .9;
        }, null, { timeout: 15000 });
        const on = await lighting();
        expect(on.meter).toBeGreaterThan(.9);
        expect(on.lettering).toBeGreaterThan(.9);
        expect(on.dark).toBeLessThan(.1);

        await page.click("#tsPowerHit");
        await page.waitForFunction(() => Number(document.querySelector("#ampStage .meterDark").style.opacity) > .45, null, { timeout: 7000 });
        const cooled = await lighting();
        expect(cooled.meter).toBeLessThan(.22);
        expect(cooled.lettering).toBeLessThan(.36);
        expect(cooled.dark).toBeGreaterThan(.45);
    });

    test("MA2375 표시창: 입력 소스와 볼륨 노브를 실시간 반영", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await page.locator('#ampPicker .skin-btn', { hasText: "KT88 · MA2375" }).click();
        await page.locator('.settings-close').click();

        await page.evaluate(() => setVolume(37));
        await expect(page.locator("#ma2375VolumeText")).toHaveText("37%");
        await expect(page.locator("#ma2375VolumeGlow")).toHaveText("37%");

        await page.evaluate(() => playPhonoTrack(0));
        await expect(page.locator("#ma2375SourceText")).toHaveText("Phone");
        await expect(page.locator("#ma2375SourceGlow")).toHaveText("Phone");

        await page.evaluate(() => deckPlay());
        await expect(page.locator("#ma2375SourceText")).toHaveText("CAS");
        await expect(page.locator("#ma2375SourceGlow")).toHaveText("CAS");
    });

    test("예약 녹음: 정지 중 발화 → 백그라운드 무음 녹음, 튜너·데크만 점등, 종료 후 카세트 보관", async ({ page }) => {
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            fireReservation(
                { id: 990, stationId: st.id, title: "타이머 테스트", repeat: "once", enabled: true },
                { ymd: "t", startTs: Date.now(), endTs: Date.now() + 12000 }, "990:t");
        });
        await page.waitForFunction(() => !!recorder && deckMode === "rec", null, { timeout: 15000 });
        // CI 헤드리스(특히 WebKit)는 rAF가 심하게 스로틀된다 — 조명 웜업·릴 회전은
        // 프레임 루프를 합성 타임스탬프로 직접 돌려 기계 속도와 무관하게 검증한다
        await page.evaluate(() => {
            // 과거→현재 창으로 펌프 — 미래 타임스탬프는 실제 rAF와 만나 음수 dt를 만든다
            const t0 = performance.now() - 4000;
            ttLastTs = t0;
            for (let i = 1; i <= 80; i++) ttFrame(t0 + i * 50);
        });
        const mid = await page.evaluate(() => ({
            mainPaused: document.getElementById("audioPlayer").paused,
            playing: isPlaying,
            bgOn: !!(bgRecAudio && !bgRecAudio.paused),
            ampWarm: +ampWarm.toFixed(2),
            tunerWarm: +tunerWarm.toFixed(2),
            reel1: document.getElementById("deckReelL").getAttribute("transform"),
            deckShown: !document.getElementById("deckStage").hidden
                && document.getElementById("deckStage").classList.contains("transport-live"),
        }));
        expect(mid.mainPaused, "본체 오디오는 건드리지 않는다").toBe(true);
        expect(mid.playing, "본체 재생 상태 없음").toBe(false);
        expect(mid.bgOn, "백그라운드 수신기 작동").toBe(true);
        expect(mid.ampWarm, "앰프 소등").toBeLessThan(0.05);
        expect(mid.tunerWarm, "튜너 점등").toBeGreaterThan(0.8);
        expect(mid.deckShown, "녹음 중 데크 노출").toBe(true);
        expect(await page.evaluate((r1) => {
            const t0 = performance.now() - 600;
            ttLastTs = t0;
            for (let i = 1; i <= 10; i++) ttFrame(t0 + i * 50);
            return document.getElementById("deckReelL").getAttribute("transform") !== r1;
        }, mid.reel1), "릴이 돌아간다").toBe(true);
        await page.waitForFunction(() => !recorder && !activeResRec && !isPlaying && deckMode === "stop", null, { timeout: 15000 });
        // 완료되면 프로그램명이 붙은 카세트가 되감긴 채 테이프 랙에 보관된다
        await page.waitForFunction(() =>
            [...document.querySelectorAll("#deckShelf g[data-id] text")].some((t) => t.textContent.includes("타이머 테스트")),
            null, { timeout: 10000 });
        const stored = await page.evaluate(() => {
            const t = tapes.find((x) => x.label.includes("타이머 테스트"));
            return t && { pos: t.pos, segs: t.segments.length, inserted: deckTape === t };
        });
        expect(stored.pos, "되감김").toBe(0);
        expect(stored.segs, "녹음 세그먼트 존재").toBeGreaterThan(0);
        expect(stored.inserted, "랙에 보관(데크에서 배출)").toBe(false);
        // 빈 껍데기·무음 파일 회귀 방지 — 녹음 파일에 실제 스트림 데이터가 담겨야 한다
        const blobSize = await page.evaluate(async () => {
            const t = tapes.find((x) => x.label.includes("타이머 테스트"));
            return fetch(t.segments[0].url).then((r) => r.blob()).then((b) => b.size);
        });
        expect(blobSize, "녹음 파일 실데이터(>20KB)").toBeGreaterThan(20000);
        expect(await page.evaluate(() => playerSubtext.textContent), "카세트 보관 안내").toContain("테이프 랙에 보관");
    });

    test("예약 발화 중에도 턴테이블 재생 유지 — 백그라운드 녹음 (프리징 회귀 방지)", async ({ context, page }) => {
        // 포노 트랙을 로컬 합성 WAV로 — 외부(위키미디어)는 모킹에서 차단되어 재생이 곧 죽는다
        await context.route("https://upload.wikimedia.org/**", (route) =>
            route.fulfill({ body: makeWav(40), contentType: "audio/wav", headers: { "Access-Control-Allow-Origin": "*" } }));
        await page.evaluate(() => playPhonoTrack(0));
        await page.waitForFunction(() => phonoActive && isPlaying, null, { timeout: 15000 });
        await page.evaluate(() => {
            window.__selCount = 0;
            const orig = selectStation;
            selectStation = function (...a) { window.__selCount++; return orig.apply(this, a); };
            const st = window.FMRadio.stations[0];
            fireReservation({ id: 991, stationId: st.id, title: "동시 녹음", repeat: "once", enabled: true },
                { ymd: "tk", startTs: Date.now(), endTs: Date.now() + 8000 }, "991:tk");
        });
        // 프리징(마이크로태스크 루프)이 재발하면 여기서 타임아웃으로 실패한다
        await page.waitForFunction(() => !!recorder && deckMode === "rec", null, { timeout: 15000 });
        const s = await page.evaluate(() => ({
            sel: window.__selCount,
            phono: phonoActive,
            playing: isPlaying,
            mainPaused: document.getElementById("audioPlayer").paused
        }));
        expect(s.sel, "본체 선국 없음 — 백그라운드 수신").toBe(0);
        expect(s.phono && s.playing, "턴테이블은 계속 재생").toBe(true);
        expect(s.mainPaused, "본체 오디오 재생 유지").toBe(false);
        await page.waitForFunction(() => !recorder && !activeResRec, null, { timeout: 15000 });
        expect(await page.evaluate(() => phonoActive && isPlaying), "종료 후에도 턴테이블 유지").toBe(true);
    });

    test("예약 녹음 중 데크 조작: 경고 후 재조작 시 녹음 중단", async ({ page }) => {
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            fireReservation({ id: 992, stationId: st.id, title: "가드 테스트", repeat: "once", enabled: true },
                { ymd: "tg", startTs: Date.now(), endTs: Date.now() + 30000 }, "992:tg");
        });
        await page.waitForFunction(() => !!recorder && deckMode === "rec", null, { timeout: 15000 });
        const first = await page.evaluate(() => { deckPlay(); return { rec: !!recorder, msg: playerSubtext.textContent }; });
        expect(first.rec, "1차 조작: 녹음 유지").toBe(true);
        expect(first.msg, "경고 문구").toContain("한 번 더");
        const second = await page.evaluate(() => { deckPlay(); return { rec: !!recorder, active: !!activeResRec, mode: deckMode }; });
        expect(second.rec, "2차 조작: 녹음 중단").toBe(false);
        expect(second.active, "예약 회차 종료").toBe(false);
        expect(second.mode, "요청한 조작(PLAY) 실행").toBe("play");
    });

    test("테이프 보관함: 라벨 개명 영속·트랙 점프 재생·삭제 연동", async ({ page }) => {
        // 짧은 예약 녹음으로 수록곡 있는 테이프를 만든다
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            fireReservation({ id: 989, stationId: st.id, title: "보관함 테스트", repeat: "once", enabled: true },
                { ymd: "tc", startTs: Date.now(), endTs: Date.now() + 6000 }, "989:tc");
        });
        await page.waitForFunction(() => !!recorder, null, { timeout: 15000 });
        await page.waitForFunction(() => !recorder && !activeResRec, null, { timeout: 20000 });
        await page.waitForFunction(() => tapes.some((t) => t.segments.length), null, { timeout: 10000 });
        await page.evaluate(() => openTapeCase());
        await expect(page.locator("#tapeCaseOverlay")).toBeVisible();
        // 라벨 개명(인라인 입력 — prompt는 WKWebView에서 무시된다) → localStorage 메타 영속
        await page.locator(".tapecase-item", { hasText: "보관함 테스트" }).locator("button", { hasText: "라벨" }).click();
        const labelInput = page.locator(".tapecase-label-input");
        await expect(labelInput).toBeVisible();
        await labelInput.fill("명반 모음");
        await labelInput.press("Enter");
        await expect(page.locator(".tapecase-label", { hasText: "명반 모음" })).toHaveCount(1);
        expect(await page.evaluate(() =>
            Object.values(JSON.parse(localStorage.getItem("fmRadio.tapeMeta"))).some((m) => m.label === "명반 모음" && m.named)),
            "개명 라벨이 메타에 영속").toBe(true);
        // J-카드 트랙 점프 재생 — 케이스가 닫히고 그 위치부터 재생된다
        await page.locator(".tapecase-item", { hasText: "명반 모음" }).locator(".tapecase-track").first().click();
        await page.waitForFunction(() => deckMode === "play", null, { timeout: 8000 });
        await expect(page.locator("#tapeCaseOverlay")).toBeHidden();
        await page.evaluate(() => deckStopTransport());
        // 삭제(2단계 확인 — confirm은 WKWebView에서 무시된다) → 테이프·녹음 파일 목록 함께 정리
        await page.evaluate(() => openTapeCase());
        const delBtn = page.locator(".tapecase-item", { hasText: "명반 모음" }).locator("button", { hasText: "삭제" });
        await delBtn.click();
        await expect(delBtn, "1차: 확인 대기").toHaveText("정말 삭제?");
        expect(await page.evaluate(() => tapes.some((t) => t.label === "명반 모음")), "1차에는 안 지워짐").toBe(true);
        await delBtn.click();
        expect(await page.evaluate(() => tapes.some((t) => t.label === "명반 모음")), "테이프 제거").toBe(false);
        expect(await page.evaluate(() => document.querySelectorAll("#recordingList .recording").length), "녹음 목록 정리").toBe(0);
    });

    test("테이프 가져오기/내보내기: mp3급 파일 → 믹스테이프, 원본 형식 다운로드", async ({ page }) => {
        await page.evaluate(() => openTapeCase());
        await page.setInputFiles("#tapeImportInput", [
            { name: "월광 소나타.wav", mimeType: "audio/wav", buffer: makeWav(12) },
            { name: "녹턴 2번.wav", mimeType: "audio/wav", buffer: makeWav(8) },
        ]);
        // 두 파일이 한 테이프에 순서대로 (트랙 사이 2초 리더)
        await page.waitForFunction(() => tapes.some((t) => t.segments.length === 2), null, { timeout: 15000 });
        const t = await page.evaluate(() => {
            const x = tapes.find((v) => v.segments.length === 2);
            return { label: x.label, size: tapeSizeName(tapeLenOf(x)), starts: x.segments.map((s) => Math.round(s.start)) };
        });
        expect(t.label, "믹스테이프 라벨").toContain("월광 소나타 외 1곡");
        expect(t.size).toBe("C-30");
        expect(t.starts, "트랙 배치").toEqual([0, 14]);
        // J-카드에서 두 번째 트랙 점프 재생
        await page.locator(".tapecase-item", { hasText: "월광 소나타" }).locator(".tapecase-track").nth(1).click();
        await page.waitForFunction(() => deckMode === "play" && Math.round(tapePos) >= 14, null, { timeout: 10000 });
        await page.evaluate(() => deckStopTransport());
        // 리로드 후에도 남는다 (IndexedDB)
        await page.reload();
        await page.waitForFunction(() => typeof openTapeCase === "function" && tapes.some((v) => v.segments.length === 2), null, { timeout: 10000 });
        // 내보내기: 원본 형식 그대로 트랙별 다운로드
        await page.evaluate(() => openTapeCase());
        const downloads = [];
        page.on("download", (d) => downloads.push(d.suggestedFilename()));
        await page.locator(".tapecase-item", { hasText: "월광 소나타" }).locator("button", { hasText: "내보내기" }).click();
        await page.waitForTimeout(1400);
        expect(downloads.length, "트랙 수만큼 다운로드").toBe(2);
        expect(downloads[0]).toMatch(/\.wav$/);
    });

    test("취소 이력 뒤 같은 프로그램 재예약 → 즉시 재발화 (ID 무덤돌 회귀 방지)", async ({ page }) => {
        const mkParams = () => ({ stationId: window.FMRadio.stations[0].id, title: "무덤돌 테스트",
            startMin: new Date().getHours() * 60 + new Date().getMinutes() - 5,
            endMin: new Date().getHours() * 60 + new Date().getMinutes() + 60,
            repeat: "once", ymd: FMSchedule.ymdOf(new Date()) });
        // 1차 발화 → 사용자가 중단(취소 기록 2) → 예약 삭제
        const firstId = await page.evaluate((fn) => addReservation(eval(fn)()).id, "(" + mkParams.toString() + ")");
        await page.waitForFunction(() => activeResRec && activeResRec.res.title === "무덤돌 테스트", null, { timeout: 15000 });
        await page.evaluate((id) => { cancelReservedRecording("테스트 중단"); removeReservation(id); }, firstId);
        expect(await page.evaluate(() => !!activeResRec)).toBe(false);
        // 2차: 같은 프로그램을 다시 예약 — 과거 기록에 막히지 않고 다시 발화해야 한다
        const secondId = await page.evaluate((fn) => addReservation(eval(fn)()).id, "(" + mkParams.toString() + ")");
        expect(secondId, "ID 재사용 금지").not.toBe(firstId);
        await page.waitForFunction(() => activeResRec && activeResRec.res.title === "무덤돌 테스트", null, { timeout: 15000 });
        await page.waitForFunction(() => !!recorder && activeResRec.started, null, { timeout: 20000 });
        // 정리
        await page.evaluate(() => { deckStopTransport(); deckStopTransport(); });
        await page.waitForFunction(() => !recorder && !activeResRec, null, { timeout: 10000 });
    });

    test("설명서에 신규 기기별 소개와 음색·동작 차이가 기록됨", async ({ page }) => {
        await page.goto("/manual.html");
        for (const name of ["TX-9500 II", "T-110", "T-100", "B760", "SA-9900", "AU-111", "L-550", "E-303", "MA2375", "B215", "TCD 3014A", "TC-KA7ES", "CT-F1250", "SL-1200MK2", "TD 124", "GARRARD", "Sondek LP12", "GE-10S / GE-10C"]) {
            await expect(page.locator("body")).toContainText(name);
        }
    });

    test("진공관 DSP: 싱글엔디드 배음·푸시풀 대칭·새그·댐핑이 모델별로 다름", async ({ page }) => {
        const dsp = await page.evaluate(() => {
            const api = window.MFA_AmpDSP;
            const harmonics = (id, fullChain = false, amplitude = .98) => {
                const size = 1024;
                const wave = Array.from({ length: size }, (_, i) =>
                    fullChain
                        ? api.sampleChain(id, amplitude * Math.sin(2 * Math.PI * i / size))
                        : api.sample(id, "power", amplitude * Math.sin(2 * Math.PI * i / size)));
                const magnitude = (harmonic) => {
                    let re = 0;
                    let im = 0;
                    for (let i = 0; i < size; i++) {
                        const phase = 2 * Math.PI * harmonic * i / size;
                        re += wave[i] * Math.cos(phase);
                        im -= wave[i] * Math.sin(phase);
                    }
                    return Math.hypot(re, im);
                };
                const fundamental = magnitude(1);
                const h2 = magnitude(2) / fundamental;
                const h3 = magnitude(3) / fundamental;
                const h5 = magnitude(5) / fundamental;
                return { h2, h3, h5, thd: Math.hypot(h2, h3, h5) };
            };
            const p300 = api.sample("300b", "power", .5);
            const n300 = api.sample("300b", "power", -.5);
            const pkt = api.sample("kt88", "power", .5);
            const nkt = api.sample("kt88", "power", -.5);
            const nominalRms = (id) => {
                const size = 1024;
                const out = AMP_MODELS[id].out;
                const energy = Array.from({ length: size }, (_, i) => {
                    const y = api.sampleChain(id, .65 * Math.sin(2 * Math.PI * i / size)) * out;
                    return y * y;
                }).reduce((sum, value) => sum + value, 0);
                return Math.sqrt(energy / size);
            };
            return {
                asym300b: Math.abs(p300 + n300),
                asymKt88: Math.abs(pkt + nkt),
                softSlopeHigh: api.sample("300b", "power", .95) - api.sample("300b", "power", .85),
                softSlopeLow: api.sample("300b", "power", .25) - api.sample("300b", "power", .15),
                softSlopeNegativeHigh: api.sample("300b", "power", -.85) - api.sample("300b", "power", -.95),
                softSlopeNegativeLow: api.sample("300b", "power", -.15) - api.sample("300b", "power", -.25),
                centerSlope: api.sample("300b", "power", .4) - api.sample("300b", "power", .3),
                p300: api.inspect("300b"),
                el34: api.inspect("el34"),
                kt88: api.inspect("kt88"),
                au111: api.inspect("au111"),
                ma2375: api.inspect("ma2375"),
                h300b: harmonics("300b"),
                hEl34: harmonics("el34"),
                hKt88: harmonics("kt88"),
                hAu111: harmonics("au111"),
                nominal300b: harmonics("300b", true, .65),
                nominalEl34: harmonics("el34", true, .65),
                nominalKt88: harmonics("kt88", true, .65),
                nominalAu111: harmonics("au111", true, .65),
                nominalMa2375: harmonics("ma2375", true, .65),
                peak300b: harmonics("300b", true),
                peakEl34: harmonics("el34", true),
                peakKt88: harmonics("kt88", true),
                peakAu111: harmonics("au111", true),
                peakMa2375: harmonics("ma2375", true),
                nominalRms: ["300b", "el34", "au111", "kt88", "ma2375"].map(nominalRms),
            };
        });
        expect(dsp.asym300b).toBeGreaterThan(0.015);
        expect(dsp.asymKt88).toBeLessThan(0.01);
        expect(dsp.h300b.h2).toBeGreaterThan(dsp.h300b.h3);
        expect(dsp.hKt88.h3).toBeGreaterThan(dsp.hKt88.h2 * 5);
        expect(dsp.hEl34.h3).toBeGreaterThan(dsp.hEl34.h2);
        expect(dsp.hAu111.h3).toBeGreaterThan(dsp.hAu111.h2);
        expect(dsp.hKt88.thd).toBeLessThan(dsp.hEl34.thd);
        expect(dsp.hKt88.thd).toBeLessThan(.02);
        expect(dsp.nominal300b.h2).toBeGreaterThan(dsp.nominal300b.h3);
        expect(dsp.nominal300b.thd).toBeGreaterThan(.012);
        expect(dsp.nominalAu111.h3).toBeGreaterThan(dsp.nominalEl34.h3);
        expect(dsp.nominalEl34.thd).toBeGreaterThan(dsp.nominalKt88.thd * 2);
        expect(dsp.nominalKt88.thd).toBeGreaterThan(dsp.nominalMa2375.thd * 1.5);
        expect(dsp.peak300b.thd).toBeLessThan(.05);
        expect(dsp.peakEl34.thd).toBeLessThan(.06);
        expect(dsp.peakKt88.thd).toBeLessThan(.025);
        expect(dsp.peakAu111.thd).toBeLessThan(.06);
        expect(dsp.peakMa2375.thd).toBeLessThan(.005);
        expect(Math.max(...dsp.nominalRms) - Math.min(...dsp.nominalRms)).toBeLessThan(.035);
        expect(dsp.centerSlope).toBeGreaterThan(.09);
        expect(dsp.centerSlope).toBeLessThan(.11);
        expect(dsp.softSlopeHigh).toBeLessThan(dsp.softSlopeLow);
        expect(dsp.softSlopeNegativeHigh).toBeLessThan(dsp.softSlopeNegativeLow);
        expect(dsp.p300.dampingFactor).toBeLessThan(dsp.el34.dampingFactor);
        expect(dsp.el34.dampingFactor).toBeLessThan(dsp.kt88.dampingFactor);
        expect(dsp.au111.sagRatio).toBeGreaterThan(dsp.el34.sagRatio);
        expect(dsp.p300.sagRatio).toBeLessThan(dsp.kt88.sagRatio);
        expect(dsp.p300.transformerBand[1]).toBeLessThan(dsp.kt88.transformerBand[1]);
        expect(dsp.ma2375.dampingFactor).toBeGreaterThan(dsp.kt88.dampingFactor);
        expect(dsp.ma2375.sagRatio).toBeLessThan(dsp.kt88.sagRatio);
        expect(dsp.ma2375.transformerBand[1]).toBeGreaterThan(dsp.kt88.transformerBand[1]);
        expect(dsp.p300.speakerMemory.feedback).toBeGreaterThan(dsp.au111.speakerMemory.feedback);
        expect(dsp.au111.speakerMemory.feedback).toBeGreaterThan(dsp.el34.speakerMemory.feedback);
        expect(dsp.el34.speakerMemory.feedback).toBeGreaterThan(dsp.kt88.speakerMemory.feedback);
        expect(dsp.kt88.speakerMemory.feedback).toBeGreaterThan(dsp.ma2375.speakerMemory.feedback);
        expect(dsp.p300.speakerMemory.wet).toBeGreaterThan(.12);
        expect(dsp.ma2375.speakerMemory.wet).toBeLessThan(.02);
    });

    test("재생 중 진공관 5종 전환: Web Audio 회로 재설정 후에도 재생 유지", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => {
            const audio = document.getElementById("audioPlayer");
            return !audio.paused && audio.currentTime > 0.5;
        }, null, { timeout: 15000 });

        await page.click('button:has-text("오디오 구성")');
        for (const label of ["EL34 · 8B", "300B · 91E", "KT88 · 275", "6L6GC · AU-111", "KT88 · MA2375"]) {
            await page.locator("#ampPicker .skin-btn", { hasText: label }).click();
            await page.waitForTimeout(100);
            await expect(page.locator("#audioPlayer")).toHaveJSProperty("paused", false);
        }

        await page.evaluate(() => setVolume(20));
        await page.waitForTimeout(100);
        const quietRuntime = await page.evaluate(() => window.MFA_AmpDSP.runtime());
        expect(quietRuntime.graphReady).toBe(true);
        expect(quietRuntime.masterGain).toBeCloseTo(.2, 2);
        expect(quietRuntime.inputTrim).toBeCloseTo(1, 2);
        expect(quietRuntime.speakerWet).toBeLessThan(.02);

        await page.locator("#ampPicker .skin-btn", { hasText: "300B · 91E" }).click();
        await page.waitForTimeout(100);
        const looseRuntime = await page.evaluate(() => window.MFA_AmpDSP.runtime());
        expect(looseRuntime.masterGain).toBeCloseTo(.2, 2);
        expect(looseRuntime.inputTrim).toBeCloseTo(1, 2);
        expect(looseRuntime.speakerWet).toBeGreaterThan(.12);
        expect(looseRuntime.speakerFeedback).toBeGreaterThan(.5);
    });
});

test.describe("모바일 390px", () => {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
    });

    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await waitForMainApp(page);
    });

    test("가로 오버플로 없음 + 선국·재생", async ({ page }) => {
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);

        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("초소형 320px", () => {
    test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

    test("가로 오버플로 없음", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBe(0);
    });
});

test.describe("iOS 폴백 (MSE 없음 + 네이티브 HLS)", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("audio.src에 m3u8 직접 할당", async ({ context, page }) => {
        await context.addInitScript(() => {
            delete window.MediaSource;
            const orig = HTMLMediaElement.prototype.canPlayType;
            HTMLMediaElement.prototype.canPlayType = function (t) {
                if (t && t.includes("mpegurl")) return "maybe";
                return orig.call(this, t);
            };
        });
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() =>
            document.getElementById("audioPlayer").src.includes("playlist.m3u8"));
    });
});

test.describe("키보드 조작", () => {
    test.use({ viewport: { width: 1440, height: 1200 } });

    test.beforeEach(async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await waitForMainApp(page);
    });

    test("튜너 RF 스위치: 포커스 + Enter로 채널 목록 토글", async ({ page }) => {
        await page.evaluate(() => document.getElementById("tsRfHit").focus());
        await page.keyboard.press("Enter");
        await expect(page.locator("#stationMain")).not.toHaveClass(/collapsed/);
        await page.keyboard.press("Enter");
        await expect(page.locator("#stationMain")).toHaveClass(/collapsed/);
    });

    test("튜닝 노브: 화살표 키로 선국", async ({ page }) => {
        await page.evaluate(() => document.getElementById("tsKnobHit").focus());
        await page.keyboard.press("ArrowRight");
        await expect(page.locator("#nowStation")).not.toHaveText("방송을 선택하세요");
    });

    test("EQ 슬라이더: 화살표 키로 게인 조절 + 저장", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await page.click('button:has-text("GE-10 · 10밴드")');
        await page.keyboard.press("Escape");
        await page.evaluate(() => document.getElementById("eqHit0").focus());
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        const gain = await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).gains.ge10[0]);
        expect(gain).toBe(2);
        const valueNow = await page.getAttribute("#eqHit0", "aria-valuenow");
        expect(valueNow).toBe("2");
    });
});

test.describe("모바일 컨트롤 바", () => {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });

    test("이전/다음 채널 버튼으로 선국", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");

        await expect(page.locator(".player-bar")).toBeVisible();
        await page.locator('button[aria-label="다음 채널"]').click();
        await expect(page.locator("#nowStation")).toHaveText("KBS 1FM");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("채널 검색", () => {
    test.use({ viewport: { width: 1440, height: 1600 } });

    test("검색어로 카드·그룹 필터링", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForFunction(() => typeof window.Hls !== "undefined");
        await page.click("#tsRfHit");

        // offsetParent 기준 = 실제 렌더링 가시성 (hidden 속성이 CSS에 지는 회귀를 잡는다)
        await page.fill("#stationSearch", "클래식");
        const visible = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .station")].filter((el) => el.offsetParent !== null).length);
        expect(visible).toBe(1);
        const visibleGroups = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .group")].filter((el) => el.offsetParent !== null).length);
        expect(visibleGroups).toBe(1);

        await page.fill("#stationSearch", "");
        const restored = await page.evaluate(() =>
            [...document.querySelectorAll("#groupsMount .station")].filter((el) => el.offsetParent !== null).length);
        const total = await page.evaluate(() => window.FMRadio.stations.length);
        expect(restored).toBe(total);
    });
});

test.describe("미니 플레이어 (widget.html)", () => {
    test("PlayerCore로 선국·재생", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/widget.html?station=kbs1fm");
        await page.waitForFunction(() => typeof window.Hls !== "undefined" && typeof window.PlayerCore !== "undefined");
        await page.click("#btnPlay");
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !a.paused && a.currentTime > 0.5;
        }, null, { timeout: 15000 });
    });
});

test.describe("접근성", () => {
    test("axe-core: 심각/치명 위반 없음", async ({ context, page }) => {
        await mockExternal(context);
        await page.goto("/");
        await page.waitForTimeout(800);
        await page.evaluate(() => document.getElementById("stationMain").classList.remove("collapsed"));
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
            const res = await axe.run(document, { resultTypes: ["violations"] });
            return res.violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                count: v.nodes.length,
                targets: v.nodes.map((node) => node.target.join(" ")),
            }));
        });
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious, JSON.stringify(violations)).toEqual([]);
    });
});
