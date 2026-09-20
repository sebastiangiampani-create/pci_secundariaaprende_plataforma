(() => {
  const $=id=>document.getElementById(id);
  const scheduler=()=>window.PCIAnnualSchedulerV68||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  const slotKey=(d,p)=>`${d}:${p}`;
  const days=()=>grid()?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const penalty=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const available=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  const uid=()=>`annual-v71-simple-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  let running=false,lastTrial=null;

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};
    r.annualScheduleVersions=r.annualScheduleVersions||[];
    return r;
  }
  function addOcc(map,key,slot){if(!map.has(key))map.set(key,new Set());map.get(key).add(slot)}
  function isFree(map,tid,d,p){return !!tid&&available(tid,d,p)&&!map.get(tid)?.has(slotKey(d,p))}

  function pairCourse(bucket){
    const s1=(bucket.s1||[]).map(x=>({...x})),s2=(bucket.s2||[]).map(x=>({...x})),pairs=[],used=new Set();
    for(const a of s1){
      const j=s2.findIndex((b,i)=>!used.has(i)&&b.instanceId===a.instanceId&&b.unitIndex===a.unitIndex);
      if(j>=0){pairs.push({s1:a,s2:s2[j],courseKey:bucket.courseKey,orientation:bucket.orientation,course:bucket.course});used.add(j);a.__paired=true}
    }
    const r1=s1.filter(x=>!x.__paired),r2=s2.filter((_,i)=>!used.has(i));
    const n=Math.max(r1.length,r2.length);
    for(let i=0;i<n;i++)pairs.push({s1:r1[i]||null,s2:r2[i]||null,courseKey:bucket.courseKey,orientation:bucket.orientation,course:bucket.course});
    return pairs;
  }

  function context(){return{occ1:new Map(),occ2:new Map(),courseOcc:new Map(),entries:[],courseDay:new Map(),teacherClassDay:new Map(),teacherAnyDay:new Map()}}
  function teacherDayKey(tid,d,sem='any'){return`${sem}|${tid}|${d}`}
  function markTeacherDay(ctx,tid,d,kind,sem){
    if(!tid)return;
    const any=teacherDayKey(tid,d);ctx.teacherAnyDay.set(any,(ctx.teacherAnyDay.get(any)||0)+1);
    if(kind==='class'){
      const k=teacherDayKey(tid,d,sem);ctx.teacherClassDay.set(k,(ctx.teacherClassDay.get(k)||0)+1);
      const all=teacherDayKey(tid,d,'both');ctx.teacherClassDay.set(all,(ctx.teacherClassDay.get(all)||0)+1);
    }
  }

  function classChoice(pair,ctx){
    const out=[];
    for(const[d]of days())for(let p=1;p<=periods();p++){
      const slot=slotKey(d,p);if(ctx.courseOcc.get(pair.courseKey)?.has(slot))continue;
      if(pair.s1&&!isFree(ctx.occ1,pair.s1.teacherId,d,p))continue;
      if(pair.s2&&!isFree(ctx.occ2,pair.s2.teacherId,d,p))continue;
      let score=Math.random()*2+(ctx.courseDay.get(`${pair.courseKey}|${d}`)||0)*.4;
      if(pair.s1)score+=penalty(pair.s1.teacherId,d,p)*14;
      if(pair.s2)score+=penalty(pair.s2.teacherId,d,p)*14;
      out.push({day:d,period:p,slot,score});
    }
    out.sort((a,b)=>a.score-b.score);return out[0]||null;
  }
  function placeClasses(report,ctx){
    const pairs=[];for(const bucket of report.courses.values())pairs.push(...pairCourse(bucket));
    pairs.sort(()=>Math.random()-.5);
    for(const pair of pairs){
      const pick=classChoice(pair,ctx);if(!pick)return false;
      ctx.entries.push({type:'classpair',day:pick.day,period:pick.period,slot:pick.slot,courseKey:pair.courseKey,orientation:pair.orientation,course:pair.course,s1:pair.s1,s2:pair.s2});
      addOcc(ctx.courseOcc,pair.courseKey,pick.slot);ctx.courseDay.set(`${pair.courseKey}|${pick.day}`,(ctx.courseDay.get(`${pair.courseKey}|${pick.day}`)||0)+1);
      if(pair.s1){addOcc(ctx.occ1,pair.s1.teacherId,pick.slot);markTeacherDay(ctx,pair.s1.teacherId,pick.day,'class',1)}
      if(pair.s2){addOcc(ctx.occ2,pair.s2.teacherId,pick.slot);markTeacherDay(ctx,pair.s2.teacherId,pick.day,'class',2)}
    }
    return true;
  }

  function teamChoices(team,ctx){
    const members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0),out=[];
    if(members.length<2||!(len>0))return out;
    for(const[d]of days())for(let start=1;start<=periods()-len+1;start++){
      let ok=true,score=Math.random();
      for(const tid of members)for(let p=start;p<start+len;p++){
        if(!isFree(ctx.occ1,tid,d,p)||!isFree(ctx.occ2,tid,d,p)){ok=false;break}
        score+=penalty(tid,d,p)*18;
      }
      if(!ok)continue;
      // Preferir días en los que los integrantes ya vienen a dar clase.
      let noClassMembers=0;
      for(const tid of members)if(!(ctx.teacherClassDay.get(teacherDayKey(tid,d,'both'))>0))noClassMembers++;
      score+=noClassMembers*35;
      out.push({day:d,start,len,members,score});
    }
    return out.sort((a,b)=>a.score-b.score);
  }
  function placeTeams(report,ctx){
    const teams=[...(report.teams||[])].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0)||Number(b.coordinationHours||0)-Number(a.coordinationHours||0));
    for(const team of teams){
      const members=(team.teacherIds||[]).filter(id=>root().teachers[id]);if(members.length<2||!(Number(team.coordinationHours)>0))continue;
      const pick=teamChoices(team,ctx)[0];if(!pick)return false;
      for(let p=pick.start;p<pick.start+pick.len;p++){
        const slot=slotKey(pick.day,p),entry={type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de equipo · ${team.name}`,teacherIds:[...members],teacherNames:members.map(id=>root().teachers[id]?.name||'')};
        ctx.entries.push(entry);for(const tid of members){addOcc(ctx.occ1,tid,slot);addOcc(ctx.occ2,tid,slot);markTeacherDay(ctx,tid,pick.day,'team','both')}
      }
    }
    return true;
  }

  function extraChoice(u,ctx){
    const choices=[];
    for(const[d]of days())for(let p=1;p<=periods();p++){
      if(!isFree(ctx.occ1,u.teacherId,d,p)||!isFree(ctx.occ2,u.teacherId,d,p))continue;
      const classToday=(ctx.teacherClassDay.get(teacherDayKey(u.teacherId,d,'both'))||0)>0;
      const alreadyThere=(ctx.teacherAnyDay.get(teacherDayKey(u.teacherId,d))||0)>0;
      let score=penalty(u.teacherId,d,p)*18+Math.random()*2;
      // Regla fuerte: no abrir un día nuevo solo para horas extra clase.
      if(!classToday&&!alreadyThere)score+=120;
      else if(!classToday)score+=45;
      else score-=25;
      // Compactar: premiar posiciones pegadas a otra ocupación del docente.
      const before=slotKey(d,p-1),after=slotKey(d,p+1);
      const adjacent=(ctx.occ1.get(u.teacherId)?.has(before)||ctx.occ1.get(u.teacherId)?.has(after)||ctx.occ2.get(u.teacherId)?.has(before)||ctx.occ2.get(u.teacherId)?.has(after));
      if(adjacent)score-=18;
      choices.push({day:d,period:p,score});
    }
    choices.sort((a,b)=>a.score-b.score);return choices[0]||null;
  }
  function placeOutside(report,ctx){
    const units=[];for(const x of report.outside||[])for(let i=0;i<Number(x.hours||0);i++)units.push({...x,unitIndex:i});
    units.sort(()=>Math.random()-.5);
    for(const u of units){
      const pick=extraChoice(u,ctx);if(!pick)return false;
      const slot=slotKey(pick.day,pick.period);
      ctx.entries.push({type:'institutional',day:pick.day,period:pick.period,slot,instanceId:u.id,teacherId:u.teacherId,teacherName:root().teachers[u.teacherId]?.name||'',label:u.label});
      addOcc(ctx.occ1,u.teacherId,slot);addOcc(ctx.occ2,u.teacherId,slot);markTeacherDay(ctx,u.teacherId,pick.day,'outside','both');
    }
    return true;
  }

  function quality(entries){
    let q=0;const byTeacherDay=new Map(),classByTeacherDay=new Map();
    const push=(tid,d,p,isClass=false)=>{const k=`${tid}|${d}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(p);if(isClass)classByTeacherDay.set(k,(classByTeacherDay.get(k)||0)+1)};
    for(const e of entries){
      if(e.type==='classpair'){if(e.s1)push(e.s1.teacherId,e.day,e.period,true);if(e.s2)push(e.s2.teacherId,e.day,e.period,true)}
      else if(e.type==='area')for(const tid of e.teacherIds||[])push(tid,e.day,e.period,false);
      else if(e.type==='institutional')push(e.teacherId,e.day,e.period,false);
    }
    for(const[k,ps]of byTeacherDay){ps.sort((a,b)=>a-b);q+=(ps.at(-1)-ps[0]+1-ps.length)*3;if(!(classByTeacherDay.get(k)>0))q+=80}
    return q;
  }
  function attempt(report){const ctx=context();if(!placeClasses(report,ctx))return{ok:false,stage:'classes',entries:ctx.entries};if(!placeTeams(report,ctx))return{ok:false,stage:'teams',entries:ctx.entries};if(!placeOutside(report,ctx))return{ok:false,stage:'outside',entries:ctx.entries};return{ok:true,entries:ctx.entries,quality:quality(ctx.entries)}}
  function solve(report,maxAttempts=900){let best=null,bestPartial=null;for(let i=0;i<maxAttempts;i++){const r=attempt(report);if(r.ok){if(!best||r.quality<best.quality)best=r;if(r.quality<=5)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}return{best,bestPartial}}

  function runTrial(){
    if(running)return;running=true;renderTrial();
    try{
      const api=scheduler();if(!api?.preflight)throw new Error('No está disponible el generador anual.');
      const report=api.preflight({allowMinimumOffer:true});
      if(!report.ok){lastTrial={ok:false,issues:report.issues,warnings:report.warnings};renderTrial();return}
      const solved=solve(report,900);
      if(!solved.best){lastTrial={ok:false,issues:[`No se encontró una grilla completa. La mejor tentativa llegó a ${solved.bestPartial?.entries.length||0} posiciones y se detuvo en ${solved.bestPartial?.stage||'una restricción'}.`],warnings:report.warnings};renderTrial();return}
      const schedule={id:uid(),engine:'v71-simple-fixed-plant',createdAt:new Date().toISOString(),status:'draft',grid:grid()?.snapshot?.(),entries:solved.best.entries,quality:solved.best.quality};
      root().annualScheduleVersions.push(schedule);if(root().annualScheduleVersions.length>12)root().annualScheduleVersions.splice(0,root().annualScheduleVersions.length-12);save();
      lastTrial={ok:true,schedule,warnings:report.warnings};scheduler()?.render?.();renderTrial();toast('Horario de prueba generado: clases primero, encuentros de equipo después y extra clase al final.');
    }catch(e){lastTrial={ok:false,issues:[e.message||String(e)],warnings:[]};renderTrial()}finally{running=false;renderTrial()}
  }

  function renderTrial(){
    const host=$('v68AnnualScheduler');if(!host)return;
    let box=$('v71SimpleTrial');if(!box){box=document.createElement('div');box.id='v71SimpleTrial';box.className='v71-simple-trial';host.prepend(box)}
    let status='';if(lastTrial)status=lastTrial.ok?`<div class="v71-trial-ok"><strong>Prueba generada.</strong> Calidad ${Math.round(lastTrial.schedule?.quality||0)}. Revisá horario por curso y por docente.</div>`:`<div class="v71-trial-bad"><strong>No cerró.</strong>${(lastTrial.issues||[]).map(x=>`<div>• ${String(x)}</div>`).join('')}</div>`;
    box.innerHTML=`<div><strong>Modo simple de prueba</strong><span>Docentes asignados = fijos. Orden: clases → encuentro simultáneo de equipos → extra clase. Evita abrir un día docente solo por extra clase.</span></div><button type="button" class="btn primary" data-v71-simple ${running?'disabled':''}>${running?'Probando…':'Probar horario simple'}</button>${status}`;
    box.querySelector('[data-v71-simple]')?.addEventListener('click',runTrial);
  }
  function burst(){[250,700,1400].forEach(ms=>setTimeout(renderTrial,ms))}
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))burst()},true);
  window.addEventListener('pci-app-ready',burst);burst();

  const style=document.createElement('style');style.textContent=`
    .v71-simple-trial{margin:0 0 12px;padding:12px;border:1px solid #b8d7cf;border-radius:12px;background:#f7fffc;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .v71-simple-trial>div:first-child{flex:1 1 460px}.v71-simple-trial strong{display:block;font-size:.7rem}.v71-simple-trial span{display:block;margin-top:3px;font-size:.56rem;color:var(--muted);line-height:1.4}.v71-trial-ok,.v71-trial-bad{flex:1 1 100%;padding:9px;border-radius:9px;font-size:.58rem}.v71-trial-ok{background:var(--ok-soft);color:var(--ok)}.v71-trial-bad{background:var(--danger-soft);color:var(--danger)}
    @media(max-width:780px){.v71-simple-trial{align-items:stretch}.v71-simple-trial>.btn{width:100%}}
  `;document.head.appendChild(style);
  window.PCISimpleScheduleTrialV71={runTrial,solve};
})();