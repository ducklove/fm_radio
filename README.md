# Mad for Audio

진공관 앰프·명기 튜너·턴테이블·카세트 데크로 꾸민 **브라우저 하이파이 랙**.
KBS·MBC·CBS·SBS·EBS 등 한국 주요 FM 라디오를 한 화면에서 선국하고,
클래식·재즈·가요·기타 장르의 음반을 검색하거나 선택한 조건으로 계속 재생한다.
실물 랙(튜너·오디오 타이머·이퀄라이저·앰프·카세트 데크·턴테이블)을 SVG로 재현해
다이얼을 돌려 맞추고 테이프에 녹음하는 아날로그 경험을 그대로 옮겼다.

![Mad for Audio 하이파이 랙](docs/screenshots/desktop.png)

## 기능

- **유닛 전원 문법** — 실물처럼 기기를 각각 켜고 끈다: 앰프=스피커 관문, 튜너=수신, 데크=트랜스포트(EQ·턴테이블은 자체 전원). 기동은 파워스트립에 물린 실기처럼 **항상 전체 통전으로 시작**(전원 상태는 세션 한정)하고, **앰프는 어떤 경로도 자동 점화하지 않는 명시 조작 전용**이다. 채널 목록·미디어세션 같은 리모컨 경로는 튜너만 깨우며, 예약 녹음은 DT-540 스위치드 아웃렛이 튜너·데크를 깨운다. 첫 재생은 93.1 KBS 1FM, 이후 직전 채널 복원
- **선국** — 튜너 다이얼 드래그/노브 회전, 채널 목록, 즐겨찾기, 마지막 채널 복원
- **녹음** — 카세트 데크 메타포(C-30 테이프, 30분 단위 위치 기반), MediaRecorder + IndexedDB
- **편성표·예약 녹음** — 방송사 편성표(13채널)에서 원클릭 예약, 본체와 분리된 백그라운드 원본 비트스트림 캡처
- **오디오 타이머** — DT-540 랙 유닛: VFD 시계·다음 예약 표시, TIMER 스위치로 예약 전체 대기/중지, SLEEP 버튼
- **취침 타이머** — 튜너 IF MODE 스위치 또는 타이머 SLEEP 버튼으로 순환 설정
- **턴테이블·카세트** — 방송 외 매체 재생, 매체 우선권(음반이 도는 동안 튜너는 대기 선국)
- **93장·555곡 음반 카탈로그** — 클래식 72장·398곡, 재즈 6장·48곡, 가요 1장·2곡, 기타 14장·107곡. 성악은 클래식에 포함하고, 블루스·록·팝·일렉트로니카·레게·월드 등의 세부 장르는 기타에 모으되 검색용 태그로 남긴다
- **장르·검색어 검색** — 네 장르 중 하나를 고르고 제목·아티스트·곡명·태그를 함께 검색해 원하는 음원만 빠르게 좁힌다
- **카페용 무한 랜덤 재생** — 선택한 장르와 검색어에 맞는 트랙을 셔플백으로 섞어 한 바퀴 안에서는 중복 없이 재생하고, 끝나면 다시 섞어 계속 재생한다. 연결에 실패한 파일은 건너뛴다
- **공개 모델** — 튜너 3종, 이퀄라이저 3종, 앰프 5종, 카세트 데크 5종, 턴테이블 4종(선택 모델 총 20종) + 단일 오디오 타이머 DT-540
- **모델 정체성** — 공개 자료에서 확인되는 실물의 비례·재질·대표 조작을 기준으로 SVG를 구성하며, 8B TRIBUTE·91E TRIBUTE만 여러 시대의 설계 언어와 앱 기능을 결합한 창작 재해석이다
- **PWA** — 오프라인 앱 셸, 홈 화면 설치, 미디어 세션(잠금화면 컨트롤)
- **미니 플레이어 / 임베드** — `widget.html`(팝업·iframe), postMessage API 제공 (`embed.html` 문서 참고)
- **소개·설명서** — `manual.html`에 기기별 리뷰와 조작 안내 (헤더 '소개' 링크, 새 탭 — 재생 유지)
- **데스크톱 상주 앱** — 윈도우 트레이와 macOS 메뉴바(`tray/`, Electron — EQ·앰프 음색과 미터까지 완전 동작), macOS 경량 메뉴바(`macos/`, WKWebView — 네이티브 재생 전용)에 상주해 창을 닫아도 재생 유지 (아래 참고)

