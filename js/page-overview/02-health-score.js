// ── page-overview/02-health-score.js ────────────────────────────────────────
// Portfolio Health Score (0–100) with SVG arc gauge and 5-dimension breakdown.
// Dimensions: Diversification, MF Dominance, Profitability, CAGR Quality, Consistency.

function renderHealthScore() {
  const k = DATA.kpis;

  if (!k.totalInvested) {
    document.getElementById("health-score-display").innerHTML =
      '<div style="color:var(--muted);font-size:11px">Upload files to compute health score</div>';
    document.getElementById("health-score-breakdown").innerHTML = "";
    return;
  }

  const scores = _calcHealthDimensions(k);
  const total  = Math.min(100, Math.max(0,
    Math.round(scores.div + scores.mf + scores.prof + scores.cagr + scores.consist)
  ));
  const scoreColor = total >= 75 ? "#3fb950" : total >= 50 ? "#d4a843" : "#f85149";
  const scoreLabel = total >= 75 ? "Healthy" : total >= 50 ? "Fair" : "Needs Attention";

  document.getElementById("health-score-display").innerHTML =
    _buildGaugeSVG(total, scoreColor, scoreLabel);

  const breakdown = [
    ["Diversification", Math.round(scores.div),    20, "Single-stock concentration & speculative exposure"],
    ["MF Dominance",    Math.round(scores.mf),     20, "MF share of total portfolio"],
    ["Profitability",   Math.round(scores.prof),   20, "% of funds & stocks in profit"],
    ["CAGR Quality",    Math.round(scores.cagr),   20, "Average MF CAGR vs Nifty 50 (12%)"],
    ["Consistency",     Math.round(scores.consist),20, "Regular investing across months"],
  ];

  document.getElementById("health-score-breakdown").innerHTML = breakdown
    .map(([name, pts, max, note]) => {
      const pct = Math.round((pts / max) * 100);
      const c   = pct >= 75 ? "#3fb950" : pct >= 50 ? "#d4a843" : "#f85149";
      return `<div class="health-bar-row">
        <span class="health-bar-name" title="${note}">${name}</span>
        <div class="health-bar-track">
          <div class="health-bar-fill" style="width:${pct}%;background:${c}"></div>
        </div>
        <span class="health-bar-pts" style="color:${c}">${pts}/${max}</span>
      </div>`;
    })
    .join("");
}

// ── Score calculations ────────────────────────────────────────
function _calcHealthDimensions(k) {
  const nMF  = DATA.funds.length  || 1;
  const mfWin = DATA.funds.filter((f) => f.Gain > 0).length;
  const stWin = DATA.stocks.filter((s) => s.Gain > 0).length;
  const mfShare   = k.totalInvested ? k.mfInvested / k.totalInvested : 0;
  const avgMFcagr = DATA.funds.reduce((a, f) => a + f.CAGR, 0) / nMF;

  const maxSingleStPct = DATA.stocks.length
    ? Math.max(...DATA.stocks.map((s) => (s.Invested / k.stInvested) * 100))
    : 0;
  const specInv = DATA.stocks
    .filter((s) => s.Sector === "Speculative")
    .reduce((a, s) => a + s.Invested, 0);
  const specPct = k.stInvested ? specInv / k.stInvested : 0;

  const div    = Math.max(0, 20 - Math.max(0, (maxSingleStPct - 20) * 0.5) - Math.max(0, (specPct * 100 - 15) * 0.4));
  const mf     = Math.min(20, mfShare * 33);
  const totalHoldings = DATA.funds.length + DATA.stocks.length || 1;
  const prof   = ((mfWin + stWin) / totalHoldings) * 20;
  const cagr   = Math.min(20, Math.max(0, (avgMFcagr / 12) * 20));

  let consist = 10;
  if (DATA.monthlyMF.length) {
    const allM   = buildCombinedMonthly();
    const active = allM.filter((x) => x.v > 0).length;
    consist = allM.length ? Math.min(20, (active / allM.length) * 22) : 10;
  }

  return { div, mf, prof, cagr, consist };
}

// ── SVG arc gauge ─────────────────────────────────────────────
function _buildGaugeSVG(score, scoreColor, scoreLabel) {
  const VW = 180, VH = 110, GCX = 90, GCY = 95, GR = 72, SW = 12;

  const polar = (deg) => ({
    x: GCX + GR * Math.cos((deg * Math.PI) / 180),
    y: GCY + GR * Math.sin((deg * Math.PI) / 180),
  });

  const tStart = polar(180);
  const tEnd   = polar(0);
  const trackD = `M${tStart.x},${tStart.y} A${GR},${GR} 0 0,1 ${tEnd.x},${tEnd.y}`;

  const fillAngle = 180 - (score / 100) * 180;
  const fEnd      = polar(fillAngle);
  const largeArc  = 180 - fillAngle > 180 ? 1 : 0;
  const fillD     = score > 0
    ? `M${tStart.x},${tStart.y} A${GR},${GR} 0 ${largeArc},1 ${fEnd.x},${fEnd.y}`
    : "";
  const needleTip = score > 0
    ? `<circle cx="${fEnd.x.toFixed(1)}" cy="${fEnd.y.toFixed(1)}" r="5" fill="${scoreColor}"/>`
    : "";

  const polar2 = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });
  const ticks = [25, 50, 75]
    .map((v) => {
      const a     = 180 - (v / 100) * 180;
      const inner = polar2(GCX, GCY, GR - 10, a);
      const outer = polar2(GCX, GCY, GR + 2,  a);
      return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}"
                    x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}"
                    stroke="var(--border2)" stroke-width="1.5"/>`;
    })
    .join("");

  const gaugeSVG = `
    <div class="health-gauge">
      <svg viewBox="-10 0 ${VW + 20} ${VH}" width="${VW}" height="${VH}"
           xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <path d="${trackD}" fill="none" stroke="var(--bg4)"
              stroke-width="${SW}" stroke-linecap="round"/>
        ${fillD
          ? `<path d="${fillD}" fill="none" stroke="${scoreColor}"
                   stroke-width="${SW}" stroke-linecap="round" opacity="0.95"/>`
          : ""}
        ${needleTip}
        ${ticks}
        <text x="${tStart.x - 14}" y="${tStart.y + 6}"
              font-size="9" fill="var(--muted)" text-anchor="middle">0</text>
        <text x="${tEnd.x + 14}" y="${tEnd.y + 6}"
              font-size="9" fill="var(--muted)" text-anchor="middle">100</text>
      </svg>
      <div class="health-gauge-val">
        <span class="health-score-num" style="color:${scoreColor}">${score}</span>
        <span class="health-score-lbl" style="color:${scoreColor}">${scoreLabel}</span>
      </div>
    </div>
    <div style="flex:1;padding-left:8px">
      <div style="font-size:11px;color:var(--muted);line-height:1.8">
        Score computed across 5 dimensions:<br>
        diversification, MF dominance, profitability,<br>
        CAGR vs benchmark, and investment consistency.
      </div>
    </div>`;

  return `<div style="display:flex;align-items:center;gap:24px;min-height:130px;overflow:visible">
    ${gaugeSVG}
  </div>`;
}
