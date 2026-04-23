// ── CAGR calculation ──────────────────────────────────────────
// FIX Issue #5: short holds (<6mo) now return the annualised figure
// with an `isShortHold` flag so the UI can render "~X%" instead of "0%".
// The function returns an object { value, isShortHold } when called via
// computeCAGRObj(), and a plain number via computeCAGR() for backward compat.
function computeCAGRObj(invested, current, dates) {
  if (!dates.length || !invested || invested <= 0)
    return { value: 0, isShortHold: false };
  if (current <= 0) return { value: -100, isShortHold: false };
  const earliest = dates.reduce(
    (min, d) => (d.getTime() < min ? d.getTime() : min),
    dates[0].getTime(),
  );
  const yrs = (Date.now() - earliest) / (365.25 * 24 * 3600 * 1000);
  if (yrs <= 0) return { value: 0, isShortHold: false };
  // FIX Issue #5: always compute annualised figure; flag short holds instead of zeroing
  const isShortHold = yrs < 0.5;
  const raw = (Math.pow(current / invested, 1 / yrs) - 1) * 100;
  if (!isFinite(raw)) return { value: 0, isShortHold };
  return { value: parseFloat(raw.toFixed(1)), isShortHold };
}

function computeCAGR(invested, current, dates) {
  return computeCAGRObj(invested, current, dates).value;
}

// FIX Issue #5: display helper — shows "~12.3%" for short holds with tooltip
function fmtCAGRDisplay(cagr, isShortHold) {
  if (isShortHold) {
    return `<span style="color:var(--amber)" title="Holding < 6 months — annualised figure is indicative only">~${cagr.toFixed(1)}%</span>`;
  }
  const color =
    cagr >= 12 ? "var(--green)" : cagr >= 8 ? "var(--amber)" : "var(--red)";
  return `<span style="color:${color}">${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%</span>`;
}

