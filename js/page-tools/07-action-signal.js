// ── Portfolio Action Signal ───────────────────────────────────
async function renderSignal() {
  const k = DATA.kpis,
    today = new Date();
  const todayDay = today.getDate(),
    todayMonth = today.getMonth(),
    todayYear = today.getFullYear();
  const hasData = DATA.funds.length > 0 || DATA.stocks.length > 0;

  const signals = [];
  let urgentCount = 0,
    watchCount = 0,
    goodCount = 0;

  const sipDays = [];
  (DATA.mfLots || []).forEach((lot) => {
    if (lot.date) sipDays.push(new Date(lot.date).getDate());
  });
  const sipDayFreq = {};
  sipDays.forEach((d) => (sipDayFreq[d] = (sipDayFreq[d] || 0) + 1));
  const topSIPDay = Object.entries(sipDayFreq).sort((a, b) => b[1] - a[1])[0];
  const sipDay = topSIPDay ? parseInt(topSIPDay[0]) : null;
  const daysToSIP =
    sipDay != null
      ? sipDay >= todayDay
        ? sipDay - todayDay
        : (new Date(todayYear, todayMonth + 1, sipDay) - today) / 86400000
      : null;

  if (sipDay !== null) {
    if (daysToSIP <= 0) {
      signals.push({
        type: "urgent",
        icon: "📅",
        tag: "urgent",
        title: "SIP Due Today!",
        body: `Your usual SIP day is the ${sipDay}${ordinal(sipDay)}. Time to execute your monthly investment.`,
        metric: "Check your SIP amount",
        metricClass: "urgent",
      });
      urgentCount++;
    } else if (daysToSIP <= 3) {
      signals.push({
        type: "watch",
        icon: "⏰",
        tag: "watch",
        title: `SIP in ${Math.round(daysToSIP)} days`,
        body: `Your SIP is due on the ${sipDay}${ordinal(sipDay)}. Keep funds ready.`,
        metric: `${Math.round(daysToSIP)} day${daysToSIP > 1 ? "s" : ""} away`,
        metricClass: "watch",
      });
      watchCount++;
    } else {
      signals.push({
        type: "good",
        icon: "✅",
        tag: "good",
        title: "SIP on track",
        body: `Next SIP due in ${Math.round(daysToSIP)} days. No action needed.`,
        metric: `${Math.round(daysToSIP)} days away`,
        metricClass: "good",
      });
      goodCount++;
    }
  }

  const month1 = todayMonth + 1;
  if (month1 >= 1 && month1 <= 3) {
    const fyEnd = new Date(todayYear, 2, 31);
    const daysToFY = Math.ceil((fyEnd - today) / 86400000);
    const totalHarvestable = DATA.stocks
      .filter((s) => (s.holdDays || 0) < 365 && s.Gain < 0)
      .reduce((a, s) => a + Math.abs(s.Gain || 0), 0);
    if (totalHarvestable > 0) {
      signals.push({
        type: "urgent",
        icon: "🧾",
        tag: "urgent",
        title: "Tax Harvesting Window Open",
        body: `FY ends in ${daysToFY} days. STCG losses can offset gains before March 31.`,
        metric: `${fmtL(totalHarvestable)} harvestable`,
        metricClass: "urgent",
      });
      urgentCount++;
    } else {
      signals.push({
        type: "watch",
        icon: "📆",
        tag: "watch",
        title: `FY ends in ${daysToFY} days`,
        body: `March 31 deadline approaching. Review LTCG — ₹1.25L is tax-free.`,
        metric: `${daysToFY} days to FY end`,
        metricClass: "watch",
      });
      watchCount++;
    }
  }

  const deepLosers = DATA.stocks.filter((s) => s.RetPct < -25);
  if (deepLosers.length) {
    const worst = [...deepLosers].sort((a, b) => a.RetPct - b.RetPct)[0];
    signals.push({
      type: "urgent",
      icon: "🔴",
      tag: "urgent",
      title: `${deepLosers.length} stock${deepLosers.length > 1 ? "s" : ""} down >25%`,
      body: `${esc(worst.name)} is your worst performer at ${fmtP(worst.RetPct)}.`,
      metric: `${fmtP(worst.RetPct)} worst position`,
      metricClass: "urgent",
    });
    urgentCount++;
  }

  const mfLosers = DATA.funds.filter((f) => f.Gain < 0);
  if (mfLosers.length) {
    const worstMF = [...mfLosers].sort((a, b) => a.RetPct - b.RetPct)[0];
    signals.push({
      type: "watch",
      icon: "📉",
      tag: "watch",
      title: `${mfLosers.length} MF${mfLosers.length > 1 ? "s" : ""} in the red`,
      body: `${esc(worstMF.name)} is your worst MF at ${fmtP(worstMF.RetPct)}.`,
      metric: `${fmtP(worstMF.RetPct)} worst fund`,
      metricClass: "watch",
    });
    watchCount++;
  }

  const stTotal = DATA.stocks.reduce((a, s) => a + s.Invested, 0) || 1;
  const concStocks = DATA.stocks.filter((s) => s.Invested / stTotal > 0.2);
  if (concStocks.length) {
    signals.push({
      type: "watch",
      icon: "⚖️",
      tag: "watch",
      title: "High concentration in single stock",
      body: `${concStocks.map((s) => esc(s.name)).join(", ")} each represent >20% of your stock portfolio.`,
      metric: `${concStocks.length} over-weight position${concStocks.length > 1 ? "s" : ""}`,
      metricClass: "watch",
    });
    watchCount++;
  }

  const allLotDates = [...(DATA.mfLots || []), ...(DATA.stLots || [])]
    .map((l) => new Date(l.date))
    .filter((d) => !isNaN(d));
  if (allLotDates.length) {
    const staleDays = Math.floor(
      (today - new Date(Math.max(...allLotDates))) / 86400000,
    );
    if (staleDays > 60) {
      signals.push({
        type: "watch",
        icon: "😴",
        tag: "watch",
        title: "No new investment in 60+ days",
        body: `Last investment was ${staleDays} days ago.`,
        metric: `${staleDays} days since last buy`,
        metricClass: "watch",
      });
      watchCount++;
    }
  }

  const avgCandidates = DATA.funds.filter(
    (f) => f.RetPct < -5 && f.RetPct > -25 && f.CAGR > 0,
  );
  if (avgCandidates.length)
    signals.push({
      type: "info",
      icon: "💡",
      tag: "info",
      title: `${avgCandidates.length} MF averaging opportunit${avgCandidates.length > 1 ? "ies" : "y"}`,
      body: `${esc(avgCandidates[0].name)}${avgCandidates.length > 1 ? " and others" : ""} are slightly underwater but have positive CAGR.`,
      metric: `${fmtP(avgCandidates[0].RetPct)} on ${esc(avgCandidates[0].name.split(" ")[0])}`,
      metricClass: "info",
    });

  const stars = [...DATA.funds, ...DATA.stocks].filter(
    (h) => (h.RetPct || 0) > 30,
  );
  if (stars.length) {
    const best = [...stars].sort((a, b) => b.RetPct - a.RetPct)[0];
    signals.push({
      type: "good",
      icon: "🌟",
      tag: "good",
      title: `${stars.length} holding${stars.length > 1 ? "s" : ""} up >30%`,
      body: `${esc(best.name)} is your star at ${fmtP(best.RetPct)}.`,
      metric: `${fmtP(best.RetPct)} top performer`,
      metricClass: "good",
    });
    goodCount++;
  }

  if (
    hasData &&
    deepLosers.length === 0 &&
    mfLosers.length === 0 &&
    concStocks.length === 0
  ) {
    signals.push({
      type: "good",
      icon: "🏆",
      tag: "good",
      title: "Portfolio is clean & healthy",
      body: "No deep losses, no concentration risk, no MF underperformers.",
      metric: "All checks passed",
      metricClass: "good",
    });
    goodCount++;
  }

  if (!hasData)
    signals.push({
      type: "info",
      icon: "📂",
      tag: "info",
      title: "Upload your Excel files",
      body: "Go to Import Excel to load your MF and Stocks data.",
      metric: "No data yet",
      metricClass: "info",
    });

  let score = 100 - urgentCount * 20 - watchCount * 8;
  score = Math.max(0, Math.min(100, score));
  const scoreClass = score >= 70 ? "green" : score >= 40 ? "amber" : "red";
  const scoreLabel =
    score >= 70
      ? "✦ STAY THE COURSE"
      : score >= 40
        ? "⚠ ATTENTION NEEDED"
        : "🔴 ACTION REQUIRED";
  const scoreHeadline =
    score >= 70
      ? urgentCount === 0
        ? "Your portfolio needs nothing from you today."
        : "Minor items to review — no major action needed."
      : score >= 40
        ? `${urgentCount + watchCount} things need your attention this week.`
        : `${urgentCount} urgent issue${urgentCount !== 1 ? "s" : ""} require immediate attention.`;
  const scoreSubline =
    score >= 70
      ? `${goodCount} positive signal${goodCount !== 1 ? "s" : ""} detected.`
      : score >= 40
        ? `${watchCount} item${watchCount !== 1 ? "s" : ""} to monitor, ${urgentCount} urgent.`
        : "Deep losses or high risk concentration detected.";

  const hero = document.getElementById("pas-hero");
  if (hero) hero.className = `pas-hero ${scoreClass}`;
  const badge = document.getElementById("pas-badge");
  if (badge) badge.className = `pas-score-badge ${scoreClass}`;
  const scoreNum = document.getElementById("pas-score-num");
  if (scoreNum) {
    scoreNum.className = `pas-score-num ${scoreClass}`;
    scoreNum.textContent = score;
  }
  const lbl = document.getElementById("pas-signal-label");
  if (lbl) {
    lbl.className = `pas-signal-label ${scoreClass}`;
    lbl.textContent = scoreLabel;
  }
  const headlineEl = document.getElementById("pas-headline");
  if (headlineEl) headlineEl.textContent = scoreHeadline;
  const sublineEl = document.getElementById("pas-subline");
  if (sublineEl) sublineEl.textContent = scoreSubline;

  const fyQ =
    month1 >= 4 && month1 <= 6
      ? "Q1"
      : month1 >= 7 && month1 <= 9
        ? "Q2"
        : month1 >= 10 && month1 <= 12
          ? "Q3"
          : "Q4";
  const seasonMap = {
    1: "Tax Season",
    2: "Tax Season",
    3: "FY-End Rush",
    4: "New FY",
    5: "Early Bull",
    6: "Monsoon Dip",
    7: "Earnings Season",
    8: "Earnings Season",
    9: "Sept Effect",
    10: "Festive Rally",
    11: "Festive Rally",
    12: "Year-End",
  };

  const moodStrip = document.getElementById("pas-mood-strip");
  if (moodStrip) {
    moodStrip.innerHTML = "";
    [
      {
        icon: "📅",
        label: "Today",
        val: today.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      },
      { icon: "🗓", label: "FY Quarter", val: fyQ },
      {
        icon: "🌦",
        label: "Market Season",
        val: seasonMap[month1] || "Active",
      },
      {
        icon: "📊",
        label: "Holdings tracked",
        val: `${DATA.funds.length} MFs · ${DATA.stocks.length} Stocks`,
      },
      { icon: "💰", label: "Portfolio value", val: fmtL(k.totalValue || 0) },
    ].forEach((m) => {
      const item = document.createElement("div");
      item.className = "pas-mood-item";
      const icon = document.createElement("div");
      icon.className = "pas-mood-icon";
      icon.textContent = m.icon;
      const inner = document.createElement("div");
      const lbl2 = document.createElement("div");
      lbl2.className = "pas-mood-label";
      lbl2.textContent = m.label;
      const val = document.createElement("div");
      val.className = "pas-mood-val";
      val.textContent = m.val;
      inner.append(lbl2, val);
      item.append(icon, inner);
      moodStrip.appendChild(item);
    });
  }

  let calHTML = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dd = d.getDate(),
      dm = d.getMonth() + 1;
    const isToday = i === 0,
      isSIPDay = sipDay !== null && dd === sipDay;
    const isFYEnd = dm === 3 && dd === 31,
      isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let cls2 = "pas-cal-day";
    if (isToday) cls2 += " today";
    else if (isFYEnd) cls2 += " fy-alert";
    else if (isSIPDay) cls2 += " has-sip";
    const dotColor = isWeekend
      ? "var(--muted2)"
      : isSIPDay
        ? "var(--blue)"
        : isFYEnd
          ? "var(--red)"
          : "transparent";
    const dayNote = isToday
      ? "Today"
      : isWeekend
        ? "Weekend"
        : isSIPDay
          ? "SIP Day"
          : isFYEnd
            ? "FY End"
            : d.toLocaleDateString("en-IN", { weekday: "short" });
    calHTML += `<div class="${cls2}"><div class="pas-cal-day-num" style="color:${isToday ? "var(--gold)" : isSIPDay ? "var(--blue)" : isFYEnd ? "var(--red)" : "var(--text)"}">${dd}</div><div class="pas-cal-day-label">${esc(dayNote)}</div><div class="pas-cal-day-dot" style="background:${dotColor}"></div></div>`;
  }
  const calEl = document.getElementById("pas-calendar");
  if (calEl) calEl.innerHTML = calHTML;

  const urgentFirst = [...signals].sort((a, b) => {
    const o = { urgent: 0, watch: 1, good: 2, info: 3 };
    return (o[a.type] || 3) - (o[b.type] || 3);
  });
  const actionCountEl = document.getElementById("pas-action-count");
  if (actionCountEl)
    actionCountEl.textContent = `${urgentCount} urgent · ${watchCount} watch · ${goodCount} good`;
  const gridEl = document.getElementById("pas-action-grid");
  if (gridEl)
    gridEl.innerHTML = urgentFirst
      .map(
        (s) =>
          `<div class="pas-action-card ${s.type}">
      <div class="pas-card-header"><span class="pas-card-icon">${s.icon}</span><span class="pas-card-tag ${s.tag}">${esc(s.tag.toUpperCase())}</span></div>
      <div class="pas-card-title">${esc(s.title)}</div>
      <div class="pas-card-body">${s.body}</div>
      <div class="pas-card-metric ${s.metricClass}">${esc(s.metric)}</div>
    </div>`,
      )
      .join("");

  const weekKey = "pas-checklist-week-" + getWeekNumber(today);
  let checked = {};
  try {
    const raw = await PortFinDB.get(weekKey);
    checked = raw ? JSON.parse(raw) : {};
  } catch (_) {}

  const checklist = [
    {
      id: "sip",
      title: "Confirm SIPs executed this month",
      desc: "Check your bank statement or broker app to confirm all SIP debits went through.",
    },
    {
      id: "news",
      title: "Skim portfolio-related news (10 min)",
      desc: "Check if any holdings have major news: results, management change, order wins.",
    },
    {
      id: "drift",
      title: "Check portfolio allocation drift",
      desc: "Open the Rebalancer tab and see if any asset class has drifted more than 5%.",
    },
    {
      id: "loss",
      title: "Review your deepest loss positions",
      desc: "Look at your worst performers. Are you holding for a reason, or out of hope?",
    },
    {
      id: "goal",
      title: "Check goal progress",
      desc: "Open Goal Planner and see if your corpus is on track.",
    },
    {
      id: "tax",
      title: "Note any LTCG approaching 1-year mark",
      desc: "Holdings near the 1-year mark cross from STCG (20%) to LTCG (12.5%) tax.",
    },
    {
      id: "cash",
      title: "Check if you have idle cash to deploy",
      desc: "If any SIP was missed or you received a bonus, deploy into underweight buckets.",
    },
  ];

  const checklistEl = document.getElementById("pas-checklist");
  if (checklistEl) {
    checklistEl.innerHTML = "";
    checklist.forEach((item) => {
      const row = document.createElement("div");
      row.className = "pas-check-row" + (checked[item.id] ? " checked" : "");
      const box = document.createElement("div");
      box.className = "pas-check-box" + (checked[item.id] ? " done" : "");
      if (checked[item.id]) {
        const tick = document.createElement("span");
        tick.style.cssText = "color:#fff;font-size:11px";
        tick.textContent = "✓";
        box.appendChild(tick);
      }
      const txt = document.createElement("div");
      txt.className = "pas-check-text";
      const title2 = document.createElement("div");
      title2.className = "pas-check-title";
      title2.textContent = item.title;
      const desc2 = document.createElement("div");
      desc2.className = "pas-check-desc";
      desc2.textContent = item.desc;
      txt.append(title2, desc2);
      row.append(box, txt);
      row.addEventListener("click", () =>
        togglePasCheck(weekKey, item.id, row),
      );
      checklistEl.appendChild(row);
    });
  }
}

async function togglePasCheck(weekKey, id, row) {
  let checked = {};
  try {
    const raw = await PortFinDB.get(weekKey);
    checked = raw ? JSON.parse(raw) : {};
  } catch (_) {}
  checked[id] = !checked[id];
  try {
    await PortFinDB.set(weekKey, JSON.stringify(checked));
  } catch (e) {
    console.warn("PortFin: could not persist checklist state", e);
  }
  const box = row.querySelector(".pas-check-box");
  if (checked[id]) {
    row.classList.add("checked");
    box.classList.add("done");
    box.innerHTML = '<span style="color:#fff;font-size:11px">✓</span>';
  } else {
    row.classList.remove("checked");
    box.classList.remove("done");
    box.innerHTML = "";
  }
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + "th";
  return n + (["th", "st", "nd", "rd"][n % 10] || "th");
}
function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
}