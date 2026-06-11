// Displays a subtle inline unit class label (e.g. "Land · Infantry II") to the right of the
// unit name in the production chooser panel.
//
// Data sources:
//   TypeTags     → maps each UnitType to its UNIT_CLASS_* tag
//   Units        → provides Tier (1/2/3) and Domain per unit
//   UnitReplaces → identifies civ-unique units and what they replace
//
// DOM strategy: label is appended inside the name span so it flows inline. Solid.js
// only manages the text node it inserted; our span at the end is not touched by it.
//
// Observer note: attributes are set on new items BEFORE they're appended to the DOM,
// so attribute mutations don't fire for new items. We also watch childList and process
// each newly appended production-chooser-item.

const LABEL_CLASS = "homi-unit-type-label";

const style = document.createElement("style");
style.textContent = `.${LABEL_CLASS} {
    font-size: 0.65em;
    opacity: 0.75;
    color: #C8A96E;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: 0.55em;
    vertical-align: baseline;
}`;
document.head.appendChild(style);

const TIER_ROMAN = ["", "I", "II", "III", "IV", "V"];

const DOMAIN_LABELS = {
    DOMAIN_LAND: "Land",
    DOMAIN_SEA:  "Sea",
    DOMAIN_AIR:  "Air",
};

// Hardcoded English labels — avoids Locale.compose dependency for mod-defined keys
// that aren't reliably accessible in game scope.
const CLASS_LABELS = {
    // Land
    UNIT_CLASS_INFANTRY:        "Infantry",
    UNIT_CLASS_RANGED:          "Ranged",
    UNIT_CLASS_CAVALRY:         "Cavalry",
    UNIT_CLASS_SIEGE:           "Siege",
    UNIT_CLASS_RECON:           "Recon",
    // Sea
    UNIT_CLASS_NAVAL:           "Naval",
    // Air — specific tags take priority over the generic SIEGE tag bombers also carry
    UNIT_CLASS_BOMBER:          "Bomber",
    UNIT_CLASS_AIR_FIGHTER:     "Fighter",
    UNIT_CLASS_GROUND_ATTACKER: "Strike",
};

// Priority order: when a unit has multiple UNIT_CLASS tags, pick the most-specific role.
const CLASS_PRIORITY_INDEX = new Map([
    ["UNIT_CLASS_BOMBER",          0],
    ["UNIT_CLASS_AIR_FIGHTER",     1],
    ["UNIT_CLASS_GROUND_ATTACKER", 2],
    ["UNIT_CLASS_SIEGE",           3],
    ["UNIT_CLASS_CAVALRY",         4],
    ["UNIT_CLASS_INFANTRY",        5],
    ["UNIT_CLASS_RANGED",          6],
    ["UNIT_CLASS_NAVAL",           7],
    ["UNIT_CLASS_RECON",           8],
]);

// Labels shown for unique commanders, keyed by the base unit they replace.
const COMMANDER_REPLACEMENT_LABELS = {
    UNIT_ARMY_COMMANDER:  "Army Commander",
    UNIT_FLEET_COMMANDER: "Fleet Commander",
};

// uniqueUnitType → replacedUnitType (e.g. UNIT_BALIK → UNIT_ARMY_COMMANDER)
const unitReplacesMap = new Map();
// Unique missionaries (replace UNIT_MISSIONARY) → show "Missionary"
const missionaryReplacements = new Set();
for (const row of GameInfo.UnitReplaces) {
    unitReplacesMap.set(row.CivUniqueUnitType, row.ReplacesUnitType);
    if (row.ReplacesUnitType === "UNIT_MISSIONARY") {
        missionaryReplacements.add(row.CivUniqueUnitType);
    }
}

// unitType → best UNIT_CLASS_* combat tag
const unitClassMap = new Map();
// unitType → is a commander (has UNIT_CLASS_COMMAND or UNIT_CLASS_ARMY_COMMANDER)
const commanderUnitTypes = new Set();
for (const row of GameInfo.TypeTags) {
    if (row.Tag === "UNIT_CLASS_COMMAND" || row.Tag === "UNIT_CLASS_ARMY_COMMANDER") {
        commanderUnitTypes.add(row.Type);
        continue;
    }
    const priority = CLASS_PRIORITY_INDEX.get(row.Tag);
    if (priority === undefined) continue;
    const existing = unitClassMap.get(row.Type);
    if (existing === undefined || CLASS_PRIORITY_INDEX.get(existing) > priority) {
        unitClassMap.set(row.Type, row.Tag);
    }
}

// unitType → tier number; unitType → domain string
const unitTierMap   = new Map();
const unitDomainMap = new Map();
for (const unit of GameInfo.Units) {
    if (unit.Tier >= 1) unitTierMap.set(unit.UnitType, unit.Tier);
    if (unit.Domain)    unitDomainMap.set(unit.UnitType, unit.Domain);
}

