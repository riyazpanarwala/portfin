// ── 03-overlap-detector.js ──
// Portfolio overlap detector: maps MF categories to implied sector weights,
// compares with actual stock sector holdings, builds overlap data with
// severity levels, renders verdict banner, KPI strip, bubble scatter SVG,
// per-sector breakdown bars, and action guidance.
// ══════════════════════════════════════════════════════════════
// PORTFOLIO OVERLAP DETECTOR
// Maps MF categories → implied sector themes, then compares
// with actual stock sector holdings to surface double-concentration.
// ══════════════════════════════════════════════════════════════

// Map each MF category to the sectors it typically holds most
const MF_CAT_SECTOR_WEIGHTS = {
  "Large Cap": {
    Banking: 0.3,
    IT: 0.18,
    "Energy/PSU": 0.12,
    FMCG: 0.1,
    "Metals/Mining": 0.08,
    "Finance/PSU": 0.08,
    Other: 0.14,
  },
  "Large & Mid Cap": {
    Banking: 0.22,
    IT: 0.15,
    "Energy/PSU": 0.1,
    FMCG: 0.08,
    "Metals/Mining": 0.08,
    "Infra/PSU": 0.1,
    Other: 0.27,
  },
  "Mid Cap": {
    Banking: 0.15,
    IT: 0.12,
    "Infra/PSU": 0.12,
    "Metals/Mining": 0.1,
    Defence: 0.08,
    Renewables: 0.07,
    Other: 0.36,
  },
  "Small Cap": {
    "Infra/PSU": 0.12,
    "Metals/Mining": 0.1,
    Defence: 0.09,
    Renewables: 0.08,
    Speculative: 0.08,
    IT: 0.08,
    Other: 0.45,
  },
  "Flexi Cap": {
    Banking: 0.22,
    IT: 0.16,
    FMCG: 0.1,
    "Energy/PSU": 0.1,
    "Metals/Mining": 0.08,
    Other: 0.34,
  },
  "Multi Cap": {
    Banking: 0.18,
    IT: 0.14,
    FMCG: 0.1,
    "Energy/PSU": 0.1,
    "Metals/Mining": 0.08,
    Other: 0.4,
  },
  ELSS: { Banking: 0.25, IT: 0.16, FMCG: 0.1, "Energy/PSU": 0.09, Other: 0.4 },
  Value: {
    Banking: 0.2,
    "Energy/PSU": 0.14,
    FMCG: 0.12,
    "Metals/Mining": 0.1,
    "Finance/PSU": 0.1,
    Other: 0.34,
  },
  Index: {
    Banking: 0.33,
    IT: 0.17,
    "Energy/PSU": 0.12,
    FMCG: 0.09,
    "Metals/Mining": 0.07,
    Other: 0.22,
  },
  Other: { Banking: 0.2, IT: 0.15, FMCG: 0.1, Other: 0.55 },
};

// Sector colour map
const OVERLAP_CLR = {
  Banking: "#f0883e",
  IT: "#79c0ff",
  "Energy/PSU": "#3fb950",
  FMCG: "#e3b341",
  "Metals/Mining": "#d4a843",
  "Finance/PSU": "#a371f7",
  "Infra/PSU": "#58a6ff",
  Defence: "#58a6ff",
  Renewables: "#56d364",
  Speculative: "#f85149",
  "Index ETF": "#484f58",
  "Commodities ETF": "#7d8590",
  Other: "#7d8590",
};

