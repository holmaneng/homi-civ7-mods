// Augments city-state / independent-power rows in the player's own diplomacy
// panel with icons for any active diplomatic projects.
//
// Icon colour coding:
//   normal  — local player is running this project (with turn-count label)
//   gray    — another leader is running this project (no turn count)
//   red     — both the local player AND another leader are running the same
//             project against the same city-state (contention; local turn count shown)
//
// Key timing notes:
//  - The panel uses window "interface-mode-changed" (not an engine event) to
//    trigger its own repopulation, which recreates the row DOM.
//  - After that event the panel waits 83ms before populating rows, so we
//    schedule with a 200ms delay to reliably run after the rows exist.
//  - Engine events (DiplomacyEventEnded etc.) do NOT recreate the rows, so
//    we must clear our own augmentation before re-running (scheduleRefresh).
//  - ROW_ATTR prevents double-augmenting rows in the same DOM lifecycle.

import '/base-standard/ui/diplomacy-actions/panel-player-diplomacy.js';
import { RaiseDiplomacyEvent } from '/base-standard/ui/diplomacy/diplomacy-events.js';

const ROW_ATTR     = "data-homi-dip";
const STRIP_CLASS  = "homi-dip-strip";
const SPACER_CLASS = "homi-dip-spacer";

// CSS filter chains for colorising background-image icons.
const FILTER_GRAY       = "grayscale(1) brightness(0.65)";
const FILTER_CONTENTION = "grayscale(1) sepia(1) saturate(4) hue-rotate(310deg)";

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/**
 * All active diplomatic actions ANY player is running against playerID,
 * excluding war declarations and alliance formations.
 */
function getActionsFor(playerID) {
    return Game.Diplomacy.getPlayerEvents(playerID).filter(a =>
        a.actionType != DiplomacyActionTypes.DIPLOMACY_ACTION_DECLARE_WAR &&
        a.actionType != DiplomacyActionTypes.DIPLOMACY_ACTION_FORM_ALLIANCE
    );
}

/**
 * Map of Locale.stylize(civilizationFullName) → playerID for all met
 * minor / independent powers — used to tie each rendered row to a player.
 */
function buildNameLookup() {
    const map = new Map();
    const localDip = Players.get(GameContext.localPlayerID)?.Diplomacy;
    Players.getAlive().forEach(p => {
        if ((p.isMinor || p.isIndependent) && localDip?.hasMet(p.id)) {
            map.set(Locale.stylize(p.civilizationFullName), p.id);
        }
    });
    return map;
}

// ---------------------------------------------------------------------------
// Camera pan
// ---------------------------------------------------------------------------

