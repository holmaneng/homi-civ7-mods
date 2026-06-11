// Ported from bszonye/civ7-map-trix (bz-panel-mini-map.js).
// Stripped: bz-map-trix-options, commander/religion lens logic, unit lens patching.
// Kept: lens layer patching, City/Units panel buttons, lens panel checkboxes, serialization.
// Fixed: unitsButton.classList bug (original erroneously called cityButton.classList).

import { InputEngineEventName } from '/core/ui/input/input-support.js';
import LensManager from '/core/ui/lenses/lens-manager.js';
// guarantee patch runs before lens initialization
import '/base-standard/ui/lenses/layer/hexgrid-layer.js';
import '/base-standard/ui/lenses/lens/default-lens.js';
import '/base-standard/ui/lenses/lens/discovery-lens.js';

const BZ_LAYERS = {
    "bz-discovery-layer":       "LOC_UI_MINI_MAP_BZ_DISCOVERY",
    "bz-culture-borders-layer": "LOC_UI_MINI_MAP_BZ_BORDERS",
    "bz-city-borders-layer":    "LOC_UI_MINI_MAP_BZ_CITY_BORDERS",
    "bz-wonder-layer":          "LOC_UI_PRODUCTION_WONDERS",
    "bz-fortification-layer":     "LOC_UI_MINI_MAP_BZ_FORTIFICATION",
    "bz-vegetation-layer":        "LOC_UI_MINI_MAP_BZ_VEGETATION",
    "homi-rail-station-layer":    "LOC_UI_MINI_MAP_BZ_VEGETATION",    // overridden below
    "homi-explorer-layer":        "LOC_UI_MINI_MAP_BZ_VEGETATION",    // overridden below
    "homi-settlement-bounds-layer": "LOC_UI_MINI_MAP_BZ_VEGETATION",  // overridden below
};
const BZ_EXTRA_LAYERS = {
    "fxs-settler-lens": ["bz-city-borders-layer"],
    "fxs-trade-lens":   ["bz-city-borders-layer"],
};

// extend LensManager layer serialization
const LMproto = Object.getPrototypeOf(LensManager);
const LM_toggleLayer = LMproto.toggleLayer;
LMproto.toggleLayer = function(...args) {
    const [layerType, options] = args;
    if (options?.serialize === true) {
        const force = options?.force;
        const enable = force ?? !this.enabledLayers.has(layerType);
        this.bzSerializeLayer(layerType, enable);
        // reconcile the two border layers
        if (layerType == "bz-city-borders-layer") {
            this.bzSerializeLayer("bz-culture-borders-layer", !enable);
        } else if (layerType == "bz-culture-borders-layer") {
            this.bzSerializeLayer("bz-city-borders-layer", false);
        }
    }
    LM_toggleLayer.apply(this, args);
}
LMproto.bzSerializeLayer = function(layerType, enable) {
    const id = LensManager.getLayerOption(layerType);
    if (!id || id == layerType) return;
    const lensType = LensManager.getActiveLens();
    const optionName = `homi-mods.${lensType}.${id}`;
    const ovalue = UI.getOption("user", "Mod", optionName);
    const value = enable ? 1 : 0;
    if (value == ovalue) return;
    UI.setOption("user", "Mod", optionName, value);
}

// restore serialized layers before default interface startup
window.addEventListener("interface-mode-ready", (_event) => {
    for (const [lensType, lens] of LensManager.lenses.entries()) {
        for (const layerType of LensManager.layers.keys()) {
            const layerOption = LensManager.getLayerOption(layerType);
            if (!layerOption) continue;
            const optionName = `homi-mods.${lensType}.${layerOption}`;
            const ovalue = UI.getOption("user", "Mod", optionName);
            if (ovalue == null) {
                continue;
            } else if (ovalue) {
                lens.activeLayers.add(layerType);
            } else {
                lens.activeLayers.delete(layerType);
            }
            lens.allowedLayers.delete(layerType);
        }
    }
});

