// ── page-sector-wheel/06-detail-rows.js ─────────────────────────────────────
// Per-sector breakdown bars with overweight/underweight signal badges.
// Depends on: 01-constants.js, common formatters (fmtL, esc).

// ══════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════

function _renderDetailRows(sectorData, grandTotal, totalMFInv, totalSTInv) {
  const maxPct = sectorData[0]?.pct || 1;
  document.getElementById("sw-detail-rows").innerHTML = sectorData
    .map((s) => _buildDetailRow(s, grandTotal, totalMFInv, totalSTInv, maxPct))
    .join("");
}

// ══════════════════════════════════════════════════════════════
// ROW BUILDER
// ══════════════════════════════════════════════════════════════

function _buildDetailRow(s, grandTotal, totalMFInv, totalSTInv, maxPct) {
  const mfPct  = totalMFInv > 0 ? ((s.mfV / totalMFInv) * 100).toFixed(1) : "0";
  const stPct  = totalSTInv > 0 ? ((s.stV / totalSTInv) * 100).toFixed(1) : "0";
  const barW   = Math.round((s.pct  / maxPct)    * 100);
  const mfBarW = Math.min(100, Math.round((s.mfV / grandTotal) * 10000));
  const stBarW = Math.min(100, Math.round((s.stV / grandTotal) * 10000));

  return `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      ${_mainBar(s, barW)}
      ${s.mfV > 0 ? _subBar("MF implied",   mfBarW, "#58a6ff", s.mfV, mfPct, "% of MF")   : ""}
      ${s.stV > 0 ? _subBar("Direct stock", stBarW, "#a371f7", s.stV, stPct, "% of stocks"): ""}
    </div>`;
}

function _mainBar(s, barW) {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <span style="font-size:14px;flex-shrink:0">${s.icon}</span>
      <span style="font-size:12px;font-weight:500;min-width:80px;color:var(--text)">${s.label}</span>
      <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${barW}%;background:${s.color};border-radius:4px;transition:width .5s"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:${s.color};min-width:48px;text-align:right">${s.pct.toFixed(1)}%</span>
      <span style="font-size:11px;font-weight:600;color:var(--gold);min-width:80px;text-align:right">${fmtL(Math.round(s.val))}</span>
      ${_signalBadge(s.signal)}
    </div>`;
}

function _subBar(label, barW, color, amount, pct, pctLabel) {
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-left:26px;margin-bottom:3px">
      <span style="font-size:9px;color:var(--muted2);min-width:80px">${label}</span>
      <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;max-width:200px">
        <div style="height:100%;width:${barW}%;background:${color};border-radius:2px"></div>
      </div>
      <span style="font-size:10px;color:var(--muted);min-width:56px;text-align:right">${fmtL(Math.round(amount))}</span>
      <span style="font-size:9px;color:var(--muted2)">(${pct}${pctLabel})</span>
    </div>`;
}

function _signalBadge({ color, arrow, label }) {
  return `
    <span style="
      font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;
      background:${color}18;color:${color};
      border:1px solid ${color}44;min-width:88px;text-align:center;flex-shrink:0">
      ${arrow} ${label}
    </span>`;
}
