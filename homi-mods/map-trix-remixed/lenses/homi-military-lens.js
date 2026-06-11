// Auto-activates when a military (combat) unit is selected.
// Mirrors the default lens layer set but adds bz-vegetation-layer so
// vegetated terrain is always highlighted during combat planning.
//
// Lens switch logic:
//   transitionTo  → patched setUnitLens routes here for combat/commander units
//   transitionFrom → patched to return to fxs-default-lens on deselect

import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import LensManager from '/core/ui/lenses/lens-manager.js';
// guarantee the handler is registered before we patch it
import '/base-standard/ui/interface-modes/interface-mode-unit-selected.js';
// guarantee bz-panel-mini-map patches are applied before lens init
import '/homi-mods/map-trix-remixed/mini-map/bz-panel-mini-map.js';

// Register the lens.
// activeLayers mirrors what fxs-default-lens ends up with after bz-panel-mini-map
// patching, plus bz-vegetation-layer which is the reason this lens exists.
class HomeMilitaryLens {
    activeLayers = new Set([
        "fxs-operation-target-layer",
        "bz-culture-borders-layer",
        "bz-discovery-layer",
        "fxs-hexgrid-layer",
        "fxs-resource-layer",
        "fxs-yields-layer",
        "bz-fortification-layer",
        "bz-vegetation-layer",
        "homi-rail-station-layer",
    ]);
    allowedLayers = new Set();
    blendEnabledLayersOnTransition = false;
}
LensManager.registerLens("homi-military-lens", new HomeMilitaryLens());

// Build the autoExplore type set the same way the base game does so we can
// faithfully replicate the "would go to fxs-discovery-lens?" check.
const hoMiAutoExploreTypes = new Set();
GameInfo.TypeTags.forEach(t => {
    if (t.Tag == "UNIT_CLASS_AUTOEXPLORE") hoMiAutoExploreTypes.add(t.Type);
});
const hoMiCurrentAgeType = GameInfo.Ages.lookup(Game.age)?.AgeType ?? "";

// Patch UnitSelectedInterfaceMode.setUnitLens so that combat / commander units
// activate homi-military-lens instead of fxs-default-lens.
const hoMiHandler = InterfaceMode.getInterfaceModeHandler("INTERFACEMODE_UNIT_SELECTED");
if (hoMiHandler) {
    const orig_setUnitLens = hoMiHandler.setUnitLens.bind(hoMiHandler);
    hoMiHandler.setUnitLens = function(unitID) {
        const unit = Units.get(unitID);
        if (unit) {
            const unitDef = GameInfo.Units.lookup(unit.type);
            if (unitDef) {
                // Let special-purpose lenses (settler, trade, continent, discovery) handle
                // their own units first — only intercept units that would fall to default.
                const goesToDefault =
                    !unitDef.FoundCity &&
                    !unitDef.MakeTradeRoute &&
                    !(unitDef.ExtractsArtifacts &&
                      hoMiCurrentAgeType === "AGE_MODERN") &&
                    !hoMiAutoExploreTypes.has(unitDef.UnitType) &&
                    !(unitDef.FormationClass === "FORMATION_CLASS_NAVAL" &&
                      hoMiCurrentAgeType === "AGE_EXPLORATION");

                if (goesToDefault) {
                    // Only redirect actual combat / command units, not builders etc.
                    const stats = GameInfo.Unit_Stats.lookup(unitDef.UnitType);
                    const isMilitary =
                        unitDef.FormationClass === "FORMATION_CLASS_COMMAND" ||
                        (stats && (stats.Combat > 0 || stats.RangedCombat > 0));
                    if (isMilitary) {
                        LensManager.setActiveLens("homi-military-lens");
                        return;
                    }
                }
            }
        }
        orig_setUnitLens(unitID);
    };

    // Patch transitionFrom: the base game's logic skips setActiveLens for units that
    // don't match the settler/trade special cases — so homi-military-lens would linger
    // after deselection.  Explicitly switch back to default-lens when leaving it.
    const orig_transitionFrom = hoMiHandler.transitionFrom.bind(hoMiHandler);
    hoMiHandler.transitionFrom = function(oldMode, newMode) {
        if (LensManager.getActiveLens() === "homi-military-lens") {
            LensManager.setActiveLens("fxs-default-lens");
        }
        orig_transitionFrom.call(this, oldMode, newMode);
    };
} else {
    console.warn("homi-military-lens: could not find INTERFACEMODE_UNIT_SELECTED handler to patch.");
}
