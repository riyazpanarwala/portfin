// ── MF drill HTML ─────────────────────────────────────────────
function buildMFDrillHTML(f) {
    if (!f.rawLots || !f.rawLots.length)
        return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

    const lots = [...f.rawLots].filter(l => l.date && !isNaN(new Date(l.date))).sort((a, b) => a.date - b.date);
    const drillId = 'mf-drill-' + Math.random().toString(36).slice(2, 8);

    let fundXirr = null;
    try {
        const cfAmounts = [], cfDates = [];
        lots.forEach(l => { if (l.date && l.amt > 0) { cfAmounts.push(-l.amt); cfDates.push(new Date(l.date)); } });
        const currentValue = f.Current || f.Invested + (f.Gain || 0);
        if (currentValue > 0 && cfAmounts.length) { cfAmounts.push(currentValue); cfDates.push(new Date()); fundXirr = calcXIRR(cfAmounts, cfDates); }
    } catch (_) { }

    const xirrColor = fundXirr === null ? 'var(--muted)' : fundXirr >= 15 ? 'var(--green)' : fundXirr >= 8 ? 'var(--gold)' : 'var(--red)';
    const xirrDisplay = fundXirr !== null ? `<span style="color:${xirrColor};font-weight:600">${fundXirr >= 0 ? '+' : ''}${fundXirr.toFixed(2)}%</span>` : '<span style="color:var(--muted)">—</span>';

    let totalAmt = 0, totalGain = 0;
    const rows = lots.map(l => {
        const days = Math.floor((Date.now() - l.date.getTime()) / (24 * 3600 * 1000));
        const holdStr = fmtHoldPeriod(days);
        const taxTag = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
        const lotGainPct = l.amt > 0 ? ((l.gain / l.amt) * 100).toFixed(2) : '0.00';
        const lotCls = l.gain >= 0 ? 'td-up' : 'td-dn';
        let lotXirr = null;
        try {
            if (l.date && l.amt > 0 && days > 7) {
                const lotCurVal = l.cur || l.amt + (l.gain || 0);
                if (lotCurVal > 0) lotXirr = calcXIRR([-l.amt, lotCurVal], [new Date(l.date), new Date()]);
            }
        } catch (_) { }
        const lotXirrColor = lotXirr === null ? 'var(--muted)' : lotXirr >= 15 ? 'var(--green)' : lotXirr >= 8 ? 'var(--gold)' : 'var(--red)';
        totalAmt += l.amt || 0;
        totalGain += l.gain || 0;
        return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${l.qty > 0 ? l.qty.toFixed(3) : '—'}</td>
      <td>${fmtL(l.amt)}</td>
      <td class="${lotCls}">${fmtL(l.gain)}</td>
      <td class="${lotCls}">${l.amt > 0 ? (l.gain >= 0 ? '+' : '') + lotGainPct + '%' : '—'}</td>
      <td style="color:${lotXirrColor};font-weight:${lotXirr !== null ? '600' : '400'}">${lotXirr !== null ? (lotXirr >= 0 ? '+' : '') + lotXirr.toFixed(2) + '%' : '—'}</td>
      <td>${holdStr}</td><td>${taxTag}</td>
    </tr>`;
    }).join('');

    const totalRetPct = totalAmt > 0 ? ((totalGain / totalAmt) * 100).toFixed(2) : '0.00';
    const totCls = totalGain >= 0 ? 'td-up' : 'td-dn';
    const footer = `<tr style="background:var(--bg3)">
    <td style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Total · ${lots.length} lot${lots.length !== 1 ? 's' : ''}</td>
    <td></td><td></td>
    <td style="font-weight:600">${fmtL(totalAmt)}</td>
    <td class="${totCls}" style="font-weight:600">${fmtL(totalGain)}</td>
    <td class="${totCls}" style="font-weight:600">${totalAmt > 0 ? (totalGain >= 0 ? '+' : '') + totalRetPct + '%' : '—'}</td>
    <td style="color:${xirrColor};font-weight:700">${xirrDisplay}</td>
    <td colspan="2" style="color:var(--muted2);font-size:10px">← fund XIRR</td>
  </tr>`;

    const lotTableHTML = `<table class="drill-table">
    <thead><tr><th>Buy date</th><th>Buy NAV</th><th>Units</th><th>Invested</th><th>Gain / Loss</th><th>Return %</th><th title="Money-weighted annualised return for this lot">XIRR</th><th>Holding</th><th>Tax</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${footer}</tfoot></table>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">XIRR = money-weighted return — accounts for exact timing of each purchase.</div>`;

    const monthlyHTML = buildMonthlyBreakupHTML(lots, 'mf');
    const tabBar = buildDrillTabBar(drillId, [{ id: 'lots', label: '📋 Lot-wise breakup' }, { id: 'monthly', label: '📅 Monthly breakup' }]);

    return buildXirrBadge(fundXirr, f.CAGR, 'Fund XIRR') + tabBar +
        `<div id="${drillId}">
      <div id="${drillId}-lots" class="drill-tab-panel">${lotTableHTML}</div>
      <div id="${drillId}-monthly" class="drill-tab-panel" style="display:none">${monthlyHTML}</div>
    </div>`;
}

// ── Stock drill HTML ──────────────────────────────────────────
function buildSTDrillHTML(s) {
    if (!s.rawLots || !s.rawLots.length)
        return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

    const lots = [...s.rawLots].filter(l => l.date && !isNaN(new Date(l.date))).sort((a, b) => a.date - b.date);
    const cmp = s.Latest_Price || 0;
    const drillId = 'st-drill-' + Math.random().toString(36).slice(2, 8);

    let stockXirr = null;
    try {
        const cfAmounts = [], cfDates = [];
        lots.forEach(l => { if (l.date && l.inv > 0) { cfAmounts.push(-l.inv); cfDates.push(new Date(l.date)); } });
        const terminalValue = cmp > 0 && s.Qty > 0 ? cmp * s.Qty
            : lots.reduce((a, l) => { const cv = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0); return a + cv; }, 0);
        if (terminalValue > 0 && cfAmounts.length) { cfAmounts.push(terminalValue); cfDates.push(new Date()); stockXirr = calcXIRR(cfAmounts, cfDates); }
    } catch (_) { }

    const sXirrColor = stockXirr === null ? 'var(--muted)' : stockXirr >= 15 ? 'var(--green)' : stockXirr >= 8 ? 'var(--gold)' : 'var(--red)';
    const xirrDisplay = stockXirr !== null ? `<span style="color:${sXirrColor};font-weight:700">${stockXirr >= 0 ? '+' : ''}${stockXirr.toFixed(2)}%</span>` : '<span style="color:var(--muted)">—</span>';

    const rows = lots.map(l => {
        const days = Math.floor((Date.now() - l.date.getTime()) / (24 * 3600 * 1000));
        const holdStr = fmtHoldPeriod(days);
        const taxTag = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
        const curVal = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0);
        const lotGain = curVal - l.inv;
        const lotPct = l.inv > 0 ? ((lotGain / l.inv) * 100).toFixed(2) : '0.00';
        const lotCls = lotGain >= 0 ? 'td-up' : 'td-dn';
        let lotXirr = null;
        try { if (l.date && l.inv > 0 && days > 7 && curVal > 0) lotXirr = calcXIRR([-l.inv, curVal], [new Date(l.date), new Date()]); } catch (_) { }
        const lotXirrColor = lotXirr === null ? 'var(--muted)' : lotXirr >= 15 ? 'var(--green)' : lotXirr >= 8 ? 'var(--gold)' : 'var(--red)';
        return `<tr>
      <td>${fmtDate(l.date)}</td><td>${l.qty > 0 ? fmtN(l.qty) : '—'}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${cmp > 0 ? '₹' + cmp.toFixed(2) : '—'}</td>
      <td>${fmtL(l.inv)}</td><td style="font-weight:500">${fmtL(curVal)}</td>
      <td class="${lotCls}">${fmtL(lotGain)}</td>
      <td class="${lotCls}">${l.inv > 0 ? (lotGain >= 0 ? '+' : '') + lotPct + '%' : '—'}</td>
      <td style="color:${lotXirrColor};font-weight:${lotXirr !== null ? '600' : '400'}">${lotXirr !== null ? (lotXirr >= 0 ? '+' : '') + lotXirr.toFixed(2) + '%' : '—'}</td>
      <td>${holdStr}</td><td>${taxTag}</td>
    </tr>`;
    }).join('');

    const totalInv = lots.reduce((a, l) => a + (l.inv || 0), 0);
    const totalCurVal = lots.reduce((a, l) => { const cv = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0); return a + cv; }, 0);
    const totalGainAmt = totalCurVal - totalInv;
    const totalRetPct = totalInv > 0 ? ((totalGainAmt / totalInv) * 100).toFixed(2) : '0.00';
    const totCls = totalGainAmt >= 0 ? 'td-up' : 'td-dn';

    const footer = `<tr style="background:var(--bg3)">
    <td style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Total · ${lots.length} lot${lots.length !== 1 ? 's' : ''}</td>
    <td></td><td></td><td></td>
    <td style="font-weight:600">${fmtL(totalInv)}</td>
    <td style="font-weight:600">${fmtL(totalCurVal)}</td>
    <td class="${totCls}" style="font-weight:600">${fmtL(totalGainAmt)}</td>
    <td class="${totCls}" style="font-weight:600">${totalInv > 0 ? (totalGainAmt >= 0 ? '+' : '') + totalRetPct + '%' : '—'}</td>
    <td style="color:${sXirrColor};font-weight:700">${xirrDisplay}</td>
    <td colspan="2" style="color:var(--muted2);font-size:10px">← stock XIRR</td>
  </tr>`;

    const lotsForMonthly = lots.map(l => {
        const curVal = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0);
        return { ...l, gain: curVal - l.inv };
    });

    const lotTableHTML = `<table class="drill-table">
    <thead><tr><th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th><th>Invested</th><th>Cur. Value</th><th>P&amp;L</th><th>Return %</th><th title="Money-weighted annualised return for this lot">XIRR</th><th>Holding</th><th>Tax</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${footer}</tfoot></table>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">XIRR = money-weighted return — accounts for exact timing of each purchase.</div>`;

    const monthlyHTML = buildMonthlyBreakupHTML(lotsForMonthly, 'st');
    const tabBar = buildDrillTabBar(drillId, [{ id: 'lots', label: '📋 Lot-wise breakup' }, { id: 'monthly', label: '📅 Monthly breakup' }]);

    return buildXirrBadge(stockXirr, s.CAGR, 'Stock XIRR') + tabBar +
        `<div id="${drillId}">
      <div id="${drillId}-lots" class="drill-tab-panel">${lotTableHTML}</div>
      <div id="${drillId}-monthly" class="drill-tab-panel" style="display:none">${monthlyHTML}</div>
    </div>`;
}

