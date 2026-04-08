// ── page-goals.js — Goal Planner ───────────────────────────────────────────

// ── Goal Planner ──────────────────────────────────────────────
let chartGoalInst=null;

function renderGoalPlanner(){
  // Initialise slider display values
  updateGoal();
}

function updateGoal(){
  const corpus=parseInt(document.getElementById('goal-corpus').value)||10000000;
  const year=parseInt(document.getElementById('goal-year').value)||2035;
  const rate=parseFloat(document.getElementById('goal-rate').value)||12;

  document.getElementById('goal-corpus-val').textContent=fmtL(corpus);
  document.getElementById('goal-year-val').textContent=year;
  document.getElementById('goal-rate-val').textContent=rate.toFixed(1)+'%';

  const k=DATA.kpis;
  const currentVal=k.totalValue||0;
  const nowYear=new Date().getFullYear();
  const yrsLeft=Math.max(0.5,year-nowYear);
  const r=rate/100;

  // Monthly SIP needed to reach (corpus - FV of current portfolio) given rate
  // FV of current: currentVal*(1+r)^yrs
  const fvCurrent=currentVal*Math.pow(1+r,yrsLeft);
  const remaining=Math.max(0,corpus-fvCurrent);
  // SIP formula: PMT = FV * r/12 / ((1+r/12)^(n)-1)
  const rM=r/12, n=yrsLeft*12;
  const sipNeeded=remaining>0&&rM>0?Math.round(remaining*rM/(Math.pow(1+rM,n)-1)):0;

  // Current trajectory: FV if we keep investing avg monthly
  const allMonths=buildCombinedMonthly();
  const avgMonthly=allMonths.length?Math.round(allMonths.reduce((a,x)=>a+x.v,0)/allMonths.filter(x=>x.v>0).length):0;
  const fvWithSip=currentVal*Math.pow(1+r,yrsLeft)+(avgMonthly*((Math.pow(1+rM,n)-1)/rM)*(1+rM));

  const onTrack=fvWithSip>=corpus;
  const gap=corpus-fvWithSip;

  document.getElementById('goal-result-box').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">SIP needed</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:var(--gold)">${sipNeeded>0?fmtL(sipNeeded)+'/mo':'Already on track!'}</div></div>
      <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Projected at current pace</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:${onTrack?'var(--green)':'var(--red)'}">${fmtL(Math.round(fvWithSip))}</div></div>
    </div>
    <div style="font-size:11px;color:${onTrack?'var(--green)':'var(--amber)'}">
      ${onTrack
        ?`✓ On track! Your current avg SIP of ${fmtL(avgMonthly)}/mo will reach ${fmtL(Math.round(fvWithSip))} by ${year} — ${fmtL(Math.round(fvWithSip-corpus))} surplus.`
        :`You need to increase SIP by ${fmtL(Math.max(0,sipNeeded-avgMonthly))}/mo. Current trajectory falls short by ${fmtL(Math.round(gap))}.`
      }
    </div>`;

  // Projection chart
  renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded);

  // Summary KPIs
  document.getElementById('goal-summary-kpis').innerHTML=[
    {l:'Goal Corpus',      v:fmtL(corpus),          s:'Target by '+year,             a:'#d4a843'},
    {l:'Current Portfolio',v:fmtL(currentVal),      s:'As of today',                  a:'#58a6ff'},
    {l:'Years Remaining',  v:yrsLeft.toFixed(1)+'y',s:'To target date',               a:'#a371f7'},
    {l:'SIP Required',     v:sipNeeded>0?fmtL(sipNeeded)+'/mo':'On track!', s:'At '+rate+'% p.a.',  a:sipNeeded>0?'#f85149':'#3fb950'},
    {l:'Projected Value',  v:fmtL(Math.round(fvWithSip)), s:onTrack?'Exceeds goal':'Below goal', a:onTrack?'#3fb950':'#f85149'},
    {l:'Avg Current SIP',  v:avgMonthly?fmtL(avgMonthly)+'/mo':'—', s:'Historical monthly avg', a:'#7d8590'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub">${c.s}</div></div>`).join('');

  // Scenarios
  const rates=[8,10,12,15,18];
  const maxSip=Math.max(...rates.map(rt=>{
    const rv=rt/100, rMv=rv/12;
    const fvC=currentVal*Math.pow(1+rv,yrsLeft);
    const rem=Math.max(0,corpus-fvC);
    return rem>0&&rMv>0?Math.round(rem*rMv/(Math.pow(1+rMv,n)-1)):0;
  }),1);
  document.getElementById('goal-scenarios').innerHTML=rates.map(rt=>{
    const rv=rt/100, rMv=rv/12;
    const fvC=currentVal*Math.pow(1+rv,yrsLeft);
    const rem=Math.max(0,corpus-fvC);
    const sip=rem>0&&rMv>0?Math.round(rem*rMv/(Math.pow(1+rMv,n)-1)):0;
    const isSelected=Math.abs(rt-rate)<1;
    return `<div class="goal-scenario-row">
      <span class="goal-scen-rate" style="color:${isSelected?'var(--gold)':'var(--muted)'}">${rt}% p.a.${isSelected?' ◀':''}</span>
      <span class="goal-scen-sip" style="color:${sip===0?'var(--green)':'var(--text)'}">${sip>0?fmtL(sip)+'/mo':'On track!'}</span>
      <div class="goal-scen-bar"><div class="goal-scen-fill" style="width:${sip>0?Math.round(sip/maxSip*100):0}%"></div></div>
      <span class="goal-scen-note">${sip>0?'vs avg '+fmtL(avgMonthly):fmtL(Math.round(currentVal*Math.pow(1+rv,yrsLeft)))}</span>
    </div>`;
  }).join('');

  // Milestones: 25%, 50%, 75%, 100% of goal
  const milestones=[0.25,0.50,0.75,1.0];
  document.getElementById('goal-milestones').innerHTML=milestones.map(pct=>{
    const target=corpus*pct;
    const reached=currentVal>=target;
    // Year when FV of current + SIP reaches target
    let reachYear=null;
    for(let y2=nowYear;y2<=2060;y2++){
      const yrs2=y2-nowYear;
      const fv=currentVal*Math.pow(1+r,yrs2)+(avgMonthly*((Math.pow(1+rM,yrs2*12)-1)/rM)*(1+rM));
      if(fv>=target){reachYear=y2;break;}
    }
    const dotColor=reached?'var(--green)':reachYear?'var(--gold)':'var(--red)';
    return `<div class="milestone-row">
      <div class="milestone-dot" style="background:${dotColor}"></div>
      <span class="milestone-year">${Math.round(pct*100)}%</span>
      <span class="milestone-corpus" style="color:var(--text)">${fmtL(target)}</span>
      <span class="milestone-status" style="color:${dotColor}">${reached?'✓ Reached':reachYear?'Est. '+reachYear:'Beyond '+year}</span>
    </div>`;
  }).join('');
}

function renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded){
  setTimeout(()=>{
    const el=document.getElementById('chart-goal');
    if(!el||!window.Chart) return;
    if(chartGoalInst) chartGoalInst.destroy();
    const r=rate/100, rM=r/12;
    const nowYear=new Date().getFullYear();
    const labels=[], actualTraj=[], sipTraj=[], goalLine=[];
    for(let y=nowYear;y<=year;y++){
      const yrs=y-nowYear;
      const n2=yrs*12;
      const fvCurrent=currentVal*Math.pow(1+r,yrs);
      const fvActual=fvCurrent+(avgMonthly>0?avgMonthly*((Math.pow(1+rM,n2)-1)/rM)*(1+rM):0);
      const fvSip=fvCurrent+(sipNeeded>0?sipNeeded*((Math.pow(1+rM,n2)-1)/rM)*(1+rM):fvCurrent);
      labels.push(y);
      actualTraj.push(Math.round(fvActual));
      sipTraj.push(sipNeeded>0?Math.round(fvSip):null);
      goalLine.push(corpus);
    }
    const datasets=[
      {label:'Goal',data:goalLine,borderColor:'#f85149',borderWidth:1.5,borderDash:[6,4],pointRadius:0,fill:false,tension:0},
      {label:'Current pace',data:actualTraj,borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,.07)',borderWidth:2,pointRadius:0,fill:true,tension:0.3},
    ];
    if(sipNeeded>0) datasets.push({label:'With required SIP',data:sipTraj,borderColor:'#3fb950',backgroundColor:'rgba(63,185,80,.06)',borderWidth:2,pointRadius:0,fill:true,tension:0.3,borderDash:[3,2]});
    chartGoalInst=new Chart(el,{
      type:'line',data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:true,position:'top',labels:{color:'#7d8590',font:{size:10},boxWidth:12,padding:10}},
          tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtL(ctx.raw)},backgroundColor:'#1c2330',titleColor:'#e6edf3',bodyColor:'#7d8590',borderColor:'#30363d',borderWidth:1}},
        scales:{
          x:{ticks:{font:{size:9},color:'#7d8590'},grid:{color:'#21262d'}},
          y:{ticks:{font:{size:9},color:'#7d8590',callback:v=>fmtL(v)},grid:{color:'#21262d'}}
        }}
    });
  },60);
}

