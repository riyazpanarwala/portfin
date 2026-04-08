// ── page-stocks.js — Equity Stocks page and Tax Harvesting ─────────────────

// ── Stocks ────────────────────────────────────────────────────
function renderStocks() {
  const k=DATA.kpis;
  const n=DATA.stocks.length;
  const win=DATA.stocks.filter(s=>s.Gain>0).length;
  const los=DATA.stocks.filter(s=>s.Gain<0).length;
  const totalQty=DATA.stocks.reduce((s,x)=>s+x.Qty,0);
  document.getElementById('kpi-stocks').innerHTML=[
    {l:'Invested',       v:fmtL(k.stInvested), s:'',                sc:'',   a:'#58a6ff'},
    {l:'Market Value',   v:fmtL(k.stValue),    s:'Current holdings',sc:'',   a:'#d4a843'},
    {l:'Total P&L',      v:fmtL(k.stGain),     s:fmtP(k.stReturn), sc:k.stGain>=0?'up':'dn', a:'#f85149'},
    {l:'Winners',        v:win+'/'+n,           s:'In profit',       sc:'up', a:'#3fb950'},
    {l:'Losers',         v:los+'/'+n,           s:'In red',          sc:'dn', a:'#f85149'},
    {l:'Total Quantity', v:fmtN(totalQty),      s:'Shares held',     sc:'',   a:'#7d8590'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub ${c.sc}">${c.s}</div></div>`).join('');

  const secs=['All',...new Set(DATA.stocks.map(s=>s.Sector))];
  document.getElementById('st-filters').innerHTML='<span class="ctrl-label">Sector:</span>'+secs.map(s=>`<button class="chip ${stFil===s?'on':''}" onclick="setStFil('${encodeURIComponent(s)}')">${s}</button>`).join('');
  const sOpts=[['RetPct','Return'],['Gain','P&L'],['Qty','Qty'],['Invested','Invested'],['Current','Value'],['CAGR','CAGR'],['Latest_Price','CMP']];
  document.getElementById('st-sorts').innerHTML='<span class="ctrl-label">Sort:</span>'+sOpts.map(([k,l])=>`<button class="chip ${stSort===k?'on':''}" onclick="sortST('${k}')">${l}${stSort===k?(stAsc?' ↑':' ↓'):''}</button>`).join('');

  let stocks=stFil==='All'?DATA.stocks:DATA.stocks.filter(s=>s.Sector===stFil);
  stocks=[...stocks].sort((a,b)=>stAsc?a[stSort]-b[stSort]:b[stSort]-a[stSort]);
  const maxR=Math.max(...DATA.stocks.map(s=>Math.abs(s.RetPct)),1);

  if(!stocks.length){document.getElementById('st-tbody').innerHTML='<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:30px">Upload your Stocks Excel file to see data</td></tr>';}
  else {
    document.getElementById('st-tbody').innerHTML=stocks.map((s,i)=>{
      const hold=fmtHoldPeriod(s.holdDays);
      return `<tr style="cursor:pointer" onclick="toggleDrill('st',${i})">
      <td style="font-weight:500">
        <span class="expand-btn" id="drill-btn-st-${i}">▶</span> ${esc(s.name)}
      </td>
      <td><span class="pill" style="background:${gc(s.Sector,SEC_CLR)}22;color:${gc(s.Sector,SEC_CLR)};border:1px solid ${gc(s.Sector,SEC_CLR)}44">${esc(s.Sector)}</span></td>
      <td>${riskBadge(s)}</td>
      <td class="td-gold">${fmtN(s.Qty)}</td>
      <td>₹${s.Latest_Price>0?s.Latest_Price.toLocaleString('en-IN'):'—'}</td>
      <td class="td-muted">${fmtL(s.Invested)}</td>
      <td style="font-weight:500">${fmtL(s.Current)}</td>
      <td class="${cls(s.Gain)}">${fmtL(s.Gain)}</td>
      <td style="min-width:130px">${miniBar(s.RetPct,maxR)}</td>
      <td class="${s.CAGR>=15?'td-up':s.CAGR>=0?'td-gold':'td-dn'}">${fmtP(s.CAGR)}</td>
      <td class="td-muted" style="font-size:10px">${hold}</td>
    </tr>
    <tr class="drill-row" id="drill-st-${i}" style="display:none">
      <td colspan="11"><div class="drill-inner">${buildSTDrillHTML(s)}</div></td>
    </tr>`;
    }).join('');
  }

  // Tax harvesting
  renderTaxHarvesting();

  // Dynamic rule-based recommendations
  const recs=[];
  const stTotalInv=DATA.stocks.reduce((a,s)=>a+s.Invested,0)||1;
  const sorted=[...DATA.stocks].sort((a,b)=>a.RetPct-b.RetPct);

  // EXIT: worst losers > -40%
  const exits=sorted.filter(s=>s.RetPct<-40);
  if(exits.length) recs.push(['tag-exit','EXIT',exits.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)})`).join(', ')+' — no recovery thesis, free up capital']);

  // REDUCE: -25% to -40% with >8% concentration
  const reduces=sorted.filter(s=>s.RetPct<=-25&&s.RetPct>=-40&&(s.Invested/stTotalInv*100)>8);
  if(reduces.length) recs.push(['tag-reduce','REDUCE',reduces.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)}, ${(s.Invested/stTotalInv*100).toFixed(1)}% of stocks)`).join(', ')+' — trim to ≤5% of portfolio']);

  // HOLD: -15% to -25%, PSU/infra (await macro)
  const holds=sorted.filter(s=>s.RetPct<-10&&s.RetPct>=-25&&['Finance/PSU','Energy/PSU','Infra/PSU','Renewables'].includes(s.Sector));
  if(holds.length) recs.push(['tag-hold','HOLD',holds.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)})`).join(', ')+' — await rate-cut cycle / sector tailwinds before selling']);

  // ADD SIP: MF CAGR > 15%
  const addFunds=[...DATA.funds].filter(f=>f.CAGR>=15).sort((a,b)=>b.CAGR-a.CAGR).slice(0,3);
  if(addFunds.length) recs.push(['tag-add','ADD SIP',addFunds.map(f=>`${esc(f.name)} (CAGR ${fmtP(f.CAGR)})`).join(', ')+' — top performers, consider increasing SIP amount']);

  // SWITCH: MF CAGR < 8% — underperforming
  const switchFunds=[...DATA.funds].filter(f=>f.CAGR<8&&f.CAGR>0&&f.Invested>50000).sort((a,b)=>a.CAGR-b.CAGR).slice(0,2);
  if(switchFunds.length) recs.push(['tag-switch','SWITCH',switchFunds.map(f=>`${esc(f.name)} (CAGR ${fmtP(f.CAGR)})`).join(', ')+' → consider switching to low-cost Nifty 50 index fund']);

  if(!recs.length) recs.push(['tag-hold','HOLD','Portfolio looks stable — continue SIPs and review quarterly']);
  document.getElementById('recommendations').innerHTML=recs.map(([c,tag,text])=>`<div class="rec-row"><span class="rec-tag ${c}">${tag}</span><span class="rec-text">${text}</span></div>`).join('');
}
function sortST(k){if(stSort===k)stAsc=!stAsc;else{stSort=k;stAsc=false;}renderStocks();}
function setStFil(v){stFil=decodeURIComponent(v);renderStocks();}

// ── Tax Harvesting ────────────────────────────────────────────
function renderTaxHarvesting(){
  const taxKpisEl=document.getElementById('tax-kpis');
  const taxTableEl=document.getElementById('tax-table');
  if(!taxKpisEl||!taxTableEl) return;

  if(!DATA.stocks.length){
    taxKpisEl.innerHTML=''; taxTableEl.innerHTML='<div style="color:var(--muted);font-size:11px">Upload Stocks file to see tax analysis</div>'; return;
  }

  // Per lot tax classification
  const LTCG_EXEMPT=125000; // ₹1.25L exempt per year
  const now=Date.now();
  let totalLTCGGain=0, totalSTCGGain=0, totalLTCGLoss=0, totalSTCGLoss=0;
  let harvestCandidates=[];

  DATA.stocks.forEach(s=>{
    const cmp=s.Latest_Price||0;
    (s.rawLots||[]).forEach(l=>{
      const days=Math.floor((now-l.date.getTime())/(24*3600*1000));
      const curVal=cmp>0&&l.qty>0?cmp*l.qty:(l.cur||l.inv+l.gain);
      const lotGain=Math.round(curVal-l.inv);
      const isLTCG=days>=365;
      if(isLTCG){ if(lotGain>0) totalLTCGGain+=lotGain; else totalLTCGLoss+=Math.abs(lotGain); }
      else       { if(lotGain>0) totalSTCGGain+=lotGain; else totalSTCGLoss+=Math.abs(lotGain); }
      // Harvest candidate: loss-making lot that can offset gains
      if(lotGain<0&&Math.abs(lotGain)>1000){
        harvestCandidates.push({name:s.name,date:l.date,days,inv:l.inv,curVal,gain:lotGain,isLTCG,qty:l.qty,invPrice:l.invPrice,cmp});
      }
    });
  });

  // Tax estimates (Indian equity FY)
  const taxableLTCG=Math.max(0,totalLTCGGain-LTCG_EXEMPT);
  const estLTCGTax=Math.round(taxableLTCG*0.125);
  const estSTCGTax=Math.round(totalSTCGGain*0.20);
  const totalEstTax=estLTCGTax+estSTCGTax;
  const harvestSaving=Math.round(Math.min(harvestCandidates.reduce((a,c)=>a+Math.abs(c.gain),0),totalSTCGGain)*0.20
    +Math.min(harvestCandidates.filter(c=>c.isLTCG).reduce((a,c)=>a+Math.abs(c.gain),0),taxableLTCG)*0.125);

  taxKpisEl.innerHTML=[
    {l:'LTCG Gains',  v:fmtL(totalLTCGGain), c:totalLTCGGain>0?'var(--green)':'var(--muted)'},
    {l:'STCG Gains',  v:fmtL(totalSTCGGain), c:totalSTCGGain>0?'var(--amber)':'var(--muted)'},
    {l:'Est. Tax Liability', v:fmtL(totalEstTax), c:totalEstTax>0?'var(--red)':'var(--green)'},
    {l:'Harvest Saving', v:harvestSaving>0?'up to '+fmtL(harvestSaving):'—', c:'var(--blue)'},
  ].map(x=>`<div class="tax-kpi"><div class="tax-kpi-label">${x.l}</div><div class="tax-kpi-val" style="color:${x.c}">${x.v}</div></div>`).join('');

  if(!harvestCandidates.length){
    taxTableEl.innerHTML='<div style="color:var(--green);font-size:11px;padding:8px">✓ No loss-making lots to harvest right now</div>';
    return;
  }

  harvestCandidates.sort((a,b)=>a.gain-b.gain);
  taxTableEl.innerHTML=`
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">Loss-making lots you can sell to offset gains and reduce tax liability:</div>
    <div style="overflow-x:auto">
    <table class="drill-table" style="min-width:620px">
      <thead><tr>
        <th>Stock</th><th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th>
        <th>Unrealised Loss</th><th>Holding</th><th>Tax Type</th><th>Action</th>
      </tr></thead>
      <tbody>
      ${harvestCandidates.map(c=>`<tr>
        <td style="font-weight:500">${esc(c.name)}</td>
        <td>${fmtDate(c.date)}</td>
        <td>${c.qty>0?fmtN(c.qty):'—'}</td>
        <td>${c.invPrice>0?'₹'+c.invPrice.toFixed(2):'—'}</td>
        <td>${c.cmp>0?'₹'+c.cmp.toLocaleString('en-IN'):'—'}</td>
        <td class="td-dn">${fmtL(c.gain)}</td>
        <td class="td-muted">${fmtHoldPeriod(c.days)}</td>
        <td>${c.isLTCG?'<span class="ltcg-badge">LTCG</span>':'<span class="stcg-badge">STCG</span>'}</td>
        <td><span class="harvest-tag">HARVEST</span></td>
      </tr>`).join('')}
      </tbody>
    </table></div>
    <div style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6">
      ⚠ After selling for harvest, wait 31+ days before re-buying to avoid wash-sale. LTCG exempt up to ₹1.25L/year; gains above that taxed at 12.5%. STCG taxed at 20%. Consult a tax advisor before acting.
    </div>`;
}