function parseMFRows(rows, dz, statusEl, fname) {
  const data = rows.filter((r) => {
    const s = String(r["Scheme"] || r["scheme"] || r["Fund Name"] || "").trim();
    return s && s.toUpperCase() !== "TOTAL" && !s.startsWith("*");
  });
  if (!data.length) {
    _dzError(dz, statusEl, "✗ No MF data found — check column headers");
    return;
  }

  const s0 = data[0];
  const col = (names) => names.find((n) => n in s0) || null;
  const cScheme = col(["Scheme", "scheme", "Fund Name", "SCHEME", "fund name"]);
  const cNAV = col(["Latest NAV", "NAV", "nav", "Current NAV"]);
  const cInvP = col(["Inv. Price", "Purchase Price", "Buy Price", "inv price"]);
  const cQty = col(["Quantity", "quantity", "Units", "units", "QTY"]);
  const cInvAmt = col([
    "Inv. Amt",
    "Investment Amount",
    "Invested",
    "invested",
    "Inv.Amt",
    "Inv Amount",
    "Amount",
  ]);
  const cGain = col([
    "Overall Gain",
    "Overall Gain/Loss",
    "Gain",
    "gain",
    "Total Gain",
    "P&L",
  ]);
  const cValue = col([
    "Latest Value",
    "Current Value",
    "Value",
    "value",
    "Market Value",
  ]);
  const cDate = col([
    "Inv. Date",
    "Date",
    "date",
    "Investment Date",
    "Inv Date",
    "Purchase Date",
  ]);

  if (!cScheme) {
    _dzError(dz, statusEl, "✗ Could not find Scheme column");
    return;
  }

  const map = {},
    lots = [],
    monthMap = {};
  data.forEach((r) => {
    const rawName = String(r[cScheme]).trim();
    const name = rawName
      .replace(
        /\s+(Direct Plan Growth|Direct Growth|Regular Growth|Regular Plan Growth|Growth Plan|Growth|Direct Plan|Regular Plan|Direct|Regular)\s*$/i,
        "",
      )
      .trim();
    if (!name) return;
    if (!map[name])
      map[name] = {
        name,
        Invested: 0,
        Current: 0,
        Gain: 0,
        Lots: 0,
        dates: [],
        rawLots: [],
      };
    const g = map[name];
    const inv = cleanNum(r[cInvAmt]),
      cur = cleanNum(r[cValue]),
      gn = cleanNum(r[cGain]);
    const qty = cleanNum(r[cQty] || 0),
      nav = cleanNum(r[cNAV] || 0),
      invPrice = cleanNum(r[cInvP] || 0);
    const dt = cDate ? parseInvDate(r[cDate]) : null;
    g.Invested += inv;
    g.Current += cur;
    g.Gain += gn;
    g.Lots++;
    if (dt && !isNaN(dt)) g.dates.push(dt);
    if (dt && !isNaN(dt) && inv > 0) {
      g.rawLots.push({
        date: dt,
        amt: inv,
        qty,
        invPrice,
        nav,
        cur: inv + cleanNum(r[cGain] || 0),
        gain: gn,
      });
      lots.push({ amt: inv, date: dt });
      const mk =
        dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
      monthMap[mk] = (monthMap[mk] || 0) + inv;
    }
  });

  const catKw = (n) => {
    const l = n.toLowerCase();
    return l.includes("elss") || l.includes("tax saver")
      ? "ELSS"
      : l.includes("small cap") || l.includes("smallcap")
        ? "Small Cap"
        : l.includes("mid cap") || l.includes("midcap")
          ? "Mid Cap"
          : l.includes("large cap") || l.includes("largecap")
            ? "Large Cap"
            : l.includes("flexi") || l.includes("multi cap")
              ? "Flexi Cap"
              : l.includes("value") || l.includes("contra")
                ? "Value"
                : l.includes("index") ||
                    l.includes("nifty") ||
                    l.includes("sensex")
                  ? "Index"
                  : "Other";
  };

  const funds = Object.values(map)
    .filter((f) => f.Invested > 0 || f.Current > 0)
    .map((f) => {
      const cagrObj = computeCAGRObj(f.Invested, f.Current, f.dates);
      f.RetPct =
        f.Invested > 0
          ? parseFloat(((f.Gain / f.Invested) * 100).toFixed(1))
          : 0;
      f.CAGR = cagrObj.value;
      f.cagrShort = cagrObj.isShortHold; // FIX Issue #5: store flag for display
      f.Gain = Math.round(f.Gain);
      f.Category = catKw(f.name);
      f.holdDays = f.dates.length
        ? Math.floor(
            (Date.now() -
              f.dates.reduce(
                (min, d) => (d.getTime() < min ? d.getTime() : min),
                f.dates[0].getTime(),
              )) /
              (24 * 3600 * 1000),
          )
        : 0;
      return f;
    });

  if (!funds.length) {
    _dzError(dz, statusEl, "✗ No valid fund rows found");
    return;
  }

  const monthlyMF = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([m, v]) => ({ m, v: Math.round(v) }));
  const allDates = lots.map((l) => l.date).filter(Boolean);
  const earliestMF = allDates.length
    ? new Date(
        allDates.reduce(
          (min, d) => (d.getTime() < min ? d.getTime() : min),
          allDates[0].getTime(),
        ),
      )
    : null;

  pendingMF = { funds, lots, monthlyMF, earliestMF };
  _dzSuccess(
    dz,
    statusEl,
    `✓ ${fname} — ${funds.length} funds, ${lots.length} lots`,
  );
  tryApplyData();
}

