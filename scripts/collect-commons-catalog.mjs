#!/usr/bin/env node

// Wikimedia Commons의 파일별 라이선스를 확인해 records.json의 장르 카탈로그를 갱신한다.
// 기본값은 API 재조회, 개발 중 저장한 응답을 재사용하려면:
//   node scripts/collect-commons-catalog.mjs --metadata-dir /tmp --write

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "records.json");
const write = process.argv.includes("--write");
const metadataArg = process.argv.indexOf("--metadata-dir");
const metadataDir = metadataArg >= 0 ? process.argv[metadataArg + 1] : null;
const collection = "commons-genres-2026-07";

const groups = [
    {
        id: "commons-jazz-cafe", title: "재즈 카페 셀렉션", genre: "재즈",
        moods: ["카페", "세련된", "편안한"], color: ["#d8c9aa", "#263238", "#b66a3c"],
        files: [
            "File:Acid Trumpet (ISRC USUAN1100339).mp3",
            "File:Airport Lounge (ISRC USUAN1100806).mp3",
            "File:Apero Hour (ISRC USUAN1700070).mp3",
            "File:As I Figure (ISRC USUAN1100323).mp3",
            "File:Awesome Call (ISRC USUAN1100317).mp3",
            "File:Backbay Lounge (ISRC USUAN1700068).mp3",
            "File:Bass Soli (ISRC USUAN1100309).mp3",
            "File:Bossa Antigua (ISRC USUAN1700069).mp3"
        ]
    },
    {
        id: "commons-jazz-lounge", title: "재즈 라운지 애프터눈", genre: "재즈",
        moods: ["카페", "조용한", "세련된"], color: ["#d9cfbd", "#253039", "#b88c5a"],
        files: [
            "File:Smooth Lovin (ISRC USUAN1700077).mp3",
            "File:Deuces (ISRC USUAN1700075).mp3",
            "File:Jazz Brunch (ISRC USUAN1700074).mp3",
            "File:Zazie (ISRC USUAN1700062).mp3",
            "File:Lobby Time (ISRC USUAN1600054).mp3",
            "File:Spy Glass (ISRC USUAN1500058).mp3",
            "File:Hep Cats (ISRC USUAN1500022).mp3",
            "File:Ultralounge (ISRC USUAN1500017).mp3"
        ]
    },
    {
        id: "commons-jazz-swing-bossa", title: "스윙·보사·비밥", genre: "재즈",
        moods: ["리드미컬", "밝은", "카페"], color: ["#e0d4b5", "#333028", "#c0793e"],
        files: [
            "File:Samba Isobel (ISRC USUAN1700071).mp3",
            "File:Modern Jazz Samba (ISRC USUAN1100153).mp3",
            "File:In Your Arms (ISRC USUAN1500042).mp3",
            "File:George Street Shuffle (ISRC USUAN1300035).mp3",
            "File:Dances and Dames (ISRC USUAN1100595).mp3",
            "File:No Good Layabout (ISRC USUAN1100131).mp3",
            "File:Off to Osaka (ISRC USUAN1100128).mp3",
            "File:Dispersion Relation (ISRC USUAN1100258).mp3"
        ]
    },
    {
        id: "commons-jazz-archive", title: "재즈 아카이브 1919–1935", genre: "재즈",
        moods: ["빈티지", "그루브", "차분한"], color: ["#ded1b5", "#352b25", "#93603e"],
        performer: "Historic jazz ensembles", composer: "Various composers", playbackGain: 1.45,
        tags: ["스윙", "딕시랜드", "역사 재즈"],
        files: [
            "File:Hmv-k8176-oa86211.ogg",
            "File:Hmv-sg315-oa98197.ogg",
            "File:Art Hickman's \"Rose Room\" (1919).oga",
            "File:Jazzin' Babies Blues - Richard M Jones (1923).mp3",
            "File:Panama - New Orleans Rhythm Kings (1922).mp3",
            "File:LOUIS DUMAINE'S JAZZOLA EIGHT - FRANKLIN STREET BLUES - VICTOR 20580.oga",
            "File:Meacham's \"American Patrol\", performed by Glenn Miller.oga",
            "File:PhilHarrisOrch-TheVamp1932.ogg"
        ]
    },
    {
        id: "commons-blues-groove", title: "블루스 그루브", genre: "블루스",
        moods: ["그루브", "빈티지", "차분한"], color: ["#d4d7de", "#202838", "#5574a6"],
        files: [
            "File:DD Groove (ISRC USUAN1100492).mp3",
            "File:Dirt Rhodes (ISRC USUAN1100542).mp3",
            "File:Hustle (ISRC USUAN1100793).mp3",
            "File:Matt's Blues (ISRC USUAN1100165).mp3",
            "File:Nile's Blues (ISRC USUAN1100610).mp3",
            "File:OctoBlues (ISRC USUAN1500083).mp3",
            "File:Porch Blues (ISRC USUAN1100108).mp3",
            "File:Slow Burn (ISRC USUAN1100609).mp3"
        ]
    },
    {
        id: "commons-rock-drive", title: "록 드라이브", genre: "록",
        moods: ["신나는", "강렬한", "활기찬"], color: ["#dfd8ce", "#301f24", "#b8473f"],
        files: [
            "File:Aitech (ISRC USUAN1100336).mp3",
            "File:Beach Bum (ISRC USUAN1100347).mp3",
            "File:Bet You Can (ISRC USUAN1200018).mp3",
            "File:Big Rock (ISRC USUAN1100305).mp3",
            "File:Breakdown (ISRC USUAN1100796).mp3",
            "File:Broken Reality (ISRC USUAN1400010).mp3",
            "File:Chipper (ISRC USUAN1100295).mp3",
            "File:Cool Hard Facts (ISRC USUAN1100280).mp3"
        ]
    },
    {
        id: "commons-pop-sunshine", title: "팝 선샤인", genre: "팝",
        moods: ["밝은", "신나는", "가벼운"], color: ["#f0ddc2", "#3a3054", "#d78445"],
        files: [
            "File:Android Sock Hop (ISRC USUAN1700060).mp3",
            "File:Basic Implosion (ISRC USUAN1600032).mp3",
            "File:Blown Away (ISRC USUAN1200100).mp3",
            "File:Bummin on Tremelo (ISRC USUAN1700032).mp3",
            "File:Clear Air (ISRC USUAN1100626).mp3",
            "File:Happy Alley (ISRC USUAN1100482).mp3",
            "File:Life of Riley (ISRC USUAN1400054).mp3",
            "File:Poofy Reel (ISRC USUAN1100003).mp3"
        ]
    },
    {
        id: "commons-electronica-focus", title: "일렉트로니카 포커스", genre: "일렉트로니카",
        moods: ["집중", "몽환적인", "리드미컬"], color: ["#d7e5e4", "#162f39", "#3c9a9a"],
        files: [
            "File:Airship Serenity (ISRC USUAN1600046).mp3",
            "File:Ambler (ISRC USUAN1300019).mp3",
            "File:Babylon (ISRC USUAN1100314).mp3",
            "File:Balloon Game (ISRC USUAN1700063).mp3",
            "File:Basement Floor (ISRC USUAN1100538).mp3",
            "File:Bit Quest (ISRC USUAN1500073).mp3",
            "File:Bit Shift (ISRC USUAN1600045).mp3",
            "File:Blip Stream (ISRC USUAN1500056).mp3"
        ]
    },
    {
        id: "commons-funk-party", title: "펑크 파티", genre: "펑크",
        moods: ["그루브", "신나는", "활기찬"], color: ["#ead9a9", "#3b2838", "#c99724"],
        files: [
            "File:Aces High (ISRC USUAN1100763).mp3",
            "File:C-Funk (ISRC USUAN1100001).mp3",
            "File:Chill Wave (ISRC USUAN1600048).mp3",
            "File:District Four (ISRC USUAN1600039).mp3",
            "File:Enter the Party (ISRC USUAN1100240).mp3",
            "File:Flutey Funk (ISRC USUAN1100519).mp3",
            "File:Fork and Spoon (ISRC USUAN1100226).mp3",
            "File:Funk Game Loop (ISRC USUAN1100839).mp3"
        ]
    },
    {
        id: "commons-reggae-island", title: "레게 아일랜드", genre: "레게",
        moods: ["여유로운", "밝은", "리드미컬"], color: ["#e8dfba", "#263b2b", "#c8862e"],
        files: [
            "File:B-Roll (ISRC USUAN1100315).mp3",
            "File:Beach Party (ISRC USUAN1100613).mp3",
            "File:Dub Eastern (ISRC USUAN1200046).mp3",
            "File:Dub Feral (ISRC USUAN1200045).mp3",
            "File:Easy Jam (ISRC USUAN1100245).mp3",
            "File:Firmament (ISRC USUAN1100480).mp3",
            "File:Gonna Start (ISRC USUAN1400001).mp3",
            "File:Maccary Bay (ISRC USUAN1500019).mp3"
        ]
    },
    {
        id: "commons-latin-fiesta", title: "라틴 피에스타", genre: "라틴",
        moods: ["신나는", "따뜻한", "리드미컬"], color: ["#f0d8bd", "#4b2926", "#d15c36"],
        files: [
            "File:Back on Track (ISRC USUAN1100426).mp3",
            "File:Beachfront Celebration (ISRC USUAN1200022).mp3",
            "File:BossaBossa (ISRC USUAN1600055).mp3",
            "File:Carnivale Intrigue (ISRC USUAN1500028).mp3",
            "File:Casa Bossa Nova (ISRC USUAN1600012).mp3",
            "File:Chee Zee Beach (ISRC USUAN1100686).mp3",
            "File:Cuban Sandwich (ISRC USUAN1600005).mp3",
            "File:Laid Back Guitars (ISRC USUAN1100181).mp3"
        ]
    },
    {
        id: "commons-african-rhythms", title: "아프리칸 리듬", genre: "아프리칸",
        moods: ["이국적인", "활기찬", "리드미컬"], color: ["#dfcaa5", "#3d3022", "#a7652d"],
        files: [
            "File:Accralate (ISRC USUAN1100341).mp3",
            "File:Artifact (ISRC USUAN1100324).mp3",
            "File:At The Shore (ISRC USUAN1100770).mp3",
            "File:Bumba Crossing (ISRC USUAN1500031).mp3",
            "File:Digya (ISRC USUAN1200080).mp3",
            "File:Dubakupado (ISRC USUAN1100834).mp3",
            "File:Infados (ISRC USUAN1100449).mp3",
            "File:Kumasi Groove (ISRC USUAN1100183).mp3"
        ]
    },
    {
        id: "commons-world-journey", title: "월드 뮤직 저니", genre: "월드",
        moods: ["여행", "이국적인", "따뜻한"], color: ["#d8dfd2", "#243b38", "#638c68"],
        files: [
            "File:Achaidh Cheide (ISRC USUAN1100340).mp3",
            "File:Allada (ISRC USUAN1500001).mp3",
            "File:Angevin (ISRC USUAN1200110).mp3",
            "File:AngloZulu (ISRC USUAN1100411).mp3",
            "File:Arcane (ISRC USUAN1100831).mp3",
            "File:Arid Foothills (ISRC USUAN1100437).mp3",
            "File:Ave Marimba (ISRC USUAN1700024).mp3",
            "File:Balzan Groove (ISRC USUAN1100311).mp3"
        ]
    },
    {
        id: "commons-disco-night", title: "디스코 나이트", genre: "디스코",
        moods: ["댄스", "신나는", "활기찬"], color: ["#e9d9e8", "#2b213e", "#a45bb2"],
        files: [
            "File:Aurea Carmina (ISRC USUAN1400006).mp3",
            "File:Disco con Tutti (ISRC USUAN1200091).mp3",
            "File:Disco Lounge (ISRC USUAN1100602).mp3",
            "File:Disco Medusae (ISRC USUAN1500041).mp3",
            "File:Electro Cabello (ISRC USUAN1400048).mp3",
            "File:Ether Disco (ISRC USUAN1100237).mp3",
            "File:Overcast (ISRC USUAN1200002).mp3",
            "File:Stringed Disco (ISRC USUAN1100059).mp3"
        ]
    },
    {
        id: "commons-ska-upbeat", title: "스카 업비트", genre: "스카",
        moods: ["유쾌한", "신나는", "밝은"], color: ["#e4e2c5", "#29342b", "#7d9a43"],
        files: [
            "File:Blue Ska (ISRC USUAN1600011).mp3",
            "File:Sunday Dub (ISRC USUAN1700031).mp3",
            "File:Upbeat Forever (ISRC USUAN1500063).mp3"
        ]
    },
    {
        id: "commons-country-road", title: "컨트리 로드", genre: "컨트리",
        moods: ["여행", "따뜻한", "활기찬"], color: ["#e3d5bd", "#3e2e22", "#a76d3d"],
        files: [
            "File:Guts and Bourbon (ISRC USUAN1400032).mp3",
            "File:Fireflies and Stardust (ISRC USUAN1600061).mp3",
            "File:Drankin Song (ISRC USUAN1500021).mp3",
            "File:Crossing the Divide (ISRC USUAN1400034).mp3",
            "File:River Valley Breakdown (ISRC USUAN1300032).mp3",
            "File:Bama Country (ISRC USUAN1100359).mp3",
            "File:Anamalie (ISRC USUAN1500007).mp3",
            "File:Smoking Gun (ISRC USUAN1100345).mp3"
        ]
    },
    {
        id: "commons-ambient-room", title: "앰비언트 룸", genre: "앰비언트",
        moods: ["조용한", "집중", "편안한"], color: ["#d5e0e2", "#20343d", "#5a8da0"],
        performer: "Various artists",
        files: [
            "File:Ancient Rite by Kevin MacLeod.ogg",
            "File:Tiki Bar Mixer by Kevin MacLeod.ogg",
            "File:Ambient music test, Yamaha CK61.flac",
            "File:Paul Kuniholm Ambient Seattle 2024 (WayVSumtInThWay).wav",
            "File:Raspberrymusic - Ambient (10 minutes).flac",
            "File:Hoving ft Laniakea - Cascade (Ambient).opus"
        ]
    },
    {
        id: "commons-historic-grooves", title: "히스토릭 재즈·블루스", genre: "재즈",
        moods: ["빈티지", "차분한", "그루브"], color: ["#dfd3b9", "#352d28", "#8d5b3b"],
        performer: "Historical recordings",
        trackGenres: {
            "File:LostTrainBlues.ogg": ["재즈", "블루스"],
            "File:St. Louis Blues March - Shades of Blue - United States Air Force Band of Mid-America.mp3": ["재즈", "블루스"],
            "File:St Louis Blues - Handy's Memphis Blues Band (1922 sound recording).mp3": ["재즈", "블루스"],
            "File:See Me Through.ogg": ["재즈", "록"]
        },
        files: [
            "File:OriginalDixielandJassBand-JazzMeBlues.ogg",
            "File:OriginalDixielandJassBand DixieJassBandOneStep1917.ogg",
            "File:Original Dixieland Jass Band - Livery Stable Blues (1917) with hiss reduction.ogg",
            "File:Dippermouth Blues - KING OLIVER'S JAZZ BAND.flac",
            "File:LostTrainBlues.ogg",
            "File:St. Louis Blues March - Shades of Blue - United States Air Force Band of Mid-America.mp3",
            "File:St Louis Blues - Handy's Memphis Blues Band (1922 sound recording).mp3",
            "File:See Me Through.ogg"
        ]
    },
    {
        id: "commons-vocal-caruso", title: "카루소 오페라 아리아", genre: "성악",
        moods: ["웅장한", "드라마틱한", "빈티지"], color: ["#e5d8c3", "#39282a", "#a34f4a"],
        performer: "Enrico Caruso, tenor", composer: "Various composers", playbackGain: 1.5,
        tags: ["오페라", "테너", "아리아"],
        files: [
            "File:Celeste Aida (1902).opus",
            "File:E lucevan le stelle (1902).opus",
            "File:La Donna E Mobile Rigoletto.ogg",
            "File:Una furtiva lagrima (1902).opus",
            "File:Vesti La Giubba.ogg",
            "File:Chiudo gli occhi (1902).ogg",
            "File:Questa o quella (1902).ogg",
            "File:Giunto sul passo estremo (1902).ogg"
        ]
    },
    {
        id: "commons-vocal-caruso-encore", title: "카루소 아리아 앙코르", genre: "성악",
        moods: ["웅장한", "드라마틱한", "빈티지"], color: ["#e7d6c2", "#3d2824", "#a86148"],
        performer: "Enrico Caruso, tenor", composer: "Various composers", playbackGain: 1.5,
        tags: ["오페라", "테너", "아리아", "역사 녹음"],
        files: [
            "File:Jules Massenet, Enrico Caruso, O Souverain, O Juge, O Pere.ogg",
            "File:Enrico Caruso, Recondita armonia (Tosca).ogg",
            "File:Enrico Caruso, George Frideric Handel, Ombra mai fu (Serse).ogg"
        ]
    },
    {
        id: "commons-vocal-opera-voices", title: "오페라 보이스", genre: "성악",
        moods: ["웅장한", "낭만적인", "드라마틱한"], color: ["#eadccf", "#34263b", "#925a8d"],
        performer: "Various vocalists", composer: "Various composers", playbackGain: 1.2,
        tags: ["오페라", "소프라노", "메조소프라노", "아리아"],
        files: [
            "File:Der Hoelle Rache.ogg",
            "File:Frances Alda, O mio babbino caro (Gianni Schicchi).ogg",
            "File:Mozart,Cherubinos`s aria in Ukrainian.ogg",
            "File:Mozart. Porgi amor aria in Ukrainian.ogg",
            "File:Purcell Didona`s aria (Maria Laguta).ogg",
            "File:PDP-CH - Jo Vincent - Ombra mai fu - Serse - George Frideric Handel - Columbia-11805-fx214.flac",
            "File:PDP-CH - Meta Seinemeyer, soprano with Staatskapelle Berlin - La forza del destino - Deh, non m'abbandonar - Verdi - Parlophon-p9116-20259.flac",
            "File:Jeanette Ekornaasvaag - Jules Massenet - Werther - \"Va! laisse couler mes larmes\".ogg"
        ]
    },
    {
        id: "commons-vocal-winterreise", title: "겨울 나그네 — 가곡 1집", genre: "성악",
        moods: ["차분한", "쓸쓸한", "집중"], color: ["#d8e0e4", "#28343e", "#667f99"],
        performer: "Hans Duhan, baritone", composer: "Franz Schubert", playbackGain: 1.35,
        tags: ["가곡", "리트", "바리톤", "슈베르트", "Winterreise"],
        files: [
            "File:01 - Gute Nacht (CK 2946-2, ES 383).flac",
            "File:02 - Die Wetterfahne (CK 2947-2, ES 383).flac",
            "File:03 - Gefrorene Tränen (CK 2948-1, ER 270).flac",
            "File:04 - Erstarrung (CK 2949-1, ER 270).flac",
            "File:06 - Wasserfluth (CK 2951-2, ES 384).flac",
            "File:07 - Auf dem Flusse (CK 2952-2, ES 385).flac",
            "File:08 - Rückblick (CK 2953-1, ES 385).flac",
            "File:09 - Irrlicht (BK 2954-2, ES 271).flac"
        ]
    },
    {
        id: "commons-vocal-winterreise-ukrainian", title: "겨울 나그네 — 현대 우크라이나어 실연", genre: "성악",
        moods: ["차분한", "쓸쓸한", "집중"], color: ["#d7e1e7", "#273744", "#5d85a0"],
        performer: "Various vocalists · Andriy Bondarenko, piano", composer: "Franz Schubert", playbackGain: 1.1,
        tags: ["가곡", "리트", "슈베르트", "Winterreise", "우크라이나어"],
        files: [
            "File:F. Schubert. Die Wetterfahne (Ukrainian).ogg",
            "File:F.Schubert. Erstarrung (in Ukrainian).ogg",
            "File:F.Schubert. Auf dem Flusse (in Ukrainian).ogv.ogg",
            "File:F. Schubert. Der Lindenbaum (Ukrainian).ogg",
            "File:F. Schubert. Die Post (Ukrainian).ogg",
            "File:F. Schubert. Im Dorfe (Ukrainian).ogg",
            "File:F. Schubert. Die Krähe (Ukrainian).ogg",
            "File:F.Schubert Frühlingstraum (in Ukrainiain).ogg"
        ]
    },
    {
        id: "commons-vocal-choral", title: "합창 명곡", genre: "성악",
        moods: ["경건한", "차분한", "웅장한"], color: ["#e2dfcf", "#2d3330", "#7b8261"],
        performer: "Various choirs", composer: "Various composers", playbackGain: 1.2,
        tags: ["합창", "성가", "르네상스", "고전"],
        files: [
            "File:Byrd - Ave Verum Corpus (Stile Antico).ogg",
            "File:Byrd 4-Part Mass - Agnus Dei.ogg",
            "File:Handel - messiah - 44 hallelujah.ogg",
            "File:La Guerre by Clément Janequin.ogg",
            "File:Magnificat Stanford in A Trinity Church Boston.ogg",
            "File:Purcell Hear my prayer Sung by the dwsChorale.ogg",
            "File:Tomas Luis de Victoria O vos omnes (The Tudor Consort).ogg",
            "File:Schumann Naenie sung by the dwsChorale.ogg"
        ]
    },
    {
        id: "commons-vocal-army-chorus", title: "합창과 캐럴", genre: "성악",
        moods: ["경건한", "따뜻한", "평화로운"], color: ["#e5e1d0", "#2f3935", "#738d77"],
        performer: "United States Army Band and Chorus", composer: "Traditional", playbackGain: 1.15,
        tags: ["합창", "성가", "캐럴", "코러스"],
        files: [
            "File:U.S. Army Band - A la Nanita Nana.ogg",
            "File:U.S. Army Band - Coventry Carol.ogg",
            "File:Silent Night (choral).ogg",
            "File:U.S. Army Band - Good King Wenceslaus.ogg",
            "File:U.S. Army Band - Hark! The Herald Angels Sing.ogg",
            "File:Joy To The World.ogg",
            "File:U.S. Army Band - O Tannenbaum.ogg",
            "File:U.S. Army Band - This Endris Night.ogg"
        ]
    }
];