// ── Monthly breakup (shared MF / Stocks drill-down) ───────────
function buildMonthlyBreakupHTML(lots, type) {
    const monthMap = {};
    lots.forEach(l => {
        if (!l.date) return;
        const d = new Date(l.date);
        if (isNaN(d)) return;
        const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!monthMap[mk]) monthMap[mk] = { invested: 0, gain: 0, lots: 0, units: 0 };
        const invested = type === 'mf' ? l.amt || 0 : l.inv || 0;
        monthMap[mk].invested += invested;
        monthMap[mk].gain += l.gain || 0;
        monthMap[mk].lots += 1;
        monthMap[mk].units += l.qty || 0;
    });
    const months = Object.entries(monthMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mk, v]) => ({ mk, ...v, retPct: v.invested > 0 ? (v.gain / v.invested) * 100 : 0 }));

    if (!months.length) return '<div style="color:var(--muted);font-size:11px;padding:10px">No monthly data available</div>';

    const totalInvested = months.reduce((a, m) => a + m.invested, 0);
    const totalGain = months.reduce((a, m) => a + m.gain, 0);
    const maxInvested = Math.max(...months.map(m => m.invested), 1);

    const yearMap = {};
    months.forEach(m => {
        const y = m.mk.slice(0, 4);
        if (!yearMap[y]) yearMap[y] = { invested: 0, gain: 0, lots: 0 };
        yearMap[y].invested += m.invested;
        yearMap[y].gain += m.gain;
        yearMap[y].lots += m.lots;
    });

    const yearKpis = Object.entries(yearMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([y, yv]) => {
            const retPct = yv.invested > 0 ? (yv.gain / yv.invested) * 100 : 0;
            const retColor = retPct >= 0 ? 'var(--green)' : 'var(--red)';
            return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;min-width:100px;flex-shrink:0">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">${esc(y)}</div>
        <div style="font-family:var(--sans);font-size:15px;font-weight:700;color:var(--gold)">${fmtL(yv.invested)}</div>
        <div style="font-size:10px;color:${retColor};margin-top:2px">${retPct >= 0 ? '+' : ''}${retPct.toFixed(1)}% · ${yv.lots} lot${yv.lots !== 1 ? 's' : ''}</div>
      </div>`;
        }).join('');

    const monthRows = months.map(m => {
        const [y, mo] = m.mk.split('-');
        const monthName = MONTH_NAMES[parseInt(mo) - 1] + ' ' + y;
        const barWidth = Math.round((m.invested / maxInvested) * 100);
        const retColor = m.retPct >= 0 ? 'var(--green)' : 'var(--red)';
        const gainCls = m.gain >= 0 ? 'td-up' : 'td-dn';
        const unitsCol = type === 'mf'
            ? `<td style="font-size:11px;color:var(--muted);text-align:right">${m.units > 0 ? m.units.toFixed(3) : '—'}</td>`
            : `<td style="font-size:11px;color:var(--muted);text-align:right">${m.units > 0 ? fmtN(m.units) : '—'}</td>`;
        return `<tr>
      <td style="font-size:11px;font-weight:500;white-space:nowrap">${esc(monthName)}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;min-width:60px">
            <div style="height:100%;width:${barWidth}%;background:#58a6ff;border-radius:3px;transition:width .4s"></div>
          </div>
          <span style="font-size:11px;font-weight:500;min-width:72px;text-align:right">${fmtL(m.invested)}</span>
        </div>
      </td>
      ${unitsCol}
      <td class="${gainCls}" style="font-size:11px;text-align:right">${fmtL(m.gain)}</td>
      <td style="font-size:11px;text-align:right;color:${retColor};font-weight:500">${m.retPct >= 0 ? '+' : ''}${m.retPct.toFixed(2)}%</td>
      <td style="font-size:10px;color:var(--muted);text-align:right">${m.lots}</td>
    </tr>`;
    }).join('');

    const unitsHeader = type === 'mf' ? '<th style="text-align:right">Units</th>' : '<th style="text-align:right">Qty</th>';
    const totalRetPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const totGainCls = totalGain >= 0 ? 'td-up' : 'td-dn';
    const totalRetColor = totalRetPct >= 0 ? 'var(--green)' : 'var(--red)';

    return `
    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Year-wise summary</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${yearKpis}</div>
    </div>
    <div style="overflow-x:auto">
      <table class="drill-table" style="min-width:480px">
        <thead><tr>
          <th>Month</th><th style="min-width:160px">Invested (with bar)</th>
          ${unitsHeader}<th style="text-align:right">Gain / Loss</th>
          <th style="text-align:right">Return %</th><th style="text-align:right">Lots</th>
        </tr></thead>
        <tbody>${monthRows}</tbody>
        <tfoot>
          <tr style="background:var(--bg3)">
            <td style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600">
              Total · ${months.length} months
            </td>
            <td style="font-size:11px;font-weight:700;color:var(--gold);padding-left:8px">${fmtL(totalInvested)}</td>
            <td></td>
            <td class="${totGainCls}" style="font-size:11px;font-weight:700;text-align:right">${fmtL(totalGain)}</td>
            <td style="font-size:11px;font-weight:700;text-align:right;color:${totalRetColor}">${totalRetPct >= 0 ? '+' : ''}${totalRetPct.toFixed(2)}%</td>
            <td style="font-size:10px;color:var(--muted);text-align:right">${lots.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">
      Monthly breakup shows total capital deployed and unrealised gain per calendar month.
    </div>`;
}

// ── XIRR badge helper ─────────────────────────────────────────
function buildXirrBadge(xirr, cagr, label) {
    if (xirr === null) return '';
    const xirrColor = xirr >= 15 ? 'var(--green)' : xirr >= 8 ? 'var(--gold)' : 'var(--red)';
    const cagrDelta = xirr - (cagr || 0);
    const deltaBadge = Math.abs(cagrDelta) > 1
        ? `<span style="font-size:10px;color:var(--muted2);margin-left:6px">vs CAGR ${(cagr || 0) >= 0 ? '+' : ''}${(cagr || 0).toFixed(2)}%<span style="color:${cagrDelta > 0 ? 'var(--green)' : 'var(--red)'}">(${cagrDelta > 0 ? '+' : ''}${cagrDelta.toFixed(2)}pp)</span></span>`
        : '';
    return `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:6px 12px;margin-bottom:10px;font-size:11px">
    <span style="color:var(--muted)">${esc(label)} (money-weighted):</span>
    <span style="color:${xirrColor};font-weight:700;font-family:var(--sans);font-size:14px">${xirr >= 0 ? '+' : ''}${xirr.toFixed(2)}%</span>
    <span style="color:var(--muted2);font-size:10px">p.a.</span>${deltaBadge}
  </div>`;
}
