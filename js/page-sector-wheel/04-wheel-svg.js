// ── page-sector-wheel/04-wheel-svg.js ───────────────────────────────────────
// SVG donut wheel drawn entirely via createElementNS + addEventListener.
// No innerHTML injection, no inline event-handler strings — XSS-safe.
// Depends on: 01-constants.js, 03-tooltip.js.

const SVG_NS = "http://www.w3.org/2000/svg";

// ══════════════════════════════════════════════════════════════
// MAIN DRAW FUNCTION
// ══════════════════════════════════════════════════════════════

function _drawSectorWheel(sectorData) {
  const wrap = document.getElementById("sw-svg-wrap");
  if (!wrap) return;

  const { SIZE, R_OUT, R_IN, GAP_DEG } = WHEEL;
  const CX = SIZE / 2, CY = SIZE / 2;

  const svg = _createSVGRoot(SIZE);
  let angle = -90;

  sectorData.forEach((s) => {
    const sweep = (s.pct / 100) * 360 - GAP_DEG;
    if (sweep <= 0) return;

    const a1 = angle + GAP_DEG / 2;
    const a2 = a1 + sweep;
    angle     = a2 + GAP_DEG / 2;

    _appendSegmentPath(svg, s, CX, CY, R_OUT, R_IN, a1, a2);
    _appendSignalRing(svg, s, CX, CY, R_OUT, a1, a2);
    if (sweep > 18) _appendSegmentLabel(svg, s, CX, CY, R_IN, R_OUT, a1, sweep);
  });

  // Centre hole + labels
  _appendCircle(svg, CX, CY, R_IN, "var(--bg2)");
  _appendCentreLabels(svg, CX, CY, sectorData[0]);

  wrap.innerHTML = "";
  wrap.appendChild(svg);
}

// ══════════════════════════════════════════════════════════════
// SVG ELEMENT BUILDERS
// ══════════════════════════════════════════════════════════════

function _createSVGRoot(size) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width",   String(size));
  svg.setAttribute("height",  String(size));
  svg.id = "sw-svg";
  return svg;
}

function _appendSegmentPath(svg, s, cx, cy, rOut, rIn, a1, a2) {
  const la = (a2 - a1) > 180 ? 1 : 0;
  const p1 = _polar(cx, cy, rIn,  a1), p2 = _polar(cx, cy, rOut, a1);
  const p3 = _polar(cx, cy, rOut, a2), p4 = _polar(cx, cy, rIn,  a2);
  const f  = (n) => n.toFixed(2);

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d",
    `M${f(p1.x)},${f(p1.y)}` +
    `L${f(p2.x)},${f(p2.y)}` +
    `A${rOut},${rOut} 0 ${la},1 ${f(p3.x)},${f(p3.y)}` +
    `L${f(p4.x)},${f(p4.y)}` +
    `A${rIn},${rIn} 0 ${la},0 ${f(p1.x)},${f(p1.y)}Z`
  );
  path.setAttribute("fill",    s.color);
  path.setAttribute("opacity", "0.85");
  path.setAttribute("class",   "sw-segment");
  path.dataset.sector  = s.key;
  path.style.cssText   = "cursor:pointer;transition:opacity .2s";

  path.addEventListener("mouseenter", () => _swHighlight(s.key));
  path.addEventListener("mouseleave", _swUnhighlight);
  svg.appendChild(path);
}

function _appendSignalRing(svg, s, cx, cy, rOut, a1, a2) {
  const la   = (a2 - a1) > 180 ? 1 : 0;
  const rInner = rOut - 6;
  const ps1  = _polar(cx, cy, rInner, a1), ps2 = _polar(cx, cy, rOut, a1);
  const ps3  = _polar(cx, cy, rInner, a2), ps4 = _polar(cx, cy, rOut, a2);
  const f    = (n) => n.toFixed(2);

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d",
    `M${f(ps1.x)},${f(ps1.y)}` +
    `A${rInner},${rInner} 0 ${la},1 ${f(ps3.x)},${f(ps3.y)}` +
    `L${f(ps4.x)},${f(ps4.y)}` +
    `A${rOut},${rOut} 0 ${la},0 ${f(ps2.x)},${f(ps2.y)}Z`
  );
  path.setAttribute("fill",           s.signal.color);
  path.setAttribute("opacity",        "0.70");
  path.setAttribute("pointer-events", "none");
  svg.appendChild(path);
}

function _appendSegmentLabel(svg, s, cx, cy, rIn, rOut, a1, sweep) {
  const midAngle = a1 + sweep / 2;
  const lp  = _polar(cx, cy, (rIn + rOut) / 2, midAngle);
  const txt = document.createElementNS(SVG_NS, "text");

  txt.setAttribute("x",               lp.x.toFixed(2));
  txt.setAttribute("y",               lp.y.toFixed(2));
  txt.setAttribute("text-anchor",     "middle");
  txt.setAttribute("dominant-baseline","middle");
  txt.setAttribute("font-size",       sweep > 30 ? "9" : "8");
  txt.setAttribute("fill",            "#fff");
  txt.setAttribute("font-family",     "DM Mono,monospace");
  txt.setAttribute("font-weight",     "600");
  txt.setAttribute("pointer-events",  "none");
  txt.textContent = s.label.slice(0, 7);
  svg.appendChild(txt);
}

function _appendCentreLabels(svg, cx, cy, topSec) {
  _appendSVGText(svg, cx, cy - 14, "TOP SECTOR",         "10", "var(--muted)");
  _appendSVGText(svg, cx, cy +  4, topSec?.label ?? "—", "13", topSec?.color ?? "#d4a843", "Syne,sans-serif", "700");
  _appendSVGText(svg, cx, cy + 20, topSec ? `${topSec.pct.toFixed(1)}%` : "", "11", topSec?.color ?? "#7d8590");
}

function _appendCircle(svg, cx, cy, r, fill) {
  const el = document.createElementNS(SVG_NS, "circle");
  el.setAttribute("cx",   String(cx));
  el.setAttribute("cy",   String(cy));
  el.setAttribute("r",    String(r));
  el.setAttribute("fill", fill);
  svg.appendChild(el);
}

function _appendSVGText(svg, x, y, content, fontSize, fill, fontFamily = "DM Mono,monospace", fontWeight = "400") {
  const el = document.createElementNS(SVG_NS, "text");
  el.setAttribute("x",              String(x));
  el.setAttribute("y",              String(y));
  el.setAttribute("text-anchor",    "middle");
  el.setAttribute("font-size",      fontSize);
  el.setAttribute("fill",           fill);
  el.setAttribute("font-family",    fontFamily);
  el.setAttribute("font-weight",    fontWeight);
  el.textContent = content;
  svg.appendChild(el);
}

// ══════════════════════════════════════════════════════════════
// GEOMETRY HELPER
// ══════════════════════════════════════════════════════════════

function _polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
