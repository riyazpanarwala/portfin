// ── Rebalancing Advisor ───────────────────────────────────────
function renderRebalance() {
  syncRebSliders(null);
}

function syncRebSliders(changed) {
  const mfEl = document.getElementById("reb-mf");
  const lcEl = document.getElementById("reb-lc");
  const etfEl = document.getElementById("reb-etf");
  if (!mfEl) return;

  let mf = parseInt(mfEl.value),
    lc = parseInt(lcEl.value),
    etf = parseInt(etfEl.value);
  const total = mf + lc + etf;
  if (total > 100) {
    const excess = total - 100;
    if (changed === "mf") {
      lc = Math.max(0, lc - Math.ceil(excess / 2));
      etf = Math.max(0, etf - Math.floor(excess / 2));
    }
    if (changed === "lc") {
      mf = Math.max(0, mf - Math.ceil(excess / 2));
      etf = Math.max(0, etf - Math.floor(excess / 2));
    }
    if (changed === "etf") {
      mf = Math.max(0, mf - Math.ceil(excess / 2));
      lc = Math.max(0, lc - Math.floor(excess / 2));
    }
    mfEl.value = mf;
    lcEl.value = lc;
    etfEl.value = etf;
  }

  const t = mf + lc + etf;
  const mfValEl = document.getElementById("reb-mf-val");
  const lcValEl = document.getElementById("reb-lc-val");
  const etfValEl = document.getElementById("reb-etf-val");
  const totalEl = document.getElementById("reb-total-pct");
  const fillEl = document.getElementById("reb-total-fill");
  if (mfValEl) mfValEl.textContent = mf + "%";
  if (lcValEl) lcValEl.textContent = lc + "%";
  if (etfValEl) etfValEl.textContent = etf + "%";
  if (totalEl) {
    totalEl.textContent = t + "%";
    totalEl.style.color =
      t === 100 ? "var(--green)" : t > 100 ? "var(--red)" : "var(--amber)";
  }
  if (fillEl) {
    fillEl.style.width = Math.min(100, t) + "%";
    fillEl.style.background =
      t === 100 ? "var(--green)" : t > 100 ? "var(--red)" : "var(--amber)";
  }
  computeRebalance(mf, lc, etf);
}

