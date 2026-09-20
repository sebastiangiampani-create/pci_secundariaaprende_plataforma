(() => {
  const $id=id=>document.getElementById(id);
  const work=()=>window.PCIInstitutionalWorkV53||null;
  const contiguous=()=>window.PCIContiguousAreaBlocksV55||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  const offers=()=>window.PCIOfferModelV56||null;
  let observer=null,timer=null,filterMode='all',filterValue='';
  const slotKey=(d,p)=>`${d}:${p}`;
  const semester=()=>Number($id('v53Semester')?.value)||1;
  const days=()=>grid()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const root=()=>{state.institutional=state.institutional||{};state.institutional.scheduleVersions=state.institutional.scheduleVersions||{S1:[],S2:[]};state.institutional.scheduleLocks=state.institutional.scheduleLocks||{S1:[],S2:[]};return state.institutional};
  const locks=()=>root().scheduleLocks[`S${semester()}`]||[];
  const setLocks=list=>{root().scheduleLocks[`S${semester()}`]=list;save()};
  const latest=()=>[...(root().scheduleVersions?.[`S${semester()}`]||[])].reverse().find(x=>x.engine==='v53')||null;
  const addOcc=(map,k,s)=>{if(!map.has(k))map.set(k,new Set());map.get(k).add(s)};
  const isAvailable=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  const prefPenalty=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const dayLabel=id=>days().find(([d])=>d===id)?.[1]||id;
  const periodLabel=p=>grid()?.slotLabel?.(p)||`HC ${p}`;
  const lockIdentity=e=>e.type==='area'?`area|${e.areaId}|${e.day}|${e.period}`:`${e.type}|${e.instanceId}|${e.day}|${e.period}`;
  const copyEntry=e=>JSON.parse(JSON.stringify(e));

  function currentData(){
    const sem=semester(),base=contiguous()?.preflight?.()||{rows:[],outside:[],teams:[],issues:[],warnings:[],ok:false,sem};
    const issues=[...(base.issues||[])],warnings=[...(base.warnings||[])];
    for(const t of Object.values(root().teachers||{})){const o=offers()?.offer?.(t.id,sem);if(o?.conflict)issues.push(`${t.name}: el mínimo obligatorio fuera de curso supera el máximo del 50 %.`)}
    return{...base,issues,warnings,ok:!issues.length,sem};
  }
  function validateLocks(report){
    const issues=[],teacherOcc=new Map(),courseOcc=new Map(),valid=[];
    const rowCount=new Map(),outsideCount=new Map();
    for(const r of report.rows||[])rowCount.set(r.instanceId,Number(r.hours||0));
    for(const r of report.outside||[])outsideCount.set(r.id,Number(r.hours||0));
    const seenCounts=new Map();
    const teams=new Map((report.teams||[]).map(t=>[t.id,t]));
    for(const lock of locks()){
      const k=lock.type==='area'?`area:${lock.areaId}`:`${lock.type}:${lock.instanceId}`;
      seenCounts.set(k,(seenCounts.get(k)||0)+1);
      if(lock.type==='class'&&!rowCount.has(lock.instanceId)){issues.push(`Bloque fijado “${lock.label||lock.subjectName}” ya no pertenece a la estructura actual.`);continue}
      if(lock.type==='institutional'&&!outsideCount.has(lock.instanceId)){issues.push(`Bloque institucional fijado “${lock.label}” ya no pertenece a la oferta actual.`);continue}
      if(lock.type==='area'&&!teams.has(lock.areaId)){issues.push(`El encuentro fijado “${lock.label}” ya no corresponde a un equipo activo.`);continue}
      const tids=lock.type==='area'?(lock.teacherIds||[]):[lock.teacherId];
      const slot=slotKey(lock.day,lock.period);
      let conflict=false;
      for(const tid of tids){if(!isAvailable(tid,lock.day,lock.period)){issues.push(`${root().teachers?.[tid]?.name||'Docente'} no está disponible en un bloque fijado (${dayLabel(lock.day)} ${periodLabel(lock.period)}).`);conflict=true;break}if(teacherOcc.get(tid)?.has(slot)){issues.push(`Hay dos bloques fijados para ${root().teachers?.[tid]?.name||'un docente'} en ${dayLabel(lock.day)} ${periodLabel(lock.period)}.`);conflict=true;break}}
      if(lock.courseKey&&courseOcc.get(lock.courseKey)?.has(slot)){issues.push(`Hay dos bloques fijados para ${lock.courseKey.replace('|',' · ')} en ${dayLabel(lock.day)} ${periodLabel(lock.period)}.`);conflict=true}
      if(conflict)continue;
      valid.push(lock);for(const tid of tids)addOcc(teacherOcc,tid,slot);if(lock.courseKey)addOcc(courseOcc,lock.courseKey,slot);
    }
    for(const [key,count] of seenCounts){if(key.startsWith('class:')){const id=key.slice(6);if(count>(rowCount.get(id)||0))issues.push(`Hay más bloques fijados que horas requeridas para ${id}.`)}if(key.startsWith('institutional:')){const id=key.slice(14);if(count>(outsideCount.get(id)||0))issues.push(`Hay más bloques fijados que horas institucionales requeridas para ${id}.`)}}
    for(const team of report.teams||[]){const group=valid.filter(x=>x.type==='area'&&x.areaId===team.id);if(group.length){const expected=Number(team.coordinationHours||0),sameDay=group.every(x=>x.day===group[0].day),periodsList=group.map(x=>Number(x.period)).sort((a,b)=>a-b),contiguousBlock=periodsList.every((p,i)=>i===0||p===periodsList[i-1]+1);if(group.length!==expected||!sameDay||!contiguousBlock)issues.push(`${team.name}: el encuentro fijado debe conservar un bloque continuo completo de ${expected} HC.`)}}
    return{ok:!issues.length,issues,valid,teacherOcc,courseOcc};
  }
  function preflight(){const report=currentData(),lv=validateLocks(report);return{...report,issues:[...(report.issues||[]),...lv.issues],ok:report.ok&&lv.ok,lockValidation:lv}}

  function teamCandidates(team,teacherOcc){
    const members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]),len=Number(team.coordinationHours||3),out=[];
    for(const[d]of days())for(let start=1;start<=periods()-len+1;start++){let ok=true,score=Math.random();for(const tid of members)for(let p=start;p<start+len;p++){if(!isAvailable(tid,d,p)||teacherOcc.get(tid)?.has(slotKey(d,p))){ok=false;break}score+=prefPenalty(tid,d,p)*8}if(ok)out.push({day:d,start,len,members,score})}
    return out.sort((a,b)=>a.score-b.score);
  }
  function seedLocks(report){
    const lv=report.lockValidation||validateLocks(report),teacherOcc=new Map(),courseOcc=new Map(),teacherDayLoad=new Map(),courseDayLoad=new Map(),placed=new Map(),entries=[];
    for(const lock of lv.valid||[]){const e={...copyEntry(lock),locked:true},slot=slotKey(e.day,e.period);entries.push(e);const tids=e.type==='area'?(e.teacherIds||[]):[e.teacherId];for(const tid of tids){addOcc(teacherOcc,tid,slot);teacherDayLoad.set(`${tid}|${e.day}`,(teacherDayLoad.get(`${tid}|${e.day}`)||0)+1)}if(e.courseKey){addOcc(courseOcc,e.courseKey,slot);courseDayLoad.set(`${e.courseKey}|${e.day}`,(courseDayLoad.get(`${e.courseKey}|${e.day}`)||0)+1)}if(e.instanceId){if(!placed.has(e.instanceId))placed.set(e.instanceId,[]);placed.get(e.instanceId).push(e)}}
    return{teacherOcc,courseOcc,teacherDayLoad,courseDayLoad,placed,entries};
  }
  function placeTeams(report,ctx){
    for(const team of report.teams||[]){const members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]);if(members.length<2)continue;if(ctx.entries.some(e=>e.type==='area'&&e.areaId===team.id))continue;const picks=teamCandidates(team,ctx.teacherOcc);if(!picks.length)return false;const pick=picks[0],names=members.map(id=>root().teachers[id]?.name||'').filter(Boolean);for(let p=pick.start;p<pick.start+pick.len;p++){const slot=slotKey(pick.day,p),e={type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de área · ${team.name}`,teacherIds:[...members],teacherNames:names,blockLength:pick.len};ctx.entries.push(e);for(const tid of members){addOcc(ctx.teacherOcc,tid,slot);ctx.teacherDayLoad.set(`${tid}|${pick.day}`,(ctx.teacherDayLoad.get(`${tid}|${pick.day}`)||0)+1)}}}
    return true;
  }
  function buildUnits(report,ctx){
    const used=new Map();for(const e of ctx.entries){if(!e.instanceId||e.type==='area')continue;const k=`${e.type}|${e.instanceId}`;used.set(k,(used.get(k)||0)+1)}
    const out=[];
    for(const r of report.rows||[]){const total=Number(r.hours||0),skip=used.get(`class|${r.instanceId}`)||0;for(let i=skip;i<total;i++)out.push({type:'class',instanceId:r.instanceId,teacherId:r.teacherId,teacherName:r.teacherName,orientation:r.orientation,course:r.course,courseKey:`${r.orientation}|${r.course}`,subjectId:r.subjectId,label:r.name})}
    for(const x of report.outside||[]){const total=Number(x.hours||0),skip=used.get(`institutional|${x.id}`)||0;for(let i=skip;i<total;i++)out.push({type:'institutional',instanceId:x.id,teacherId:x.teacherId,teacherName:root().teachers?.[x.teacherId]?.name||'',label:x.label})}
    return out.sort(()=>Math.random()-.5);
  }
  function choose(unit,ctx){
    const choices=[];for(const[d]of days())for(let p=1;p<=periods();p++){const slot=slotKey(d,p);if(!isAvailable(unit.teacherId,d,p)||ctx.teacherOcc.get(unit.teacherId)?.has(slot)||unit.courseKey&&ctx.courseOcc.get(unit.courseKey)?.has(slot))continue;const previous=ctx.placed.get(unit.instanceId)||[],sameDay=previous.filter(x=>x.day===d).length;let score=prefPenalty(unit.teacherId,d,p)*9+sameDay*7+(ctx.teacherDayLoad.get(`${unit.teacherId}|${d}`)||0)*.35+(unit.courseKey?(ctx.courseDayLoad.get(`${unit.courseKey}|${d}`)||0):0)*.45+Math.random()*1.5;if(previous.some(x=>x.day===d&&Math.abs(x.period-p)===1))score-=2.3;if(sameDay>=2)score+=35;choices.push({day:d,period:p,slot,score})}choices.sort((a,b)=>a.score-b.score);return choices[0]||null;
  }
  function attempt(report){
    const ctx=seedLocks(report);if(!placeTeams(report,ctx))return{ok:false,entries:ctx.entries};
    for(const unit of buildUnits(report,ctx)){const pick=choose(unit,ctx);if(!pick)return{ok:false,entries:ctx.entries};const e={type:unit.type,day:pick.day,period:pick.period,slot:pick.slot,instanceId:unit.instanceId,teacherId:unit.teacherId,teacherName:unit.teacherName,label:unit.label};if(unit.type==='class')Object.assign(e,{orientation:unit.orientation,course:unit.course,courseKey:unit.courseKey,subjectId:unit.subjectId,subjectName:unit.label});ctx.entries.push(e);addOcc(ctx.teacherOcc,unit.teacherId,pick.slot);if(unit.courseKey)addOcc(ctx.courseOcc,unit.courseKey,pick.slot);ctx.teacherDayLoad.set(`${unit.teacherId}|${pick.day}`,(ctx.teacherDayLoad.get(`${unit.teacherId}|${pick.day}`)||0)+1);if(unit.courseKey)ctx.courseDayLoad.set(`${unit.courseKey}|${pick.day}`,(ctx.courseDayLoad.get(`${unit.courseKey}|${pick.day}`)||0)+1);if(!ctx.placed.has(unit.instanceId))ctx.placed.set(unit.instanceId,[]);ctx.placed.get(unit.instanceId).push(e)}return{ok:true,entries:ctx.entries};
  }
  function quality(entries){let score=0;const byTeacherDay=new Map(),byInstance=new Map();for(const e of entries){const tids=e.type==='area'?(e.teacherIds||[]):[e.teacherId];for(const tid of tids){score+=prefPenalty(tid,e.day,e.period)*10;const k=`${tid}|${e.day}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(e.period)}if(e.instanceId){if(!byInstance.has(e.instanceId))byInstance.set(e.instanceId,[]);byInstance.get(e.instanceId).push(e)}}for(const ps of byTeacherDay.values()){ps.sort((a,b)=>a-b);if(ps.length>1)score+=(ps.at(-1)-ps[0]+1-ps.length)*1.2}for(const rows of byInstance.values()){const c={};rows.forEach(e=>c[e.day]=(c[e.day]||0)+1);Object.values(c).forEach(n=>score+=Math.max(0,n-2)*22)}return score}
  function renderReport(report){const section=$id('v53Scheduler');if(!section)return;section.querySelector('.v62-report')?.remove();const box=document.createElement('div');box.className=`v53-report v62-report ${report.ok?'ok':'bad'}`;box.innerHTML=`<h3>${report.ok?'Horario regenerable con los bloques fijados actuales':'Los bloques fijados o las restricciones requieren revisión'}</h3>${report.issues?.length?`<ul>${report.issues.map(x=>`<li>${String(x)}</li>`).join('')}</ul>`:'<p>Los bloques fijados se conservarán exactamente; el resto será regenerado.</p>'}${report.warnings?.length?`<div class="v53-warning">${report.warnings.map(x=>`⚠ ${String(x)}`).join('<br>')}</div>`:''}`;section.querySelector('.v62-actions')?.after(box)}
  function generate(){const report=preflight();renderReport(report);if(!report.ok)return;let best=null,bestPartial=null;for(let i=0;i<450;i++){const r=attempt(report);if(r.ok){const q=quality(r.entries);if(!best||q<best.quality)best={...r,quality:q};if(q<.5)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}if(!best){renderReport({...report,ok:false,issues:[...(report.issues||[]),`No se encontró una combinación completa manteniendo los bloques fijados. La mejor tentativa ubicó ${bestPartial?.entries.length||0} posiciones.`]});return}const sem=report.sem||semester(),key=`S${sem}`,schedule={id:`sch62-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,engine:'v53',generator:'v62-lock-aware-optimizer',semester:sem,createdAt:new Date().toISOString(),status:'draft',grid:grid()?.snapshot?.(),entries:best.entries,quality:best.quality};const versions=root().scheduleVersions[key]=root().scheduleVersions[key]||[];versions.push(schedule);if(versions.length>12)versions.splice(0,versions.length-12);save();work()?.renderScheduler?.();setTimeout(()=>{decorate();renderLocks();renderReport(report)},100);toast('Horario regenerado conservando los bloques fijados.')}

  function addLock(entry){const list=locks();if(entry.type==='area'){const s=latest();const block=(s?.entries||[]).filter(e=>e.type==='area'&&e.areaId===entry.areaId&&e.day===entry.day);const ids=new Set(list.map(lockIdentity));for(const e of block)if(!ids.has(lockIdentity(e)))list.push(copyEntry(e))}else if(!list.some(x=>lockIdentity(x)===lockIdentity(entry)))list.push(copyEntry(entry));setLocks(list);renderLocks()}
  function removeLock(id){setLocks(locks().filter(e=>lockIdentity(e)!==id));renderLocks()}
  function clearLocks(){setLocks([]);renderLocks()}
  function filterOptions(schedule){const courses=[...new Map((schedule?.entries||[]).filter(e=>e.type==='class').map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()],teachers=Object.values(root().teachers||{}).map(t=>[t.id,t.name]);return{courses,teachers}}
  function visibleEntries(schedule){let rows=schedule?.entries||[];if(filterMode==='course'&&filterValue)rows=rows.filter(e=>e.courseKey===filterValue);if(filterMode==='teacher'&&filterValue)rows=rows.filter(e=>e.teacherId===filterValue||(e.teacherIds||[]).includes(filterValue));const seen=new Set();return rows.filter(e=>{if(e.type==='area'){const k=`area|${e.areaId}|${e.day}`;if(seen.has(k))return false;seen.add(k)}return true}).slice(0,120)}
  function renderLocks(){
    const section=$id('v53Scheduler');if(!section)return;let box=$id('v62Locks');if(!box){box=document.createElement('div');box.id='v62Locks';box.className='v62-locks';const view=section.querySelector('.v53-viewbar');if(view)view.before(box);else section.appendChild(box)}const s=latest(),list=locks(),opts=filterOptions(s);if(!s){box.innerHTML='<strong>Bloques fijados</strong><p>Generá un horario para comenzar a fijar bloques.</p>';return}const options=filterMode==='course'?opts.courses:filterMode==='teacher'?opts.teachers:[];if(filterValue&&!options.some(([id])=>id===filterValue))filterValue='';const fixedIds=new Set(list.map(lockIdentity));box.innerHTML=`<div class="v62-lock-head"><div><strong>Bloques fijados · ${list.length}</strong><small>Podés fijar clases, trabajo institucional o un bloque completo de equipo y regenerar solamente el resto.</small></div>${list.length?'<button data-clear>Quitar todos los fijados</button>':''}</div><div class="v62-filters"><select data-mode><option value="all" ${filterMode==='all'?'selected':''}>Todos</option><option value="course" ${filterMode==='course'?'selected':''}>Filtrar por curso</option><option value="teacher" ${filterMode==='teacher'?'selected':''}>Filtrar por docente</option></select>${filterMode!=='all'?`<select data-value><option value="">Todos</option>${options.map(([id,l])=>`<option value="${id}" ${id===filterValue?'selected':''}>${l}</option>`).join('')}</select>`:''}</div><div class="v62-lock-list">${visibleEntries(s).map(e=>{const id=lockIdentity(e),fixed=e.type==='area'?list.some(x=>x.type==='area'&&x.areaId===e.areaId&&x.day===e.day):fixedIds.has(id);return`<div class="v62-lock-row ${fixed?'fixed':''}"><div><strong>${e.type==='area'?e.label:e.subjectName||e.label}</strong><small>${e.type==='class'?`${e.orientation} · ${e.course} · ${e.teacherName}`:e.type==='area'?`${dayLabel(e.day)} · bloque de equipo`:`${e.teacherName}`} · ${dayLabel(e.day)} ${periodLabel(e.period)}</small></div><button data-entry="${encodeURIComponent(JSON.stringify(e))}" data-fixed="${fixed?'1':'0'}" data-id="${encodeURIComponent(id)}">${fixed?'Liberar':'Fijar'}</button></div>`}).join('')}</div>`;box.querySelector('[data-clear]')?.addEventListener('click',clearLocks);box.querySelector('[data-mode]').onchange=e=>{filterMode=e.target.value;filterValue='';renderLocks()};box.querySelector('[data-value]')?.addEventListener('change',e=>{filterValue=e.target.value;renderLocks()});box.querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>{const e=JSON.parse(decodeURIComponent(b.dataset.entry));if(b.dataset.fixed==='1'){if(e.type==='area')setLocks(locks().filter(x=>!(x.type==='area'&&x.areaId===e.areaId&&x.day===e.day)));else removeLock(decodeURIComponent(b.dataset.id))}else addLock(e);renderLocks()})
  }
  function decorate(){const section=$id('v53Scheduler');if(!section)return;section.querySelectorAll('.v61-actions,[data-v53-generate],[data-v53-check]').forEach(x=>x.style.display='none');let actions=section.querySelector('.v62-actions');if(!actions){actions=document.createElement('div');actions.className='v53-actions v62-actions';actions.innerHTML='<button type="button" data-v62-check>Analizar con bloques fijados</button><button type="button" class="primary" data-v62-generate>Regenerar horario</button>';section.querySelector('.v53-actions')?.after(actions)}actions.querySelector('[data-v62-check]').onclick=()=>renderReport(preflight());actions.querySelector('[data-v62-generate]').onclick=generate;renderLocks()}
  const style=document.createElement('style');style.textContent='.v62-locks{margin-top:12px;padding:11px;border:1px solid var(--line);border-radius:12px;background:#fafcfd}.v62-lock-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v62-lock-head small{display:block;margin-top:3px;color:var(--muted);font-size:.56rem}.v62-lock-head button,.v62-lock-row button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:5px 8px;font-size:.55rem;font-weight:850}.v62-filters{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v62-filters select{padding:6px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:.58rem}.v62-lock-list{display:grid;gap:5px;max-height:300px;overflow:auto;margin-top:8px}.v62-lock-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:.58rem}.v62-lock-row.fixed{background:var(--mint-soft);border-color:#b9d9d5}.v62-lock-row small{display:block;margin-top:2px;color:var(--muted)}';document.head.appendChild(style);
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,70)}function start(){refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:true})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,650));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,300)},true);
  window.PCIScheduleLocksV62={locks,preflight,generate,renderLocks,decorate};
})();
