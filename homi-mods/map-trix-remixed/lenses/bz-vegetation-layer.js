// Highlights FEATURE_CLASS_VEGETATED hexes (forest/jungle) with a dark green
// semi-transparent overlay — marks hexes that block line of sight for attacks.

import LensManager from '/core/ui/lenses/lens-manager.js';
import { OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.js';
import { HexToFloat4 } from '/core/ui/utilities/utilities-color.js';
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

// HexToFloat4(0xRRGGBB, alpha 0-1)
// Very dark forest green at 95% opacity
const VEGETATION_COLOR = { fillColor: HexToFloat4(0x071507, 0.95) };

class bzVegetationLayer {
    overlayGroup = WorldUI.createOverlayGroup(
        "bzVegetationOverlayGroup",
        OVERLAY_PRIORITY.CONTINENT_LENS
    );
    plotOverlay = this.overlayGroup.addPlotOverlay();

    initLayer() {
        this.overlayGroup.setVisible(false);
    }
    applyLayer() {
        this.updateMap();
        this.overlayGroup.setVisible(true);
    }
    removeLayer() {
        this.overlayGroup.setVisible(false);
    }
    getOptionName() {
        return "bzShowVegetation";
    }
    updateMap() {
        this.overlayGroup.clearAll();
        this.plotOverlay.clear();
        const vegetatedPlots = [];
        const width = GameplayMap.getGridWidth();
        const height = GameplayMap.getGridHeight();
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const fid = GameplayMap.getFeatureType(x, y);
                const finfo = GameInfo.Features.lookup(fid);
                if (finfo?.FeatureClassType === "FEATURE_CLASS_VEGETATED") {
                    vegetatedPlots.push({ x, y });
                }
            }
        }
        if (vegetatedPlots.length > 0) {
            this.plotOverlay.addPlots(vegetatedPlots, VEGETATION_COLOR);
        }
    }
}
LensManager.registerLensLayer("bz-vegetation-layer", new bzVegetationLayer());