function computeRebalance(targetMFPct, targetLCPct, targetETFPct) {
  const k = DATA.kpis,
    totalValue = k.totalValue || 0;
  const cmpEl = document.getElementById("reb-comparison");
  const actEl = document.getElementById("reb-actions");
  const kpiEl = document.getElementById("reb-kpi-strip");
  if (!cmpEl || !actEl) return;

  if (!totalValue) {
    cmpEl.innerHTML =
      '<div style="color:var(--muted);font-size:12px">Upload files to see rebalancing recommendations.</div>';
    actEl.innerHTML = "";
    if (kpiEl) kpiEl.innerHTML = "";
    return;
  }

  const curMFVal = k.mfValue || 0;
  const etfStocks = DATA.stocks.filter(
    (s) => s.Sector === "Index ETF" || s.Sector === "Commodities ETF",
  );
  const curETFVal = etfStocks.reduce((a, s) => a + s.Current, 0);
  const curLCVal = DATA.stocks
    .filter((s) => !etfStocks.includes(s))
    .reduce((a, s) => a + s.Current, 0);

  const curMFPct = Math.round((curMFVal / totalValue) * 100);
  const curLCPct = Math.round((curLCVal / totalValue) * 100);
  const curETFPct = Math.round((curETFVal / totalValue) * 100);

  const tgtMFVal = Math.round((totalValue * targetMFPct) / 100);
  const tgtLCVal = Math.round((totalValue * targetLCPct) / 100);
  const tgtETFVal = Math.round((totalValue * targetETFPct) / 100);

  const diffMF = tgtMFVal - curMFVal;
  const diffLC = tgtLCVal - curLCVal;
  const diffETF = tgtETFVal - curETFVal;
  const drift = Math.max(
    Math.abs(targetMFPct - curMFPct),
    Math.abs(targetLCPct - curLCPct),
    Math.abs(targetETFPct - curETFPct),
  );
  const needsAction = drift >= 5;

  if (kpiEl)
    kpiEl.innerHTML = renderKpiCards([
      {
        l: "Total Portfolio",
        v: fmtL(totalValue),
        s: "Current value",
        a: "#d4a843",
      },
      {
        l: "MF Drift",
        v:
          (targetMFPct - curMFPct >= 0 ? "+" : "") +
          (targetMFPct - curMFPct) +
          "pp",
        s: `Current ${curMFPct}% → Target ${targetMFPct}%`,
        a: Math.abs(targetMFPct - curMFPct) >= 5 ? "#f85149" : "#3fb950",
      },
      {
        l: "Max Drift",
        v: drift + "pp",
        s: drift >= 5 ? "Action needed" : "Within tolerance",
        a: drift >= 5 ? "#f85149" : "#3fb950",
      },
      {
        l: "Status",
        v: needsAction ? "Rebalance" : "On target",
        s: needsAction ? "Drift ≥5% detected" : "All within ±5%",
        a: needsAction ? "#e3b341" : "#3fb950",
      },
    ]);

  const classes = [
    {
      name: "Mutual Funds",
      cur: curMFVal,
      curPct: curMFPct,
      tgt: tgtMFVal,
      tgtPct: targetMFPct,
      diff: diffMF,
      color: "var(--gold)",
    },
    {
      name: "Large-cap Stocks",
      cur: curLCVal,
      curPct: curLCPct,
      tgt: tgtLCVal,
      tgtPct: targetLCPct,
      diff: diffLC,
      color: "var(--blue)",
    },
    {
      name: "ETF / Index",
      cur: curETFVal,
      curPct: curETFPct,
      tgt: tgtETFVal,
      tgtPct: targetETFPct,
      diff: diffETF,
      color: "var(--green)",
    },
  ];

  cmpEl.innerHTML = classes
    .map((c) => {
      const d = c.tgtPct - c.curPct;
      return `<div class="reb-asset-row">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(c.name)}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;color:var(--muted)">Current</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px"><div style="height:100%;background:${c.color};opacity:.5;border-radius:4px;width:${c.curPct}%"></div></div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right">${c.curPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.cur)}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:10px;color:var(--muted)">Target&nbsp;</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px"><div style="height:100%;background:${c.color};border-radius:4px;width:${c.tgtPct}%"></div></div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right;color:${c.color}">${c.tgtPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.tgt)}</span>
        </div>
      </div>
      <div style="text-align:right;min-width:60px;margin-left:10px">
        <div style="font-size:13px;font-weight:700;color:${d >= 0 ? "var(--green)" : "var(--red)"}">${d >= 0 ? "+" : ""}${d}pp</div>
        <div style="font-size:10px;color:${c.diff >= 0 ? "var(--green)" : "var(--red)"}">${c.diff >= 0 ? "+" : ""}${fmtL(Math.round(Math.abs(c.diff)))}</div>
      </div>
    </div>`;
    })
    .join("");

  const totalPct = targetMFPct + targetLCPct + targetETFPct;
  if (totalPct !== 100) {
    actEl.innerHTML = `<div style="color:var(--amber);font-size:12px">⚠ Total target allocation is ${totalPct}% — adjust sliders to sum to 100%.</div>`;
    return;
  }

  const sells = classes
    .filter((c) => c.diff < -1000)
    .sort((a, b) => a.diff - b.diff);
  const buys = classes
    .filter((c) => c.diff > 1000)
    .sort((a, b) => b.diff - a.diff);
  const holds = classes.filter((c) => Math.abs(c.diff) <= 1000);

  if (!sells.length && !buys.length) {
    actEl.innerHTML =
      '<div style="color:var(--green);font-size:12px;padding:10px">✓ Portfolio is already within tolerance. No action needed.</div>';
    return;
  }

  const rows = [
    ...sells.map(
      (c) =>
        `<div class="reb-action-row"><span style="font-size:16px">🔴</span><span class="reb-sell">SELL</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--red);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.abs(Math.round(c.diff)))}</span><span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span></div>`,
    ),
    ...buys.map(
      (c) =>
        `<div class="reb-action-row"><span style="font-size:16px">🟢</span><span class="reb-buy">BUY&nbsp;</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--green);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.round(c.diff))}</span><span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span></div>`,
    ),
    ...holds.map(
      (c) =>
        `<div class="reb-action-row"><span style="font-size:16px">⚪</span><span class="reb-hold">HOLD</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--muted);font-family:var(--sans);font-size:14px">${fmtL(c.cur)}</span><span style="color:var(--green);font-size:10px;min-width:90px;text-align:right">Within ±${fmtL(Math.abs(Math.round(c.diff)))}</span></div>`,
    ),
  ];

  actEl.innerHTML = `<div class="reb-action-box">${rows.join("")}</div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⚠ Indicative amounts only. Factor in STCG/LTCG tax before executing sell orders. Prefer new SIP deployment into underweight buckets first.
    </div>`;
}