/** Pan the camera to a city-state/independent player's first district on the map. */
function panToPlayer(playerID) {
    const w = GameplayMap.getGridWidth();
    const h = GameplayMap.getGridHeight();
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const d = Districts.getAtLocation(GameplayMap.getIndexFromLocation({x, y}));
            if (d?.owner == playerID) {
                Camera.lookAtPlot({x, y});
                return;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Row augmentation
// ---------------------------------------------------------------------------

function augmentRow(row, playerID) {
    const localID = GameContext.localPlayerID;
    const actions = getActionsFor(playerID);
    if (actions.length === 0) return;

    // Split into local (keyed by actionType) and foreign (set of actionTypes).
    const localByType = new Map();
    const foreignTypes = new Set();
    for (const action of actions) {
        if (action.initialPlayer === localID) {
            localByType.set(action.actionType, action);
        } else {
            foreignTypes.add(action.actionType);
        }
    }

    const allTypes = new Set([...localByType.keys(), ...foreignTypes]);
    if (allTypes.size === 0) return;

    const contentContainer = row.querySelector(".flex.items-center.size-full");
    if (!contentContainer) return;

    // Spacer pushes the icon strip to the right edge.
    const spacer = document.createElement("div");
    spacer.classList.add("flex-1", SPACER_CLASS);
    contentContainer.appendChild(spacer);

    const strip = document.createElement("div");
    strip.classList.add(
        "flex", "flex-row", "items-center", "gap-1",
        "pr-2", "pointer-events-none", STRIP_CLASS
    );

    for (const actionType of allTypes) {
        const localAction = localByType.get(actionType);
        const hasForeign  = foreignTypes.has(actionType);

        const def = GameInfo.DiplomacyActions.lookup(actionType);
        if (!def) continue;

        const slot = document.createElement("div");
        slot.classList.add("flex", "flex-col", "items-center");
        slot.setAttribute("data-tooltip-content", Locale.compose(def.Name));

        const icon = document.createElement("div");
        icon.classList.add("size-10", "bg-cover", "bg-center", "bg-no-repeat");
        icon.style.backgroundImage = `url("${def.UIIconPath}")`;

        if (localAction && hasForeign) {
            icon.style.filter = FILTER_CONTENTION;   // both — red
        } else if (hasForeign) {
            icon.style.filter = FILTER_GRAY;          // foreign only — gray
        }
        // local only — no filter (normal colour)

        slot.appendChild(icon);

        // Turn count label: local player's project only.
        if (localAction) {
            const cd = Game.Diplomacy.getCompletionData(localAction.uniqueID);
            if (cd) {
                const lbl = document.createElement("div");
                lbl.classList.add("font-body", "text-xs", "leading-none", "text-center");
                lbl.innerHTML = cd.turnsToCompletion.toString();
                slot.appendChild(lbl);
            }
        }

        strip.appendChild(slot);
    }

    if (strip.children.length > 0) {
        contentContainer.appendChild(strip);
    }
}

/** Remove all homi augmentation from existing rows so they can be re-processed. */
function clearAugmentation() {
    const playerPanel = document.querySelector("panel-player-diplomacy-actions");
    if (!playerPanel) return;
    playerPanel.querySelectorAll("." + STRIP_CLASS).forEach(el => el.remove());
    playerPanel.querySelectorAll("." + SPACER_CLASS).forEach(el => el.remove());
    playerPanel.querySelectorAll("[" + ROW_ATTR + "]").forEach(el => el.removeAttribute(ROW_ATTR));
}

function augmentRows() {
    const playerPanel = document.querySelector("panel-player-diplomacy-actions");
    if (!playerPanel) return;

    const container = playerPanel.querySelector(
        "#panel-diplomacy-actions__relationship-event-container"
    );
    if (!container) return;

    const lookup = buildNameLookup();

    container.querySelectorAll("fxs-chooser-item").forEach(row => {
        if (row.hasAttribute(ROW_ATTR)) return;
        row.setAttribute(ROW_ATTR, "");

        const nameEl = row.querySelector(
            ".font-title.text-sm.pointer-events-none.font-fit-shrink.relative"
        );
        if (!nameEl) return;

        const playerID = lookup.get(nameEl.innerHTML);
        if (playerID === undefined) return;

        row.addEventListener("action-activate", () => panToPlayer(playerID));
        augmentRow(row, playerID);
    });
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

let _timer = null;

// interface-mode-changed / diplomacy-selected-player-changed: the panel
// recreates all row DOM elements, so just augment fresh rows.
function scheduleAugment(delay) {
    const ms = delay ?? 200;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => { _timer = null; augmentRows(); }, ms);
}

// Engine diplomacy events: rows are NOT recreated by the panel, so we must
// strip our own augmentation and re-run to reflect the new state.
function scheduleRefresh(delay) {
    const ms = delay ?? 250;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => { _timer = null; clearAugmentation(); augmentRows(); }, ms);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

window.addEventListener("interface-mode-changed",            () => scheduleAugment(200));
window.addEventListener("diplomacy-selected-player-changed", () => scheduleAugment(200));

engine.on("DiplomacyEventEnded",          () => scheduleRefresh());
engine.on("DiplomacyEventCanceled",       () => scheduleRefresh());
engine.on("DiplomacyQueueChanged",        () => scheduleRefresh());
engine.on("DiplomacyEventSupportChanged", () => scheduleRefresh());

setTimeout(() => augmentRows(), 1000);

// ---------------------------------------------------------------------------
// Key 9 — open the Minor Powers / city-states relationship tab
// ---------------------------------------------------------------------------

engine.on("InputAction", (name, status) => {
    if (name !== "homi-minor-powers-panel") return;
    if (status !== InputActionStatuses.FINISH) return;

    window.dispatchEvent(new RaiseDiplomacyEvent(GameContext.localPlayerID));

    // panel-diplomacy-actions hardcodes info-tab selection for the local player
    // after refreshTabItems — override it after the fact.
    setTimeout(() => {
        const panel = document.querySelector("panel-player-diplomacy-actions");
        if (!panel) return;
        const tabBar = panel.querySelector("fxs-tab-bar")
                    ?? panel.shadowRoot?.querySelector("fxs-tab-bar");
        if (tabBar) tabBar.setAttribute("selected-tab-index", "1");  // 0=actions 1=relationship 2=govt 3=info
    }, 200);
});
