// ── page-timeline.js — Investment Timeline ──────────────────────────────────
// NOTE: buildCombinedMonthly() lives in common.js (cached). Do NOT redefine here.

let tlYearFilter = "All";

function renderTimeline() {
  const allMonths = buildCombinedMonthly();
  const noData = !allMonths.length;

  const k = DATA.kpis;
  const totalLots = DATA.mfLots.length + DATA.stLots.length;
  const avgMonthly = allMonths.length
    ? Math.round(allMonths.reduce((a, x) => a + x.v, 0) / allMonths.length)
    : 0;
  const maxMonth = allMonths.length
    ? allMonths.reduce((a, x) => (x.v > a.v ? x : a), allMonths[0])
    : null;
  const minMonth = allMonths.filter((x) => x.v > 0).length
    ? allMonths.filter((x) => x.v > 0).reduce((a, x) => (x.v < a.v ? x : a))
    : null;
  const activeMonths = allMonths.filter((x) => x.v > 0).length;
  const years = [...new Set(allMonths.map((x) => x.m.slice(0, 4)))];
  const spanYears = years.length
    ? parseInt(years[years.length - 1]) - parseInt(years[0]) + 1
    : 0;

  document.getElementById("tl-kpis").innerHTML = renderKpiCards([
    {
      l: "Total Invested",
      v: k.totalInvested ? fmtL(k.totalInvested) : "—",
      s: "MF + Stocks combined",
      a: "#d4a843",
    },
    {
      l: "Avg Monthly SIP",
      v: avgMonthly ? fmtL(avgMonthly) : "—",
      s: "Across active months",
      a: "#58a6ff",
    },
    {
      l: "Active Months",
      v: activeMonths || "—",
      s: `Over ${spanYears} yr${spanYears !== 1 ? "s" : ""}`,
      a: "#3fb950",
    },
    {
      l: "Total Lots",
      v: totalLots || "—",
      s: "Individual purchases",
      a: "#a371f7",
    },
    {
      l: "Best Month",
      v: maxMonth ? fmtL(maxMonth.v) : "—",
      s: maxMonth ? fmtMonthLabel(maxMonth.m) : "—",
      a: "#f0c060",
    },
    {
      l: "Lowest Month",
      v: minMonth ? fmtL(minMonth.v) : "—",
      s: minMonth ? fmtMonthLabel(minMonth.m) : "—",
      a: "#7d8590",
    },
  ]);

  const allYears = ["All", ...years];
  document.getElementById("tl-year-filter").innerHTML =
    '<span class="ctrl-label">Year:</span>' +
    allYears
      .map(
        (y) =>
          `<button class="chip ${tlYearFilter === y ? "on" : ""}" onclick="setTLYear('${y}')">${y}</button>`,
      )
      .join("");

  const months =
    tlYearFilter === "All"
      ? allMonths
      : allMonths.filter((x) => x.m.startsWith(tlYearFilter));

  renderHeatmap(months, allMonths);

  const yearlyMap = {};
  months.forEach(({ m, v }) => {
    const y = m.slice(0, 4);
    yearlyMap[y] = (yearlyMap[y] || 0) + v;
  });
  const yearlyArr = Object.entries(yearlyMap).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const maxYV = yearlyArr.length ? Math.max(...yearlyArr.map((x) => x[1])) : 1;
  document.getElementById("tl-yearly-bars").innerHTML = yearlyArr.length
    ? yearlyArr
        .map(
          ([y, v]) => `
        <div class="yr-bar-wrap">
          <span class="yr-bar-label">${y}</span>
          <div class="yr-bar-track">
            <div class="yr-bar-fill" style="width:${Math.round((v / maxYV) * 100)}%;background:${v >= maxYV * 0.7 ? "#d4a843" : "#58a6ff"}"></div>
          </div>
          <span class="yr-bar-val">${fmtL(v)}</span>
        </div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px">No data</div>';

  const tableYear =
    tlYearFilter !== "All" ? tlYearFilter : years[years.length - 1] || "";
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  document.getElementById("tl-month-select").innerHTML = years
    .map(
      (y) =>
        `<button class="chip" style="font-size:9px;padding:3px 7px;${y === tableYear ? "background:var(--gold);color:#0d1117;border-color:var(--gold);font-weight:500" : ""}" onclick="setTLYear('${y}')">${y}</button>`,
    )
    .join("");

  const tableMonths = allMonths.filter((x) => x.m.startsWith(tableYear));
  const maxTV = tableMonths.length
    ? Math.max(...tableMonths.map((x) => x.v))
    : 1;
  const tableTotal = tableMonths.reduce((a, x) => a + x.v, 0);
  document.getElementById("tl-monthly-table").innerHTML = tableMonths.length
    ? `<table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 0;border-bottom:1px solid var(--border)">Month</th>
          <th style="text-align:right;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 0;border-bottom:1px solid var(--border)">Invested</th>
          <th style="text-align:right;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 4px;border-bottom:1px solid var(--border)">% of Year</th>
        </tr></thead>
        <tbody>
        ${tableMonths
          .map(({ m, v }) => {
            const mo = parseInt(m.slice(5)) - 1;
            const pct = tableTotal > 0 ? Math.round((v / tableTotal) * 100) : 0;
            return `<tr>
            <td style="padding:7px 0;border-bottom:1px solid var(--border);font-size:11px">
              <div style="display:flex;align-items:center;gap:7px">
                <div style="width:${Math.round((v / maxTV) * 40) + 8}px;height:3px;background:${v >= maxTV * 0.7 ? "#d4a843" : "#58a6ff"};border-radius:2px;transition:width .4s"></div>
                ${MONTH_NAMES[mo]}
              </div>
            </td>
            <td style="padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;text-align:right;font-weight:500;color:var(--text)">${fmtL(v)}</td>
            <td style="padding:7px 4px;border-bottom:1px solid var(--border);font-size:10px;text-align:right;color:var(--muted)">${pct}%</td>
          </tr>`;
          })
          .join("")}
        </tbody>
        <tfoot><tr>
          <td style="padding:8px 0;font-size:11px;color:var(--muted);font-weight:600">Total ${tableYear}</td>
          <td style="padding:8px 0;font-size:11px;text-align:right;font-weight:700;color:var(--gold)">${fmtL(tableTotal)}</td>
          <td></td>
        </tr></tfoot>
      </table>`
    : `<div style="color:var(--muted);font-size:11px">${tableYear ? "No investments in " + tableYear : "Upload files to see breakdown"}</div>`;

  // FIX: use scheduleChart() instead of raw setTimeout + manual chartCumInst variable
  // so the chart is safely destroyed if the user switches pages before the delay fires
  scheduleChart("chart-cumulative", 60, (el) => {
    if (!allMonths.length) {
      el.parentElement.innerHTML =
        '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see cumulative chart</div>';
      return null;
    }

    const first = allMonths[0].m,
      last = allMonths[allMonths.length - 1].m;
    const monthMap = {};
    allMonths.forEach(({ m, v }) => (monthMap[m] = v));
    const labels = [],
      cumData = [],
      mfCumData = [],
      stCumData = [];
    const mfMonthMap = {};
    DATA.monthlyMF.forEach(({ m, v }) => (mfMonthMap[m] = v));
    const stMonthMap = {};
    DATA.stLots.forEach((l) => {
      if (!l.date || !l.amt) return;
      const d = new Date(l.date);
      if (isNaN(d)) return;
      const mk =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      stMonthMap[mk] = (stMonthMap[mk] || 0) + Math.round(l.amt);
    });

    let [fy, fm] = [parseInt(first.slice(0, 4)), parseInt(first.slice(5))];
    const [ly, lm] = [parseInt(last.slice(0, 4)), parseInt(last.slice(5))];
    let cumTotal = 0,
      cumMF = 0,
      cumST = 0;
    while (fy < ly || (fy === ly && fm <= lm)) {
      const mk = fy + "-" + String(fm).padStart(2, "0");
      cumTotal += monthMap[mk] || 0;
      cumMF += mfMonthMap[mk] || 0;
      cumST += stMonthMap[mk] || 0;
      labels.push(mk);
      cumData.push(cumTotal);
      mfCumData.push(cumMF);
      stCumData.push(cumST);
      fm++;
      if (fm > 12) {
        fm = 1;
        fy++;
      }
    }

    const skip = Math.ceil(labels.length / 18);
    return new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total",
            data: cumData,
            borderColor: "#d4a843",
            backgroundColor: "rgba(212,168,67,.08)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3,
          },
          {
            label: "MF",
            data: mfCumData,
            borderColor: "#58a6ff",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 3,
            borderDash: [4, 3],
            tension: 0.3,
          },
          {
            label: "Stocks",
            data: stCumData,
            borderColor: "#f0883e",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 3,
            borderDash: [2, 3],
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "#7d8590",
              font: { size: 10 },
              boxWidth: 12,
              padding: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + fmtL(ctx.raw),
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
              maxRotation: 45,
              callback: (v, i) => (i % skip === 0 ? labels[i] : ""),
            },
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

  const insights = [];
  if (allMonths.length) {
    let maxStreak = 0,
      cur = 0;
    allMonths.forEach((x) => {
      if (x.v > 0) {
        cur++;
        maxStreak = Math.max(maxStreak, cur);
      } else cur = 0;
    });
    insights.push({
      label: "Longest SIP streak",
      value: maxStreak + " months",
      note: "Consecutive months invested",
      accent: "#3fb950",
    });

    const byYear = {};
    allMonths.forEach(({ m, v }) => {
      const y = m.slice(0, 4);
      byYear[y] = (byYear[y] || 0) + v;
    });
    const topYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
    if (topYear)
      insights.push({
        label: "Highest-invest year",
        value: topYear[0],
        note: fmtL(topYear[1]) + " deployed",
        accent: "#d4a843",
      });

    const yearVals = Object.values(byYear);
    const avgYearly = Math.round(
      yearVals.reduce((a, v) => a + v, 0) / yearVals.length,
    );
    insights.push({
      label: "Avg annual invest",
      value: fmtL(avgYearly),
      note:
        "Across " +
        yearVals.length +
        " year" +
        (yearVals.length !== 1 ? "s" : ""),
      accent: "#58a6ff",
    });

    const gapMonths = allMonths.filter((x) => x.v === 0).length;
    insights.push({
      label: "Inactive months",
      value: gapMonths,
      note: "Months with no investment",
      accent: "#7d8590",
    });

    const mfTotal = DATA.monthlyMF.reduce((a, x) => a + x.v, 0);
    const stTotal = DATA.stLots.reduce((a, l) => a + l.amt, 0);
    const mfPct =
      mfTotal + stTotal > 0
        ? Math.round((mfTotal / (mfTotal + stTotal)) * 100)
        : 0;
    insights.push({
      label: "MF vs Stocks split",
      value: mfPct + "% / " + (100 - mfPct) + "%",
      note: "Of total capital deployed",
      accent: "#a371f7",
    });

    if (maxMonth)
      insights.push({
        label: "Biggest single month",
        value: fmtL(maxMonth.v),
        note: fmtMonthLabel(maxMonth.m),
        accent: "#f0c060",
      });
  }
  document.getElementById("tl-insights").innerHTML = insights.length
    ? insights
        .map(
          (c) =>
            `<div class="insight-card" style="--ic-accent:${c.accent}"><div class="insight-label">${c.label}</div><div class="insight-value" style="color:${c.accent}">${c.value}</div><div class="insight-note">${c.note}</div></div>`,
        )
        .join("")
    : '<div style="color:var(--muted);font-size:11px;padding:10px">Upload files to see investment insights</div>';
}

function fmtMonthLabel(mk) {
  const MNAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m] = mk.split("-");
  return MNAMES[parseInt(m) - 1] + " " + y;
}