## 구조

```
index.html             본체 문서 셸
manual.html            소개·기기별 사용설명서 (헤더 '소개' 링크)
styles.css             CSS 진입점 — 아래 4개 계층을 기존 캐스케이드 순서로 로드
styles-foundation.css  전역 토큰·셸·랙·기기·반응형 기본 스타일
styles-library.css     음반 수납장·몰입/확대 보기 스타일
styles-schedule.css    편성표·예약 녹음 스타일
styles-tape.css        테이프 보관함·진단·인라인 편집 스타일
app-runtime-core.js    재생 상태·예약 계산·녹음 파일 포맷의 DOM 독립 ESM 코어
bootstrap.js           app-runtime-core 준비·records.json 검증·로딩 후 본체 실행
app.js                 선국·턴테이블·음반 수납장·화면 상태와 호환 facade
ui-controls.js         모달·탭·토글의 접근성·포커스 계약 정규화 계층
engine.js              Web Audio 그래프·녹음·오디오 상태 머신
animation-scheduler.js 랙 컴포넌트가 공유하는 상태 기반 rAF 스케줄러
deck.js                카세트 데크·테이프 전송 로직
skins.js               튜너·앰프 SVG 스킨
component-skins.js     실물 레퍼런스 기반 추가 튜너·앰프·데크·턴테이블 SVG 카탈로그
model-registry.js      기기 모델 탐색·렌더링 호환 레지스트리
store.js               설정·녹음 저장소
stations.js            채널 정의 + 스트림 URL 해석 (index/widget 공유)
player-core.js         재생 코어 — HLS/네이티브/파일 경로와 오류 복구 (index/widget 공유)
native-hls-capture.js  Safari/WKWebView 네이티브 HLS 세그먼트 캡처 (녹음용)
schedule.js            방송사별 편성 데이터를 공통 모델로 정규화 (편성표·예약)
records.json           음반 카탈로그 — 재킷·크레딧·트랙 메타데이터
scripts/collect-commons-catalog.mjs
                       Commons 메타데이터·라이선스 검증 및 장르 카탈로그 생성기
widget.html            미니 플레이어 (iframe/팝업용)
embed.html             위젯·임베드 사용 설명서
tray-bridge.js         트레이 iframe 메시지 검증·상태 브로드캐스트 ESM
sw.js                  서비스워커 — 앱 셸만 캐싱, 스트림은 통과
manifest.webmanifest   PWA 매니페스트
mbc-proxy.js           MBC·CBS·EBS·YTN 스트림/편성 해석용 개인 프록시 (Node, 선택)
mbc-proxy.service      위 프록시의 systemd 유닛
tray/                  트레이·메뉴바 앱 (Electron · Windows/macOS — 풀 DSP)
macos/                 macOS 경량 메뉴바 앱 (Swift · WKWebView — 네이티브 재생)
```

추가 컴포넌트의 사진 출처와 SVG에 반영한 외형 포인트는
[`docs/EQUIPMENT_REFERENCES.md`](docs/EQUIPMENT_REFERENCES.md)에 정리했다.

### 채널 추가 방법

`stations.js`의 `stations` 배열에 항목 1개를 추가하면 끝난다.
그룹 섹션·채널 수·다이얼 마커는 모두 이 배열에서 자동 생성된다.

```js
{ id: "myfm", freq: 101.3, name: "새 FM", desc: "설명", group: "etc",
  color: "#7d5b78", type: "direct", streamUrl: "https://.../playlist.m3u8" }
```

- `type: "direct"` — `streamUrl`의 HLS를 바로 재생
- `type: "kbs-api" | "sbs-api" | "mbc-api"` — `apiUrl`에서 실제 스트림 URL을 해석

### MBC 프록시

MBC는 스트림 URL 발급에 서버 측 호출이 필요해 개인 프록시(`mbc-proxy.js`)를 둔다.
프록시가 죽으면 MBC 채널만 연결 실패하고 나머지는 영향 없다.

