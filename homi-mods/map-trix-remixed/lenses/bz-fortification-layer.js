// Fortification decoration — shows the controlling civ's emblem on every
// defensible district (city centers + districts with wall constructibles).
// Uses PlotIconsManager (same confirmed-working API as bz-wonder-layer) and
// the 1.4.0 conquest-layer district detection API.
//
// NOTE: requires a full game restart to pick up changes (session reload is not enough).

import LensManager from '/core/ui/lenses/lens-manager.js';
import PlotIconsManager from '/core/ui/plot-icons/plot-icons-manager.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

// HTML component — renders the controlling civ's emblem as a background image.
class bzFortificationIcon extends Component {
    onInitialize() {
        const civType = this.Root.getAttribute("civ-type");
        let bgImage = `url("blp:fi_city_fortified_64")`;  // fallback
        if (civType) {
            const iconUrl = UI.getIconURL(civType);
            if (iconUrl) bgImage = `url("${iconUrl}")`;
        }
        this.Root.style.backgroundImage = bgImage;
        this.Root.classList.add(
            "size-16",
            "bg-contain",
            "bg-no-repeat",
            "bg-center",
            "pointer-events-none",
        );
    }
}
Controls.define("bz-fortification-icon", { createInstance: bzFortificationIcon });

class bzFortificationLayer {
    visible = false;

    initLayer() { }

    applyLayer() {
        this.visible = true;
        engine.on("PlotVisibilityChanged",      this.onPlotChange,    this);
        engine.on("ConstructibleAddedToMap",    this.onPlotChange,    this);
        engine.on("ConstructibleRemovedFromMap", this.onPlotChange,   this);
        engine.on("DistrictControlChanged",     this.onControlChange, this);
        this.updateMap();
    }
    removeLayer() {
        this.visible = false;
        engine.off("PlotVisibilityChanged",      this.onPlotChange,    this);
        engine.off("ConstructibleAddedToMap",    this.onPlotChange,    this);
        engine.off("ConstructibleRemovedFromMap", this.onPlotChange,   this);
        engine.off("DistrictControlChanged",     this.onControlChange, this);
        PlotIconsManager.removePlotIcons("bz-fortification-icon");
    }
    getOptionName() {
        return "bzShowMapFortifications";
    }

    updateMap() {
        PlotIconsManager.removePlotIcons("bz-fortification-icon");
        const observer = GameContext.localObserverID;
        const width    = GameplayMap.getGridWidth();
        const height   = GameplayMap.getGridHeight();
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                this.updatePlot({ x, y });
            }
        }
    }
    updatePlot(loc) {
        PlotIconsManager.removePlotIcons("bz-fortification-icon", loc);
        const observer  = GameContext.localObserverID;
        const revealed  = GameplayMap.getRevealedState(observer, loc.x, loc.y);
        if (revealed === RevealedStates.HIDDEN) return;
        const plotIndex = GameplayMap.getIndexFromLocation(loc);
        const district  = Districts.getAtLocation(plotIndex);
        if (!district || !district.isDefensible) return;
        const controller = Players.get(district.controllingPlayer);
        if (!controller) return;
        const civ = GameInfo.Civilizations.lookup(controller.civilizationType);
        if (!civ) return;
        PlotIconsManager.addPlotIcon(
            "bz-fortification-icon", loc,
            new Map([["civ-type", civ.CivilizationType]])
        );
    }

    onPlotChange(data) {
        if (this.visible && data?.location) this.updatePlot(data.location);
    }
    onControlChange() {
        if (this.visible) this.updateMap();
    }
}
LensManager.registerLensLayer("bz-fortification-layer", new bzFortificationLayer());
