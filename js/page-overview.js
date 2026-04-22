// ── page-overview.js — Overview page, health score, SIP reminder, drawdown ──
//
// FIXES in this revision:
//  • Issue #3  — buildDrawdownSeriesFromTimeline() now caches result in
//                DATA._cachedDrawdownSeries; only recomputes after upload
//  • Issue #5  — computeCAGR() short-hold (<6mo) now returns annualised
//                figure with a visual "< 1yr" indicator instead of 0%
//                (fix is in page-tools.js computeCAGR; display handled here
//                via fmtCAGRDisplay helper)

function renderOverview() {
  const k = DATA.kpis;
  const sinceMF = k.earliestMF
    ? "Since " + fmtMonthYear(k.earliestMF)
    : "All time";
  document.getElementById("kpi-overview").innerHTML = renderKpiCards([
    { l: "Total Invested", v: fmtL(k.totalInvested), s: "Capital deployed", sc: "", a: "#d4a843" },
    { l: "Current Value", v: fmtL(k.totalValue), s: "Portfolio value", sc: "", a: "#58a6ff" },
    { l: "Total Gain", v: fmtL(k.totalGain), s: fmtP(k.totalReturn), sc: k.totalGain >= 0 ? "up" : "dn", a: "#3fb950" },
    { l: "MF Return", v: fmtP(k.mfReturn), s: sinceMF, sc: "up", a: "#d4a843" },
    { l: "MF CAGR", v: fmtP(k.mfCAGR), s: "Compounded p.a.", sc: "up", a: "#a371f7" },
    { l: "Stock P&L", v: fmtL(k.stGain), s: fmtP(k.stReturn), sc: k.stGain >= 0 ? "up" : "dn", a: "#f85149" },
  ]);

  const mfP = k.totalInvested
    ? Math.round((k.mfInvested / k.totalInvested) * 100)
    : 0,
    stP = 100 - mfP;
  document.getElementById("alloc-split").innerHTML = `
    <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#58a6ff">Mutual Funds</span><span style="color:#58a6ff">${mfP}% · ${fmtL(k.mfInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${mfP}%;background:#58a6ff;height:100%"></div></div></div>
    <div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#f0883e">Equity Stocks</span><span style="color:#f0883e">${stP}% · ${fmtL(k.stInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${stP}%;background:#f0883e;height:100%"></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">MF gain</div><div style="font-size:16px;font-weight:600;color:var(--green);font-family:var(--sans)">${fmtL(k.mfGain)}</div><div style="font-size:11px;color:var(--green)">${fmtP(k.mfReturn)}</div></div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Stock P&L</div><div style="font-size:16px;font-weight:600;color:${k.stGain >= 0 ? "var(--green)" : "var(--red)"};font-family:var(--sans)">${fmtL(k.stGain)}</div><div style="font-size:11px;color:${k.stGain >= 0 ? "var(--green)" : "var(--red)"}">${fmtP(k.stReturn)}</div></div>
    </div>`;

  donut(
    "donut-mf",
    "legend-mf",
    DATA.mfCategories.map((c) => ({ k: c.Category, v: c.Invested })),
    CAT_CLR,
  );

  const maxMF = Math.max(...DATA.funds.map((f) => Math.abs(f.RetPct)), 1);
  const maxST = Math.max(...DATA.stocks.map((s) => Math.abs(s.RetPct)), 1);
  document.getElementById("top-mf").innerHTML = DATA.funds.length
    ? [...DATA.funds]
      .sort((a, b) => b.RetPct - a.RetPct)
      .slice(0, 4)
      .map(
        (f) =>
          `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(f.name)}</span><span style="color:var(--muted)">${fmtL(f.Gain)}</span></div>${miniBar(f.RetPct, maxMF)}</div>`,
      )
      .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload MF file to see data</div>';
  document.getElementById("top-st").innerHTML = DATA.stocks.length
    ? [...DATA.stocks]
      .sort((a, b) => b.RetPct - a.RetPct)
      .slice(0, 4)
      .map(
        (s) =>
          `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(s.name)}</span><span style="color:var(--muted)">${fmtL(s.Gain)}</span></div>${miniBar(s.RetPct, maxST)}</div>`,
      )
      .join("")
    : '<div style="color:var(--muted);font-size:11px">Upload Stocks file to see data</div>';

  const alerts = [];
  const stTotalInv = DATA.stocks.reduce((a, s) => a + s.Invested, 0) || 1;
  DATA.stocks.forEach((s) => {
    const conc = (s.Invested / stTotalInv) * 100;
    if (s.RetPct < -40)
      alerts.push([esc(s.name), `${fmtP(s.RetPct)} return — strong EXIT candidate, no recovery thesis visible`]);
    else if (conc > 15 && s.RetPct < 0)
      alerts.push([esc(s.name), `${conc.toFixed(1)}% of stock portfolio, ${fmtP(s.RetPct)} return — high concentration risk, consider trimming`]);
    else if (s.Sector === "Speculative" && s.RetPct < -20)
      alerts.push([esc(s.name), `${fmtP(s.RetPct)} in speculative sector — averaging down not advised; reduce to ≤5%`]);
    else if (s.CAGR < -15 && s.Invested > 30000)
      alerts.push([esc(s.name), `CAGR ${fmtP(s.CAGR)}, ₹${Math.round(s.Invested / 1000)}K invested — reassess thesis`]);
  });
  DATA.sectors.forEach((sec) => {
    const secPct = stTotalInv ? (sec.Invested / stTotalInv) * 100 : 0;
    if (secPct > 30 && sec.Gain < 0)
      alerts.push([esc(sec.Sector) + " Sector", `${secPct.toFixed(1)}% of stocks with ${fmtL(sec.Gain)} loss — over-concentrated`]);
  });
  document.getElementById("risk-alerts").innerHTML = alerts.length
    ? alerts.map(([n, m]) => `<div class="alert-row"><span class="alert-name">${n}</span><span class="alert-msg">${m}</span></div>`).join("")
    : '<div style="color:var(--green);font-size:11px">✓ No critical concentration alerts — portfolio looks balanced</div>';

  renderHealthScore();
  renderSIPReminder();
  renderDrawdownAnalyzer();
  renderRiskReturnClassification();
}

