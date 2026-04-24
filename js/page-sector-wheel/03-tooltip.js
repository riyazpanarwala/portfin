// ── page-sector-wheel/03-tooltip.js ─────────────────────────────────────────
// Singleton tooltip node + hover highlight logic for the SVG wheel.
// Depends on: 01-constants.js, 02-data.js, common formatters (fmtL).

// ══════════════════════════════════════════════════════════════
// TOOLTIP — created once, reused across all hover events
// ══════════════════════════════════════════════════════════════

function _getSwTooltip() {
  if (_swTooltipEl && document.body.contains(_swTooltipEl)) return _swTooltipEl;

  // Remove any stale node left from a previous page load
  document.getElementById("sw-tooltip-global")?.remove();

  _swTooltipEl = document.createElement("div");
  _swTooltipEl.id = "sw-tooltip-global";
  Object.assign(_swTooltipEl.style, {
    position:      "fixed",
    background:    "var(--bg3)",
    border:        "1px solid var(--border2)",
    borderRadius:  "8px",
    padding:       "10px 14px",
    fontSize:      "11px",
    pointerEvents: "none",
    zIndex:        "1000",
    display:       "none",
    minWidth:      "160px",
    boxShadow:     "0 4px 16px rgba(0,0,0,.3)",
  });
  document.body.appendChild(_swTooltipEl);
  return _swTooltipEl;
}

// ══════════════════════════════════════════════════════════════
// HOVER INTERACTION
// ══════════════════════════════════════════════════════════════

function _swHighlight(sectorKey) {
  document.querySelectorAll(".sw-segment").forEach((seg) => {
    seg.style.opacity = seg.dataset.sector === sectorKey ? "1" : "0.35";
  });

  const s  = (_swSectorData ?? []).find((d) => d.key === sectorKey);
  const tt = _getSwTooltip();
  if (!s || !tt) return;

  _buildTooltipDOM(tt, s);

  const svgWrap = document.getElementById("sw-svg-wrap");
  if (svgWrap) {
    const rect       = svgWrap.getBoundingClientRect();
    tt.style.left    = `${rect.right + 12}px`;
    tt.style.top     = `${rect.top + rect.height / 2 - 60}px`;
    tt.style.display = "block";
  }
}

function _swUnhighlight() {
  document.querySelectorAll(".sw-segment").forEach((seg) => {
    seg.style.opacity = "0.85";
  });
  _getSwTooltip().style.display = "none";
}

/**
 * Populate the tooltip via DOM API only — no innerHTML — to prevent XSS
 * from fund/sector names that originate in user-uploaded Excel files.
 */
function _buildTooltipDOM(tt, s) {
  tt.innerHTML = "";

  const title = document.createElement("div");
  title.style.cssText = `font-weight:700;color:${s.color};margin-bottom:6px;font-size:13px`;
  title.textContent   = `${s.icon} ${s.label}`;
  tt.appendChild(title);

  const makeRow = (label, value, valueColor) => {
    const row   = document.createElement("div");
    row.style.cssText = "color:var(--muted);margin-bottom:3px";
    const vSpan = document.createElement("span");
    vSpan.style.cssText = `color:${valueColor ?? "var(--text)"};font-weight:600`;
    vSpan.textContent   = value;
    row.append(`${label}: `, vSpan);
    return row;
  };

  tt.appendChild(makeRow("Total exposure", `${s.pct.toFixed(2)}%`));
  tt.appendChild(makeRow("Amount",          fmtL(Math.round(s.val)),     "var(--gold)"));
  if (s.mfV > 0) tt.appendChild(makeRow("Via MF",  fmtL(Math.round(s.mfV)),  "#58a6ff"));
  if (s.stV > 0) tt.appendChild(makeRow("Direct",  fmtL(Math.round(s.stV)),  "#a371f7"));

  const sig = document.createElement("div");
  sig.style.cssText = `
    font-size:9px;font-weight:700;color:${s.signal.color};
    margin-top:6px;padding:3px 0;border-top:1px solid var(--border)`;
  sig.textContent = `${s.signal.arrow} ${s.signal.label}`;
  tt.appendChild(sig);
}

// ══════════════════════════════════════════════════════════════
// PUBLIC WRAPPERS (kept for any external callers)
// ══════════════════════════════════════════════════════════════

function swHighlight(el, sectorKey) { _swHighlight(sectorKey); }
function swUnhighlight()            { _swUnhighlight();        }
