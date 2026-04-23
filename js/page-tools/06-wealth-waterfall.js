// ── Wealth Waterfall ──────────────────────────────────────────
function renderWaterfall() {
  const k = DATA.kpis;
  const mfInvested = k.mfInvested || 0,
    stInvested = k.stInvested || 0;
  const mfGain = k.mfGain || 0,
    stGain = k.stGain || 0;
  const startVal = k.totalInvested || 0,
    totalVal = k.totalValue || 0;

  const segments = [
    {
      id: "mf-inv",
      label: "MF Invested",
      value: mfInvested,
      type: "invested",
      color: "#58a6ff",
      sub: "Total capital deployed into mutual funds",
      subKey: "Avg SIP",
    },
    {
      id: "st-inv",
      label: "Stocks Bought",
      value: stInvested,
      type: "invested",
      color: "#a371f7",
      sub: "Total capital deployed into equity stocks",
      subKey: "Direct buys",
    },
    {
      id: "mf-gain",
      label: "MF Gains",
      value: mfGain,
      type: mfGain >= 0 ? "gain" : "loss",
      color: mfGain >= 0 ? "#3fb950" : "#f85149",
      sub: "Unrealised gains from mutual funds",
      subKey: "Return %",
    },
    {
      id: "st-gain",
      label: "Stock P&L",
      value: stGain,
      type: stGain >= 0 ? "gain" : "loss",
      color: stGain >= 0 ? "#56d364" : "#f85149",
      sub: "Unrealised P&L from equity stocks",
      subKey: "Return %",
    },
    {
      id: "total",
      label: "Current Value",
      value: totalVal,
      type: "total",
      color: "#d4a843",
      sub: "Total portfolio market value today",
      subKey: "Total gain",
    },
  ];

  // FIX Issue #13: use module-level vars declared in common.js, not window.*
  _wfSegments = segments;
  _wfTotal = totalVal;

  const wealthMultiplier =
    startVal > 0 ? (totalVal / startVal).toFixed(2) : "—";
  const gainContrib =
    totalVal > 0 ? (((mfGain + stGain) / totalVal) * 100).toFixed(1) : 0;

  document.getElementById("wf-kpis").innerHTML = renderKpiCards([
    {
      l: "Capital Deployed",
      v: fmtL(startVal),
      s: "Total invested (MF + Stocks)",
      a: "#58a6ff",
    },
    {
      l: "Total Gains",
      v: fmtL(mfGain + stGain),
      s: fmtP(k.totalReturn || 0),
      a: mfGain + stGain >= 0 ? "#3fb950" : "#f85149",
    },
    {
      l: "Current Value",
      v: fmtL(totalVal),
      s: "Portfolio today",
      a: "#d4a843",
    },
    {
      l: "Wealth Multiplier",
      v: startVal > 0 ? wealthMultiplier + "x" : "—",
      s: "₹1 invested → ₹" + wealthMultiplier,
      a: "#a371f7",
    },
    {
      l: "Gains vs Capital",
      v: gainContrib + "%",
      s: "Wealth from market returns",
      a: "#3fb950",
    },
  ]);

  document.getElementById("wf-pills").innerHTML = [
    {
      label: "MF contribution",
      val:
        totalVal > 0 ? ((mfInvested / totalVal) * 100).toFixed(0) + "%" : "—",
      color: "#58a6ff",
    },
    {
      label: "Stock contribution",
      val:
        totalVal > 0 ? ((stInvested / totalVal) * 100).toFixed(0) + "%" : "—",
      color: "#a371f7",
    },
    {
      label: "MF gains contribution",
      val:
        totalVal > 0
          ? Math.max(0, (mfGain / totalVal) * 100).toFixed(0) + "%"
          : "—",
      color: "#3fb950",
    },
    {
      label: "Stock gain contribution",
      val:
        totalVal > 0
          ? Math.max(0, (stGain / totalVal) * 100).toFixed(0) + "%"
          : "—",
      color: "#56d364",
    },
  ]
    .map(
      (p) =>
        `<div class="wf-stat-pill"><span style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0;display:inline-block"></span><div><div class="wf-stat-pill-label">${esc(p.label)}</div><div class="wf-stat-pill-val" style="color:${p.color}">${esc(p.val)}</div></div></div>`,
    )
    .join("");

  const W = 760,
    H = 340,
    padL = 70,
    padR = 30,
    padT = 36,
    padB = 60;
  const chartW = W - padL - padR,
    chartH = H - padT - padB;
  const barGap = 18,
    barW = Math.floor(
      (chartW - barGap * (segments.length - 1)) / segments.length,
    );

  const baselines = [],
    tops = [];
  let running = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.value >= 0) {
      baselines.push(running);
      tops.push(running + seg.value);
      running += seg.value;
    } else {
      baselines.push(running + seg.value);
      tops.push(running);
      running += seg.value;
    }
  }
  baselines.push(0);
  tops.push(totalVal);

  const allVals = [...baselines, ...tops];
  const dataMin = Math.min(0, ...allVals),
    dataMax = Math.max(...allVals),
    span = dataMax - dataMin || 1;
  const yScale = (v) => padT + chartH - ((v - dataMin) / span) * chartH;
  const xStart = (i) => padL + i * (barW + barGap);

  let gridLines = "";
  for (let gi = 0; gi <= 5; gi++) {
    const gv = dataMin + (span * gi) / 5,
      gy = yScale(gv);
    gridLines += `<line class="wf-grid-line" x1="${padL}" x2="${W - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"/>`;
    gridLines += `<text x="${padL - 6}" y="${gy.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--muted)" font-family="DM Mono,monospace">${fmtL(Math.round(gv))}</text>`;
  }
  const zeroY = yScale(0);
  const zeroLine = `<line class="wf-axis-line" x1="${padL}" x2="${W - padR}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke-width="1.5"/>`;

  let connectors = "";
  for (let i = 0; i < segments.length - 2; i++) {
    const x1 = xStart(i) + barW,
      x2 = xStart(i + 1);
    const lineY =
      segments[i].value >= 0 ? yScale(tops[i]) : yScale(baselines[i]);
    connectors += `<line class="wf-connector" x1="${x1}" x2="${x2}" y1="${lineY.toFixed(1)}" y2="${lineY.toFixed(1)}"/>`;
  }

  // FIX Issue #2: SVG bars now use addEventListener via post-render JS instead
  // of inline onmouseenter/onmouseleave strings, eliminating the global-fn-reference risk
  let bars = "",
    topLabels = "",
    botLabels = "";
  segments.forEach((seg, i) => {
    const x = xStart(i),
      yTop = yScale(Math.max(baselines[i], tops[i])),
      yBot = yScale(Math.min(baselines[i], tops[i]));
    const bH = Math.max(2, yBot - yTop);
    const isTotal = seg.type === "total";
    bars += `<rect ${isTotal ? 'class="wf-total-glow"' : ""} class="wf-bar-base" data-wf-idx="${i}" x="${x}" y="${yTop.toFixed(1)}" width="${barW}" height="${bH.toFixed(1)}" fill="${seg.color}" opacity="${isTotal ? "1" : "0.85"}" rx="3"/>`;
    topLabels += `<text class="wf-label-top" x="${(x + barW / 2).toFixed(1)}" y="${(yTop - 6).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${seg.color}" font-weight="600">${fmtL(Math.abs(seg.value))}</text>`;
    botLabels += `<text class="wf-label-bot" x="${(x + barW / 2).toFixed(1)}" y="${(H - padB + 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(seg.label)}</text>`;
    if (seg.type === "gain" || seg.type === "loss")
      topLabels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(yTop - 18).toFixed(1)}" text-anchor="middle" font-size="8" fill="${seg.color}">${seg.type === "gain" ? "▲" : "▼"}</text>`;
  });

  document.getElementById("wf-svg-wrap").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${gridLines}${zeroLine}${connectors}${bars}${topLabels}${botLabels}<line class="wf-axis-line" x1="${padL}" x2="${W - padR}" y1="${(H - padB).toFixed(1)}" y2="${(H - padB).toFixed(1)}"/></svg>`;

  // FIX Issue #2: attach hover events via JS, not inline SVG attributes
  document.querySelectorAll("[data-wf-idx]").forEach((el) => {
    el.addEventListener("mouseenter", (e) =>
      wfShowTip(e, parseInt(el.dataset.wfIdx)),
    );
    el.addEventListener("mouseleave", wfHideTip);
  });

  document.getElementById("wf-breakdown").innerHTML =
    '<div class="wf-breakdown-card">' +
    segments
      .map((seg) => {
        const pct =
          totalVal > 0
            ? ((Math.abs(seg.value) / totalVal) * 100).toFixed(1)
            : 0;
        const amtCls =
          seg.type === "gain"
            ? "td-up"
            : seg.type === "loss"
              ? "td-dn"
              : "td-gold";
        return `<div class="wf-bk-row"><div class="wf-bk-dot" style="background:${seg.color}"></div><div class="wf-bk-name">${esc(seg.label)}</div><div class="wf-bk-amt ${amtCls}">${seg.type === "loss" ? "−" : ""}${fmtL(Math.abs(seg.value))}</div><div class="wf-bk-pct">${pct}%</div></div>`;
      })
      .join("") +
    "</div>";

  const gainTotal = (mfGain >= 0 ? mfGain : 0) + (stGain >= 0 ? stGain : 0);
  const lossTotal =
    (mfGain < 0 ? Math.abs(mfGain) : 0) + (stGain < 0 ? Math.abs(stGain) : 0);
  const gainPct = totalVal > 0 ? ((gainTotal / totalVal) * 100).toFixed(1) : 0;
  const capPct = totalVal > 0 ? ((startVal / totalVal) * 100).toFixed(1) : 0;
  const mfRetPct =
    mfInvested > 0 ? ((mfGain / mfInvested) * 100).toFixed(1) : 0;
  const stRetPct =
    stInvested > 0 ? ((stGain / stInvested) * 100).toFixed(1) : 0;

  const insights = [];
  if (+gainPct > 0)
    insights.push({
      icon: "📈",
      text: `<b>${gainPct}%</b> of your wealth comes from market returns — your portfolio is genuinely compounding.`,
    });
  if (+capPct > 0)
    insights.push({
      icon: "💰",
      text: `<b>${capPct}%</b> is from your invested capital — the savings discipline is the foundation.`,
    });
  if (+mfRetPct > 0)
    insights.push({
      icon: "◎",
      text: `Mutual Funds returned <b>${pSign(+mfRetPct)}${mfRetPct}%</b> on invested capital of ${fmtL(mfInvested)}.`,
    });
  if (stInvested)
    insights.push({
      icon: "◐",
      text: `Equity stocks returned <b>${pSign(+stRetPct)}${stRetPct}%</b> on invested capital of ${fmtL(stInvested)}.`,
    });
  if (lossTotal > 0)
    insights.push({
      icon: "⚠",
      text: `Drag from losses: <b>−${fmtL(lossTotal)}</b> — consider reviewing losing positions.`,
    });
  if (+gainContrib > 50)
    insights.push({
      icon: "🏆",
      text: `Over half your wealth is from market gains — compounding is doing the heavy lifting!`,
    });

  document.getElementById("wf-composition").innerHTML =
    insights
      .map(
        (ins) =>
          `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:16px;flex-shrink:0">${ins.icon}</span>
      <span style="font-size:11px;color:var(--muted);line-height:1.6">${ins.text}</span>
    </div>`,
      )
      .join("") ||
    '<div style="color:var(--muted);font-size:11px;padding:10px">Upload your Excel files to see composition analysis.</div>';
}

// FIX Issue #13: reads module-level _wfSegments/_wfTotal from common.js
function wfShowTip(e, idx) {
  const seg = _wfSegments && _wfSegments[idx];
  const tt = document.getElementById("wf-tooltip");
  if (!seg || !tt) return;
  const ttTitle = document.getElementById("wf-tt-title");
  const ttAmt = document.getElementById("wf-tt-amt");
  const ttPct = document.getElementById("wf-tt-pct");
  const ttSubL = document.getElementById("wf-tt-sub-l");
  const ttSubV = document.getElementById("wf-tt-sub-v");
  if (ttTitle) ttTitle.textContent = seg.label;
  if (ttAmt)
    ttAmt.textContent = (seg.value < 0 ? "−" : "") + fmtL(Math.abs(seg.value));
  if (ttPct)
    ttPct.textContent = _wfTotal
      ? ((Math.abs(seg.value) / _wfTotal) * 100).toFixed(1) + "%"
      : "—";
  if (ttSubL) ttSubL.textContent = seg.subKey;
  if (ttSubV) {
    if (seg.subKey === "Return %") {
      const inv =
        seg.id === "mf-gain" ? DATA.kpis.mfInvested : DATA.kpis.stInvested;
      ttSubV.textContent = inv > 0 ? fmtP((seg.value / inv) * 100) : "—";
    } else if (seg.subKey === "Total gain") {
      ttSubV.textContent = fmtL(
        (DATA.kpis.mfGain || 0) + (DATA.kpis.stGain || 0),
      );
    } else {
      ttSubV.textContent = seg.sub;
      if (ttSubL) ttSubL.textContent = "";
    }
  }
  tt.style.display = "block";
  tt.style.left = e.pageX + 14 + "px";
  tt.style.top = e.pageY - 10 + "px";
}

function wfHideTip() {
  const tt = document.getElementById("wf-tooltip");
  if (tt) tt.style.display = "none";
}