const entityMap = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
function plain(value) {
    return String(value || "")
        .replace(/<br\s*\/?\s*>/gi, " · ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
            if (entity[0] === "#") {
                const hex = entity[1].toLowerCase() === "x";
                return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
            }
            return entityMap[entity.toLowerCase()] || " ";
        })
        .replace(/\\n/g, " · ")
        .replace(/\s+/g, " ")
        .trim();
}

function displayTitle(fileTitle) {
    return fileTitle
        .replace(/^File:/, "")
        .replace(/^\d+\s*-\s*/, "")
        .replace(/\s*\(ISRC\s+[^)]+\)/i, "")
        .replace(/\s*\([A-Z]{2}\s+\d+(?:-[0-9]+)?\s*,[^)]*\)$/i, "")
        .replace(/\.(mp3|ogg|oga|opus|flac|wav)$/i, "")
        .replace(/_/g, " ")
        .replace(/\s+by Kevin MacLeod$/i, "")
        .replace(/^OriginalDixielandJassBand[- ]?/, "Original Dixieland Jass Band — ")
        .replace(/\s+with hiss reduction$/i, "")
        .trim();
}

function classicalMoods(record) {
    const text = `${record.title} ${record.bwv} ${record.composer}`.toLowerCase();
    if (/녹턴|아다지오|아라베스크|소나티네|무반주|골드베르크|평균율|전주곡|첼로 소품/.test(text)) {
        return ["조용한", "집중", "우아한"];
    }
    if (/교향곡|협주곡|스케르초|왈츠|영웅|부활|한여름|합주/.test(text)) {
        return ["웅장한", "활기찬", "집중"];
    }
    return ["차분한", "집중", "우아한"];
}

