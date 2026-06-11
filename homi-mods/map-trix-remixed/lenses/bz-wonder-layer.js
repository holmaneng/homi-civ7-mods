// Ported from bszonye/civ7-map-trix (bz-wonder-layer.js).
// Removed: bz-panel-mini-map import (layer won't appear in default lens without it).
// TODO: replace placeholder icon with a proper wonder icon and register it in
//       modinfo ImportFiles as "map-trix-remixed/icons/bz-wonder-decoration.png".

import LensManager from '/core/ui/lenses/lens-manager.js';
import PlotIconsManager from '/core/ui/plot-icons/plot-icons-manager.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

class bzPlotIconWonders extends Component {
    location = { x: -1, y: -1 };
    onInitialize() {
        const wonderType = this.Root.getAttribute("wonder");
        this.location.x = parseInt(this.Root.getAttribute("x") ?? "-1");
        this.location.y = parseInt(this.Root.getAttribute("y") ?? "-1");
        // Natural wonders use the discovery/artifact icon; constructed wonders use the
        // game's registered wonder icon (blp:fonticon_wonders).
        const iconUrl = wonderType === "WONDER"
            ? "url(fs://game/homi-mods/icons/bz-wonder-decoration.png)"
            : "url(fs://game/action_naturalartifacts.png)";
        this.Root.style.backgroundImage = iconUrl;
        this.Root.classList.add(
            "size-20",
            "bg-cover",
            "bg-no-repeat",
            "bg-center",
            "cursor-info",
        );
    }
}
Controls.define("bz-plot-icon-wonders", {
  createInstance: bzPlotIconWonders
});

// bugfix for plot-icons-root (patched upstream by bszonye)
class bzPlotIconsRoot {
    static c_prototype;
    static c_on_removeIcon;
    constructor(component) {
        this.component = component;
        component.bzComponent = this;
        this.patchPrototypes(this.component);
    }
    patchPrototypes(component) {
        const c_prototype = Object.getPrototypeOf(component);
        if (bzPlotIconsRoot.c_prototype == c_prototype) return;
        const proto = bzPlotIconsRoot.c_prototype = c_prototype;
        bzPlotIconsRoot.c_onRemoveIcon = proto.onRemoveIcon;
        proto.onRemoveIcon = function(event) {
            return this.bzComponent.onRemoveIcon(event);
        }
        component.removeIconListener = component.onRemoveIcon.bind(component);
    }
    beforeAttach() { }
    afterAttach() { }
    beforeDetach() { }
    afterDetach() { }
    onRemoveIcon(event) {
        const type = event.detail.plotType;
        if (type == null) {
            console.error('plot-icons-root: onRemoveIcon event detail failed to contain valid "plotType" member!');
            return;
        }
        const location = event.detail.plotLocation;
        if (location) {
            const query = `[x="${location.x}"][y="${location.y}"]`;
            const locationRoot = this.component.Root.querySelector(query);
            if (locationRoot) {
                const plotIcon = locationRoot.querySelector(type);
                if (plotIcon) {
                    locationRoot.removeChild(plotIcon);
                }
            }
        } else {
            const plotIcons = this.component.Root.querySelectorAll(type);
            plotIcons.forEach((plotIcon) => {
                plotIcon.parentElement?.removeChild(plotIcon);
            });
        }
    }
}
Controls.decorate("plot-icons-root", (val) => new bzPlotIconsRoot(val));

class bzWonderLensLayer {
    onLayerHotkeyListener = this.onLayerHotkey.bind(this);
    visible = false;
    initLayer() {
        engine.on("ConstructibleAddedToMap", this.onPlotChange, this);
        engine.on("ConstructibleRemovedFromMap", this.onPlotChange, this);
        window.addEventListener("layer-hotkey", this.onLayerHotkeyListener);
    }
    applyLayer() {
        this.visible = true;
        this.updateMap();
    }
    removeLayer() {
        this.visible = false;
        PlotIconsManager.removePlotIcons("bz-plot-icon-wonders");
    }
    getOptionName() {
        return "bzShowMapDiscoveries";
    }
    updateMap() {
        const width = GameplayMap.getGridWidth();
        const height = GameplayMap.getGridHeight();
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                this.updatePlot({ x, y });
            }
        }
    }
    updatePlot(loc) {
        const getPlotIcon = () => {
            const plotIcon = PlotIconsManager.getPlotIcon(loc.x, loc.y);
            if (!plotIcon) return null;
            for (const child of plotIcon.Root.children) {
                if (child.tagName == "BZ-PLOT-ICON-WONDERS") return child;
            }
            return null;
        }
        const updatePlotIcon = (icon) => {
            if (Boolean(icon) === Boolean(getPlotIcon())) return;
            if (icon) {
                PlotIconsManager.addPlotIcon(
                    "bz-plot-icon-wonders", loc, new Map([["wonder", icon]])
                );
            } else {
                PlotIconsManager.removePlotIcons("bz-plot-icon-wonders", loc);
            }
        }
        if (GameplayMap.isNaturalWonder(loc.x, loc.y)) {
            const feature = GameplayMap.getFeatureType(loc.x, loc.y);
            const player = Players.get(GameContext.localPlayerID);
            const hasArtifact =
                Game.age == Game.getHash("AGE_MODERN") &&
                LensManager.getActiveLens() == "fxs-continent-lens" &&
                player.Stats?.hasNaturalWonderArtifact(feature);
            if (!hasArtifact) {
                updatePlotIcon("NATURAL_WONDER");
                return;
            }
        }
        const cons = MapConstructibles.getConstructibles(loc.x, loc.y);
        for (const con of cons) {
            const item = Constructibles.getByComponentID(con);
            if (!item) continue;
            const info = GameInfo.Constructibles.lookup(item.type);
            if (!info || info.ConstructibleClass != "WONDER") continue;
            updatePlotIcon("WONDER");
            return;
        }
        updatePlotIcon(null);
    }
    onPlotChange(data) {
        if (this.visible) this.updatePlot(data.location);
    }
    onLayerHotkey(hotkey) {
        if (hotkey.detail.name == "toggle-bz-wonder-layer") {
            LensManager.toggleLayer("bz-wonder-layer");
        }
    }
}
LensManager.registerLensLayer("bz-wonder-layer", new bzWonderLensLayer());
