(() => {
  const $id=id=>document.getElementById(id);
  const work=()=>window.PCIInstitutionalWorkV53||null;
  const contiguous=()=>window.PCIContiguousAreaBlocksV55||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  const offers=()=>window.PCIOfferModelV56||null;
  let observer=null,timer=null,lastReport=null;
  const slotKey=(d,p)=>`${d}:${p}`;
  const semester=()=>Number($id('v53Semester')?.value)||1;
  const days=()=>grid()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const root=()=>{state.institutional=state.institutional||{};state.institutional.scheduleVersions=state.institutional.scheduleVersions||{S1:[],S2:[]};return state.institutional};
  const addOcc=(map,k,s)=>{if(!map.has(k))map.set(k,new Set());map.get(k).add(s)};
  const prefPenalty=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const isAvailable=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;

  function preflight(){
    const base=contiguous()?.preflight?.()||{ok:false,issues:['No se pudo analizar la estructura de horarios.'],warnings:[],rows:[],outside:[],teams:[],sem:semester()};
    const issues=[...(base.issues||[])],warnings=[...(base.warnings||[])],sem=base.sem||semester();
    for(const t of Object.values(root().teachers||{})){const o=offers()?.offer?.(t.id,sem);if(o?.conflict)issues.push(`${t.name}: el mínimo obligatorio fuera de curso (${o.minimumOutside} HC) supera el máximo del 50 % (${o.maxOutside} HC).`)}
    return{...base,issues,warnings,ok:!issues.length};
  }
  function teamCandidates(team,teacherOcc){
    const blocks=contiguous()?.commonBlocks?.(team,teacherOcc)||[],members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]);
    return blocks.map(b=>({...b,score:members.reduce((sum,tid)=>sum+Array.from({length:b.len},(_,i)=>prefPenalty(tid,b.day,b.start+i)).reduce((a,x)=>a+x,0),0)+Math.random()})).sort((a,b)=>a.score-b.score);
  }
  function placeTeams(report,teacherOcc,teacherDayLoad,entries){
    const teams=[...(report.teams||[])].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0)||Number(b.coordinationHours||0)-Number(a.coordinationHours||0));
    for(const team of teams){const members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]);if(members.length<2)continue;const picks=teamCandidates(team,teacherOcc);if(!picks.length)return false;const pick=picks[0],names=members.map(id=>root().teachers[id]?.name||'').filter(Boolean);for(let p=pick.start;p<pick.start+pick.len;p++){const slot=slotKey(pick.day,p);entries.push({type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de área · ${team.name}`,teacherIds:[...members],teacherNames:names,blockLength:pick.len});for(const tid of members){addOcc(teacherOcc,tid,slot);const k=`${tid}|${pick.day}`;teacherDayLoad.set(k,(teacherDayLoad.get(k)||0)+1)}}}
    return true;
  }
  function buildUnits(report){
    const out=[];
    for(const r of report.rows||[])for(let i=0;i<Number(r.hours||0);i++)out.push({type:'class',instanceId:r.instanceId,teacherId:r.teacherId,teacherName:r.teacherName,orientation:r.orientation,course:r.course,courseKey:`${r.orientation}|${r.course}`,subjectId:r.subjectId,label:r.name});
    for(const x of report.outside||[])for(let i=0;i<Number(x.hours||0);i++)out.push({type:'institutional',instanceId:x.id,teacherId:x.teacherId,teacherName:root().teachers?.[x.teacherId]?.name||'',label:x.label});
    return out.sort(()=>Math.random()-.5);
  }
  function choose(unit,teacherOcc,courseOcc,placed,teacherDayLoad,courseDayLoad){
    const choices=[];
    for(const[d]of days())for(let p=1;p<=periods();p++){
      const slot=slotKey(d,p);if(!isAvailable(unit.teacherId,d,p)||teacherOcc.get(unit.teacherId)?.has(slot)||unit.courseKey&&courseOcc.get(unit.courseKey)?.has(slot))continue;
      const previous=placed.get(unit.instanceId)||[],sameDay=previous.filter(x=>x.day===d).length,tDay=teacherDayLoad.get(`${unit.teacherId}|${d}`)||0,cDay=unit.courseKey?(courseDayLoad.get(`${unit.courseKey}|${d}`)||0):0;
      let score=prefPenalty(unit.teacherId,d,p)*8+sameDay*7+tDay*.35+cDay*.45+Math.random()*1.8;
      if(previous.some(x=>x.day===d&&Math.abs(x.period-p)===1))score-=2.2;
      if(sameDay>=2)score+=35;
      const occupied=teacherOcc.get(unit.teacherId)||new Set();if(occupied.has(slotKey(d,p-1))||occupied.has(slotKey(d,p+1)))score-=.7;
      choices.push({day:d,period:p,slot,score});
    }
    choices.sort((a,b)=>a.score-b.score);return choices[0]||null;
  }
  function attempt(report){
    const teacherOcc=new Map(),courseOcc=new Map(),teacherDayLoad=new Map(),courseDayLoad=new Map(),placed=new Map(),entries=[];
    if(!placeTeams(report,teacherOcc,teacherDayLoad,entries))return{ok:false,entries};
    for(const unit of buildUnits(report)){
      const pick=choose(unit,teacherOcc,courseOcc,placed,teacherDayLoad,courseDayLoad);if(!pick)return{ok:false,entries};
      const e={type:unit.type,day:pick.day,period:pick.period,slot:pick.slot,instanceId:unit.instanceId,teacherId:unit.teacherId,teacherName:unit.teacherName,label:unit.label};if(unit.type==='class')Object.assign(e,{orientation:unit.orientation,course:unit.course,courseKey:unit.courseKey,subjectId:unit.subjectId,subjectName:unit.label});entries.push(e);addOcc(teacherOcc,unit.teacherId,pick.slot);if(unit.courseKey)addOcc(courseOcc,unit.courseKey,pick.slot);teacherDayLoad.set(`${unit.teacherId}|${pick.day}`,(teacherDayLoad.get(`${unit.teacherId}|${pick.day}`)||0)+1);if(unit.courseKey)courseDayLoad.set(`${unit.courseKey}|${pick.day}`,(courseDayLoad.get(`${unit.courseKey}|${pick.day}`)||0)+1);if(!placed.has(unit.instanceId))placed.set(unit.instanceId,[]);placed.get(unit.instanceId).push(e);
    }
    return{ok:true,entries};
  }
  function quality(entries){
    let score=0;const byTeacherDay=new Map(),byInstance=new Map();
    for(const e of entries){const tids=e.type==='area'?(e.teacherIds||[]):[e.teacherId];for(const tid of tids){score+=prefPenalty(tid,e.day,e.period)*10;const k=`${tid}|${e.day}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(e.period)}if(e.instanceId){if(!byInstance.has(e.instanceId))byInstance.set(e.instanceId,[]);byInstance.get(e.instanceId).push(e)}}
    for(const ps of byTeacherDay.values()){ps.sort((a,b)=>a-b);if(ps.length>1)score+=(ps.at(-1)-ps[0]+1-ps.length)*1.2}
    for(const rows of byInstance.values()){const counts={};rows.forEach(e=>counts[e.day]=(counts[e.day]||0)+1);Object.values(counts).forEach(n=>score+=Math.max(0,n-2)*22+Math.max(0,n-1)*1.2)}
    return score;
  }
  function renderReport(report){
    const section=$id('v53Scheduler');if(!section)return;section.querySelector('.v61-report')?.remove();const box=document.createElement('div');box.className=`v53-report v61-report ${report.ok?'ok':'bad'}`;box.innerHTML=`<h3>${report.ok?'La carga completa es compatible con las restricciones actuales':'Hay condiciones que impiden optimizar el horario'}</h3>${report.issues?.length?`<ul>${report.issues.map(x=>`<li>${String(x)}</li>`).join('')}</ul>`:'<p>Se respetan indisponibilidades duras; las franjas “preferentemente no” se penalizan y se usan solo cuando mejora o permite la solución.</p>'}${report.warnings?.length?`<div class="v53-warning">${report.warnings.map(x=>`⚠ ${String(x)}`).join('<br>')}</div>`:''}`;section.querySelector('.v61-actions')?.after(box);
  }
  function generate(){
    const report=preflight();lastReport=report;renderReport(report);if(!report.ok)return;
    let best=null,bestPartial=null;
    for(let i=0;i<420;i++){const r=attempt(report);if(r.ok){const q=quality(r.entries);if(!best||q<best.quality)best={...r,quality:q};if(q<.5)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}
    if(!best){renderReport({...report,ok:false,issues:[...(report.issues||[]),`No se encontró una combinación completa. La mejor tentativa ubicó ${bestPartial?.entries.length||0} posiciones. Revisá disponibilidad y distribución de carga.`]});return}
    const sem=report.sem||semester(),key=`S${sem}`,schedule={id:`sch61-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,engine:'v53',generator:'v61-preference-optimizer',semester:sem,createdAt:new Date().toISOString(),status:'draft',grid:grid()?.snapshot?.(),entries:best.entries,quality:best.quality};const versions=root().scheduleVersions[key]=root().scheduleVersions[key]||[];versions.push(schedule);if(versions.length>12)versions.splice(0,versions.length-12);save();work()?.renderScheduler?.();setTimeout(()=>{decorate();renderReport(report)},80);toast('Nuevo borrador optimizado generado.');
  }
  function decorate(){
    const section=$id('v53Scheduler');if(!section)return;section.querySelectorAll('[data-v53-generate],[data-v53-check]').forEach(b=>b.style.display='none');
    let actions=section.querySelector('.v61-actions');if(!actions){actions=document.createElement('div');actions.className='v53-actions v61-actions';actions.innerHTML='<button type="button" data-v61-check>Analizar con preferencias</button><button type="button" class="primary" data-v61-generate>Generar horario optimizado</button>';section.querySelector('.v53-actions')?.after(actions)}
    actions.querySelector('[data-v61-check]').onclick=()=>{lastReport=preflight();renderReport(lastReport)};actions.querySelector('[data-v61-generate]').onclick=generate;
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,60)}
  function start(){refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:true})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,520));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,260)},true);
  window.PCIScheduleOptimizerV61={preflight,generate,quality,decorate};
})();
