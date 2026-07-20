# 하이파이 컴포넌트 SVG 레퍼런스 — v136

현재 공개 카탈로그 20종과 단일 타이머 DT-540의 외형·조작 근거다. 사진과 설명서는
비례, 재질, 계기와 대표 조작을 확인하는 용도로만 사용하며 원본 이미지를 배포 파일에
포함하거나 벡터 트레이싱하지 않는다. 외부 자료의 공개 상태와 주소는 제공처에 따라 바뀔 수 있다.

8B TRIBUTE·91E TRIBUTE는 아래 자료에서 시대와 설계 언어를 참고한 **창작 재해석**이다.
E-303 TRIBUTE를 포함해 실명을 쓰는 모델은 공개 사진과 설명서에서 확인되는 전면 구획,
부품 종류와 재질을 우선하고, 앱 기능에 필요한 최소한의 변형만 허용한다.

## 튜너 3종

| 공개 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| Yamaha T-2 | [HiFi Engine · 설명서/사양](https://www.hifiengine.com/manual_library/yamaha/t-2.shtml) | 70mm급 슬림 패널, 긴 아날로그 다이얼, 녹색 조명, 트윈 미터와 일렬 스위치 |
| McIntosh MR78 | [McIntosh Compendium · MR78 자료](https://www.mcintoshcompendium.com/Compendium%20Docs/Tuners/PDFs/MR78.pdf), [1977 Audio 실기 리뷰](http://www.gammaelectronics.xyz/audio_02-1977_mac.html) | 블랙 글라스, 균일한 블루 다이얼, FUNCTION/MULTIPATH·SIGNAL/TUNING 미터, PANLOC 형상과 NORMAL/NARROW/SUPER NARROW 선택도. **전원은 별도 스위치 없이 VOLUME 노브 통합**(반시계 끝 = OFF) — 리뷰에서 확인, 앱도 동일 문법 |
| Marantz Model 10B | [10B 사용 설명서](https://dadaelectronics.com.au/doc/Audio/Marantz/10B/Marantz_10B_Instruction_Manual.pdf) | 샴페인 골드, 세리프 레전드, CRT 튜닝 스코프와 롱 다이얼. **전원은 OFF·ON·DIM 3위치**(DIM = 패널 조명 감광) — 설명서 확인, 앱은 3위치 순환으로 재현 |

## 그래픽 이퀄라이저 3종

| 공개 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| Yamaha GE-5 | [HiFi Engine · 설명서/사양](https://www.hifiengine.com/manual_library/yamaha/ge-5.shtml) | 30Hz–16kHz 10밴드, ±10dB 눈금, 낮은 블랙 패널과 레벨 미터 |
| Sansui SE-9 | [HiFi Engine · 설명서/사양](https://www.hifiengine.com/manual_library/sansui/se-9.shtml) | 컴퓨터 제어형 키 뱅크, 분석 표시, 메모리 조작과 슬라이더 배열 |
| Technics SH-8065 | [audio-database 사양](https://audio-database.com/TechnicsPanasonic/etc/sh-8065.html), [HiFi Engine · 설명서](https://www.hifiengine.com/manual_library/technics/sh-8065.shtml) | 실버 브러시드 알루미늄, 좌·우 2단 33밴드(⅓옥타브 16Hz–25kHz) 슬라이더, ±12/±3 레인지 스위치, NORMAL/INVERSE 특성 스위치, 입력 감도(150mV/1V) |

SH-8065는 채널당 33밴드 슬라이더가 전부인 순수 그래픽 EQ이며 스펙트럼 아날라이저가 없다.
아날라이저·핑크노이즈·오토EQ는 12밴드 형제 모델 SH-8066의 기능이므로 SH-8065에는 넣지 않는다.
앱의 실시간 커브 라인은 슬라이더 위치를 잇는 표시일 뿐, 실기의 자동 측정 기능이 아니다.

앱의 SE-9 팩토리 커브 10종, 메모리 A–D와 A/B 비교는 실물 전면 문법을 앱의 소스별
프리셋 워크플로에 맞게 구현한 기능이다. 실물의 자동 룸 분석을 그대로 복제한 것은 아니다.

## 앰프 5종

| 공개 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| McIntosh MC2105 | [McIntosh 공식 레거시 페이지](https://www.mcintoshlabs.com/legacy-products/amplifiers/MC2105) | 블랙 글라스, 듀얼 블루 POWER OUTPUT 미터, 중앙 녹색 로고, 좌우 랙 핸들 |
| 8B TRIBUTE | [Marantz 8B 자료](https://www.hifiengine.com/manual_library/marantz/8b.shtml) | EL34 푸시풀 시대의 샴페인 섀시와 관 배열을 출발점으로 스모크 갤러리·바이어스 미터를 재구성 |
| 91E TRIBUTE | [Western Electric 91E 공식 페이지](https://www.westernelectric.com/91e) | 300B 싱글엔디드, 아이보리·다크 대비와 벌룬관을 출발점으로 정류관 지연과 단일 미터를 재구성 |
| E-303 TRIBUTE | [Accuphase E-303 사진 자료](https://www.hifido.co.jp/sold/23-41462-27564-00.html?LNG=E), [VintageChief 전면 사진](https://www.vintagechief.com/accuphase-e-303-amplifier-20919) | 밝은 실버·옅은 샴페인 패널, 독립 듀얼 미터, 소형 SPEAKERS/MC LOAD/HEAD AMP 버튼군, LOUDNESS·BASS·TREBLE, 대형 VOLUME과 얇은 BALANCE 레버 |
| McIntosh MA2375 | [McIntosh 공식 제품 페이지](https://www.mcintoshlabs.com/products/integrated-amplifiers/MA2375), [제품 소개 사진](https://www.ecoustics.com/products/mcintosh-ma2375-tube-integrated-amplifier/) | 넓은 블랙글라스 상부, 듀얼 블루 미터, 중앙 표시창, KT88 크롬 케이지 4개, 직선형 스테인리스 하부와 5밴드 톤 |

## 카세트 데크 5종

| 공개 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| Nakamichi Dragon | [Dragon 사용 설명서](https://www.richardhess.com/manuals/Nakamichi/nakamichi_Dragon_ops.pdf), [Wikimedia Commons 전면 사진](https://commons.wikimedia.org/wiki/File:Nakamichi_Dragon_-_High_End_Cassette_Deck_with_Auto_Reverse.jpg) | 좌측 POWER/TIMER/EJECT와 방향·Auto Azimuth 표시가 있는 작은 카세트 도어, 중앙 4자리 카운터·세로 L/R 미터, 4행 트랜스포트/캘리브레이션 매트릭스, 우측 레벨 노브·필터 열 |
| Revox B215 | [Revox 공식](https://revox.com/us/classic/classic-products/173/b215-cassette-deck?c=230), [Wikimedia Commons · CC0](https://commons.wikimedia.org/wiki/File:Revox_B215_cassette_deck.jpg) | 중앙 오픈 트랜스포트, 좌측 모듈 키패드, 녹색 디지털 표시, 스튜디오형 블랙 패널 |
| Tandberg TCD 3014A | [HiFi Wiki](https://hifi-wiki.com/index.php/Tandberg_TCD_3014_A) | 오픈 트랜스포트, 우드 케이스, 대형 조정 노브와 웜 아날로그 미터 |
| Pioneer CT-F1250 | [Pioneer 사용 설명서](https://akdatabase.com/AKview/albums/userpics/10004/Pioneer%20CTF1250%20Owners.pdf) | 월넛 케이스, 헤어라인 실버, 플렉시 도어, 블루 카운터와 플루로스캔 미터 |
| TEAC W-990RX | [HiFi Wiki](https://hifi-wiki.com/index.php/Teac_W-990_RX) | 좌우 더블 웰, 중앙 제어부, 독립 A/B 트랜스포트와 고속 더빙 문법 |

W-990RX의 투명 릴 창 길이와 좌우 카세트 중심은 실물 사진에서 보이는 대칭 관계를 우선해
맞췄다. 앱에서는 A웰 재생과 B웰 녹음을 분리해 예약 녹음 중 동시 재생이라는 고유 기능을
추가했다.

## 턴테이블 4종

| 공개 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| Technics SL-1200MK2 | [Technics 공식 50주년 아카이브](https://www.technics.com/global/home/sl1200/50th-anniversary.html) | 실버 다이캐스트 베이스, 플래터 스트로브 도트, 우측 피치 슬라이더, 좌측 시작 버튼 |
| Thorens TD 124 | [Thorens 공식 역사](https://www.thorens.com/en/history.html) | 우드 플린스, 아이보리 모터보드, 별도 4단 속도 선택부와 계측기풍 인쇄 |
| Garrard 301 | [Garrard 공식 Heritage](https://www.garrardturntables.co.uk/heritage/) | 크림 모터 유닛, 묵직한 우드 플린스, 속도 미세 조정과 브레이크 레버, 필기체 배지 |
| Linn Sondek LP12 | [Linn 공식 역사](https://radio.linn.co.uk/about/our-story) | 미니멀한 검정 상판, 두꺼운 목재 플린스, 작은 전원 버튼과 절제된 서스펜디드 구조 |

## 단일 오디오 타이머

| 모델 | 사진·자료 | SVG에 반영한 식별 포인트 |
|---|---|---|
| Pioneer DT-540 | [HiFi Engine](https://www.hifiengine.com/manual_library/pioneer/dt-540.shtml), [SpenCertified 사진](https://spencertified.com/products/pioneer-dt-540-audio-digital-timer-1983-85) | 420×52mm급 초슬림 실버 패널, 중앙 VFD 시계, 우측 PROGRAM·SLEEP 버튼과 TIMER 스위치 문법 |

## 구현 원칙

- 공개 모델 표에는 현재 설정 화면에서 선택 가능한 20종만 싣는다. DT-540은 단일 고정 유닛이다.
- 퇴역 ID는 저장값 마이그레이션 대상일 뿐 현재 모델 설명이나 사진 표에 포함하지 않는다.
- 상표와 모델명은 기기 식별을 위한 설명적 표기로 사용한다.
- 기존 재생 기능이 의존하는 SVG ID는 공개 스킨에서 같은 역할을 유지한다.
- 금속 그라데이션, 인셋 섀도, 눈금, 노브 리지는 작은 화면에서도 구조를 해치지 않도록 벡터로 구성한다.
