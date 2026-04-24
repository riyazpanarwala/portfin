// ── page-overview/01-render-overview.js ─────────────────────────────────────
// Main renderOverview() orchestrator.
// Renders: KPI cards, MF vs Stocks allocation, category donut,
// top performers, risk concentration alerts.
// Sub-sections are delegated to sibling modules.

function renderOverview() {
  const k = DATA.kpis;
  const sinceMF = k.earliestMF
    ? "Since " + fmtMonthYear(k.earliestMF)
    : "All time";

  document.getElementById("kpi-overview").innerHTML = renderKpiCards([
    { l: "Total Invested", v: fmtL(k.totalInvested), s: "Capital deployed",  sc: "",                         a: "#d4a843" },
    { l: "Current Value",  v: fmtL(k.totalValue),    s: "Portfolio value",   sc: "",                         a: "#58a6ff" },
    { l: "Total Gain",     v: fmtL(k.totalGain),     s: fmtP(k.totalReturn), sc: k.totalGain >= 0 ? "up" : "dn", a: "#3fb950" },
    { l: "MF Return",      v: fmtP(k.mfReturn),      s: sinceMF,             sc: "up",                       a: "#d4a843" },
    { l: "MF CAGR",        v: fmtP(k.mfCAGR),        s: "Compounded p.a.",   sc: "up",                       a: "#a371f7" },
    { l: "Stock P&L",      v: fmtL(k.stGain),        s: fmtP(k.stReturn),    sc: k.stGain >= 0 ? "up" : "dn", a: "#f85149" },
  ]);

  _renderAllocationSplit(k);
  _renderCategoryDonut();
  _renderTopPerformers();
  _renderRiskAlerts(k);

  // Delegate to sub-modules
  renderHealthScore();
  renderSIPReminder();
  renderDrawdownAnalyzer();
  renderRiskReturnClassification();
}

// ── MF vs Stocks allocation bars + gain tiles ─────────────────
function _renderAllocationSplit(k) {
  const mfP = k.totalInvested
    ? Math.round((k.mfInvested / k.totalInvested) * 100)
    : 0;
  const stP = 100 - mfP;

  document.getElementById("alloc-split").innerHTML = `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#58a6ff">Mutual Funds</span>
        <span style="color:#58a6ff">${mfP}% · ${fmtL(k.mfInvested)}</span>
      </div>
      <div class="bar-track" style="height:8px">
        <div class="bar-fill up" style="width:${mfP}%;background:#58a6ff;height:100%"></div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#f0883e">Equity Stocks</span>
        <span style="color:#f0883e">${stP}% · ${fmtL(k.stInvested)}</span>
      </div>
      <div class="bar-track" style="height:8px">
        <div class="bar-fill up" style="width:${stP}%;background:#f0883e;height:100%"></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:6px;padding:10px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">MF gain</div>
        <div style="font-size:16px;font-weight:600;color:var(--green);font-family:var(--sans)">${fmtL(k.mfGain)}</div>
        <div style="font-size:11px;color:var(--green)">${fmtP(k.mfReturn)}</div>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Stock P&L</div>
        <div style="font-size:16px;font-weight:600;color:${k.stGain >= 0 ? "var(--green)" : "var(--red)"};font-family:var(--sans)">${fmtL(k.stGain)}</div>
        <div style="font-size:11px;color:${k.stGain >= 0 ? "var(--green)" : "var(--red)"}">${fmtP(k.stReturn)}</div>
      </div>
    </div>`;
}

// ── MF category donut ─────────────────────────────────────────
function _renderCategoryDonut() {
  donut(
    "donut-mf",
    "legend-mf",
    DATA.mfCategories.map((c) => ({ k: c.Category, v: c.Invested })),
    CAT_CLR,
  );
}

// ── Top performers (MF + Stocks) ──────────────────────────────
function _renderTopPerformers() {
  const maxMF = Math.max(...DATA.funds.map((f) => Math.abs(f.RetPct)), 1);
  const maxST = Math.max(...DATA.stocks.map((s) => Math.abs(s.RetPct)), 1);

  document.getElementById("top-mf").innerHTML = DATA.funds.length
    ? [...DATA.funds]
        .sort((a, b) => b.RetPct - a.RetPct)
        .slice(0, 4)
        .map(
          (f) =>
            `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                <span style="font-weight:500">${esc(f.name)}</span>
                <span style="color:var(--muted)">${fmtL(f.Gain)}</span>
              </div>
              ${miniBar(f.RetPct, maxMF)}
            </div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload MF file to see data</div>';

  document.getElementById("top-st").innerHTML = DATA.stocks.length
    ? [...DATA.stocks]
        .sort((a, b) => b.RetPct - a.RetPct)
        .slice(0, 4)
        .map(
          (s) =>
            `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                <span style="font-weight:500">${esc(s.name)}</span>
                <span style="color:var(--muted)">${fmtL(s.Gain)}</span>
              </div>
              ${miniBar(s.RetPct, maxST)}
            </div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload Stocks file to see data</div>';
}

// ── Risk concentration alerts ─────────────────────────────────
function _renderRiskAlerts(k) {
  const alerts = [];
  const stTotalInv = DATA.stocks.reduce((a, s) => a + s.Invested, 0) || 1;

  DATA.stocks.forEach((s) => {
    const conc = (s.Invested / stTotalInv) * 100;
    if (s.RetPct < -40) {
      alerts.push([
        esc(s.name),
        `${fmtP(s.RetPct)} return — strong EXIT candidate, no recovery thesis visible`,
      ]);
    } else if (conc > 15 && s.RetPct < 0) {
      alerts.push([
        esc(s.name),
        `${conc.toFixed(1)}% of stock portfolio, ${fmtP(s.RetPct)} return — high concentration risk, consider trimming`,
      ]);
    } else if (s.Sector === "Speculative" && s.RetPct < -20) {
      alerts.push([
        esc(s.name),
        `${fmtP(s.RetPct)} in speculative sector — averaging down not advised; reduce to ≤5%`,
      ]);
    } else if (s.CAGR < -15 && s.Invested > 30000) {
      alerts.push([
        esc(s.name),
        `CAGR ${fmtP(s.CAGR)}, ₹${Math.round(s.Invested / 1000)}K invested — reassess thesis`,
      ]);
    }
  });

  DATA.sectors.forEach((sec) => {
    const secPct = stTotalInv ? (sec.Invested / stTotalInv) * 100 : 0;
    if (secPct > 30 && sec.Gain < 0) {
      alerts.push([
        esc(sec.Sector) + " Sector",
        `${secPct.toFixed(1)}% of stocks with ${fmtL(sec.Gain)} loss — over-concentrated`,
      ]);
    }
  });

  document.getElementById("risk-alerts").innerHTML = alerts.length
    ? alerts
        .map(
          ([n, m]) =>
            `<div class="alert-row">
              <span class="alert-name">${n}</span>
              <span class="alert-msg">${m}</span>
            </div>`,
        )
        .join("")
    : '<div style="color:var(--green);font-size:11px">✓ No critical concentration alerts — portfolio looks balanced</div>';
}
