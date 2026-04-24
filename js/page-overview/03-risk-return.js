// ── page-overview/03-risk-return.js ─────────────────────────────────────────
// Portfolio Risk-Return Classification.
// Computes a risk score (0–100) and return score (0–100),
// maps them to one of 8 named archetypes, and renders a visual matrix.

function renderRiskReturnClassification() {
  const k        = DATA.kpis;
  const contentEl = document.getElementById("risk-return-content");
  if (!contentEl) return;

  if (!k.totalInvested) {
    contentEl.innerHTML = `
      <div style="color:var(--muted);font-size:12px;padding:30px;text-align:center">
        📂 Upload your Excel files to see your portfolio's risk-return classification.
      </div>`;
    return;
  }

  const { riskScore, riskFactors } = _calcRiskScore(k);
  const returnScore = _calcReturnScore(k);
  const archetype   = _getArchetype(riskScore, returnScore);

  contentEl.innerHTML = _buildClassificationHTML(riskScore, returnScore, riskFactors, archetype);
}

// ── Risk score (0–100) ────────────────────────────────────────
function _calcRiskScore(k) {
  let riskScore  = 0;
  const riskFactors = [];

  // Small-cap + speculative exposure
  const smallCapMF = DATA.funds
    .filter((f) => f.Category === "Small Cap")
    .reduce((a, f) => a + f.Invested, 0);
  const speculativeStocks = DATA.stocks
    .filter((s) => s.Sector === "Speculative")
    .reduce((a, s) => a + s.Invested, 0);
  const highRiskPct = k.totalInvested
    ? ((smallCapMF + speculativeStocks) / k.totalInvested) * 100
    : 0;
  riskScore += Math.min(35, highRiskPct * 1.2);
  if (highRiskPct > 0)
    riskFactors.push(`📈 ${highRiskPct.toFixed(1)}% in Small-cap/Speculative`);

  // Single-stock concentration
  const topStockPct = DATA.stocks.length
    ? Math.max(...DATA.stocks.map((s) => (s.Invested / k.stInvested) * 100))
    : 0;
  riskScore += Math.min(25, topStockPct * 0.8);
  if (topStockPct > 15)
    riskFactors.push(`⚠️ Top stock: ${topStockPct.toFixed(1)}% of equity portfolio`);

  // Return dispersion (volatility proxy)
  const fundReturns = DATA.funds.map((f) => f.RetPct);
  const avgRet      = fundReturns.reduce((a, b) => a + b, 0) / (fundReturns.length || 1);
  const variance    = fundReturns.reduce((a, b) => a + Math.pow(b - avgRet, 2), 0) / (fundReturns.length || 1);
  const volProxy    = Math.min(30, Math.sqrt(variance) * 1.5);
  riskScore += volProxy;
  if (volProxy > 15)
    riskFactors.push(`📊 High return dispersion (${volProxy.toFixed(1)}% std dev)`);

  // Negative CAGR holdings
  const negCAGR = DATA.funds.filter((f) => f.CAGR < 0).length
    + DATA.stocks.filter((s) => s.CAGR < 0).length;
  riskScore += Math.min(15, negCAGR * 3);
  if (negCAGR > 0)
    riskFactors.push(`📉 ${negCAGR} holding(s) with negative CAGR`);

  return { riskScore: Math.min(100, Math.max(0, riskScore)), riskFactors };
}