function getLabelText(unitType) {
    // Unique missionaries
    if (missionaryReplacements.has(unitType)) return "Missionary";

    // Commanders: base Army/Fleet Commander → no label; unique replacements → role label
    if (commanderUnitTypes.has(unitType)) {
        const replacedType = unitReplacesMap.get(unitType);
        if (!replacedType) return null;
        return COMMANDER_REPLACEMENT_LABELS[replacedType] ?? null;
    }

    const classTag   = unitClassMap.get(unitType);
    const classLabel = classTag ? CLASS_LABELS[classTag] : null;
    if (!classLabel) return null;

    const domain     = DOMAIN_LABELS[unitDomainMap.get(unitType)] ?? null;
    const prefix     = domain ? `${domain} · ` : "";
    const tier       = unitTierMap.get(unitType) ?? 0;
    const tierSuffix = tier >= 1 ? ` ${TIER_ROMAN[tier] ?? String(tier)}` : "";

    return `${prefix}${classLabel}${tierSuffix}`;
}

// ─── DEBUG: remove before shipping ──────────────────────────────────────────
// Open the in-game browser console and look for "[homi] unit labels" entries.
// "MISSING" lines are units that got no label — paste them here so we can fix.
(function debugUnitLabels() {
    const allUnitTypes = new Set([
        ...unitClassMap.keys(),
        ...commanderUnitTypes,
        ...missionaryReplacements,
        ...unitReplacesMap.keys(),
        ...unitDomainMap.keys(),
    ]);

    const missing = [];
    const labelled = [];

    for (const unitType of [...allUnitTypes].sort()) {
        const label = getLabelText(unitType);
        if (label) {
            labelled.push(`  ${unitType} → "${label}"`);
        } else {
            const tags = [...GameInfo.TypeTags]
                .filter(r => r.Type === unitType)
                .map(r => r.Tag);
            const domain   = unitDomainMap.get(unitType)  ?? "(none)";
            const tier     = unitTierMap.get(unitType)    ?? "(none)";
            const replaces = unitReplacesMap.get(unitType) ?? "(none)";
            missing.push(`  MISSING ${unitType} | tags=[${tags.join(", ")}] domain=${domain} tier=${tier} replaces=${replaces}`);
        }
    }

    console.log("[homi] unit labels — labelled:\n" + labelled.join("\n"));
    console.log("[homi] unit labels — MISSING (no label assigned):\n" + (missing.length ? missing.join("\n") : "  (none)"));
})();
// ─────────────────────────────────────────────────────────────────────────────

function updateUnitTypeLabel(item) {
    const unitType = item.getAttribute("data-type");
    if (!unitType) return;

    const text     = getLabelText(unitType);
    const nameSpan = item.querySelector("span.font-title");
    if (!nameSpan) return;

    let label = nameSpan.querySelector(`.${LABEL_CLASS}`);

    if (!text) {
        label?.remove();
        return;
    }

    if (!label) {
        label = document.createElement("span");
        label.className = LABEL_CLASS;
        nameSpan.appendChild(label);
    }

    if (label.textContent !== text) {
        label.textContent = text;
    }
}

function processNode(node, seen) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName.toLowerCase() === "production-chooser-item" &&
        node.getAttribute("data-category") === "units" &&
        !seen.has(node)) {
        seen.add(node);
        updateUnitTypeLabel(node);
    }
    for (const item of node.querySelectorAll("production-chooser-item[data-category='units']")) {
        if (!seen.has(item)) {
            seen.add(item);
            updateUnitTypeLabel(item);
        }
    }
}

function startObservingPanel(panel) {
    const seen = new Set();
    for (const item of panel.querySelectorAll("production-chooser-item[data-category='units']")) {
        seen.add(item);
        updateUnitTypeLabel(item);
    }

    const observer = new MutationObserver((mutations) => {
        const batch = new Set();
        for (const mutation of mutations) {
            if (mutation.type === "childList") {
                for (const node of mutation.addedNodes) {
                    processNode(node, batch);
                }
            } else if (mutation.type === "attributes") {
                const el = mutation.target;
                if (el.tagName?.toLowerCase() === "production-chooser-item" &&
                    el.getAttribute("data-category") === "units" &&
                    !batch.has(el)) {
                    batch.add(el);
                    updateUnitTypeLabel(el);
                }
            }
        }
    });

    observer.observe(panel, {
        subtree:         true,
        childList:       true,
        attributes:      true,
        attributeFilter: ["data-type", "data-name"],
    });
}

// Keep track of the panel element we're currently observing so we don't
// double-attach when the body watcher fires multiple times for the same panel.
let observedPanel = null;

function maybeAttachToPanel() {
    const panel = document.querySelector("panel-production-chooser");
    if (panel && panel !== observedPanel) {
        observedPanel = panel;
        startObservingPanel(panel);
    }
}

// Persistent — does NOT disconnect so it catches the panel being recreated on reopen.
const panelWatcher = new MutationObserver(maybeAttachToPanel);
panelWatcher.observe(document.body, { childList: true, subtree: true });

maybeAttachToPanel();