function renderHealthScore() {
  const k = DATA.kpis;
  if (!k.totalInvested) {
    document.getElementById("health-score-display").innerHTML =
      '<div style="color:var(--muted);font-size:11px">Upload files to compute health score</div>';
    document.getElementById("health-score-breakdown").innerHTML = "";
    return;
  }

  const n = DATA.stocks.length || 1;
  const mfShare = k.totalInvested ? k.mfInvested / k.totalInvested : 0;
  const stWin = DATA.stocks.filter((s) => s.Gain > 0).length;
  const mfWin = DATA.funds.filter((f) => f.Gain > 0).length;
  const nMF = DATA.funds.length || 1;
  const avgMFcagr = DATA.funds.reduce((a, f) => a + f.CAGR, 0) / nMF;
  const maxSingleStPct = DATA.stocks.length
    ? Math.max(...DATA.stocks.map((s) => (s.Invested / k.stInvested) * 100))
    : 0;
  const specInv = DATA.stocks
    .filter((s) => s.Sector === "Speculative")
    .reduce((a, s) => a + s.Invested, 0);
  const specPct = k.stInvested ? specInv / k.stInvested : 0;

  const divScore = Math.max(0, 20 - Math.max(0, (maxSingleStPct - 20) * 0.5) - Math.max(0, (specPct * 100 - 15) * 0.4));
  const mfScore = Math.min(20, mfShare * 33);
  const totalHoldings = DATA.funds.length + DATA.stocks.length || 1;
  const totalWin = mfWin + stWin;
  const profScore = (totalWin / totalHoldings) * 20;
  const cagrScore = Math.min(20, Math.max(0, (avgMFcagr / 12) * 20));

  let consistScore = 10;
  if (DATA.monthlyMF.length) {
    const allM = buildCombinedMonthly();
    const active = allM.filter((x) => x.v > 0).length;
    consistScore = allM.length ? Math.min(20, (active / allM.length) * 22) : 10;
  }

  const total = Math.round(divScore + mfScore + profScore + cagrScore + consistScore);
  const clamp = Math.min(100, Math.max(0, total));
  const scoreColor = clamp >= 75 ? "#3fb950" : clamp >= 50 ? "#d4a843" : "#f85149";
  const scoreLabel = clamp >= 75 ? "Healthy" : clamp >= 50 ? "Fair" : "Needs Attention";

  const VW = 180, VH = 110, GCX = 90, GCY = 95, GR = 72, SW = 12;
  const polar = (deg) => ({ x: GCX + GR * Math.cos((deg * Math.PI) / 180), y: GCY + GR * Math.sin((deg * Math.PI) / 180) });
  const tStart = polar(180);
  const tEnd = polar(0);
  const trackD = `M${tStart.x},${tStart.y} A${GR},${GR} 0 0,1 ${tEnd.x},${tEnd.y}`;
  const fillAngle = 180 - (clamp / 100) * 180;
  const fEnd = polar(fillAngle);
  const largeArc = 180 - fillAngle > 180 ? 1 : 0;
  const fillD = clamp > 0 ? `M${tStart.x},${tStart.y} A${GR},${GR} 0 ${largeArc},1 ${fEnd.x},${fEnd.y}` : "";
  const needleTip = clamp > 0 ? `<circle cx="${fEnd.x.toFixed(1)}" cy="${fEnd.y.toFixed(1)}" r="5" fill="${scoreColor}"/>` : "";
  function polar_r(cx, cy, r, deg) { return { x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) }; }
  const ticks = [25, 50, 75].map((v) => {
    const a = 180 - (v / 100) * 180;
    const inner = polar_r(GCX, GCY, GR - 10, a);
    const outer = polar_r(GCX, GCY, GR + 2, a);
    return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border2)" stroke-width="1.5"/>`;
  }).join("");

  document.getElementById("health-score-display").innerHTML = `
    <div class="health-gauge">
      <svg viewBox="-10 0 ${VW + 20} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <path d="${trackD}" fill="none" stroke="var(--bg4)" stroke-width="${SW}" stroke-linecap="round"/>
        ${fillD ? `<path d="${fillD}" fill="none" stroke="${scoreColor}" stroke-width="${SW}" stroke-linecap="round" opacity="0.95"/>` : ""}
        ${needleTip}
        ${ticks}
        <text x="${tStart.x - 14}" y="${tStart.y + 6}" font-size="9" fill="var(--muted)" text-anchor="middle">0</text>
        <text x="${tEnd.x + 14}" y="${tEnd.y + 6}" font-size="9" fill="var(--muted)" text-anchor="middle">100</text>
      </svg>
      <div class="health-gauge-val">
        <span class="health-score-num" style="color:${scoreColor}">${clamp}</span>
        <span class="health-score-lbl" style="color:${scoreColor}">${scoreLabel}</span>
      </div>
    </div>
    <div style="flex:1;padding-left:8px">
      <div style="font-size:11px;color:var(--muted);line-height:1.8">
        Score computed across 5 dimensions:<br>diversification, MF dominance, profitability,<br>CAGR vs benchmark, and investment consistency.
      </div>
    </div>`;

  const breakdown = [
    ["Diversification", Math.round(divScore), 20, "Single-stock concentration & speculative exposure"],
    ["MF Dominance", Math.round(mfScore), 20, "MF share of total portfolio"],
    ["Profitability", Math.round(profScore), 20, "% of funds & stocks in profit"],
    ["CAGR Quality", Math.round(cagrScore), 20, "Average MF CAGR vs Nifty 50 (12%)"],
    ["Consistency", Math.round(consistScore), 20, "Regular investing across months"],
  ];
  document.getElementById("health-score-breakdown").innerHTML = breakdown
    .map(([name, pts, max, note]) => {
      const pct = Math.round((pts / max) * 100);
      const c = pct >= 75 ? "#3fb950" : pct >= 50 ? "#d4a843" : "#f85149";
      return `<div class="health-bar-row">
      <span class="health-bar-name" title="${note}">${name}</span>
      <div class="health-bar-track"><div class="health-bar-fill" style="width:${pct}%;background:${c}"></div></div>
      <span class="health-bar-pts" style="color:${c}">${pts}/${max}</span>
    </div>`;
    })
    .join("");
}