// patch bz layers into all existing lenses
for (const [lensType, lens] of LensManager.lenses.entries()) {
    const active = lens.activeLayers;
    const allowed = lens.allowedLayers;
    // extra default layers per lens
    const extra = new Set(BZ_EXTRA_LAYERS[lensType] ?? []);
    for (const layerType of extra) active.add(layerType);
    // swap modded city borders in for vanilla
    if (active.has("bz-city-borders-layer")) {
        // already configured
    } else if (active.has("fxs-city-borders-layer")) {
        active.add("bz-city-borders-layer");
    } else if (active.has("fxs-culture-borders-layer")) {
        active.add("bz-culture-borders-layer");
    }
    active.delete("fxs-city-borders-layer");
    active.delete("fxs-culture-borders-layer");
    // add discovery layer to every lens that shows Resources
    if (active.has("fxs-resource-layer") || allowed.has("fxs-resource-layer")) {
        active.add("bz-discovery-layer");
    }
    // fortification and rail stations are optional on all lenses — user can enable at any time
    allowed.add("bz-fortification-layer");
    allowed.add("homi-rail-station-layer");
    allowed.add("homi-explorer-layer");
    allowed.add("homi-settlement-bounds-layer");
    // disable Conquest decoration on all lenses (replaced by bz-fortification-layer)
    active.delete("fxs-conquest-layer");
    allowed.delete("fxs-conquest-layer");
    // fix Hex Grid: move from active to allowed so it's user-toggleable
    if (active.has("fxs-hexgrid-layer")) {
        active.delete("fxs-hexgrid-layer");
        allowed.add("fxs-hexgrid-layer");
    }
}
// fix Hex Grid initial visibility
if (!LensManager.enabledLayers.has("fxs-hexgrid-layer")) {
    LensManager.layers.get("fxs-hexgrid-layer")?.removeLayer();
}
// make all optional default lens layers active
const defaultLens = LensManager.lenses.get("fxs-default-lens");
if (defaultLens) {
    for (const layerType of defaultLens.allowedLayers) {
        defaultLens.activeLayers.add(layerType);
    }
    defaultLens.allowedLayers.clear();
}
const discoveryLens = LensManager.lenses.get("fxs-discovery-lens");
if (discoveryLens) {
    discoveryLens.allowedLayers.delete("fxs-yields-layer");
    delete discoveryLens.skipCachingEnabledLayers;
}

// PanelMiniMap: add City and Units subpanel buttons
const BZ_ICON_CITY_BUTTON = "blp:Yield_Cities";
const BZ_ICON_UNIT_BUTTON = "blp:Action_Promote";
Controls.preloadImage(BZ_ICON_CITY_BUTTON, "homi-mini-map");
Controls.preloadImage(BZ_ICON_UNIT_BUTTON, "homi-mini-map");
Controls.preloadImage("blp:hud_sub_circle_bk", "homi-mini-map");
Controls.preloadImage("blp:hud_sub_circle_hov", "homi-mini-map");
class bzPanelMiniMap {
    static c_prototype;
    static instance;
    static toggleCooldownTimer = 500;
    citySubpanel = null;
    unitsSubpanel = null;
    engineInputListener = this.onEngineInput.bind(this);
    toggleCooldown = 0;
    toggleQueued = false;
    constructor(component) {
        bzPanelMiniMap.instance = this;
        this.component = component;
        component.bzComponent = this;
        this.patchPrototypes(this.component);
    }
    patchPrototypes(component) {
        const c_prototype = Object.getPrototypeOf(component);
        if (bzPanelMiniMap.c_prototype == c_prototype) return;
        const proto = bzPanelMiniMap.c_prototype = c_prototype;
        const afterInitialize = this.afterInitialize;
        const onInitialize = proto.onInitialize;
        proto.onInitialize = function(...args) {
            const c_rv = onInitialize.apply(this, args);
            const after_rv = afterInitialize.apply(this.bzComponent, args);
            return after_rv ?? c_rv;
        }
    }
    afterInitialize() {
        this.component.Root.classList.add("bz-mini-map");
        this.component.addSubpanel(
            "bz-city-panel",
            "LOC_UI_RESOURCE_ALLOCATION_SETTLEMENTS",
            BZ_ICON_CITY_BUTTON,
        );
        this.citySubpanel = this.component.subpanels.at(-1);
        this.cityButton = this.component.miniMapButtonRow.lastChild;
        this.cityButton.classList.add("bz-city-button");
        this.component.addSubpanel(
            "bz-units-panel",
            "LOC_UI_PRODUCTION_UNITS",
            BZ_ICON_UNIT_BUTTON,
        );
        this.unitsSubpanel = this.component.subpanels.at(-1);
        this.unitsButton = this.component.miniMapButtonRow.lastChild;
        this.unitsButton.classList.add("bz-units-button");
    }
    beforeAttach() { }
    afterAttach() {
        this.component.Root.addEventListener(InputEngineEventName, this.engineInputListener);
    }
    beforeDetach() {
        this.component.Root.removeEventListener(InputEngineEventName, this.engineInputListener);
    }
    afterDetach() { }
    togglePanel(panel) {
        this.toggleQueued = true;
        if (this.toggleCooldown) return;
        const toggle = () => {
            if (this.toggleQueued) {
                this.toggleCooldown =
                    setTimeout(() => toggle(), bzPanelMiniMap.toggleCooldownTimer);
                if (panel) {
                    this.component.toggleSubpanel(panel);
                } else {
                    this.component.closeSubpanels();
                }
            } else {
                this.toggleCooldown = 0;
            }
            this.toggleQueued = false;
        }
        toggle();
    }
    onEngineInput(inputEvent) {
        if (inputEvent.detail.status != InputActionStatuses.FINISH) return;
        switch (inputEvent.detail.name) {
            case "keyboard-escape":
                if (this.component.chatPanelState) this.component.toggleChatPanel();
                if (this.component.lensPanelState) this.component.toggleLensPanel();
                // fall through
            case "cancel":
            case "sys-menu":
                if (this.component.activeSubpanel) this.togglePanel();
                inputEvent.stopPropagation();
                inputEvent.preventDefault();
                break;
        }
    }
}
// engine.on("InputAction") fires for any registered action (unlike hotkey-manager.js
// which only dispatches window "hotkey-*" events for a hardcoded list).
engine.on("InputAction", (name, status) => {
    if (status !== InputActionStatuses.FINISH) return;
    const inst = bzPanelMiniMap.instance;
    if (!inst) return;
    if (name === "open-bz-city-panel") {
        inst.togglePanel(inst.citySubpanel);
    } else if (name === "open-bz-units-panel") {
        inst.togglePanel(inst.unitsSubpanel);
    }
});
Controls.decorate("panel-mini-map", (val) => new bzPanelMiniMap(val));