### 음반 추가 방법

`records.json` 배열에 음반 객체를 추가한다. `tracks[].f`와 `cover`는
`https://upload.wikimedia.org/wikipedia/commons/` 뒤에 붙는 경로이며,
Web Audio의 EQ·앰프 처리를 위해 CORS가 허용된 음원만 사용할 수 있다.
각 음반에는 출처와 라이선스를 확인할 수 있는 `credit`을 반드시 기록한다.
후보 저장소와 권리·CORS 검수 절차는 `docs/AUDIO_SOURCES.md`에 정리했다.
진공관 앰프의 배음·클리핑·전원 새그·출력 트랜스·댐핑 구현 근거와 모델별 값은
`docs/TUBE_AMP_MODEL.md`에 정리했다.

확인 가능한 경우 음반 객체에 `recordingYear`와 `source.provider`/`source.license`를,
각 트랙에 `quality`와 `sourcePage`를 기록한다. `quality`는 `format`, `lossless`,
`sampleRate`, `bitDepth`, `channels`, `bitrateKbps`, `durationSeconds`, `bytes`를
사용하며, 출처가 제공하지 않는 값은 추정해서 채우지 않는다. 한 음반 안에서 연주자나
녹음연도가 달라질 때만 트랙의 `performer`/`recordingYear`로 덮어쓴다.

Wikimedia Commons 장르 컬렉션은 수동으로 JSON을 복사하지 않고 수집기로 갱신한다.
수집기는 Commons `imageinfo`를 다시 조회해 파일 URL·저작자·용량·라이선스를 가져오고,
상업 이용이 가능한 CC BY·CC BY-SA·CC0·Public domain 파일만 통과시킨다.

```bash
# 온라인 메타데이터로 검증만 수행
node scripts/collect-commons-catalog.mjs

# 검증 결과를 records.json에 반영
node scripts/collect-commons-catalog.mjs --write

# 저장해 둔 mfa-info-*.json 응답으로 재현 가능한 오프라인 갱신
node scripts/collect-commons-catalog.mjs --metadata-dir /tmp --write

cd tests && npm run catalog
```

카페 등 상업 공간에서 재생할 때도 운영자가 트랙별 `sourcePage`와 라이선스 원문을
확인하고 필요한 저작자 표시를 제공해야 한다. 앱의 선별은 파일에 표시된 이용허락을
검증하는 단계이며, 영업 지역의 저작권법과 공연권, 실연자·음반제작자의 인접권까지
자동으로 해결하거나 법적 이용 가능성을 보증하지 않는다.

배포 전 `python3 bump-version.py`를 실행하면 JSON·JS·CSS와 서비스워커의
캐시 버전이 함께 올라간다.

## 트레이·메뉴바 앱 (Electron · Windows/macOS)

시스템 트레이(Windows)·메뉴바(macOS)에 상주하며 라디오를 재생하는 Electron 앱.
크로미엄 엔진이라 **EQ·진공관 앰프 음색과 파워미터·스펙트럼 계기가 데스크톱에서 완전 동작**한다.
하나의 창 안에서
세 보기를 오간다 — **튜너형**(로컬 `widget.html` 미니 플레이어),
**턴테이블형**(로컬 `turntable.html` — 음반 카탈로그에서 골라 트랙 재생),
**오디오 시스템**(배포판 전체 하이파이 랙 `index.html`). 모두 트레이 옆 창이며,
랙의 '⛶ 전체 화면' 버튼을 누르면 진짜 전체 화면(몰입 모드 — 랙 전체가 스크롤 없이
화면 높이에 맞게 스케일되고 장식 스피커가 양옆에 선다)이 된다. 각 보기의
postMessage API(`fmRadio:*`)를 IPC로 중계해 트레이 메뉴와 연결한다.

- **트레이 좌클릭** — 플레이어 표시/숨김. 재생 중에 닫으면(어느 보기든) 곡명(채널명)·재생/정지만 남긴 슬림 바로 축소되어 **작업표시줄 안(트레이 왼쪽)에 도킹**된다(오디오는 계속 재생)
- **트레이 우클릭** — 재생/일시정지, 보기 전환(튜너형·오디오 시스템), 채널 선택, 볼륨, 로그인 시 자동 시작, 시작할 때 바로 재생
- 튜너형의 '오디오 시스템 ↗', 랙의 '미니 플레이어'로 창 안에서 서로 전환
- 마지막 채널·볼륨을 저장해 다시 켤 때 복원한다