function formatOf(mime, url) {
    if (/flac/i.test(mime + url)) return "FLAC";
    if (/wav/i.test(mime + url)) return "WAV";
    if (/mpeg|mp3/i.test(mime + url)) return "MP3";
    if (/opus/i.test(url)) return "Opus";
    return "Ogg Vorbis";
}

async function metadataPages() {
    if (metadataDir) {
        const names = (await fs.readdir(metadataDir))
            .filter((name) => /^mfa-info-\d+\.json$/.test(name))
            .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
        if (!names.length) throw new Error(`메타데이터 응답 파일이 없습니다: ${metadataDir}`);
        const payloads = await Promise.all(names.map(async (name) =>
            JSON.parse(await fs.readFile(path.join(metadataDir, name), "utf8"))));
        return payloads.flatMap((payload) => Object.values(payload.query?.pages || {}));
    }

    const titles = groups.flatMap((group) => group.files);
    const pages = [];
    for (let index = 0; index < titles.length; index += 24) {
        const params = new URLSearchParams({
            action: "query",
            titles: titles.slice(index, index + 24).join("|"),
            prop: "imageinfo",
            iiprop: "url|mime|size|extmetadata",
            format: "json",
            origin: "*"
        });
        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
            headers: { "user-agent": "MadForAudioCatalog/1.0 (https://github.com/ducklove/mad-for-audio)" }
        });
        if (!response.ok) throw new Error(`Commons API ${response.status}`);
        const payload = await response.json();
        pages.push(...Object.values(payload.query?.pages || {}));
    }
    return pages;
}

