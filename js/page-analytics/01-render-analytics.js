// ── 01-render-analytics.js ──
// Main analytics orchestrator: monthly investment bar chart, sector P&L,
// portfolio ratios (win rates, MF share, speculative exposure, avg CAGR,
// best MF, worst stock), XIRR display, and sub-renderer calls.
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
  
  renderPortfolioAlpha();
}