// Hardcoded English labels for our custom layer checkboxes —
// mod-defined shell-scope loc keys are not reliably resolvable in game-scope UI context.
const BZ_LAYER_DISPLAY_NAMES = {
    "bz-discovery-layer":       "Discoveries",
    "bz-culture-borders-layer": "Borders",
    "bz-city-borders-layer":    "City Limits",
    "bz-wonder-layer":          "Wonders",
    "bz-fortification-layer":     "Fortifications",
    "bz-vegetation-layer":        "Vegetation",
    "homi-rail-station-layer":    "Rail Stations",
    "homi-explorer-layer":        "Explorer",
    "homi-settlement-bounds-layer": "Settlement Bounds",
};

// LensPanel: add checkboxes for our layers and hide vanilla border checkboxes
class bzLensPanel {
    static c_prototype;
    constructor(component) {
        component.bzComponent = this;
        this.component = component;
    }
    beforeAttach() { }
    afterAttach() {
        for (const [layer, name] of Object.entries(BZ_LAYERS)) {
            this.component.createLayerCheckbox(name, layer);
        }
        // Override labels after l10n has processed data-l10n-id (it runs async via
        // MutationObserver, so defer to a setTimeout to win the race).
        // Use nextElementSibling instead of querySelector to avoid role-attribute issues.
        const overrideLabels = () => {
            for (const [layer, displayName] of Object.entries(BZ_LAYER_DISPLAY_NAMES)) {
                const checkbox = this.component.layerElementMap[layer];
                const label = checkbox?.nextElementSibling;
                if (!label) continue;
                label.removeAttribute("data-l10n-id");
                label.textContent = displayName;
            }
        };
        overrideLabels();          // try immediately (synchronous l10n engines)
        setTimeout(overrideLabels, 0);   // retry after l10n microtask flushes
        // hide vanilla border layer entries (replaced by bz layers)
        for (const layer of ["fxs-city-borders-layer", "fxs-culture-borders-layer"]) {
            const checkbox = this.component.layerElementMap[layer];
            if (checkbox) checkbox.parentElement.style.display = "none";
        }
    }
    beforeDetach() { }
    afterDetach() { }
}
Controls.decorate("lens-panel", (component) => new bzLensPanel(component));

export { bzPanelMiniMap };
