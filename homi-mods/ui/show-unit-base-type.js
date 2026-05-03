// Displays a subtle inline unit class label (e.g. "Infantry Ⅱ") to the right of the
// unit name in the production chooser panel.
//
// Data sources:
//   TypeTags  → maps each UnitType to its UNIT_CLASS_* tag
//   Units     → provides the Tier (1/2/3) per unit
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
    opacity: 0.65;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: 0.55em;
}`;
document.head.appendChild(style);

// Roman numeral glyphs for tier 1–5 (Civ 7 currently uses 1–3)
const TIER_ROMAN = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"];

// Hardcoded English labels — avoids Locale.compose dependency for mod-defined keys
// that aren't reliably accessible in game scope.
const CLASS_LABELS = {
    UNIT_CLASS_INFANTRY: "Infantry",
    UNIT_CLASS_RANGED:   "Ranged",
    UNIT_CLASS_CAVALRY:  "Cavalry",
    UNIT_CLASS_SIEGE:    "Siege",
    UNIT_CLASS_NAVAL:    "Naval",
    UNIT_CLASS_RECON:    "Recon",
};

// Priority order: when a unit has multiple UNIT_CLASS tags (e.g. UNIT_GALLEY has both
// UNIT_CLASS_RECON and UNIT_CLASS_NAVAL), pick the most-specific combat role.
const CLASS_PRIORITY_INDEX = new Map([
    ["UNIT_CLASS_SIEGE",    0],
    ["UNIT_CLASS_CAVALRY",  1],
    ["UNIT_CLASS_INFANTRY", 2],
    ["UNIT_CLASS_RANGED",   3],
    ["UNIT_CLASS_NAVAL",    4],
    ["UNIT_CLASS_RECON",    5],
]);

// unitType string → best UNIT_CLASS_* tag
const unitClassMap = new Map();
for (const row of GameInfo.TypeTags) {
    const priority = CLASS_PRIORITY_INDEX.get(row.Tag);
    if (priority === undefined) continue;
    const existing = unitClassMap.get(row.Type);
    if (existing === undefined || CLASS_PRIORITY_INDEX.get(existing) > priority) {
        unitClassMap.set(row.Type, row.Tag);
    }
}

// unitType string → tier (only entries where Tier >= 1)
const unitTierMap = new Map();
for (const unit of GameInfo.Units) {
    if (unit.Tier >= 1) {
        unitTierMap.set(unit.UnitType, unit.Tier);
    }
}

function getLabelText(unitType, nameKey) {
    const classTag   = unitClassMap.get(unitType);
    const classLabel = classTag ? CLASS_LABELS[classTag] : null;
    if (!classLabel) return null;

    // Suppress when the unit's own name is the same as the class label
    const unitName = Locale.compose(nameKey);
    if (unitName === classLabel) return null;

    const tier  = unitTierMap.get(unitType) ?? 0;
    const roman = TIER_ROMAN[tier] ?? String(tier);
    return tier >= 1 ? `${classLabel} ${roman}` : classLabel;
}

function updateUnitTypeLabel(item) {
    const unitType = item.getAttribute("data-type");
    const nameKey  = item.getAttribute("data-name");
    if (!unitType || !nameKey) return;

    const text     = getLabelText(unitType, nameKey);
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

const existingPanel = document.querySelector("panel-production-chooser");
if (existingPanel) {
    startObservingPanel(existingPanel);
} else {
    const panelWatcher = new MutationObserver(() => {
        const panel = document.querySelector("panel-production-chooser");
        if (panel) {
            panelWatcher.disconnect();
            startObservingPanel(panel);
        }
    });
    panelWatcher.observe(document.body, { childList: true, subtree: true });
}
