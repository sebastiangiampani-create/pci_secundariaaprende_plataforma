(() => {
  const LIMITS=Object.freeze({bimester:5,annual:20});
  const DEFAULT_PERIODS_BY_YEAR=Object.freeze({
    2026:Object.freeze([
      Object.freeze({key:'B1',label:'1.º bimestre',start:'2026-03-02',end:'2026-05-07'}),
      Object.freeze({key:'B2',label:'2.º bimestre',start:'2026-05-08',end:'2026-07-17'}),
      Object.freeze({key:'B3',label:'3.º bimestre',start:'2026-08-03',end:'2026-10-02'}),
      Object.freeze({key:'B4',label:'4.º bimestre',start:'2026-10-05',end:'2026-12-04'})
    ])
  });
  const localDate=now=>new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const cleanDni=v=>String(v??'').replace(/\D/g,'');
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
  const valueOf=r=>Number.isFinite(Number(r?.value))?Number(r.value):0;
  const isJustified=r=>r?.justified===true||r?.justified===1||String(r?.justified).toLowerCase()==='true';

  function attendanceRoot(){
    state.institutional=state.institutional||{};
    state.institutional.attendance=state.institutional.attendance||{records:[]};
    state.institutional.attendance.records=Array.isArray(state.institutional.attendance.records)?state.institutional.attendance.records:[];
    return state.institutional.attendance;
  }

  function regularityRoot(){
    const attendance=attendanceRoot();
    attendance.regularity=attendance.regularity||{periodsByYear:{}};
    attendance.regularity.periodsByYear=attendance.regularity.periodsByYear||{};
    return attendance.regularity;
  }

  function normalizePeriods(periods){
    const out=(Array.isArray(periods)?periods:[]).map((p,i)=>({
      key:String(p?.key||('B'+(i+1))).trim(),
      label:String(p?.label||((i+1)+'.º bimestre')).trim(),
      start:iso(p?.start),
      end:iso(p?.end)
    })).filter(p=>p.key&&p.start&&p.end&&p.start<=p.end);
    out.sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
    for(let i=1;i<out.length;i++){
      if(out[i].start<=out[i-1].end)throw new Error('Los períodos de regularidad no pueden superponerse.');
    }
    return out;
  }

  function periodsFor(year){
    const y=Number(year);
    const configured=regularityRoot().periodsByYear?.[y];
    if(Array.isArray(configured)&&configured.length)return normalizePeriods(configured);
    return normalizePeriods(DEFAULT_PERIODS_BY_YEAR[y]||[]);
  }

  function periodSource(year){
    const configured=regularityRoot().periodsByYear?.[Number(year)];
    return Array.isArray(configured)&&configured.length?'configured':(DEFAULT_PERIODS_BY_YEAR[Number(year)]?'official-default':'none');
  }

  function setPeriods(year,periods){
    const y=Number(year);
    if(!Number.isInteger(y)||y<2000||y>2100)throw new Error('Año inválido.');
    const normalized=normalizePeriods(periods);
    if(!normalized.length)throw new Error('Debe existir al menos un período.');
    regularityRoot().periodsByYear[y]=normalized;
    save();
    try{window.dispatchEvent(new CustomEvent('pci-regularity-updated',{detail:{year:y}}))}catch{}
    return clone(normalized);
  }

  function resetPeriods(year){
    delete regularityRoot().periodsByYear[Number(year)];
    save();
    return periodsFor(year);
  }

  function periodForDate(date,periods){
    const d=iso(date);if(!d)return null;
    const list=periods||periodsFor(Number(d.slice(0,4)));
    return list.find(p=>d>=p.start&&d<=p.end)||null;
  }

  function allRecords(){
    const api=window.PCIAttendanceV78;
    if(api?.records){
      try{const records=api.records();if(Array.isArray(records))return records}catch{}
    }
    return attendanceRoot().records;
  }

  function unjustifiedRecords(dni,{year,asOf}={}){
    const id=cleanDni(dni),y=Number(year)||Number(String(asOf||localDate(new Date())).slice(0,4));
    const limit=iso(asOf)||String(y)+'-12-31';
    return allRecords().filter(r=>{
      const d=iso(r?.date);
      return cleanDni(r?.dni)===id&&d&&Number(d.slice(0,4))===y&&d<=limit&&!isJustified(r);
    });
  }

  const sum=records=>records.reduce((n,r)=>n+valueOf(r),0);

  function summarize(dni,options={}){
    const asOf=iso(options.asOf)||localDate(new Date());
    const year=Number(options.year)||Number(asOf.slice(0,4));
    const periods=options.periods?normalizePeriods(options.periods):periodsFor(year);
    const records=unjustifiedRecords(dni,{year,asOf});
    const annual=sum(records);
    const period=options.periodKey
      ? periods.find(p=>p.key===options.periodKey)||null
      : periodForDate(asOf,periods);
    const periodRecords=period?records.filter(r=>r.date>=period.start&&r.date<=period.end):[];
    const bimester=period?sum(periodRecords):0;
    const annualExceeded=annual>LIMITS.annual;
    const bimesterExceeded=!!period&&bimester>LIMITS.bimester;
    return {
      dni:cleanDni(dni),year,asOf,
      status:(annualExceeded||bimesterExceeded)?'No Regular':'Regular',
      regular:!(annualExceeded||bimesterExceeded),
      annual,bimester,
      annualLimit:LIMITS.annual,bimesterLimit:LIMITS.bimester,
      annualExceeded,bimesterExceeded,
      period:period?clone(period):null,
      periodSource:periodSource(year),
      unjustifiedRecords:records.length
    };
  }

  function statusForPeriod(dni,periodKey,year){
    const periods=periodsFor(year),period=periods.find(p=>p.key===periodKey);
    if(!period)throw new Error('Período inexistente.');
    return summarize(dni,{year,asOf:period.end,periodKey});
  }

  function timeline(dni,year){
    return periodsFor(year).map(p=>statusForPeriod(dni,p.key,year));
  }

  window.PCIRegularityV79={
    LIMITS,
    periodsFor,periodSource,setPeriods,resetPeriods,periodForDate,
    unjustifiedRecords,summarize,statusForPeriod,timeline,
    defaultPeriodsFor:year=>clone(DEFAULT_PERIODS_BY_YEAR[Number(year)]||[])
  };
})();