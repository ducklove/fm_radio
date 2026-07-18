// 음반 카탈로그를 먼저 로딩한 뒤 전역 UI 스크립트를 실행한다.
// app.js는 HTML 인라인 onclick과 네이티브 셸에서 호출하는 전역 함수를 제공하므로
// ES module로 감싸지 않고, 데이터 준비 후 classic script로 주입한다.
(function () {
    const source = document.currentScript && document.currentScript.src;
    const version = source ? new URL(source, location.href).searchParams.get("v") : "";
    const assetUrl = (name) => version ? `${name}?v=${encodeURIComponent(version)}` : name;
    const bootstrapState = {
        version: version || "dev",
        phase: "loading",
        catalog: { status: "loading", records: [], error: null },
        capabilities: { phono: false }
    };

    window.MFA_BOOTSTRAP = bootstrapState;
    window.MFA_RECORDS = bootstrapState.catalog.records;

    function publishState() {
        window.dispatchEvent(new CustomEvent("mfa:bootstrap-state", { detail: bootstrapState }));
    }

    // 실행 중인 버전을 화면에 노출 — "고쳤다는데 왜 그대로지?"를 눈으로 확인할 수 있게
    const versionEl = document.getElementById("appVersion");
    if (versionEl) versionEl.textContent = version ? "v" + version : "dev";

    function validateCatalog(records) {
        if (!Array.isArray(records) || records.length === 0) return false;
        return records.every((record) =>
            record &&
            typeof record.title === "string" && record.title.length > 0 &&
            typeof record.composer === "string" && record.composer.length > 0 &&
            typeof record.performer === "string" && record.performer.length > 0 &&
            typeof record.credit === "string" && record.credit.length > 0 &&
            Array.isArray(record.tracks) && record.tracks.length > 0 &&
            record.tracks.every((track) =>
                track && typeof track.t === "string" && track.t.length > 0 &&
                typeof track.f === "string" && track.f.length > 0));
    }

    function loadApp() {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = assetUrl("app.js");
            script.onload = resolve;
            script.onerror = () => reject(new Error("앱 스크립트를 불러오지 못했습니다"));
            document.body.appendChild(script);
        });
    }

    function serializeError(error) {
        return {
            name: error && error.name ? String(error.name) : "Error",
            message: error && error.message ? String(error.message) : "음반 카탈로그를 불러오지 못했습니다"
        };
    }

    function showCatalogWarning(error) {
        const subtext = document.getElementById("playerSubtext");
        const chip = document.getElementById("audioStateChip");
        if (subtext) subtext.textContent = "음반 카탈로그를 불러오지 못해 포노만 제한됩니다. 라디오와 데크는 계속 사용할 수 있습니다.";
        if (chip) {
            chip.hidden = false;
            chip.className = "audio-state-chip st-warn";
            chip.textContent = "포노 제한";
        }
        console.warn("음반 카탈로그 degraded 모드:", error);
    }

    const catalogReady = fetch(assetUrl("records.json"), { credentials: "same-origin" })
        .then((response) => {
            if (!response.ok) throw new Error(`음반 카탈로그 응답 오류: ${response.status}`);
            return response.json();
        })
        .then((records) => {
            if (!validateCatalog(records)) throw new Error("음반 카탈로그 형식이 올바르지 않습니다");
            bootstrapState.catalog.status = "ready";
            bootstrapState.catalog.records = records;
            bootstrapState.capabilities.phono = true;
            window.MFA_RECORDS = records;
            publishState();
            return records;
        })
        .catch((error) => {
            bootstrapState.catalog.status = "degraded";
            bootstrapState.catalog.error = serializeError(error);
            bootstrapState.catalog.records = [];
            bootstrapState.capabilities.phono = false;
            window.MFA_RECORDS = bootstrapState.catalog.records;
            publishState();
            return bootstrapState.catalog.records;
        });

    // 카탈로그 장애는 포노 기능에만 격리한다. app.js 자체를 받지 못한 경우만
    // MFA_READY를 reject하여 실제 앱 셸 로드 실패와 기능 저하를 구분한다.
    window.MFA_READY = catalogReady
        .then(() => loadApp())
        .then(() => {
            bootstrapState.phase = "ready";
            if (!bootstrapState.capabilities.phono) showCatalogWarning(bootstrapState.catalog.error);
            publishState();
            return bootstrapState;
        });
})();
