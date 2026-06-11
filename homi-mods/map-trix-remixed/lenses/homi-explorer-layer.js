// Explorer decoration layer — places building icons on hexes containing
// Universities or Museums (including the unique BUILDING_UNIVERSITY_MO variant).
//
// Uses the same player.Constructibles.getConstructibles() approach as the
// Rail Station layer — buildings are NOT in MapConstructibles.getConstructibles().

import LensManager from '/core/ui/lenses/lens-manager.js';
import PlotIconsManager from '/core/ui/plot-icons/plot-icons-manager.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

const ICON_TYPE = "homi-plot-icon-explorer";

// Maps constructible type → blp icon
const EXPLORER_TYPES = new Map([
    ["BUILDING_UNIVERSITY",    "blp:buildicon_university"],
    ["BUILDING_UNIVERSITY_MO", "blp:buildicon_university"],
    ["BUILDING_MUSEUM",        "blp:buildicon_museum"],
]);

// ---------------------------------------------------------------------------
// Plot icon component
// ---------------------------------------------------------------------------

class HomiPlotIconExplorer extends Component {
    onInitialize() {
        const icon = this.Root.getAttribute("icon") ?? "blp:buildicon_university";
        this.Root.style.backgroundImage = `url("${icon}")`;
        this.Root.style.filter = 'drop-shadow(0 0 4px black) drop-shadow(0 0 6px black) drop-shadow(0 0 8px black)';
        this.Root.classList.add(
            "size-12",
            "bg-cover",
            "bg-no-repeat",
            "bg-center",
            "pointer-events-none",
        );
    }
}
Controls.define("homi-plot-icon-explorer", { createInstance: HomiPlotIconExplorer });

// ---------------------------------------------------------------------------
// Lens layer
// ---------------------------------------------------------------------------

class HomiExplorerLayer {
    visible = false;

    initLayer() { }

    applyLayer() {
        this.visible = true;
        engine.on("ConstructibleAddedToMap",     this.onConstructibleChange, this);
        engine.on("ConstructibleRemovedFromMap",  this.onConstructibleChange, this);
        engine.on("CityLiberated",               this.onFullRefresh,         this);
        engine.on("CityConquered",               this.onFullRefresh,         this);
        this.updateMap();
    }

    removeLayer() {
        this.visible = false;
        engine.off("ConstructibleAddedToMap",     this.onConstructibleChange, this);
        engine.off("ConstructibleRemovedFromMap",  this.onConstructibleChange, this);
        engine.off("CityLiberated",               this.onFullRefresh,         this);
        engine.off("CityConquered",               this.onFullRefresh,         this);
        PlotIconsManager.removePlotIcons(ICON_TYPE);
    }

    getOptionName() {
        return "hoMiShowExplorer";
    }

    updateMap() {
        PlotIconsManager.removePlotIcons(ICON_TYPE);
        const observer = GameContext.localObserverID;
        Players.getAlive().forEach(player => {
            const cons = player.Constructibles?.getConstructibles();
            if (!cons) return;
            for (const con of cons) {
                const info = GameInfo.Constructibles.lookup(con.type);
                if (!info) continue;
                const icon = EXPLORER_TYPES.get(info.ConstructibleType);
                if (!icon) continue;
                const loc = con.location;
                if (!loc) continue;
                const vis = GameplayMap.getRevealedState(observer, loc.x, loc.y);
                if (vis === RevealedStates.HIDDEN) continue;
                PlotIconsManager.addPlotIcon(ICON_TYPE, loc, new Map([["icon", icon]]));
            }
        });
    }

    onConstructibleChange(_data) {
        if (this.visible) this.updateMap();
    }
    onFullRefresh(_data) {
        if (this.visible) this.updateMap();
    }
}

LensManager.registerLensLayer("homi-explorer-layer", new HomiExplorerLayer());