// ── Return score (0–100) ──────────────────────────────────────
function _calcReturnScore(k) {
  let returnScore   = 0;
  const NIFTY_BENCH = 12;
  const portReturn  = k.totalReturn || 0;
  const relReturn   = portReturn - NIFTY_BENCH;

  // Absolute return tiers
  if (portReturn > 20)      returnScore += 40;
  else if (portReturn > 15) returnScore += 35;
  else if (portReturn > 12) returnScore += 30;
  else if (portReturn > 8)  returnScore += 20;
  else if (portReturn > 0)  returnScore += 10;

  // Alpha vs Nifty
  if (relReturn > 5)       returnScore += 15;
  else if (relReturn > 0)  returnScore += 8;
  else if (relReturn < -5) returnScore -= 10;

  // MF CAGR quality
  const avgMFCAGR = DATA.funds.reduce((a, f) => a + f.CAGR, 0) / (DATA.funds.length || 1);
  if (avgMFCAGR > 15)      returnScore += 20;
  else if (avgMFCAGR > 12) returnScore += 15;
  else if (avgMFCAGR > 8)  returnScore += 8;
  else if (avgMFCAGR < 0)  returnScore -= 15;

  // Stock win rate
  const stockWinRate = DATA.stocks.length
    ? (DATA.stocks.filter((s) => s.Gain > 0).length / DATA.stocks.length) * 100
    : 50;
  if (stockWinRate > 70)      returnScore += 15;
  else if (stockWinRate > 50) returnScore += 8;
  else if (stockWinRate < 30) returnScore -= 10;

  return Math.min(100, Math.max(0, returnScore));
}

// ── Archetype lookup ──────────────────────────────────────────
function _getArchetype(riskScore, returnScore) {
  if (riskScore >= 60 && returnScore >= 60)
    return { classification: "HIGH RISK · HIGH RETURN",    color: "#d4a843", icon: "🚀",
      description: "Aggressive portfolio with strong returns. Your risk-taking is being rewarded.",
      recommendation: "Maintain this strategy but consider taking some profits off the table." };

  if (riskScore >= 60 && returnScore < 40)
    return { classification: "HIGH RISK · LOW RETURN",     color: "#f85149", icon: "⚠️",
      description: "You're taking significant risks but not seeing commensurate returns.",
      recommendation: "Review your speculative positions and consider shifting to quality large-caps or index funds." };

  if (riskScore >= 60)
    return { classification: "HIGH RISK · MODERATE RETURN", color: "#f0883e", icon: "📊",
      description: "You're taking above-average risk for average returns.",
      recommendation: "Consider reducing small-cap exposure and adding more diversified funds." };

  if (riskScore < 40 && returnScore >= 60)
    return { classification: "LOW RISK · HIGH RETURN",     color: "#3fb950", icon: "🏆",
      description: "Excellent risk-adjusted returns! You're beating the market without excessive risk.",
      recommendation: "This is the ideal zone — stay the course and keep SIPs running." };

  if (riskScore < 40 && returnScore < 40)
    return { classification: "LOW RISK · LOW RETURN",      color: "#7d8590", icon: "🐢",
      description: "Very conservative portfolio with returns below market average.",
      recommendation: "You may be too conservative. Consider adding some large-cap or index funds." };

  if (riskScore < 40)
    return { classification: "LOW RISK · MODERATE RETURN", color: "#58a6ff", icon: "⚖️",
      description: "Balanced portfolio with good risk management.",
      recommendation: "Well diversified. You could increase equity allocation slightly for better returns." };

  if (returnScore >= 60)
    return { classification: "MODERATE RISK · HIGH RETURN",    color: "#a371f7", icon: "📈",
      description: "Great risk-return balance — you're getting premium returns for moderate risk.",
      recommendation: "This is excellent. Just monitor concentration in top performers." };

  return { classification: "MODERATE RISK · MODERATE RETURN", color: "#79c0ff", icon: "◈",
    description: "A balanced approach with market-like returns.",
    recommendation: "Solid foundation. Consider adding one high-conviction fund to boost returns." };
}

