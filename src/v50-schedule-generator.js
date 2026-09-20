(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  const availability=()=>window.PCIAvailabilityV49||null;
  const scheduleGrid=()=>window.PCIScheduleConfigV51||null;
  let semester=1,viewMode='course',selectedView='',refreshTimer=null,observer=null,lastReport=null;
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inst=()=>{state.institutional=state.institutional||{};state.institutional.scheduleVersions=state.institutional.scheduleVersions||{S1:[],S2:[]};state.institutional.activeSchedule=state.institutional.activeSchedule||{};return state.institutional};
  const semKey=()=>`S${semester}`;
  const days=()=>scheduleGrid()?.days?.()||availability()?.days?.()||availability()?.DAYS||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(scheduleGrid()?.periodCount?.()||availability()?.periods?.()||8));
  const slotKey=(day,p)=>`${day}:${p}`;
  const maxForTeacher=t=>Number(t?.baseHours||0)*(1+Number(t?.extraPct??50)/100);
  const gridValidation=()=>scheduleGrid()?.validate?.()||{ok:true,issues:[]};
  const gridSnapshot=()=>scheduleGrid()?.snapshot?.()||{version:1,days:days().map(([id,label])=>({id,label})),slots:Array.from({length:periods()},(_,i)=>({period:i+1,start:'',end:''}))};

  const style=document.createElement('style');style.textContent=`
    .v50-toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}.v50-toolbar label{display:grid;gap:4px;font-size:.62rem;font-weight:850}.v50-toolbar select{padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}.v50-grid-meta{padding:8px 10px;border-radius:9px;background:var(--band);font-size:.61rem;color:var(--muted)}
    .v50-report{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fafcfd}.v50-report.ok{border-color:#b9ddd1;background:#f2fbf7}.v50-report.bad{border-color:#e3bdc5;background:#fff5f7}.v50-report h3{margin:0 0 7px;font-size:.82rem}.v50-report ul{margin:0;padding-left:20px;font-size:.68rem;line-height:1.45}.v50-report p{font-size:.69rem!important}
    .v50-schedule-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v50-schedule-actions button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:.62rem;font-weight:850;color:var(--ink)}.v50-schedule-actions .primary{background:var(--ink);color:#fff;border-color:var(--ink)}.v50-schedule-actions .accept{background:var(--mint-soft);color:var(--mint-dark);border-color:#aadfd7}
    .v50-version{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;padding:10px 12px;border-radius:12px;background:var(--band);font-size:.65rem}.v50-version strong{font-size:.72rem}.v50-badge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#fff;font-size:.58rem;font-weight:900}.v50-badge.active{background:var(--mint-soft);color:var(--mint-dark)}
    .v50-viewbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}.v50-viewbar label{display:grid;gap:4px;font-size:.62rem;font-weight:850}.v50-viewbar select{min-width:240px;padding:8px;border:1px solid var(--line);border-radius:9px}.v50-mode{display:flex;gap:5px}.v50-mode button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:.62rem;font-weight:850}.v50-mode button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
    .v50-grid-wrap{overflow:auto;margin-top:10px;border:1px solid var(--line);border-radius:13px}.v50-grid{width:100%;min-width:820px;border-collapse:collapse;table-layout:fixed;font-size:.61rem}.v50-grid th{padding:8px;background:var(--band);font-size:.56rem;text-transform:uppercase;letter-spacing:.04em}.v50-grid td{height:56px;padding:5px;border-top:1px solid var(--line);border-right:1px solid var(--line);vertical-align:top}.v50-grid td:last-child{border-right:0}.v50-grid .period{width:105px;text-align:center;font-weight:900;background:#fafcfd}.v50-grid .period small{display:block;margin-top:2px;color:var(--muted);font-size:.49rem;font-weight:700}.v50-cell strong{display:block;font-size:.62rem;line-height:1.2}.v50-cell small{display:block;margin-top:3px;color:var(--muted);font-size:.53rem;line-height:1.25}
    .v50-empty-cell{color:#adb8bf;text-align:center;padding-top:12px}.v50-diagnostic{margin-top:8px;color:var(--muted);font-size:.62rem;line-height:1.4}
  `;document.head.appendChild(style);

  function activeTermForYear(year){return Number(year)*2-(semester===1?1:0)}
  function isActiveRow(row){const term=activeTermForYear(row.year);return row.locations?.includes(`C${term}`)||row.locations?.some(x=>String(x).includes('anual'))}
  function demandRows(){
    const root=inst(),assignments=root.assignments||{},teachers=root.teachers||{};
    return (api()?.allImplementationRows?.()||[]).filter(isActiveRow).map(row=>({...row,teacherId:assignments[row.instanceId]||'',teacherName:teachers[assignments[row.instanceId]]?.name||''}));
  }

  function preflight(){
    const rows=demandRows(),root=inst(),teachers=root.teachers||{},issues=[],warnings=[],gridCheck=gridValidation();
    if(!gridCheck.ok)issues.push(...gridCheck.issues.map(x=>`Jornada: ${x}`));
    if(!rows.length)issues.push('No hay instancias curriculares activas para este cuatrimestre.');
    const missingTeacher=rows.filter(r=>!r.teacherId),missingHours=rows.filter(r=>r.hours==null||Number(r.hours)<=0);
    if(missingTeacher.length)issues.push(`${missingTeacher.length} instancia${missingTeacher.length===1?'':'s'} sin docente asignado.`);
    if(missingHours.length)issues.push(`${missingHours.length} instancia${missingHours.length===1?'':'s'} sin carga horaria válida.`);
    const capacity=days().length*periods(),courseMap=new Map(),teacherMap=new Map();
    for(const r of rows){
      const ck=`${r.orientation}|${r.course}`;courseMap.set(ck,(courseMap.get(ck)||0)+(Number(r.hours)||0));
      if(r.teacherId)teacherMap.set(r.teacherId,(teacherMap.get(r.teacherId)||0)+(Number(r.hours)||0));
    }
    for(const [course,h] of courseMap)if(h>capacity)issues.push(`${course.replace('|',' · ')} requiere ${h} horas cátedra y la jornada ofrece ${capacity} posiciones semanales.`);
    for(const [tid,h] of teacherMap){
      const t=teachers[tid];if(!t)continue;
      const free=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>availability()?.available?.(tid,d,i+1)!==false).filter(Boolean).length,0);
      if(h>free)issues.push(`${t.name} necesita ${h} horas cátedra pero declaró solo ${free} disponibles.`);
      const max=maxForTeacher(t);if(max&&h>max)issues.push(`${t.name} tiene ${h} horas cátedra asignadas y supera su máximo ofrecible de ${max.toFixed(1).replace('.0','')}.`);
      else if(max&&h>max*.85)warnings.push(`${t.name} utiliza ${h} de ${max.toFixed(1).replace('.0','')} horas cátedra máximas ofrecibles.`);
    }
    return{ok:!issues.length,issues,warnings,rows,capacity,courseMap,teacherMap};
  }

  function buildUnits(report){
    const teacherSlack={};
    for(const [tid,total] of report.teacherMap){const free=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>availability()?.available?.(tid,d,i+1)!==false).filter(Boolean).length,0);teacherSlack[tid]=free-total}
    const units=[];report.rows.forEach(r=>{for(let i=0;i<Number(r.hours);i++)units.push({...r,unitIndex:i,courseKey:`${r.orientation}|${r.course}`,difficulty:teacherSlack[r.teacherId]??999})});return units;
  }
  function chooseSlot(unit,courseOcc,teacherOcc,instanceDayCount,courseDayLoad,teacherDayLoad){
    const candidates=[];
    for(const [day] of days())for(let p=1;p<=periods();p++){
      const slot=slotKey(day,p);if(courseOcc.get(unit.courseKey)?.has(slot)||teacherOcc.get(unit.teacherId)?.has(slot)||availability()?.available?.(unit.teacherId,day,p)===false)continue;
      const dayKey=`${unit.instanceId}|${day}`,sameDay=instanceDayCount.get(dayKey)||0,cLoad=courseDayLoad.get(`${unit.courseKey}|${day}`)||0,tLoad=teacherDayLoad.get(`${unit.teacherId}|${day}`)||0;
      let score=sameDay*10+cLoad*.7+tLoad*.35+Math.random()*2;
      const teacherSet=teacherOcc.get(unit.teacherId)||new Set(),courseSet=courseOcc.get(unit.courseKey)||new Set();
      if(teacherSet.has(slotKey(day,p-1))||teacherSet.has(slotKey(day,p+1)))score-=1.8;
      if(courseSet.has(slotKey(day,p-1))||courseSet.has(slotKey(day,p+1)))score-=.5;
      const sameInstance=unit.__placed||[];if(sameInstance.some(x=>x.day===day&&Math.abs(x.period-p)===1))score-=3.5;
      if(sameDay>=2)score+=35;
      candidates.push({day,period:p,slot,score});
    }
    candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
  }
  function attempt(report){
    const units=buildUnits(report).sort((a,b)=>a.difficulty-b.difficulty||Number(b.hours)-Number(a.hours)||Math.random()-.5),courseOcc=new Map(),teacherOcc=new Map(),instanceDayCount=new Map(),courseDayLoad=new Map(),teacherDayLoad=new Map(),placedByInstance=new Map(),entries=[];
    const addSet=(map,key,val)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(val)};
    for(const unit of units){
      unit.__placed=placedByInstance.get(unit.instanceId)||[];const pick=chooseSlot(unit,courseOcc,teacherOcc,instanceDayCount,courseDayLoad,teacherDayLoad);if(!pick)return{ok:false,entries,unresolved:units.slice(entries.length)};
      const entry={day:pick.day,period:pick.period,slot:pick.slot,instanceId:unit.instanceId,orientation:unit.orientation,course:unit.course,courseKey:unit.courseKey,subjectId:unit.subjectId,subjectName:unit.name,teacherId:unit.teacherId,teacherName:unit.teacherName,hours:unit.hours};entries.push(entry);
      addSet(courseOcc,unit.courseKey,pick.slot);addSet(teacherOcc,unit.teacherId,pick.slot);
      const dk=`${unit.instanceId}|${pick.day}`;instanceDayCount.set(dk,(instanceDayCount.get(dk)||0)+1);const ck=`${unit.courseKey}|${pick.day}`;courseDayLoad.set(ck,(courseDayLoad.get(ck)||0)+1);const tk=`${unit.teacherId}|${pick.day}`;teacherDayLoad.set(tk,(teacherDayLoad.get(tk)||0)+1);
      if(!placedByInstance.has(unit.instanceId))placedByInstance.set(unit.instanceId,[]);placedByInstance.get(unit.instanceId).push(entry);
    }
    return{ok:true,entries,unresolved:[]};
  }
  function quality(entries){
    let score=0;const byInstance=new Map(),byTeacherDay=new Map();
    for(const e of entries){if(!byInstance.has(e.instanceId))byInstance.set(e.instanceId,[]);byInstance.get(e.instanceId).push(e);const k=`${e.teacherId}|${e.day}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(e.period)}
    for(const list of byInstance.values()){const perDay={};list.forEach(e=>perDay[e.day]=(perDay[e.day]||0)+1);Object.values(perDay).forEach(n=>score+=Math.max(0,n-2)*20+Math.max(0,n-1)*2)}
    for(const ps of byTeacherDay.values()){ps.sort((a,b)=>a-b);if(ps.length>1)score+=(ps[ps.length-1]-ps[0]+1-ps.length)*1.2}return score;
  }

  function generate(){
    const report=preflight();lastReport=report;if(!report.ok){renderSection();return}
    let best=null,bestPartial=null;
    for(let i=0;i<180;i++){const result=attempt(report);if(result.ok){const q=quality(result.entries);if(!best||q<best.quality)best={...result,quality:q};if(q<=1)break}else if(!bestPartial||result.entries.length>bestPartial.entries.length)bestPartial=result}
    if(!best){lastReport={...report,ok:false,issues:[...report.issues,`No se encontró una combinación completa. La mejor tentativa ubicó ${bestPartial?.entries.length||0} de ${buildUnits(report).length} horas cátedra. Revisá jornada, disponibilidades o asignaciones.`]};renderSection();return}
    const schedule={id:`sch-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,semester,createdAt:new Date().toISOString(),status:'draft',grid:gridSnapshot(),periods:periods(),days:days().map(x=>x[0]),entries:best.entries,quality:best.quality};
    const versions=inst().scheduleVersions[semKey()]=inst().scheduleVersions[semKey()]||[];versions.push(schedule);if(versions.length>12)versions.splice(0,versions.length-12);save();lastReport={...report,generated:schedule};renderSection();
  }

  function latest(){const list=inst().scheduleVersions[semKey()]||[];return list[list.length-1]||null}
  function activeSchedule(){const id=inst().activeSchedule[semKey()],list=inst().scheduleVersions[semKey()]||[];return list.find(x=>x.id===id)||null}
  function acceptLatest(){const s=latest();if(!s)return;for(const x of inst().scheduleVersions[semKey()]||[])x.status=x.id===s.id?'active':'draft';inst().activeSchedule[semKey()]=s.id;save();renderSection();toast('Horario aceptado como vigente.')}
  function reportHtml(report){if(!report)return'';const cls=report.ok?'ok':'bad',title=report.ok?'La carga es programable con la jornada y restricciones actuales':'Hay condiciones que impiden generar un horario completo';return`<div class="v50-report ${cls}"><h3>${title}</h3>${report.issues?.length?`<ul>${report.issues.map(x=>`<li>${esc2(x)}</li>`).join('')}</ul>`:'<p>No se detectaron conflictos duros antes de generar.</p>'}${report.warnings?.length?`<div class="v50-diagnostic">${report.warnings.map(x=>`⚠ ${esc2(x)}`).join('<br>')}</div>`:''}</div>`}

  function scheduleDays(schedule){return schedule?.grid?.days?.map(x=>[x.id,x.label])||days()}
  function scheduleSlots(schedule){return schedule?.grid?.slots?.length?schedule.grid.slots:Array.from({length:schedule?.periods||periods()},(_,i)=>({period:i+1,start:'',end:''}))}
  function timeLabel(schedule,p){const s=scheduleSlots(schedule)[p-1];return s&&s.start&&s.end?`${s.start}–${s.end}`:`Hora ${p}`}
  function scheduleView(schedule){
    if(!schedule)return'<div class="v48-empty">Todavía no hay un horario generado para este cuatrimestre.</div>';
    const entries=schedule.entries||[],viewDays=scheduleDays(schedule),viewSlots=scheduleSlots(schedule),options=viewMode==='course'?[...new Map(entries.map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()]:[...new Map(entries.map(e=>[e.teacherId,e.teacherName])).entries()];
    if(!selectedView||!options.some(([id])=>id===selectedView))selectedView=options[0]?.[0]||'';
    const cells=new Map();entries.filter(e=>viewMode==='course'?e.courseKey===selectedView:e.teacherId===selectedView).forEach(e=>cells.set(e.slot,e));
    const grid=`<div class="v50-grid-wrap"><table class="v50-grid"><thead><tr><th>Hora cátedra</th>${viewDays.map(([,l])=>`<th>${esc2(l)}</th>`).join('')}</tr></thead><tbody>${viewSlots.map((_,i)=>{const p=i+1;return`<tr><td class="period">${p}.ª HC<small>${esc2(timeLabel(schedule,p))}</small></td>${viewDays.map(([d])=>{const e=cells.get(slotKey(d,p));return`<td>${e?`<div class="v50-cell"><strong>${esc2(e.subjectName)}</strong><small>${viewMode==='course'?esc2(e.teacherName):`${esc2(e.orientation)} · ${esc2(e.course)}`}</small></div>`:'<div class="v50-empty-cell">—</div>'}</td>`}).join('')}</tr>`}).join('')}</tbody></table></div>`;
    return`<div class="v50-viewbar"><div class="v50-mode"><button data-v50-mode="course" class="${viewMode==='course'?'on':''}">Por curso</button><button data-v50-mode="teacher" class="${viewMode==='teacher'?'on':''}">Por docente</button></div><label>${viewMode==='course'?'Curso':'Docente'}<select id="v50ViewSelect">${options.map(([id,label])=>`<option value="${esc2(id)}" ${id===selectedView?'selected':''}>${esc2(label)}</option>`).join('')}</select></label></div>${grid}`;
  }

  function renderSection(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let section=$id('v50Scheduler');if(!section){section=document.createElement('section');section.id='v50Scheduler';section.className='card v48-section';host.appendChild(section)}
    const schedule=latest(),active=activeSchedule(),report=lastReport;
    section.innerHTML=`<div class="eyebrow">Generador de horarios</div><h2>Horario institucional automático</h2><p>El motor toma de <strong>Fase 1</strong> la carga en horas cátedra y la ubica sobre la jornada configurada por la escuela. Fase 2 conserva íntegramente el desarrollo curricular y no interviene en esta operación.</p><div class="v50-toolbar"><label>Cuatrimestre<select id="v50Semester"><option value="1" ${semester===1?'selected':''}>1.er cuatrimestre</option><option value="2" ${semester===2?'selected':''}>2.º cuatrimestre</option></select></label><div class="v50-grid-meta">Jornada actual: <strong>${periods()} HC por día</strong> · ${days().map(([,l])=>l).join(', ')}</div></div><div class="v50-schedule-actions"><button data-v50-check>Analizar viabilidad</button><button class="primary" data-v50-generate>Generar horario</button>${schedule&&schedule.id!==active?.id?'<button class="accept" data-v50-accept>Aceptar como vigente</button>':''}</div>${reportHtml(report)}${schedule?`<div class="v50-version"><div><strong>${schedule.id===active?.id?'Horario vigente':'Último borrador'}</strong><br>${new Date(schedule.createdAt).toLocaleString('es-AR')} · puntaje de compactación ${Number(schedule.quality||0).toFixed(1)}</div><span class="v50-badge ${schedule.id===active?.id?'active':''}">${schedule.id===active?.id?'Vigente':'Borrador'}</span></div>`:''}${scheduleView(schedule)}`;
    $id('v50Semester').onchange=e=>{semester=Number(e.target.value)||1;lastReport=null;selectedView='';renderSection()};
    section.querySelector('[data-v50-check]').onclick=()=>{lastReport=preflight();renderSection()};
    section.querySelector('[data-v50-generate]').onclick=generate;
    section.querySelector('[data-v50-accept]')?.addEventListener('click',acceptLatest);
    section.querySelectorAll('[data-v50-mode]').forEach(b=>b.onclick=()=>{viewMode=b.dataset.v50Mode;selectedView='';renderSection()});
    $id('v50ViewSelect')?.addEventListener('change',e=>{selectedView=e.target.value;renderSection()});
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(renderSection,80)}
  function start(){scheduleRefresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(scheduleRefresh);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,160));
  window.addEventListener('pci-schedule-grid-changed',()=>{lastReport=null;scheduleRefresh()});
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,160)},true);
  window.PCISchedulerV50={preflight,generate,renderSection,demandRows,latest,activeSchedule};
})();
