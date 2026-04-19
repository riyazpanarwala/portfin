// ── page-mf.js — Mutual Funds page ─────────────────────────────────────────

// ── Mutual Funds ──────────────────────────────────────────────
function renderMF() {
  const k = DATA.kpis;
  const totalLots = DATA.funds.reduce((a, f) => a + f.Lots, 0);
  const profitableMF = DATA.funds.filter((f) => f.Gain > 0).length;
  const sinceMF = k.earliestMF ? "Since " + fmtMonthYear(k.earliestMF) : "";
  document.getElementById("kpi-mf").innerHTML = renderKpiCards([
    { l: "MF Invested", v: fmtL(k.mfInvested), s: "", sc: "", a: "#58a6ff" },
    {
      l: "Current Value",
      v: fmtL(k.mfValue),
      s: "Market value",
      sc: "up",
      a: "#3fb950",
    },
    {
      l: "Total Gain",
      v: fmtL(k.mfGain),
      s: fmtP(k.mfReturn),
      sc: k.mfGain >= 0 ? "up" : "dn",
      a: "#3fb950",
    },
    { l: "CAGR", v: fmtP(k.mfCAGR), s: sinceMF, sc: "up", a: "#a371f7" },
    {
      l: "Total Lots",
      v: totalLots.toLocaleString("en-IN"),
      s: DATA.funds.length + " active funds",
      sc: "",
      a: "#d4a843",
    },
    {
      l: "Profitable",
      v: profitableMF + "/" + DATA.funds.length,
      s:
        profitableMF === DATA.funds.length
          ? "100% in green"
          : profitableMF + " in profit",
      sc: profitableMF === DATA.funds.length ? "up" : "gold",
      a: "#3fb950",
    },
  ]);

  const cats = ["All", ...new Set(DATA.funds.map((f) => f.Category))];
  document.getElementById("mf-filters").innerHTML =
    '<span class="ctrl-label">Category:</span>' +
    cats
      .map(
        (c) =>
          `<button class="chip ${mfFil === c ? "on" : ""}" onclick="setMfFil('${esc(c)}')">${esc(c)}</button>`,
      )
      .join("");
  const sOpts = [
    ["RetPct", "Return"],
    ["CAGR", "CAGR"],
    ["Current", "Value"],
    ["Gain", "Gain"],
    ["Invested", "Invested"],
    ["Lots", "Lots"],
  ];
  document.getElementById("mf-sorts").innerHTML =
    '<span class="ctrl-label">Sort:</span>' +
    sOpts
      .map(
        ([k, l]) =>
          `<button class="chip ${mfSort === k ? "on" : ""}" onclick="sortMF('${k}')">${l}${mfSort === k ? (mfAsc ? " ↑" : " ↓") : ""}</button>`,
      )
      .join("");

  let funds =
    mfFil === "All"
      ? DATA.funds
      : DATA.funds.filter((f) => f.Category === mfFil);
  funds = [...funds].sort((a, b) =>
    mfAsc ? a[mfSort] - b[mfSort] : b[mfSort] - a[mfSort],
  );
  const maxR = Math.max(...DATA.funds.map((f) => Math.abs(f.RetPct)), 1);

  if (!funds.length) {
    document.getElementById("mf-tbody").innerHTML =
      '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Upload your MF Excel file to see fund data</td></tr>';
    return;
  }

  document.getElementById("mf-tbody").innerHTML = funds
    .map((f, i) => {
      const hold = fmtHoldPeriod(f.holdDays);

      // Weighted average buy NAV across all lots
      const lots = f.rawLots || [];
      let wavgNav = 0;
      if (lots.length) {
        const totalUnits = lots.reduce((a, l) => a + (l.qty || 0), 0);
        const totalAmt = lots.reduce((a, l) => a + (l.amt || 0), 0);
        // Prefer units-weighted NAV; fall back to simple avg invPrice
        if (totalUnits > 0) {
          wavgNav = totalAmt / totalUnits;
        } else {
          const priced = lots.filter((l) => l.invPrice > 0);
          if (priced.length)
            wavgNav =
              priced.reduce((a, l) => a + l.invPrice, 0) / priced.length;
        }
      }
      const navDisplay = wavgNav > 0 ? "₹" + wavgNav.toFixed(2) : "—";

      return `<tr style="cursor:pointer" onclick="toggleDrill('mf',${i})">
    <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis">
      <span class="expand-btn" id="drill-btn-mf-${i}">▶</span> ${esc(f.name)}
    </td>
    <td><span class="pill" style="background:${CAT_CLR[f.Category] || "#444"}22;color:${CAT_CLR[f.Category] || "#888"};border:1px solid ${CAT_CLR[f.Category] || "#444"}44">${esc(f.Category)}</span></td>
    <td class="td-muted">${f.Lots}</td>
    <td class="td-muted">${navDisplay}</td>
    <td class="td-muted">${fmtL(f.Invested)}</td>
    <td style="font-weight:500">${fmtL(f.Current)}</td>
    <td class="${cls(f.Gain)}">${fmtL(f.Gain)}</td>
    <td style="min-width:130px">${miniBar(f.RetPct, maxR)}</td>
    <td class="${f.CAGR >= 12 ? "td-up" : f.CAGR >= 8 ? "td-gold" : "td-dn"}">${fmtP(f.CAGR)}</td>
    <td class="td-muted" style="font-size:10px">${hold}</td>
  </tr>
  <tr class="drill-row" id="drill-mf-${i}" style="display:none">
    <td colspan="10"><div class="drill-inner">${buildMFDrillHTML(f)}</div></td>
  </tr>`;
    })
    .join("");

  const maxCat = Math.max(
    ...DATA.mfCategories.map((c) => Math.abs(c.RetPct)),
    1,
  );
  document.getElementById("mf-cats").innerHTML = DATA.mfCategories
    .map(
      (c) =>
        `<div class="card" style="border-left:3px solid ${CAT_CLR[c.Category] || "#888"}"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${c.Category}</div><div style="font-size:18px;font-weight:700;font-family:var(--sans);margin-bottom:4px">${fmtL(c.Current)}</div><div style="font-size:11px;color:var(--muted);margin-bottom:8px">${fmtL(c.Invested)} invested</div>${miniBar(c.RetPct, maxCat)}</div>`,
    )
    .join("");
}
function sortMF(k) {
  if (mfSort === k) mfAsc = !mfAsc;
  else {
    mfSort = k;
    mfAsc = false;
  }
  renderMF();
}
function setMfFil(v) {
  mfFil = v;
  renderMF();
}
