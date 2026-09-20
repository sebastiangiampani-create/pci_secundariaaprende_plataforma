(() => {
  const $id=id=>document.getElementById(id);
  const pciApi=()=>window.PCIInstitutionalV48||null;
  const offers=()=>window.PCIAnnualOfferV65||null;
  const autoTeams=()=>window.PCIAutoAreaCoincidenceV54||null;
  const staff=()=>window.PCIStaffPlanningV68||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  let observer=null,timer=null,lastReport=null,viewMode='course',selectedView='';

  const slotKey=(d,p)=>`${d}:${p}`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days=()=>grid()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const available=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  const penalty=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const uid=()=>`annual-v68-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const deep=x=>JSON.parse(JSON.stringify(x));

  function root(){state.institutional=state.institutional||{};const r=state.institutional;r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};r.annualScheduleVersions=r.annualScheduleVersions||[];r.activeAnnualScheduleId=r.activeAnnualScheduleId||'';return r}
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  function teams(){
    return Object.values(root().areaTeams||{}).map(t=>{
      const derived=staff()?.teamCommonHours?.(t.id),coordinationHours=Number.isFinite(Number(derived))?Number(derived):Number(t.coordinationHours||0);
      return{...t,coordinationHours};
    }).filter(t=>Number(t.coordinationHours)>0&&(t.teacherIds||[]).length>0);
  }
  const allRows=()=>pciApi()?.allImplementationRows?.()||[];
  function semesters(row){if((row.locations||[]).some(x=>String(x).toLowerCase().includes('anual')))return[1,2];const out=new Set();for(const loc of row.locations||[]){const m=String(loc).match(/C(\d+)/i);if(m)out.add(Number(m[1])%2?1:2)}return out.size?[...out]:[1,2]}
  function classRows(){return allRows().map(r=>({...r,teacherId:root().assignments[r.instanceId]||'',teacherName:root().teachers[root().assignments[r.instanceId]]?.name||'',semesters:semesters(r)}))}
  function addOcc(map,key,slot){if(!map.has(key))map.set(key,new Set());map.get(key).add(slot)}
  function free(map,tid,d,p){return !!tid&&available(tid,d,p)&&!map.get(tid)?.has(slotKey(d,p))}
  function preference(tid,d,p){return tid?penalty(tid,d,p):0}

  function expandedByCourse(rows){
    const courses=new Map();
    for(const r of rows){
      const key=`${r.orientation}|${r.course}`;
      if(!courses.has(key))courses.set(key,{courseKey:key,orientation:r.orientation,course:r.course,s1:[],s2:[]});
      const bucket=courses.get(key);
      for(const sem of r.semesters||[])for(let i=0;i<Number(r.hours||0);i++)bucket[`s${sem}`].push({instanceId:r.instanceId,teacherId:r.teacherId,teacherName:r.teacherName,orientation:r.orientation,course:r.course,courseKey:key,subjectId:r.subjectId,name:r.name,unitIndex:i,sem});
    }
    return courses;
  }
  function pairCourse(bucket){
    const s1=[...bucket.s1],s2=[...bucket.s2],pairs=[],used2=new Set();
    for(const a of s1){const j=s2.findIndex((b,idx)=>!used2.has(idx)&&b.instanceId===a.instanceId&&b.unitIndex===a.unitIndex);if(j>=0){pairs.push({s1:a,s2:s2[j],courseKey:bucket.courseKey,orientation:bucket.orientation,course:bucket.course});used2.add(j);a.__paired=true}}
    const r1=s1.filter(x=>!x.__paired),r2=s2.filter((_,i)=>!used2.has(i));
    r1.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));r2.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
    const n=Math.max(r1.length,r2.length);for(let i=0;i<n;i++)pairs.push({s1:r1[i]||null,s2:r2[i]||null,courseKey:bucket.courseKey,orientation:bucket.orientation,course:bucket.course});
    return pairs;
  }

  function preflight(options={}){
    autoTeams()?.deriveTeams?.();
    const rows=classRows(),issues=[],warnings=[],gridCheck=grid()?.validate?.()||{ok:true,issues:[]};
    if(!gridCheck.ok)issues.push(...gridCheck.issues.map(x=>`Jornada: ${x}`));
    if(!rows.length)issues.push('No hay instancias curriculares para construir el horario anual.');
    const missingTeacher=rows.filter(r=>!r.teacherId),missingHours=rows.filter(r=>r.hours==null||Number(r.hours)<=0);
    if(missingTeacher.length)issues.push(`${missingTeacher.length} instancia${missingTeacher.length===1?'':'s'} sin docente asignado.`);
    if(missingHours.length)issues.push(`${missingHours.length} instancia${missingHours.length===1?'':'s'} sin carga horaria válida.`);
    const courses=expandedByCourse(rows);
    for(const b of courses.values())if(b.s1.length!==b.s2.length)issues.push(`${b.orientation} · ${b.course}: el 1.er cuatrimestre requiere ${b.s1.length} HC y el 2.º ${b.s2.length} HC. Para mantener una única grilla anual ambas cargas deben coincidir.`);

    const pendingPlanning=staff()?.pendingTeachers?.()||[];
    for(const x of pendingPlanning){const msg=`${x.name}: integra ${x.planning.count} equipos y necesita validar la distribución de sus ${x.planning.total} HC de planificación.`;if(options.proposalMode)warnings.push(msg);else issues.push(msg)}

    const off=offers();
    for(const t of teachers()){
      const o=off?.offer?.(t.id);
      if(o?.conflict)issues.push(`${t.name}: las horas obligatorias fuera de curso superan el 50 % permitido.`);
      else if(o?.front>0&&o?.selected===null){const msg=`${t.name}: falta elegir el porcentaje anual de trabajo fuera de curso o confirmar “Usar mínimo”.`;if(options.allowMinimumOffer)warnings.push(`${msg} Para esta simulación se usa el mínimo.`);else issues.push(msg)}
    }

    const activeTeams=teams();
    for(const team of activeTeams){
      const members=(team.teacherIds||[]).filter(id=>root().teachers[id]);
      if(members.length<2){warnings.push(`${team.name}: tiene menos de dos docentes asignados; su planificación queda individual.`);continue}
      const len=Number(team.coordinationHours||0);if(!(len>0))continue;
      let possible=false;
      for(const[d]of days())for(let start=1;start<=periods()-len+1;start++)if(members.every(tid=>Array.from({length:len},(_,i)=>start+i).every(p=>available(tid,d,p)))){possible=true;break}
      if(!possible)issues.push(`${team.name}: no existe un bloque continuo común de ${len} HC.`);
    }

    const outside=off?.syntheticOutsideRows?.()||[];
    const teacherNeed={};
    for(const r of rows)for(const sem of r.semesters||[]){teacherNeed[r.teacherId]=teacherNeed[r.teacherId]||{s1:0,s2:0};teacherNeed[r.teacherId][`s${sem}`]+=Number(r.hours||0)}
    for(const x of outside){teacherNeed[x.teacherId]=teacherNeed[x.teacherId]||{s1:0,s2:0};teacherNeed[x.teacherId].s1+=Number(x.hours||0);teacherNeed[x.teacherId].s2+=Number(x.hours||0)}
    for(const team of activeTeams)for(const tid of team.teacherIds||[]){teacherNeed[tid]=teacherNeed[tid]||{s1:0,s2:0};teacherNeed[tid].s1+=Number(team.coordinationHours||0);teacherNeed[tid].s2+=Number(team.coordinationHours||0)}
    for(const[tid,need]of Object.entries(teacherNeed)){
      const t=root().teachers[tid];if(!t)continue;
      const freeCount=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>available(tid,d,i+1)?1:0).reduce((a,b)=>a+b,0),0);
      if(need.s1>freeCount||need.s2>freeCount)issues.push(`${t.name}: necesita hasta ${Math.max(need.s1,need.s2)} HC semanales y declaró ${freeCount} posiciones disponibles.`);
      if(need.s1!==need.s2)warnings.push(`${t.name}: la carga no es idéntica en ambos cuatrimestres (${need.s1} / ${need.s2} HC). La grilla escolar es anual; conviene revisar esta diferencia.`);
    }
    return{ok:!issues.length,issues,warnings,rows,courses,outside,teams:activeTeams};
  }

  function commonTeamBlocks(team,occ1,occ2){
    const members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0),out=[];if(members.length<2||!(len>0))return out;
    for(const[d]of days())for(let start=1;start<=periods()-len+1;start++){
      let ok=true,score=Math.random();
      for(const tid of members)for(let p=start;p<start+len;p++){if(!free(occ1,tid,d,p)||!free(occ2,tid,d,p)){ok=false;break}score+=preference(tid,d,p)*12}
      if(ok)out.push({day:d,start,len,members,score});
    }
    return out.sort((a,b)=>a.score-b.score);
  }
  function placeTeams(report,ctx){
    for(const team of [...report.teams].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0))){
      const members=(team.teacherIds||[]).filter(id=>root().teachers[id]);if(members.length<2||!(Number(team.coordinationHours)>0))continue;
      const pick=commonTeamBlocks(team,ctx.occ1,ctx.occ2)[0];if(!pick)return false;
      for(let p=pick.start;p<pick.start+pick.len;p++){
        const slot=slotKey(pick.day,p),entry={type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de equipo · ${team.name}`,teacherIds:[...members],teacherNames:members.map(id=>root().teachers[id]?.name||'')};
        ctx.entries.push(entry);for(const tid of members){addOcc(ctx.occ1,tid,slot);addOcc(ctx.occ2,tid,slot)}
      }
    }
    return true;
  }
  function placeOutside(report,ctx){
    const units=[];for(const x of report.outside)for(let i=0;i<Number(x.hours||0);i++)units.push({...x,unitIndex:i});units.sort(()=>Math.random()-.5);
    for(const u of units){
      const choices=[];for(const[d]of days())for(let p=1;p<=periods();p++){
        if(!free(ctx.occ1,u.teacherId,d,p)||!free(ctx.occ2,u.teacherId,d,p))continue;
        const score=preference(u.teacherId,d,p)*12+(ctx.dayLoad.get(`${u.teacherId}|${d}`)||0)*.4+Math.random()*1.5;choices.push({day:d,period:p,score});
      }
      choices.sort((a,b)=>a.score-b.score);const pick=choices[0];if(!pick)return false;
      const slot=slotKey(pick.day,pick.period);ctx.entries.push({type:'institutional',day:pick.day,period:pick.period,slot,instanceId:u.id,teacherId:u.teacherId,teacherName:root().teachers[u.teacherId]?.name||'',label:u.label});addOcc(ctx.occ1,u.teacherId,slot);addOcc(ctx.occ2,u.teacherId,slot);ctx.dayLoad.set(`${u.teacherId}|${pick.day}`,(ctx.dayLoad.get(`${u.teacherId}|${pick.day}`)||0)+1);
    }
    return true;
  }
  function pairUnits(report){const out=[];for(const b of report.courses.values())out.push(...pairCourse(b));return out.sort(()=>Math.random()-.5)}
  function choosePair(pair,ctx){
    const choices=[];for(const[d]of days())for(let p=1;p<=periods();p++){
      const slot=slotKey(d,p);if(ctx.courseOcc.get(pair.courseKey)?.has(slot))continue;
      if(pair.s1&&!free(ctx.occ1,pair.s1.teacherId,d,p))continue;if(pair.s2&&!free(ctx.occ2,pair.s2.teacherId,d,p))continue;
      let score=Math.random()*1.5;if(pair.s1)score+=preference(pair.s1.teacherId,d,p)*10+(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${d}`)||0)*.3;if(pair.s2)score+=preference(pair.s2.teacherId,d,p)*10+(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${d}`)||0)*.3;score+=(ctx.courseDayLoad.get(`${pair.courseKey}|${d}`)||0)*.45;choices.push({day:d,period:p,slot,score});
    }
    choices.sort((a,b)=>a.score-b.score);return choices[0]||null;
  }
  function placePairs(report,ctx){
    for(const pair of pairUnits(report)){
      const pick=choosePair(pair,ctx);if(!pick)return false;const e={type:'classpair',day:pick.day,period:pick.period,slot:pick.slot,courseKey:pair.courseKey,orientation:pair.orientation,course:pair.course,s1:pair.s1,s2:pair.s2};ctx.entries.push(e);addOcc(ctx.courseOcc,pair.courseKey,pick.slot);ctx.courseDayLoad.set(`${pair.courseKey}|${pick.day}`,(ctx.courseDayLoad.get(`${pair.courseKey}|${pick.day}`)||0)+1);
      if(pair.s1){addOcc(ctx.occ1,pair.s1.teacherId,pick.slot);ctx.dayLoad.set(`1|${pair.s1.teacherId}|${pick.day}`,(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${pick.day}`)||0)+1)}
      if(pair.s2){addOcc(ctx.occ2,pair.s2.teacherId,pick.slot);ctx.dayLoad.set(`2|${pair.s2.teacherId}|${pick.day}`,(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${pick.day}`)||0)+1)}
    }
    return true;
  }
  function attempt(report){const ctx={occ1:new Map(),occ2:new Map(),courseOcc:new Map(),dayLoad:new Map(),courseDayLoad:new Map(),entries:[]};if(!placeTeams(report,ctx))return{ok:false,entries:ctx.entries};if(!placeOutside(report,ctx))return{ok:false,entries:ctx.entries};if(!placePairs(report,ctx))return{ok:false,entries:ctx.entries};return{ok:true,entries:ctx.entries}}
  function quality(entries){
    let q=0;const byTeacher=new Map();
    for(const e of entries){
      if(e.type==='area'){for(const tid of e.teacherIds||[]){const k=`${tid}|${e.day}`;if(!byTeacher.has(k))byTeacher.set(k,[]);byTeacher.get(k).push(e.period)}}
      else if(e.type==='institutional'){const k=`${e.teacherId}|${e.day}`;if(!byTeacher.has(k))byTeacher.set(k,[]);byTeacher.get(k).push(e.period)}
      else for(const u of[e.s1,e.s2].filter(Boolean)){q+=preference(u.teacherId,e.day,e.period)*10;const k=`${u.teacherId}|${e.day}`;if(!byTeacher.has(k))byTeacher.set(k,[]);byTeacher.get(k).push(e.period)}
    }
    for(const ps of byTeacher.values()){ps.sort((a,b)=>a-b);if(ps.length>1)q+=(ps.at(-1)-ps[0]+1-ps.length)*1.1}return q;
  }
  function solve(report,maxAttempts=500){
    let best=null,bestPartial=null;for(let i=0;i<maxAttempts;i++){const r=attempt(report);if(r.ok){const q=quality(r.entries);if(!best||q<best.quality)best={...r,quality:q};if(q<.5)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}
    return{best,bestPartial};
  }

  function simulateAssignments(assignments,maxAttempts=350){
    const r=root(),oldAssignments=r.assignments,oldTeams=deep(r.areaTeams||{});r.assignments={...assignments};
    try{
      autoTeams()?.deriveTeams?.();const report=preflight({proposalMode:true,allowMinimumOffer:true});
      if(!report.ok)return{ok:false,issues:report.issues,warnings:report.warnings,preflight:true};
      const solved=solve(report,maxAttempts);
      if(!solved.best)return{ok:false,issues:[`No se encontró una combinación anual completa. La mejor tentativa ubicó ${solved.bestPartial?.entries.length||0} posiciones.`],warnings:report.warnings,preflight:false};
      return{ok:true,issues:[],warnings:report.warnings,quality:solved.best.quality,positions:solved.best.entries.length,entries:solved.best.entries};
    }finally{r.assignments=oldAssignments;r.areaTeams=oldTeams;autoTeams()?.deriveTeams?.()}
  }

  function generate(){
    const report=preflight();lastReport=report;if(!report.ok){render();return}
    const solved=solve(report,500);if(!solved.best){lastReport={...report,ok:false,issues:[...report.issues,`No se encontró una combinación anual completa. La mejor tentativa ubicó ${solved.bestPartial?.entries.length||0} posiciones.`]};render();return}
    const schedule={id:uid(),engine:'v68-annual',createdAt:new Date().toISOString(),status:'draft',grid:grid()?.snapshot?.(),entries:solved.best.entries,quality:solved.best.quality};root().annualScheduleVersions.push(schedule);if(root().annualScheduleVersions.length>12)root().annualScheduleVersions.splice(0,root().annualScheduleVersions.length-12);save();lastReport={...report,generated:schedule};render();toast('Horario anual generado con la planificación mínima y los equipos docentes actuales.')
  }
  const latest=()=>root().annualScheduleVersions.at(-1)||null;
  const active=()=>root().annualScheduleVersions.find(x=>x.id===root().activeAnnualScheduleId)||null;
  function accept(){const s=latest();if(!s)return;root().activeAnnualScheduleId=s.id;s.status='active';save();render();toast('Horario anual marcado como vigente.')}

  function reportHtml(){if(!lastReport)return'';return`<div class="v65-report ${lastReport.ok?'ok':'bad'}"><h3>${lastReport.ok?'La estructura es viable para una grilla anual':'Hay condiciones que impiden generar la grilla anual'}</h3>${lastReport.issues?.length?`<ul>${lastReport.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>Las cargas de ambos cuatrimestres pueden compartir las mismas posiciones horarias.</p>'}${lastReport.warnings?.length?`<div class="warn">${lastReport.warnings.map(x=>`⚠ ${esc(x)}`).join('<br>')}</div>`:''}</div>`}
  function sideLabel(u,sem){return u?`<div class="v65-side"><b>${sem}.º:</b> ${esc(u.name)}<small>${esc(u.teacherName)}</small></div>`:''}
  function pairCourseCell(e){if(e.s1&&e.s2&&e.s1.instanceId===e.s2.instanceId&&e.s1.teacherId===e.s2.teacherId)return`<strong>${esc(e.s1.name)}</strong><small>${esc(e.s1.teacherName)} · anual</small>`;return`${sideLabel(e.s1,1)}${sideLabel(e.s2,2)}`}
  function pairTeacherCell(e,tid){const a=e.s1?.teacherId===tid?e.s1:null,b=e.s2?.teacherId===tid?e.s2:null;if(a&&b&&a.instanceId===b.instanceId)return`<strong>${esc(a.name)}</strong><small>${esc(`${e.orientation} · ${e.course}`)} · anual</small>`;return`${a?`<div class="v65-side"><b>1.º:</b> ${esc(a.name)}<small>${esc(`${e.orientation} · ${e.course}`)}</small></div>`:''}${b?`<div class="v65-side"><b>2.º:</b> ${esc(b.name)}<small>${esc(`${e.orientation} · ${e.course}`)}</small></div>`:''}`}
  function entriesAt(s,d,p){return(s?.entries||[]).filter(e=>e.day===d&&Number(e.period)===Number(p))}
  function scheduleView(s){
    if(!s)return'';const courseOpts=[...new Map(s.entries.filter(e=>e.type==='classpair').map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es')),teacherOpts=teachers().filter(t=>s.entries.some(e=>e.teacherId===t.id||(e.teacherIds||[]).includes(t.id)||e.s1?.teacherId===t.id||e.s2?.teacherId===t.id)).map(t=>[t.id,t.name]);const opts=viewMode==='course'?courseOpts:teacherOpts;if(!selectedView||!opts.some(([id])=>id===selectedView))selectedView=opts[0]?.[0]||'';const ds=s.grid?.days||days().map(([id,label])=>({id,label})),slots=s.grid?.slots||Array.from({length:periods()},(_,i)=>({period:i+1,start:'',end:''}));
    return`<div class="v65-viewbar"><div><button data-v68-mode="course" class="${viewMode==='course'?'on':''}">Por curso</button><button data-v68-mode="teacher" class="${viewMode==='teacher'?'on':''}">Por docente</button></div><label>Ver<select id="v68ViewSelect">${opts.map(([id,l])=>`<option value="${esc(id)}" ${id===selectedView?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div><div class="v65-grid-wrap"><table class="v65-grid"><thead><tr><th>HC</th>${ds.map(d=>`<th>${esc(d.label)}</th>`).join('')}</tr></thead><tbody>${slots.map((slot,i)=>{const p=i+1;return`<tr><th>${p}.ª<small>${esc(slot.start||'')}–${esc(slot.end||'')}</small></th>${ds.map(d=>{const es=entriesAt(s,d.id,p).filter(e=>viewMode==='course'?e.type==='classpair'&&e.courseKey===selectedView:e.type==='area'?(e.teacherIds||[]).includes(selectedView):e.type==='institutional'?e.teacherId===selectedView:e.s1?.teacherId===selectedView||e.s2?.teacherId===selectedView);return`<td>${es.map(e=>e.type==='area'?`<div class="v65-area"><strong>${esc(e.label)}</strong><small>Trabajo institucional común</small></div>`:e.type==='institutional'?`<div class="v65-out"><strong>${esc(e.label)}</strong><small>Trabajo fuera de curso · anual</small></div>`:`<div>${viewMode==='course'?pairCourseCell(e):pairTeacherCell(e,selectedView)}</div>`).join('<hr>')}</td>`}).join('')}</tr>`}).join('')}</tbody></table></div>`;
  }
  function openPrint(){
    const s=latest(),content=$id('printContent'),modal=$id('printModal');if(!s||!content||!modal)return toast('Primero generá un horario anual.',true);
    const courseOpts=[...new Map(s.entries.filter(e=>e.type==='classpair').map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es')),teacherOpts=teachers().filter(t=>s.entries.some(e=>e.teacherId===t.id||(e.teacherIds||[]).includes(t.id)||e.s1?.teacherId===t.id||e.s2?.teacherId===t.id));const ds=s.grid?.days||[],slots=s.grid?.slots||[];
    function table(mode,id,label){return`<section class="v65-print-section"><h2>${esc(label)}</h2><table><thead><tr><th>HC</th>${ds.map(d=>`<th>${esc(d.label)}</th>`).join('')}</tr></thead><tbody>${slots.map((slot,i)=>{const p=i+1;return`<tr><th>${p}.ª<br><small>${esc(slot.start||'')}–${esc(slot.end||'')}</small></th>${ds.map(d=>{const es=entriesAt(s,d.id,p).filter(e=>mode==='course'?e.type==='classpair'&&e.courseKey===id:e.type==='area'?(e.teacherIds||[]).includes(id):e.type==='institutional'?e.teacherId===id:e.s1?.teacherId===id||e.s2?.teacherId===id);return`<td>${es.map(e=>e.type==='area'?`<strong>${esc(e.label)}</strong>`:e.type==='institutional'?`<strong>${esc(e.label)}</strong>`:mode==='course'?pairCourseCell(e):pairTeacherCell(e,id)).join('<hr>')}</td>`}).join('')}</tr>`}).join('')}</tbody></table></section>`}
    content.className='print-preview-wrap';content.innerHTML=`<article class="pci-print-sheet"><div class="pci-print-kicker">Implementación institucional</div><h1>Horario escolar anual</h1><div class="pci-print-meta"><div><strong>Escuela</strong>${esc(state.school)}</div><div><strong>Generado</strong>${new Date(s.createdAt).toLocaleString('es-AR')}</div><div><strong>Motor</strong>V68 · planta + equipos</div><div><strong>Estado</strong>${s.status==='active'?'Vigente':'Borrador'}</div></div><h1>Por curso</h1>${courseOpts.map(([id,l])=>table('course',id,l)).join('')}<h1 style="break-before:page">Por docente</h1>${teacherOpts.map(t=>table('teacher',t.id,t.name)).join('')}</article>`;modal.classList.add('open');
  }

  function render(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;const old=$id('v65AnnualScheduler');if(old)old.style.display='none';
    let section=$id('v68AnnualScheduler');if(!section){section=document.createElement('section');section.id='v68AnnualScheduler';section.className='card v65-scheduler';host.appendChild(section)}
    const s=latest(),a=active();section.innerHTML=`<div class="eyebrow">Horario institucional · anual · V68</div><h2>Una única grilla para toda la escuela</h2><p>El motor resuelve cursos, docentes, disponibilidad, equipos, planificación mínima y trabajo institucional sobre una grilla anual. Las propuestas de planta pueden simularse sin modificar la asignación vigente.</p><div class="v65-actions"><button data-v68-check>Analizar viabilidad</button><button class="primary" data-v68-generate>Generar horario anual</button>${s&&s.id!==a?.id?'<button class="accept" data-v68-accept>Aceptar como vigente</button>':''}<button data-v68-print>Imprimir horarios</button></div>${reportHtml()}${s?`<div class="v65-version"><div><strong>${s.id===a?.id?'Horario anual vigente':'Último borrador anual'}</strong><br>${new Date(s.createdAt).toLocaleString('es-AR')} · motor ${esc(s.engine||'')} · compactación ${Number(s.quality||0).toFixed(1)}</div><span>${s.id===a?.id?'Vigente':'Borrador'}</span></div>${scheduleView(s)}`:''}`;
    section.querySelector('[data-v68-check]').onclick=()=>{lastReport=preflight();render()};section.querySelector('[data-v68-generate]').onclick=generate;section.querySelector('[data-v68-accept]')?.addEventListener('click',accept);section.querySelector('[data-v68-print]').onclick=openPrint;section.querySelectorAll('[data-v68-mode]').forEach(b=>b.onclick=()=>{viewMode=b.dataset.v68Mode;selectedView='';render()});$id('v68ViewSelect')?.addEventListener('change',e=>{selectedView=e.target.value;render()});
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,110)}
  function start(){schedule();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false})}}

  const style=document.createElement('style');style.textContent=`#v65AnnualScheduler{display:none!important}#v68AnnualScheduler{border-color:#b9ddd7}.v68-sim-note{font-size:.58rem;color:var(--muted)}`;document.head.appendChild(style);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1300));window.addEventListener('pci-schedule-grid-changed',()=>{lastReport=null;schedule()});document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(start,420)},true);document.addEventListener('change',e=>{if(e.target.closest('[data-v48-assignment],[data-v65-pct],[data-v68-plan-hours]')){lastReport=null;setTimeout(schedule,180)}},true);

  const publicApi={preflight,generate,render,latest,openPrint,simulateAssignments,solve};
  window.PCIAnnualSchedulerV68=publicApi;
  window.PCIAnnualSchedulerV65=publicApi;
})();