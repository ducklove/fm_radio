// LP 무음 진단용 일회성 프로브 — 배포 페이지를 WKWebView(맥 앱과 동일 엔진)로 열어
// 1번 음반 1번 트랙을 재생시키고 audio 엘리먼트 상태를 주기적으로 출력한다.
// 실행: xcrun swiftc -parse-as-library webprobe.swift -o /tmp/webprobe -framework Cocoa -framework WebKit && /tmp/webprobe

import Cocoa
import WebKit

let LOG = "/tmp/madprobe.log"
func plog(_ msg: String) {
    let line = msg + "\n"
    if let h = FileHandle(forWritingAtPath: LOG) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); h.closeFile() }
    else { try? line.write(toFile: LOG, atomically: true, encoding: .utf8) }
    print(msg)
}

@MainActor
final class Probe: NSObject, WKNavigationDelegate {
    var web: WKWebView!
    var polls = 0

    func start() {
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        if CommandLine.arguments.contains("--persistent") {
            // 실제 앱과 같은 번들 ID로 실행하면 같은 저장소를 본다 — 사용자 상태 재현
        } else {
            cfg.websiteDataStore = .nonPersistent()   // 캐시 없는 깨끗한 로드
        }
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 700), configuration: cfg)
        if CommandLine.arguments.contains("--safari-ua") {
            web.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
            plog("UA: safari")
        } else {
            plog("UA: default(WKWebView)")
        }
        web.navigationDelegate = self
        // 창에 붙지 않은 웹뷰는 미디어가 서스펜드된다 — 실제 앱처럼 창에 부착
        let win = NSWindow(contentRect: NSRect(x: 40, y: 40, width: 900, height: 700),
                           styleMask: [.titled], backing: .buffered, defer: false)
        win.contentView = web
        win.orderFrontRegardless()
        objc_setAssociatedObject(self, "probeWindow", win, .OBJC_ASSOCIATION_RETAIN)
        let urlArg = CommandLine.arguments.dropFirst().first(where: { $0.hasPrefix("http") })
            ?? "https://ducklove.github.io/mad-for-audio/?view=rack&probe=1"
        var req = URLRequest(url: URL(string: urlArg)!)
        req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        web.load(req)
    }

    func webView(_ w: WKWebView, didFinish navigation: WKNavigation!) {
        let boot = """
        (() => {
          if (typeof playPhonoTrack !== 'function') return 'no-app';
          try { setRecord(0); } catch (e) {}
          playPhonoTrack(0);
          window.__fetchStat = 'pending';
          fetch('https://upload.wikimedia.org/wikipedia/commons/transcoded/4/43/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg/JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg.mp3', {method:'HEAD'})
            .then(r => { window.__fetchStat = 'HTTP ' + r.status; })
            .catch(e => { window.__fetchStat = 'ERR ' + e; });
          return 'started CAN_OGG=' + (typeof CAN_OGG !== 'undefined' ? CAN_OGG : '?')
            + ' canOggType="' + audio.canPlayType('audio/ogg; codecs="vorbis"') + '"'
            + ' SAFARI_LIKE=' + (typeof SAFARI_LIKE !== 'undefined' ? SAFARI_LIKE : '?');
        })()
        """
        w.evaluateJavaScript(boot) { r, e in plog("BOOT: \(String(describing: r ?? "?"))") }

        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
            Task { @MainActor in
                self.polls += 1
                let js = """
                JSON.stringify({src: audio.src.slice(-70), err: audio.error ? audio.error.code : 0,
                  rs: audio.readyState, t: Math.round(audio.currentTime * 10) / 10,
                  paused: audio.paused, fetchStat: window.__fetchStat, rate: Math.round(audio.playbackRate*1000)/1000, state: (typeof audioState !== 'undefined' ? audioState : '?'),
                  vol: audio.volume, muted: audio.muted,
                  savedVol: localStorage.getItem('fmRadio.volume'), units: localStorage.getItem('fmRadio.units')})
                """
                self.web.evaluateJavaScript(js) { r, e in
                    plog("POLL\(self.polls): \(String(describing: r ?? "?"))")
                    if self.polls >= 7 { exit(0) }
                }
            }
        }
    }

    func webView(_ w: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        plog("NAV FAIL: \(error.localizedDescription)")
        exit(1)
    }
}

@main
@MainActor
struct Main {
    static func main() {
        let app = NSApplication.shared
        let probe = Probe()
        probe.start()
        _ = probe
        app.run()
    }
}
