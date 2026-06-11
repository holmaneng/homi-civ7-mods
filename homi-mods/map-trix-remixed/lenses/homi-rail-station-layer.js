// Rail Station decoration layer — places a train icon on every hex where
// BUILDING_RAIL_STATION (or BUILDING_RAILYARD, the American unique variant) was built.
//
// Key API note: buildings are NOT in MapConstructibles.getConstructibles() —
// that only returns improvements/wonders.  Buildings are in
//   player.Constructibles.getConstructibles()
// which returns objects with .type (hash) and .location {x, y}.

import LensManager from '/core/ui/lenses/lens-manager.js';
import PlotIconsManager from '/core/ui/plot-icons/plot-icons-manager.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

const ICON_TYPE  = "homi-plot-icon-rail-station";
const RAIL_TYPES = new Set(["BUILDING_RAIL_STATION", "BUILDING_RAILYARD"]);

// ---------------------------------------------------------------------------
// Plot icon component
// ---------------------------------------------------------------------------

class HomiPlotIconRailStation extends Component {
    onInitialize() {
        this.Root.style.backgroundImage = 'url("blp:buildicon_railstation")';
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
Controls.define("homi-plot-icon-rail-station", { createInstance: HomiPlotIconRailStation });

// ---------------------------------------------------------------------------
// Lens layer
// ---------------------------------------------------------------------------

class HomiRailStationLayer {
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
        return "hoMiShowRailStations";
    }

    // Rebuild all icons from scratch.
    // player.Constructibles.getConstructibles() returns ALL constructibles for
    // a player including buildings, each with a .type hash and .location {x, y}.
    updateMap() {
        PlotIconsManager.removePlotIcons(ICON_TYPE);
        const observer = GameContext.localObserverID;
        Players.getAlive().forEach(player => {
            const cons = player.Constructibles?.getConstructibles();
            if (!cons) return;
            for (const con of cons) {
                const info = GameInfo.Constructibles.lookup(con.type);
                if (!info || !RAIL_TYPES.has(info.ConstructibleType)) continue;
                // Only show on revealed tiles.
                const loc = con.location;
                if (!loc) continue;
                const vis = GameplayMap.getRevealedState(observer, loc.x, loc.y);
                if (vis === RevealedStates.HIDDEN) continue;
                PlotIconsManager.addPlotIcon(ICON_TYPE, loc, new Map());
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

LensManager.registerLensLayer("homi-rail-station-layer", new HomiRailStationLayer());
