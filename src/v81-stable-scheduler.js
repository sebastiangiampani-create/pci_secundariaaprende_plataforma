(() => {
  const $=id=>document.getElementById(id);
  const base=()=>window.PCIAnnualSchedulerV65||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  const offer=()=>window.PCIAnnualOfferV65||null;
  let lastCheck=null,timer=null,observer=null;

  const slot=(d,p)=>`${d}:${p}`;
  const days=()=>grid()?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const available=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  const penalty=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const deep=x=>JSON.parse(JSON.stringify(x));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};
    r.assignments=r.assignments||{};
    r.areaTeams=r.areaTeams||{};
    r.annualScheduleVersions=Array.isArray(r.annualScheduleVersions)?r.annualScheduleVersions:[];
    r.activeAnnualScheduleId=r.activeAnnualScheduleId||'';
    return r;
  }
  const teachers=()=>Object.values(root().teachers||{});
  const latest=()=>root().annualScheduleVersions.at(-1)||null;
  const active=()=>root().annualScheduleVersions.find(x=>x.id===root().activeAnnualScheduleId)||null;
  function addOcc(map,key,value){if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(value)}
  function free(map,tid,d,p){return !!tid&&available(tid,d,p)&&!map.get(tid)?.has(slot(d,p))}

  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
    return value;
  }
  function hash(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }
  function sourceSignature(){
    teamsApi()?.deriveTeams?.();
    const r=root(),rows=window.PCIInstitutionalV48?.allImplementationRows?.()||[];
    const payload={
      assignments:r.assignments,
      teachers:Object.values(r.teachers||{}).map(t=>({id:t.id,name:t.name||'',offerAnnualPct:t.offerAnnualPct??null,meetingHours:t.meetingHours??null,cargos:t.cargos||[],cargoType:t.cargoType||'',manualHours:t.manualHours||0})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),
      rows:rows.map(x=>({instanceId:x.instanceId,orientation:x.orientation,course:x.course,subjectId:x.subjectId,name:x.name,hours:x.hours,locations:x.locations||[]})).sort((a,b)=>String(a.instanceId).localeCompare(String(b.instanceId))),
      teams:Object.values(r.areaTeams||{}).map(t=>({id:t.id,coordinationHours:t.coordinationHours,teacherIds:[...(t.teacherIds||[])].sort()})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),
      availability:r.availability||{},
      preferences:r.availabilityPreferences||{},
      scheduleConfig:r.scheduleConfig||{},
      outside:r.outsideWork||{},
      syntheticOutside:offer()?.syntheticOutsideRows?.()||[]
    };
    return hash(JSON.stringify(stable(payload)));
  }

  function rowSemesters(row){
    if(Array.isArray(row.semesters)&&row.semesters.length)return row.semesters;
    if((row.locations||[]).some(x=>String(x).toLowerCase().includes('anual')))return[1,2];
    const out=new Set();
    for(const loc of row.locations||[]){const m=String(loc).match(/C(\d+)/i);if(m)out.add(Number(m[1])%2?1:2)}
    return out.size?[...out]:[1,2];
  }
  function pairRank(row){
    const ns=(row.locations||[]).map(x=>String(x).match(/C(\d+)/i)).filter(Boolean).map(m=>Number(m[1]));
    return ns.length?Math.min(...ns.map(n=>Math.ceil(n/2))):0;
  }
  function unit(row,sem,i){
    const tid=row.teacherId||root().assignments[row.instanceId]||'';
    return{instanceId:row.instanceId,teacherId:tid,teacherName:row.teacherName||root().teachers[tid]?.name||'',orientation:row.orientation,course:row.course,courseKey:`${row.orientation}|${row.course}`,subjectId:row.subjectId,name:row.name,unitIndex:i,sem,pairRank:pairRank(row)};
  }
  function buildPairs(report){
    const courses=new Map(),crossRank=[];
    for(const row of report.rows||[]){
      const key=`${row.orientation}|${row.course}`;
      if(!courses.has(key))courses.set(key,{courseKey:key,orientation:row.orientation,course:row.course,s1:[],s2:[]});
      const b=courses.get(key),h=Number(row.hours||0);
      for(let i=0;i<h;i++)for(const sem of rowSemesters(row))b[`s${sem}`].push(unit(row,sem,i));
    }
    const pairs=[];
    for(const b of courses.values()){
      const s1=[...b.s1],s2=[...b.s2],u1=new Set(),u2=new Set();
      for(let i=0;i<s1.length;i++){
        const a=s1[i],j=s2.findIndex((x,k)=>!u2.has(k)&&x.instanceId===a.instanceId&&x.unitIndex===a.unitIndex);
        if(j>=0){u1.add(i);u2.add(j);pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:a,s2:s2[j]})}
      }
      const r1=s1.map((x,i)=>({x,i})).filter(o=>!u1.has(o.i)),r2=s2.map((x,i)=>({x,i})).filter(o=>!u2.has(o.i));
      while(r1.length){
        const a=r1.shift().x;let best=-1,bestScore=Infinity;
        for(let j=0;j<r2.length;j++){
          const z=r2[j].x;
          let score=Math.abs((a.pairRank||0)-(z.pairRank||0))*30;
          if(a.pairRank&&z.pairRank&&a.pairRank===z.pairRank)score-=20;
          if(norm(a.name)===norm(z.name))score-=3;
          if(score<bestScore){bestScore=score;best=j}
        }
        const z=best>=0?r2.splice(best,1)[0].x:null;
        if(z&&a.pairRank&&z.pairRank&&a.pairRank!==z.pairRank)crossRank.push(`${b.orientation} · ${b.course}: ${a.name} con ${z.name}`);
        pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:a,s2:z});
      }
      for(const o of r2)pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:null,s2:o.x});
    }
    return{pairs,crossRank,courses};
  }

  function teacherFrontLoads(rows){
    const load={};
    for(const row of rows||[]){
      const tid=row.teacherId||root().assignments[row.instanceId]||'';if(!tid)continue;
      load[tid]=load[tid]||{s1:0,s2:0};
      for(const sem of rowSemesters(row))load[tid][`s${sem}`]+=Number(row.hours||0);
    }
    return load;
  }

  function preflight(){
    teamsApi()?.deriveTeams?.();
    const b=base()?.preflight?.()||{ok:false,issues:['No está disponible el generador anual base.'],warnings:[],rows:[],teams:[],outside:[]};
    const issues=[...(b.issues||[])],warnings=[...(b.warnings||[])],loads=teacherFrontLoads(b.rows||[]);
    for(const [tid,l] of Object.entries(loads)){
      if(l.s1!==l.s2)issues.push(`${root().teachers[tid]?.name||'Docente'}: la carga frente a curso difiere entre cuatrimestres (${l.s1}/${l.s2} HC). Para un horario personal anual estable debe coincidir.`);
    }
    const built=buildPairs(b);
    if(built.crossRank.length)warnings.push(`${built.crossRank.length} emparejamiento${built.crossRank.length===1?'':'s'} cruzan pares temporales de Fase 1; conviene revisar la estructura curricular.`);
    return{...b,issues,warnings,ok:!issues.length,v81Pairs:built.pairs,v81CrossRank:built.crossRank,sourceSignature:sourceSignature()};
  }

  function teamChoices(team,ctx){
    const members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0),out=[];
    if(members.length<2||!(len>0))return out;
    for(const[d]of days())for(let start=1;start<=periods()-len+1;start++){
      let ok=true,score=Math.random();
      for(const tid of members)for(let p=start;p<start+len;p++){if(!free(ctx.o1,tid,d,p)||!free(ctx.o2,tid,d,p)){ok=false;break}score+=penalty(tid,d,p)*12}
      if(ok)out.push({day:d,start,len,members,score});
    }
    return out.sort((a,b)=>a.score-b.score);
  }
  function placeTeams(report,ctx){
    for(const team of [...(report.teams||[])].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0))){
      const pick=teamChoices(team,ctx)[0],members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0);
      if(members.length<2||!(len>0))continue;
      if(!pick)return false;
      for(let p=pick.start;p<pick.start+pick.len;p++){
        const sk=slot(pick.day,p);
        ctx.entries.push({type:'area',day:pick.day,period:p,slot:sk,areaId:team.id,label:`Encuentro de equipo · ${team.name}`,teacherIds:[...members],teacherNames:members.map(id=>root().teachers[id]?.name||'')});
        for(const tid of members){addOcc(ctx.o1,tid,sk);addOcc(ctx.o2,tid,sk)}
      }
    }
    return true;
  }
  function placeOutside(report,ctx){
    const units=[];
    for(const x of report.outside||[])for(let i=0;i<Number(x.hours||0);i++)units.push({...x,unitIndex:i});
    units.sort(()=>Math.random()-.5);
    for(const u of units){
      const choices=[];
      for(const[d]of days())for(let p=1;p<=periods();p++){
        if(!free(ctx.o1,u.teacherId,d,p)||!free(ctx.o2,u.teacherId,d,p))continue;
        const score=penalty(u.teacherId,d,p)*12+(ctx.dayLoad.get(`${u.teacherId}|${d}`)||0)*.4+Math.random()*1.5;
        choices.push({day:d,period:p,score});
      }
      choices.sort((a,b)=>a.score-b.score);const pick=choices[0];if(!pick)return false;
      const sk=slot(pick.day,pick.period);
      ctx.entries.push({type:'institutional',day:pick.day,period:pick.period,slot:sk,instanceId:u.id,teacherId:u.teacherId,teacherName:root().teachers[u.teacherId]?.name||'',label:u.label});
      addOcc(ctx.o1,u.teacherId,sk);addOcc(ctx.o2,u.teacherId,sk);ctx.dayLoad.set(`${u.teacherId}|${pick.day}`,(ctx.dayLoad.get(`${u.teacherId}|${pick.day}`)||0)+1);
    }
    return true;
  }
  function pairChoices(pair,ctx){
    const out=[];
    for(const[d]of days())for(let p=1;p<=periods();p++){
      const sk=slot(d,p);
      if(ctx.course.get(pair.courseKey)?.has(sk))continue;
      if(pair.s1&&!free(ctx.o1,pair.s1.teacherId,d,p))continue;
      if(pair.s2&&!free(ctx.o2,pair.s2.teacherId,d,p))continue;
      let score=Math.random()*1.2+(ctx.courseDay.get(`${pair.courseKey}|${d}`)||0)*.45;
      if(pair.s1){
        score+=penalty(pair.s1.teacherId,d,p)*10+(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${d}`)||0)*.3;
        if(pair.s1.teacherId!==pair.s2?.teacherId)score+=ctx.o2.get(pair.s1.teacherId)?.has(sk)?-8:1.5;
      }
      if(pair.s2){
        score+=penalty(pair.s2.teacherId,d,p)*10+(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${d}`)||0)*.3;
        if(pair.s2.teacherId!==pair.s1?.teacherId)score+=ctx.o1.get(pair.s2.teacherId)?.has(sk)?-8:1.5;
      }
      out.push({day:d,period:p,slot:sk,score});
    }
    return out.sort((a,b)=>a.score-b.score);
  }
  function placePairs(report,ctx){
    const pairs=[...(report.v81Pairs||buildPairs(report).pairs)].sort((a,b)=>{
      const aa=a.s1&&a.s2&&a.s1.teacherId!==a.s2.teacherId?0:1,bb=b.s1&&b.s2&&b.s1.teacherId!==b.s2.teacherId?0:1;
      return aa-bb||Math.random()-.5;
    });
    for(const pair of pairs){
      const pick=pairChoices(pair,ctx)[0];if(!pick)return false;
      ctx.entries.push({type:'classpair',day:pick.day,period:pick.period,slot:pick.slot,courseKey:pair.courseKey,orientation:pair.orientation,course:pair.course,s1:pair.s1,s2:pair.s2});
      addOcc(ctx.course,pair.courseKey,pick.slot);ctx.courseDay.set(`${pair.courseKey}|${pick.day}`,(ctx.courseDay.get(`${pair.courseKey}|${pick.day}`)||0)+1);
      if(pair.s1){addOcc(ctx.o1,pair.s1.teacherId,pick.slot);ctx.dayLoad.set(`1|${pair.s1.teacherId}|${pick.day}`,(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${pick.day}`)||0)+1)}
      if(pair.s2){addOcc(ctx.o2,pair.s2.teacherId,pick.slot);ctx.dayLoad.set(`2|${pair.s2.teacherId}|${pick.day}`,(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${pick.day}`)||0)+1)}
    }
    return true;
  }

  function teacherSlotSets(entries){
    const a=new Map(),b=new Map(),both=(tid,sk)=>{addOcc(a,tid,sk);addOcc(b,tid,sk)};
    for(const e of entries){
      const sk=slot(e.day,e.period);
      if(e.type==='area')for(const tid of e.teacherIds||[])both(tid,sk);
      else if(e.type==='institutional')both(e.teacherId,sk);
      else{if(e.s1)addOcc(a,e.s1.teacherId,sk);if(e.s2)addOcc(b,e.s2.teacherId,sk)}
    }
    return{a,b};
  }
  function continuity(entries){
    const {a,b}=teacherSlotSets(entries),mismatches=[];
    for(const t of teachers()){
      const x=a.get(t.id)||new Set(),y=b.get(t.id)||new Set(),only1=[...x].filter(s=>!y.has(s)),only2=[...y].filter(s=>!x.has(s));
      if(only1.length||only2.length)mismatches.push({teacherId:t.id,name:t.name,only1,only2,count:only1.length+only2.length});
    }
    return{ok:!mismatches.length,mismatches,total:mismatches.reduce((n,x)=>n+x.count,0)};
  }
  function quality(entries){
    let q=0;const by=new Map();
    for(const e of entries){
      const tids=e.type==='area'?(e.teacherIds||[]):e.type==='institutional'?[e.teacherId]:[e.s1?.teacherId,e.s2?.teacherId].filter(Boolean);
      for(const tid of tids){
        q+=penalty(tid,e.day,e.period)*8;
        const k=`${tid}|${e.day}`;if(!by.has(k))by.set(k,[]);by.get(k).push(Number(e.period));
      }
    }
    for(const ps of by.values()){const u=[...new Set(ps)].sort((a,b)=>a-b);if(u.length>1)q+=(u.at(-1)-u[0]+1-u.length)*1.1}
    return q;
  }
  function attempt(report){
    const ctx={o1:new Map(),o2:new Map(),course:new Map(),dayLoad:new Map(),courseDay:new Map(),entries:[]};
    if(!placeTeams(report,ctx))return{ok:false,entries:ctx.entries,reason:'teams'};
    if(!placeOutside(report,ctx))return{ok:false,entries:ctx.entries,reason:'outside'};
    if(!placePairs(report,ctx))return{ok:false,entries:ctx.entries,reason:'classes'};
    const c=continuity(ctx.entries);return{ok:c.ok,entries:ctx.entries,continuity:c,quality:quality(ctx.entries),reason:c.ok?'':'continuity'};
  }
  function solve(report,maxAttempts=1400){
    let best=null,bestPartial=null,bestContinuity=null;
    for(let i=0;i<maxAttempts;i++){
      const r=attempt(report);
      if(r.ok){if(!best||r.quality<best.quality)best=r;if(r.quality<.5)break}
      else{
        const placed=r.entries.length,delta=r.continuity?.total??999999;
        if(!bestPartial||placed>bestPartial.entries.length||placed===bestPartial.entries.length&&delta<(bestPartial.continuity?.total??999999))bestPartial=r;
        if(r.continuity&&(!bestContinuity||r.continuity.total<bestContinuity.continuity.total))bestContinuity=r;
      }
    }
    return{best,bestPartial,bestContinuity};
  }

  function generate(){
    const report=preflight();lastCheck=report;
    if(!report.ok){decorate();toast('Hay condiciones pendientes antes de generar el horario anual.',true);return null}
    const solved=solve(report);
    if(!solved.best){
      const c=solved.bestContinuity?.continuity;
      lastCheck={...report,ok:false,issues:[...(report.issues||[]),c?`La mejor combinación dejó ${c.total} diferencias entre las posiciones del 1.er y 2.º cuatrimestre.`:`La mejor tentativa ubicó ${solved.bestPartial?.entries.length||0} posiciones, pero no logró completar la grilla.`]};
      decorate();toast('No se encontró una grilla anual estrictamente estable con las restricciones actuales.',true);return null;
    }
    const schedule={
      id:`annual-v81-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      engine:'v81-annual-stable',
      generator:'strict-annual-continuity',
      createdAt:new Date().toISOString(),
      status:'draft',
      grid:grid()?.snapshot?.(),
      entries:solved.best.entries,
      quality:solved.best.quality,
      continuity:'teacher-slots-identical',
      sourceSignature:report.sourceSignature,
      diagnostics:{positions:solved.best.entries.length,crossRank:report.v81CrossRank?.length||0}
    };
    root().annualScheduleVersions.push(schedule);
    if(root().annualScheduleVersions.length>12)root().annualScheduleVersions.splice(0,root().annualScheduleVersions.length-12);
    save();lastCheck={...report,generated:schedule};
    base()?.render?.();setTimeout(decorate,80);
    toast('Borrador anual V81 generado. Revisalo por curso y por docente antes de marcarlo vigente.');
    return schedule;
  }

  function isStale(schedule=active()){
    return !!schedule&&schedule.sourceSignature!==sourceSignature();
  }
  function acceptLatest(){
    const s=latest();if(!s)return toast('Primero generá un horario anual.',true);
    if(s.engine!=='v81-annual-stable')return toast('Generá primero un horario V81 estable.',true);
    if(isStale(s))return toast('El borrador quedó desactualizado por cambios en Gestión. Regeneralo antes de marcarlo vigente.',true);
    for(const x of root().annualScheduleVersions)x.status=x.id===s.id?'active':'draft';
    root().activeAnnualScheduleId=s.id;save();base()?.render?.();setTimeout(decorate,60);toast('Horario anual marcado como vigente y sincronizado.');
  }

  function status(){
    const a=active(),l=latest();
    if(a)return{state:isStale(a)?'stale':'active',label:isStale(a)?'Vigente desactualizado':'Horario vigente',active:a,latest:l};
    if(l)return{state:'draft',label:'Borrador generado',active:null,latest:l};
    return{state:'empty',label:'Pendiente de generar',active:null,latest:null};
  }

  function reportHtml(){
    if(!lastCheck)return'';
    const ok=lastCheck.ok;
    return `<div class="v81-check ${ok?'ok':'bad'}"><strong>${ok?'Viabilidad estricta confirmada':'Hay condiciones pendientes'}</strong>${lastCheck.issues?.length?`<div>${lastCheck.issues.slice(0,10).map(x=>`• ${String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}`).join('<br>')}</div>`:'<span>La jornada, las asignaciones, la disponibilidad y la continuidad anual son compatibles.</span>'}${lastCheck.warnings?.length?`<small>${lastCheck.warnings.slice(0,5).map(x=>`⚠ ${String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}`).join('<br>')}</small>`:''}</div>`;
  }

  function decorate(){
    const section=$('v65AnnualScheduler');if(!section)return;
    const eye=section.querySelector('.eyebrow');if(eye&&eye.textContent!=='Horario institucional · anual · V81 estable')eye.textContent='Horario institucional · anual · V81 estable';
    const h=section.querySelector('h2');if(h&&h.textContent!=='Constructor automático de horario anual')h.textContent='Constructor automático de horario anual';
    const p=section.querySelector('h2 + p');
    const copy='Genera una única grilla para toda la escuela respetando jornada, docentes, disponibilidad, preferencias, reuniones de equipo y trabajo institucional. El horario personal de cada docente conserva exactamente las mismas posiciones en ambos cuatrimestres.';
    if(p&&p.textContent!==copy)p.textContent=copy;
    const gen=section.querySelector('[data-v65-generate]');if(gen)gen.textContent='Generar borrador automático';
    const check=section.querySelector('[data-v65-check]');if(check)check.textContent='Analizar viabilidad';
    const accept=section.querySelector('[data-v65-accept]');if(accept)accept.textContent='Marcar como vigente';
    const actions=section.querySelector('.v65-actions');
    let report=$('v81ScheduleCheck');
    if(lastCheck){
      const html=reportHtml();
      if(!report){const w=document.createElement('div');w.innerHTML=html;report=w.firstElementChild;if(report){report.id='v81ScheduleCheck';actions?.after(report)}}
      else if(report.outerHTML.replace(' id="v81ScheduleCheck"','')!==html)report.outerHTML=html.replace('class="v81-check','id="v81ScheduleCheck" class="v81-check');
    }else report?.remove();
    let box=$('v81ScheduleStatus');
    const st=status(),a=st.active,l=st.latest;
    const html=`<div><strong>${st.label}</strong><span>${st.state==='active'?'La versión vigente coincide con los datos actuales de Gestión.':st.state==='stale'?'Cambió al menos una fuente del horario. Conservamos la versión vigente, pero debe regenerarse antes de presentarla como actual.':st.state==='draft'?'Hay un borrador para revisar antes de activarlo.':'Todavía no se generó una versión anual.'}</span></div>${a?`<small>Vigente: ${new Date(a.createdAt).toLocaleString('es-AR')} · ${a.entries?.length||0} posiciones</small>`:l?`<small>Último borrador: ${new Date(l.createdAt).toLocaleString('es-AR')} · ${l.entries?.length||0} posiciones</small>`:''}`;
    if(!box){box=document.createElement('div');box.id='v81ScheduleStatus';box.className='v81-status';section.querySelector('.v65-actions')?.before(box)}
    box.className=`v81-status ${st.state}`;if(box.innerHTML!==html)box.innerHTML=html;
  }

  function intercept(e){
    if(e.target.closest('[data-v65-check]')){e.preventDefault();e.stopImmediatePropagation();lastCheck=preflight();decorate();return}
    if(e.target.closest('[data-v65-generate]')){e.preventDefault();e.stopImmediatePropagation();generate();return}
    if(e.target.closest('[data-v65-accept]')){e.preventDefault();e.stopImmediatePropagation();acceptLatest();return}
  }
  document.addEventListener('click',intercept,true);
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,80)}
  function start(){
    base()?.render?.();setTimeout(decorate,80);
    const section=$('v65AnnualScheduler');
    if(section&&!observer){observer=new MutationObserver(refresh);observer.observe(section,{childList:true,subtree:true})}
  }
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1250));
  window.addEventListener('pci-schedule-grid-changed',()=>{lastCheck=null;refresh()});
  document.addEventListener('change',e=>{
    if(e.target.closest('[data-v48-assignment],[data-v65-pct],[data-v60-av],[data-day],[data-v51],[data-v51-day]')){lastCheck=null;setTimeout(refresh,100)}
  },true);
  setTimeout(start,2100);

  const style=document.createElement('style');
  style.textContent=`
    .v81-status{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding:11px 13px;border:1px solid var(--line);border-radius:13px;background:var(--band)}
    .v81-status strong{display:block;font-size:.72rem}.v81-status span{display:block;margin-top:3px;color:var(--muted);font-size:.58rem;line-height:1.4}.v81-status small{white-space:nowrap;color:var(--muted);font-size:.54rem}
    .v81-status.active{background:var(--ok-soft);border-color:#b9dfcc}.v81-status.active strong{color:var(--ok)}
    .v81-status.stale{background:#fff8df;border-color:#dfc476}.v81-status.stale strong{color:#765b18}
    .v81-status.draft{background:#eef6fb;border-color:#bdd7e7}
    .v81-check{margin-top:10px;padding:10px 11px;border-radius:11px;background:var(--band);font-size:.58rem;line-height:1.45}.v81-check.ok{background:var(--ok-soft);color:var(--ok)}.v81-check.bad{background:var(--danger-soft);color:var(--danger)}.v81-check strong{display:block;font-size:.68rem;margin-bottom:3px}.v81-check small{display:block;margin-top:5px}
    @media(max-width:720px){.v81-status{align-items:flex-start;flex-direction:column}.v81-status small{white-space:normal}}
  `;
  document.head.appendChild(style);

  window.PCIScheduleStableV81={preflight,buildPairs,teacherFrontLoads,continuity,solve,generate,latest,active,sourceSignature,isStale,acceptLatest,status,decorate};
})();