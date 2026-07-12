// 테스트용 모의 HLS 스트림 생성 — 60초 사인파를 MP3/TS로 세그먼트화한다.
// MP3를 쓰는 이유: 오픈소스 크로미움 빌드는 AAC 디코더가 없어 재생 검증이 불가능하다.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, ".stream");
const playlist = path.join(outDir, "playlist.m3u8");
const phono = path.join(outDir, "phono.mp3");
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(playlist)) {
    execFileSync(ffmpeg, [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=60",
        "-c:a", "libmp3lame", "-b:a", "64k",
        "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
        playlist,
    ]);
    console.log("모의 HLS 스트림 생성 완료:", playlist);
} else {
    console.log("모의 HLS 스트림 이미 존재:", playlist);
}

// 턴테이블(포노) 프로브·재생 검증용 단일 오디오 파일
if (!fs.existsSync(phono)) {
    execFileSync(ffmpeg, [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=330:duration=8",
        "-c:a", "libmp3lame", "-b:a", "64k", phono,
    ]);
    console.log("모의 포노 음원 생성 완료:", phono);
} else {
    console.log("모의 포노 음원 이미 존재:", phono);
}