function renderOverlapDetector() {
  const el = document.getElementById("overlap-detector-wrap");
  if (!el) return;

  const totalMFInv = DATA.funds.reduce((a, f) => a + f.Invested, 0);
  const totalSTInv = DATA.stocks.reduce((a, s) => a + s.Invested, 0);
  const totalPortInv = totalMFInv + totalSTInv;

  if (!totalPortInv) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:16px;text-align:center">Upload both files to detect portfolio overlap</div>';
    return;
  }

  // ── 1. Build implied MF sector exposure (₹ value) ────────────
  const mfSectorExp = {};
  DATA.funds.forEach((f) => {
    const weights =
      MF_CAT_SECTOR_WEIGHTS[f.Category] || MF_CAT_SECTOR_WEIGHTS["Other"];
    Object.entries(weights).forEach(([sector, w]) => {
      mfSectorExp[sector] = (mfSectorExp[sector] || 0) + f.Invested * w;
    });
  });

  // ── 2. Build direct stock sector exposure (₹ actual) ─────────
  const stSectorExp = {};
  DATA.stocks.forEach((s) => {
    stSectorExp[s.Sector] = (stSectorExp[s.Sector] || 0) + s.Invested;
  });

  // ── 3. All unique sectors across both ─────────────────────────
  const allSectors = [
    ...new Set([...Object.keys(mfSectorExp), ...Object.keys(stSectorExp)]),
  ].filter((s) => s !== "Other");
  allSectors.sort((a, b) => {
    const total = (s) => (mfSectorExp[s] || 0) + (stSectorExp[s] || 0);
    return total(b) - total(a);
  });

  // ── 4. Compute overlap per sector ─────────────────────────────
  const overlapData = allSectors
    .map((sector) => {
      const mfAmt = mfSectorExp[sector] || 0;
      const stAmt = stSectorExp[sector] || 0;
      const totalAmt = mfAmt + stAmt;
      const totalPct = totalPortInv > 0 ? (totalAmt / totalPortInv) * 100 : 0;
      const hasOverlap = mfAmt > 0 && stAmt > 0;
      const mfPct = totalMFInv > 0 ? (mfAmt / totalMFInv) * 100 : 0;
      const stPct = totalSTInv > 0 ? (stAmt / totalSTInv) * 100 : 0;

      let severity = "none";
      if (hasOverlap && totalPct > 20) severity = "high";
      else if (hasOverlap && totalPct > 10) severity = "medium";
      else if (hasOverlap) severity = "low";

      return {
        sector,
        mfAmt,
        stAmt,
        totalAmt,
        totalPct,
        mfPct,
        stPct,
        hasOverlap,
        severity,
      };
    })
    .filter((d) => d.totalAmt > 1000);

  const highOverlap = overlapData.filter((d) => d.severity === "high");
  const medOverlap = overlapData.filter((d) => d.severity === "medium");
  const lowOverlap = overlapData.filter((d) => d.severity === "low");
  const noOverlap = overlapData.filter((d) => d.severity === "none");
  const overlapSectors = overlapData.filter((d) => d.hasOverlap);

  const totalDoubleExp = overlapSectors.reduce((a, d) => a + d.totalAmt, 0);
  const doubleExpPct =
    totalPortInv > 0 ? (totalDoubleExp / totalPortInv) * 100 : 0;

  // ── 5. Verdict ─────────────────────────────────────────────
  let verdictColor, verdictIcon, verdictText;
  if (highOverlap.length > 0) {
    verdictColor = "var(--red)";
    verdictIcon = "⚠";
    verdictText = `${highOverlap.length} sector${highOverlap.length > 1 ? "s" : ""} with heavy double-concentration detected — you're significantly exposed to <strong>${highOverlap.map((d) => esc(d.sector)).join(", ")}</strong> through both your MFs and direct stocks.`;
  } else if (medOverlap.length > 0) {
    verdictColor = "var(--amber)";
    verdictIcon = "◈";
    verdictText = `Moderate overlap in ${medOverlap.length} sector${medOverlap.length > 1 ? "s" : ""}. Your MF holdings and stock picks reinforce each other in <strong>${medOverlap.map((d) => esc(d.sector)).join(", ")}</strong> — worth monitoring.`;
  } else if (lowOverlap.length > 0) {
    verdictColor = "var(--blue)";
    verdictIcon = "◎";
    verdictText = `Light sector overlap detected. Your MF and stock allocations are broadly diversified with only minor theme overlap.`;
  } else {
    verdictColor = "var(--green)";
    verdictIcon = "✓";
    verdictText = `No meaningful sector overlap. Your direct stock picks and MF holdings are investing across different themes — excellent diversification.`;
  }

  const maxTotal = Math.max(...overlapData.map((d) => d.totalAmt), 1);
  const maxBubble = maxTotal;

  const severityLabel = { high: "HIGH", medium: "MOD", low: "LOW", none: "—" };
  const severityClr = {
    high: "var(--red)",
    medium: "var(--amber)",
    low: "var(--blue)",
    none: "var(--muted)",
  };
  const severityBg = {
    high: "var(--red-bg)",
    medium: "var(--amber-bg)",
    low: "var(--blue-bg)",
    none: "var(--bg4)",
  };
  const severityBorder = {
    high: "var(--red-dim)",
    medium: "#4a3500",
    low: "#1a4060",
    none: "var(--border)",
  };

  el.innerHTML = `
    <!-- Verdict banner -->
    <div style="padding:12px 16px;background:${verdictColor}18;border:1px solid ${verdictColor}44;border-radius:8px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start">
      <span style="font-size:18px;flex-shrink:0">${verdictIcon}</span>
      <div>
        <div style="font-size:11px;font-weight:600;color:${verdictColor};margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Overlap Analysis</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6">${verdictText}</div>
      </div>
    </div>

    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      ${[
        {
          l: "Double-exposed capital",
          v: fmtL(Math.round(totalDoubleExp)),
          s: doubleExpPct.toFixed(1) + "% of portfolio",
          c: "var(--amber)",
        },
        {
          l: "High overlap sectors",
          v: highOverlap.length || "—",
          s: highOverlap.length ? "Needs attention" : "None detected",
          c: highOverlap.length ? "var(--red)" : "var(--green)",
        },
        {
          l: "Moderate overlap",
          v: medOverlap.length || "—",
          s: "Sectors to monitor",
          c: "var(--amber)",
        },
        {
          l: "Well diversified",
          v: noOverlap.length || "—",
          s: "Single-path sectors",
          c: "var(--green)",
        },
      ]
        .map(
          (k) =>
            `<div class="tax-kpi"><div class="tax-kpi-label">${k.l}</div><div class="tax-kpi-val" style="color:${k.c}">${k.v}</div><div style="font-size:10px;color:var(--muted)">${k.s}</div></div>`,
        )
        .join("")}
    </div>

    <!-- Bubble scatter map -->
    ${overlapData.length >= 2 ? _buildOverlapBubble(overlapData, maxBubble) : ""}

    <!-- Per-sector bar breakdown -->
    <div style="margin-bottom:8px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Sector-by-sector exposure breakdown</div>
      <div style="display:flex;gap:12px;align-items:center;font-size:10px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#58a6ff;border-radius:2px;display:inline-block"></span>Via Mutual Funds (implied weight)</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#a371f7;border-radius:2px;display:inline-block"></span>Direct Stocks (actual)</span>
      </div>
      ${overlapData
        .map((d) => {
          const clr = OVERLAP_CLR[d.sector] || "#7d8590";
          const mfW = Math.round((d.mfAmt / maxTotal) * 100);
          const stW = Math.round((d.stAmt / maxTotal) * 100);
          const sv = severityLabel[d.severity];
          const sc = severityClr[d.severity];
          const sbg = severityBg[d.severity];
          const sbrd = severityBorder[d.severity];
          const tip = d.hasOverlap
            ? `${d.mfPct.toFixed(1)}% of MF portfolio + ${d.stPct.toFixed(1)}% of stocks = double-exposed`
            : d.mfAmt > 0
              ? "Exposure only via MF funds"
              : "Only in direct stocks";
          return `<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <span style="width:8px;height:8px;border-radius:2px;background:${clr};flex-shrink:0;display:inline-block"></span>
            <span style="font-size:11px;font-weight:500;flex:1">${esc(d.sector)}</span>
            ${d.hasOverlap ? `<span style="font-size:9px;padding:2px 7px;border-radius:3px;background:${sbg};color:${sc};border:1px solid ${sbrd};font-weight:600">${sv} OVERLAP</span>` : `<span style="font-size:9px;padding:2px 7px;border-radius:3px;background:var(--bg4);color:var(--muted);border:1px solid var(--border)">SINGLE PATH</span>`}
            <span style="font-size:11px;font-weight:600;color:var(--gold);min-width:72px;text-align:right">${fmtL(Math.round(d.totalAmt))}</span>
            <span style="font-size:10px;color:var(--muted);min-width:36px;text-align:right">${d.totalPct.toFixed(1)}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:9px;color:var(--muted2);min-width:72px">MF implied</span>
            <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${mfW}%;background:#58a6ff;border-radius:3px;transition:width .5s"></div>
            </div>
            <span style="font-size:10px;color:var(--muted);min-width:52px;text-align:right">${fmtL(Math.round(d.mfAmt))}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:9px;color:var(--muted2);min-width:72px">Direct stock</span>
            <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${stW}%;background:#a371f7;border-radius:3px;transition:width .5s"></div>
            </div>
            <span style="font-size:10px;color:var(--muted);min-width:52px;text-align:right">${fmtL(Math.round(d.stAmt))}</span>
          </div>
          <div style="font-size:9px;color:var(--muted2);padding-left:80px">${tip}</div>
        </div>`;
        })
        .join("")}
    </div>

    <!-- Action guidance for overlapping sectors -->
    ${
      highOverlap.length || medOverlap.length
        ? `
    <div style="margin-top:4px;padding:12px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">💡 What to do about overlap</div>
      ${[
        ...highOverlap.map(
          (
            d,
          ) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px">
          <span style="color:var(--red);flex-shrink:0;font-size:13px">⚠</span>
          <span><strong style="color:var(--red)">${esc(d.sector)}:</strong> <span style="color:var(--muted)">
            Total exposure ${d.totalPct.toFixed(1)}% of portfolio (${d.mfPct.toFixed(1)}% via MFs + ${d.stPct.toFixed(1)}% in direct stocks).
            A ${esc(d.sector)} correction will hit both your fund NAVs and stock prices simultaneously.
            Consider reducing your direct ${esc(d.sector)} stock position or switching to a fund category with lower ${esc(d.sector)} weighting.
          </span></span>
        </div>`,
        ),
        ...medOverlap.map(
          (
            d,
          ) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px">
          <span style="color:var(--amber);flex-shrink:0;font-size:13px">◈</span>
          <span><strong style="color:var(--amber)">${esc(d.sector)}:</strong> <span style="color:var(--muted)">
            Moderate double-exposure at ${d.totalPct.toFixed(1)}% of portfolio. No immediate action needed, but monitor — if adding more positions in this sector, prefer the path you're already underweight in.
          </span></span>
        </div>`,
        ),
      ].join("")}
      <div style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6">
        ⓘ MF sector exposure is estimated from typical category index weightings — actual fund holdings may differ. Check your fund's latest factsheet for precise sector allocation figures.
      </div>
    </div>`
        : ""
    }
  `;
}