macOS에서는 트레이 문법이 메뉴바에 맞게 바뀐다 — 독·Cmd+Tab에서 숨고(📻 메뉴바 아이템),
재생 중에는 메뉴바에 채널명 스트립이 붙는다. 패널은 포커스를 잃어도 떠 있어(플로팅)
다른 작업을 하며 미터를 볼 수 있고, 슬림 바 대신 메뉴바 스트립이 나우플레잉을 대신한다.

```bash
cd tray
npm install
npm start          # 개발 실행 (양 플랫폼)
npm run dist       # dist/에 Windows 포터블 exe 빌드
npm run dist:mac   # dist/에 macOS .app(zip) 빌드
```

## macOS 경량 메뉴바 앱 (WKWebView)

메뉴바에 상주하는 하이파이 랙(`macos/`, Swift·WKWebView 단일 파일). 아이콘을 누르면
드래그로 옮길 수 있는 플로팅 패널로 랙이 열리고, 패널을 닫아도 웹뷰가 살아 있어 재생이
계속된다. 메뉴바에는 재생/정지·채널(곡)명 스트립이 상주한다. 웹뷰가 WebKit이라 재생은
전부 네이티브 직결이며 **EQ·앰프 음색과 신호 반응 계기는 동작하지 않는다**(조작·표시·영속만) —
음색·미터까지 원하면 위의 Electron 메뉴바 앱을 쓴다. 대신 앱이 몇 MB로 가볍고 배터리
효율이 좋아 장시간 청취용이다. 자세한 조작과 빌드는 [`macos/README.md`](macos/README.md) 참고.

```bash
cd macos
./build.sh                              # Xcode Command Line Tools만 있으면 됨
cp -R "Mad for Audio.app" /Applications/
open "/Applications/Mad for Audio.app"
```

## 개발·배포

정적 파일뿐이므로 아무 정적 서버로 열면 된다:

```bash
npx http-server -p 8080        # http://127.0.0.1:8080
```

배포는 정적 호스팅(GitHub Pages 등)에 저장소 루트를 그대로 올리면 된다.
서비스워커 캐시 키(`sw.js`의 `CACHE`)는 셸 자산이 바뀔 때 버전을 올린다.
`index.html`의 `og:url`/`og:image`는 GitHub Pages 주소를 절대 URL로 박아두었으니
커스텀 도메인에 배포한다면 함께 바꿔 준다.

푸시마다 GitHub Actions(`.github/workflows/test.yml`)가 스모크 테스트를 돌린다.

## 테스트

```bash
cd tests
npm install
npx playwright install chromium   # 최초 1회
npm test
```

Playwright 스모크 테스트가 렌더링·선국·재생(모의 HLS)·키보드 조작·검색·
미니 플레이어·모바일 뷰포트를 검증한다. 외부 의존(CDN·방송사 API·스트림)은
전부 모킹되므로 오프라인에서도 돌고, 실제 방송 연결 여부는 환경에 좌우되므로
테스트하지 않는다.

실제 방송 스트림이 살아 있는지는 로컬에서 따로 점검한다:

```bash
cd tests && npm run live
```

## 저작권

방송 스트림의 저작권은 각 방송사에 있다. 앱으로 만든 라디오 녹음 파일은 개인 감상
용도로만 사용할 것.
음반 카탈로그의 신규 Commons 컬렉션은 CC BY·CC BY-SA·CC0·Public domain처럼
상업 이용을 허용하는 것으로 표시된 파일만 수록하지만, CC BY/BY-SA의 저작자 표시와
BY-SA의 동일조건변경허락 등 개별 조건은 그대로 적용된다. 카페·매장 등 공개 또는
상업 공간의 운영자는 서비스 지역의 저작권·공연권과 실연자·음반제작자 인접권,
필요한 표시 방식을 직접 확인해야 한다.
