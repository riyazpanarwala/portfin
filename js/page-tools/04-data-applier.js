// ── Apply parsed data to DATA + refresh all ───────────────────
async function tryApplyData() {
  DATA._cachedMonthly = null;
  DATA._cachedDrawdownSeries = null; // FIX Issue #3: invalidate drawdown cache on upload
  _fundAnalysisCache = null;
  const hasMF = pendingMF !== null,
    hasST = pendingST !== null;
  const msgEl = document.getElementById("apply-msg");

  const _preUploadSnap = hasMF && hasST ? capturePreUploadSnapshot() : null;

  if (hasMF && hasST) {
    const { funds } = pendingMF,
      { stocks } = pendingST;

    const catMap = {};
    funds.forEach((f) => {
      if (!catMap[f.Category])
        catMap[f.Category] = {
          Category: f.Category,
          Invested: 0,
          Current: 0,
          Gain: 0,
        };
      catMap[f.Category].Invested += f.Invested;
      catMap[f.Category].Current += f.Current;
      catMap[f.Category].Gain += f.Gain;
    });
    const mfCategories = Object.values(catMap).map((c) => ({
      ...c,
      RetPct:
        c.Invested > 0
          ? parseFloat(((c.Gain / c.Invested) * 100).toFixed(1))
          : 0,
    }));

    const secMap = {};
    stocks.forEach((s) => {
      if (!secMap[s.Sector])
        secMap[s.Sector] = {
          Sector: s.Sector,
          Invested: 0,
          Current: 0,
          Gain: 0,
        };
      secMap[s.Sector].Invested += s.Invested;
      secMap[s.Sector].Current += s.Current;
      secMap[s.Sector].Gain += s.Gain;
    });
    const sectors = Object.values(secMap).map((s) => ({
      ...s,
      RetPct:
        s.Invested > 0
          ? parseFloat(((s.Gain / s.Invested) * 100).toFixed(1))
          : 0,
    }));

    const mfInvested = funds.reduce((a, f) => a + f.Invested, 0);
    const mfValue = funds.reduce((a, f) => a + f.Current, 0);
    const mfGain = funds.reduce((a, f) => a + f.Gain, 0);
    const stInvested = stocks.reduce((a, s) => a + s.Invested, 0);
    const stValue = stocks.reduce((a, s) => a + s.Current, 0);
    const stGain = stocks.reduce((a, s) => a + s.Gain, 0);
    const totalInvested = mfInvested + stInvested;
    const totalValue = mfValue + stValue;
    const totalGain = mfGain + stGain;
    const mfReturn =
      mfInvested > 0 ? parseFloat(((mfGain / mfInvested) * 100).toFixed(1)) : 0;
    const stReturn =
      stInvested > 0 ? parseFloat(((stGain / stInvested) * 100).toFixed(1)) : 0;
    const totalReturn =
      totalInvested > 0
        ? parseFloat(((totalGain / totalInvested) * 100).toFixed(1))
        : 0;
    const mfCAGR =
      mfInvested > 0
        ? parseFloat(
            funds
              .reduce((a, f) => a + f.CAGR * (f.Invested / mfInvested), 0)
              .toFixed(1),
          )
        : 0;

    // FIX Issue #9: latestDate from actual lot dates, not new Date()
    const allLotDates = [
      ...(pendingMF.lots || []).map((l) => l.date),
      ...(pendingST.lots || []).map((l) => l.date),
    ].filter(Boolean);
    const latestDate = allLotDates.length
      ? new Date(
          allLotDates.reduce(
            (max, d) => (d.getTime() > max ? d.getTime() : max),
            allLotDates[0].getTime(),
          ),
        )
      : new Date();

    DATA.kpis = {
      totalInvested,
      totalValue,
      totalGain,
      totalReturn,
      mfInvested,
      mfValue,
      mfGain,
      mfReturn,
      mfCAGR,
      stInvested,
      stValue,
      stGain,
      stReturn,
      earliestMF: pendingMF.earliestMF,
      earliestST: pendingST.earliestST,
      latestDate, // FIX Issue #9: actual latest lot date
    };
    DATA.funds = funds;
    DATA.mfCategories = mfCategories;
    DATA.stocks = stocks;
    DATA.sectors = sectors;
    DATA.monthlyMF = pendingMF.monthlyMF;
    DATA.mfLots = pendingMF.lots;
    DATA.stLots = pendingST.lots;
    DATA._cachedMonthly = null;
    DATA._cachedDrawdownSeries = null; // FIX Issue #3: clear again after DATA is set
    _fundAnalysisCache = null;

    await saveDataToStorage();
    await saveSnapshot();

    document.getElementById("persist-banner")?.remove();
    buildTicker();
    buildStrip();
    updateChrome();
    renderSIPReminder();

    if (msgEl) {
      msgEl.style.cssText =
        "background:var(--green-bg);border:1px solid var(--green-dim);color:var(--green);display:block";
      msgEl.textContent =
        "✓ Dashboard fully updated and saved! Navigate to any tab to explore your live portfolio.";
    }
    pendingMF = null;
    pendingST = null;
    mfFil = "All";
    stFil = "All";
    renderUploadDiff(_preUploadSnap);
  } else {
    if (msgEl) {
      const missing =
        !hasMF && !hasST
          ? "Upload both MF and Stocks files to update the dashboard."
          : !hasMF
            ? "✓ Stocks loaded. Now upload the MF file to complete the update."
            : "✓ MF file loaded. Now upload the Stocks file to complete the update.";
      msgEl.style.cssText =
        "background:var(--amber-bg);border:1px solid #4a3500;color:var(--amber);display:block";
      msgEl.textContent = missing;
    }
  }
}