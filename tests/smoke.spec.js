// FM 라디오 스모크 테스트
// 재생은 모의 HLS(MP3/TS)로 검증한다 — 실제 방송 스트림 연결은 환경(지역·정책)에
// 좌우되므로 테스트하지 않는다. 파이프라인(선국→URL 해석→hls.js→<audio>)이 대상이다.
const { test, expect } = require("@playwright/test");
const { mockExternal, collectErrors, MOCK_AUDIO_URL } = require("./fixtures");

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

    test("초기 렌더링: 기본 랙 5기기·숨김 EQ·가로 오버플로 없음", async ({ page }) => {
        await expect(page).toHaveTitle(/Mad for Audio/);
        for (const id of ["tunerStage", "timerStage", "ampStage", "deckStage", "ttStage"]) {
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

    test("실물 정체성 선별 19종: 피커 등록·기기군별 스킨 전환", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await expect(page.locator("#skinPicker .skin-btn")).toHaveCount(4);
        await expect(page.locator("#ampPicker .skin-btn")).toHaveCount(6);
        await expect(page.locator("#deckPicker .skin-btn")).toHaveCount(6);
        await expect(page.locator("#ttPicker .skin-btn")).toHaveCount(5);
        await expect(page.locator("#eqPicker .skin-btn")).toHaveCount(3);

        await page.locator('#skinPicker .skin-btn', { hasText: "Marantz 10B" }).click();
        await expect(page.locator('#tunerStage svg[aria-label*="Marantz Model 10B"]')).toHaveCount(1);
        await expect(page.locator("#tsFreq")).toHaveCount(0);
        await page.locator('#ampPicker .skin-btn', { hasText: "E-303 TRIBUTE" }).click();
        await expect(page.locator('#ampStage svg[aria-label*="ACCUPHASE E-303"]')).toHaveCount(1);
        await expect(page.locator("#ampStage svg")).toHaveAttribute("viewBox", "0 0 2000 720");
        await expect(page.locator("#ampStage .e303-cylinder-knob")).toHaveCount(4);
        await expect(page.locator("#ampStage .e303-meter")).toHaveCount(2);
        await expect(page.locator("#ampStage .e303-button")).toHaveCount(25);
        expect(await page.locator("#ampStage .e303-button").evaluateAll((buttons) =>
            Math.max(...buttons.map((button) => Number(button.querySelectorAll("rect")[1].getAttribute("width")))))).toBeLessThanOrEqual(36);
        await expect(page.locator("#e303BalanceCap rect")).toHaveAttribute("width", "8");
        await expect(page.locator("#e303BalanceCap")).toHaveCount(1);
        await expect(page.locator('#ampStage [role="slider"][aria-label="BALANCE"]')).toHaveCount(1);
        expect(await page.locator("#ampStage svg").evaluate((svg) =>
            [...svg.children].filter((el) => el.tagName === "line" && ["740", "1060"].includes(el.getAttribute("x1"))).length)).toBe(0);
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
        await page.locator('#eqPicker .skin-btn', { hasText: "YAMAHA GE-5" }).click();
        await expect(page.locator('#eqStage svg[aria-label*="YAMAHA GE-5"]')).toHaveCount(1);
        await page.locator('#eqPicker .skin-btn', { hasText: "SANSUI SE-9" }).click();
        await expect(page.locator('#eqStage svg[aria-label*="SANSUI SE-9"]')).toHaveCount(1);
        await expect(page.locator('[id^="eqBandLvl"]')).toHaveCount(64);
        await expect(page.locator('#eqStage text', { hasText: /^L$/ })).toHaveCount(8);
        await expect(page.locator('#eqStage text', { hasText: /^R$/ })).toHaveCount(8);

        const saved = await page.evaluate(() => ({
            tuner: JSON.parse(localStorage.getItem("fmRadio.skin")),
            amp: JSON.parse(localStorage.getItem("fmRadio.amp")),
            deck: JSON.parse(localStorage.getItem("fmRadio.deck")),
            turntable: JSON.parse(localStorage.getItem("fmRadio.turntable")),
        }));
        expect(saved).toEqual({ tuner: "m10b", amp: "ma2375", deck: "b215", turntable: "sl1200" });
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).model)).toBe("se9");
    });

    test("실기 기반 EQ 2종: 스펙트럼 명판이 우상단 게인 값과 겹치지 않음", async ({ page }) => {
        for (const modelId of ["ge5", "se9"]) {
            const layout = await page.evaluate((id) => {
                if (!unitShow.eq) setUnitShow("eq", true);
                setEqModel(id);
                const svg = document.querySelector("#eqStage svg");
                const box = (el) => {
                    const { x, y, width, height } = el.getBBox();
                    return { x, y, width, height };
                };
                const label = box([...svg.querySelectorAll("text")].find((el) => el.textContent === "REAL-TIME SPECTRUM"));
                const values = [EQ_FREQS.length - 2, EQ_FREQS.length - 1].map((index) => box(document.getElementById("eqV" + index)));
                return { label, values };
            }, modelId);
            const labelBottom = layout.label.y + layout.label.height;
            expect(labelBottom, modelId).toBeLessThan(Math.min(...layout.values.map((box) => box.y)));
        }
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
            return !audio.paused && Number(document.querySelector("#ampStage .ma2375-meter-light").style.opacity) > .42;
        }, null, { timeout: 15000 });
        const on = await lighting();
        expect(on.meter).toBeGreaterThan(.42);
        expect(on.lettering).toBeGreaterThan(.7);
        expect(on.dark).toBeLessThan(.1);

        await page.click("#tsPowerHit");
        // 공유 CI에서는 Chromium과 WebKit이 함께 합성 부하를 만들어 냉각 보간이 로컬보다 늦다.
        await page.waitForFunction(() => Number(document.querySelector("#ampStage .meterDark").style.opacity) > .45, null, { timeout: 12000 });
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
        await expect(page.locator("#ma2375SourceText")).toHaveText("Phono");
        await expect(page.locator("#ma2375SourceGlow")).toHaveText("Phono");

        await page.evaluate(() => deckPlay());
        await expect(page.locator("#ma2375SourceText")).toHaveText("Tape");
        await expect(page.locator("#ma2375SourceGlow")).toHaveText("Tape");
    });

    test("예약 녹음: 정지 중 발화 → 백그라운드 무음 녹음, 튜너·데크만 점등, 종료 후 카세트 보관", async ({ page }) => {
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            // 창을 넉넉히 — 스로틀된 WebKit에서 첫 bg 어태치가 죽으면 재튠(10초 주기
            // reservationTick)이 살릴 때까지 회차가 만료되지 않아야 한다. 창이 짧으면
            // 회차가 미시작으로 만료되어 아래 대기가 영원히 성립하지 않는다.
            // 실제 종료는 시작 확인 후 endTs를 당겨 만든다.
            fireReservation(
                { id: 990, stationId: st.id, title: "타이머 테스트", repeat: "once", enabled: true },
                { ymd: "t", startTs: Date.now(), endTs: Date.now() + 45000 }, "990:t");
        });
        // 대기 22초 = 재튠 한 번까지 흡수. rAF 폴링은 미디어 처리 중 멈출 수 있어 interval로 재평가
        await page.waitForFunction(() => !!recorder && deckMode === "rec", null, { timeout: 22000, polling: 120 });
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
            bgOn: !!((bgRecPlayer && bgRecPlayer.hls && bgRecAudio && !bgRecAudio.paused)
                || (bgRecPlayer && bgRecPlayer.kind === "native-capture"
                    && bgRecNativeCapture && bgRecNativeCapture.ready)),
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
        // 시작·점등·릴까지 확인됐다 — 종료 시각을 당겨 마감한다 (실데이터가 담길 몇 초만 남기고)
        await page.evaluate(() => { activeResRec.endTs = Date.now() + 6000; });
        await page.waitForFunction(() => !recorder && !activeResRec && !isPlaying && deckMode === "stop", null, { timeout: 15000, polling: 150 });
        // 완료되면 프로그램명이 붙은 카세트가 되감긴 채 테이프 랙에 보관된다
        await page.waitForFunction(() =>
            [...document.querySelectorAll("#deckShelf g[data-id] text")].some((t) => t.textContent.includes("타이머 테스트")),
            null, { timeout: 10000, polling: 150 });
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

    test("오디오 타이머 DT-540: 시계·SLEEP·TIMER 스위치 게이트·PROGRAM 진입", async ({ page }) => {
        await expect(page.locator("#timerStage svg")).toBeVisible();
        // 시계가 실제 시각을 따른다 (자정 넘김 대비 원형 거리)
        const clock = await page.evaluate(() => ({
            shownMin: parseInt(document.getElementById("dtClockH").textContent, 10) * 60
                + parseInt(document.getElementById("dtClockM").textContent, 10),
            realMin: new Date().getHours() * 60 + new Date().getMinutes(),
        }));
        const diff = Math.abs(clock.shownMin - clock.realMin);
        expect(Math.min(diff, 1440 - diff), "시계 표시 = 실제 시각").toBeLessThanOrEqual(1);
        // SLEEP 버튼 — 취침 타이머 연동 + VFD 잔여 표시
        await page.evaluate(() => document.getElementById("dtBtnSleep").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(await page.evaluate(() => sleepDeadline > Date.now()), "취침 타이머 활성").toBe(true);
        expect(await page.evaluate(() => { timerPaint(); return document.getElementById("dtSleepText").textContent; })).toContain("SLEEP");
        await page.evaluate(() => { sleepIndex = SLEEP_STEPS.length - 1; cycleSleepTimer(); });   // 한 바퀴 돌려 끄기
        // TIMER 스위치 OFF — 예약이 있어도 발화하지 않는다 (localStorage 영속)
        await page.evaluate(() => setTimerArmed(false));
        expect(await page.evaluate(() => loadJson("fmRadio.timerArmed", null)), "OFF 영속").toBe(false);
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            const d = new Date(); d.setHours(0, 0, 0, 0);
            addReservation({ stationId: st.id, title: "게이트", startMin: 0, endMin: 1439, repeat: "once", ymd: FMSchedule.ymdOf(d) });
            reservationTick();
        });
        expect(await page.evaluate(() => !!activeResRec), "OFF에서는 발화 금지").toBe(false);
        expect(await page.evaluate(() => document.getElementById("dtProgText").textContent)).toBe("TIMER OFF");
        // ON이면 즉시 발화하고, 다시 내리면 회차가 그 자리에서 정리된다
        await page.evaluate(() => { setTimerArmed(true); reservationTick(); });
        expect(await page.evaluate(() => !!activeResRec), "ON이면 발화").toBe(true);
        await page.evaluate(() => setTimerArmed(false));
        expect(await page.evaluate(() => !!activeResRec), "스위치 내림 = 회차 종료").toBe(false);
        await page.evaluate(() => {
            setTimerArmed(true);
            reservations.slice().forEach((r) => removeReservation(r.id));
        });
        // PROGRAM 버튼 — 편성표 예약 탭으로 진입
        await page.evaluate(() => document.getElementById("dtBtnProg").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        await expect(page.locator("#schedOverlay")).toBeVisible();
        expect(await page.evaluate(() => schedState.view), "예약 탭으로 열림").toBe("res");
        await page.evaluate(() => closeSchedule());
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
                { ymd: "tk", startTs: Date.now(), endTs: Date.now() + 25000 }, "991:tk");
        });
        // 프리징(마이크로태스크 루프)이 재발하면 여기서 타임아웃으로 실패한다.
        // 창 25초·대기 22초: 스로틀된 WebKit에서 bg 첫 어태치가 죽으면 재튠 워치독이
        // ~10초에 살린다 — 창이 그보다 짧으면 회차가 미시작으로 만료된다.
        // polling: 재생 중 rAF가 멈출 수 있어 interval 폴링으로 재평가한다.
        await page.waitForFunction(() => !!recorder && deckMode === "rec", null, { timeout: 22000, polling: 120 });
        const s = await page.evaluate(() => ({
            sel: window.__selCount,
            phono: phonoActive,
            playing: isPlaying,
            mainPaused: document.getElementById("audioPlayer").paused
        }));
        expect(s.sel, "본체 선국 없음 — 백그라운드 수신").toBe(0);
        expect(s.phono && s.playing, "턴테이블은 계속 재생").toBe(true);
        expect(s.mainPaused, "본체 오디오 재생 유지").toBe(false);
        await page.waitForFunction(() => !recorder && !activeResRec, null, { timeout: 35000, polling: 120 });
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

    test("더블데크 W-990RX: A웰 재생 중 예약 녹음은 B웰 — 재생 무중단, 종료 후 카세트 랙 보관", async ({ page, browserName }) => {
        // W-990RX 장착
        await page.click('button:has-text("오디오 구성")');
        await page.locator('#deckPicker .skin-btn', { hasText: "TEAC W-990RX" }).click();
        await page.keyboard.press("Escape");
        expect(await page.evaluate(() => isDoubleDeck()), "더블데크 인식").toBe(true);
        await expect(page.locator('#deckStage svg[aria-label*="W-990RX"]')).toHaveAttribute("viewBox", "0 0 2000 520");
        await expect(page.locator("#deckVuL [data-meter-segment]")).toHaveCount(14);
        await expect(page.locator("#deckVuR [data-meter-segment]")).toHaveCount(14);
        await expect(page.locator("#deckBReelL")).toHaveAttribute("data-cx", "1456");
        await expect(page.locator("#deckBReelR")).toHaveAttribute("data-cx", "1696");
        const deckGeometry = await page.evaluate(() => {
            const a = document.getElementById("deckWindowA");
            const b = document.getElementById("deckWindowB");
            return {
                ax: Number(a.getAttribute("x")), bx: Number(b.getAttribute("x")),
                aw: Number(a.getAttribute("width")), bw: Number(b.getAttribute("width")),
                headA: document.getElementById("deckHeadA").getAttribute("d"),
                headB: document.getElementById("deckHeadB").getAttribute("d"),
            };
        });
        expect(deckGeometry).toEqual({
            ax: 264, bx: 1416, aw: 320, bw: 320,
            headA: "M296 249H552L530 284H318Z",
            headB: "M1448 249H1704L1682 284H1470Z",
        });
        await expect(page.locator("#deckStage .lz-hardware-side")).toHaveCount(6);
        // 수록곡 있는 테이프를 A웰에 장착하고 재생 (합성 WAV 세그먼트)
        await page.evaluate((url) => {
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 40, url, name: "시험 곡", type: "audio/mpeg" });
            deckInsertTape(t.id);
            deckPlay();
        }, MOCK_AUDIO_URL);
        await page.waitForFunction(() => deckMode === "play" && !document.getElementById("audioPlayer").paused, null, { timeout: 15000 });
        const mainSource = await page.evaluate(() => audio.currentSrc || audio.src);
        // 예약 발화 → 녹음은 B웰(recOnB)로, A웰 재생은 계속되어야 한다
        await page.evaluate(() => {
            const st = window.FMRadio.stations[0];
            fireReservation({ id: 993, stationId: st.id, title: "더블데크 예약", repeat: "once", enabled: true },
                { ymd: "tw", startTs: Date.now(), endTs: Date.now() + 20000 }, "993:tw");
        });
        await page.waitForFunction(() => !!recorder && recOnB === true, null, { timeout: 18000, polling: 120 });
        const mid = await page.evaluate(() => ({
            mode: deckMode,
            playing: isPlaying,
            mainPaused: document.getElementById("audioPlayer").paused,
            mainSource: document.getElementById("audioPlayer").currentSrc
                || document.getElementById("audioPlayer").src,
            hasB: !!deckBTape,
            bReel: document.getElementById("deckBReelL").getAttribute("transform"),
        }));
        expect(mid.mode, "A웰 재생 무중단").toBe("play");
        expect(mid.mainSource, "본체 오디오 소스 유지").toBe(mainSource);
        // Windows Playwright WebKit에는 MP3/PCM 디코더가 없어 playing이 error로
        // 바뀔 수 있다. 이 프로젝트에서 검증할 계약은 예약이 pause/src 교체를 하지 않는지다.
        if (browserName !== "webkit") {
            expect(mid.mainPaused, "본체 오디오 재생 유지").toBe(false);
            expect(mid.playing, "본체 오디오 상태 유지").toBe(true);
        }
        expect(mid.hasB, "B웰 테이프 장착").toBe(true);
        // B웰 릴 회전 — rAF 스로틀과 무관하게 합성 타임스탬프로 프레임 루프를 돌린다
        expect(await page.evaluate((r1) => {
            const t0 = performance.now() - 600;
            ttLastTs = t0;
            for (let i = 1; i <= 10; i++) ttFrame(t0 + i * 50);
            return document.getElementById("deckBReelL").getAttribute("transform") !== r1;
        }, mid.bReel), "B웰 릴 회전").toBe(true);
        // 종료: A웰은 계속 재생, B웰 카세트는 되감겨 랙으로 배출
        // (onstop→IndexedDB 저장이 비동기라 라벨 달린 카세트가 실릴 때까지 기다린다)
        await page.waitForFunction(() =>
            !recorder && !activeResRec && tapes.some((x) => x.label.includes("더블데크 예약") && x.segments.length),
            null, { timeout: 32000, polling: 120 });
        const end = await page.evaluate(() => {
            const t = tapes.find((x) => x.label.includes("더블데크 예약"));
            return {
                mode: deckMode, playing: isPlaying, bEmpty: deckBTape === null,
                mainPaused: audio.paused, mainSource: audio.currentSrc || audio.src,
                pos: t && t.pos, segs: t ? t.segments.length : 0, inA: deckTape === t,
            };
        });
        expect(end.mode, "종료 후에도 A웰 재생").toBe("play");
        expect(end.mainSource, "종료 후에도 본체 소스 유지").toBe(mainSource);
        if (browserName !== "webkit") {
            expect(end.mainPaused, "종료 후에도 본체 재생 유지").toBe(false);
            expect(end.playing, "종료 후에도 본체 상태 유지").toBe(true);
        }
        expect(end.bEmpty, "B웰 자동 배출").toBe(true);
        expect(end.pos, "되감김").toBe(0);
        expect(end.segs, "녹음 세그먼트 존재").toBeGreaterThan(0);
        expect(end.inA, "랙에 보관 (A웰 아님)").toBe(false);
        const blobSize = await page.evaluate(async () => {
            const t = tapes.find((x) => x.label.includes("더블데크 예약"));
            return fetch(t.segments[0].url).then((r) => r.blob()).then((b) => b.size);
        });
        expect(blobSize, "녹음 파일 실데이터(>20KB)").toBeGreaterThan(20000);
    });

    test("더블데크 수동 REC = 더빙: A웰 재생을 B웰에 녹음, REC 재누름으로 정지·랙 보관", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await page.locator('#deckPicker .skin-btn', { hasText: "TEAC W-990RX" }).click();
        await page.keyboard.press("Escape");
        await page.evaluate((b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 40, url, name: "더빙 원본", type: "audio/wav" });
            deckInsertTape(t.id);
            deckPlay();
        }, makeWav(40).toString("base64"));
        await page.waitForFunction(() => deckMode === "play" && isPlaying, null, { timeout: 15000 });
        // 재생 중 REC — 싱글 데크라면 거부되지만 더블데크는 B웰 더빙으로 시작된다
        await page.evaluate(() => deckRec());
        await page.waitForFunction(() => !!recorder && recOnB === true, null, { timeout: 8000, polling: 120 });
        expect(await page.evaluate(() => deckMode), "A웰 재생 유지").toBe("play");
        await page.waitForTimeout(2500);
        await page.evaluate(() => deckRec());   // 재누름 = 정지
        // onstop은 비동기 — 더빙 세그먼트가 랙의 카세트에 실릴 때까지 기다린다
        await page.waitForFunction(() => !recorder && tapes.some((t) => t.segments.length && t !== deckTape), null, { timeout: 8000, polling: 120 });
        const end = await page.evaluate(() => ({
            mode: deckMode, bEmpty: deckBTape === null,
            dubbed: tapes.some((t) => t.segments.length && t !== deckTape),
            msg: playerSubtext.textContent,
        }));
        expect(end.mode, "정지 후에도 A웰 재생").toBe("play");
        expect(end.bEmpty, "B웰 배출").toBe(true);
        expect(end.dubbed, "더빙 카세트가 랙에").toBe(true);
        expect(end.msg, "B웰 안내 문구").toContain("B웰");
    });

    test("SE-9 메모리 EQ: 프리셋 적용·모터 이동·A/B 비교·슬롯 저장·모델 간 리샘플", async ({ page }) => {
        await page.evaluate(() => { setUnitShow("eq", true); setEqModel("se9"); });
        await expect(page.locator("#eqKey_mem")).toHaveCount(1);
        // CI 헤드리스는 rAF가 수 초씩 멈춘다 — 모터 이동(rAF 320ms)이 언제 끝날지, 그 사이
        // 어느 중간 커브가 잡힐지 기계 속도에 좌우된다. 특히 이동 초반에 MEM 저장이 끼어들면
        // 미세한 커브가 담기고, 리샘플의 0.5dB 양자화가 이를 전부 0으로 뭉개 '모델 간 리샘플'
        // 검증이 영원히 거짓이 된다. ttFrame 펌프와 같은 원리로 rAF를 가로채 합성 타임스탬프로
        // 모터를 그 자리에서 완주시켜, 테스트가 항상 '안착 후' 상태만 다루게 한다.
        await page.evaluate(() => {
            window.__eqMotorRun = (trigger) => {
                const realRaf = window.requestAnimationFrame;
                const realCancel = window.cancelAnimationFrame;
                const q = new Map();
                let id = 1e6;
                window.requestAnimationFrame = (cb) => { q.set(++id, cb); return id; };
                window.cancelAnimationFrame = (i) => { if (!q.delete(i)) realCancel.call(window, i); };
                try {
                    trigger();
                    let t = performance.now();
                    for (let i = 0; i < 40 && q.size; i++) {
                        t += 50;
                        const cbs = [...q.values()];
                        q.clear();
                        cbs.forEach((cb) => cb(t));
                    }
                } finally {
                    window.requestAnimationFrame = realRaf;
                    window.cancelAnimationFrame = realCancel;
                    q.forEach((cb) => realRaf.call(window, cb));   // 모터 밖 잔여 콜백은 실제 rAF로
                }
            };
        });
        // 팩토리 프리셋 → 커브가 모터 이동으로 안착 — 완주하면 현재 모델 밴드로 리샘플된
        // 목표값에 정확히 스냅된다 (밴드 수를 하드코딩하지 않는다 — 밴드 구성이 바뀌어도 유효)
        await page.evaluate(() => __eqMotorRun(() => {
            const preset = EQ_PRESETS.find((x) => x.id === "y80");
            eqApplyCurvePts(preset.pts, preset.label, preset.id);
        }));
        expect(await page.evaluate(() => {
            const want = eqResample(EQ_PRESETS.find((x) => x.id === "y80").pts);
            return eqState.gains.se9.length === want.length && eqState.gains.se9.every((g, i) => Math.abs(g - want[i]) < 0.01);
        }), "프리셋 안착").toBe(true);
        // 오토-B: A/B 한 번 = 직전(플랫) 커브, 다시 = 프리셋 복귀
        await page.evaluate(() => __eqMotorRun(() => eqToggleBank()));
        expect(await page.evaluate(() => eqState.gains.se9.every((g) => g === 0)), "B 뱅크 = 직전 플랫").toBe(true);
        await page.evaluate(() => __eqMotorRun(() => eqToggleBank()));
        expect(await page.evaluate(() => eqState.gains.se9.some((g) => g !== 0)), "A 뱅크 = 프리셋 복귀").toBe(true);
        // MEMORY → 슬롯 A 저장 → localStorage 영속 (모터가 완주한 뒤라 온전한 커브가 담긴다)
        await page.evaluate(() => {
            document.getElementById("eqKey_mem").dispatchEvent(new MouseEvent("click", { bubbles: true }));
            document.getElementById("eqKey_slotA").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).slots.A.pts.length), "슬롯 영속").toBeGreaterThanOrEqual(5);
        // 슬롯은 모델을 넘나든다 — GE-5(10밴드)에서 호출하면 리샘플 적용
        await page.evaluate(() => __eqMotorRun(() => { setEqModel("ge5"); eqSlotPress("A"); }));
        expect(await page.evaluate(() => eqState.gains.ge5.some((g) => g !== 0)), "리샘플 적용").toBe(true);
    });

    test("몰입 모드 두 보기: 리스닝 룸 핏·스피커·단일 확대·와이드", async ({ page }) => {
        await page.setViewportSize({ width: 1512, height: 982 });
        await page.evaluate(() => applyFocusMode(true));
        await expect(page.locator("#speakerL")).toBeVisible();
        await expect(page.locator("#speakerR")).toBeVisible();
        await expect(page.locator("#speakerL")).toHaveAttribute("src", "images/side-speaker.webp");
        await expect(page.locator("#speakerR")).toHaveAttribute("src", "images/side-speaker.webp");
        await expect(page.locator(".speaker-svg")).toHaveCount(0);
        await page.waitForTimeout(50);
        const speakers = await page.evaluate(() => {
            const l = document.getElementById("speakerL");
            const r = document.getElementById("speakerR");
            const rack = document.getElementById("rackColumn");
            const lr = l.getBoundingClientRect();
            const rr = r.getBoundingClientRect();
            const sr = rack.getBoundingClientRect();
            const heroStyle = getComputedStyle(document.querySelector(".hero-visual"));
            const visibleUnits = [...rack.children]
                .filter((el) => getComputedStyle(el).display !== "none");
            const unitBottom = Math.max(...[...rack.children]
                .filter((el) => getComputedStyle(el).display !== "none")
                .map((el) => el.getBoundingClientRect().bottom));
            return {
                natural: [l.naturalWidth, l.naturalHeight],
                left: { x: lr.x, right: lr.right, height: lr.height, bottom: lr.bottom },
                right: { x: rr.x, gap: innerWidth - rr.right, height: rr.height, bottom: rr.bottom },
                safe: { top: parseFloat(heroStyle.paddingTop), bottom: parseFloat(heroStyle.paddingBottom) },
                system: {
                    left: sr.left,
                    right: sr.right,
                    top: Math.min(...visibleUnits.map((el) => el.getBoundingClientRect().top)),
                    bottom: unitBottom,
                    containerBottom: sr.bottom
                },
                viewport: [innerWidth, innerHeight]
            };
        });
        expect(speakers.natural).toEqual([612, 1001]);
        expect(speakers.left.height, "MacBook 화면에서 스피커가 충분히 커야 한다").toBeGreaterThanOrEqual(speakers.viewport[1] * .8);
        expect(speakers.safe.bottom, "그림자까지 보존하는 하단 광학 안전영역").toBeGreaterThanOrEqual(56);
        expect(Math.abs((speakers.viewport[1] - speakers.system.bottom) - speakers.safe.bottom), "랙 바닥 = 동적 안전선").toBeLessThanOrEqual(2);
        expect(speakers.system.top, "랙 상단 = 동적 안전영역 안").toBeGreaterThanOrEqual(speakers.safe.top - 2);
        expect(Math.abs(speakers.system.containerBottom - speakers.system.bottom), "랙 컨테이너와 실제 마지막 컴포넌트 바닥").toBeLessThanOrEqual(2);
        expect(Math.abs(speakers.left.bottom - speakers.system.bottom), "왼쪽 스피커 원본 바닥 = 랙 바닥").toBeLessThanOrEqual(2);
        expect(Math.abs(speakers.right.bottom - speakers.system.bottom), "오른쪽 스피커 원본 바닥 = 랙 바닥").toBeLessThanOrEqual(2);
        expect(speakers.left.right, "왼쪽 스피커는 랙과 겹치지 않음").toBeLessThanOrEqual(speakers.system.left - 10);
        expect(speakers.right.x, "오른쪽 스피커는 랙과 겹치지 않음").toBeGreaterThanOrEqual(speakers.system.right + 10);
        expect(Math.abs(speakers.left.x - speakers.right.gap), "좌우 대칭 배치").toBeLessThanOrEqual(2);
        expect(Math.abs(speakers.left.height - speakers.right.height), "좌우 동일 크기").toBeLessThanOrEqual(1);
        await page.waitForFunction(() => {
            const r = document.getElementById("rackColumn").getBoundingClientRect();
            return r.height > 0 && r.height <= innerHeight;
        }, null, { timeout: 3000 });
        expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), "룸 모드 무스크롤").toBeLessThanOrEqual(0);
        await page.evaluate(() => focusUnitZoom(document.getElementById("deckStage")));
        await page.waitForTimeout(50);
        expect(await page.evaluate(() => document.getElementById("ampStage").offsetParent === null), "확대 중 다른 유닛 후퇴").toBe(true);
        expect(await page.evaluate(() => document.getElementById("deckStage").getBoundingClientRect().width), "확대 폭").toBeGreaterThan(1000);
        const zoomLayout = await page.evaluate(() => {
            const deck = document.getElementById("deckStage").getBoundingClientRect();
            const left = document.getElementById("speakerL").getBoundingClientRect();
            const right = document.getElementById("speakerR").getBoundingClientRect();
            const heroStyle = getComputedStyle(document.querySelector(".hero-visual"));
            return {
                deck: { left: deck.left, right: deck.right, bottom: deck.bottom },
                left: { right: left.right, bottom: left.bottom },
                right: { left: right.left, bottom: right.bottom },
                safe: { top: parseFloat(heroStyle.paddingTop), bottom: parseFloat(heroStyle.paddingBottom) },
                viewportRight: innerWidth,
                viewportBottom: innerHeight
            };
        });
        expect(Math.abs((zoomLayout.viewportBottom - zoomLayout.deck.bottom) - zoomLayout.safe.bottom), "확대 유닛 바닥 = 동적 안전선").toBeLessThanOrEqual(2);
        expect(zoomLayout.deck.left, "확대 유닛 왼쪽은 화면 안").toBeGreaterThanOrEqual(0);
        expect(zoomLayout.deck.right, "확대 유닛 오른쪽은 화면 안").toBeLessThanOrEqual(zoomLayout.viewportRight);
        expect(Math.abs(zoomLayout.left.bottom - zoomLayout.deck.bottom), "확대 시 왼쪽 스피커 원본 바닥").toBeLessThanOrEqual(2);
        expect(Math.abs(zoomLayout.right.bottom - zoomLayout.deck.bottom), "확대 시 오른쪽 스피커 원본 바닥").toBeLessThanOrEqual(2);
        expect(zoomLayout.left.right, "확대 시 왼쪽 겹침 없음").toBeLessThanOrEqual(zoomLayout.deck.left - 10);
        expect(zoomLayout.right.left, "확대 시 오른쪽 겹침 없음").toBeGreaterThanOrEqual(zoomLayout.deck.right + 10);
        await page.keyboard.press("Escape");
        expect(await page.evaluate(() => document.body.classList.contains("focus-unit-zoomed")), "ESC 1회 = 확대 해제").toBe(false);
        expect(await page.evaluate(() => document.body.classList.contains("mode-focus")), "룸은 유지").toBe(true);
        await page.evaluate(() => toggleFocusView());
        expect(await page.evaluate(() => getComputedStyle(document.getElementById("speakerL")).display), "와이드 = 스피커 숨김").toBe("none");
        expect(await page.evaluate(() => document.getElementById("rackColumn").getBoundingClientRect().width), "와이드 = 컴포넌트 크게").toBeGreaterThan(1300);
        await page.evaluate(() => { toggleFocusView(); applyFocusMode(false); });
        // 일반 랙 화면의 단일 확대도 Mac 네이티브 브리지를 거쳐 실제 전체 화면으로 진입한다.
        await page.evaluate(() => {
            window.__focusBridgeCalls = [];
            Object.defineProperty(window, "webkit", {
                configurable: true,
                value: { messageHandlers: { focus: { postMessage: (on) => window.__focusBridgeCalls.push(on) } } }
            });
        });
        await page.locator("#deckStage .unit-zoom-btn").click();
        expect(await page.evaluate(() => ({
            bridge: window.__focusBridgeCalls,
            focus: document.body.classList.contains("mode-focus"),
            room: document.body.classList.contains("focus-room"),
            zoom: document.body.classList.contains("focus-unit-zoomed"),
            lightbox: document.body.classList.contains("unit-lightbox"),
            deck: document.getElementById("deckStage").classList.contains("unit-zoomed")
        }))).toEqual({ bridge: [true], focus: true, room: true, zoom: true, lightbox: false, deck: true });
        await page.keyboard.press("Escape");
        expect(await page.evaluate(() => document.body.classList.contains("focus-unit-zoomed")), "ESC = 개별 확대 해제").toBe(false);
        await page.evaluate(() => applyFocusMode(false));
    });

    test("몰입 모드 화면 행렬: 모든 비율에서 visible viewport·paint 안전영역 보존", async ({ page }) => {
        const sizes = [
            { width: 440, height: 780 },
            { width: 1408, height: 881 },
            { width: 390, height: 844 },
            { width: 844, height: 390 },
            { width: 240, height: 160 },
            { width: 120, height: 80 },
            { width: 800, height: 600 },
            { width: 1280, height: 360 },
            { width: 1024, height: 640 },
            { width: 1180, height: 900 },
            { width: 1181, height: 720 },
            { width: 1181, height: 721 },
            { width: 1280, height: 720 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1512, height: 982 },
            { width: 1920, height: 1080 },
            { width: 2560, height: 1080 },
            { width: 3440, height: 900 }
        ];

        await page.setViewportSize(sizes[0]);
        await page.evaluate(() => {
            focusView = "room";
            focusClearZoom();
            applyFocusMode(true);
        });

        for (let index = 0; index < sizes.length; index += 1) {
            const size = sizes[index];
            const label = `${size.width}×${size.height}`;
            if (index) await page.setViewportSize(size);
            await page.waitForFunction(({ width, height }) => {
                const hero = document.querySelector(".hero-visual");
                const rect = hero.getBoundingClientRect();
                const speaker = document.getElementById("speakerL");
                const shouldShow = width > 1180 && height > 720;
                return Math.abs(rect.width - width) < 2 && Math.abs(rect.height - height) < 2 &&
                    (getComputedStyle(speaker).display !== "none") === shouldShow;
            }, size);

            const room = await page.evaluate(() => {
                const hero = document.querySelector(".hero-visual");
                const rack = document.getElementById("rackColumn");
                const units = [...rack.children].filter((el) => getComputedStyle(el).display !== "none");
                const rects = units.map((el) => el.getBoundingClientRect());
                const rackRect = rack.getBoundingClientRect();
                const left = document.getElementById("speakerL");
                const right = document.getElementById("speakerR");
                const leftRect = left.getBoundingClientRect();
                const rightRect = right.getBoundingClientRect();
                const style = getComputedStyle(hero);
                const heroRect = hero.getBoundingClientRect();
                const firstSvg = rack.querySelector("svg");
                return {
                    safe: { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) },
                    hero: {
                        left: heroRect.left, top: heroRect.top,
                        right: heroRect.right, bottom: heroRect.bottom,
                        width: heroRect.width, height: heroRect.height,
                        radius: style.borderRadius
                    },
                    system: {
                        left: rackRect.left,
                        right: rackRect.right,
                        top: Math.min(...rects.map((r) => r.top)),
                        bottom: Math.max(...rects.map((r) => r.bottom))
                    },
                    speakers: {
                        visible: getComputedStyle(left).display !== "none",
                        left: { top: leftRect.top, right: leftRect.right, bottom: leftRect.bottom },
                        right: { top: rightRect.top, left: rightRect.left, bottom: rightRect.bottom }
                    },
                    viewport: { width: innerWidth, height: innerHeight },
                    scroll: {
                        width: document.documentElement.scrollWidth,
                        height: document.documentElement.scrollHeight
                    },
                    paint: {
                        speakerFilter: getComputedStyle(left).filter,
                        svgShadow: firstSvg ? getComputedStyle(firstSvg).boxShadow : "missing",
                        insetShadow: getComputedStyle(rack.firstElementChild, "::after").boxShadow
                    }
                };
            });

            expect(room.hero.radius, `${label} 전체화면 모서리 비클리핑`).toBe("0px");
            expect(room.system.top, `${label} 랙 상단`).toBeGreaterThanOrEqual(room.hero.top + room.safe.top - 2);
            expect(room.system.bottom, `${label} 랙 하단`).toBeLessThanOrEqual(room.hero.bottom - room.safe.bottom + 2);
            expect(Math.abs(room.system.bottom - (room.hero.bottom - room.safe.bottom)), `${label} 랙 바닥 = 안전 바닥선`).toBeLessThanOrEqual(2);
            expect(room.scroll.width, `${label} 가로 스크롤 없음`).toBeLessThanOrEqual(room.viewport.width);
            expect(room.scroll.height, `${label} 세로 스크롤 없음`).toBeLessThanOrEqual(room.viewport.height);
            expect(room.paint.speakerFilter, `${label} 스피커 외부 paint 없음`).toBe("none");
            expect(room.paint.svgShadow, `${label} SVG 외부 paint 없음`).toBe("none");
            expect(room.paint.insetShadow, `${label} 깊이 효과는 내부 paint`).toContain("inset");

            const shouldShowSpeakers = size.width > 1180 && size.height > 720;
            expect(room.speakers.visible, `${label} 스피커 표시 정책`).toBe(shouldShowSpeakers);
            if (shouldShowSpeakers) {
                expect(room.speakers.left.top, `${label} 왼쪽 스피커 상단`).toBeGreaterThanOrEqual(room.hero.top + room.safe.top - 2);
                expect(room.speakers.left.bottom, `${label} 왼쪽 스피커 하단`).toBeLessThanOrEqual(room.hero.bottom - room.safe.bottom + 2);
                expect(room.speakers.right.top, `${label} 오른쪽 스피커 상단`).toBeGreaterThanOrEqual(room.hero.top + room.safe.top - 2);
                expect(room.speakers.right.bottom, `${label} 오른쪽 스피커 하단`).toBeLessThanOrEqual(room.hero.bottom - room.safe.bottom + 2);
                expect(Math.abs(room.speakers.left.bottom - room.system.bottom), `${label} 왼쪽 스피커·랙 바닥 일치`).toBeLessThanOrEqual(2);
                expect(Math.abs(room.speakers.right.bottom - room.system.bottom), `${label} 오른쪽 스피커·랙 바닥 일치`).toBeLessThanOrEqual(2);
                expect(room.system.left - room.speakers.left.right, `${label} 왼쪽 비겹침`).toBeGreaterThanOrEqual(10);
                expect(room.speakers.right.left - room.system.right, `${label} 오른쪽 비겹침`).toBeGreaterThanOrEqual(10);
            } else {
                expect(room.speakers.left.bottom, `${label} 숨긴 왼쪽 스피커 무박스`).toBe(0);
                expect(room.speakers.right.bottom, `${label} 숨긴 오른쪽 스피커 무박스`).toBe(0);
            }

            await page.evaluate(() => focusUnitZoom(document.getElementById("deckStage")));
            await page.waitForFunction(() => {
                const hero = document.querySelector(".hero-visual");
                const style = getComputedStyle(hero);
                const bounds = hero.getBoundingClientRect();
                const deck = document.getElementById("deckStage").getBoundingClientRect();
                return document.body.classList.contains("focus-unit-zoomed") &&
                    deck.left >= bounds.left - 1 && deck.right <= bounds.right + 1 &&
                    deck.top >= bounds.top + parseFloat(style.paddingTop) - 2 &&
                    deck.bottom <= bounds.bottom - parseFloat(style.paddingBottom) + 2;
            });
            const zoom = await page.evaluate(() => {
                const heroStyle = getComputedStyle(document.querySelector(".hero-visual"));
                const hero = document.querySelector(".hero-visual").getBoundingClientRect();
                const deck = document.getElementById("deckStage").getBoundingClientRect();
                return {
                    safe: { top: parseFloat(heroStyle.paddingTop), bottom: parseFloat(heroStyle.paddingBottom) },
                    hero: { left: hero.left, top: hero.top, right: hero.right, bottom: hero.bottom },
                    deck: { left: deck.left, top: deck.top, right: deck.right, bottom: deck.bottom },
                    filter: getComputedStyle(document.getElementById("deckStage")).filter
                };
            });
            expect(zoom.deck.left, `${label} 확대 왼쪽`).toBeGreaterThanOrEqual(zoom.hero.left);
            expect(zoom.deck.right, `${label} 확대 오른쪽`).toBeLessThanOrEqual(zoom.hero.right);
            expect(zoom.deck.top, `${label} 확대 상단`).toBeGreaterThanOrEqual(zoom.hero.top + zoom.safe.top - 2);
            expect(zoom.deck.bottom, `${label} 확대 하단`).toBeLessThanOrEqual(zoom.hero.bottom - zoom.safe.bottom + 2);
            expect(zoom.filter, `${label} 확대 래퍼 외부 paint 없음`).toBe("none");
            await page.evaluate(() => { focusClearZoom(); focusFitRack(); });
        }
        await page.evaluate(() => applyFocusMode(false));
    });

    test("몰입 모드 native 창 전환: 440×780 ↔ 1408×881 자동 재측정", async ({ page }) => {
        await page.setViewportSize({ width: 440, height: 780 });
        await page.evaluate(() => {
            focusView = "room";
            applyFocusMode(false);
            window.__focusBridgeCalls = [];
            Object.defineProperty(window, "webkit", {
                configurable: true,
                value: { messageHandlers: { focus: { postMessage: (on) => window.__focusBridgeCalls.push(on) } } }
            });
            focusUnitZoom(document.getElementById("deckStage"));
        });
        const smallWidth = await page.locator("#deckStage").evaluate((el) => el.getBoundingClientRect().width);

        await page.setViewportSize({ width: 1408, height: 881 });
        await page.waitForFunction((oldWidth) => {
            const hero = document.querySelector(".hero-visual");
            const style = getComputedStyle(hero);
            const bounds = hero.getBoundingClientRect();
            const deck = document.getElementById("deckStage").getBoundingClientRect();
            return deck.width > oldWidth * 2 &&
                deck.top >= bounds.top + parseFloat(style.paddingTop) - 2 &&
                deck.bottom <= bounds.bottom - parseFloat(style.paddingBottom) + 2 &&
                getComputedStyle(document.getElementById("speakerL")).display !== "none";
        }, smallWidth);
        const large = await page.evaluate(() => {
            const deck = document.getElementById("deckStage").getBoundingClientRect();
            const left = document.getElementById("speakerL").getBoundingClientRect();
            const right = document.getElementById("speakerR").getBoundingClientRect();
            return {
                bridge: window.__focusBridgeCalls,
                deck: { left: deck.left, right: deck.right, bottom: deck.bottom },
                left: { right: left.right, bottom: left.bottom },
                right: { left: right.left, bottom: right.bottom },
                scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight]
            };
        });
        expect(large.bridge).toEqual([true]);
        expect(large.left.bottom, "확대 전환 뒤 왼쪽 스피커 바닥 일치").toBeCloseTo(large.deck.bottom, 0);
        expect(large.right.bottom, "확대 전환 뒤 오른쪽 스피커 바닥 일치").toBeCloseTo(large.deck.bottom, 0);
        expect(large.left.right, "확대 전환 뒤 왼쪽 비겹침").toBeLessThanOrEqual(large.deck.left - 10);
        expect(large.right.left, "확대 전환 뒤 오른쪽 비겹침").toBeGreaterThanOrEqual(large.deck.right + 10);
        expect(large.scroll[0], "확대 전환 뒤 가로 무스크롤").toBeLessThanOrEqual(1408);
        expect(large.scroll[1], "확대 전환 뒤 세로 무스크롤").toBeLessThanOrEqual(881);

        await page.setViewportSize({ width: 440, height: 780 });
        await page.waitForFunction(() => {
            const deck = document.getElementById("deckStage").getBoundingClientRect();
            return getComputedStyle(document.getElementById("speakerL")).display === "none" &&
                getComputedStyle(document.getElementById("speakerR")).display === "none" &&
                deck.left >= -1 && deck.right <= (visualViewport?.width || innerWidth) + 1;
        });
        expect(await page.evaluate(() => [
            document.getElementById("speakerL").getBoundingClientRect().width,
            document.getElementById("speakerR").getBoundingClientRect().width
        ]), "작은 화면에서는 양쪽 스피커 레이아웃 제거").toEqual([0, 0]);
        await page.evaluate(() => applyFocusMode(false));
    });

    test("몰입 모드 visualViewport: 오프셋·키보드 축소·safe-area 등가값 반영", async ({ page }) => {
        await page.setViewportSize({ width: 1408, height: 881 });
        await page.evaluate(() => {
            const state = { left: 31.5, top: 47.25, width: 900.5, height: 600.25, scale: 1.5 };
            const viewport = new EventTarget();
            for (const [property, key] of [
                ["offsetLeft", "left"], ["offsetTop", "top"],
                ["pageLeft", "left"], ["pageTop", "top"],
                ["width", "width"], ["height", "height"], ["scale", "scale"]
            ]) Object.defineProperty(viewport, property, { get: () => state[key] });
            Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
            viewport.addEventListener("resize", focusScheduleFit);
            viewport.addEventListener("scroll", focusScheduleFit);
            window.__setMfaVisualViewport = (next, eventName = "resize") => {
                Object.assign(state, next);
                viewport.dispatchEvent(new Event(eventName));
            };
        });
        await page.evaluate(() => {
            focusView = "room";
            applyFocusMode(true);
            const hero = document.querySelector(".hero-visual");
            hero.style.setProperty("--focus-ceiling-inset", "64px");
            hero.style.setProperty("--focus-floor-inset", "96px");
            focusScheduleFit();
        });
        await page.waitForFunction(() => {
            const hero = document.querySelector(".hero-visual");
            const rect = hero.getBoundingClientRect();
            const style = getComputedStyle(hero);
            const units = [...document.querySelectorAll("#rackColumn > *")]
                .filter((el) => getComputedStyle(el).display !== "none")
                .map((el) => el.getBoundingClientRect());
            const systemTop = Math.min(...units.map((bounds) => bounds.top));
            const systemBottom = Math.max(...units.map((bounds) => bounds.bottom));
            return Math.abs(rect.left - 31.5) < 1 && Math.abs(rect.top - 47.25) < 1 &&
                Math.abs(rect.width - 900.5) < 1 && Math.abs(rect.height - 600.25) < 1 &&
                systemTop >= rect.top + parseFloat(style.paddingTop) - 2 &&
                systemBottom <= rect.bottom - parseFloat(style.paddingBottom) + 2;
        });
        const compact = await page.evaluate(() => {
            const hero = document.querySelector(".hero-visual");
            const bounds = hero.getBoundingClientRect();
            const style = getComputedStyle(hero);
            const units = [...document.querySelectorAll("#rackColumn > *")]
                .filter((el) => getComputedStyle(el).display !== "none")
                .map((el) => el.getBoundingClientRect());
            return {
                hero: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
                safe: { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) },
                system: { top: Math.min(...units.map((r) => r.top)), bottom: Math.max(...units.map((r) => r.bottom)) },
                speakers: [
                    getComputedStyle(document.getElementById("speakerL")).display,
                    getComputedStyle(document.getElementById("speakerR")).display,
                    document.getElementById("speakerL").getBoundingClientRect().width,
                    document.getElementById("speakerR").getBoundingClientRect().width
                ]
            };
        });
        expect(compact.safe).toEqual({ top: 64, bottom: 96 });
        expect(compact.system.top).toBeGreaterThanOrEqual(compact.hero.top + compact.safe.top - 2);
        expect(compact.system.bottom).toBeLessThanOrEqual(compact.hero.bottom - compact.safe.bottom + 2);
        expect(compact.speakers).toEqual(["none", "none", 0, 0]);

        await page.evaluate(() => __setMfaVisualViewport({ left: 55.25, top: 63.75 }, "scroll"));
        await page.waitForFunction(() => {
            const rect = document.querySelector(".hero-visual").getBoundingClientRect();
            return Math.abs(rect.left - 55.25) < 1 && Math.abs(rect.top - 63.75) < 1;
        });
        await page.evaluate(() => __setMfaVisualViewport({ left: 12, top: 18, width: 1280, height: 760 }, "resize"));
        await page.waitForFunction(() => {
            const rect = document.querySelector(".hero-visual").getBoundingClientRect();
            return Math.abs(rect.left - 12) < 1 && Math.abs(rect.top - 18) < 1 &&
                Math.abs(rect.width - 1280) < 1 && Math.abs(rect.height - 760) < 1 &&
                getComputedStyle(document.getElementById("speakerL")).display !== "none";
        });
        await page.evaluate(() => applyFocusMode(false));
    });

    test("DRAGON 릴 정렬: 카세트·투명 창·회전축 중심 일치", async ({ page }) => {
        await page.evaluate(() => { deckModelId = "dragon"; mountDeck(); });
        const geometry = await page.evaluate(() => {
            const door = document.getElementById("dragonCassetteDoor");
            const shell = document.getElementById("dragonCassetteShell");
            const aperture = document.getElementById("dragonReelWindow");
            const left = document.getElementById("deckReelL");
            const right = document.getElementById("deckReelR");
            const center = (el) => Number(el.getAttribute("x")) + Number(el.getAttribute("width")) / 2;
            const windowBox = {
                x: Number(aperture.getAttribute("x")), y: Number(aperture.getAttribute("y")),
                w: Number(aperture.getAttribute("width")), h: Number(aperture.getAttribute("height"))
            };
            const packAudit = (side, reel) => {
                const pack = document.getElementById("deckPack" + side);
                const cx = Number(pack.getAttribute("cx")), cy = Number(pack.getAttribute("cy"));
                const packR = Number(pack.getAttribute("r"));
                const hubR = Number(reel.querySelector("circle").getAttribute("r"));
                return {
                    contained: cx - packR >= windowBox.x && cx + packR <= windowBox.x + windowBox.w &&
                        cy - packR >= windowBox.y && cy + packR <= windowBox.y + windowBox.h,
                    hubR, packR
                };
            };
            return {
                door: center(door),
                shell: center(shell),
                aperture: center(aperture),
                reels: (Number(left.dataset.cx) + Number(right.dataset.cx)) / 2,
                windowY: windowBox.y + windowBox.h / 2,
                ys: [Number(left.dataset.cy), Number(right.dataset.cy)],
                packs: [packAudit("L", left), packAudit("R", right)]
            };
        });
        expect(Math.abs(geometry.door - geometry.shell), "도어와 카세트 중심").toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.shell - geometry.aperture), "카세트와 릴 창 중심").toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.shell - geometry.reels), "카세트와 좌우 릴 중점").toBeLessThanOrEqual(1);
        expect(geometry.ys[0]).toBe(geometry.ys[1]);
        expect(Math.abs(geometry.windowY - geometry.ys[0]), "릴 창과 회전축 수직 중심").toBeLessThanOrEqual(1);
        geometry.packs.forEach((pack) => {
            expect(pack.contained, "테이프 팩이 투명 창 안에 포함").toBe(true);
            expect(pack.hubR, "허브가 테이프 팩보다 작음").toBeLessThan(pack.packR);
        });

        const rotated = await page.evaluate(() => {
            deckReelAngle = 37;
            const now = performance.now();
            ttLastTs = now;
            ttFrame(now);
            const point = (el, x, y) => {
                const p = el.ownerSVGElement.createSVGPoint();
                p.x = x; p.y = y;
                const out = p.matrixTransform(el.getCTM());
                return { x: out.x, y: out.y };
            };
            const check = (side, fallback) => {
                const reel = document.getElementById("deckReel" + side);
                const pack = document.getElementById("deckPack" + side);
                const cx = Number(reel.dataset.cx || fallback);
                const cy = Number(reel.dataset.cy || 260);
                const rp = point(reel, cx, cy);
                const pp = point(pack, Number(pack.getAttribute("cx")), Number(pack.getAttribute("cy")));
                return { transform: reel.getAttribute("transform"), distance: Math.hypot(rp.x - pp.x, rp.y - pp.y) };
            };
            return { left: check("L", 610), right: check("R", 850) };
        });
        expect(rotated.left.transform).toContain(" 450 260)");
        expect(rotated.right.transform).toContain(" 622 260)");
        expect(rotated.left.distance).toBeLessThan(1);
        expect(rotated.right.distance).toBeLessThan(1);
    });

    test("프런트패널 소생: 앰프 톤 영속·EQ 전원·데크 NR 히스", async ({ page }) => {
        await page.evaluate(() => { ampModelId = "e303"; mountAmp(); });
        await page.evaluate(() => {
            const k = [...document.querySelectorAll("#ampStage svg [role=slider]")].find((e) => e.getAttribute("aria-label") === "BASS");
            for (let i = 0; i < 5; i++) k.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
            const balance = [...document.querySelectorAll("#ampStage svg [role=slider]")].find((e) => e.getAttribute("aria-label") === "BALANCE");
            for (let i = 0; i < 4; i++) balance.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        });
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.frontPanel"))["e303.bass"]), "톤 영속").toBeCloseTo(4, 1);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.frontPanel"))["e303.balance"]), "밸런스 슬라이더 영속").toBeCloseTo(.4, 2);
        await page.locator('#ampStage [role="button"][aria-label="라우드니스 보상 켜기/끄기"]').click();
        await expect(page.locator("#e303LoudnessMark")).toHaveAttribute("transform", "rotate(45 285 446)");
        await page.evaluate(() => { setUnitShow("eq", true); eqTogglePower(); });
        expect(await page.evaluate(() => eqPowerOn)).toBe(false);
        expect(await page.evaluate(() => document.querySelector("#eqStage svg").style.filter)).toContain("brightness");
        await page.evaluate(() => eqTogglePower());
        await page.evaluate(() => { deckModelId = "dragon"; mountDeck(); });
        const m0 = await page.evaluate(() => deckHissMult());
        await page.evaluate(() => deckCycleNr());
        expect(await page.evaluate(() => deckHissMult()), "돌비 B = 히스 감소").toBeLessThan(m0);
    });

    test("죽은 조작부 재생: SL-1200 피치·쿼츠 록, TD124 4속, GARRARD 브레이크", async ({ page }) => {
        await page.evaluate(() => { ttModelId = "sl1200"; mountTurntable(); });
        await page.evaluate(() => {
            const hit = document.getElementById("ttPitchHit");
            for (let i = 0; i < 4; i++) hit.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
        expect(await page.evaluate(() => ttSpeedTrim), "피치 +2%").toBeCloseTo(1.02, 5);
        expect(await page.evaluate(() => !!document.getElementById("ttStrobeRing")), "스트로브 링").toBe(true);
        await page.evaluate(() => document.getElementById("ttQuartzHit").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(await page.evaluate(() => ttSpeedTrim), "쿼츠 록 = 0").toBe(1);
        // TD124: 노브 순환 33 → 45
        await page.evaluate(() => { ttModelId = "td124"; mountTurntable(); });
        await page.evaluate(() => document.getElementById("ttSpeedHit").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(await page.evaluate(() => ({ s: ttSpeed124, t: ttSpeedTrim }))).toEqual({ s: 45, t: 1.35 });
        // GARRARD: 브레이크 레버 — 누르는 동안만
        await page.evaluate(() => { ttModelId = "g301"; mountTurntable(); });
        await page.evaluate(() => document.getElementById("ttBrakeHit").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
        expect(await page.evaluate(() => ttBraking)).toBe(true);
        await page.evaluate(() => document.getElementById("ttBrakeHit").dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
        expect(await page.evaluate(() => ttBraking)).toBe(false);
    });

    test("B215 컴퓨터 컨트롤: MEM/CUE 주소 복귀·ZERO LOC·AUTO CAL 히스 감소", async ({ page }) => {
        await page.evaluate(() => { deckModelId = "b215"; mountDeck(); tapePos = 90; });
        // MEM(90) → RST: 0으로 자동 와인딩 후 정지
        await page.evaluate(() => {
            document.getElementById("deckKeyR6").dispatchEvent(new MouseEvent("click", { bubbles: true }));
            document.getElementById("deckKeyR11").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        await page.evaluate(() => {
            const t0 = performance.now() - 20000;
            ttLastTs = t0;
            for (let i = 1; i <= 200 && deckMode === "wind"; i++) ttFrame(t0 + i * 100);
        });
        expect(await page.evaluate(() => ({ pos: tapePos, mode: deckMode })), "ZERO LOC").toEqual({ pos: 0, mode: "stop" });
        // CUE: 기억한 90초 위치로 복귀
        await page.evaluate(() => document.getElementById("deckKeyR7").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        await page.evaluate(() => {
            const t0 = performance.now() - 20000;
            ttLastTs = t0;
            for (let i = 1; i <= 200 && deckMode === "wind"; i++) ttFrame(t0 + i * 100);
        });
        expect(await page.evaluate(() => tapePos), "ADDR LOC 복귀").toBe(90);
        // AUTO CAL → 테이프 캘리브레이션 플래그 + 메타 영속
        await page.evaluate(() => document.getElementById("deckKeyR9").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        await page.waitForFunction(() => deckTape && deckTape.cal === true, null, { timeout: 5000 });
        expect(await page.evaluate(() => /"cal":true/.test(localStorage.getItem("fmRadio.tapeMeta") || "")), "cal 영속").toBe(true);
    });

    test("데크 무음 회귀: 늦은 복원 픽업·스트립 정합 재개·묵은 소스 미탈취", async ({ page }) => {
        // ① 공테이프 재생 중 세그먼트가 늦게 도착(IndexedDB 복원 경합)해도 그 자리에서 소리가 난다
        await page.evaluate(() => deckPlay());
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => !!deckSegPlaying), "복원 전엔 무음 롤").toBe(false);
        await page.evaluate((b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            tapeAddSegment(deckTape, { start: 0, dur: 40, url, name: "늦은 복원", type: "audio/wav" });
        }, makeWav(40).toString("base64"));
        // 늦은 픽업은 프레임 루프 몫 — CI 헤드리스는 rAF가 수 초씩 멈추므로, 합성 타임스탬프로
        // 한 프레임 돌려 그 자리에서 집게 한다 (검증 대상은 픽업 로직이지 rAF 스케줄러가 아니다)
        await page.evaluate(() => { const t0 = performance.now(); ttLastTs = t0 - 50; ttFrame(t0); });
        // 재생이 온전히 자리잡을 때까지 기다린다 — 지연 시크 꼬리(loadedmetadata → seekAndPlay
        // → play())가 남은 채 ②에서 멈추면, 뒤늦은 play()가 일시정지를 도로 뒤집어
        // ▶ 클릭이 '재개'가 아니라 '일시정지'로 동작한다 (로컬·CI 플레이크의 원인)
        await page.waitForFunction(() => {
            const a = document.getElementById("audioPlayer");
            return !!deckSegPlaying && !a.paused && a.readyState >= 2 && !a.seeking;
        }, null, { timeout: 10000, polling: 100 });
        // ② 세그먼트 중간에서 멈췄다가 스트립 ▶ — 테이프가 이어지고 다른 소스를 훔치지 않는다
        await page.evaluate(() => { viewMode = "simple"; applyViewMode(); applyUnitVisibility(); });
        await page.evaluate(() => { audio.pause(); isPlaying = false; });
        await page.click("#btnPlay");
        await page.waitForFunction(() => !!deckSegPlaying && !document.getElementById("audioPlayer").paused, null, { timeout: 10000, polling: 100 });
        expect(await page.evaluate(() => deckMode), "여전히 테이프 모드").toBe("play");
        // ③ 공테이프(빈 구간)에서 스트립 ▶는 재생을 훔치지 않고 안내만 한다
        await page.evaluate(() => { deckStopTransport(); deckEject(); deckPlay(); });
        await page.waitForTimeout(200);
        await page.click("#btnPlay");
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => document.getElementById("audioPlayer").paused), "묵은 소스 미탈취").toBe(true);
        expect(await page.evaluate(() => playerSubtext.textContent)).toContain("공테이프");
    });

    test("퇴역 튜너 저장값은 MR78로 이동하고 가상 디지털창 대신 MULTIPATH 미터를 사용", async ({ page }) => {
        const migrated = await page.evaluate(() => {
            initTunerSkin("b760");
            return {
                id: tunerSkinId,
                saved: JSON.parse(localStorage.getItem("fmRadio.skin")),
                hasFreq: !!document.getElementById("tsFreq"),
                hasMultipath: !!document.getElementById("tsMultipathPtr"),
            };
        });
        expect(migrated).toEqual({ id: "mr78", saved: "mr78", hasFreq: false, hasMultipath: true });
        await expect(page.locator("#tunerStage")).toContainText("MULTIPATH");
        await expect(page.locator("#tsSelG")).toHaveAttribute("aria-label", "가변 선택도 — NORMAL / NARROW / SUPER NARROW");
    });

    test("W-990RX 더빙 버스: A→B 실복사 영속·REV MODE 릴레이 이어재생", async ({ page }) => {
        await page.click('button:has-text("오디오 구성")');
        await page.locator('#deckPicker .skin-btn', { hasText: "W-990RX" }).click();
        await page.keyboard.press("Escape");
        await page.evaluate((b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 30, url, name: "더빙 원본", type: "audio/wav" });
            deckInsertTape(t.id);
        }, makeWav(30).toString("base64"));
        // REV MODE(릴레이) ON → 더빙 시작
        await page.evaluate(() => document.getElementById("deckModeKey3").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        await page.evaluate(() => { w990StartDub(); });
        await page.waitForFunction(() => w990DubBusy && !!deckBTape, null, { timeout: 5000, polling: 100 });
        // 완료: B웰에 실복사본(dbId 영속)이 남는다 (릴레이 ON이므로 배출 안 함)
        await page.waitForFunction(() => !w990DubBusy && deckBTape && deckBTape.segments.length === 1, null, { timeout: 15000, polling: 120 });
        expect(await page.evaluate(() => deckBTape.segments.every((sg) => !!sg.dbId)), "IndexedDB 영속 복사").toBe(true);
        // A면 끝 → B웰 카세트로 릴레이 이어재생
        await page.evaluate(() => {
            tapePos = tapeUsedSec(deckTape);
            deckPlay();
            tapePos = tapeLenOf(deckTape) - 0.3;
            const t0 = performance.now() - 2000;
            ttLastTs = t0;
            for (let i = 1; i <= 30; i++) ttFrame(t0 + i * 50);
        });
        expect(await page.evaluate(() => ({ mode: deckMode, seg: !!deckSegPlaying, bEmpty: deckBTape === null })))
            .toEqual({ mode: "play", seg: true, bEmpty: true });
    });

    test("소스 보이싱: TT·튜너 시그니처 셸프, SE-9 8×2 구조, 10B 스코프", async ({ page, context }) => {
        await context.route("https://upload.wikimedia.org/**", (route) =>
            route.fulfill({ body: makeWav(40), contentType: "audio/wav", headers: { "Access-Control-Allow-Origin": "*" } }));
        // GARRARD 301 포노 → low 셸프 +1.4dB
        await page.evaluate(() => { ttModelId = "g301"; mountTurntable(); playPhonoTrack(0); });
        await page.waitForFunction(() => phonoActive && isPlaying, null, { timeout: 15000 });
        await page.evaluate(() => { const t0 = performance.now() - 100; ttLastTs = t0; ttFrame(t0 + 50); });
        await page.waitForFunction(() => voiceLow && Math.abs(voiceLow.gain.value - 1.4) < 0.2, null, { timeout: 5000, polling: 100 });
        expect(await page.evaluate(() => voiceSigLast)).toBe("tt:g301");
        // 10B 라디오 → 튜너 보이싱 + 스코프 라이브
        await page.evaluate(() => { stopPhono(); initTunerSkin("m10b"); selectStation(window.FMRadio.stations[0].id); });
        await page.waitForFunction(() => isPlaying && currentStation, null, { timeout: 15000 });
        await page.evaluate(() => { const t0 = performance.now() - 100; ttLastTs = t0; ttFrame(t0 + 50); });
        await page.waitForFunction(() => voiceSigLast === "tuner:m10b" && Math.abs(voiceLow.gain.value - 1.2) < 0.2, null, { timeout: 5000, polling: 100 });
        const scopeLive = await page.evaluate(() => {
            const d1 = document.getElementById("tsScopeCore").getAttribute("d");
            const t0 = performance.now() - 200;
            ttLastTs = t0;
            for (let i = 1; i <= 4; i++) ttFrame(t0 + i * 50);
            return d1 !== document.getElementById("tsScopeCore").getAttribute("d");
        });
        expect(scopeLive, "10B 스코프 트레이스가 산다").toBe(true);
        // SE-9 — 실기처럼 8개 중심 주파수와 L/R 쌍 슬라이더를 갖고 DSP는 링크된다.
        const se9 = await page.evaluate(() => {
            setEqModel("se9");
            return {
                model: eqModelId,
                freqs: EQ_FREQS.slice(),
                handles: document.querySelectorAll("#eqStage #eqH0 rect").length,
                saturated: !!eqBufferShaper,
            };
        });
        expect(se9.model).toBe("se9");
        expect(se9.freqs).toEqual([80, 160, 315, 630, 1250, 2500, 5000, 10000]);
        expect(se9.handles).toBeGreaterThanOrEqual(6);
        expect(se9.saturated).toBe(false);
    });

    test("DRAGON: 외부 테이프 아지무스(NAAC 보정)·오토 리버스 리피트", async ({ page }) => {
        // 외부(foreign) 테이프 — B215에선 고역 -4.5dB, DRAGON에선 평평
        await page.evaluate((b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            const t = newBlankTape(60);
            t.foreign = true;
            tapeAddSegment(t, { start: 0, dur: 20, url, name: "외부 믹스", type: "audio/wav" });
            window.__ft = t.id;
            deckModelId = "b215";
            mountDeck();
            deckInsertTape(t.id);
            deckPlay();
        }, makeWav(20).toString("base64"));
        await page.waitForFunction(() => deckMode === "play" && !document.getElementById("audioPlayer").paused, null, { timeout: 15000, polling: 100 });
        await page.evaluate(() => { const t0 = performance.now() - 100; ttLastTs = t0; ttFrame(t0 + 50); });
        await page.waitForFunction(() => voiceHigh && Math.abs(voiceHigh.gain.value - -4.5) < 0.4, null, { timeout: 5000, polling: 100 });
        await page.evaluate(() => {
            deckStopTransport();
            deckModelId = "dragon";
            mountDeck();
            deckInsertTape(window.__ft);
            deckPlay();
        });
        await page.waitForFunction(() => deckMode === "play", null, { timeout: 8000, polling: 100 });
        await page.evaluate(() => { const t0 = performance.now() - 100; ttLastTs = t0; ttFrame(t0 + 50); });
        await page.waitForFunction(() => voiceHigh && Math.abs(voiceHigh.gain.value) < 0.4, null, { timeout: 5000, polling: 100 });
        // AUTO REVERSE — 끝나면 되감아 처음부터 (60초 테이프라 합성 프레임으로 완주)
        await page.evaluate(() => document.getElementById("deckAutoRevLbl").dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(await page.evaluate(() => dragonRepeat)).toBe(true);
        await page.evaluate(() => {
            tapePos = tapeLenOf(deckTape) - 0.2;
            const t0 = performance.now() - 9000;
            ttLastTs = t0;
            for (let i = 1; i <= 120; i++) ttFrame(t0 + i * 70);
        });
        await page.waitForFunction(() => deckMode === "play" && tapePos < 8 && !!deckSegPlaying, null, { timeout: 8000, polling: 100 });
    });

    test("양면 테이프: 뒤집기 물리·면별 수록·DRAGON SIDE B 반전·TCD 헤드룸", async ({ page }) => {
        // 뒤집기 물리 — 감긴 자리가 유지되므로 카운터는 len - pos
        const flip = await page.evaluate((b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 20, url, name: "A면 곡", type: "audio/wav" });
            deckInsertTape(t.id);
            tapePos = 100;
            flipTape();
            const r = { side: t.side, pos: tapePos, bHolds: t.segmentsB.length };
            tapeAddSegment(t, { start: 0, dur: 20, url, name: "B면 곡", type: "audio/wav" });
            tapePos = 0;
            flipTape();
            r.back = { side: t.side, aName: t.segments[0].name, bName: t.segmentsB[0].name };
            tapeMetaSave();
            window.__t2 = t.id;
            return r;
        }, makeWav(20).toString("base64"));
        expect(flip.side).toBe("B");
        expect(flip.pos).toBe(1700);
        expect(flip.bHolds).toBe(1);
        expect(flip.back).toEqual({ side: "A", aName: "A면 곡", bName: "B면 곡" });
        // DRAGON 오토 리버스 — A면 끝에서 헤드가 반전해 SIDE B 재생
        await page.evaluate(() => {
            deckModelId = "dragon";
            mountDeck();
            deckInsertTape(window.__t2);
            document.getElementById("deckAutoRevLbl").dispatchEvent(new MouseEvent("click", { bubbles: true }));
            deckPlay();
        });
        await page.waitForFunction(() => deckMode === "play", null, { timeout: 8000, polling: 100 });
        await page.evaluate(() => {
            tapePos = tapeLenOf(deckTape) - 0.2;
            const t0 = performance.now() - 2000;
            ttLastTs = t0;
            for (let i = 1; i <= 20; i++) ttFrame(t0 + i * 60);
        });
        await page.waitForFunction(() =>
            deckTape.side === "B" && deckMode === "play" && deckSegPlaying && deckSegPlaying.name === "B면 곡",
            null, { timeout: 8000, polling: 100 });
        // TCD3014 녹음 헤드룸 — 셰이퍼가 유일하게 무포화(null)
        const hr = await page.evaluate(() => {
            const r = { dragonSat: !!(recSatShaper && recSatShaper.curve) };
            deckStopTransport();
            deckModelId = "tcd3014";
            mountDeck();
            r.tcdClean = !!(recSatShaper && recSatShaper.curve === null);
            return r;
        });
        expect(hr).toEqual({ dragonSat: true, tcdClean: true });
    });

    test("테이프 시킹: 길이 미상 blob 워크어라운드·동일 src 재시크·실측 자가 보정", async ({ page }) => {
        // MediaRecorder 산 webm은 duration이 Infinity라 시킹이 무시된다 — 워크어라운드 검증
        const inf = await page.evaluate(async () => {
            const ctx = new AudioContext();
            const dest = ctx.createMediaStreamDestination();
            const osc = ctx.createOscillator();
            osc.connect(dest);
            osc.start();
            const mr = new MediaRecorder(dest.stream);
            const chunks = [];
            mr.ondataavailable = (e) => chunks.push(e.data);
            const stopped = new Promise((r) => { mr.onstop = r; });
            mr.start();
            await new Promise((r) => setTimeout(r, 4200));
            mr.stop();
            await stopped;
            osc.stop();
            ctx.close();
            const url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 4.2, url, name: "webm", type: mr.mimeType });
            deckInsertTape(t.id);
            tapePos = 1.5;   // FF로 감아 둔 위치
            deckPlay();
            await new Promise((r) => setTimeout(r, 1600));
            return { finite: isFinite(audio.duration), ct: audio.currentTime, playing: !audio.paused };
        });
        expect(inf.finite, "duration 확정").toBe(true);
        expect(inf.ct, "감아 둔 위치부터").toBeGreaterThan(1.3);
        expect(inf.playing, "재생 중").toBe(true);
        // 같은 src 재시크 — 리로드 없이 위치 이동
        const reseek = await page.evaluate(async () => {
            deckStopTransport();
            tapePos = 3.0;
            deckPlay();
            await new Promise((r) => setTimeout(r, 700));
            return audio.currentTime;
        });
        expect(reseek).toBeGreaterThan(2.8);
        // 실측 자가 보정 — 선언 40초·실제 20초 blob은 ended에서 20초로 줄고 빈 구간이 이어진다
        const heal = await page.evaluate(async (b64) => {
            deckStopTransport();
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
            const t = newBlankTape(1800);
            tapeAddSegment(t, { start: 0, dur: 40, url, name: "잘린 녹음", type: "audio/wav" });
            deckInsertTape(t.id);
            tapePos = 0;
            deckPlay();
            await new Promise((r) => setTimeout(r, 700));
            audio.currentTime = 19.7;
            await new Promise((r) => setTimeout(r, 1200));
            return { dur: Math.round(deckTape.segments[0].dur), rolling: deckMode === "play" && !deckSegPlaying };
        }, makeWav(20).toString("base64"));
        expect(heal.dur, "실측으로 축소").toBe(20);
        expect(heal.rolling, "무음 루프 없이 빈 구간 롤").toBe(true);
        // 감기 5배 — 전 데크 60~90배속
        expect(await page.evaluate(() => Object.values(DECK_MODELS).every((m) => m.windRate >= 60))).toBe(true);
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
        // 케이스 메타에 생성일시 표기 (예: "7/17 01:23 생성")
        await expect(page.locator(".tapecase-item", { hasText: "보관함 테스트" }).locator(".tapecase-meta"))
            .toContainText(/\d{1,2}\/\d{1,2} \d{2}:\d{2} 생성/);
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
        await page.waitForFunction(() => !tapes.some((t) => t.label === "명반 모음"), null, { timeout: 10000 });
        expect(await page.evaluate(() => tapes.some((t) => t.label === "명반 모음")), "테이프 제거").toBe(false);
        await expect(page.locator("#recordingList .recording"), "녹음 목록 정리").toHaveCount(0);
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

    test("설명서에 선별 잔존 기기의 음색·동작 차이가 기록됨", async ({ page }) => {
        await page.goto("/manual.html");
        for (const name of ["T-2 FM Stereo Tuner", "MR-78", "Model 10B", "GE-5", "SE-9", "MC2105", "8B", "91E", "E-303", "MA2375", "DRAGON", "B215", "TCD 3014A", "CT-F1250", "W-990RX", "SL-1200MK2", "TD 124", "GARRARD", "Sondek LP12", "DT-540"]) {
            await expect(page.locator("body")).toContainText(name);
        }
    });

    test("잔존 진공관 DSP: 300B 싱글엔디드·8B 푸시풀·MA2375 유니티 커플드가 구별됨", async ({ page }) => {
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
            const nominalRms = (id) => {
                const size = 1024;
                const out = AMP_MODELS[id].out;
                const energy = Array.from({ length: size }, (_, i) => {
                    const y = api.sampleChain(id, .65 * Math.sin(2 * Math.PI * i / size)) * out;
                    return y * y;
                }).reduce((sum, value) => sum + value, 0);
                return Math.sqrt(energy / size);
            };
            const p300 = api.sample("300b", "power", .5);
            const n300 = api.sample("300b", "power", -.5);
            const pMa = api.sample("ma2375", "power", .5);
            const nMa = api.sample("ma2375", "power", -.5);
            return {
                asym300b: Math.abs(p300 + n300),
                asymMa2375: Math.abs(pMa + nMa),
                softSlopeHigh: api.sample("300b", "power", .95) - api.sample("300b", "power", .85),
                softSlopeLow: api.sample("300b", "power", .25) - api.sample("300b", "power", .15),
                p300: api.inspect("300b"),
                el34: api.inspect("el34"),
                ma2375: api.inspect("ma2375"),
                h300b: harmonics("300b"),
                hEl34: harmonics("el34"),
                hMa2375: harmonics("ma2375"),
                nominal300b: harmonics("300b", true, .65),
                nominalEl34: harmonics("el34", true, .65),
                nominalMa2375: harmonics("ma2375", true, .65),
                peak300b: harmonics("300b", true),
                peakEl34: harmonics("el34", true),
                peakMa2375: harmonics("ma2375", true),
                nominalRms: ["300b", "el34", "ma2375"].map(nominalRms),
                solidStateBypass: api.sampleChain("mc2105", .4),
            };
        });
        expect(dsp.asym300b).toBeGreaterThan(.015);
        expect(dsp.asymMa2375).toBeLessThan(.01);
        expect(dsp.h300b.h2).toBeGreaterThan(dsp.h300b.h3);
        expect(dsp.hEl34.h3).toBeGreaterThan(dsp.hEl34.h2);
        expect(dsp.hMa2375.h3).toBeGreaterThan(dsp.hMa2375.h2 * 5);
        expect(dsp.nominal300b.h2).toBeGreaterThan(dsp.nominal300b.h3);
        expect(dsp.nominal300b.thd).toBeGreaterThan(.012);
        expect(dsp.nominalEl34.thd).toBeGreaterThan(dsp.nominalMa2375.thd * 2);
        expect(dsp.peak300b.thd).toBeLessThan(.05);
        expect(dsp.peakEl34.thd).toBeLessThan(.06);
        expect(dsp.peakMa2375.thd).toBeLessThan(.005);
        expect(Math.max(...dsp.nominalRms) - Math.min(...dsp.nominalRms)).toBeLessThan(.035);
        expect(dsp.softSlopeHigh).toBeLessThan(dsp.softSlopeLow);
        expect(dsp.p300.dampingFactor).toBeLessThan(dsp.el34.dampingFactor);
        expect(dsp.el34.dampingFactor).toBeLessThan(dsp.ma2375.dampingFactor);
        expect(dsp.ma2375.sagRatio).toBeLessThan(dsp.el34.sagRatio);
        expect(dsp.p300.transformerBand[1]).toBeLessThan(dsp.ma2375.transformerBand[1]);
        expect(dsp.p300.speakerMemory.feedback).toBeGreaterThan(dsp.el34.speakerMemory.feedback);
        expect(dsp.el34.speakerMemory.feedback).toBeGreaterThan(dsp.ma2375.speakerMemory.feedback);
        expect(dsp.p300.speakerMemory.wet).toBeGreaterThan(.12);
        expect(dsp.ma2375.speakerMemory.wet).toBeLessThan(.02);
        expect(dsp.solidStateBypass).toBeCloseTo(.4, 6);
    });

    test("재생 중 잔존 앰프 5종 전환: Web Audio 회로 재설정 후에도 재생 유지", async ({ page }) => {
        await page.click("#tsRfHit");
        await page.locator("#kbsList .station").first().click();
        await page.waitForFunction(() => {
            const audio = document.getElementById("audioPlayer");
            return !audio.paused && audio.currentTime > 0.5;
        }, null, { timeout: 15000 });

        await page.click('button:has-text("오디오 구성")');
        for (const label of ["TR · MC2105", "EL34 · 8B TRIBUTE", "300B · 91E TRIBUTE", "TR · E-303 TRIBUTE", "KT88 · MA2375"]) {
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
        await page.click('button:has-text("YAMAHA GE-5 · 10밴드")');
        await page.keyboard.press("Escape");
        // 모달은 닫히며 호출 버튼으로 포커스를 복원한다. 그 비동기 정리가 끝난 뒤 슬라이더를
        // 포커스하지 않으면 느린 CI에서 ArrowUp이 설정 버튼으로 전달되는 경합이 생긴다.
        await expect(page.locator("#settingsOverlay")).toBeHidden();
        await page.locator("#eqHit0").focus();
        await expect(page.locator("#eqHit0")).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        const gain = await page.evaluate(() => JSON.parse(localStorage.getItem("fmRadio.eq")).gains.ge5[0]);
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
