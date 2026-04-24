// ── page-overview/04-sip-reminder.js ────────────────────────────────────────
// SIP Action Plan card.
// Computes recommended monthly deployment, suggests top-performing funds
// to add to, flags underperformers to pause, and recommends a stock sector.

function renderSIPReminder() {
  const el    = document.getElementById("sip-reminder-content");
  const lblEl = document.getElementById("sip-month-label");
  if (!el) return;

  const k = DATA.kpis;
  if (!k.totalInvested) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:12px">Upload your files to get your personalised SIP action plan.</div>';
    return;
  }

  const now = new Date();
  if (lblEl)
    lblEl.textContent =
      MONTH_NAMES[now.getMonth()].toUpperCase() + " " + now.getFullYear() + " — ACTION PLAN";

  const { avgMonthly, recommendedSIP, mfSIP, stSIP } = _calcSIPAmounts(k);
  const actions = _buildSIPActions(k, mfSIP, stSIP);

  el.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="sip-amount">
        ${fmtL(recommendedSIP)}
        <span style="font-size:14px;color:var(--muted);font-family:var(--mono)">/mo</span>
      </div>
      <div style="font-size:11px;color:var(--muted)">
        Recommended monthly deployment · Based on your historical avg
        ${fmtL(avgMonthly > 0 ? avgMonthly : recommendedSIP)}/mo
      </div>
    </div>
    <div class="sip-action-list">
      ${actions
        .map(
          (a) => `
          <div class="sip-action-item">
            <span class="sip-action-icon">${a.icon}</span>
            <div style="flex:1">
              <div class="sip-action-fund">
                ${esc(a.fund)}
                <span class="sip-action-amt">${a.amt}</span>
              </div>
              <div class="sip-action-reason">${a.reason}</div>
            </div>
          </div>`,
        )
        .join("")}
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⓘ Recommendations based on your historical investing pattern and fund performance.
      Always review with your financial goals before acting.
    </div>`;
}

// ── Amount calculations ───────────────────────────────────────
function _calcSIPAmounts(k) {
  const allMonths    = buildCombinedMonthly();
  const activeMonths = allMonths.filter((x) => x.v > 0);
  const avgMonthly   = activeMonths.length
    ? Math.round(activeMonths.reduce((a, x) => a + x.v, 0) / activeMonths.length)
    : 0;

  const recommendedSIP = avgMonthly || Math.round((k.totalInvested || 0) * 0.02);
  const mfShare        = k.totalInvested ? k.mfInvested / k.totalInvested : 0.7;
  const mfSIP          = Math.round(recommendedSIP * Math.min(0.8, Math.max(0.5, mfShare)));
  const stSIP          = recommendedSIP - mfSIP;

  return { avgMonthly, recommendedSIP, mfSIP, stSIP };
}

// ── Action item builder ───────────────────────────────────────
function _buildSIPActions(k, mfSIP, stSIP) {
  const actions       = [];
  const topFunds      = [...DATA.funds].sort((a, b) => b.CAGR - a.CAGR).slice(0, 3);
  const underperformers = DATA.funds.filter((f) => f.CAGR < 10 && f.CAGR > 0);

  // Recommend top 2 performing funds
  if (topFunds.length) {
    const perFund = Math.round(mfSIP / Math.min(3, topFunds.length));
    topFunds.slice(0, 2).forEach((f) => {
      actions.push({
        icon:   "📊",
        fund:   f.name.split(" ").slice(0, 4).join(" "),
        amt:    fmtL(perFund),
        reason: `CAGR ${fmtP(f.CAGR)} — top performer in your portfolio`,
      });
    });
  }

  // Flag the worst underperformer
  if (underperformers.length) {
    actions.push({
      icon:   "⚠️",
      fund:   underperformers[0].name.split(" ").slice(0, 4).join(" "),
      amt:    "₹0",
      reason: `Consider pausing SIP — CAGR only ${fmtP(underperformers[0].CAGR)}, switch to higher-alpha fund`,
    });
  }

  // Best-performing stock sector
  if (stSIP > 0) {
    const sectors = DATA.sectors
      .filter((s) => s.Gain > 0)
      .sort((a, b) => b.RetPct - a.RetPct);
    const bestSec = sectors[0];
    actions.push({
      icon:   "📈",
      fund:   bestSec ? bestSec.Sector + " stocks" : "Large-cap stocks",
      amt:    fmtL(stSIP),
      reason: bestSec
        ? `Your best-performing sector at ${fmtP(bestSec.RetPct)}`
        : "Diversify equity exposure",
    });
  }

  return actions;
}
