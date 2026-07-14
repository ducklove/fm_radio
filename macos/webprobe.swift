// LP 무음 진단용 일회성 프로브 — 배포 페이지를 WKWebView(맥 앱과 동일 엔진)로 열어
// 1번 음반 1번 트랙을 재생시키고 audio 엘리먼트 상태를 주기적으로 출력한다.
// 실행: xcrun swiftc -parse-as-library webprobe.swift -o /tmp/webprobe -framework Cocoa -framework WebKit && /tmp/webprobe

import Cocoa
import WebKit

@MainActor
final class Probe: NSObject, WKNavigationDelegate {
    var web: WKWebView!
    var polls = 0

    func start() {
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 700), configuration: cfg)
        web.navigationDelegate = self
        var req = URLRequest(url: URL(string: "https://ducklove.github.io/mad-for-audio/?view=rack&probe=1")!)
        req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        web.load(req)
    }

    func webView(_ w: WKWebView, didFinish navigation: WKNavigation!) {
        let boot = """
        (() => {
          if (typeof playPhonoTrack !== 'function') return 'no-app';
          try { setRecord(0); } catch (e) {}
          playPhonoTrack(0);
          return 'started CAN_OGG=' + (typeof CAN_OGG !== 'undefined' ? CAN_OGG : '?')
            + ' canOggType="' + audio.canPlayType('audio/ogg; codecs="vorbis"') + '"'
            + ' SAFARI_LIKE=' + (typeof SAFARI_LIKE !== 'undefined' ? SAFARI_LIKE : '?');
        })()
        """
        w.evaluateJavaScript(boot) { r, e in print("BOOT:", r ?? e ?? "?") }

        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
            Task { @MainActor in
                self.polls += 1
                let js = """
                JSON.stringify({src: audio.src.slice(-70), err: audio.error ? audio.error.code : 0,
                  rs: audio.readyState, t: Math.round(audio.currentTime * 10) / 10,
                  paused: audio.paused, state: (typeof audioState !== 'undefined' ? audioState : '?'),
                  vol: audio.volume, muted: audio.muted})
                """
                self.web.evaluateJavaScript(js) { r, e in
                    print("POLL\(self.polls):", r ?? e ?? "?")
                    if self.polls >= 7 { exit(0) }
                }
            }
        }
    }

    func webView(_ w: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("NAV FAIL:", error.localizedDescription)
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