function renderHeatmap(months, allMonths) {
  const container = document.getElementById("tl-heatmap");
  if (!months.length) {
    container.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:16px">Upload files to see heatmap</div>';
    return;
  }

  const allValues = allMonths.map((x) => x.v).filter((v) => v > 0);
  const maxV = Math.max(...allValues, 1);
  const COLORS = ["#1a2a1a", "#1a3d26", "#1e5c30", "#c8901a", "#d4a843"];
  function getColor(v) {
    if (!v) return null;
    const idx = Math.min(4, Math.floor((v / maxV) * 5));
    return COLORS[idx];
  }

  const mvMap = {};
  months.forEach(({ m, v }) => (mvMap[m] = v));
  const years = [...new Set(months.map((x) => x.m.slice(0, 4)))];
  const MNAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const cellSize = 24,
    gap = 3;
  const totalW = (cellSize + gap) * 12 + 40;

  let html = `<div style="overflow-x:auto"><div style="min-width:${totalW}px;padding:4px 0">`;
  html += `<div style="display:grid;grid-template-columns:36px repeat(12,${cellSize}px);gap:${gap}px;margin-bottom:4px">`;
  html += `<div></div>`;
  MNAMES.forEach(
    (mn) =>
      (html += `<div style="font-size:9px;color:var(--muted2);text-align:center;letter-spacing:.04em">${mn}</div>`),
  );
  html += "</div>";

  // FIX: only create the tooltip div once across all renderHeatmap calls
  // The previous code only guarded creation, but could still attach multiple
  // event listeners if the element was recreated. A single body-level div
  // is fine here since we update it in-place.
  if (!document.getElementById("tl-tooltip")) {
    const tt = document.createElement("div");
    tt.id = "tl-tooltip";
    tt.className = "tl-tooltip";
    document.body.appendChild(tt);
  }

  years.forEach((y) => {
    html += `<div style="display:grid;grid-template-columns:36px repeat(12,${cellSize}px);gap:${gap}px;margin-bottom:${gap}px;align-items:center">`;
    html += `<div style="font-size:9px;color:var(--muted);text-align:right;padding-right:6px;font-weight:500">${y}</div>`;
    for (let m = 1; m <= 12; m++) {
      const mk = y + "-" + String(m).padStart(2, "0");
      const v = mvMap[mk] || 0;
      const bg = getColor(v);
      if (bg) {
        const escaped = fmtL(v).replace(/'/g, "&#39;");
        const mlabel = MNAMES[m - 1] + " " + y;
        html += `<div class="tl-cell" style="width:${cellSize}px;height:${cellSize}px;background:${bg}"
          onmouseenter="showTLTip(event,'${mlabel}','${escaped}')"
          onmouseleave="hideTLTip()"></div>`;
      } else {
        html += `<div class="tl-cell-empty" style="width:${cellSize}px;height:${cellSize}px"></div>`;
      }
    }
    html += "</div>";
  });
  html += "</div></div>";

  document.getElementById("tl-heatmap-legend").innerHTML =
    '<span style="margin-right:4px">Less</span>' +
    ["#1a2a1a", "#1a3d26", "#1e5c30", "#c8901a", "#d4a843"]
      .map(
        (c) =>
          `<div style="width:14px;height:14px;background:${c};border-radius:2px"></div>`,
      )
      .join("") +
    '<span style="margin-left:4px">More</span>';

  container.innerHTML = html;
}

function showTLTip(e, label, val) {
  const tt = document.getElementById("tl-tooltip");
  if (!tt) return;
  tt.innerHTML = `<strong>${label}</strong>Invested: ${val}`;
  tt.style.display = "block";
  tt.style.left = e.pageX + 12 + "px";
  tt.style.top = e.pageY - 10 + "px";
}
function hideTLTip() {
  const tt = document.getElementById("tl-tooltip");
  if (tt) tt.style.display = "none";
}
function setTLYear(y) {
  tlYearFilter = y;
  renderTimeline();
}
