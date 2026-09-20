(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  const loadApi=()=>window.PCIDerivedTeacherLoadV52||null;
  const availability=()=>window.PCIAvailabilityV49||null;
  const scheduleGrid=()=>window.PCIScheduleConfigV51||null;
  let observer=null,refreshTimer=null,semester=1,viewMode='course',selectedView='',lastReport=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const slotKey=(day,p)=>`${day}:${p}`;
  const days=()=>scheduleGrid()?.days?.()||availability()?.days?.()||availability()?.DAYS||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(scheduleGrid()?.periodCount?.()||availability()?.periods?.()||8));
  const gridValidation=()=>scheduleGrid()?.validate?.()||{ok:true,issues:[]};
  const gridSnapshot=()=>scheduleGrid()?.snapshot?.()||{version:1,days:days().map(([id,label])=>({id,label})),slots:Array.from({length:periods()},(_,i)=>({period:i+1,start:'',end:''}))};
  const slotLabel=(schedule,p)=>{
    const s=schedule?.grid?.slots?.[Number(p)-1]||scheduleGrid()?.slot?.(p);
    return s?.start&&s?.end?`${s.start}–${s.end}`:`HC ${p}`;
  };

  function inst(){
    state.institutional=state.institutional||{};
    const root=state.institutional;
    root.teachers=root.teachers||{};
    root.assignments=root.assignments||{};
    root.outsideWork=root.outsideWork||{};
    root.areaTeams=root.areaTeams||{};
    root.scheduleVersions=root.scheduleVersions||{S1:[],S2:[]};
    root.activeSchedule=root.activeSchedule||{};
    seedTeams(root);
    return root;
  }

  function seedTeams(root){
    if(Object.keys(root.areaTeams||{}).length)return;
    const names=['Ciencias Sociales','Ciencias Naturales','Educación Física','Matemática','Lengua y Literatura','Lenguas Adicionales','Artes','Tecnología / Informática'];
    names.forEach(name=>{const id=`area-${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;root.areaTeams[id]={id,name,coordinationHours:2,teacherIds:[]}});
  }

  function teacherList(){return Object.values(inst().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'))}
  function activeInSemester(row,sem){
    if(loadApi()?.activeInSemester)return loadApi().activeInSemester(row,sem);
    const term=Number(row.year)*2-(Number(sem)===1?1:0);
    return row.locations?.includes(`C${term}`)||row.locations?.some(x=>String(x).includes('anual'));
  }
  function classRows(sem=semester){
    const root=inst();
    return (api()?.allImplementationRows?.()||[]).filter(r=>activeInSemester(r,sem)).map(r=>({...r,type:'class',teacherId:root.assignments[r.instanceId]||'',teacherName:root.teachers[root.assignments[r.instanceId]]?.name||''}));
  }
  function outsideRows(sem=semester){
    return Object.values(inst().outsideWork).filter(x=>x.semester==='both'||Number(x.semester)===Number(sem));
  }
  function teamList(){return Object.values(inst().areaTeams).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'))}
  function activeTeamList(){return teamList().filter(t=>Number(t.coordinationHours)>0&&(t.teacherIds||[]).length>0)}

  function frontLoads(){return loadApi()?.teacherLoads?.()||{}}
  function outsideLoadForTeacher(tid,sem){return outsideRows(sem).filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0)}
  function teamLoadForTeacher(tid){return activeTeamList().filter(t=>(t.teacherIds||[]).includes(tid)).reduce((a,t)=>a+Number(t.coordinationHours||0),0)}
  function totalsForTeacher(tid,sem){
    const front=Number(frontLoads()?.[tid]?.[`S${sem}`]||0),outside=outsideLoadForTeacher(tid,sem),team=teamLoadForTeacher(tid);
    return{front,outside,team,total:front+outside+team};
  }

  const style=document.createElement('style');
  style.textContent=`
    #v50Scheduler{display:none!important}
    .v53-section{margin-top:16px;padding:17px}.v53-section h2{margin:4px 0 5px;font-size:1.05rem}.v53-section p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.4}
    .v53-load-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px;margin-top:12px}.v53-load-card{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.v53-load-card h3{margin:0;font-size:.84rem}.v53-load-card small{display:block;margin-top:4px;color:var(--muted);font-size:.59rem;line-height:1.35}.v53-load-line{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:7px;font-size:.64rem}.v53-load-line strong{font-size:.66rem}.v53-max{display:grid;grid-template-columns:1fr 85px auto;gap:6px;align-items:end;margin-top:9px}.v53-max label{display:grid;gap:3px;font-size:.56rem;font-weight:850}.v53-max input{width:100%;padding:7px;border:1px solid var(--line);border-radius:8px}.v53-max button,.v53-pill-btn{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 9px;font-size:.58rem;font-weight:850;color:var(--ink)}
    .v53-form{display:grid;grid-template-columns:minmax(150px,1fr) minmax(180px,1.4fr) 90px 130px auto;gap:7px;align-items:end;margin-top:12px}.v53-form label{display:grid;gap:4px;font-size:.59rem;font-weight:850}.v53-form input,.v53-form select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff}.v53-form button{padding:9px 12px;border:0;border-radius:9px;background:var(--ink);color:#fff;font-weight:850}
    .v53-task-list{display:grid;gap:7px;margin-top:10px}.v53-task{display:flex;justify-content:space-between;gap:9px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--band);font-size:.63rem}.v53-task small{color:var(--muted)}.v53-task button{border:0;background:transparent;text-decoration:underline;font-weight:850;font-size:.56rem;color:var(--danger)}
    .v53-teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px;margin-top:12px}.v53-team{border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff}.v53-team-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v53-team h3{margin:0;font-size:.8rem}.v53-team select{padding:6px;border:1px solid var(--line);border-radius:8px;background:#fff}.v53-members{display:grid;grid-template-columns:1fr 1fr;gap:5px 8px;margin-top:9px}.v53-members label{display:flex;gap:5px;align-items:flex-start;font-size:.58rem;line-height:1.25}.v53-members input{margin:1px 0 0}.v53-add-area{display:flex;gap:7px;margin-top:10px}.v53-add-area input{flex:1;padding:8px;border:1px solid var(--line);border-radius:8px}.v53-add-area button{border:1px solid var(--line);border-radius:8px;background:#fff;font-weight:850;padding:8px 10px}
    .v53-note{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--mint-soft);color:var(--mint-dark);font-size:.65rem;line-height:1.42}.v53-note strong{font-weight:900}
    .v53-toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}.v53-toolbar label{display:grid;gap:4px;font-size:.61rem;font-weight:850}.v53-toolbar select{padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff}.v53-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v53-actions button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:.62rem;font-weight:850}.v53-actions .primary{background:var(--ink);color:#fff;border-color:var(--ink)}.v53-actions .accept{background:var(--mint-soft);color:var(--mint-dark)}
    .v53-report{margin-top:11px;padding:11px;border:1px solid var(--line);border-radius:11px;background:#fafcfd}.v53-report.ok{border-color:#b9ddd1;background:#f2fbf7}.v53-report.bad{border-color:#e3bdc5;background:#fff5f7}.v53-report h3{margin:0 0 6px;font-size:.8rem}.v53-report ul{margin:0;padding-left:18px;font-size:.65rem;line-height:1.45}.v53-report p{font-size:.66rem!important}.v53-warning{margin-top:7px;color:#8a6414;font-size:.61rem;line-height:1.4}
    .v53-version{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:12px;padding:9px 11px;border-radius:10px;background:var(--band);font-size:.63rem}.v53-badge{padding:4px 7px;border-radius:999px;background:#fff;font-size:.55rem;font-weight:900}.v53-badge.active{background:var(--mint-soft);color:var(--mint-dark)}
    .v53-viewbar{display:flex;gap:7px;align-items:end;flex-wrap:wrap;margin-top:11px}.v53-viewbar label{display:grid;gap:4px;font-size:.59rem;font-weight:850}.v53-viewbar select{min-width:230px;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff}.v53-mode{display:flex;gap:5px}.v53-mode button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 9px;font-size:.58rem;font-weight:850}.v53-mode button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
    .v53-grid-wrap{overflow:auto;margin-top:9px;border:1px solid var(--line);border-radius:12px}.v53-grid{width:100%;min-width:820px;border-collapse:collapse;table-layout:fixed;font-size:.6rem}.v53-grid th{padding:8px;background:var(--band);font-size:.55rem;text-transform:uppercase}.v53-grid td{height:58px;padding:5px;border-top:1px solid var(--line);border-right:1px solid var(--line);vertical-align:top}.v53-grid td:last-child{border-right:0}.v53-grid .period{width:105px;text-align:center;font-weight:900;background:#fafcfd}.v53-grid .period small{display:block;margin-top:2px;color:var(--muted);font-size:.48rem}.v53-cell strong{display:block;font-size:.61rem;line-height:1.2}.v53-cell small{display:block;margin-top:3px;color:var(--muted);font-size:.52rem;line-height:1.25}.v53-area{background:#f2fbf7}.v53-outside{background:#f8f5ff}
    @media(max-width:820px){.v53-form{grid-template-columns:1fr 1fr}.v53-form label:nth-child(2){grid-column:1/-1}.v53-form button{grid-column:1/-1}.v53-members{grid-template-columns:1fr}.v53-max{grid-template-columns:1fr 78px}.v53-max button{grid-column:1/-1}}
  `;
  document.head.appendChild(style);

  function setMax(tid,value){
    const teacher=inst().teachers[tid];if(!teacher)return;
    const n=Number(value);teacher.maxTotalHours=Number.isFinite(n)&&n>0?n:null;save();renderWorkload();lastReport=null;renderScheduler();
  }
  function addOutsideWork(tid,label,hours,sem){
    const teacher=inst().teachers[tid],clean=String(label||'').trim(),h=Number(hours);
    if(!teacher)return toast('Elegí un docente.',true);
    if(!clean)return toast('Indicá qué trabajo fuera de curso realiza.',true);
    if(!Number.isFinite(h)||h<=0)return toast('Indicá una cantidad válida de horas.',true);
    const id=uid('outside');inst().outsideWork[id]={id,teacherId:tid,label:clean,hours:h,semester:sem||'both'};save();renderWorkload();lastReport=null;renderScheduler();
  }
  function removeOutside(id){delete inst().outsideWork[id];save();renderWorkload();lastReport=null;renderScheduler()}
  function addArea(name){const clean=String(name||'').trim();if(!clean)return toast('Escribí el nombre del área.',true);const id=uid('area');inst().areaTeams[id]={id,name:clean,coordinationHours:2,teacherIds:[]};save();renderWorkload();lastReport=null;renderScheduler()}
  function removeArea(id){delete inst().areaTeams[id];save();renderWorkload();lastReport=null;renderScheduler()}

  function workloadCards(){
    const teachers=teacherList();if(!teachers.length)return '<div class="v48-empty">Cargá docentes para construir su carga horaria.</div>';
    return `<div class="v53-load-grid">${teachers.map(t=>{const a=totalsForTeacher(t.id,1),b=totalsForTeacher(t.id,2),has=Math.max(a.total,b.total)>0,max=Number(t.maxTotalHours)>0?Number(t.maxTotalHours):'';return`<article class="v53-load-card"><h3>${esc(t.name)}</h3><div class="v53-load-line"><span>1.er cuatrimestre</span><strong>${a.total} h</strong></div><small>${a.front} frente a curso · ${a.outside+a.team} fuera de curso</small><div class="v53-load-line"><span>2.º cuatrimestre</span><strong>${b.total} h</strong></div><small>${b.front} frente a curso · ${b.outside+b.team} fuera de curso</small>${has?`<div class="v53-max"><label>Máximo total (opcional)<span>Se define después de construir la carga</span></label><input type="number" min="1" step="1" value="${max}" data-v53-max="${esc(t.id)}" placeholder="—"><button type="button" data-v53-save-max="${esc(t.id)}">Guardar</button></div>`:'<small>Primero asignale horas; después vas a poder fijar una carga máxima.</small>'}</article>`}).join('')}</div>`;
  }

  function outsideTasksHtml(){
    const tasks=Object.values(inst().outsideWork);if(!tasks.length)return '<div class="v48-empty">Todavía no cargaste trabajo fuera de curso.</div>';
    return `<div class="v53-task-list">${tasks.map(x=>{const t=inst().teachers[x.teacherId],sem=x.semester==='both'?'Todo el año':`${x.semester}.º cuatrimestre`;return`<div class="v53-task"><div><strong>${esc(x.label)}</strong><br><small>${esc(t?.name||'Docente')} · ${x.hours} h · ${esc(sem)}</small></div><button type="button" data-v53-remove-outside="${esc(x.id)}">Quitar</button></div>`}).join('')}</div>`;
  }

  function teamsHtml(){
    const teachers=teacherList();
    return `<div class="v53-teams">${teamList().map(team=>`<article class="v53-team"><div class="v53-team-head"><div><h3>${esc(team.name)}</h3><small>Coincidencia semanal obligatoria</small></div><div><select data-v53-team-hours="${esc(team.id)}"><option value="2" ${Number(team.coordinationHours)===2?'selected':''}>2 h</option><option value="4" ${Number(team.coordinationHours)===4?'selected':''}>4 h</option></select> <button class="v53-pill-btn" type="button" data-v53-remove-area="${esc(team.id)}">Quitar</button></div></div><div class="v53-members">${teachers.length?teachers.map(t=>`<label><input type="checkbox" data-v53-team-member="${esc(team.id)}" value="${esc(t.id)}" ${(team.teacherIds||[]).includes(t.id)?'checked':''}>${esc(t.name)}</label>`).join(''):'<small>Primero cargá docentes.</small>'}</div></article>`).join('')}</div>`;
  }

  function renderWorkload(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let section=$id('v53Workload');if(!section){section=document.createElement('section');section.id='v53Workload';section.className='card v53-section';const grid=$id('v51ScheduleConfig')||$id('v49Availability')||$id('v50Scheduler');if(grid)host.insertBefore(section,grid);else host.appendChild(section)}
    const teachers=teacherList();
    section.innerHTML=`<div class="eyebrow">Carga institucional completa</div><h2>Trabajo frente a curso y fuera de curso</h2><p>La carga se construye primero. Recién después, si la escuela lo necesita, se fija un máximo total por docente. Tanto las horas frente a curso como las horas institucionales deben aparecer dentro del horario escolar.</p>${workloadCards()}<div class="v53-note"><strong>Regla de horario:</strong> ninguna hora institucional queda “por fuera” de la grilla. Coordinaciones, reuniones, tutorías, cargos u otras funciones ocupan una posición horaria real del docente.</div><h2 style="margin-top:18px">Trabajo individual fuera de curso</h2><p>Agregá funciones que deban ocupar horas semanales del docente dentro de la jornada escolar.</p><div class="v53-form"><label>Docente<select id="v53OutsideTeacher"><option value="">Elegir…</option>${teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label>Función / tarea<input id="v53OutsideLabel" placeholder="Ej.: tutoría, coordinación, referente…"></label><label>Horas<input id="v53OutsideHours" type="number" min="1" step="1" value="2"></label><label>Vigencia<select id="v53OutsideSemester"><option value="both">Todo el año</option><option value="1">1.er C</option><option value="2">2.º C</option></select></label><button id="v53AddOutside" type="button">Agregar</button></div>${outsideTasksHtml()}<h2 style="margin-top:18px">Coincidencia obligatoria por área</h2><p>Cada área puede reservar 2 o 4 horas cátedra semanales en las que todos sus docentes coincidan. El generador trata estas horas como una restricción dura y las ubica antes que el resto de la carga.</p>${teamsHtml()}<div class="v53-add-area"><input id="v53AreaName" placeholder="Agregar otra área o equipo"><button id="v53AddArea" type="button">Agregar área</button></div>`;
    $id('v53AddOutside').onclick=()=>addOutsideWork($id('v53OutsideTeacher').value,$id('v53OutsideLabel').value,$id('v53OutsideHours').value,$id('v53OutsideSemester').value);
    $id('v53AddArea').onclick=()=>addArea($id('v53AreaName').value);
    section.querySelectorAll('[data-v53-save-max]').forEach(b=>b.onclick=()=>setMax(b.dataset.v53SaveMax,section.querySelector(`[data-v53-max="${CSS.escape(b.dataset.v53SaveMax)}"]`)?.value));
    section.querySelectorAll('[data-v53-remove-outside]').forEach(b=>b.onclick=()=>removeOutside(b.dataset.v53RemoveOutside));
    section.querySelectorAll('[data-v53-remove-area]').forEach(b=>b.onclick=()=>removeArea(b.dataset.v53RemoveArea));
    section.querySelectorAll('[data-v53-team-hours]').forEach(sel=>sel.onchange=()=>{const t=inst().areaTeams[sel.dataset.v53TeamHours];if(t){t.coordinationHours=Number(sel.value)||2;save();lastReport=null;renderWorkload();renderScheduler()}});
    section.querySelectorAll('[data-v53-team-member]').forEach(cb=>cb.onchange=()=>{const team=inst().areaTeams[cb.dataset.v53TeamMember];if(!team)return;team.teacherIds=Array.isArray(team.teacherIds)?team.teacherIds:[];if(cb.checked&&!team.teacherIds.includes(cb.value))team.teacherIds.push(cb.value);if(!cb.checked)team.teacherIds=team.teacherIds.filter(x=>x!==cb.value);save();lastReport=null;renderWorkload();renderScheduler()});
  }

  function preflight(){
    const root=inst(),teachers=root.teachers,rows=classRows(),outside=outsideRows(),teams=activeTeamList(),issues=[],warnings=[],check=gridValidation();
    if(!check.ok)issues.push(...check.issues.map(x=>`Jornada: ${x}`));
    if(!rows.length)issues.push('No hay instancias curriculares activas para este cuatrimestre.');
    const missingTeacher=rows.filter(r=>!r.teacherId),missingHours=rows.filter(r=>r.hours==null||Number(r.hours)<=0);
    if(missingTeacher.length)issues.push(`${missingTeacher.length} instancia${missingTeacher.length===1?'':'s'} frente a curso sin docente asignado.`);
    if(missingHours.length)issues.push(`${missingHours.length} instancia${missingHours.length===1?'':'s'} frente a curso sin carga horaria válida.`);
    const capacity=days().length*periods(),courseMap=new Map(),teacherMap=new Map();
    for(const r of rows){const ck=`${r.orientation}|${r.course}`;courseMap.set(ck,(courseMap.get(ck)||0)+(Number(r.hours)||0));if(r.teacherId)teacherMap.set(r.teacherId,(teacherMap.get(r.teacherId)||0)+(Number(r.hours)||0))}
    for(const x of outside)if(x.teacherId)teacherMap.set(x.teacherId,(teacherMap.get(x.teacherId)||0)+Number(x.hours||0));
    for(const team of teams)for(const tid of team.teacherIds||[])teacherMap.set(tid,(teacherMap.get(tid)||0)+Number(team.coordinationHours||0));
    for(const [course,h] of courseMap)if(h>capacity)issues.push(`${course.replace('|',' · ')} requiere ${h} horas y la jornada ofrece ${capacity} posiciones semanales.`);
    for(const [tid,h] of teacherMap){const t=teachers[tid];if(!t)continue;const free=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>availability()?.available?.(tid,d,i+1)!==false).filter(Boolean).length,0);if(h>free)issues.push(`${t.name} necesita ${h} horas totales dentro del horario escolar pero declaró solo ${free} disponibles.`);const max=Number(t.maxTotalHours);if(max>0&&h>max)issues.push(`${t.name} tiene ${h} horas totales asignadas y supera el máximo definido de ${max}.`)}
    for(const team of teams){const members=(team.teacherIds||[]).filter(id=>teachers[id]);if(members.length<2){warnings.push(`${team.name}: asigná al menos dos docentes para exigir coincidencia.`);continue}const common=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>members.every(tid=>availability()?.available?.(tid,d,i+1)!==false)).filter(Boolean).length,0);if(common<Number(team.coordinationHours||0))issues.push(`${team.name} necesita ${team.coordinationHours} horas de coincidencia y solo tiene ${common} posiciones comunes según las disponibilidades.`)}
    return{ok:!issues.length,issues,warnings,rows,outside,teams,teacherMap,courseMap,capacity};
  }

  function teacherFree(tid,day,p,teacherOcc){return availability()?.available?.(tid,day,p)!==false&&!teacherOcc.get(tid)?.has(slotKey(day,p))}
  function addOcc(map,key,slot){if(!map.has(key))map.set(key,new Set());map.get(key).add(slot)}

  function placeTeams(report,teacherOcc,teacherDayLoad,entries){
    const teams=[...report.teams].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0)||Number(b.coordinationHours)-Number(a.coordinationHours));
    for(const team of teams){const members=(team.teacherIds||[]).filter(id=>inst().teachers[id]);if(members.length<2)continue;const placed=[];for(let i=0;i<Number(team.coordinationHours||0);i++){const candidates=[];for(const [day] of days())for(let p=1;p<=periods();p++){if(!members.every(tid=>teacherFree(tid,day,p,teacherOcc)))continue;const sameDay=placed.filter(x=>x.day===day).length;let score=sameDay*5+members.reduce((a,tid)=>a+(teacherDayLoad.get(`${tid}|${day}`)||0),0)*.35+Math.random()*2;if(placed.some(x=>x.day===day&&Math.abs(x.period-p)===1))score-=2.5;if(sameDay>=2)score+=20;candidates.push({day,period:p,score})}candidates.sort((a,b)=>a.score-b.score);const pick=candidates[0];if(!pick)return false;const slot=slotKey(pick.day,pick.period),teacherNames=members.map(id=>inst().teachers[id]?.name||'').filter(Boolean);entries.push({type:'area',day:pick.day,period:pick.period,slot,areaId:team.id,label:`Encuentro de área · ${team.name}`,teacherIds:[...members],teacherNames});placed.push(pick);for(const tid of members){addOcc(teacherOcc,tid,slot);const k=`${tid}|${pick.day}`;teacherDayLoad.set(k,(teacherDayLoad.get(k)||0)+1)}}}
    return true;
  }

  function buildUnits(report){
    const totalByTeacher=report.teacherMap,slack={};
    for(const [tid,total] of totalByTeacher){const free=days().reduce((sum,[d])=>sum+Array.from({length:periods()},(_,i)=>availability()?.available?.(tid,d,i+1)!==false).filter(Boolean).length,0);slack[tid]=free-total}
    const units=[];
    for(const r of report.rows)for(let i=0;i<Number(r.hours||0);i++)units.push({type:'class',instanceId:r.instanceId,teacherId:r.teacherId,teacherName:r.teacherName,orientation:r.orientation,course:r.course,courseKey:`${r.orientation}|${r.course}`,subjectId:r.subjectId,label:r.name,unitIndex:i,difficulty:slack[r.teacherId]??999});
    for(const x of report.outside)for(let i=0;i<Number(x.hours||0);i++){const t=inst().teachers[x.teacherId];units.push({type:'institutional',instanceId:x.id,teacherId:x.teacherId,teacherName:t?.name||'',label:x.label,unitIndex:i,difficulty:slack[x.teacherId]??999})}
    return units.sort((a,b)=>a.difficulty-b.difficulty||(a.type==='class'?-1:1)-(b.type==='class'?-1:1)||Math.random()-.5);
  }

  function chooseSlot(unit,teacherOcc,courseOcc,placedByInstance,teacherDayLoad,courseDayLoad){
    const candidates=[];for(const [day] of days())for(let p=1;p<=periods();p++){const slot=slotKey(day,p);if(!teacherFree(unit.teacherId,day,p,teacherOcc))continue;if(unit.courseKey&&courseOcc.get(unit.courseKey)?.has(slot))continue;const placed=placedByInstance.get(unit.instanceId)||[],sameDay=placed.filter(x=>x.day===day).length,tLoad=teacherDayLoad.get(`${unit.teacherId}|${day}`)||0,cLoad=unit.courseKey?(courseDayLoad.get(`${unit.courseKey}|${day}`)||0):0;let score=sameDay*9+tLoad*.45+cLoad*.55+Math.random()*2;if(placed.some(x=>x.day===day&&Math.abs(x.period-p)===1))score-=2.8;if(sameDay>=2)score+=30;const tset=teacherOcc.get(unit.teacherId)||new Set();if(tset.has(slotKey(day,p-1))||tset.has(slotKey(day,p+1)))score-=1;candidates.push({day,period:p,slot,score})}candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
  }

  function attempt(report){
    const teacherOcc=new Map(),courseOcc=new Map(),teacherDayLoad=new Map(),courseDayLoad=new Map(),placedByInstance=new Map(),entries=[];
    if(!placeTeams(report,teacherOcc,teacherDayLoad,entries))return{ok:false,entries};
    const units=buildUnits(report);
    for(const unit of units){const pick=chooseSlot(unit,teacherOcc,courseOcc,placedByInstance,teacherDayLoad,courseDayLoad);if(!pick)return{ok:false,entries};const entry={type:unit.type,day:pick.day,period:pick.period,slot:pick.slot,instanceId:unit.instanceId,teacherId:unit.teacherId,teacherName:unit.teacherName,label:unit.label};if(unit.type==='class')Object.assign(entry,{orientation:unit.orientation,course:unit.course,courseKey:unit.courseKey,subjectId:unit.subjectId,subjectName:unit.label});entries.push(entry);addOcc(teacherOcc,unit.teacherId,pick.slot);if(unit.courseKey)addOcc(courseOcc,unit.courseKey,pick.slot);const tk=`${unit.teacherId}|${pick.day}`;teacherDayLoad.set(tk,(teacherDayLoad.get(tk)||0)+1);if(unit.courseKey){const ck=`${unit.courseKey}|${pick.day}`;courseDayLoad.set(ck,(courseDayLoad.get(ck)||0)+1)}if(!placedByInstance.has(unit.instanceId))placedByInstance.set(unit.instanceId,[]);placedByInstance.get(unit.instanceId).push(entry)}
    return{ok:true,entries};
  }

  function quality(entries){let score=0;const byTeacherDay=new Map(),byInstance=new Map();for(const e of entries){const tids=e.type==='area'?(e.teacherIds||[]):[e.teacherId];for(const tid of tids){const k=`${tid}|${e.day}`;if(!byTeacherDay.has(k))byTeacherDay.set(k,[]);byTeacherDay.get(k).push(e.period)}if(e.instanceId){if(!byInstance.has(e.instanceId))byInstance.set(e.instanceId,[]);byInstance.get(e.instanceId).push(e)}}for(const ps of byTeacherDay.values()){ps.sort((a,b)=>a-b);if(ps.length>1)score+=(ps.at(-1)-ps[0]+1-ps.length)*1.1}for(const rows of byInstance.values()){const map={};rows.forEach(e=>map[e.day]=(map[e.day]||0)+1);Object.values(map).forEach(n=>score+=Math.max(0,n-2)*18+Math.max(0,n-1)*1.5)}return score}

  function generate(){
    const report=preflight();lastReport=report;if(!report.ok){renderScheduler();return}
    let best=null,bestPartial=null;for(let i=0;i<220;i++){const r=attempt(report);if(r.ok){const q=quality(r.entries);if(!best||q<best.quality)best={...r,quality:q};if(q<1)break}else if(!bestPartial||r.entries.length>bestPartial.entries.length)bestPartial=r}
    if(!best){lastReport={...report,ok:false,issues:[...report.issues,`No se encontró una combinación completa. La mejor tentativa ubicó ${bestPartial?.entries.length||0} posiciones. Revisá disponibilidad, coincidencias de área o carga institucional.`]};renderScheduler();return}
    const schedule={id:uid('sch53'),engine:'v53',semester,createdAt:new Date().toISOString(),status:'draft',grid:gridSnapshot(),entries:best.entries,quality:best.quality};const key=`S${semester}`,versions=inst().scheduleVersions[key]=inst().scheduleVersions[key]||[];versions.push(schedule);if(versions.length>12)versions.splice(0,versions.length-12);save();lastReport={...report,generated:schedule};renderScheduler();
  }
  function versions(){return inst().scheduleVersions[`S${semester}`]||[]}
  function latest(){const v=versions();return [...v].reverse().find(x=>x.engine==='v53')||null}
  function activeSchedule(){const id=inst().activeSchedule[`S${semester}`];return versions().find(x=>x.id===id)||null}
  function acceptLatest(){const s=latest();if(!s)return;for(const x of versions())x.status=x.id===s.id?'active':'draft';inst().activeSchedule[`S${semester}`]=s.id;save();renderScheduler();toast('Horario aceptado como vigente.')}

  function reportHtml(r){if(!r)return'';return`<div class="v53-report ${r.ok?'ok':'bad'}"><h3>${r.ok?'La carga completa es programable':'Hay condiciones que impiden generar el horario completo'}</h3>${r.issues?.length?`<ul>${r.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>No se detectaron conflictos duros antes de generar.</p>'}${r.warnings?.length?`<div class="v53-warning">${r.warnings.map(x=>`⚠ ${esc(x)}`).join('<br>')}</div>`:''}</div>`}
  function scheduleDays(schedule){return schedule?.grid?.days?.map(x=>[x.id,x.label])||days()}
  function scheduleEntriesFor(schedule,day,p){
    const list=(schedule?.entries||[]).filter(e=>e.day===day&&Number(e.period)===Number(p));
    if(viewMode==='course')return list.filter(e=>e.type==='class'&&e.courseKey===selectedView);
    return list.filter(e=>e.teacherId===selectedView||(e.type==='area'&&(e.teacherIds||[]).includes(selectedView)));
  }
  function scheduleView(schedule){
    if(!schedule)return'';const all=schedule.entries||[],courses=[...new Map(all.filter(e=>e.type==='class').map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es')),teachers=teacherList().filter(t=>all.some(e=>e.teacherId===t.id||(e.teacherIds||[]).includes(t.id)));const opts=viewMode==='course'?courses:teachers.map(t=>[t.id,t.name]);if(!selectedView||!opts.some(([id])=>id===selectedView))selectedView=opts[0]?.[0]||'';return`<div class="v53-viewbar"><div class="v53-mode"><button data-v53-mode="course" class="${viewMode==='course'?'on':''}">Por curso</button><button data-v53-mode="teacher" class="${viewMode==='teacher'?'on':''}">Por docente</button></div><label>Ver<select id="v53ViewSelect">${opts.map(([id,label])=>`<option value="${esc(id)}" ${id===selectedView?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div><div class="v53-grid-wrap"><table class="v53-grid"><thead><tr><th>Hora</th>${scheduleDays(schedule).map(([,l])=>`<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${Array.from({length:schedule.grid?.slots?.length||periods()},(_,i)=>i+1).map(p=>`<tr><td class="period">${p}.ª HC<small>${esc(slotLabel(schedule,p))}</small></td>${scheduleDays(schedule).map(([d])=>{const rows=scheduleEntriesFor(schedule,d,p);return`<td>${rows.length?rows.map(e=>{if(e.type==='area')return`<div class="v53-cell v53-area"><strong>${esc(e.label)}</strong><small>Trabajo institucional común</small></div>`;if(e.type==='institutional')return`<div class="v53-cell v53-outside"><strong>${esc(e.label)}</strong><small>Trabajo fuera de curso</small></div>`;return`<div class="v53-cell"><strong>${esc(e.subjectName)}</strong><small>${viewMode==='course'?esc(e.teacherName):esc(`${e.orientation} · ${e.course}`)}</small></div>`}).join(''):'<div style="color:#adb8bf;text-align:center;padding-top:12px">—</div>'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`}

  function renderScheduler(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;let section=$id('v53Scheduler');if(!section){section=document.createElement('section');section.id='v53Scheduler';section.className='card v53-section';host.appendChild(section)}const schedule=latest(),active=activeSchedule();section.innerHTML=`<div class="eyebrow">Generador institucional V53</div><h2>Horario escolar completo</h2><p>El motor ubica en una misma grilla las horas frente a curso, el trabajo institucional individual y las coincidencias obligatorias de cada área. La Fase 2 permanece completamente separada.</p><div class="v53-toolbar"><label>Cuatrimestre<select id="v53Semester"><option value="1" ${semester===1?'selected':''}>1.er cuatrimestre</option><option value="2" ${semester===2?'selected':''}>2.º cuatrimestre</option></select></label><span style="font-size:.62rem;color:var(--muted)">${periods()} HC por día · ${days().map(([,l])=>l).join(', ')}</span></div><div class="v53-actions"><button data-v53-check>Analizar viabilidad</button><button class="primary" data-v53-generate>Generar horario completo</button>${schedule&&schedule.id!==active?.id?'<button class="accept" data-v53-accept>Aceptar como vigente</button>':''}</div>${reportHtml(lastReport)}${schedule?`<div class="v53-version"><div><strong>${schedule.id===active?.id?'Horario vigente':'Último borrador'}</strong><br>${new Date(schedule.createdAt).toLocaleString('es-AR')} · compactación ${Number(schedule.quality||0).toFixed(1)}</div><span class="v53-badge ${schedule.id===active?.id?'active':''}">${schedule.id===active?.id?'Vigente':'Borrador'}</span></div>`:''}${scheduleView(schedule)}`;$id('v53Semester').onchange=e=>{semester=Number(e.target.value)||1;lastReport=null;selectedView='';renderScheduler()};section.querySelector('[data-v53-check]').onclick=()=>{lastReport=preflight();renderScheduler()};section.querySelector('[data-v53-generate]').onclick=generate;section.querySelector('[data-v53-accept]')?.addEventListener('click',acceptLatest);section.querySelectorAll('[data-v53-mode]').forEach(b=>b.onclick=()=>{viewMode=b.dataset.v53Mode;selectedView='';renderScheduler()});$id('v53ViewSelect')?.addEventListener('change',e=>{selectedView=e.target.value;renderScheduler()});
  }

  function refresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{renderWorkload();renderScheduler()},70)}
  function start(){inst();refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,220));
  window.addEventListener('pci-schedule-grid-changed',()=>{lastReport=null;refresh()});
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,200)},true);
  window.PCIInstitutionalWorkV53={inst,renderWorkload,renderScheduler,preflight,generate,totalsForTeacher,classRows,outsideRows,teamList};
})();
