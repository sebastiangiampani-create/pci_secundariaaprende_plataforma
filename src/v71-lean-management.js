(() => {
  const $=id=>document.getElementById(id);
  let rendering=false,entryObserver=null,selectedCourseKey='',hoursReady=false,hoursLoading=null;
  const CARGOS={TC:36,TP1:30,TP2:24,TP3:18,TP4:12};

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};
    r.assignments=r.assignments||{};
    return r;
  }
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const api=()=>window.PCIInstitutionalV48||null;
  const rows=()=>api()?.allImplementationRows?.()||[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`doc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  async function ensureHours(){
    if(hoursReady)return true;
    if(hoursLoading)return hoursLoading;
    const a=api();
    if(!a?.loadHours)return false;
    hoursLoading=Promise.resolve(a.loadHours()).then(()=>{hoursReady=true;return true}).catch(e=>{console.error('V71P loadHours',e);toast('No se pudieron cargar las horas oficiales del plan.',true);return false}).finally(()=>{hoursLoading=null});
    return hoursLoading;
  }

  function teacherCargos(t){
    if(Array.isArray(t.cargos)&&t.cargos.length)return t.cargos;
    const legacyType=t.cargoType||'TP4';
    t.cargos=[{id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:legacyType,manualHours:legacyType==='POR_HORAS'?Math.max(0,Number(t.manualHours||0)):0}];
    return t.cargos;
  }
  function cargoHours(c){
    if(CARGOS[c?.type])return CARGOS[c.type];
    if(c?.type==='POR_HORAS')return Math.max(0,Number(c.manualHours||0));
    return 0;
  }
  function cargoNominal(t){return teacherCargos(t).reduce((n,c)=>n+cargoHours(c),0)}
  function assignedRows(tid){return rows().filter(r=>root().assignments[r.instanceId]===tid)}
  function frontHours(tid){return assignedRows(tid).reduce((n,r)=>n+(Number(r.hours)||0),0)}
  function meetingHours(t){return t.meetingHours==null?3:Math.max(0,Number(t.meetingHours)||0)}
  function stats(t){
    const nominal=cargoNominal(t),front=frontHours(t.id),liberated=Math.max(0,nominal-front),meeting=meetingHours(t),free=nominal-front-meeting;
    return{nominal,front,liberated,meeting,free,over:Math.max(0,-free)};
  }
  function assignmentCount(tid){return assignedRows(tid).length}
  function summaryStats(){
    const list=teachers(),all=rows(),assigned=all.filter(r=>root().assignments[r.instanceId]).length;
    const teacherStats=list.map(t=>({t,s:stats(t)}));
    return{
      teachers:list.length,
      assigned,
      total:all.length,
      unassigned:Math.max(0,all.length-assigned),
      over:teacherStats.filter(x=>x.s.over>0).length,
      available:teacherStats.filter(x=>x.s.free>0).length,
      full:teacherStats.filter(x=>x.s.free===0&&!x.s.over).length,
      front:teacherStats.reduce((n,x)=>n+x.s.front,0),
      liberated:teacherStats.reduce((n,x)=>n+x.s.liberated,0)
    };
  }

  function deleteTeacher(tid){
    const r=root(),t=r.teachers[tid];if(!t)return;
    const count=assignmentCount(tid);
    if(!confirm(`Eliminar a ${t.name}?${count?` También se liberarán ${count} asignaciones.`:''}`))return;
    delete r.teachers[tid];
    for(const [instanceId,id] of Object.entries(r.assignments))if(id===tid)delete r.assignments[instanceId];
    if(r.teacherProfiles)delete r.teacherProfiles[tid];
    if(r.availability)delete r.availability[tid];
    if(r.availabilityPreferences)delete r.availabilityPreferences[tid];
    if(r.planningOverrides)delete r.planningOverrides[tid];
    if(r.outsideWork)for(const [id,x] of Object.entries(r.outsideWork))if(x?.teacherId===tid)delete r.outsideWork[id];
    r.annualScheduleVersions=[];
    save();render();ensureEntryButtons();toast(`${t.name} fue eliminado de Gestión Institucional.`);
  }

  function addTeacher(){
    const name=$('v71LeanTeacherName')?.value.trim()||'';
    const dni=$('v71LeanTeacherDni')?.value.trim()||'';
    const email=$('v71LeanTeacherEmail')?.value.trim()||'';
    const cargoType=$('v71LeanCargoType')?.value||'TP4';
    const manualHours=Math.max(0,Number($('v71LeanManualHours')?.value||0));
    if(!name)return toast('Escribí el nombre y apellido del docente.',true);
    const exists=teachers().find(t=>String(t.name).trim().toLowerCase()===name.toLowerCase()||(dni&&String(t.dni||'')===dni)||(email&&String(t.email||'').trim().toLowerCase()===email.toLowerCase()));
    if(exists)return toast('Ese docente ya está cargado.',true);
    const id=uid();
    root().teachers[id]={id,name,dni,email,cargos:[{id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:cargoType,manualHours:cargoType==='POR_HORAS'?manualHours:0}],meetingHours:3};
    save();render();ensureEntryButtons();toast('Docente agregado.');
  }

  function updateTeacher(tid,field,value){
    const t=root().teachers[tid];if(!t)return;
    if(field==='meetingHours')value=Math.max(0,Number(value)||0);
    t[field]=value;save();render();
  }
  function cargoTotalAfter(t,replaceId,nextCargo){
    return teacherCargos(t).reduce((n,c)=>n+cargoHours(c.id===replaceId?nextCargo:c),0);
  }
  function updateCargo(tid,cid,field,value){
    const t=root().teachers[tid];if(!t)return;
    const cs=teacherCargos(t),cargo=cs.find(x=>x.id===cid);if(!cargo)return;
    const next={...cargo};
    if(field==='type'){next.type=value;if(value!=='POR_HORAS')next.manualHours=0}
    if(field==='manualHours')next.manualHours=Math.max(0,Number(value)||0);
    const total=cargoTotalAfter(t,cid,next);
    if(total>72){toast(`La suma de cargos de ${t.name} no puede superar 72 HC. Quedaría en ${total} HC.`,true);return}
    Object.assign(cargo,next);save();render();
  }
  function addCargo(tid){
    const t=root().teachers[tid];if(!t)return;
    const cs=teacherCargos(t),next={id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'TP4',manualHours:0};
    const total=cargoNominal(t)+cargoHours(next);
    if(total>72)return toast(`No se puede agregar ese cargo: ${t.name} superaría el tope de 72 HC.`,true);
    cs.push(next);save();render();
  }
  function removeCargo(tid,cid){
    const t=root().teachers[tid];if(!t)return;
    const cs=teacherCargos(t);
    if(cs.length<=1)return toast('El docente debe conservar al menos un cargo o designación.',true);
    t.cargos=cs.filter(x=>x.id!==cid);save();render();
  }

  function teacherHtml(){
    const list=teachers();
    if(!list.length)return '<div class="v71m-empty">Todavía no hay docentes cargados.</div>';
    return `<div class="v71m-teachers">${list.map(t=>{
      const s=stats(t),status=s.over?'over':s.free===0?'full':'open';
      return `<article class="v71m-teacher ${status}" draggable="true" data-v71m-teacher-drag="${esc(t.id)}">
        <div class="v71m-teacher-main">
          <strong>⠿ ${esc(t.name)}</strong>
          <small>${esc(t.dni||'Sin DNI')}${t.email?` · ${esc(t.email)}`:''}</small>
          <small><strong>${assignmentCount(t.id)}</strong> asignaciones curriculares</small>
          <div class="v71m-cargo-stack">
            ${teacherCargos(t).map(c=>`<div class="v71m-cargo-line">
              <label>Cargo
                <select data-v71m-cargo-edit="type" data-teacher="${esc(t.id)}" data-cargo="${esc(c.id)}">
                  ${['TC','TP1','TP2','TP3','TP4','POR_HORAS'].map(x=>`<option value="${x}" ${c.type===x?'selected':''}>${x==='POR_HORAS'?'Por horas':`${x} · ${CARGOS[x]} HC`}</option>`).join('')}
                </select>
              </label>
              ${c.type==='POR_HORAS'?`<label>HC<input type="number" min="0" step="1" value="${esc(c.manualHours||0)}" data-v71m-cargo-edit="manualHours" data-teacher="${esc(t.id)}" data-cargo="${esc(c.id)}"></label>`:''}
              <span class="v71m-cargo-hc">${cargoHours(c)} HC</span>
              ${teacherCargos(t).length>1?`<button type="button" class="v71m-cargo-remove" data-v71m-cargo-remove="${esc(c.id)}" data-teacher="${esc(t.id)}" title="Quitar cargo">×</button>`:''}
            </div>`).join('')}
            <button type="button" class="v71m-add-cargo" data-v71m-add-cargo="${esc(t.id)}">+ Agregar cargo</button>
            <label class="v71m-meeting">Reunión HC<input type="number" min="0" step="1" value="${esc(meetingHours(t))}" data-v71m-edit="meetingHours" data-teacher="${esc(t.id)}"></label>
            <small class="v71m-cap">Tope total: 72 HC · Actual: <strong>${s.nominal} HC</strong></small>
          </div>
        </div>
        <div class="v71m-hours">
          <span><b>${s.nominal}</b> bolsa</span>
          <span><b>${s.front}</b> frente a curso</span>
          <span><b>${s.liberated}</b> liberadas</span>
          <span><b>${s.meeting}</b> reunión</span>
          <span class="${s.over?'bad':''}"><b>${s.free}</b> disponibles</span>
        </div>
        <button type="button" data-v71m-delete="${esc(t.id)}" title="Eliminar docente" aria-label="Eliminar ${esc(t.name)}">×</button>
      </article>`;
    }).join('')}</div>`;
  }

  function courseGroups(){
    const map=new Map();
    const defs=window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];
    for(const d of defs){
      const key=`${d.orientation}|||${d.course}`;
      if(!map.has(key))map.set(key,{key,orientation:d.orientation,course:d.course,year:d.year,division:d.division,rows:[]});
    }
    for(const row of rows()){
      const key=`${row.orientation}|||${row.course}`;
      if(!map.has(key))map.set(key,{key,orientation:row.orientation,course:row.course,year:row.year,division:row.division,rows:[]});
      map.get(key).rows.push(row);
    }
    return [...map.values()].sort((a,b)=>String(a.orientation).localeCompare(String(b.orientation),'es')||Number(a.year||0)-Number(b.year||0)||String(a.course).localeCompare(String(b.course),'es'));
  }

  function assignmentSectionHtml(){
    const groups=courseGroups();
    if(!groups.length)return `<section class="card v48-section v71o-assignment"><div class="eyebrow">Asignación por materia</div><h2>Materias del plan</h2><div class="v71m-empty">Todavía no hay materias disponibles desde Fase 1.</div></section>`;
    if(!selectedCourseKey||!groups.some(g=>g.key===selectedCourseKey))selectedCourseKey=groups[0].key;
    const group=groups.find(g=>g.key===selectedCourseKey)||groups[0];
    return `<section class="card v48-section v71o-assignment">
      <div class="eyebrow">Asignación frente a curso</div>
      <h2>Arrastrá un docente a la materia</h2>
      <p>La carga horaria sale del plan. Gestión descuenta automáticamente esas HC de la bolsa del cargo.</p>
      <label class="v71o-course-label">Curso<select id="v71oCourseSelect">${groups.map(g=>`<option value="${esc(g.key)}" ${g.key===selectedCourseKey?'selected':''}>${esc(g.orientation)} · ${esc(g.course)}</option>`).join('')}</select></label>
      <div class="v71o-subject-list">${group.rows.length?group.rows.map(row=>{
        const tid=root().assignments[row.instanceId]||'',t=root().teachers[tid];
        return `<div class="v71o-subject-row ${tid?'assigned':''}" data-v71-drop="${esc(row.instanceId)}">
          <div><strong>${esc(row.name)}</strong><small>${row.hours==null?'HC pendiente':`${esc(row.hours)} HC`} · ${esc((row.locations||[]).join(' · ')||'Plan')}</small></div>
          <div class="v71o-dropzone">${t?`<span draggable="true" data-v71m-teacher-drag="${esc(t.id)}">⠿ ${esc(t.name)}</span><button type="button" data-v71-clear="${esc(row.instanceId)}">×</button>`:'Soltá un docente acá'}</div>
        </div>`;
      }).join(''):'<div class="v71m-empty">El curso existe, pero todavía no tiene instancias curriculares materializadas desde el Mapa de la Oferta.</div>'}</div>
    </section>`;
  }

  function setAssignment(instanceId,teacherId){
    const r=root();
    if(teacherId)r.assignments[instanceId]=teacherId;else delete r.assignments[instanceId];
    r.annualScheduleVersions=[];
    save();
    try{window.PCIAutoAreaCoincidenceV54?.deriveTeams?.()}catch{}
    render();
  }

  function bindDrag(host){
    host.querySelectorAll('[data-v71m-teacher-drag]').forEach(el=>{
      el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',`teacher:${el.dataset.v71mTeacherDrag}`);e.dataTransfer.effectAllowed='move'});
    });
    host.querySelectorAll('[data-v71-drop]').forEach(z=>{
      z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dragover')});
      z.addEventListener('dragleave',()=>z.classList.remove('dragover'));
      z.addEventListener('drop',e=>{
        e.preventDefault();z.classList.remove('dragover');
        const raw=e.dataTransfer.getData('text/plain')||'';
        if(!raw.startsWith('teacher:'))return;
        setAssignment(z.dataset.v71Drop,raw.slice(8));
      });
    });
    host.querySelectorAll('[data-v71-clear]').forEach(b=>b.onclick=()=>setAssignment(b.dataset.v71Clear,''));
  }

  function bindTouchAssign(host){
    let picked='';
    host.querySelectorAll('[data-v71m-teacher-drag]').forEach(el=>{
      el.addEventListener('click',e=>{
        if(e.target.closest('select,input,button'))return;
        picked=el.dataset.v71mTeacherDrag;
        host.querySelectorAll('[data-v71m-teacher-drag]').forEach(x=>x.classList.toggle('picked',x.dataset.v71mTeacherDrag===picked));
        toast('Docente seleccionado. Tocá una materia para asignarlo.');
      });
    });
    host.querySelectorAll('[data-v71-drop]').forEach(z=>z.addEventListener('click',e=>{
      if(e.target.closest('button'))return;
      if(picked)setAssignment(z.dataset.v71Drop,picked);
    }));
  }

  function render(){
    if(rendering)return;
    const screen=$('institutional'),host=$('v48InstitutionalContent');
    if(!screen||!host||!screen.classList.contains('active'))return;
    rendering=true;
    try{
      const all=rows(),assigned=all.filter(r=>root().assignments[r.instanceId]).length,sum=summaryStats();
      const title=$('v48InstitutionalTitle');if(title)title.textContent=`${state.school||'Escuela'} · Gestión institucional`;
      const hero=screen.querySelector('.hero p');if(hero)hero.textContent='Planta docente simple: cargo como bolsa de horas, asignación frente a curso por drag & drop, disponibilidad y horarios.';
      host.innerHTML=`
        <div class="v71m-summary">
          <span><strong>${sum.teachers}</strong> docentes</span>
          <span><strong>${sum.assigned}</strong>/${sum.total} materias asignadas</span>
          <span><strong>${sum.unassigned}</strong> sin asignar</span>
          <span><strong>${sum.over}</strong> con sobreasignación</span>
          <span><strong>${sum.available}</strong> con HC disponibles</span>
          <span><strong>${sum.front}</strong> HC frente a curso</span>
          <span><strong>${sum.liberated}</strong> HC liberadas</span>
          <span>Reunión por defecto: <strong>3 HC</strong> editables</span>
        </div>
        <section class="card v48-section v71m-source"><div class="eyebrow">Punto de partida</div><h2>Escuela nueva o planta existente</h2><p>Podés empezar de cero cargando docentes abajo, o importar una planta ya armada con cargos y asignaciones desde el Excel simple.</p></section>
        <section class="card v48-section v71m-teacher-section">
          <div class="eyebrow">Plantel</div><h2>Docentes y bolsa de horas</h2>
          <div class="v71m-add">
            <input id="v71LeanTeacherName" placeholder="Nombre y apellido">
            <input id="v71LeanTeacherDni" placeholder="DNI">
            <input id="v71LeanTeacherEmail" placeholder="Mail">
            <select id="v71LeanCargoType"><option value="TC">TC · 36 HC</option><option value="TP1">TP1 · 30 HC</option><option value="TP2">TP2 · 24 HC</option><option value="TP3">TP3 · 18 HC</option><option value="TP4" selected>TP4 · 12 HC</option><option value="POR_HORAS">Por horas · ingresar HC</option></select>
            <input id="v71LeanManualHours" type="number" min="0" step="1" placeholder="HC" style="display:none">
            <button id="v71LeanAddTeacher" class="btn primary" type="button">Agregar</button>
          </div>
          ${teacherHtml()}
        </section>
        ${assignmentSectionHtml()}
        <div id="v71mDynamic"></div>`;
      $('v71LeanCargoType')?.addEventListener('change',e=>{const x=$('v71LeanManualHours');if(x)x.style.display=e.target.value==='POR_HORAS'?'block':'none'});
      $('v71LeanAddTeacher')?.addEventListener('click',addTeacher);
      host.querySelectorAll('[data-v71m-delete]').forEach(b=>b.addEventListener('click',()=>deleteTeacher(b.dataset.v71mDelete)));
      host.querySelectorAll('[data-v71m-edit]').forEach(el=>el.addEventListener('change',()=>updateTeacher(el.dataset.teacher,el.dataset.v71mEdit,el.value)));
      host.querySelectorAll('[data-v71m-cargo-edit]').forEach(el=>el.addEventListener('change',()=>updateCargo(el.dataset.teacher,el.dataset.cargo,el.dataset.v71mCargoEdit,el.value)));
      host.querySelectorAll('[data-v71m-add-cargo]').forEach(b=>b.addEventListener('click',()=>addCargo(b.dataset.v71mAddCargo)));
      host.querySelectorAll('[data-v71m-cargo-remove]').forEach(b=>b.addEventListener('click',()=>removeCargo(b.dataset.teacher,b.dataset.v71mCargoRemove)));
      $('v71oCourseSelect')?.addEventListener('change',e=>{selectedCourseKey=e.target.value;render()});
      bindDrag(host);bindTouchAssign(host);
      setTimeout(()=>{
        try{window.PCISimpleAssignmentExcelV71?.render?.()}catch(e){console.warn('V71P excel',e)}
        try{window.PCIAvailabilityPreferencesV60?.render?.()}catch(e){console.warn('V71P availability',e)}
        try{window.PCIAnnualSchedulerV68?.render?.()}catch(e){console.warn('V71P scheduler',e)}
        try{window.PCIManagementNavResetV71?.renderNav?.()}catch{}
        try{window.PCIManagementHomeV73?.refresh?.()}catch(e){console.warn('V73 home refresh',e)}
      },80);
    }finally{rendering=false}
  }

  async function openManagement(){
    await ensureHours();
    window.screen?.('institutional');
    setTimeout(()=>{
      render();
      setTimeout(()=>window.PCIManagementHomeV73?.goHome?.(),160);
    },40);
  }

  function ensureEntryButtons(){
    const list=$('pciList');
    if(list){
      let card=$('v71LeanHomeEntry');if(!card){card=document.createElement('section');card.id='v71LeanHomeEntry';card.className='card v71n-entry-card';list.after(card)}
      const all=rows(),assigned=all.filter(r=>root().assignments[r.instanceId]).length;
      card.innerHTML=`<div><div class="eyebrow">Nivel escuela</div><h2>Gestión institucional</h2><p>Docentes, cargos, asignaciones, disponibilidad y horarios.</p><small>${teachers().length} docentes · ${assigned}/${all.length} materias asignadas</small></div><button type="button" class="btn primary" data-v71n-open>Abrir Gestión</button>`;
      card.querySelector('[data-v71n-open]').onclick=openManagement;
    }
    const grid=document.querySelector('#panel .phase-grid');
    if(grid){
      let card=$('v71LeanPanelEntry');if(!card){card=document.createElement('article');card.id='v71LeanPanelEntry';card.className='card phase v71n-panel-entry';grid.appendChild(card)}
      card.innerHTML='<div class="eyebrow">Gestión</div><h2>Gestión institucional</h2><p>Planta docente, cargos, asignación frente a curso, disponibilidad y horarios.</p><button type="button" class="btn primary" data-v71n-open>Entrar</button>';
      card.querySelector('[data-v71n-open]').onclick=openManagement;
    }
  }

  async function install(){
    const a=api();if(a)a.renderInstitutional=render;
    await ensureHours();ensureEntryButtons();
    const list=$('pciList');if(list&&!entryObserver){entryObserver=new MutationObserver(()=>setTimeout(ensureEntryButtons,50));entryObserver.observe(list,{childList:true})}
    if($('institutional')?.classList.contains('active'))render();
  }

  document.addEventListener('click',e=>{const btn=e.target.closest('#openInstitutional,#openInstitutionalGeneral,[data-v71n-open]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();openManagement()},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(install,80));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250),{once:true});
  setTimeout(install,700);

  const style=document.createElement('style');
  style.textContent=`
    .v71m-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.v71m-summary span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:.6rem;color:var(--muted)}.v71m-summary strong{color:var(--ink)}.v71m-summary span:nth-child(4){border-color:#e0bdc5;background:var(--danger-soft);color:var(--danger)}
    .v71m-source{padding:14px!important}.v71m-source h2,.v71m-teacher-section h2,.v71o-assignment h2{margin:3px 0 4px!important}
    .v71m-add{display:grid;grid-template-columns:1.3fr .7fr 1fr .55fr .45fr auto;gap:7px;margin-top:10px}.v71m-add input,.v71m-add select{min-width:0;padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff}
    .v71m-teachers{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px;margin-top:10px}.v71m-teacher{position:relative;padding:10px 42px 10px 10px;border:1px solid var(--line);border-radius:12px;background:var(--band);cursor:grab}.v71m-teacher.picked{outline:3px solid var(--mint)}.v71m-teacher.over{border-color:#e0bdc5;background:var(--danger-soft)}.v71m-teacher strong{display:block;font-size:.72rem}.v71m-teacher small{display:block;margin-top:2px;font-size:.52rem;color:var(--muted)}.v71m-teacher>button{position:absolute;right:8px;top:8px;width:28px;height:28px;border:1px solid #ddb7bf;border-radius:50%;background:#fff5f6;color:var(--danger);font-size:1rem;font-weight:900}.v71m-cargo-stack{display:grid;gap:6px;margin-top:8px}.v71m-cargo-line{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px;border:1px solid var(--line);border-radius:8px;background:#fff}.v71m-cargo-line label,.v71m-meeting{display:flex;align-items:center;gap:4px;font-size:.52rem;font-weight:800}.v71m-cargo-line select,.v71m-cargo-line input,.v71m-meeting input{width:auto;max-width:110px;padding:5px;border:1px solid var(--line);border-radius:7px;background:#fff}.v71m-cargo-hc{font-size:.52rem;font-weight:900;color:var(--mint-dark)}.v71m-add-cargo{justify-self:start;border:1px dashed var(--mint-dark);border-radius:999px;background:var(--mint-soft);color:var(--mint-dark);padding:6px 9px;font-size:.54rem;font-weight:900}.v71m-cargo-remove{width:24px!important;height:24px!important;position:static!important;border-radius:50%!important}.v71m-cap{font-size:.5rem!important}.v71m-hours{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px}.v71m-hours span{padding:5px;border-radius:8px;background:#fff;font-size:.5rem;text-align:center}.v71m-hours b{display:block;font-size:.68rem}.v71m-hours .bad{background:var(--danger-soft);color:var(--danger)}
    .v71m-empty{padding:12px;border:1px dashed var(--line);border-radius:10px;margin-top:10px;color:var(--muted);font-size:.62rem}
    .v71o-course-label{display:grid;gap:5px;margin-top:10px;max-width:420px;font-size:.6rem;font-weight:850}.v71o-course-label select{padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff}.v71o-subject-list{display:grid;gap:7px;margin-top:10px}.v71o-subject-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,320px);gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--band)}.v71o-subject-row.dragover{outline:3px solid var(--mint)}.v71o-subject-row strong{display:block;font-size:.68rem}.v71o-subject-row small{display:block;margin-top:2px;font-size:.52rem;color:var(--muted)}.v71o-dropzone{min-height:42px;border:1.5px dashed #9dafbb;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:7px;padding:7px;color:var(--muted);font-size:.58rem;font-weight:800}.v71o-dropzone span{color:var(--ink);cursor:grab}.v71o-dropzone button{width:25px;height:25px;border:0;border-radius:50%;background:var(--danger-soft);color:var(--danger);font-weight:900}
    .v66-assignment-section,.v48-table-wrap{display:none!important}
    .v71n-entry-card{margin-top:16px;padding:18px;display:flex;justify-content:space-between;gap:16px;align-items:center;border-color:#9edfd7;background:linear-gradient(135deg,#f7fffd,#edf8f7)}.v71n-entry-card h2{margin:4px 0}.v71n-entry-card p{margin:0;color:var(--muted);font-size:.72rem}.v71n-entry-card small{display:block;margin-top:7px;color:var(--muted);font-size:.58rem}.v71n-entry-card>.btn{flex:0 0 auto}
    @media(max-width:900px){.v71m-add{grid-template-columns:1fr 1fr}.v71m-add .btn{grid-column:1/-1}.v71m-hours{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:780px){.v71m-add{grid-template-columns:1fr}.v71m-add .btn{width:100%;grid-column:auto}.v71m-teachers{grid-template-columns:1fr}.v71o-subject-row{grid-template-columns:1fr}.v71n-entry-card{align-items:stretch;flex-direction:column}.v71n-entry-card>.btn{width:100%}}
  `;
  document.head.appendChild(style);

  window.PCILeanManagementV71={render,deleteTeacher,addTeacher,ensureEntryButtons,openManagement,setAssignment,ensureHours,stats};
})();