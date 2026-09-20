(() => {
  const work=()=>window.PCIInstitutionalWorkV53||null;
  const autoTeams=()=>window.PCIAutoAreaCoincidenceV54||null;
  const availability=()=>window.PCIAvailabilityV49||null;
  const scheduleGrid=()=>window.PCIScheduleConfigV51||null;
  const slotKey=(day,p)=>`${day}:${p}`;
  const days=()=>scheduleGrid()?.days?.()||availability()?.days?.()||availability()?.DAYS||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(scheduleGrid()?.periodCount?.()||availability()?.periods?.()||8));
  const semester=()=>Number(document.getElementById('v53Semester')?.value)||1;
  const uid=()=>`sch55-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const root=()=>{state.institutional=state.institutional||{};state.institutional.scheduleVersions=state.institutional.scheduleVersions||{S1:[],S2:[]};state.institutional.activeSchedule=state.institutional.activeSchedule||{};return state.institutional};

  function commonBlocks(team,teacherOcc=null){
    const members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]),len=Number(team.coordinationHours||3),blocks=[];
    if(members.length<2||len<1)return blocks;
    for(const [day] of days())for(let start=1;start<=periods()-len+1;start++){
      let ok=true;
      for(const tid of members)for(let p=start;p<start+len;p++){
        if(availability()?.available?.(tid,day,p)===false||teacherOcc?.get(tid)?.has(slotKey(day,p))){ok=false;break}
        if(!ok)break;
      }
      if(ok)blocks.push({day,start,len,members});
    }
    return blocks;
  }

  function preflight(){
    autoTeams()?.deriveTeams?.();
    const sem=semester(),rows=work()?.classRows?.(sem)||[],outside=work()?.outsideRows?.(sem)||[],teams=(work()?.teamList?.()||[]).filter(t=>Number(t.coordinationHours)>0&&(t.teacherIds||[]).length>0),teachers=root().teachers||{},issues=[],warnings=[];
    const gridCheck=scheduleGrid()?.validate?.()||{ok:true,issues:[]};if(!gridCheck.ok)issues.push(...gridCheck.issues.map(x=>`Jornada: ${x}`));
    if(!rows.length)issues.push('No hay instancias curriculares activas para este cuatrimestre.');
    const missingTeacher=rows.filter(r=>!r.teacherId),missingHours=rows.filter(r=>r.hours==null||Number(r.hours)<=0);
    if(missingTeacher.length)issues.push(`${missingTeacher.length} instancia${missingTeacher.length===1?'':'s'} frente a curso sin docente asignado.`);
    if(missingHours.length)issues.push(`${missingHours.length} instancia${missingHours.length===1?'':'s'} frente a curso sin carga horaria válida.`);
    const teacherHours=new Map(),courseHours=new Map(),capacity=days().length*periods();
    for(const r of rows){const ck=`${r.orientation}|${r.course}`;courseHours.set(ck,(courseHours.get(ck)||0)+Number(r.hours||0));if(r.teacherId)teacherHours.set(r.teacherId,(teacherHours.get(r.teacherId)||0)+Number(r.hours||0))}
    for(const x of outside)if(x.teacherId)teacherHours.set(x.teacherId,(teacherHours.get(x.teacherId)||0)+Number(x.hours||0));
    for(const team of teams){
      const members=(team.teacherIds||[]).filter(id=>teachers[id]);if(members.length<2){warnings.push(`${team.name}: por ahora tiene menos de dos docentes asignados.`);continue}
      if(!commonBlocks(team).length)issues.push(`${team.name}: no existe un bloque continuo de ${team.coordinationHours} HC en el que todos sus docentes estén disponibles.`);
      for(const tid of members)teacherHours.set(tid,(teacherHours.get(tid)||0)+Number(team.coordinationHours||0));
    }
    for(const [course,h] of courseHours)if(h>capacity)issues.push(`${course.replace('|',' · ')} requiere ${h} HC y la jornada ofrece ${capacity} posiciones semanales.`);
    for(const [tid,h] of teacherHours){const t=teachers[tid];if(!t)continue;const free=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>availability()?.available?.(tid,d,i+1)!==false).filter(Boolean).length,0);if(h>free)issues.push(`${t.name} necesita ${h} HC totales dentro del horario escolar y declaró solo ${free} disponibles.`);const max=Number(t.maxTotalHours);if(max>0&&h>max)issues.push(`${t.name} tiene ${h} HC totales y supera el máximo definido de ${max}.`)}
    return{ok:!issues.length,issues,warnings,rows,outside,teams,teacherHours,courseHours,sem};
  }

  function addOcc(map,key,slot){if(!map.has(key))map.set(key,new Set());map.get(key).add(slot)}
  function placeTeams(report,teacherOcc,teacherDayLoad,entries){
    const teams=[...report.teams].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0)||Number(b.coordinationHours)-Number(a.coordinationHours));
    for(const team of teams){
      const members=(team.teacherIds||[]).filter(id=>root().teachers?.[id]);if(members.length<2)continue;
      const blocks=commonBlocks(team,teacherOcc).map(block=>{let score=Math.random()*2;for(const tid of members)score+=(teacherDayLoad.get(`${tid}|${block.day}`)||0)*.35;return{...block,score}}).sort((a,b)=>a.score-b.score);
      const pick=blocks[0];if(!pick)return false;
      const names=members.map(id=>root().teachers[id]?.name||'').filter(Boolean);
      for(let p=pick.start;p<pick.start+pick.len;p++){
        const slot=slotKey(pick.day,p);entries.push({type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de área · ${team.name}`,teacherIds:[...members],teacherNames:names,blockLength:pick.len});
        for(const tid of members){addOcc(teacherOcc,tid,slot);const k=`${tid}|${pick.day}`;teacherDayLoad.set(k,(teacherDayLoad.get(k)||0)+1)}
      }
    }
    return true;
  }

  function units(report){
    const out=[];
    for(const r of report.rows)for(let i=0;i<Number(r.hours||0);i++)out.push({type:'class',instanceId:r.instanceId,teacherId:r.teacherId,teacherName:r.teacherName,orientation:r.orientation,course:r.course,courseKey:`${r.orientation}|${r.course}`,subjectId:r.subjectId,label:r.name});
    for(const x of report.outside)for(let i=0;i<Number(x.hours||0);i++)out.push({type:'institutional',instanceId:x.id,teacherId:x.teacherId,teacherName:root().teachers[x.teacherId]?.name||'',label:x.label});
    return out.sort(()=>Math.random()-.5);
  }

  function chooseSlot(unit,teacherOcc,courseOcc,placedByInstance,teacherDayLoad,courseDayLoad){
    const choices=[];
    for(const [day] of days())for(let p=1;p<=periods();p++){
      const slot=slotKey(day,p);if(availability()?.available?.(unit.teacherId,day,p)===false||teacherOcc.get(unit.teacherId)?.has(slot)||unit.courseKey&&courseOcc.get(unit.courseKey)?.has(slot))continue;
      const placed=placedByInstance.get(unit.instanceId)||[],sameDay=placed.filter(x=>x.day===day).length;let score=sameDay*8+(teacherDayLoad.get(`${unit.teacherId}|${day}`)||0)*.4+(unit.courseKey?(courseDayLoad.get(`${unit.courseKey}|${day}`)||0):0)*.5+Math.random()*2;if(placed.some(x=>x.day===day&&Math.abs(x.period-p)===1))score-=2.5;if(sameDay>=2)score+=30;choices.push({day,period:p,slot,score});
    }
    choices.sort((a,b)=>a.score-b.score);return choices[0]||null;
  }

  function attempt(report){
    const teacherOcc=new Map(),courseOcc=new Map(),teacherDayLoad=new Map(),courseDayLoad=new Map(),placedByInstance=new Map(),entries=[];
    if(!placeTeams(report,teacherOcc,teacherDayLoad,entries))return{ok:false,entries};
    for(const unit of units(report)){
      const pick=chooseSlot(unit,teacherOcc,courseOcc,placedByInstance,teacherDayLoad,courseDayLoad);if(!pick)return{ok:false,entries};
      const entry={type:unit.type,day:pick.day,period:pick.period,slot:pick.slot,instanceId:unit.instanceId,teacherId:unit.teacherId,teacherName:unit.teacherName,label:unit.label};if(unit.type==='class')Object.assign(entry,{orientation:unit.orientation,course:unit.course,courseKey:unit.courseKey,subjectId:unit.subjectId,subjectName:unit.label});entries.push(entry);addOcc(teacherOcc,unit.teacherId,pick.slot);if(unit.courseKey)addOcc(courseOcc,unit.courseKey,pick.slot);const tk=`${unit.teacherId}|${pick.day}`;teacherDayLoad.set(tk,(teacherDayLoad.get(tk)||0)+1);if(unit.courseKey){const ck=`${unit.courseKey}|${pick.day}`;courseDayLoad.set(ck,(courseDayLoad.get(ck)||0)+1)}if(!placedByInstance.has(unit.instanceId))placedByInstance.set(unit.instanceId,[]);placedByInstance.get(unit.instanceId).push(entry);
    }
    return{ok:true,entries};
  }

  function quality(entries){let score=0;const byTeacherDay=new Map();for(const e of entries){const tids=e.type==='area'?(e.teacherIds||[]):[e.teacherId];for(const tid of tids){const k=`${tid}|${e.day}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(e.period)}}for(const ps of byTeacherDay.values()){ps.sort((a,b)=>a-b);if(ps.length>1)score+=(ps.at(-1)-ps[0]+1-ps.length)}return score}

  function renderReport(report){
    const section=document.getElementById('v53Scheduler');if(!section)return;section.querySelector('.v55-report')?.remove();const box=document.createElement('div');box.className=`v53-report v55-report ${report.ok?'ok':'bad'}`;box.innerHTML=`<h3>${report.ok?'Las coincidencias de área/orientación son posibles':'Hay condiciones que impiden el horario completo'}</h3>${report.issues.length?`<ul>${report.issues.map(x=>`<li>${String(x)}</li>`).join('')}</ul>`:'<p>Cada equipo cuenta con al menos un bloque continuo común de 3/4 HC.</p>'}${report.warnings.length?`<div class="v53-warning">${report.warnings.map(x=>`⚠ ${String(x)}`).join('<br>')}</div>`:''}`;section.querySelector('.v53-actions')?.after(box);
  }

  function generate(){
    const report=preflight();renderReport(report);if(!report.ok)return;
    let best=null,bestPartial=null;for(let i=0;i<260;i++){const r=attempt(report);if(r.ok){const q=quality(r.entries);if(!best||q<best.quality)best={...r,quality:q};if(q<1)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}
    if(!best){renderReport({...report,ok:false,issues:[...report.issues,`No se encontró una combinación completa. La mejor tentativa ubicó ${bestPartial?.entries.length||0} posiciones.`]});return}
    const sem=report.sem,key=`S${sem}`,schedule={id:uid(),engine:'v53',generator:'v55-contiguous-area-blocks',semester:sem,createdAt:new Date().toISOString(),status:'draft',grid:scheduleGrid()?.snapshot?.(),entries:best.entries,quality:best.quality};const versions=root().scheduleVersions[key]=root().scheduleVersions[key]||[];versions.push(schedule);if(versions.length>12)versions.splice(0,versions.length-12);save();work()?.renderScheduler?.();setTimeout(()=>renderReport(report),20);
  }

  document.addEventListener('click',e=>{
    const generateButton=e.target.closest('[data-v53-generate]');if(generateButton){e.preventDefault();e.stopImmediatePropagation();generate();return}
    const checkButton=e.target.closest('[data-v53-check]');if(checkButton){e.preventDefault();e.stopImmediatePropagation();renderReport(preflight())}
  },true);

  window.PCIContiguousAreaBlocksV55={preflight,generate,commonBlocks};
})();
