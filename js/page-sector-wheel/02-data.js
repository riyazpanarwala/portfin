// ── page-sector-wheel/02-data.js ────────────────────────────────────────────
// Pure data functions: exposure calculation, sector enrichment, signal logic.
// No DOM access. Depends on: 01-constants.js, common DATA store, MF_CAT_SECTOR_WEIGHTS.

// ══════════════════════════════════════════════════════════════
// SIGNAL CLASSIFICATION
// ══════════════════════════════════════════════════════════════

/**
 * Classify a sector's weighting vs the equal-weight reference.
 * @param {number} pct         - sector's % of total portfolio
 * @param {number} equalWeight - 100 / number of active sectors
 * @returns {{ label: string, color: string, arrow: string }}
 */
function _getSignal(pct, equalWeight) {
  const ratio = pct / equalWeight;
  if (ratio > SIGNAL_THRESHOLDS.OVERWEIGHT)  return { label: "OVERWEIGHT",  color: "#f85149", arrow: "▲▲" };
  if (ratio > SIGNAL_THRESHOLDS.SLIGHT_OW)   return { label: "SLIGHT OW",   color: "#e3b341", arrow: "▲"  };
  if (ratio < SIGNAL_THRESHOLDS.UNDERWEIGHT) return { label: "UNDERWEIGHT", color: "#58a6ff", arrow: "▼▼" };
  if (ratio < SIGNAL_THRESHOLDS.SLIGHT_UW)   return { label: "SLIGHT UW",   color: "#a371f7", arrow: "▼"  };
  return                                             { label: "NEUTRAL",     color: "#3fb950", arrow: "◆"  };
}

// ══════════════════════════════════════════════════════════════
// EXPOSURE CALCULATION
// ══════════════════════════════════════════════════════════════

/**
 * Build per-sector ₹ exposure from MF category weights + direct stocks.
 * @returns {{ mfExp, stExp, combined, grandTotal }}
 */
function _calcExposures() {
  const mfExp = {};
  DATA.funds.forEach((f) => {
    const weights = MF_CAT_SECTOR_WEIGHTS[f.Category] ?? MF_CAT_SECTOR_WEIGHTS["Other"];
    for (const [sec, w] of Object.entries(weights)) {
      mfExp[sec] = (mfExp[sec] ?? 0) + f.Invested * w;
    }
  });

  const stExp = {};
  DATA.stocks.forEach((s) => {
    stExp[s.Sector] = (stExp[s.Sector] ?? 0) + s.Invested;
  });

  const combined = {};
  SW_SECTORS.forEach(({ key }) => {
    combined[key] = (mfExp[key] ?? 0) + (stExp[key] ?? 0);
  });

  const grandTotal = Object.values(combined).reduce((a, v) => a + v, 0) || 1;

  return { mfExp, stExp, combined, grandTotal };
}

/**
 * Build the sorted, enriched sector array used by all renderers.
 * @returns {Array<SectorEntry>}
 */
function _buildSectorData(mfExp, stExp, combined, grandTotal, equalWeight) {
  return SW_SECTORS
    .map((s) => {
      const val = combined[s.key] ?? 0;
      const pct = (val / grandTotal) * 100;
      return {
        ...s,
        val,
        pct,
        mfV:    mfExp[s.key] ?? 0,
        stV:    stExp[s.key] ?? 0,
        signal: _getSignal(pct, equalWeight),
      };
    })
    .filter((s) => s.val > 0)
    .sort((a, b) => b.pct - a.pct);
}
