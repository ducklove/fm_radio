# FM 라디오 모음

KBS·MBC·CBS·SBS·EBS 등 한국 주요 FM 라디오를 한 화면에서 듣는 웹 앱.
실물 하이파이 랙(튜너·오디오 타이머·이퀄라이저·앰프·카세트 데크·턴테이블)을 SVG로 재현해,
다이얼을 돌려 선국하고 테이프에 녹음하는 아날로그 경험을 그대로 옮겼다.

![하이파이 랙 데스크톱 화면](docs/screenshots/desktop.png)

## 기능

- **선국** — 튜너 다이얼 드래그/노브 회전, 채널 목록, 즐겨찾기, 마지막 채널 복원
- **녹음** — 카세트 데크 메타포(C-30 테이프, 30분 단위 위치 기반), MediaRecorder + IndexedDB
- **편성표·예약 녹음** — 방송사 편성표(13채널)에서 원클릭 예약, 본체와 분리된 백그라운드 원본 비트스트림 캡처
- **오디오 타이머** — DT-540 랙 유닛: VFD 시계·다음 예약 표시, TIMER 스위치로 예약 전체 대기/중지, SLEEP 버튼
- **취침 타이머** — 튜너 IF MODE 스위치 또는 타이머 SLEEP 버튼으로 순환 설정
- **턴테이블·카세트** — 방송 외 매체 재생, 매체 우선권(음반이 도는 동안 튜너는 대기 선국)
- **공개 모델** — 튜너 3종, 이퀄라이저 2종, 앰프 5종, 카세트 데크 5종, 턴테이블 4종(선택 모델 총 19종) + 단일 오디오 타이머 DT-540
- **모델 정체성** — 공개 자료에서 확인되는 실물의 비례·재질·대표 조작을 기준으로 SVG를 구성하며, 8B TRIBUTE·91E TRIBUTE·E-303 TRIBUTE만 여러 시대의 설계 언어와 앱 기능을 결합한 창작 재해석이다
- **PWA** — 오프라인 앱 셸, 홈 화면 설치, 미디어 세션(잠금화면 컨트롤)
- **미니 플레이어 / 임베드** — `widget.html`(팝업·iframe), postMessage API 제공 (`embed.html` 문서 참고)
- **윈도우 트레이 앱** — `tray/`(Electron), 시스템 트레이 상주 재생 (아래 참고)

## 구조

```
index.html          본체 문서 셸
styles.css         공통 레이아웃·반응형·기기 UI 스타일
app.js              선국·턴테이블·음반 수납장·화면 상태
engine.js           Web Audio 그래프·녹음·오디오 상태 머신
deck.js             카세트 데크·테이프 전송 로직
skins.js            튜너·앰프 SVG 스킨
component-skins.js  실물 레퍼런스 기반 추가 튜너·앰프·데크·턴테이블 SVG 카탈로그
store.js            설정·녹음 저장소
stations.js         채널 정의 + 스트림 URL 해석 (index/widget 공유)
player-core.js      재생 코어 — HLS/네이티브/파일 경로와 오류 복구 (index/widget 공유)
records.json        음반 카탈로그 — 재킷·크레딧·트랙 메타데이터
bootstrap.js        records.json 검증·로딩 후 본체 실행
widget.html         미니 플레이어 (iframe/팝업용)
embed.html          위젯·임베드 사용 설명서
sw.js               서비스워커 — 앱 셸만 캐싱, 스트림은 통과
manifest.webmanifest PWA 매니페스트
mbc-proxy.js        MBC 스트림 URL 해석용 개인 프록시 (Node, 선택)
mbc-proxy.service   위 프록시의 systemd 유닛
tray/               윈도우 시스템 트레이 앱 (Electron)
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

배포 전 `python3 bump-version.py`를 실행하면 JSON·JS·CSS와 서비스워커의
캐시 버전이 함께 올라간다.

## 윈도우 트레이 앱

시스템 트레이에 상주하며 라디오를 재생하는 Electron 앱. 하나의 창 안에서
두 보기를 오간다 — **튜너형**(로컬 `widget.html` 미니 플레이어)과
**오디오 시스템**(배포판 전체 하이파이 랙 `index.html`). 둘 다 트레이 옆 창이며,
랙의 '⛶ 전체 화면' 버튼을 누르면 진짜 전체 화면(몰입 모드 — 랙 전체가 스크롤 없이
화면 높이에 맞게 스케일되고 장식 스피커가 양옆에 선다)이 된다. 각 보기의
postMessage API(`fmRadio:*`)를 IPC로 중계해 트레이 메뉴와 연결한다.

- **트레이 좌클릭** — 플레이어 표시/숨김. 재생 중에 닫으면(어느 보기든) 곡명(채널명)·재생/정지만 남긴 슬림 바로 축소되어 **작업표시줄 안(트레이 왼쪽)에 도킹**된다(오디오는 계속 재생)
- **트레이 우클릭** — 재생/일시정지, 보기 전환(튜너형·오디오 시스템), 채널 선택, 볼륨, 로그인 시 자동 시작, 시작할 때 바로 재생
- 튜너형의 '오디오 시스템 ↗', 랙의 '미니 플레이어'로 창 안에서 서로 전환
- 마지막 채널·볼륨을 저장해 다시 켤 때 복원한다

```bash
cd tray
npm install
npm start          # 개발 실행
npm run dist       # dist/에 포터블 exe 빌드
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

방송 스트림의 저작권은 각 방송사에 있다. 녹음 파일은 개인 감상 용도로만 사용할 것.
