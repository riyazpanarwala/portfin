// ── 02-holding-period-chart.js ──
// Holding period distribution chart: builds lot data from DATA.funds/stocks.rawLots,
// creates time buckets (0-3mo, 3-6mo, etc.), renders LTCG/STCG KPIs,
// stacked bar chart with Chart.js, and detail rows with tax tags.
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