// ── HTML builder ──────────────────────────────────────────────
function _buildClassificationHTML(riskScore, returnScore, riskFactors, archetype) {
  const { classification, color, icon, description, recommendation } = archetype;

  const riskColor   = riskScore   >= 60 ? "var(--red)"    : riskScore   >= 40 ? "var(--amber)" : "var(--green)";
  const returnColor = returnScore >= 60 ? "var(--green)"  : returnScore >= 40 ? "var(--gold)"  : "var(--red)";

  // Matrix dot position: X = returnScore, Y = 100 - riskScore
  const matrixX = returnScore;
  const matrixY = 100 - riskScore;

  const riskFactorsHTML = riskFactors.length
    ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">
          Key risk factors
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${riskFactors.slice(0, 3)
            .map((f) => `<span style="font-size:10px;background:var(--bg4);padding:3px 8px;border-radius:12px;color:var(--muted2)">${f}</span>`)
            .join("")}
        </div>
      </div>`
    : "";

  return `
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;justify-content:space-between">

      <!-- Left: classification + scores + recommendation -->
      <div style="flex:2;min-width:200px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <span style="font-size:36px">${icon}</span>
          <div>
            <div style="font-size:18px;font-weight:700;color:${color};letter-spacing:-0.3px">${classification}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${description}</div>
          </div>
        </div>

        <div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap">
          <div style="background:var(--bg4);border-radius:8px;padding:8px 14px;text-align:center;flex:1;min-width:80px">
            <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Risk Score</div>
            <div style="font-size:24px;font-weight:700;color:${riskColor}">${Math.round(riskScore)}</div>
            <div style="font-size:9px;color:var(--muted)">/100 (higher = riskier)</div>
          </div>
          <div style="background:var(--bg4);border-radius:8px;padding:8px 14px;text-align:center;flex:1;min-width:80px">
            <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Return Score</div>
            <div style="font-size:24px;font-weight:700;color:${returnColor}">${Math.round(returnScore)}</div>
            <div style="font-size:9px;color:var(--muted)">/100 (higher = better)</div>
          </div>
        </div>

        <div style="background:${color}10;border-left:3px solid ${color};border-radius:6px;padding:10px 12px;margin-top:8px">
          <div style="font-size:10px;color:${color};font-weight:600;margin-bottom:4px">💡 RECOMMENDATION</div>
          <div style="font-size:11px;color:var(--text);line-height:1.5">${recommendation}</div>
        </div>
      </div>

      <!-- Right: visual matrix quadrant -->
      <div style="flex:1;min-width:180px">
        <div style="position:relative;width:100%;max-width:280px;height:200px;
                    background:var(--bg3);border-radius:12px;border:1px solid var(--border);
                    margin:0 auto;overflow:hidden">
          <div style="position:absolute;top:4px;left:8px;font-size:7px;color:var(--muted2)">Low Risk<br>High Return</div>
          <div style="position:absolute;top:4px;right:8px;font-size:7px;color:var(--muted2);text-align:right">High Risk<br>High Return</div>
          <div style="position:absolute;bottom:4px;left:8px;font-size:7px;color:var(--muted2)">Low Risk<br>Low Return</div>
          <div style="position:absolute;bottom:4px;right:8px;font-size:7px;color:var(--muted2);text-align:right">High Risk<br>Low Return</div>
          <!-- Axis lines -->
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2)"></div>
          <div style="position:absolute;left:0;top:50%;width:100%;height:1px;background:var(--border2)"></div>
          <!-- Portfolio dot -->
          <div style="position:absolute;
                      left:calc(${matrixX}% - 8px);top:calc(${matrixY}% - 8px);
                      width:16px;height:16px;background:${color};border-radius:50%;
                      border:2px solid var(--bg2);box-shadow:0 2px 6px rgba(0,0,0,0.3);
                      transition:all 0.3s"></div>
          <!-- Glow -->
          <div style="position:absolute;
                      left:calc(${matrixX}% - 20px);top:calc(${matrixY}% - 20px);
                      width:40px;height:40px;background:${color};border-radius:50%;
                      opacity:0.15;filter:blur(8px)"></div>
        </div>
        <div style="font-size:9px;color:var(--muted2);text-align:center;margin-top:6px">
          ← Lower Risk &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Higher Return →
        </div>
      </div>

    </div>
    ${riskFactorsHTML}`;
}