const pages = await metadataPages();
const infoByTitle = new Map(pages.map((page) => [page.title, page]));
const allowedLicense = /^(CC BY(?:-SA)?(?: \d(?:\.\d)?)?|CC0|Public domain)$/i;

const generated = groups.map((group, groupIndex) => {
    const performer = group.performer || "Kevin MacLeod";
    const composer = group.composer || performer;
    const tracks = group.files.map((title, trackIndex) => {
        const page = infoByTitle.get(title);
        const info = page?.imageinfo?.[0];
        if (!info?.url) throw new Error(`Commons 파일 메타데이터 누락: ${title}`);
        if (!/^(audio\/|application\/ogg$)/i.test(info.mime || "")) {
            throw new Error(`오디오 파일이 아님: ${title} (${info.mime || "unknown"})`);
        }
        const license = plain(info.extmetadata?.LicenseShortName?.value);
        if (!allowedLicense.test(license)) throw new Error(`허용되지 않은 라이선스: ${title} (${license})`);
        const marker = "/wikipedia/commons/";
        const markerAt = info.url.indexOf(marker);
        if (markerAt < 0) throw new Error(`예상하지 못한 Commons URL: ${info.url}`);
        const format = formatOf(info.mime || "", info.url);
        const artist = plain(info.extmetadata?.Artist?.value) || performer;
        return {
            id: `${group.id}-track-${String(trackIndex + 1).padStart(2, "0")}`,
            t: displayTitle(title),
            f: info.url.slice(markerAt + marker.length),
            ...(Array.isArray(group.trackGenres?.[title])
                ? { genres: group.trackGenres[title] }
                : group.trackGenres?.[title] ? { genre: group.trackGenres[title] } : {}),
            ...(artist !== performer ? { sourceArtist: artist } : {}),
            license,
            commercialUse: true,
            quality: {
                format,
                lossless: format === "FLAC" || format === "WAV",
                bytes: info.size
            },
            sourcePage: info.descriptionurl
        };
    });
    const licenses = [...new Set(tracks.map((track) => track.license))];
    const [labelBg, jacketBg, accent] = group.color;
    const catalogNo = `MFA-COMMONS-${String(groupIndex + 1).padStart(2, "0")}`;
    return {
        id: group.id,
        collection,
        title: group.title,
        artist: performer,
        catalogNo,
        bwv: catalogNo,
        composer,
        performer,
        genre: group.genre,
        moods: group.moods,
        ...(Array.isArray(group.tags) ? { tags: group.tags } : {}),
        playbackGain: group.playbackGain || (group.id === "commons-historic-grooves" ? 1.5
            : group.id === "commons-ambient-room" ? 1.15 : 1),
        credit: performer === "Kevin MacLeod"
            ? "음원: Kevin MacLeod · CC BY 3.0 · Wikimedia Commons / Incompetech"
            : "음원: 개별 트랙 저작자·라이선스 · Wikimedia Commons",
        source: {
            provider: "Wikimedia Commons",
            license: licenses.join(" / "),
            licenseUrl: "https://creativecommons.org/licenses/",
            commercialUse: true
        },
        labelBig: group.genre.toUpperCase(),
        labelTitle: group.title,
        labelArtist: performer.toUpperCase(),
        jTitle: group.genre.toUpperCase(),
        jSub1: group.title,
        jSub2: `${tracks.length} TRACKS · COMMONS`,
        labelBg,
        jacketBg,
        accent,
        side: "A",
        tracks
    };
});

const current = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const base = current.filter((record) => record.collection !== collection).map((record, index) => {
    const id = record.id || `classical-${String(index + 1).padStart(3, "0")}`;
    return {
        ...record,
        id,
        artist: record.artist || record.performer,
        catalogNo: record.catalogNo || record.bwv,
        genre: record.genre || "클래식",
        moods: Array.isArray(record.moods) && record.moods.length ? record.moods : classicalMoods(record),
        tracks: record.tracks.map((track, trackIndex) => ({
            ...track,
            id: track.id || `${id}-track-${String(trackIndex + 1).padStart(2, "0")}`
        }))
    };
});
const next = [...base, ...generated];
const trackCount = next.reduce((sum, record) => sum + record.tracks.length, 0);

if (write) {
    await fs.writeFile(catalogPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`records.json 갱신 완료: ${next.length}장 · ${trackCount}트랙`);
} else {
    console.log(`검증 완료(미작성): ${next.length}장 · ${trackCount}트랙`);
    console.log("실제 반영은 --write 옵션을 추가하세요.");
}