function parseSTRows(rows, dz, statusEl, fname) {
  const data = rows.filter((r) => {
    const s = String(
      r["Stock"] || r["stock"] || r["Symbol"] || r["Company"] || "",
    ).trim();
    return s && s.toUpperCase() !== "TOTAL" && !s.startsWith("*");
  });
  if (!data.length) {
    _dzError(dz, statusEl, "✗ No stock data found — check column headers");
    return;
  }

  const s0 = data[0];
  const col = (names) => names.find((n) => n in s0) || null;
  const cStock = col(["Stock", "stock", "Symbol", "Company", "Scrip"]);
  const cPrice = col([
    "Latest Price",
    "CMP",
    "Price",
    "price",
    "LTP",
    "Last Price",
  ]);
  const cQty = col(["Quantity", "quantity", "Qty", "qty", "Units", "Shares"]);
  const cInvP = col([
    "Inv. Price",
    "Buy Price",
    "Purchase Price",
    "Avg Price",
    "avg price",
  ]);
  const cInvAmt = col([
    "Inv. Amt",
    "Investment Amount",
    "Invested",
    "invested",
    "Inv Amount",
    "Inv.Amt",
    "Amount",
  ]);
  const cGain = col([
    "Overall Gain",
    "Gain",
    "gain",
    "Overall Gain/Loss",
    "P&L",
    "Profit/Loss",
  ]);
  const cValue = col([
    "Latest Value",
    "Current Value",
    "Value",
    "value",
    "Market Value",
    "Present Value",
  ]);
  const cDate = col(["Inv. Date", "Date", "date", "Purchase Date", "Buy Date"]);

  if (!cStock) {
    _dzError(dz, statusEl, "✗ Could not find Stock column");
    return;
  }

  // FIX Issue #6: SECTOR_MAP now uses anchored patterns to prevent partial matches.
  // Each key is tested as: new RegExp(`(^|\\s|-)${key}($|\\s|-)`, 'i')
  // so "adani" won't match "adanigreen" and "sbi" won't match "sbin" accidentally.
  // Patterns that are already specific substrings (like 'bharat elec') work fine
  // with looser matching; only single short tokens need anchoring.
  const SECTOR_MAP = [
    // [pattern, sector]  — patterns are tested as full word matches
    [/\bbpcl\b/, "Energy/PSU"],
    [/bharat\s+elec/, "Defence"],
    [/\bcoal\s+india\b/, "Energy/PSU"],
    [/\benbee\b/, "Speculative"],
    [/\birfc\b/, "Finance/PSU"],
    [/\bitc\b/, "FMCG"],
    [/jaiprakash/, "Speculative"],
    [/mo\s+defence/, "Defence"],
    [/motilal.*defence/, "Defence"],
    [/\bmazagon\b/, "Defence"],
    [/\bnbcc\b/, "Infra/PSU"],
    [/\bnhpc\b/, "Energy/PSU"],
    [/nipp.*nifty|nippon.*nifty/, "Index ETF"],
    [/\bongc\b/, "Energy/PSU"],
    [/reliance\s+power/, "Speculative"],
    [/\bsuzlon\b/, "Renewables"],
    [/tata\s+silver/, "Commodities ETF"],
    [/uti\s+nifty/, "Index ETF"],
    [/\bvedanta\b/, "Metals/Mining"],
    [/\byes\s+bank\b/, "Banking"],
    [/uttam\s+value/, "Speculative"],
    [/hindustan\s+zinc/, "Metals/Mining"],
    // FIX Issue #6: "adani" pattern was too broad — now requires word boundary
    // so "adani enterprises", "adani green", "adani ports" all match but
    // unrelated names containing "adani" as a substring do not
    [
      /\badani\s+(enterprises|green|ports|power|total|trans|wilmar)/i,
      "Speculative",
    ],
    [/\bzomato\b/, "Consumer Tech"],
    [/\bbse\b/, "Finance"],
    [/\bnse\b/, "Finance"],
    [/\bhdfc\s+bank\b|\bhdfc\s+ltd\b/, "Banking"],
    [/\bicici\s+bank\b/, "Banking"],
    [/\bsbi\b|\bstate\s+bank/, "Banking"],
    [/\baxis\s+bank\b/, "Banking"],
    [/\bkotak\s+(bank|mahindra\s+bank)\b/, "Banking"],
    [/tata\s+steel/, "Metals/Mining"],
    [/jsw\s+steel/, "Metals/Mining"],
    [/\bntpc\b/, "Energy/PSU"],
    [/power\s+grid/, "Energy/PSU"],
    [/\bbhel\b/, "Infra/PSU"],
    [/\bl&t\b|larsen/, "Infra/PSU"],
    [/\bsiemens\b/, "Infra/PSU"],
    [/\binfosys\b/, "IT"],
    [/\btcs\b|tata\s+consultancy/, "IT"],
    [/\bwipro\b/, "IT"],
    [/\bhcl\s+tech/, "IT"],
    [/tech\s+mahindra/, "IT"],
    [/bajaj\s+finance/, "Finance/PSU"],
    [/\bmuthoot\b/, "Finance/PSU"],
  ];

  const _unclassified = [];
  const getSector = (name) => {
    const n = name.toLowerCase();
    for (const [pattern, sector] of SECTOR_MAP) {
      if (pattern.test(n)) return sector;
    }
    _unclassified.push(name);
    return "Other";
  };

  const map = {},
    lots = [];
  data.forEach((r) => {
    const rawName = String(r[cStock]).trim();
    const name = rawName
      .replace(/\s*-\s*(NSE|BSE)\s*-.*/i, "")
      .replace(/\s*-\s*(NSE|BSE)\s*$/i, "")
      .trim();
    if (!name) return;
    const lp = cleanNum(r[cPrice]),
      qty = cleanNum(r[cQty]);
    const inv = cleanNum(r[cInvAmt]),
      cur = cleanNum(r[cValue]),
      gn = cleanNum(r[cGain]);
    const invP = cInvP ? cleanNum(r[cInvP]) : 0;
    const dt = cDate ? parseInvDate(r[cDate]) : null;
    if (!map[name])
      map[name] = {
        name,
        Qty: 0,
        Invested: 0,
        Current: 0,
        Gain: 0,
        Latest_Price: 0,
        dates: [],
        rawLots: [],
      };
    const g = map[name];
    g.Qty += qty;
    g.Invested += inv;
    g.Current += cur;
    g.Gain += gn;
    if (lp > 0) g.Latest_Price = lp;
    if (dt && !isNaN(dt)) g.dates.push(dt);
    if (dt && !isNaN(dt) && inv > 0) {
      g.rawLots.push({
        date: dt,
        qty,
        invPrice: invP || (qty ? inv / qty : 0),
        currentPrice: lp,
        inv,
        gain: gn,
        cur: cur || 0,
      });
      lots.push({ amt: inv, date: dt });
    }
  });

  const stocks = Object.values(map)
    .filter((s) => s.Invested > 0 || s.Current > 0)
    .map((s) => {
      const cagrObj = computeCAGRObj(s.Invested, s.Current, s.dates);
      s.RetPct =
        s.Invested > 0
          ? parseFloat(((s.Gain / s.Invested) * 100).toFixed(1))
          : 0;
      s.CAGR = cagrObj.value;
      s.cagrShort = cagrObj.isShortHold; // FIX Issue #5
      s.Gain = Math.round(s.Gain);
      s.Sector = getSector(s.name);
      s.holdDays = s.dates.length
        ? Math.floor(
            (Date.now() -
              s.dates.reduce(
                (min, d) => (d.getTime() < min ? d.getTime() : min),
                s.dates[0].getTime(),
              )) /
              (24 * 3600 * 1000),
          )
        : 0;
      return s;
    });

  if (!stocks.length) {
    _dzError(dz, statusEl, "✗ No valid stock rows found");
    return;
  }

  const allDates = lots.map((l) => l.date).filter(Boolean);
  const earliestST = allDates.length
    ? new Date(
        allDates.reduce(
          (min, d) => (d.getTime() < min ? d.getTime() : min),
          allDates[0].getTime(),
        ),
      )
    : null;
  pendingST = { stocks, lots, earliestST };

  const uniq = [...new Set(_unclassified)];
  let msg = `✓ ${fname} — ${stocks.length} stocks, ${lots.length} lots`;
  if (uniq.length)
    msg += ` · ⚠ ${uniq.length} stock(s) auto-mapped to "Other" sector (${uniq.slice(0, 3).join(", ")}${uniq.length > 3 ? "…" : ""})`;
  _dzSuccess(dz, statusEl, msg);
  tryApplyData();
}

// ── Drop-zone helpers ─────────────────────────────────────────
function _dzError(dz, statusEl, msg) {
  if (statusEl) statusEl.textContent = msg;
  if (dz) {
    dz.style.borderColor = "var(--red)";
    dz.style.color = "var(--red)";
  }
}
function _dzSuccess(dz, statusEl, msg) {
  if (statusEl) statusEl.textContent = msg;
  if (dz) {
    dz.style.borderColor = "var(--green)";
    dz.style.color = "var(--green)";
  }
}