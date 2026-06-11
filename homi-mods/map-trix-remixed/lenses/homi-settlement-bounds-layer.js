// Settlement Bounds layer — draws a semi-transparent dotted perimeter showing
// the maximum 3-tile working radius of each settlement.
//
// Uses the same WorldUI.createOverlayGroup / addBorderOverlay system as
// bz-city-borders-layer. CultureBorder_CityState_Open gives a dotted line.
// GameplayMap.getPlotIndicesInRadius(x, y, 3) returns all plots in range.
//
// Each city gets a unique group (keyed by its location index) so adjacent
// cities' ranges show a boundary where they meet, and the outer edge of every
// settlement's range is always clearly bordered.

import LensManager from '/core/ui/lenses/lens-manager.js';
import { OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

const BOUNDS_RADIUS = 3;

// Semi-transparent white dashes; transparent gaps.
const BOUNDS_STYLE = {
    style:          "CultureBorder_CityState_Open",
    primaryColor:   0xA0FFFFFF,   // ~63% white
    secondaryColor: 0x00000000,   // transparent gaps
};

const ZOOM_THICKNESS = 3;

class HomiSettlementBoundsLayer {
    visible = false;

    constructor() {
        this.overlayGroup = WorldUI.createOverlayGroup(
            "hoMiSettlementBoundsGroup", OVERLAY_PRIORITY.CULTURE_BORDER
        );
        this.borderOverlay = this.overlayGroup.addBorderOverlay(BOUNDS_STYLE);
        this.lastZoom = -1;
        this.onCameraChanged = (cam) => {
            if (this.lastZoom !== cam.zoomLevel) {
                this.lastZoom = cam.zoomLevel;
                this.borderOverlay.setThicknessScale(cam.zoomLevel * ZOOM_THICKNESS);
            }
        };
    }

    initLayer() {
        this.overlayGroup.setVisible(false);
        engine.on("CameraChanged", this.onCameraChanged);
    }

    applyLayer() {
        this.visible = true;
        engine.on("CityFounded",   this.onRefresh, this);
        engine.on("CityDestroyed", this.onRefresh, this);
        engine.on("CityConquered", this.onRefresh, this);
        engine.on("CityLiberated", this.onRefresh, this);
        this.updateBounds();
        this.overlayGroup.setVisible(true);
    }

    removeLayer() {
        this.visible = false;
        engine.off("CityFounded",   this.onRefresh, this);
        engine.off("CityDestroyed", this.onRefresh, this);
        engine.off("CityConquered", this.onRefresh, this);
        engine.off("CityLiberated", this.onRefresh, this);
        this.overlayGroup.setVisible(false);
    }

    getOptionName() {
        return "hoMiShowSettlementBounds";
    }

    updateBounds() {
        this.borderOverlay.clear();
        Players.getAlive().forEach(player => {
            for (const city of player.Cities?.getCities() ?? []) {
                const groupId = GameplayMap.getIndexFromLocation(city.location);
                const plots = GameplayMap.getPlotIndicesInRadius(
                    city.location.x, city.location.y, BOUNDS_RADIUS
                );
                this.borderOverlay.setPlotGroups(plots, groupId);
                this.borderOverlay.setGroupStyle(groupId, BOUNDS_STYLE);
            }
        });
    }

    onRefresh() {
        if (this.visible) this.updateBounds();
    }
}

LensManager.registerLensLayer("homi-settlement-bounds-layer", new HomiSettlementBoundsLayer());