// Build SVG bubble scatter: X = MF exposure %, Y = Stock exposure %, size = total ₹
function _buildOverlapBubble(data, maxBubble) {
  const W = 480,
    H = 260,
    padL = 54,
    padR = 16,
    padT = 16,
    padB = 48;
  const cW = W - padL - padR,
    cH = H - padT - padB;

  const maxMFpct = Math.max(...data.map((d) => d.mfPct), 1);
  const maxSTpct = Math.max(...data.map((d) => d.stPct), 1);
  const xScale = (v) => padL + (v / maxMFpct) * cW;
  const yScale = (v) => padT + cH - (v / maxSTpct) * cH;

  let gridLines = "";
  for (let i = 0; i <= 4; i++) {
    const xv = (maxMFpct * i) / 4;
    const yv = (maxSTpct * i) / 4;
    const gx = xScale(xv),
      gy = yScale(yv);
    gridLines += `<line x1="${gx.toFixed(1)}" x2="${gx.toFixed(1)}" y1="${padT}" y2="${padT + cH}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`;
    gridLines += `<line x1="${padL}" x2="${padL + cW}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`;
    gridLines += `<text x="${gx.toFixed(1)}" y="${padT + cH + 14}" font-size="8" fill="var(--muted)" text-anchor="middle" font-family="DM Mono,monospace">${xv.toFixed(1)}%</text>`;
    if (i > 0)
      gridLines += `<text x="${padL - 6}" y="${gy.toFixed(1)}" font-size="8" fill="var(--muted)" text-anchor="end" dominant-baseline="middle" font-family="DM Mono,monospace">${yv.toFixed(1)}%</text>`;
  }

  // Highlight high-overlap zone (upper-right quadrant)
  const dangerX = xScale(maxMFpct * 0.5);
  const dangerY = yScale(maxSTpct * 0.5);
  const dangerRect = `<rect x="${dangerX.toFixed(1)}" y="${padT}" width="${(padL + cW - dangerX).toFixed(1)}" height="${(dangerY - padT).toFixed(1)}" fill="rgba(248,81,73,0.05)" rx="2"/>`;
  const dangerLbl = `<text x="${((dangerX + padL + cW) / 2).toFixed(1)}" y="${padT + 10}" font-size="8" fill="rgba(248,81,73,0.45)" text-anchor="middle" font-family="DM Mono,monospace" letter-spacing="0.05em">HIGH OVERLAP ZONE</text>`;

  const bubbles = data
    .map((d) => {
      const cx = xScale(d.mfPct);
      const cy = yScale(d.stPct);
      const r = Math.max(
        5,
        Math.min(22, Math.sqrt(d.totalAmt / maxBubble) * 28),
      );
      const clr = OVERLAP_CLR[d.sector] || "#7d8590";
      const op = d.hasOverlap ? "0.88" : "0.42";
      const lbl = d.sector.length > 9 ? d.sector.slice(0, 9) + "…" : d.sector;
      return `<g>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${clr}" opacity="${op}" stroke="var(--bg2)" stroke-width="1.5"/>
      <text x="${cx.toFixed(1)}" y="${(cy + r + 9).toFixed(1)}" font-size="7.5" fill="var(--muted)" text-anchor="middle" font-family="DM Mono,monospace">${esc(lbl)}</text>
    </g>`;
    })
    .join("");

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Exposure map — X: MF implied %, Y: direct stock % · bubble size = total capital at risk</div>
      <div style="overflow-x:auto">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;height:auto;display:block">
          ${dangerRect}${dangerLbl}
          ${gridLines}
          <line x1="${padL}" x2="${padL + cW}" y1="${padT + cH}" y2="${padT + cH}" stroke="var(--border2)" stroke-width="1.5"/>
          <line x1="${padL}" x2="${padL}" y1="${padT}" y2="${padT + cH}" stroke="var(--border2)" stroke-width="1.5"/>
          ${bubbles}
          <text x="${(padL + cW / 2).toFixed(1)}" y="${H - 4}" font-size="9" fill="var(--muted)" text-anchor="middle" font-family="DM Mono,monospace">→ MF implied sector exposure %</text>
          <text x="10" y="${(padT + cH / 2).toFixed(1)}" font-size="9" fill="var(--muted)" text-anchor="middle" font-family="DM Mono,monospace" transform="rotate(-90,10,${(padT + cH / 2).toFixed(1)})">↑ Direct stock %</text>
        </svg>
      </div>
      <div style="font-size:9px;color:var(--muted2);margin-top:4px;line-height:1.5">Bubbles in the top-right zone have simultaneous MF and stock exposure — a market move in that sector hits you twice. Faded bubbles have single-path exposure only.</div>
    </div>`;
}
