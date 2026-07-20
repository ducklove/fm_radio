# 추가 음원 수집 소스

Mad for Audio의 배포 카탈로그에는 Public domain 또는 상업 이용이 허용된
CC BY·CC BY-SA·CC0 음원을 우선 수록한다. 자동 수집기는 NC·ND처럼 허용 목록 밖의
라이선스, 라이선스 누락, 파일 메타데이터 누락을 오류로 처리한다. **작곡, 녹음, 연주에
대한 권리**가 불명확하거나 침해가 명확한 파일은 넣지 않는다. 현재 Web Audio 구조상
원본 서버가 CORS를 허용해야 하며 직접 파일 URL이 장기간 유지되어야 한다.

이 선별은 Commons 파일 페이지에 표시된 라이선스를 기계적으로 검증하는 안전장치이지,
모든 국가와 이용 형태에서의 법률 판단은 아니다. 특히 카페·매장 같은 공개 또는 상업
공간에서는 운영자가 해당 지역의 저작권·공연권, 실연자·음반제작자의 인접권, CC BY와
CC BY-SA의 표시 의무 및 그 밖의 개별 조건을 최종 확인해야 한다.

## 현재 수록 현황

2026-07-20 기준 카탈로그는 **88장·515곡**이다. 아래 수치는 음반의 기본 장르 기준이며,
일부 트랙은 검색 정확도를 위해 보조 장르 태그도 가진다.

| 구분 | 음반 | 트랙 |
|---|---:|---:|
| 클래식 | 63장 | 327곡 |
| 재즈 | 5장 | 40곡 |
| 성악 | 7장 | 51곡 |
| 기타 장르 | 13장 | 97곡 |
| **합계** | **88장** | **515곡** |

기타 장르는 블루스·록·팝·일렉트로니카·펑크·레게·라틴·아프리칸·월드·디스코·
컨트리가 각 8곡, 스카 3곡, 앰비언트 6곡으로 구성된다. 재즈는 카페·라운지·스윙·
보사·역사 녹음을, 성악은 오페라 아리아·가곡·합창·Caruso 및 *Winterreise* 녹음을
포함한다.

음반 수납장에서는 장르, 분위기, 자유 검색어를 함께 적용한다. 장르와 분위기는 서로
교집합으로 좁혀지고, 검색어는 제목·아티스트·곡명·장르·분위기·태그를 찾는다. 무한
랜덤 재생은 결과 트랙으로 셔플백을 만들어 한 바퀴 안에서 중복 없이 재생한 뒤 다시
섞으며, 재생 오류가 난 파일은 건너뛴다.

## Commons 카탈로그 수집기

`scripts/collect-commons-catalog.mjs`가 장르 컬렉션을 재현 가능하게 생성한다. Commons
MediaWiki API의 `imageinfo`에서 원본 URL, MIME, 파일 크기, 저작자, 설명 페이지,
`LicenseShortName`을 읽고 다음 조건을 모두 만족하는 파일만 `records.json`에 반영한다.

- 라이선스가 CC BY, CC BY-SA, CC0, Public domain 중 하나일 것
- Commons 원본 파일 URL과 설명 페이지가 존재할 것
- 음반·트랙 ID가 안정적으로 생성되고 출처·라이선스·파일 형식·용량이 기록될 것
- 생성 레코드는 `commons-genres-2026-07` 컬렉션으로 구분되어 재실행 시 중복되지 않을 것

```bash
# Commons API를 다시 조회해 검증만 수행
node scripts/collect-commons-catalog.mjs

# 검증된 결과를 records.json에 기록
node scripts/collect-commons-catalog.mjs --write

# 보관한 mfa-info-*.json API 응답으로 오프라인 재현
node scripts/collect-commons-catalog.mjs --metadata-dir /tmp --write

# ID·스키마·라이선스 정책 검증
cd tests && npm run catalog
```

수집기가 통과시킨 뒤에도 배포 전에는 트랙별 `sourcePage`를 열어 저작자 표시 문구와
라이선스 링크를 재확인하고, 실제 재생으로 파일 내용·무음·손상·음량을 검수한다.

## 권장 순위

### 1. Wikimedia Commons — 바로 수록 가능

- 장점: 파일별 라이선스·저작자·원본 URL 제공, `upload.wikimedia.org`가 CORS 허용,
  Ogg/MP3/FLAC 지원, 현재 카탈로그 구조와 바로 호환된다.
- 수집: MediaWiki `categorymembers`/검색 API로 후보를 찾고 `imageinfo`의
  `url|mime|extmetadata`에서 파일 URL과 `LicenseShortName`, `LicenseUrl`, `Artist`를 확인한다.
- 공식 문서:
  - https://www.mediawiki.org/wiki/API:Categorymembers
  - https://www.mediawiki.org/wiki/API:Imageinfo
  - https://commons.wikimedia.org/wiki/Commons:Audio
- 주의: Commons에 있다는 사실만 믿지 말고 각 파일의 연주자·녹음 라이선스와
  표시 조건을 `credit`에 옮긴다. BY-SA는 표시와 동일조건변경허락 의무가 있다.

### 2. Internet Archive — 선별 수집 또는 자체 호스팅 후보

- 장점: Advanced Search와 item metadata API가 있고 API·파일 응답에 CORS `*`가
  확인된다. Great 78 Project에는 1900–1922년 자료가 대량으로 있으며 MP3/FLAC
  파생 파일을 제공한다.
- 공식 API 문서:
  - https://doc-tools.readthedocs.io/en/ia-test-gsod/item-search-apis.html
  - https://doc-tools.readthedocs.io/en/ia-test-gsod/metadata.html
