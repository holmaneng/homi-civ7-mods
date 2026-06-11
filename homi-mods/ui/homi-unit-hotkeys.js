// Hotkeys for pack / unpack unit commands.
//   G — Add To Commander   (UNITCOMMAND_ADD_TO_ARMY)
//   T — Leave Commander    (UNITCOMMAND_REMOVE_FROM_ARMY)
//
// Both commands use UnitActionHandlers.switchToActionInterfaceMode, which
// handles target-selection for Add To Commander and direct execution for
// Leave Commander, matching how the vanilla UI buttons work.

import { UnitActionHandlers } from '/base-standard/ui/unit-interact/unit-action-handlers.js';

engine.on("InputAction", (name, status) => {
    if (status !== InputActionStatuses.FINISH) return;

    let command;
    if      (name === "homi-pack-unit")   command = "UNITCOMMAND_ADD_TO_ARMY";
    else if (name === "homi-unpack-unit") command = "UNITCOMMAND_REMOVE_FROM_ARMY";
    else return;

    const unitID = UI.Player.getHeadSelectedUnit();
    if (!unitID) return;

    const check = Game.UnitCommands.canStart(unitID, command, {}, false);
    if (!check?.Success) return;

    UnitActionHandlers.switchToActionInterfaceMode(command, {
        UnitID: unitID,
        CommandArguments: {}
    });
});
