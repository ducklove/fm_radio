// UI 접근성 조정 계층 — 기존 전역 앱 로직을 건드리지 않고 모달·탭·토글의
// DOM 계약을 정규화한다. app.js가 동적으로 다시 그리는 피커도 관찰해 동기화한다.
(function () {
    "use strict";

    const OVERLAY_SELECTOR = ".settings-overlay, .crate-overlay";
    const FOCUSABLE_SELECTOR = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled]):not([type='hidden'])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    let activeDialog = null;
    let openerCandidate = null;
    let backgroundState = [];

    function isVisible(element) {
        return !!element && !element.hidden && element.getClientRects().length > 0;
    }

    function focusableItems(dialog) {
        return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) =>
            isVisible(element) && element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true");
    }

    function rememberOpener(event) {
        if (activeDialog) return;
        const target = event.target instanceof Element
            ? event.target.closest(FOCUSABLE_SELECTOR + ", [role='button'][tabindex]" )
            : null;
        const active = document.activeElement;
        const element = target || (active instanceof HTMLElement && active !== document.body ? active : null);
        if (element) openerCandidate = { element, at: performance.now() };
    }

    function makeBackgroundInert(overlay) {
        backgroundState = [];
        Array.from(document.body.children).forEach((element) => {
            if (element === overlay || /^(SCRIPT|STYLE|AUDIO)$/.test(element.tagName)) return;
            backgroundState.push({
                element,
                inert: element.inert,
                hadInertAttribute: element.hasAttribute("inert"),
                ariaHidden: element.getAttribute("aria-hidden")
            });
            element.inert = true;
            element.setAttribute("inert", "");
            element.setAttribute("aria-hidden", "true");
        });
    }

    function restoreBackground() {
        backgroundState.forEach(({ element, inert, hadInertAttribute, ariaHidden }) => {
            if (!element.isConnected) return;
            element.inert = inert;
            if (hadInertAttribute) element.setAttribute("inert", "");
            else element.removeAttribute("inert");
            if (ariaHidden === null) element.removeAttribute("aria-hidden");
            else element.setAttribute("aria-hidden", ariaHidden);
        });
        backgroundState = [];
    }

    function activateDialog(dialog) {
        const overlay = dialog.closest(OVERLAY_SELECTOR);
        if (!overlay || overlay.hidden || (activeDialog && activeDialog.dialog === dialog)) return;

        if (activeDialog) deactivateDialog(false);
        const recentOpener = openerCandidate && performance.now() - openerCandidate.at < 1500
            ? openerCandidate.element
            : null;
        const current = document.activeElement;
        const opener = recentOpener || (
            current instanceof HTMLElement && current !== document.body && !overlay.contains(current)
                ? current
                : null
        );

        activeDialog = { dialog, overlay, opener };
        openerCandidate = null;
        document.body.classList.add("dialog-open");
        makeBackgroundInert(overlay);

        requestAnimationFrame(() => {
            if (!activeDialog || activeDialog.dialog !== dialog || overlay.hidden) return;
            if (dialog.contains(document.activeElement)) return;
            const preferred = dialog.querySelector(
                "[role='tab'][aria-selected='true'], [data-dialog-initial], [autofocus]"
            );
            const target = isVisible(preferred) ? preferred : focusableItems(dialog)[0] || dialog;
            target.focus({ preventScroll: true });
        });
    }

    function deactivateDialog(restoreFocus = true) {
        if (!activeDialog) return;
        const { opener } = activeDialog;
        activeDialog = null;
        restoreBackground();
        document.body.classList.remove("dialog-open");
        if (restoreFocus && opener instanceof Element && opener.isConnected && !opener.hidden
            && typeof opener.focus === "function") {
            requestAnimationFrame(() => opener.focus({ preventScroll: true }));
        }
    }

    function closeCurrentDialog() {
        if (!activeDialog) return;
        const closer = activeDialog.dialog.querySelector("[data-dialog-close]");
        if (closer instanceof HTMLElement) closer.click();
        else activeDialog.overlay.hidden = true;
    }

    function refreshDialogs() {
        const visible = Array.from(document.querySelectorAll("[role='dialog'][aria-modal='true']"))
            .find((dialog) => {
                const overlay = dialog.closest(OVERLAY_SELECTOR);
                return overlay && !overlay.hidden;
            });

        if (activeDialog && (!visible || visible !== activeDialog.dialog)) deactivateDialog(true);
        if (visible && (!activeDialog || visible !== activeDialog.dialog)) activateDialog(visible);
    }

    function syncScheduleTabs() {
        const tablist = document.querySelector(".sched-tabs[role='tablist']");
        if (!tablist) return;
        const tabs = Array.from(tablist.querySelectorAll(".sched-tab"));
        if (!tabs.length) return;
        const selected = tabs.find((tab) => tab.classList.contains("active")) || tabs[0];

        tabs.forEach((tab) => {
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", String(tab === selected));
            tab.tabIndex = tab === selected ? 0 : -1;
        });

        const listPanel = document.getElementById("schedList");
        const reservationPanel = document.getElementById("schedResPane");
        if (listPanel) {
            listPanel.setAttribute("role", "tabpanel");
            if (selected.id !== "schedTabRes") listPanel.setAttribute("aria-labelledby", selected.id);
        }
        if (reservationPanel) {
            reservationPanel.setAttribute("role", "tabpanel");
            reservationPanel.setAttribute("aria-labelledby", "schedTabRes");
        }
    }

    function syncPickerButtons(root = document) {
        const pickers = [];
        if (root instanceof Element && root.matches(".skin-picker")) pickers.push(root);
        if (root.querySelectorAll) pickers.push(...root.querySelectorAll(".skin-picker"));
        pickers.forEach((picker) => {
            picker.querySelectorAll(".skin-btn").forEach((button) => {
                button.setAttribute("aria-pressed", String(button.classList.contains("active")));
            });
        });
    }

    function syncToggleButtons() {
        const record = document.getElementById("btnRec");
        if (record) record.setAttribute("aria-pressed", String(record.classList.contains("recording")));

        document.querySelectorAll(".unit-zoom-btn").forEach((button) => {
            const stage = button.parentElement;
            const expanded = !!stage && stage.classList.contains("unit-zoomed");
            button.setAttribute("aria-pressed", String(expanded));
            if (stage && stage.id) button.setAttribute("aria-controls", stage.id);
        });
    }

    function handleTabKeys(event) {
        const tab = event.target instanceof Element ? event.target.closest("[role='tab']") : null;
        if (!tab || !tab.closest(".sched-tabs")) return false;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return false;

        const tabs = Array.from(tab.closest("[role='tablist']").querySelectorAll("[role='tab']"));
        const index = tabs.indexOf(tab);
        let next = index;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
        else next = (index - 1 + tabs.length) % tabs.length;

        event.preventDefault();
        tabs[next].focus();
        tabs[next].click();
        queueMicrotask(syncScheduleTabs);
        return true;
    }

    function handleDialogKeys(event) {
        if (handleTabKeys(event) || !activeDialog) return;

        if (event.key === "Escape") {
            if (event.target instanceof Element && event.target.matches(".tapecase-label-input")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeCurrentDialog();
            return;
        }
        if (event.key !== "Tab") return;

        const items = focusableItems(activeDialog.dialog);
        if (!items.length) {
            event.preventDefault();
            activeDialog.dialog.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function setMobilePlayerClearance() {
        const wrap = document.querySelector(".hero-player-wrap");
        if (!wrap || window.matchMedia("(min-width: 721px)").matches) {
            document.documentElement.style.removeProperty("--mobile-player-clearance");
            return;
        }
        const height = Math.ceil(wrap.getBoundingClientRect().height);
        if (height > 0) {
            document.documentElement.style.setProperty("--mobile-player-clearance", `${height + 28}px`);
        }
    }

    document.addEventListener("pointerdown", rememberOpener, true);
    document.addEventListener("click", rememberOpener, true);
    document.addEventListener("keydown", handleDialogKeys, true);

    const observer = new MutationObserver((mutations) => {
        let shouldRefreshDialogs = false;
        let shouldSyncTabs = false;
        let shouldSyncToggles = false;
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes") {
                if (mutation.attributeName === "hidden" && mutation.target.matches(OVERLAY_SELECTOR)) {
                    shouldRefreshDialogs = true;
                }
                if (mutation.target.matches(".sched-tab")) shouldSyncTabs = true;
                if (mutation.target.matches(".skin-btn, .unit-zoomed, #btnRec")) shouldSyncToggles = true;
            } else {
                syncPickerButtons(mutation.target);
                shouldSyncToggles = true;
            }
        });
        if (shouldRefreshDialogs) refreshDialogs();
        if (shouldSyncTabs) syncScheduleTabs();
        if (shouldSyncToggles) {
            syncPickerButtons();
            syncToggleButtons();
        }
    });
    observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["hidden", "class"]
    });

    const playerWrap = document.querySelector(".hero-player-wrap");
    if (playerWrap && "ResizeObserver" in window) {
        new ResizeObserver(setMobilePlayerClearance).observe(playerWrap);
    }
    window.addEventListener("resize", setMobilePlayerClearance, { passive: true });

    syncScheduleTabs();
    syncPickerButtons();
    syncToggleButtons();
    refreshDialogs();
    setMobilePlayerClearance();
})();
