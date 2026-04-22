// ── page-analytics.js — Analytics, Benchmark Comparison, Holding Period Chart ──

// ── Analytics ─────────────────────────────────────────────────
function renderAnalytics() {
  scheduleChart("chart-monthly", 50, (el) => {
    const d = DATA.monthlyMF;
    if (!d.length) {
      el.parentElement.innerHTML =
        '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload MF file to see investment flow chart</div>';
      return null;
    }
    const maxV = Math.max(...d.map((x) => x.v));
    return new Chart(el, {
      type: "bar",
      data: {
        labels: d.map((x) => x.m),
        datasets: [
          {
            label: "Monthly Investment",
            data: d.map((x) => x.v),
            backgroundColor: d.map((x) =>
              x.v >= maxV * 0.7 ? "#d4a843" : "#58a6ff",
            ),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => fmtL(ctx.raw) },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, color: "#7d8590", maxRotation: 60 },
            grid: { color: "#21262d" },
          },
          y: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              callback: (v) => fmtL(v),
            },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });

  // Sector P&L
  const maxS = Math.max(...DATA.sectors.map((s) => Math.abs(s.RetPct)), 1);
  document.getElementById("sector-pl").innerHTML = DATA.sectors.length
    ? [...DATA.sectors]
        .sort((a, b) => b.Gain - a.Gain)
        .map(
          (s) =>
            `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span>${esc(s.Sector)}</span><span class="${cls(s.Gain)}">${fmtL(s.Gain)}</span></div>${miniBar(s.RetPct, maxS)}</div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload Stocks file to see sector P&L</div>';

  // Portfolio ratios
  const k = DATA.kpis;
  const n = DATA.stocks.length || 1,
    nMF = DATA.funds.length || 1;
  const mfWin = DATA.funds.filter((f) => f.Gain > 0).length;
  const stWin = DATA.stocks.filter((s) => s.Gain > 0).length;
  const mfSharePct = k.totalInvested
    ? Math.round((k.mfInvested / k.totalInvested) * 100)
    : 0;
  const specInv = DATA.stocks
    .filter((s) => s.Sector === "Speculative")
    .reduce((a, s) => a + s.Invested, 0);
  const specPct = k.stInvested ? Math.round((specInv / k.stInvested) * 100) : 0;
  const avgMFcagr =
    nMF > 0
      ? parseFloat(
          (DATA.funds.reduce((a, f) => a + f.CAGR, 0) / nMF).toFixed(1),
        )
      : 0;
  const bestMF = [...DATA.funds].sort((a, b) => b.RetPct - a.RetPct)[0];
  const worstST = [...DATA.stocks].sort((a, b) => a.RetPct - b.RetPct)[0];

  const ratioRows = [];
  if (nMF > 1)
    ratioRows.push([
      "MF win rate",
      mfWin + "/" + DATA.funds.length,
      mfWin === DATA.funds.length
        ? "100% profitable"
        : mfWin + " of " + DATA.funds.length + " in profit",
      mfWin === DATA.funds.length ? "var(--green)" : "var(--amber)",
    ]);
  if (n > 1)
    ratioRows.push([
      "Stock win rate",
      stWin + "/" + DATA.stocks.length,
      stWin + " of " + DATA.stocks.length + " in profit",
      stWin > n / 2 ? "var(--green)" : "var(--red)",
    ]);
  if (k.totalInvested)
    ratioRows.push([
      "MF share of portfolio",
      mfSharePct + "%",
      "Target: 70%+",
      mfSharePct >= 70 ? "var(--green)" : "var(--blue)",
    ]);
  if (specPct > 0)
    ratioRows.push([
      "Speculative exposure",
      specPct + "%",
      specPct < 10 ? "Within safe range" : "Reduce to <10%",
      specPct < 10 ? "var(--green)" : "var(--red)",
    ]);
  if (avgMFcagr)
    ratioRows.push([
      "Avg MF CAGR",
      fmtP(avgMFcagr),
      avgMFcagr > 10 ? "Beats FD & inflation" : "Below 10% — review funds",
      avgMFcagr > 10 ? "var(--green)" : "var(--amber)",
    ]);
  if (bestMF)
    ratioRows.push([
      "Best MF fund",
      bestMF.name.split(" ").slice(0, 2).join(" "),
      "+" + bestMF.RetPct.toFixed(1) + "% · " + fmtL(bestMF.Gain) + " gain",
      "var(--gold)",
    ]);
  if (worstST)
    ratioRows.push([
      "Worst stock",
      worstST.name,
      fmtP(worstST.RetPct) + " · " + fmtL(worstST.Gain) + " loss",
      "var(--red)",
    ]);

  document.getElementById("ratios").innerHTML = ratioRows.length
    ? ratioRows
        .map(
          ([l, v, n, c]) =>
            `<div class="stat-row"><div><div class="stat-label">${l}</div><div class="stat-note">${n}</div></div><div class="stat-val" style="color:${c}">${v}</div></div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload files to see ratios</div>';

  // XIRR
  let xirrHTML =
    '<div style="color:var(--muted);font-size:11px">Upload files to compute XIRR</div>';
  if (DATA.mfLots.length) {
    const mfCF = [...DATA.mfLots.map((l) => ({ a: -l.amt, d: l.date }))];
    mfCF.push({ a: k.mfValue, d: new Date() });
    mfCF.sort((a, b) => a.d - b.d);
    const mfXirr = calcXIRR(
      mfCF.map((x) => x.a),
      mfCF.map((x) => x.d),
    );
    const stCF = [...DATA.stLots.map((l) => ({ a: -l.amt, d: l.date }))];
    stCF.push({ a: k.stValue, d: new Date() });
    stCF.sort((a, b) => a.d - b.d);
    const stXirr = DATA.stLots.length
      ? calcXIRR(
          stCF.map((x) => x.a),
          stCF.map((x) => x.d),
        )
      : null;
    xirrHTML = `
      <div class="stat-row"><div><div class="stat-label">MF XIRR</div><div class="stat-note">Money-weighted return (all lots)</div></div><div class="stat-val" style="color:${mfXirr && mfXirr > 0 ? "var(--gold)" : "var(--red)"}">${mfXirr !== null ? pSign(mfXirr) + mfXirr.toFixed(1) + "%" : "—"}</div></div>
      ${stXirr !== null ? `<div class="stat-row"><div><div class="stat-label">Stocks XIRR</div><div class="stat-note">Money-weighted return (all lots)</div></div><div class="stat-val" style="color:${stXirr >= 0 ? "var(--green)" : "var(--red)"}">${pSign(stXirr) + stXirr.toFixed(1) + "%"}</div></div>` : ""}
      <p style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6">XIRR accounts for exact timing of every investment — it reflects the true compounded return on your actual cash deployed.</p>`;
  }
  document.getElementById("xirr-display").innerHTML = xirrHTML;

  // Holding Period Distribution Chart
  renderHoldingPeriodChart();

  // Portfolio Overlap Detector
  renderOverlapDetector();

  renderSectorWheel();

  // Benchmark comparison
  renderBenchmark();
}

// ══════════════════════════════════════════════════════════════
// HOLDING PERIOD DISTRIBUTION CHART
// ══════════════════════════════════════════════════════════════
function renderHoldingPeriodChart() {
  const el = document.getElementById("holding-period-chart-wrap");
  if (!el) return;

  const allLots = [];
  DATA.funds.forEach((f) => {
    (f.rawLots || []).forEach((l) => {
      const days = Math.floor(
        (Date.now() - new Date(l.date).getTime()) / (24 * 3600 * 1000),
      );
      allLots.push({ days, amt: l.amt || 0, isLTCG: days >= 365, type: "MF" });
    });
  });
  DATA.stocks.forEach((s) => {
    (s.rawLots || []).forEach((l) => {
      const days = Math.floor(
        (Date.now() - new Date(l.date).getTime()) / (24 * 3600 * 1000),
      );
      allLots.push({
        days,
        amt: l.inv || 0,
        isLTCG: days >= 365,
        type: "Stock",
      });
    });
  });

  if (!allLots.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see holding period distribution</div>';
    return;
  }

  const BUCKETS = [
    { label: "0–3 months", min: 0, max: 91, isLTCG: false },
    { label: "3–6 months", min: 91, max: 182, isLTCG: false },
    { label: "6–12 months", min: 182, max: 365, isLTCG: false },
    { label: "1–2 years", min: 365, max: 730, isLTCG: true },
    { label: "2–3 years", min: 730, max: 1095, isLTCG: true },
    { label: "3–5 years", min: 1095, max: 1825, isLTCG: true },
    { label: "5+ years", min: 1825, max: Infinity, isLTCG: true },
  ];

  const bucketData = BUCKETS.map((b) => {
    const lots = allLots.filter((l) => l.days >= b.min && l.days < b.max);
    const mfAmt = lots
      .filter((l) => l.type === "MF")
      .reduce((a, l) => a + l.amt, 0);
    const stAmt = lots
      .filter((l) => l.type === "Stock")
      .reduce((a, l) => a + l.amt, 0);
    const count = lots.length;
    return { ...b, mfAmt, stAmt, total: mfAmt + stAmt, count };
  }).filter((b) => b.total > 0);

  if (!bucketData.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">No lot-level date data available</div>';
    return;
  }

  const totalAmt = allLots.reduce((a, l) => a + l.amt, 0);
  const ltcgAmt = allLots
    .filter((l) => l.isLTCG)
    .reduce((a, l) => a + l.amt, 0);
  const stcgAmt = totalAmt - ltcgAmt;
  const ltcgPct = totalAmt > 0 ? Math.round((ltcgAmt / totalAmt) * 100) : 0;
  const avgHold = Math.round(
    allLots.reduce((a, l) => a + l.days, 0) / allLots.length,
  );
  const lotCount = allLots.length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      ${[
        {
          l: "LTCG lots",
          v: ltcgPct + "%",
          s: "Held >1 year",
          c: "var(--green)",
        },
        {
          l: "STCG lots",
          v: 100 - ltcgPct + "%",
          s: "Held <1 year",
          c: "var(--amber)",
        },
        {
          l: "LTCG invested",
          v: fmtL(ltcgAmt),
          s: "Tax-advantaged capital",
          c: "var(--green)",
        },
        {
          l: "STCG exposed",
          v: fmtL(stcgAmt),
          s: "20% tax if sold now",
          c: "var(--red)",
        },
        {
          l: "Avg hold",
          v: fmtHoldPeriod(avgHold),
          s: "Across all lots",
          c: "var(--gold)",
        },
        {
          l: "Total lots",
          v: lotCount,
          s: "MF + Stock lots",
          c: "var(--blue)",
        },
      ]
        .map(
          (c) =>
            `<div class="tax-kpi"><div class="tax-kpi-label">${c.l}</div><div class="tax-kpi-val" style="color:${c.c}">${c.v}</div><div style="font-size:10px;color:var(--muted)">${c.s}</div></div>`,
        )
        .join("")}
    </div>
    <div style="display:flex;gap:12px;align-items:center;font-size:10px;color:var(--muted);margin-bottom:10px">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#58a6ff;border-radius:2px;display:inline-block"></span>Mutual Funds</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#a371f7;border-radius:2px;display:inline-block"></span>Stocks</span>
      <span style="margin-left:8px;padding:2px 8px;background:var(--green-bg);color:var(--green);border:1px solid var(--green-dim);border-radius:3px;font-size:9px;font-weight:600">LTCG</span>
      <span style="padding:2px 8px;background:var(--amber-bg);color:var(--amber);border:1px solid #4a3500;border-radius:3px;font-size:9px;font-weight:600">STCG</span>
    </div>
    <div style="position:relative;height:220px"><canvas id="chart-holding-period"></canvas></div>
    <div style="margin-top:14px" id="holding-period-detail-rows"></div>
  `;

  const maxTotal = Math.max(...bucketData.map((b) => b.total), 1);
  document.getElementById("holding-period-detail-rows").innerHTML = bucketData
    .map((b) => {
      const pct = Math.round((b.total / totalAmt) * 100);
      const taxTag = b.isLTCG
        ? `<span class="ltcg-badge">LTCG 12.5%</span>`
        : `<span class="stcg-badge">STCG 20%</span>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="min-width:90px;font-size:10px;color:var(--muted)">${b.label}</div>
      <div style="flex:1;height:14px;background:var(--bg4);border-radius:3px;overflow:hidden;position:relative">
        <div style="position:absolute;left:0;top:0;height:100%;width:${Math.round((b.mfAmt / maxTotal) * 100)}%;background:#58a6ff;border-radius:3px 0 0 3px"></div>
        <div style="position:absolute;left:${Math.round((b.mfAmt / maxTotal) * 100)}%;top:0;height:100%;width:${Math.round((b.stAmt / maxTotal) * 100)}%;background:#a371f7"></div>
      </div>
      <div style="min-width:68px;text-align:right;font-size:11px;font-weight:500">${fmtL(b.total)}</div>
      <div style="min-width:32px;text-align:right;font-size:10px;color:var(--muted)">${pct}%</div>
      <div style="min-width:24px;text-align:right;font-size:10px;color:var(--muted)">${b.count} lots</div>
      <div style="min-width:80px;text-align:right">${taxTag}</div>
    </div>`;
    })
    .join("");

  scheduleChart("chart-holding-period", 60, (canvas) => {
    const labels = bucketData.map((b) => b.label);
    const mfData = bucketData.map((b) => Math.round(b.mfAmt));
    const stData = bucketData.map((b) => Math.round(b.stAmt));

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "MF",
            data: mfData,
            backgroundColor: "#58a6ff",
            borderRadius: 3,
            borderSkipped: false,
            stack: "stack",
          },
          {
            label: "Stocks",
            data: stData,
            backgroundColor: "#a371f7",
            borderRadius: 3,
            borderSkipped: false,
            stack: "stack",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const b = bucketData[idx];
                return [
                  `Total: ${fmtL(b.total)}`,
                  `${b.count} lots`,
                  b.isLTCG ? "LTCG — 12.5% tax" : "STCG — 20% tax",
                ];
              },
              label: (ctx) => `${ctx.dataset.label}: ${fmtL(ctx.raw)}`,
            },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 9 }, color: "#7d8590", maxRotation: 30 },
            grid: { color: "#21262d" },
          },
          y: {
            stacked: true,
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              callback: (v) => fmtL(v),
            },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}

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

// ── Benchmark Comparison ──────────────────────────────────────
const BM_ANNUAL = {
  "Nifty 50": {
    1: 8.5,
    2: 10.2,
    3: 12.8,
    5: 14.2,
    7: 13.4,
    10: 12.9,
    15: 13.5,
  },
  "Nifty Next 50": {
    1: 6.1,
    2: 8.4,
    3: 10.4,
    5: 12.1,
    7: 11.8,
    10: 11.2,
    15: 11.8,
  },
  "Nifty Midcap 150": {
    1: 12.4,
    2: 15.8,
    3: 18.2,
    5: 19.8,
    7: 17.6,
    10: 16.4,
    15: 17.2,
  },
  "Nifty Smallcap": {
    1: 14.8,
    2: 19.3,
    3: 22.6,
    5: 24.3,
    7: 20.1,
    10: 18.8,
    15: 19.5,
  },
  "Nifty 500": {
    1: 9.2,
    2: 11.6,
    3: 14.1,
    5: 15.8,
    7: 14.6,
    10: 13.8,
    15: 14.3,
  },
  Sensex: { 1: 9.0, 2: 10.8, 3: 13.1, 5: 14.5, 7: 13.7, 10: 13.2, 15: 14.0 },
  PPF: { 1: 7.1, 2: 7.1, 3: 7.1, 5: 7.1, 7: 7.2, 10: 7.3, 15: 7.5 },
  "FD (SBI)": { 1: 6.5, 2: 6.6, 3: 6.8, 5: 6.5, 7: 6.6, 10: 6.7, 15: 6.8 },
  "Inflation (CPI)": {
    1: 5.2,
    2: 5.3,
    3: 5.4,
    5: 5.6,
    7: 5.5,
    10: 5.5,
    15: 5.4,
  },
};
const CATEGORY_BENCHMARK_MAP = {
  "Large Cap": "Nifty 50",
  "Large & Mid Cap": "Nifty 500",
  "Mid Cap": "Nifty Midcap 150",
  "Small Cap": "Nifty Smallcap",
  "Flexi Cap": "Nifty 500",
  "Multi Cap": "Nifty 500",
  ELSS: "Nifty 500",
  Value: "Nifty 50",
  Index: "Nifty 50",
  Other: "Nifty 50",
};
const BM_CHART_ORDER = [
  "Nifty 50",
  "Nifty Next 50",
  "Nifty Midcap 150",
  "Nifty Smallcap",
  "Nifty 500",
  "Sensex",
  "PPF",
  "FD (SBI)",
  "Inflation (CPI)",
];
const BM_CHART_COLORS = {
  "Nifty 50": ["rgba(88,166,255,.80)", "#58a6ff"],
  "Nifty Next 50": ["rgba(88,166,255,.55)", "#58a6ff"],
  "Nifty Midcap 150": ["rgba(88,166,255,.65)", "#58a6ff"],
  "Nifty Smallcap": ["rgba(88,166,255,.45)", "#58a6ff"],
  "Nifty 500": ["rgba(88,166,255,.35)", "#58a6ff"],
  Sensex: ["rgba(88,166,255,.70)", "#58a6ff"],
  PPF: ["rgba(163,113,247,.65)", "#a371f7"],
  "FD (SBI)": ["rgba(163,113,247,.45)", "#a371f7"],
  "Inflation (CPI)": ["rgba(248,81,73,.50)", "#f85149"],
};

function calculateBenchmarkCAGR(bmKey, days) {
  const table = BM_ANNUAL[bmKey];
  if (!table) return null;
  const yrs = days / 365.25;
  const keys = [1, 2, 3, 5, 7, 10, 15];
  if (yrs <= keys[0]) return table[keys[0]];
  if (yrs >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (yrs >= keys[i] && yrs <= keys[i + 1]) {
      const t = (yrs - keys[i]) / (keys[i + 1] - keys[i]);
      return parseFloat(
        (table[keys[i]] + t * (table[keys[i + 1]] - table[keys[i]])).toFixed(2),
      );
    }
  }
  return table[10];
}
function getBenchmarkForCategory(category) {
  return CATEGORY_BENCHMARK_MAP[category] || "Nifty 50";
}
function calculateAlpha(fundCAGR, bmCAGR) {
  return parseFloat((fundCAGR - bmCAGR).toFixed(2));
}
function getFundDecision(alpha, holdDays) {
  const held1y = holdDays >= 365,
    held2y = holdDays >= 730;
  if (alpha > 3)
    return {
      action: "ADD",
      cls: "tag-add",
      reason: `+${alpha.toFixed(1)}% alpha — consistently outperforming benchmark`,
    };
  if (alpha >= 1 && alpha <= 3)
    return {
      action: "HOLD",
      cls: "tag-hold",
      reason: `+${alpha.toFixed(1)}% alpha — modest outperformance`,
    };
  if (alpha >= -3 && alpha < 1 && !held1y)
    return {
      action: "HOLD",
      cls: "tag-hold",
      reason: `${alpha.toFixed(1)}% alpha but held <1yr — too early to judge`,
    };
  if (alpha >= -3 && alpha < 1 && held1y)
    return {
      action: "REDUCE",
      cls: "tag-reduce",
      reason: `${alpha.toFixed(1)}% alpha over ${Math.round(holdDays / 365)}yr — underdelivering`,
    };
  if (alpha < -3 && !held2y)
    return {
      action: "REDUCE",
      cls: "tag-reduce",
      reason: `${alpha.toFixed(1)}% alpha — significant lag`,
    };
  if (alpha < -3 && held2y)
    return {
      action: "EXIT",
      cls: "tag-exit",
      reason: `${alpha.toFixed(1)}% alpha over ${Math.round(holdDays / 365)}yr — persistent underperformer`,
    };
  return { action: "HOLD", cls: "tag-hold", reason: "Insufficient data" };
}
function calculatePortfolioBenchmark() {
  const totalInv = DATA.funds.reduce((a, f) => a + f.Invested, 0);
  if (!totalInv) return null;
  let w = 0;
  DATA.funds.forEach((f) => {
    const bk = getBenchmarkForCategory(f.Category);
    const bc = calculateBenchmarkCAGR(bk, f.holdDays || 365);
    w += (bc || 0) * (f.Invested / totalInv);
  });
  return parseFloat(w.toFixed(2));
}
function buildFundAnalysis() {
  return DATA.funds.map((f) => {
    const bmKey = getBenchmarkForCategory(f.Category);
    const bmCagr = calculateBenchmarkCAGR(bmKey, f.holdDays || 365);
    const alpha = calculateAlpha(f.CAGR, bmCagr);
    const decision = getFundDecision(alpha, f.holdDays || 0);
    return { ...f, bmKey, bmCagr, alpha, decision };
  });
}

let bmPeriod = "5y";
// FIX #7: Do NOT clear _fundAnalysisCache when the period chip changes.
// Per-fund analysis uses each fund's actual holdDays, not bmPeriod.
// Only the bar chart changes; renderBenchmark() handles that directly from
// BM_ANNUAL lookup — no need to re-run the expensive buildFundAnalysis().
 
function setBMPeriod(p) {
  bmPeriod = p;
  // Intentionally NOT clearing _fundAnalysisCache here (see FIX #7)
  renderBenchmark();
}

function renderBenchmark() {
  const bmKpisEl = document.getElementById("bm-kpis");
  const bmFilterEl = document.getElementById("bm-period-filter");
  const bmFundTblEl = document.getElementById("bm-fund-table");
  const bmAlphaEl = document.getElementById("bm-alpha-summary");
  if (!bmKpisEl) return;

  const k = DATA.kpis;
  const nMF = DATA.funds.length;
  bmFilterEl.innerHTML =
    '<span class="ctrl-label">Chart period:</span>' +
    ["3y", "5y", "7y", "10y"]
      .map(
        (p) =>
          `<button class="chip ${bmPeriod === p ? "on" : ""}" onclick="setBMPeriod('${p}')">${p}</button>`,
      )
      .join("") +
    '<span style="font-size:10px;color:var(--muted2);margin-left:10px">Fund comparison uses each fund\'s actual holding period</span>';

  const fundAnalysis =
    _fundAnalysisCache || (_fundAnalysisCache = buildFundAnalysis());

  const yourMFCagr =
    nMF > 0
      ? parseFloat(
          DATA.funds
            .reduce(
              (a, f) => a + f.CAGR * (f.Invested / (k.mfInvested || 1)),
              0,
            )
            .toFixed(1),
        )
      : 0;
  const yourStCagr =
    DATA.stocks.length > 0
      ? parseFloat(
          DATA.stocks
            .filter((s) => s.Invested > 0)
            .reduce(
              (a, s) => a + s.CAGR * (s.Invested / (k.stInvested || 1)),
              0,
            )
            .toFixed(1),
        )
      : 0;
  const yourCombinedCagr =
    k.totalInvested > 0
      ? parseFloat(
          (
            yourMFCagr * (k.mfInvested / k.totalInvested) +
            yourStCagr * (k.stInvested / k.totalInvested)
          ).toFixed(1),
        )
      : 0;
  const portfolioBMCagr = calculatePortfolioBenchmark();
  const periodYrs = parseInt(bmPeriod),
    periodDays = periodYrs * 365;
  const nifty50Ref = calculateBenchmarkCAGR("Nifty 50", periodDays);
  const inflRef = calculateBenchmarkCAGR("Inflation (CPI)", periodDays);
  const fdRef = calculateBenchmarkCAGR("FD (SBI)", periodDays);
  const ppfRef = calculateBenchmarkCAGR("PPF", periodDays);
  const portAlpha =
    portfolioBMCagr !== null
      ? calculateAlpha(yourMFCagr, portfolioBMCagr)
      : null;

  _renderBMKpis(bmKpisEl, {
    nMF,
    yourMFCagr,
    yourStCagr,
    yourCombinedCagr,
    portfolioBMCagr,
    portAlpha,
    nifty50Ref,
    inflRef,
    fdRef,
    ppfRef,
  });
  _renderBMChart({
    nMF,
    yourMFCagr,
    yourStCagr,
    yourCombinedCagr,
    nifty50Ref,
    periodDays,
    k,
  });
  _renderBMFundTable(bmFundTblEl, fundAnalysis);
  _renderBMAlphaSummary(bmAlphaEl, fundAnalysis, {
    nMF,
    yourMFCagr,
    portfolioBMCagr,
    portAlpha,
  });
}

function _renderBMKpis(
  el,
  {
    nMF,
    yourMFCagr,
    yourStCagr,
    yourCombinedCagr,
    portfolioBMCagr,
    portAlpha,
    nifty50Ref,
    inflRef,
    fdRef,
    ppfRef,
  },
) {
  const portAlphaStr =
    portAlpha !== null
      ? (portAlpha >= 0 ? "+" : "") + portAlpha.toFixed(1) + "%"
      : "—";
  const portAlphaNote =
    portAlpha !== null
      ? portAlpha > 0
        ? "vs time-aligned benchmark"
        : "benchmark outperforming you"
      : "Upload files";
  const portAlphaColor =
    portAlpha === null
      ? "var(--muted)"
      : portAlpha >= 3
        ? "var(--green)"
        : portAlpha >= 0
          ? "var(--amber)"
          : "var(--red)";
  const tiles = [
    {
      l: "Your MF CAGR",
      v: nMF ? fmtP(yourMFCagr) : "—",
      note: "Invested-weighted avg",
      accent: nMF
        ? yourMFCagr >= nifty50Ref
          ? "var(--green)"
          : "var(--red)"
        : "var(--muted)",
    },
    {
      l: "Portfolio Benchmark",
      v: portfolioBMCagr !== null ? fmtP(portfolioBMCagr) : "—",
      note: "Time-aligned category avg",
      accent: "var(--blue)",
    },
    {
      l: "Portfolio Alpha",
      v: portAlphaStr,
      note: portAlphaNote,
      accent: portAlphaColor,
    },
    {
      l: "Beats Inflation?",
      v: nMF ? (yourMFCagr > inflRef ? "✓ Yes" : "✗ No") : "—",
      note: `CPI ${fmtP(inflRef)}`,
      accent: nMF && yourMFCagr > inflRef ? "var(--green)" : "var(--red)",
    },
    {
      l: "Beats FD?",
      v: nMF ? (yourMFCagr > fdRef ? "✓ Yes" : "✗ No") : "—",
      note: `SBI FD ${fmtP(fdRef)}`,
      accent: nMF && yourMFCagr > fdRef ? "var(--green)" : "var(--amber)",
    },
    {
      l: "Beats PPF?",
      v: nMF ? (yourMFCagr > ppfRef ? "✓ Yes" : "✗ No") : "—",
      note: `PPF ${fmtP(ppfRef)}`,
      accent: nMF && yourMFCagr > ppfRef ? "var(--green)" : "var(--amber)",
    },
  ];
  el.innerHTML = tiles
    .map(
      (c) =>
        `<div class="bm-kpi" style="--bm-accent:${c.accent}"><div class="bm-kpi-label">${c.l}</div><div class="bm-kpi-val" style="color:${c.accent}">${c.v}</div><div class="bm-kpi-note">${c.note}</div></div>`,
    )
    .join("");
}

function _renderBMChart({
  nMF,
  yourMFCagr,
  yourStCagr,
  yourCombinedCagr,
  nifty50Ref,
  periodDays,
  k,
}) {
  const labels = [],
    vals = [],
    bgColors = [],
    bdColors = [];
  const push = (label, val, bg, bd) => {
    labels.push(label);
    vals.push(val);
    bgColors.push(bg);
    bdColors.push(bd);
  };
  if (nMF)
    push(
      "Your MF CAGR",
      yourMFCagr,
      yourMFCagr >= nifty50Ref ? "rgba(63,185,80,.85)" : "rgba(248,81,73,.85)",
      yourMFCagr >= nifty50Ref ? "#3fb950" : "#f85149",
    );
  if (DATA.stocks.length && k.stInvested > 0)
    push(
      "Your Stocks CAGR",
      yourStCagr,
      yourStCagr >= nifty50Ref ? "rgba(63,185,80,.75)" : "rgba(248,81,73,.75)",
      yourStCagr >= nifty50Ref ? "#3fb950" : "#f85149",
    );
  if (nMF && DATA.stocks.length)
    push(
      "Your Combined",
      yourCombinedCagr,
      yourCombinedCagr >= nifty50Ref
        ? "rgba(212,168,67,.90)"
        : "rgba(248,81,73,.70)",
      yourCombinedCagr >= nifty50Ref ? "#d4a843" : "#f85149",
    );
  BM_CHART_ORDER.forEach((bmKey) => {
    const val = calculateBenchmarkCAGR(bmKey, periodDays);
    if (val === null) return;
    const [bg, bd] = BM_CHART_COLORS[bmKey] || [
      "rgba(125,133,144,.5)",
      "#7d8590",
    ];
    push(bmKey, val, bg, bd);
  });

  scheduleChart("chart-benchmark", 60, (el) => {
    return new Chart(el, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "CAGR %",
            data: vals,
            backgroundColor: bgColors,
            borderColor: bdColors,
            borderWidth: 1.5,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const isYours = ctx.label.startsWith("Your");
                const bmLine = isYours
                  ? ""
                  : ` (your MF ${yourMFCagr - ctx.raw >= 0 ? "+" : ""}${(yourMFCagr - ctx.raw).toFixed(1)}%)`;
                return ` ${ctx.raw.toFixed(1)}% CAGR${isYours ? "" : bmLine}`;
              },
            },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              callback: (v) => v + "%",
            },
            grid: { color: "#21262d" },
            min: 0,
          },
          y: {
            ticks: { font: { size: 10 }, color: "#7d8590" },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}

function _renderBMFundTable(el, fundAnalysis) {
  if (!fundAnalysis.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:8px">Upload MF file to see per-fund comparison</div>';
    return;
  }
  const sorted = [...fundAnalysis].sort((a, b) => b.alpha - a.alpha);
  const maxAlpha = Math.max(...sorted.map((f) => Math.abs(f.alpha)), 1);
  const TH =
    "text-align:left;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:7px 8px;border-bottom:1px solid var(--border);";
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;min-width:620px">
    <thead><tr>
      <th style="${TH}">Fund</th><th style="${TH}text-align:center">Category</th><th style="${TH}text-align:right">Your CAGR</th>
      <th style="${TH}text-align:right">Benchmark</th><th style="${TH}text-align:center;min-width:60px">Index used</th>
      <th style="${TH}text-align:left;min-width:120px">Alpha</th><th style="${TH}text-align:center">Holding</th><th style="${TH}text-align:center">Decision</th>
    </tr></thead>
    <tbody>
    ${sorted
      .map((f) => {
        const ap = Math.min(100, (Math.abs(f.alpha) / maxAlpha) * 100);
        const ac =
          f.alpha >= 2
            ? "var(--green)"
            : f.alpha >= -2
              ? "var(--amber)"
              : "var(--red)";
        const d = f.decision;
        return `<tr style="border-bottom:1px solid var(--border)" title="${d.reason}">
        <td style="padding:8px;font-size:11px;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</td>
        <td style="padding:8px;text-align:center"><span class="pill" style="background:${CAT_CLR[f.Category] || "#444"}22;color:${CAT_CLR[f.Category] || "#888"};border:1px solid ${CAT_CLR[f.Category] || "#444"}44">${esc(f.Category)}</span></td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:600;color:${f.CAGR >= f.bmCagr ? "var(--green)" : "var(--red)"}">${fmtP(f.CAGR)}</td>
        <td style="padding:8px;text-align:right;font-size:11px;color:var(--muted)">${fmtP(f.bmCagr)}</td>
        <td style="padding:8px;text-align:center;font-size:9px;color:var(--muted2)">${f.bmKey}</td>
        <td style="padding:8px"><div style="display:flex;align-items:center;gap:6px"><div class="alpha-bar-wrap" style="min-width:60px"><div class="alpha-bar" style="width:${ap}%;background:${ac}"></div></div><span style="font-size:11px;font-weight:700;color:${ac};min-width:44px">${f.alpha >= 0 ? "+" : ""}${f.alpha.toFixed(1)}%</span></div></td>
        <td style="padding:8px;text-align:center;font-size:10px;color:var(--muted)">${fmtHoldPeriod(f.holdDays)}</td>
        <td style="padding:8px;text-align:center"><span class="rec-tag ${d.cls}" title="${d.reason}">${d.action}</span></td>
      </tr>`;
      })
      .join("")}
    </tbody></table>`;
}

function _renderBMAlphaSummary(
  el,
  fundAnalysis,
  { nMF, yourMFCagr, portfolioBMCagr, portAlpha },
) {
  if (!nMF) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:11px">Upload files to see alpha summary</div>';
    return;
  }
  const alphas = fundAnalysis.map((f) => f.alpha);
  const avgAlpha = parseFloat(
    (alphas.reduce((a, v) => a + v, 0) / alphas.length).toFixed(1),
  );
  const beaters = fundAnalysis.filter((f) => f.alpha > 2).length;
  const trailers = fundAnalysis.filter((f) => f.alpha < -2).length;
  const inline = fundAnalysis.filter((f) => Math.abs(f.alpha) <= 2).length;
  const bestFund = [...fundAnalysis].sort((a, b) => b.alpha - a.alpha)[0];
  const worstFund = [...fundAnalysis].sort((a, b) => a.alpha - b.alpha)[0];
  const pa = portAlpha ?? 0;
  const verdictColor =
    pa >= 2 ? "var(--green)" : pa >= -2 ? "var(--amber)" : "var(--red)";
  const verdictText =
    pa >= 2
      ? `Your MF portfolio generates +${pa.toFixed(1)}% alpha over its time-aligned benchmark — active selection is paying off.`
      : pa >= -2
        ? `Your MF portfolio is broadly in line with its benchmark (${pa >= 0 ? "+" : ""}${pa.toFixed(1)}%). Consider adding low-cost index funds.`
        : `Your MF portfolio trails its benchmark by ${Math.abs(pa).toFixed(1)}%. A passive Nifty 500 index fund would have delivered better risk-adjusted returns.`;
  const actionItems = [...fundAnalysis]
    .filter((f) => f.decision.action !== "HOLD")
    .sort((a, b) => {
      const o = { EXIT: 0, REDUCE: 1, ADD: 2, HOLD: 3 };
      return o[a.decision.action] - o[b.decision.action];
    });
  el.innerHTML = `<div class="alpha-box">
    <div style="font-size:12px;color:${verdictColor};font-weight:500;margin-bottom:14px;line-height:1.6">${verdictText}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px">
      ${[
        { l: "Total funds", v: nMF, c: "var(--text)" },
        {
          l: "Avg alpha",
          v: (avgAlpha >= 0 ? "+" : "") + avgAlpha + "%",
          c: avgAlpha >= 0 ? "var(--green)" : "var(--red)",
        },
        { l: "▲ Beating (+>2%)", v: beaters, c: "var(--green)" },
        { l: "≈ In line (±2%)", v: inline, c: "var(--amber)" },
        { l: "▼ Trailing (<−2%)", v: trailers, c: "var(--red)" },
      ]
        .map(
          (x) =>
            `<div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:8px 10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">${x.l}</div><div style="font-family:var(--sans);font-size:16px;font-weight:700;color:${x.c}">${x.v}</div></div>`,
        )
        .join("")}
    </div>
    <div class="alpha-row"><span class="alpha-name">Best alpha fund</span><span style="color:var(--gold);font-size:11px;flex:1">${bestFund.name.split(" ").slice(0, 3).join(" ")}</span><span style="font-size:11px;font-weight:700;color:var(--green);min-width:50px;text-align:right">${bestFund.alpha >= 0 ? "+" : ""}${bestFund.alpha.toFixed(1)}% vs ${bestFund.bmKey}</span></div>
    <div class="alpha-row"><span class="alpha-name">Worst alpha fund</span><span style="color:var(--red);font-size:11px;flex:1">${worstFund.name.split(" ").slice(0, 3).join(" ")}</span><span style="font-size:11px;font-weight:700;color:var(--red);min-width:50px;text-align:right">${worstFund.alpha >= 0 ? "+" : ""}${worstFund.alpha.toFixed(1)}% vs ${worstFund.bmKey}</span></div>
    ${actionItems.length ? `<div style="margin-top:14px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Decision feed — actionable funds</div>${actionItems.map((f) => `<div class="alpha-row"><span class="alpha-name">${f.name.split(" ").slice(0, 3).join(" ")}</span><span class="rec-tag ${f.decision.cls}" style="flex-shrink:0">${f.decision.action}</span><span style="font-size:10px;color:var(--muted);flex:1;margin-left:8px;line-height:1.4">${f.decision.reason}</span></div>`).join("")}` : '<div style="margin-top:10px;font-size:11px;color:var(--green)">✓ All funds on HOLD — no immediate action needed</div>'}
    <div style="font-size:10px;color:var(--muted2);margin-top:12px;line-height:1.6">Each fund is compared against its category-specific benchmark, time-aligned to the fund's actual holding period.</div>
  </div>`;
}
