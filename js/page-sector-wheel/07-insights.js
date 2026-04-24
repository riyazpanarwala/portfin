// ── page-sector-wheel/07-insights.js ────────────────────────────────────────
// Narrative insight cards based on sector signal analysis.
// Depends on: 01-constants.js, common formatters (fmtL).

// ══════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════

function _renderWheelInsights(sectorData, equalWeight, grandTotal) {
  const el = document.getElementById("sw-insights");
  if (!el) return;

  const insights = _buildInsights(sectorData, equalWeight, grandTotal);

  el.innerHTML = `
    <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
      Rotation insights
    </div>
    ${insights.map(_insightCard).join("")}
    <div style="
      font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.5;
      padding:8px;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
      ⓘ MF sector exposure is estimated from typical index category weights — actual fund holdings vary.
      Equal-weight benchmark divides 100% equally across all sectors you hold.
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// CARD TEMPLATE
// ══════════════════════════════════════════════════════════════

function _insightCard({ icon, color, title, body }) {
  return `
    <div style="
      display:flex;gap:12px;align-items:flex-start;
      padding:12px;margin-bottom:8px;
      background:${color}10;border-left:3px solid ${color};
      border-radius:0 6px 6px 0">
      <span style="font-size:20px;flex-shrink:0">${icon}</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:${color};margin-bottom:4px">${title}</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.65">${body}</div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// INSIGHT LOGIC
// ══════════════════════════════════════════════════════════════

/**
 * Generate narrative insight objects from sector signal data.
 * Pure function — returns an array of { icon, color, title, body }.
 */
function _buildInsights(sectorData, equalWeight, grandTotal) {
  const insights    = [];
  const overweight  = sectorData.filter((s) => s.signal.label === "OVERWEIGHT");
  const underweight = sectorData.filter((s) => s.signal.label === "UNDERWEIGHT");
  const neutral     = sectorData.filter((s) => s.signal.label === "NEUTRAL");

  if (overweight.length) {
    const names = overweight.map((s) => s.label).join(", ");
    const amt   = overweight.reduce((a, s) => a + s.val, 0);
    insights.push({
      icon: "⚠", color: "#f85149",
      title: `${overweight.length} overweight sector${overweight.length > 1 ? "s" : ""}`,
      body: `${names} collectively hold ${fmtL(Math.round(amt))} — more than 1.5× the equal-weight benchmark of ${equalWeight.toFixed(1)}%. A sector-specific downturn would disproportionately impact your portfolio.`,
    });
  }

  if (underweight.length) {
    const names = underweight.map((s) => s.label).join(", ");
    insights.push({
      icon: "◎", color: "#58a6ff",
      title: `${underweight.length} underweight sector${underweight.length > 1 ? "s" : ""}`,
      body: `${names} are underrepresented vs a balanced portfolio. This may be intentional (bearish view) or a blind spot in your MF selection.`,
    });
  }

  const topTwo    = sectorData.slice(0, 2);
  const topTwoPct = topTwo.reduce((a, s) => a + s.pct, 0);
  if (topTwoPct > 40) {
    insights.push({
      icon: "📊", color: "#e3b341",
      title: `Top 2 sectors are ${topTwoPct.toFixed(1)}% of your portfolio`,
      body: `${topTwo.map((s) => s.label).join(" + ")} dominate your combined exposure. High concentration in 2 sectors increases correlation risk.`,
    });
  }

  if (neutral.length >= 4) {
    insights.push({
      icon: "✓", color: "#3fb950",
      title: `${neutral.length} sectors are neutrally weighted`,
      body: `Good balance across ${neutral.map((s) => s.label).join(", ")}. These are near your equal-weight benchmark.`,
    });
  }

  // Banking + Finance combined concentration warning
  const bankSec    = sectorData.find((s) => s.key === "Banking");
  const financeSec = sectorData.find((s) => s.key === "Finance/PSU");
  if (bankSec && financeSec) {
    const combinedPct = bankSec.pct + financeSec.pct;
    if (combinedPct > 30) {
      insights.push({
        icon: "🏦", color: "#f0883e",
        title: `Banking + Finance = ${combinedPct.toFixed(1)}% combined`,
        body: `These two closely correlated sectors together form a very large share of your portfolio. An RBI policy shift or NPA cycle would hit both simultaneously.`,
      });
    }
  }

  if (!insights.length) {
    insights.push({
      icon: "🏆", color: "#3fb950",
      title: "Well-balanced sector allocation",
      body: "No major over- or under-weights detected. Your portfolio has broad sector diversification.",
    });
  }

  return insights;
}