- 주의: item의 `licenseurl`이 비어 있는 경우가 많다. 연도만으로 자동 수록하지 말고
  명시적 CC0/CC 라이선스 또는 신뢰할 수 있는 권리 문서가 있는 item만 사용한다.
  Musopen 컬렉션 일부는 CC0지만 오디오가 대용량 ZIP으로만 제공되어 직접 스트리밍에는
  부적합하며, 라이선스 확인 후 추출·변환·자체 호스팅하는 수집 파이프라인이 필요하다.

### 3. Library of Congress National Jukebox — 역사 음반용

- 규모: 전체 18,000여 녹음, 클래식 약 1,400건. JSON API가 MP3 derivative와
  녹음·연주자·연도·권리 필드를 제공한다.
- 공식 문서:
  - https://www.loc.gov/apis/json-and-yaml/responses/item-and-resource/
  - https://www.loc.gov/collections/national-jukebox/about-this-collection/rights-and-access/
- 사용 조건: 미국에서 1923년 이전에 발행된 녹음은 공개 도메인이지만, 이후 녹음은
  도서관의 스트리밍 허가일 뿐 재사용 허가가 아닐 수 있다. `rights_restricted: false`,
  발행 연도, 서비스 국가의 보호기간을 모두 확인한 자료만 후보로 삼는다.
- 성격: 현대적 하이파이보다 셸락·초기 전기녹음 질감이므로 별도 “역사 음반” 섹션에 적합하다.

### 4. Openverse — 발견용 인덱스

- API는 audio 검색, 라이선스·상업 이용·수정 허용·확장자 필터와 attribution 문자열을
  제공한다: https://api.openverse.org/
- Openverse는 원본 라이선스 상태를 보증하지 않으며 실제 파일 서버의 CORS도 제각각이다.
  따라서 직접 수록 소스가 아니라 후보 발견 → 원본 페이지 확인 → 가능하면 Commons
  미러 확인 순서로 사용한다.

### 5. Musopen / Open Music Archive — 수동 검토용

- Musopen: https://musopen.org/ — 클래식 녹음이 풍부하지만 다운로드 제한과 URL 안정성,
  녹음별 조건을 확인해야 한다. Commons에 적법하게 미러된 버전을 우선한다.
- Open Music Archive: https://www.openmusicarchive.org/ — Public Domain 또는 CC BY-SA
  자료를 제공하지만 영국 밖에서의 권리 상태가 달라질 수 있다고 자체 FAQ에서 경고한다.
  글로벌 서비스의 자동 수집원으로는 부적합하다.

## Commons에서 바로 검토할 수 있는 신규 레퍼토리

2026-07-14 MediaWiki API의 파일 메타데이터를 확인한 목록이다. 수록 완료 항목은 전체
악장 구성과 파일 메타데이터를 확인했으며, 미수록 후보는 음량·무음 구간을 추가 검사한다.

| 후보 | 확인된 라이선스 | 확장 방향 |
|---|---|---|
| Debussy, Première/Deuxième Arabesque — Patrizia Prati | CC BY-SA 4.0 | 카탈로그 수록 완료 |
| Debussy, Images I & II — Marcelle Meyer (1957) | Public domain | 카탈로그 수록 완료 · 16-bit/44.1 kHz FLAC |
| Ravel, Sonatine — Marcelle Meyer (1954) | Public domain | 카탈로그 수록 완료 · 16-bit/44.1 kHz FLAC |
| Ravel, Pavane pour une infante défunte — Thérèse Dussaut | CC BY-SA 2.0 | 라벨 피아노 작품 음반 |
| Liszt, Hungarian Rhapsody No. 2 | CC BY-SA 2.0 | 리스트 피아노 명곡 모음 |
| Mahler, Symphony No. 2 — DuPage Symphony Orchestra (2004) | CC0 | 카탈로그 수록 완료 · 48 kHz Ogg Vorbis |
| Rachmaninoff, Piano Concerto No. 2 — Richter/Wisłocki/Warsaw Philharmonic (1959) | Public domain | 카탈로그 수록 완료 · 16-bit/44.1 kHz FLAC |

## 수록 체크리스트

1. 작곡과 녹음·연주 권리를 각각 확인한다.
2. 배포 카탈로그에는 CC BY·CC BY-SA·CC0·Public domain처럼 상업 이용이 허용된 것으로 확인되는 파일만 넣고, `NC`·`ND`·라이선스 누락 파일은 제외한다.
3. 랜딩 페이지, 직접 파일 URL, 라이선스 URL, 연주자, 출처를 기록한다.
4. `HEAD` 또는 Range 요청으로 상태 코드, MIME, CORS, 파일 크기를 확인한다.
5. iOS Safari 지원을 위해 MIDI/Speex는 제외하고 MP3/Ogg/Opus/FLAC을 우선한다.
6. 전 트랙을 재생해 무음·손상·잘못된 작품·과도한 음량 차이를 검사한다.
7. 재킷 이미지도 별도의 공개 도메인/CC 조건을 확인한다.
8. 확인 가능한 연주자·녹음연도와 코덱·샘플레이트·비트 심도·채널·비트레이트·길이·파일 크기를 `records.json`에 기록한다.
9. `records.json`에 추가하고 `npm run catalog`, 스모크 테스트, 실기기 청취를 수행한다.
10. 카페·매장 등 공개 또는 상업 공간에서 사용할 운영자는 지역별 저작권·공연권, 실연자·음반제작자 인접권, 저작자 표시 의무를 별도로 확인한다.
