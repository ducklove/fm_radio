// Mad for Audio — macOS 메뉴바 상주 앱
// 메뉴바 아이콘 클릭 → 드래그로 옮길 수 있는 플로팅 패널로 하이파이 랙이 열린다.
// 패널을 닫아도 웹뷰는 살아 있으므로 라디오는 계속 재생된다.
// 메뉴바에 [재생/정지 · 채널/곡명] 스트립이 상주한다 — 창을 닫아도 제어·표시가 가능하다.
// 빌드: ./build.sh  (Xcode 프로젝트 불필요 — swiftc 단일 파일)

import Cocoa
import WebKit
import ServiceManagement

// 랙 뷰 고정 (?view=rack — 저장된 보기 모드보다 우선)
let APP_URL = URL(string: "https://ducklove.github.io/mad-for-audio/?view=rack")!
let FULL_SIZE = NSSize(width: 440, height: 780)

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var statusItem: NSStatusItem!
    var titleItem: NSStatusItem!    // 메뉴바 스트립: [▶/⏸ 채널·곡명]
    var panel: NSPanel!
    var webView: WKWebView!
    var frameBeforeFocus: NSRect?   // 몰입 모드 진입 전 패널 프레임

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 웹뷰 — 앱이 사는 동안 유지된다 (오디오의 심장)
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []   // 대기 선국 자동 연결 등 프로그램적 재생 허용
        cfg.allowsAirPlayForMediaPlayback = true
        cfg.userContentController.add(self, name: "focus")   // 몰입 모드: 페이지 → 앱 브리지
        webView = WKWebView(frame: NSRect(origin: .zero, size: FULL_SIZE), configuration: cfg)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.load(URLRequest(url: APP_URL))

        // 플로팅 패널 — 투명 타이틀바(상단 스트립)를 잡고 드래그해 옮긴다
        panel = NSPanel(contentRect: NSRect(origin: .zero, size: FULL_SIZE),
                        styleMask: [.titled, .fullSizeContentView, .nonactivatingPanel],
                        backing: .buffered, defer: false)
        panel.title = "Mad for Audio"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = true
        panel.level = .floating                    // 다른 창 위에 뜬다
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        panel.contentView = webView
        panel.delegate = self

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "radio.fill", accessibilityDescription: "Mad for Audio")
                ?? NSImage(systemSymbolName: "antenna.radiowaves.left.and.right", accessibilityDescription: "Mad for Audio")
            button.action = #selector(statusClicked(_:))
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        // 메뉴바 스트립 — 나중에 만들수록 왼쪽에 붙는다: [▶ 채널명][📻]
        titleItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = titleItem.button {
            button.image = NSImage(systemSymbolName: "play.fill", accessibilityDescription: "재생/정지")
            button.imagePosition = .imageLeft
            button.font = NSFont.systemFont(ofSize: 12)
            button.title = ""
            button.action = #selector(titleClicked(_:))
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        // 페이지 상태 → 메뉴바 스트립 동기화 (2초 폴링)
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            Task { @MainActor in self.refreshStrip() }
        }
    }

    // ----- 메뉴바 스트립: 클릭 = 재생/정지, 표시 = 채널/곡명 -----
    @objc func titleClicked(_ sender: NSStatusBarButton) {
        if NSApp.currentEvent?.type == .rightMouseUp {
            showMenu()
            return
        }
        webView.evaluateJavaScript("if (typeof togglePlay === 'function') togglePlay();", completionHandler: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.refreshStrip() }
    }

    func refreshStrip() {
        let js = "JSON.stringify({p: (typeof isPlaying !== 'undefined' && isPlaying) ? 1 : 0, n: (typeof nowStation !== 'undefined' ? nowStation.textContent : '')})"
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            Task { @MainActor in
                guard let self, let raw = result as? String,
                      let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
                let playing = (obj["p"] as? Int ?? 0) == 1
                var name = (obj["n"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if name == "방송을 선택하세요" || name == "· · ·" { name = "" }
                if name.count > 22 { name = String(name.prefix(21)) + "…" }
                if let button = self.titleItem.button {
                    button.image = NSImage(systemSymbolName: playing ? "pause.fill" : "play.fill",
                                           accessibilityDescription: "재생/정지")
                    button.title = name.isEmpty ? "" : " " + name
                }
            }
        }
    }

    // ----- 메뉴바 버튼: 좌클릭 = 열기/축소/닫기, 우클릭 = 메뉴 -----
    @objc func statusClicked(_ sender: NSStatusBarButton) {
        if NSApp.currentEvent?.type == .rightMouseUp {
            showMenu()
            return
        }
        if panel.isVisible {
            exitFocusState()
            panel.orderOut(nil)     // 재생 표시·제어는 메뉴바 스트립이 이어받는다
        } else {
            showFull(anchorToStatusItem: true)
        }
    }

    func showFull(anchorToStatusItem: Bool) {
        exitFocusState()
        webView.evaluateJavaScript("if (typeof setPopupBarMode === 'function') setPopupBarMode(false);", completionHandler: nil)
        let frame = anchorToStatusItem || !panel.isVisible ? anchoredFrame(size: FULL_SIZE) : panel.frame
        panel.setFrame(frame, display: true, animate: panel.isVisible)
        panel.makeKeyAndOrderFront(nil)
    }

    // 몰입 모드 잔재 정리 — 닫기 전에 호출해 다음 열기가 원래 크기로 시작하게 한다
    func exitFocusState() {
        if frameBeforeFocus != nil || panel.level != .floating {
            webView.evaluateJavaScript("if (typeof applyFocusMode === 'function') applyFocusMode(false);", completionHandler: nil)
            panel.level = .floating
            frameBeforeFocus = nil
        }
    }

    // 상태바 아이콘 아래에 배치
    func anchoredFrame(size: NSSize) -> NSRect {
        guard let btnWindow = statusItem.button?.window else {
            return NSRect(origin: NSPoint(x: 200, y: 200), size: size)
        }
        let b = btnWindow.frame
        let frame = NSRect(x: b.midX - size.width / 2, y: b.minY - size.height - 6,
                           width: size.width, height: size.height)
        return clampToScreen(frame)
    }

    func clampToScreen(_ frame: NSRect) -> NSRect {
        guard let screen = statusItem.button?.window?.screen ?? NSScreen.main else { return frame }
        var f = frame
        let v = screen.visibleFrame
        f.origin.x = min(max(f.origin.x, v.minX + 8), v.maxX - f.width - 8)
        f.origin.y = min(max(f.origin.y, v.minY + 8), v.maxY - f.height - 8)
        return f
    }

    // 닫기 버튼(신호등) → 완전히 숨긴다 (소리는 계속)
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        exitFocusState()
        panel.orderOut(nil)
        return false
    }

    func showMenu() {
        let menu = NSMenu()
        menu.addItem(withTitle: panel.isVisible ? "랙 닫기" : "랙 열기",
                     action: #selector(menuToggleRack), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "새로고침", action: #selector(menuReload), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "브라우저에서 열기", action: #selector(menuOpenBrowser), keyEquivalent: "").target = self
        menu.addItem(.separator())
        let login = NSMenuItem(title: "로그인 시 자동 시작", action: #selector(menuLoginItem), keyEquivalent: "")
        login.target = self
        login.state = (SMAppService.mainApp.status == .enabled) ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Mad for Audio 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc func menuToggleRack() {
        if panel.isVisible {
            exitFocusState()
            panel.orderOut(nil)
        } else {
            showFull(anchorToStatusItem: true)
        }
    }


    @objc func menuReload() { webView.reloadFromOrigin() }   // 캐시 무시 — 배포 직후에도 새 코드를 받는다
    @objc func menuOpenBrowser() { NSWorkspace.shared.open(APP_URL) }

    @objc func menuLoginItem() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSSound.beep()
        }
    }

    // ----- 몰입(전체 화면) 모드: 패널을 화면 크기로 -----
    // WebKit 엘리먼트 전체 화면은 자체 안내 박스를 띄우므로 쓰지 않는다.
    nonisolated func userContentController(_ userContentController: WKUserContentController,
                                           didReceive message: WKScriptMessage) {
        let on = (message.body as? Bool) ?? ((message.body as? Int) == 1)
        Task { @MainActor in
            guard message.name == "focus" else { return }
            if on {
                if self.frameBeforeFocus == nil { self.frameBeforeFocus = self.panel.frame }
                let screen = self.panel.screen ?? NSScreen.main
                if let f = screen?.frame {
                    // 진짜 전체 화면 — 독·메뉴바까지 덮는다 (레벨을 메뉴바 위로)
                    self.panel.level = NSWindow.Level(rawValue: NSWindow.Level.mainMenu.rawValue + 1)
                    self.panel.setFrame(f, display: true)
                }
            } else {
                self.panel.level = .floating
                let back = self.frameBeforeFocus ?? self.anchoredFrame(size: FULL_SIZE)
                self.frameBeforeFocus = nil
                self.panel.setFrame(back, display: true, animate: true)
            }
            self.panel.makeKeyAndOrderFront(nil)
        }
    }

    // 로드(새로고침 포함)가 끝나면 랙 모드로 정돈하고 메뉴바 스트립을 갱신한다
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("if (typeof setPopupBarMode === 'function') setPopupBarMode(false);", completionHandler: nil)
        refreshStrip()
    }

    // ----- 내비게이션 정책: 플레이어 페이지에 머문다 -----
    // 다른 페이지로의 이동은 기본 브라우저로 — 창 안에서 페이지를 떠나면 재생이 끊기기 때문.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.navigationType == .linkActivated,
              let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let path = url.path
        let isPlayerPage = url.host == APP_URL.host &&
            (path.hasSuffix("/mad-for-audio/") || path.hasSuffix("/index.html"))
        if isPlayerPage {
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // window.open → 기본 브라우저로
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }
}

@main
@MainActor
struct Main {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)   // 독 아이콘 없음 — 메뉴바에만 산다
        app.run()
    }
}
