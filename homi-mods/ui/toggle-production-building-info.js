// Toggles ProductionPanelBuildingInfoType between "base-yield" and "yield-preview"
// when the "toggle-production-building-info" input action fires (default: I key).
//
// Uses engine.on("InputAction") rather than window "engine-input" so the handler
// fires regardless of which panel has DOM focus or which ContextManager path is taken.

const ACTION_NAME = "toggle-production-building-info";
const MODE_BASE_YIELD = "base-yield";
const MODE_YIELD_PREVIEW = "yield-preview";

engine.on("InputAction", (name, status) => {
	if (name !== ACTION_NAME) return;
	if (status !== InputActionStatuses.FINISH) return;

	const user = Configuration.getUser();
	const current = user.productionPanelBuildingInfoType;
	const next = current === MODE_YIELD_PREVIEW ? MODE_BASE_YIELD : MODE_YIELD_PREVIEW;
	user.setProductionPanelBuildingInfoType(next);

	engine.trigger("UI_OptionsChanged");

	// If the production chooser is open, trigger its item list to re-render next frame.
	const panelEl = document.querySelector("panel-production-chooser");
	panelEl?.maybeComponent?.updateItems?.call("toggle-production-building-info");
});
