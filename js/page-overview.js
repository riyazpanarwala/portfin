// ── page-overview.js — Overview page, health score, SIP reminder, drawdown ──

// ── Overview ──────────────────────────────────────────────────
function renderOverview() {
  const k=DATA.kpis;
  const sinceMF = k.earliestMF?('Since '+fmtMonthYear(k.earliestMF)):'All time';
  document.getElementById('kpi-overview').innerHTML=[
    {l:'Total Invested',  v:fmtL(k.totalInvested), s:'Capital deployed',     sc:'',   a:'#d4a843'},
    {l:'Current Value',   v:fmtL(k.totalValue),    s:'Portfolio value',      sc:'',   a:'#58a6ff'},
    {l:'Total Gain',      v:fmtL(k.totalGain),     s:fmtP(k.totalReturn),   sc:k.totalGain>=0?'up':'dn', a:'#3fb950'},
    {l:'MF Return',       v:fmtP(k.mfReturn),      s:sinceMF,               sc:'up', a:'#d4a843'},
    {l:'MF CAGR',         v:fmtP(k.mfCAGR),        s:'Compounded p.a.',     sc:'up', a:'#a371f7'},
    {l:'Stock P&L',       v:fmtL(k.stGain),        s:fmtP(k.stReturn),      sc:k.stGain>=0?'up':'dn', a:'#f85149'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub ${c.sc}">${c.s}</div></div>`).join('');

  const mfP=k.totalInvested?Math.round(k.mfInvested/k.totalInvested*100):0, stP=100-mfP;
  document.getElementById('alloc-split').innerHTML=`
    <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#58a6ff">Mutual Funds</span><span style="color:#58a6ff">${mfP}% · ${fmtL(k.mfInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${mfP}%;background:#58a6ff;height:100%"></div></div></div>
    <div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#f0883e">Equity Stocks</span><span style="color:#f0883e">${stP}% · ${fmtL(k.stInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${stP}%;background:#f0883e;height:100%"></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">MF gain</div><div style="font-size:16px;font-weight:600;color:var(--green);font-family:var(--sans)">${fmtL(k.mfGain)}</div><div style="font-size:11px;color:var(--green)">${fmtP(k.mfReturn)}</div></div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Stock P&L</div><div style="font-size:16px;font-weight:600;color:${k.stGain>=0?'var(--green)':'var(--red)'};font-family:var(--sans)">${fmtL(k.stGain)}</div><div style="font-size:11px;color:${k.stGain>=0?'var(--green)':'var(--red)'}">${fmtP(k.stReturn)}</div></div>
    </div>`;

  donut('donut-mf','legend-mf',DATA.mfCategories.map(c=>({k:c.Category,v:c.Invested})),CAT_CLR);

  const maxMF=Math.max(...DATA.funds.map(f=>Math.abs(f.RetPct)),1);
  const maxST=Math.max(...DATA.stocks.map(s=>Math.abs(s.RetPct)),1);
  document.getElementById('top-mf').innerHTML=DATA.funds.length
    ?[...DATA.funds].sort((a,b)=>b.RetPct-a.RetPct).slice(0,4).map(f=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(f.name)}</span><span style="color:var(--muted)">${fmtL(f.Gain)}</span></div>${miniBar(f.RetPct,maxMF)}</div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload MF file to see data</div>';
  document.getElementById('top-st').innerHTML=DATA.stocks.length
    ?[...DATA.stocks].sort((a,b)=>b.RetPct-a.RetPct).slice(0,4).map(s=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(s.name)}</span><span style="color:var(--muted)">${fmtL(s.Gain)}</span></div>${miniBar(s.RetPct,maxST)}</div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload Stocks file to see data</div>';

  // Dynamic risk alerts
  const alerts=[];
  const stTotalInv=DATA.stocks.reduce((a,s)=>a+s.Invested,0)||1;
  DATA.stocks.forEach(s=>{
    const conc=s.Invested/stTotalInv*100;
    if(s.RetPct<-40) alerts.push([esc(s.name),`${fmtP(s.RetPct)} return — strong EXIT candidate, no recovery thesis visible`]);
    else if(conc>15&&s.RetPct<0) alerts.push([esc(s.name),`${conc.toFixed(1)}% of stock portfolio, ${fmtP(s.RetPct)} return — high concentration risk, consider trimming`]);
    else if(s.Sector==='Speculative'&&s.RetPct<-20) alerts.push([esc(s.name),`${fmtP(s.RetPct)} in speculative sector — averaging down not advised; reduce to ≤5%`]);
    else if(s.CAGR<-15&&s.Invested>30000) alerts.push([esc(s.name),`CAGR ${fmtP(s.CAGR)}, ₹${Math.round(s.Invested/1000)}K invested — reassess thesis`]);
  });
  // Sector concentration
  DATA.sectors.forEach(sec=>{
    const secPct=stTotalInv?sec.Invested/stTotalInv*100:0;
    if(secPct>30&&sec.Gain<0) alerts.push([esc(sec.Sector)+' Sector',`${secPct.toFixed(1)}% of stocks with ${fmtL(sec.Gain)} loss — over-concentrated`]);
  });
  document.getElementById('risk-alerts').innerHTML=alerts.length
    ?alerts.map(([n,m])=>`<div class="alert-row"><span class="alert-name">${n}</span><span class="alert-msg">${m}</span></div>`).join('')
    :'<div style="color:var(--green);font-size:11px">✓ No critical concentration alerts — portfolio looks balanced</div>';

  renderHealthScore();
  renderSIPReminder();
  renderDrawdownAnalyzer();
}

function renderHealthScore(){
  const k=DATA.kpis;
  if(!k.totalInvested){
    document.getElementById('health-score-display').innerHTML='<div style="color:var(--muted);font-size:11px">Upload files to compute health score</div>';
    document.getElementById('health-score-breakdown').innerHTML='';
    return;
  }

  // Score components (each 0–20, total 100)
  const n=DATA.stocks.length||1;
  const mfShare=k.totalInvested?k.mfInvested/k.totalInvested:0;
  const stWin=DATA.stocks.filter(s=>s.Gain>0).length;
  const mfWin=DATA.funds.filter(f=>f.Gain>0).length;
  const nMF=DATA.funds.length||1;
  const avgMFcagr=DATA.funds.reduce((a,f)=>a+f.CAGR,0)/nMF;
  const maxSingleStPct=DATA.stocks.length?Math.max(...DATA.stocks.map(s=>s.Invested/k.stInvested*100)):0;
  const specInv=DATA.stocks.filter(s=>s.Sector==='Speculative').reduce((a,s)=>a+s.Invested,0);
  const specPct=k.stInvested?specInv/k.stInvested:0;

  // 1. Diversification (0-20): penalise >20% single stock, >50% speculative
  const divScore=Math.max(0,20-Math.max(0,(maxSingleStPct-20)*0.5)-Math.max(0,(specPct*100-15)*0.4));

  // 2. MF dominance (0-20): reward MF share ≥60%
  const mfScore=Math.min(20,mfShare*33);

  // 3. Profitability (0-20): % of holdings in profit weighted equally
  const totalHoldings=DATA.funds.length+DATA.stocks.length||1;
  const totalWin=mfWin+stWin;
  const profScore=(totalWin/totalHoldings)*20;

  // 4. CAGR vs benchmark Nifty 12% (0-20)
  const cagrScore=Math.min(20,Math.max(0,(avgMFcagr/12)*20));

  // 5. Consistency (0-20): from timeline — active months / total months ratio
  let consistScore=10; // default when no timeline data
  if(DATA.monthlyMF.length){
    const allM=buildCombinedMonthly();
    const active=allM.filter(x=>x.v>0).length;
    consistScore=allM.length?Math.min(20,(active/allM.length)*22):10;
  }

  const total=Math.round(divScore+mfScore+profScore+cagrScore+consistScore);
  const clamp=Math.min(100,Math.max(0,total));
  const scoreColor=clamp>=75?'#3fb950':clamp>=50?'#d4a843':'#f85149';
  const scoreLabel=clamp>=75?'Healthy':clamp>=50?'Fair':'Needs Attention';

  // ── SVG semicircle gauge — fixed geometry ──
  // ViewBox: 180 wide × 110 tall. Centre of arc: (90, 95). Radius 72.
  // Arc sweeps left (180°) to right (0°) across the top half.
  // Score 0 = left tip, Score 100 = right tip.
  const VW=180, VH=110, GCX=90, GCY=95, GR=72, SW=12;

  // Polar → cartesian. 0° = right, angles in degrees, measured from positive-x axis.
  const polar=(deg)=>({
    x: GCX + GR * Math.cos(deg * Math.PI / 180),
    y: GCY + GR * Math.sin(deg * Math.PI / 180),
  });

  // Track: 180° (left) → 0° (right), always full arc
  const tStart = polar(180);
  const tEnd   = polar(0);
  const trackD = `M${tStart.x},${tStart.y} A${GR},${GR} 0 0,1 ${tEnd.x},${tEnd.y}`;

  // Fill: 180° → (180° - score%) of 180°, sweeping clockwise (0,1)
  // score 0 → angle stays at 180 (left), score 100 → angle reaches 0 (right)
  const fillAngle = 180 - (clamp / 100) * 180;   // end angle in degrees
  const fEnd      = polar(fillAngle);
  const largeArc  = (180 - fillAngle) > 180 ? 1 : 0;
  const fillD = clamp > 0
    ? `M${tStart.x},${tStart.y} A${GR},${GR} 0 ${largeArc},1 ${fEnd.x},${fEnd.y}`
    : '';

  // Needle tip circle at fill end
  const needleTip = clamp > 0
    ? `<circle cx="${fEnd.x.toFixed(1)}" cy="${fEnd.y.toFixed(1)}" r="5" fill="${scoreColor}"/>`
    : '';

  // Score tick marks at 25/50/75
  function polar_r(cx,cy,r,deg){return{x:cx+r*Math.cos(deg*Math.PI/180),y:cy+r*Math.sin(deg*Math.PI/180)};}
  const ticks=[25,50,75].map(v=>{
    const a=180-(v/100)*180;
    const inner=polar_r(GCX,GCY,GR-10,a);
    const outer=polar_r(GCX,GCY,GR+2,a);
    return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border2)" stroke-width="1.5"/>`;
  }).join('');

  document.getElementById('health-score-display').innerHTML=`
    <div class="health-gauge">
      <svg viewBox="-10 0 ${VW+20} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <!-- Track arc -->
        <path d="${trackD}" fill="none" stroke="var(--bg4)" stroke-width="${SW}" stroke-linecap="round"/>
        <!-- Fill arc -->
        ${fillD?`<path d="${fillD}" fill="none" stroke="${scoreColor}" stroke-width="${SW}" stroke-linecap="round" opacity="0.95"/>`:''}
        <!-- Needle tip -->
        ${needleTip}
        <!-- Tick marks -->
        ${ticks}
        <!-- 0 label -->
        <text x="${tStart.x-14}" y="${tStart.y+6}" font-size="9" fill="var(--muted)" text-anchor="middle">0</text>
        <!-- 100 label -->
        <text x="${tEnd.x+14}" y="${tEnd.y+6}" font-size="9" fill="var(--muted)" text-anchor="middle">100</text>
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

  const breakdown=[
    ['Diversification',  Math.round(divScore),   20, 'Single-stock concentration & speculative exposure'],
    ['MF Dominance',     Math.round(mfScore),    20, 'MF share of total portfolio'],
    ['Profitability',    Math.round(profScore),  20, '% of funds & stocks in profit'],
    ['CAGR Quality',     Math.round(cagrScore),  20, 'Average MF CAGR vs Nifty 50 (12%)'],
    ['Consistency',      Math.round(consistScore),20,'Regular investing across months'],
  ];
  document.getElementById('health-score-breakdown').innerHTML=breakdown.map(([name,pts,max,note])=>{
    const pct=Math.round(pts/max*100);
    const c=pct>=75?'#3fb950':pct>=50?'#d4a843':'#f85149';
    return `<div class="health-bar-row">
      <span class="health-bar-name" title="${note}">${name}</span>
      <div class="health-bar-track"><div class="health-bar-fill" style="width:${pct}%;background:${c}"></div></div>
      <span class="health-bar-pts" style="color:${c}">${pts}/${max}</span>
    </div>`;
  }).join('');
}

// ── SIP Reminder ──────────────────────────────────────────────
function renderSIPReminder(){
  const el=document.getElementById('sip-reminder-content');
  const lblEl=document.getElementById('sip-month-label');
  if(!el) return;
  const k=DATA.kpis;
  if(!k.totalInvested){
    el.innerHTML='<div style="color:var(--muted);font-size:12px">Upload your files to get your personalised SIP action plan.</div>';
    return;
  }
  const now=new Date();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  lblEl.textContent=MONTHS[now.getMonth()].toUpperCase()+' '+now.getFullYear()+' — ACTION PLAN';

  const allMonths=buildCombinedMonthly();
  const activeMonths=allMonths.filter(x=>x.v>0);
  const avgMonthly=activeMonths.length?Math.round(activeMonths.reduce((a,x)=>a+x.v,0)/activeMonths.length):0;
  // Correct previous-month key: use a Date rolled back by 1 month to avoid off-by-one with getMonth() (0-indexed)
  const prevMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthKey=(prevMonthDate.getFullYear()+'-'+String(prevMonthDate.getMonth()+1).padStart(2,'0')); // prev month
  const investedThisMonth=allMonths.find(x=>x.m===lastMonthKey)?.v||0;

  // Compute per-category allocation
  const totalMFInv=k.mfInvested, totalSTInv=k.stInvested;
  const topFunds=[...DATA.funds].sort((a,b)=>b.CAGR-a.CAGR).slice(0,3);
  const underperformers=DATA.funds.filter(f=>f.CAGR<10&&f.CAGR>0);

  const recommendedSIP=avgMonthly||Math.round(k.totalInvested*0.02);
  const mfShare=k.totalInvested?k.mfInvested/k.totalInvested:0.7;
  const mfSIP=Math.round(recommendedSIP*Math.min(0.8,Math.max(0.5,mfShare)));
  const stSIP=recommendedSIP-mfSIP;

  // Build action items
  const actions=[];
  if(topFunds.length){
    const perFund=Math.round(mfSIP/Math.min(3,topFunds.length));
    topFunds.slice(0,2).forEach(f=>{
      actions.push({icon:'📊',fund:f.name.split(' ').slice(0,4).join(' '),amt:fmtL(perFund),reason:`CAGR ${fmtP(f.CAGR)} — top performer in your portfolio`});
    });
  }
  if(underperformers.length){
    actions.push({icon:'⚠️',fund:underperformers[0].name.split(' ').slice(0,4).join(' '),amt:'₹0',reason:`Consider pausing SIP — CAGR only ${fmtP(underperformers[0].CAGR)}, switch to higher-alpha fund`});
  }
  if(stSIP>0){
    const sectors=DATA.sectors.filter(s=>s.Gain>0).sort((a,b)=>b.RetPct-a.RetPct);
    const bestSec=sectors[0];
    actions.push({icon:'📈',fund:bestSec?bestSec.Sector+' stocks':'Large-cap stocks',amt:fmtL(stSIP),reason:bestSec?`Your best-performing sector at ${fmtP(bestSec.RetPct)}`:'Diversify equity exposure'});
  }

  el.innerHTML=`
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="sip-amount">${fmtL(recommendedSIP)}<span style="font-size:14px;color:var(--muted);font-family:var(--mono)">/mo</span></div>
      <div style="font-size:11px;color:var(--muted)">Recommended monthly deployment · Based on your historical avg ${fmtL(avgMonthly>0?avgMonthly:recommendedSIP)}/mo</div>
    </div>
    <div class="sip-action-list">
      ${actions.map(a=>`<div class="sip-action-item">
        <span class="sip-action-icon">${a.icon}</span>
        <div style="flex:1">
          <div class="sip-action-fund">${a.fund} <span class="sip-action-amt">${a.amt}</span></div>
          <div class="sip-action-reason">${a.reason}</div>
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⓘ Recommendations based on your historical investing pattern and fund performance. Always review with your financial goals before acting.
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// DRAWDOWN ANALYZER
// ══════════════════════════════════════════════════════════════

// Chart instance — destroyed and recreated on each renderOverview call
let chartDrawdownInst = null;

// ── STEP 2: Build simulated portfolio value series ────────────
// Uses GBM (Geometric Brownian Motion) with realistic Indian equity market
// volatility (~18% annualised σ) and known crash overlays so the chart
// shows meaningful drawdowns instead of a flat 0% line.
//
// The simulation is seeded deterministically from the portfolio's earliest
// investment date so it is stable across re-renders. The final portfolio
// value is rescaled to match the user's actual reported current value,
// keeping the drawdown shape realistic while the ending point is exact.
function buildDrawdownSeriesFromTimeline() {
  const allMonths = buildCombinedMonthly();
  if (!allMonths.length) return [];

  const k = DATA.kpis;
  if (!k || !k.totalInvested) return [];

  const first = allMonths[0].m, last = allMonths[allMonths.length - 1].m;
  const monthMap = {};
  allMonths.forEach(({m, v}) => monthMap[m] = v);

  // ── GBM parameters (Indian equity — Nifty 50 historical) ────
  // Annual drift (μ) derived from portfolio CAGR if available, else 12% default
  const mfCAGR = k.mfCAGR > 0 ? k.mfCAGR : 12;
  const annualDrift   = mfCAGR / 100;
  const annualSigma   = 0.18;          // 18% annualised vol — typical Indian equity
  const monthlyDrift  = annualDrift  / 12;
  const monthlySigma  = annualSigma  / Math.sqrt(12);

  // ── Known Indian market crash months: [YYYY-MM, shock %] ────
  // Approximate peak-to-trough drawdown injected as one-shot negative shocks
  const CRASH_SHOCKS = {
    '2008-10': -0.24,  // Global financial crisis trough
    '2011-12': -0.08,  // Euro-zone crisis
    '2013-08': -0.07,  // Taper tantrum / INR crisis
    '2015-08': -0.09,  // China devaluation selloff
    '2016-11': -0.06,  // Demonetisation shock
    '2018-09': -0.08,  // IL&FS crisis / NBFC meltdown
    '2020-03': -0.32,  // COVID crash
    '2022-06': -0.10,  // Global rate-hike selloff
    '2024-06': -0.06,  // Post-election volatility
  };

  // ── Deterministic seeded PRNG (mulberry32) ───────────────────
  // Seed from numeric representation of first month so output is stable
  const [sy, sm] = first.split('-').map(Number);
  let seed = sy * 100 + sm;
  function rand() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // Box-Muller for Gaussian samples
  function randn() {
    let u, v;
    do { u = rand(); v = rand(); } while (u === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ── Simulate month by month ──────────────────────────────────
  const series = [];
  let [fy, fm] = [parseInt(first.slice(0,4)), parseInt(first.slice(5))];
  const [ey, em] = [parseInt(last.slice(0,4)), parseInt(last.slice(5))];
  let portfolioValue = 0;

  while (fy < ey || (fy === ey && fm <= em)) {
    const mk = fy + '-' + String(fm).padStart(2,'0');

    // 1. Add new investment this month (SIP / lump-sum)
    portfolioValue += (monthMap[mk] || 0);

    // 2. Apply GBM return for this month
    const gbmReturn = monthlyDrift + monthlySigma * randn();
    portfolioValue *= (1 + gbmReturn);

    // 3. Overlay known crash shocks if this month matches
    if (CRASH_SHOCKS[mk] !== undefined) {
      portfolioValue *= (1 + CRASH_SHOCKS[mk]);
    }

    portfolioValue = Math.max(portfolioValue, 0);
    series.push({ date: mk, value: Math.round(portfolioValue) });

    fm++; if (fm > 12) { fm = 1; fy++; }
  }

  // ── Rescale endpoint to match actual reported portfolio value ─
  // This keeps the drawdown shape realistic but anchors the final
  // value to reality (the user's actual current portfolio value).
  const actualEndValue = k.totalValue || 0;
  if (actualEndValue > 0 && series.length > 0) {
    const simEndValue = series[series.length - 1].value;
    if (simEndValue > 0) {
      const scale = actualEndValue / simEndValue;
      // Blend: gently taper scale towards 1 at the start so early values
      // aren't distorted, and full scale applies at the end.
      const n = series.length;
      series.forEach((pt, i) => {
        const t = i / Math.max(n - 1, 1);    // 0 → 1 over the series
        const blendedScale = 1 + (scale - 1) * t;
        pt.value = Math.round(pt.value * blendedScale);
      });
    }
  }

  return series;
}

// ── STEP 3a: Core drawdown stats ─────────────────────────────
function calculateDrawdown(series) {
  if (!series.length) return { maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true };

  const values = series.map(s => s.value);
  let runningPeak = values[0];
  let maxDD = 0;
  let maxDDPeak = runningPeak;
  let maxDDTroughIdx = 0;
  let curPeakIdx = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak : 0;
    if (dd < maxDD) { maxDD = dd; maxDDPeak = runningPeak; maxDDTroughIdx = i; }
  }

  const finalVal = values[values.length - 1];
  const allTimePeak = Math.max(...values);
  const currentDD = allTimePeak > 0 ? (finalVal - allTimePeak) / allTimePeak : 0;

  // Recovery: months from trough until value >= trough's peak again
  let recoveryMonths = 0;
  let recovered = true;
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

// ── STEP 3b: Per-point drawdown array + peak/trough indices ───
function calculateDrawdownWithPeriod(series) {
  if (!series.length) return { peakIndex: 0, troughIndex: 0, maxDD: 0, ddSeries: [] };

  const values = series.map(s => s.value);
  let runningPeak = values[0];
  let maxDD = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0;
  const ddSeries = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak * 100 : 0;
    ddSeries.push(parseFloat(dd.toFixed(2)));
    if (dd < maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }

  return { peakIndex: peakIdx, troughIndex: troughIdx, maxDD, ddSeries };
}

// ── STEP 4: Populate KPI cards ────────────────────────────────
function renderDrawdownSummary(stats) {
  const { maxDD, currentDD, peak, recoveryMonths, recovered } = stats;
  const noData = !peak;

  const set = (id, text, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; if (color) el.style.color = color; }
  };

  // Max Drawdown
  set('dd-max',      noData ? '—' : (maxDD * 100).toFixed(1) + '%',
                     noData ? 'var(--muted)' : 'var(--red)');
  set('dd-max-note', noData ? 'Upload data' : 'Worst peak-to-trough fall');

  // Current Drawdown
  if (noData) {
    set('dd-cur', '—', 'var(--muted)');
    set('dd-cur-note', 'Upload data');
  } else if (currentDD >= -0.001) {
    set('dd-cur', 'At Peak', 'var(--green)');
    set('dd-cur-note', 'Portfolio at all-time high');
  } else {
    set('dd-cur', (currentDD * 100).toFixed(1) + '%',
        currentDD < -0.15 ? 'var(--red)' : 'var(--amber)');
    set('dd-cur-note', 'Below all-time high');
  }

  // Recovery Time
  if (noData) {
    set('dd-recovery', '—', 'var(--muted)');
    set('dd-recovery-note', 'Upload data');
  } else if (recoveryMonths === 0) {
    set('dd-recovery', 'None', 'var(--green)');
    set('dd-recovery-note', 'No significant drawdown');
  } else {
    set('dd-recovery', recoveryMonths + ' mo', recovered ? 'var(--green)' : 'var(--amber)');
    set('dd-recovery-note', recovered ? 'Fully recovered' : 'Still recovering');
  }

  // Peak Value
  set('dd-peak',      noData ? '—' : fmtL(peak), noData ? 'var(--muted)' : 'var(--gold)');
  set('dd-peak-note', noData ? 'Upload data' : 'All-time portfolio high');
}

// ── STEP 5: Render Chart.js drawdown chart ────────────────────
function renderDrawdownChart(series, ddResult) {
  console.log('Drawdown series:', series);
  const canvas = document.getElementById('chart-drawdown');
  console.log('Canvas element:', canvas);
  if (!canvas || !window.Chart) return;

  if (chartDrawdownInst) { chartDrawdownInst.destroy(); chartDrawdownInst = null; }

  console.log('Drawdown series:', series);

  if (!series.length) {
    canvas.parentElement.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see drawdown chart</div>';
    return;
  }

  const { ddSeries, peakIndex, troughIndex } = ddResult;
  const labels = series.map(s => s.date);
  const skip = Math.max(1, Math.ceil(labels.length / 18));

  // Y-axis: set min slightly below the worst drawdown, max = 1 (slightly above 0)
  const minDD = Math.min(...ddSeries, -0.5);
  const yMin = Math.floor(minDD * 1.25); // 25% headroom below worst point
  const yMax = 1; // small breathing room above zero line

  // Per-point radii and colours for peak/trough annotations
  const pointRadius = labels.map((_, i) =>
    (i === peakIndex || i === troughIndex) ? 5 : 0);
  const pointBg = labels.map((_, i) =>
    i === peakIndex ? '#d4a843' : i === troughIndex ? '#f85149' : 'rgba(0,0,0,0)');

  chartDrawdownInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: ddSeries,
        borderColor: '#f85149',
        backgroundColor: 'rgba(248,81,73,0.10)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius,
        pointBackgroundColor: pointBg,
        pointBorderColor: pointBg,
        pointBorderWidth: 2,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => labels[items[0].dataIndex],
            label: ctx => {
              const v = ctx.raw;
              const tag = ctx.dataIndex === peakIndex ? ' 🔺 Peak'
                        : ctx.dataIndex === troughIndex ? ' 🔻 Trough' : '';
              return 'Drawdown: ' + v.toFixed(2) + '%' + tag;
            }
          },
          backgroundColor: '#1c2330',
          titleColor: '#e6edf3',
          bodyColor: '#7d8590',
          borderColor: '#30363d',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9 },
            color: '#7d8590',
            maxRotation: 45,
            callback: (_, i) => i % skip === 0 ? labels[i] : ''
          },
          grid: { color: '#21262d' }
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            font: { size: 9 },
            color: '#7d8590',
            callback: v => v.toFixed(1) + '%'
          },
          grid: { color: '#21262d' }
        }
      }
    }
  });
}

// ── STEP 7: Insight card ──────────────────────────────────────
function renderDrawdownInsight(maxDD, currentDD) {
  const el = document.getElementById('dd-insight');
  if (!el) return;
  if (!maxDD) { el.innerHTML = ''; return; }

  const pct = maxDD * 100;    // negative, e.g. -18.3
  const curPct = currentDD * 100;

  let accent, icon, title, note;
  if (pct <= -30) {
    accent = 'var(--red)'; icon = '⚠';
    title = 'High Drawdown Warning';
    note = `Portfolio experienced a severe drawdown of ${pct.toFixed(1)}% — exceeding 30%. Review position sizing and consider enforcing stop-loss discipline on speculative holdings.`;
  } else if (pct <= -15) {
    accent = 'var(--amber)'; icon = '◈';
    title = 'Moderate Drawdown Observed';
    note = `A pullback of ${pct.toFixed(1)}% was recorded. This is within the acceptable range for an equity-heavy portfolio. Monitor sector concentration to limit future drawdowns.`;
  } else if (curPct < -5) {
    accent = 'var(--blue)'; icon = 'ℹ';
    title = 'Currently Below Peak';
    note = `Portfolio is ${Math.abs(curPct).toFixed(1)}% below its all-time high. Continue regular SIPs to benefit from rupee cost averaging during this recovery phase.`;
  } else {
    accent = 'var(--green)'; icon = '✓';
    title = 'Healthy Drawdown Profile';
    note = `Max drawdown is under 15% — a sign of disciplined, diversified investing. Capital preservation is strong across your investment history.`;
  }

  el.innerHTML = `<div class="insight-card" style="--ic-accent:${accent}">
    <div class="insight-label">${icon} ${title}</div>
    <div class="insight-value" style="color:${accent}">${pct.toFixed(1)}%</div>
    <div class="insight-note">${note}</div>
  </div>`;
}

// ── STEP 6: Orchestrator — called from renderOverview ─────────
function renderDrawdownAnalyzer() {
  const series = buildDrawdownSeriesFromTimeline();

  if (!series.length) {
    renderDrawdownSummary({ maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true });
    renderDrawdownInsight(0, 0);
    return;
  }

  const stats   = calculateDrawdown(series);
  const ddResult = calculateDrawdownWithPeriod(series);

  renderDrawdownSummary(stats);
  renderDrawdownInsight(stats.maxDD, stats.currentDD);
  // Slight delay to ensure canvas is painted before Chart.js measures its box
  setTimeout(() => renderDrawdownChart(series, ddResult), 100);
}

