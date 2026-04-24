// ── page-sector-wheel/01-constants.js ───────────────────────────────────────
// Shared constants, colour maps, and module-level state for the Sector Wheel.
// Must load before all other page-sector-wheel/* modules.

// ══════════════════════════════════════════════════════════════
// SECTOR DEFINITIONS
// ══════════════════════════════════════════════════════════════

const SW_SECTORS = [
  { key: "Banking",       label: "Banking",  color: "#f0883e", icon: "🏦" },
  { key: "IT",            label: "IT",       color: "#79c0ff", icon: "💻" },
  { key: "Energy/PSU",    label: "Energy",   color: "#3fb950", icon: "⚡" },
  { key: "FMCG",          label: "FMCG",     color: "#e3b341", icon: "🛒" },
  { key: "Metals/Mining", label: "Metals",   color: "#d4a843", icon: "⛏"  },
  { key: "Finance/PSU",   label: "Finance",  color: "#a371f7", icon: "📈" },
  { key: "Infra/PSU",     label: "Infra",    color: "#58a6ff", icon: "🏗"  },
  { key: "Defence",       label: "Defence",  color: "#56d364", icon: "🛡"  },
  { key: "Renewables",    label: "Renew.",   color: "#40d080", icon: "🌱" },
  { key: "Speculative",   label: "Specul.",  color: "#f85149", icon: "🎲" },
  { key: "Consumer Tech", label: "ConsTech", color: "#ff7eb6", icon: "📱" },
  { key: "Other",         label: "Other",    color: "#7d8590", icon: "◎"  },
];

// ══════════════════════════════════════════════════════════════
// SIGNAL THRESHOLDS (relative to equal-weight reference)
// ══════════════════════════════════════════════════════════════

const SIGNAL_THRESHOLDS = {
  OVERWEIGHT:  1.5,    // > 150% of equal weight
  SLIGHT_OW:   1.15,
  SLIGHT_UW:   0.85,
  UNDERWEIGHT: 0.5,    // < 50% of equal weight
};

// ══════════════════════════════════════════════════════════════
// WHEEL GEOMETRY
// ══════════════════════════════════════════════════════════════

const WHEEL = {
  SIZE:    300,
  R_OUT:   120,
  R_IN:     68,
  GAP_DEG:   1.5,
};

// ══════════════════════════════════════════════════════════════
// MODULE STATE
// (shared across sub-modules via closure; reset on each render)
// ══════════════════════════════════════════════════════════════

let _swSectorData = null;   // enriched sector array from last render
let _swTooltipEl  = null;   // singleton tooltip DOM node