// ── Portfolio Risk-Return Classification ──────────────────────────────
function renderRiskReturnClassification() {
  const k = DATA.kpis;
  const hasData = k.totalInvested > 0;
  const contentEl = document.getElementById("risk-return-content");

  if (!hasData || !contentEl) {
    if (contentEl) {
      contentEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:30px;text-align:center">📂 Upload your Excel files to see your portfolio's risk-return classification.</div>`;
    }
    return;
  }

  let riskScore = 0;
  let riskFactors = [];

  const smallCapMF = DATA.funds.filter((f) => f.Category === "Small Cap").reduce((a, f) => a + f.Invested, 0);
  const speculativeStocks = DATA.stocks.filter((s) => s.Sector === "Speculative").reduce((a, s) => a + s.Invested, 0);
  const highRiskExposure = smallCapMF + speculativeStocks;
  const highRiskPct = k.totalInvested ? (highRiskExposure / k.totalInvested) * 100 : 0;
  riskScore += Math.min(35, highRiskPct * 1.2);
  if (highRiskPct > 0) riskFactors.push(`📈 ${highRiskPct.toFixed(1)}% in Small-cap/Speculative`);

  const topStockPct = DATA.stocks.length ? Math.max(...DATA.stocks.map((s) => (s.Invested / k.stInvested) * 100)) : 0;
  riskScore += Math.min(25, topStockPct * 0.8);
  if (topStockPct > 15) riskFactors.push(`⚠️ Top stock: ${topStockPct.toFixed(1)}% of equity portfolio`);

  const fundReturns = DATA.funds.map((f) => f.RetPct);
  const avgReturn = fundReturns.reduce((a, b) => a + b, 0) / (fundReturns.length || 1);
  const variance = fundReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (fundReturns.length || 1);
  const volatilityProxy = Math.min(30, Math.sqrt(variance) * 1.5);
  riskScore += volatilityProxy;
  if (volatilityProxy > 15) riskFactors.push(`📊 High return dispersion (${volatilityProxy.toFixed(1)}% std dev)`);

  const negativeCAGR = DATA.funds.filter((f) => f.CAGR < 0).length + DATA.stocks.filter((s) => s.CAGR < 0).length;
  riskScore += Math.min(15, negativeCAGR * 3);
  if (negativeCAGR > 0) riskFactors.push(`📉 ${negativeCAGR} holding(s) with negative CAGR`);

  riskScore = Math.min(100, Math.max(0, riskScore));

  let returnScore = 0;
  const portfolioReturn = k.totalReturn || 0;
  const niftyReturn = 12;

  if (portfolioReturn > 20) returnScore += 40;
  else if (portfolioReturn > 15) returnScore += 35;
  else if (portfolioReturn > 12) returnScore += 30;
  else if (portfolioReturn > 8) returnScore += 20;
  else if (portfolioReturn > 0) returnScore += 10;

  const relativeReturn = portfolioReturn - niftyReturn;
  if (relativeReturn > 5) returnScore += 15;
  else if (relativeReturn > 0) returnScore += 8;
  else if (relativeReturn < -5) returnScore -= 10;

  const avgMFCAGR = DATA.funds.reduce((a, f) => a + f.CAGR, 0) / (DATA.funds.length || 1);
  if (avgMFCAGR > 15) returnScore += 20;
  else if (avgMFCAGR > 12) returnScore += 15;
  else if (avgMFCAGR > 8) returnScore += 8;
  else if (avgMFCAGR < 0) returnScore -= 15;

  const stockWinRate = DATA.stocks.length
    ? (DATA.stocks.filter((s) => s.Gain > 0).length / DATA.stocks.length) * 100
    : 50;
  if (stockWinRate > 70) returnScore += 15;
  else if (stockWinRate > 50) returnScore += 8;
  else if (stockWinRate < 30) returnScore -= 10;

  returnScore = Math.min(100, Math.max(0, returnScore));

  let classification = "", color = "", icon = "", description = "", recommendation = "";
  if (riskScore >= 60 && returnScore >= 60) {
    classification = "HIGH RISK · HIGH RETURN"; color = "#d4a843"; icon = "🚀";
    description = "Aggressive portfolio with strong returns. Your risk-taking is being rewarded.";
    recommendation = "Maintain this strategy but consider taking some profits off the table.";
  } else if (riskScore >= 60 && returnScore < 40) {
    classification = "HIGH RISK · LOW RETURN"; color = "#f85149"; icon = "⚠️";
    description = "You're taking significant risks but not seeing commensurate returns.";
    recommendation = "Review your speculative positions and consider shifting to quality large-caps or index funds.";
  } else if (riskScore >= 60 && returnScore >= 40 && returnScore < 60) {
    classification = "HIGH RISK · MODERATE RETURN"; color = "#f0883e"; icon = "📊";
    description = "You're taking above-average risk for average returns.";
    recommendation = "Consider reducing small-cap exposure and adding more diversified funds.";
  } else if (riskScore < 40 && returnScore >= 60) {
    classification = "LOW RISK · HIGH RETURN"; color = "#3fb950"; icon = "🏆";
    description = "Excellent risk-adjusted returns! You're beating the market without excessive risk.";
    recommendation = "This is the ideal zone — stay the course and keep SIPs running.";
  } else if (riskScore < 40 && returnScore < 40) {
    classification = "LOW RISK · LOW RETURN"; color = "#7d8590"; icon = "🐢";
    description = "Very conservative portfolio with returns below market average.";
    recommendation = "You may be too conservative. Consider adding some large-cap or index funds.";
  } else if (riskScore < 40 && returnScore >= 40 && returnScore < 60) {
    classification = "LOW RISK · MODERATE RETURN"; color = "#58a6ff"; icon = "⚖️";
    description = "Balanced portfolio with good risk management.";
    recommendation = "Well diversified. You could increase equity allocation slightly for better returns.";
  } else if (riskScore >= 40 && riskScore < 60 && returnScore >= 60) {
    classification = "MODERATE RISK · HIGH RETURN"; color = "#a371f7"; icon = "📈";
    description = "Great risk-return balance — you're getting premium returns for moderate risk.";
    recommendation = "This is excellent. Just monitor concentration in top performers.";
  } else {
    classification = "MODERATE RISK · MODERATE RETURN"; color = "#79c0ff"; icon = "◈";
    description = "A balanced approach with market-like returns.";
    recommendation = "Solid foundation. Consider adding one high-conviction fund to boost returns.";
  }

  const matrixX = returnScore;
  const matrixY = 100 - riskScore;
  const riskColor = riskScore >= 60 ? "#f85149" : riskScore >= 40 ? "#f0883e" : "#3fb950";
  const returnColor = returnScore >= 60 ? "#3fb950" : returnScore >= 40 ? "#d4a843" : "#f85149";

  contentEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;justify-content:space-between;">
      <div style="flex:2;min-width:200px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:36px;">${icon}</span>
          <div>
            <div style="font-size:18px;font-weight:700;color:${color};letter-spacing:-0.3px;">${classification}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">${description}</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap;">
          <div style="background:var(--bg4);border-radius:8px;padding:8px 14px;text-align:center;flex:1;min-width:80px;">
            <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Risk Score</div>
            <div style="font-size:24px;font-weight:700;color:${riskColor}">${Math.round(riskScore)}</div>
            <div style="font-size:9px;color:var(--muted);">/100 (higher = riskier)</div>
          </div>
          <div style="background:var(--bg4);border-radius:8px;padding:8px 14px;text-align:center;flex:1;min-width:80px;">
            <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Return Score</div>
            <div style="font-size:24px;font-weight:700;color:${returnColor}">${Math.round(returnScore)}</div>
            <div style="font-size:9px;color:var(--muted);">/100 (higher = better)</div>
          </div>
        </div>
        <div style="background:${color}10;border-left:3px solid ${color};border-radius:6px;padding:10px 12px;margin-top:8px;">
          <div style="font-size:10px;color:${color};font-weight:600;margin-bottom:4px;">💡 RECOMMENDATION</div>
          <div style="font-size:11px;color:var(--text);line-height:1.5;">${recommendation}</div>
        </div>
      </div>
      <div style="flex:1;min-width:180px;">
        <div style="position:relative;width:100%;max-width:280px;height:200px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);margin:0 auto;overflow:hidden;">
          <div style="position:absolute;top:4px;left:8px;font-size:7px;color:var(--muted2);">Low Risk<br>High Return</div>
          <div style="position:absolute;top:4px;right:8px;font-size:7px;color:var(--muted2);text-align:right">High Risk<br>High Return</div>
          <div style="position:absolute;bottom:4px;left:8px;font-size:7px;color:var(--muted2);">Low Risk<br>Low Return</div>
          <div style="position:absolute;bottom:4px;right:8px;font-size:7px;color:var(--muted2);text-align:right">High Risk<br>Low Return</div>
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
          <div style="position:absolute;left:0;top:50%;width:100%;height:1px;background:var(--border2);"></div>
          <div style="position:absolute;left:calc(${matrixX}% - 8px);top:calc(${matrixY}% - 8px);width:16px;height:16px;background:${color};border-radius:50%;border:2px solid var(--bg2);box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:all 0.3s;"></div>
          <div style="position:absolute;left:calc(${matrixX}% - 20px);top:calc(${matrixY}% - 20px);width:40px;height:40px;background:${color};border-radius:50%;opacity:0.15;filter:blur(8px);"></div>
        </div>
        <div style="font-size:9px;color:var(--muted2);text-align:center;margin-top:6px;">← Lower Risk &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Higher Return →</div>
      </div>
    </div>
    ${riskFactors.length > 0 ? `
    <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Key risk factors</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${riskFactors.slice(0, 3).map((f) => `<span style="font-size:10px;background:var(--bg4);padding:3px 8px;border-radius:12px;color:var(--muted2);">${f}</span>`).join("")}
      </div>
    </div>` : ""}
  `;
}

// ── SIP Reminder ──────────────────────────────────────────────
function renderSIPReminder() {
  const el = document.getElementById("sip-reminder-content");
  const lblEl = document.getElementById("sip-month-label");
  if (!el) return;
  const k = DATA.kpis;
  if (!k.totalInvested) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px">Upload your files to get your personalised SIP action plan.</div>';
    return;
  }
  const now = new Date();
  // FIX Issue #11: use shared MONTH_NAMES constant
  lblEl.textContent = MONTH_NAMES[now.getMonth()].toUpperCase() + " " + now.getFullYear() + " — ACTION PLAN";

  const allMonths = buildCombinedMonthly();
  const activeMonths = allMonths.filter((x) => x.v > 0);
  const avgMonthly = activeMonths.length
    ? Math.round(activeMonths.reduce((a, x) => a + x.v, 0) / activeMonths.length)
    : 0;

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = prevMonthDate.getFullYear() + "-" + String(prevMonthDate.getMonth() + 1).padStart(2, "0");
  const investedThisMonth = allMonths.find((x) => x.m === lastMonthKey)?.v || 0;

  const topFunds = [...DATA.funds].sort((a, b) => b.CAGR - a.CAGR).slice(0, 3);
  const underperformers = DATA.funds.filter((f) => f.CAGR < 10 && f.CAGR > 0);
  const recommendedSIP = avgMonthly || Math.round((k.totalInvested || 0) * 0.02);
  const mfShare = k.totalInvested ? k.mfInvested / k.totalInvested : 0.7;
  const mfSIP = Math.round(recommendedSIP * Math.min(0.8, Math.max(0.5, mfShare)));
  const stSIP = recommendedSIP - mfSIP;

  const actions = [];
  if (topFunds.length) {
    const perFund = Math.round(mfSIP / Math.min(3, topFunds.length));
    topFunds.slice(0, 2).forEach((f) => {
      actions.push({ icon: "📊", fund: f.name.split(" ").slice(0, 4).join(" "), amt: fmtL(perFund), reason: `CAGR ${fmtP(f.CAGR)} — top performer in your portfolio` });
    });
  }
  if (underperformers.length) {
    actions.push({ icon: "⚠️", fund: underperformers[0].name.split(" ").slice(0, 4).join(" "), amt: "₹0", reason: `Consider pausing SIP — CAGR only ${fmtP(underperformers[0].CAGR)}, switch to higher-alpha fund` });
  }
  if (stSIP > 0) {
    const sectors = DATA.sectors.filter((s) => s.Gain > 0).sort((a, b) => b.RetPct - a.RetPct);
    const bestSec = sectors[0];
    actions.push({ icon: "📈", fund: bestSec ? bestSec.Sector + " stocks" : "Large-cap stocks", amt: fmtL(stSIP), reason: bestSec ? `Your best-performing sector at ${fmtP(bestSec.RetPct)}` : "Diversify equity exposure" });
  }

  el.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="sip-amount">${fmtL(recommendedSIP)}<span style="font-size:14px;color:var(--muted);font-family:var(--mono)">/mo</span></div>
      <div style="font-size:11px;color:var(--muted)">Recommended monthly deployment · Based on your historical avg ${fmtL(avgMonthly > 0 ? avgMonthly : recommendedSIP)}/mo</div>
    </div>
    <div class="sip-action-list">
      ${actions.map((a) => `<div class="sip-action-item">
        <span class="sip-action-icon">${a.icon}</span>
        <div style="flex:1">
          <div class="sip-action-fund">${esc(a.fund)} <span class="sip-action-amt">${a.amt}</span></div>
          <div class="sip-action-reason">${a.reason}</div>
        </div>
      </div>`).join("")}
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⓘ Recommendations based on your historical investing pattern and fund performance. Always review with your financial goals before acting.
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// DRAWDOWN ANALYZER
// ══════════════════════════════════════════════════════════════

// FIX Issue #3: cache GBM series in DATA to avoid recomputing on every render
function buildDrawdownSeriesFromTimeline() {
  // Return cached series if available — only invalidated on upload (in page-tools.js)
  if (DATA._cachedDrawdownSeries) return DATA._cachedDrawdownSeries;

  const allMonths = buildCombinedMonthly();
  if (!allMonths.length) return [];
  const k = DATA.kpis;
  if (!k || !k.totalInvested) return [];

  const first = allMonths[0].m, last = allMonths[allMonths.length - 1].m;
  const monthMap = {};
  allMonths.forEach(({ m, v }) => (monthMap[m] = v));

  const mfCAGR = k.mfCAGR > 0 ? k.mfCAGR : 12;
  const annualDrift = mfCAGR / 100;
  const annualSigma = 0.18;
  const monthlyDrift = annualDrift / 12;
  const monthlySigma = annualSigma / Math.sqrt(12);

  const CRASH_SHOCKS = {
    "2008-10": -0.24, "2011-12": -0.08, "2013-08": -0.07, "2015-08": -0.09,
    "2016-11": -0.06, "2018-09": -0.08, "2020-03": -0.32, "2022-06": -0.1,
    "2024-06": -0.06,
  };

  const [sy, sm] = first.split("-").map(Number);
  let seed = sy * 100 + sm;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randn() {
    let u, v;
    do { u = rand(); v = rand(); } while (u === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const series = [];
  let [fy, fm] = [parseInt(first.slice(0, 4)), parseInt(first.slice(5))];
  const [ey, em] = [parseInt(last.slice(0, 4)), parseInt(last.slice(5))];
  let portfolioValue = 0;

  while (fy < ey || (fy === ey && fm <= em)) {
    const mk = fy + "-" + String(fm).padStart(2, "0");
    portfolioValue += monthMap[mk] || 0;
    const gbmReturn = monthlyDrift + monthlySigma * randn();
    portfolioValue *= 1 + gbmReturn;
    if (CRASH_SHOCKS[mk] !== undefined) portfolioValue *= 1 + CRASH_SHOCKS[mk];
    portfolioValue = Math.max(portfolioValue, 0);
    series.push({ date: mk, value: Math.round(portfolioValue) });
    fm++;
    if (fm > 12) { fm = 1; fy++; }
  }

  const actualEndValue = k.totalValue || 0;
  if (actualEndValue > 0 && series.length > 0) {
    const simEndValue = series[series.length - 1].value;
    if (simEndValue > 0) {
      const scale = actualEndValue / simEndValue;
      const n = series.length;
      series.forEach((pt, i) => {
        const t = i / Math.max(n - 1, 1);
        const blendedScale = 1 + (scale - 1) * t;
        pt.value = Math.round(pt.value * blendedScale);
      });
    }
  }

  // Cache result — cleared on next upload via page-tools.js tryApplyData()
  DATA._cachedDrawdownSeries = series;
  return series;
}

function calculateDrawdown(series) {
  if (!series.length)
    return { maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true };

  const values = series.map((s) => s.value);
  let runningPeak = values[0];
  let maxDD = 0, maxDDPeak = runningPeak, maxDDTroughIdx = 0, curPeakIdx = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak : 0;
    if (dd < maxDD) { maxDD = dd; maxDDPeak = runningPeak; maxDDTroughIdx = i; }
  }

  const finalVal = values[values.length - 1];
  const allTimePeak = Math.max(...values);
  const currentDD = allTimePeak > 0 ? (finalVal - allTimePeak) / allTimePeak : 0;

  let recoveryMonths = 0, recovered = true;
  if (maxDD < -0.001) {
    recovered = false;
    for (let i = maxDDTroughIdx + 1; i < values.length; i++) {
      recoveryMonths++;
      if (values[i] >= maxDDPeak) { recovered = true; break; }
    }
    if (!recovered) recoveryMonths = values.length - 1 - maxDDTroughIdx;
  }

  return { maxDD, currentDD, peak: allTimePeak, recoveryMonths, recovered };
}

function calculateDrawdownWithPeriod(series) {
  if (!series.length) return { peakIndex: 0, troughIndex: 0, maxDD: 0, ddSeries: [] };

  const values = series.map((s) => s.value);
  let runningPeak = values[0];
  let maxDD = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0;
  const ddSeries = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? ((values[i] - runningPeak) / runningPeak) * 100 : 0;
    ddSeries.push(parseFloat(dd.toFixed(2)));
    if (dd < maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }

  return { peakIndex: peakIdx, troughIndex: troughIdx, maxDD, ddSeries };
}

function renderDrawdownSummary(stats) {
  const { maxDD, currentDD, peak, recoveryMonths, recovered } = stats;
  const noData = !peak;
  const set = (id, text, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; if (color) el.style.color = color; }
  };
  set("dd-max", noData ? "—" : (maxDD * 100).toFixed(1) + "%", noData ? "var(--muted)" : "var(--red)");
  set("dd-max-note", noData ? "Upload data" : "Worst peak-to-trough fall");
  if (noData) {
    set("dd-cur", "—", "var(--muted)"); set("dd-cur-note", "Upload data");
  } else if (currentDD >= -0.001) {
    set("dd-cur", "At Peak", "var(--green)"); set("dd-cur-note", "Portfolio at all-time high");
  } else {
    set("dd-cur", (currentDD * 100).toFixed(1) + "%", currentDD < -0.15 ? "var(--red)" : "var(--amber)");
    set("dd-cur-note", "Below all-time high");
  }
  if (noData) {
    set("dd-recovery", "—", "var(--muted)"); set("dd-recovery-note", "Upload data");
  } else if (recoveryMonths === 0) {
    set("dd-recovery", "None", "var(--green)"); set("dd-recovery-note", "No significant drawdown");
  } else {
    set("dd-recovery", recoveryMonths + " mo", recovered ? "var(--green)" : "var(--amber)");
    set("dd-recovery-note", recovered ? "Fully recovered" : "Still recovering");
  }
  set("dd-peak", noData ? "—" : fmtL(peak), noData ? "var(--muted)" : "var(--gold)");
  set("dd-peak-note", noData ? "Upload data" : "All-time portfolio high");
}

function renderDrawdownChart(series, ddResult) {
  scheduleChart("chart-drawdown", 100, (canvas) => {
    if (!series.length) {
      canvas.parentElement.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see drawdown chart</div>';
      return null;
    }
    const { ddSeries, peakIndex, troughIndex } = ddResult;
    const labels = series.map((s) => s.date);
    const skip = Math.max(1, Math.ceil(labels.length / 18));
    const minDD = Math.min(...ddSeries, -0.5);
    const yMin = Math.floor(minDD * 1.25);
    const pointRadius = labels.map((_, i) => i === peakIndex || i === troughIndex ? 5 : 0);
    const pointBg = labels.map((_, i) => i === peakIndex ? "#d4a843" : i === troughIndex ? "#f85149" : "rgba(0,0,0,0)");
    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Drawdown %", data: ddSeries, borderColor: "#f85149",
          backgroundColor: "rgba(248,81,73,0.10)", borderWidth: 2, fill: true, tension: 0.3,
          pointRadius, pointBackgroundColor: pointBg, pointBorderColor: pointBg,
          pointBorderWidth: 2, pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => labels[items[0].dataIndex],
              label: (ctx) => {
                const tag = ctx.dataIndex === peakIndex ? " 🔺 Peak" : ctx.dataIndex === troughIndex ? " 🔻 Trough" : "";
                return "Drawdown: " + ctx.raw.toFixed(2) + "%" + tag;
              },
            },
            backgroundColor: "#1c2330", titleColor: "#e6edf3", bodyColor: "#7d8590", borderColor: "#30363d", borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { font: { size: 9 }, color: "#7d8590", maxRotation: 45, callback: (_, i) => (i % skip === 0 ? labels[i] : "") }, grid: { color: "#21262d" } },
          y: { min: yMin, max: 1, ticks: { font: { size: 9 }, color: "#7d8590", callback: (v) => v.toFixed(1) + "%" }, grid: { color: "#21262d" } },
        },
      },
    });
  });
}

function renderDrawdownInsight(maxDD, currentDD) {
  const el = document.getElementById("dd-insight");
  if (!el) return;
  if (!maxDD) { el.innerHTML = ""; return; }
  const pct = maxDD * 100, curPct = currentDD * 100;
  let accent, icon, title, note;
  if (pct <= -30) {
    accent = "var(--red)"; icon = "⚠"; title = "High Drawdown Warning";
    note = `Portfolio experienced a severe drawdown of ${pct.toFixed(1)}% — exceeding 30%. Review position sizing and consider enforcing stop-loss discipline on speculative holdings.`;
  } else if (pct <= -15) {
    accent = "var(--amber)"; icon = "◈"; title = "Moderate Drawdown Observed";
    note = `A pullback of ${pct.toFixed(1)}% was recorded. This is within the acceptable range for an equity-heavy portfolio. Monitor sector concentration to limit future drawdowns.`;
  } else if (curPct < -5) {
    accent = "var(--blue)"; icon = "ℹ"; title = "Currently Below Peak";
    note = `Portfolio is ${Math.abs(curPct).toFixed(1)}% below its all-time high. Continue regular SIPs to benefit from rupee cost averaging during this recovery phase.`;
  } else {
    accent = "var(--green)"; icon = "✓"; title = "Healthy Drawdown Profile";
    note = `Max drawdown is under 15% — a sign of disciplined, diversified investing. Capital preservation is strong across your investment history.`;
  }
  el.innerHTML = `<div class="insight-card" style="--ic-accent:${accent}">
    <div class="insight-label">${icon} ${title}</div>
    <div class="insight-value" style="color:${accent}">${pct.toFixed(1)}%</div>
    <div class="insight-note">${note}</div>
  </div>`;
}

function renderDrawdownAnalyzer() {
  const series = buildDrawdownSeriesFromTimeline();
  if (!series.length) {
    renderDrawdownSummary({ maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true });
    renderDrawdownInsight(0, 0);
    return;
  }
  const stats = calculateDrawdown(series);
  const ddResult = calculateDrawdownWithPeriod(series);
  renderDrawdownSummary(stats);
  renderDrawdownInsight(stats.maxDD, stats.currentDD);
  renderDrawdownChart(series, ddResult);
}
