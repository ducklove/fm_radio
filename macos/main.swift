// Mad for Audio — macOS 메뉴바 상주 앱
// 메뉴바 아이콘 클릭 → 팝오버로 하이파이 랙이 열린다.
// 팝오버를 닫아도 웹뷰는 살아 있으므로 라디오는 계속 재생된다.
// 빌드: ./build.sh  (Xcode 프로젝트 불필요 — swiftc 단일 파일)

import Cocoa
import WebKit
import ServiceManagement

// 팝오버는 항상 랙 뷰로 연다 (?view=rack — 저장된 보기 모드보다 우선)
let APP_URL = URL(string: "https://ducklove.github.io/mad-for-audio/?view=rack")!
let WIDGET_URL = URL(string: "https://ducklove.github.io/mad-for-audio/widget.html?skin=tuner")!
let FULL_SIZE = NSSize(width: 440, height: 780)
let WIDGET_SIZE = NSSize(width: 500, height: 360)

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var statusItem: NSStatusItem!
    let popover = NSPopover()
    var webView: WKWebView!
    var widgetMode = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 웹뷰 — 앱이 사는 동안 유지된다 (오디오의 심장)
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []   // 대기 선국 자동 연결 등 프로그램적 재생 허용
        cfg.allowsAirPlayForMediaPlayback = true
        webView = WKWebView(frame: NSRect(origin: .zero, size: FULL_SIZE), configuration: cfg)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.load(URLRequest(url: APP_URL))

        let vc = NSViewController()
        vc.view = webView
        popover.contentViewController = vc
        popover.contentSize = FULL_SIZE
        popover.behavior = .transient   // 바깥을 클릭하면 닫힌다 — 소리는 계속

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "radio.fill", accessibilityDescription: "Mad for Audio")
                ?? NSImage(systemSymbolName: "antenna.radiowaves.left.and.right", accessibilityDescription: "Mad for Audio")
            button.action = #selector(statusClicked(_:))
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
    }

    // ----- 메뉴바 버튼: 좌클릭 = 팝오버 토글, 우클릭 = 메뉴 -----
    @objc func statusClicked(_ sender: NSStatusBarButton) {
        if NSApp.currentEvent?.type == .rightMouseUp {
            showMenu()
        } else {
            togglePopover()
        }
    }

    func togglePopover() {
        if popover.isShown {
            popover.performClose(nil)
        } else if let button = statusItem.button {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    func showMenu() {
        let menu = NSMenu()
        menu.addItem(withTitle: popover.isShown ? "랙 닫기" : "랙 열기",
                     action: #selector(menuToggle), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "새로고침", action: #selector(menuReload), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "브라우저에서 열기", action: #selector(menuOpenBrowser), keyEquivalent: "").target = self
        let widget = NSMenuItem(title: "미니 위젯 모드", action: #selector(menuWidgetMode), keyEquivalent: "")
        widget.target = self
        widget.state = widgetMode ? .on : .off
        menu.addItem(widget)
        menu.addItem(.separator())
        let login = NSMenuItem(title: "로그인 시 자동 시작", action: #selector(menuLoginItem), keyEquivalent: "")
        login.target = self
        login.state = (SMAppService.mainApp.status == .enabled) ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Mad for Audio 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // 임시로 메뉴를 걸고 클릭을 재생해 띄운다 (상태바 메뉴의 관용 패턴)
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc func menuToggle() { togglePopover() }
    @objc func menuReload() { webView.reload() }

    @objc func menuOpenBrowser() {
        NSWorkspace.shared.open(APP_URL)
    }

    @objc func menuWidgetMode() {
        widgetMode.toggle()
        popover.contentSize = widgetMode ? WIDGET_SIZE : FULL_SIZE
        webView.load(URLRequest(url: widgetMode ? WIDGET_URL : APP_URL))
    }

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

    // ----- 내비게이션 정책: 플레이어 페이지에 머문다 -----
    // 설명서 등 다른 페이지로의 이동은 기본 브라우저로 보낸다.
    // 팝오버 안에서 페이지를 떠나면 재생 중이던 오디오가 끊기기 때문.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.navigationType == .linkActivated,
              let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let path = url.path
        let isPlayerPage = url.host == APP_URL.host &&
            (path.hasSuffix("/mad-for-audio/") || path.hasSuffix("/index.html") || path.hasSuffix("/widget.html"))
        if isPlayerPage {
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // window.open(미니 플레이어 등) → 기본 브라우저로
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
