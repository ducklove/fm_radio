/*
 * Mad for Audio model registry.
 *
 * The legacy renderers still own their SVG strings and model-specific state.
 * This facade gives the rest of the application one stable contract for
 * discovery, labels, rendering, controls and lifecycle hooks while those
 * renderers are migrated incrementally.
 */
(function initModelRegistry(global) {
    "use strict";

    const CONTROL_IDS = Object.freeze({
        tuner: Object.freeze([
            "tsFreq", "tsDialPtr", "tsSignalPtr", "tsTunePtr", "tsKnob",
            "tsStationMarks", "tsLedStereo", "tsLedLock", "tsLedBlend"
        ]),
        amplifier: Object.freeze(["ampVolMark", "ampVuL", "ampVuR"]),
        deck: Object.freeze([
            "deckReelL", "deckReelR", "deckBtnPlay", "deckBtnStop",
            "deckBtnRec", "deckBtnRew", "deckBtnFf"
        ]),
        turntable: Object.freeze([
            "ttPowerBtn", "ttStartBtn", "tt33", "tt45", "ttTonearm",
            "ttPlatter", "ttRecord"
        ]),
        timer: Object.freeze([
            "dtClockH", "dtClockM", "dtClockSec", "dtProgText",
            "dtSwTimer", "dtBtnProg", "dtBtnSleep"
        ])
    });

    const GROUPS = Object.freeze({
        tuner: Object.freeze({ models: TUNER_SKINS, order: SKIN_ORDER, defaultId: "mr78" }),
        amplifier: Object.freeze({ models: AMP_MODELS, order: AMP_ORDER, defaultId: "mc2105" }),
        deck: Object.freeze({ models: DECK_MODELS, order: DECK_ORDER, defaultId: "dragon" }),
        turntable: Object.freeze({ models: TT_MODELS, order: TT_ORDER, defaultId: "lp12" }),
        timer: Object.freeze({ models: TIMER_MODELS, order: Object.keys(TIMER_MODELS), defaultId: "dt540" })
    });

    function svgDimensions(svg) {
        const match = typeof svg === "string" && svg.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
        return match ? Object.freeze({ width: Number(match[3]), height: Number(match[4]) }) : null;
    }

    function labelFor(model, id) {
        return model.label || model.pill || model.brand || id;
    }

    function renderSource(model, options) {
        if (typeof model.render === "function") {
            if (Object.prototype.hasOwnProperty.call(options, "finish")) return model.render(options.finish);
            return model.render(options);
        }
        return typeof model.svg === "string" ? model.svg : null;
    }

    function descriptor(kind, id) {
        const group = GROUPS[kind];
        const source = group && group.models[id];
        if (!source) return null;
        return Object.freeze({
            id,
            kind,
            label: labelFor(source, id),
            description: source.desc || "",
            dimensions: svgDimensions(source.svg),
            controls: CONTROL_IDS[kind] || Object.freeze([]),
            audioProfile: kind === "amplifier" ? source : null,
            source,
            render(options = {}) {
                return renderSource(source, options);
            },
            mount(root, options = {}) {
                if (!root) throw new TypeError("A mount root is required");
                if (typeof options.mount === "function") return options.mount(root, source, this);
                const markup = renderSource(source, options);
                if (typeof markup !== "string") return null;
                root.innerHTML = markup;
                return root.firstElementChild;
            },
            update(state, options = {}) {
                return typeof options.update === "function" ? options.update(source, state, this) : undefined;
            },
            dispose(options = {}) {
                return typeof options.dispose === "function" ? options.dispose(source, this) : undefined;
            }
        });
    }

    const registry = Object.freeze({
        kinds: Object.freeze(Object.keys(GROUPS)),
        defaultId(kind) {
            return GROUPS[kind] ? GROUPS[kind].defaultId : null;
        },
        has(kind, id) {
            return Boolean(GROUPS[kind] && GROUPS[kind].models[id]);
        },
        get(kind, id) {
            return descriptor(kind, id);
        },
        list(kind) {
            const group = GROUPS[kind];
            return group ? Object.freeze(group.order.map((id) => descriptor(kind, id)).filter(Boolean)) : Object.freeze([]);
        }
    });

    global.MFA = global.MFA || {};
    global.MFA.models = registry;
    // Temporary compatibility name for tests and native wrappers. New code
    // should prefer window.MFA.models.
    global.MFA_MODEL_REGISTRY = registry;
})(window);
