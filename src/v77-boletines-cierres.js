(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STATUSES=[
    ['carga','En carga'],
    ['revision','En revisión'],
    ['validado','Validado'],
    ['publicado','Publicado']
  ];
  let selectedKey='';
  let homeFilters={orientation:'',year:'',course:''};
  let accessScope={role:'admin',teacherId:'',studentDnis:[],commissionKeys:null};

  function root(){
    state.institutional=state.institutional||{};
    state.institutional.grading=state.institutional.grading||{plans:{}};
    state.institutional.grading.plans=state.institutional.grading.plans||{};
    state.institutional.grading.closures=state.institutional.grading.closures||{};
    state.institutional.grading.definitives=state.institutional.grading.definitives||{};
    state.institutional.grading.settings=state.institutional.grading.settings||{showCriteriaToFamilies:false};
    return state.institutional;
  }

  const commissions=()=>window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];
  const studentsFor=key=>window.PCIStudentsCommissionsV72?.studentsFor?.(key)||[];

  function planEntries(){
    return Object.values(root().grading.plans||{}).filter(Boolean);
  }

  function closureGroups(){
    const map=new Map();
    for(const p of planEntries()){
      const key=[p.orientation,p.groupId,p.commissionKey].join('|||');
      if(!map.has(key))map.set(key,{
        key,
        orientation:p.orientation||'',
        groupId:p.groupId||'',
        groupName:p.groupName||'Agrupamiento',
        groupType:p.groupType||'',
        year:p.year||'',
        commissionKey:p.commissionKey||'',
        course:p.course||'',
        plans:[]
      });
      map.get(key).plans.push(p);
    }
    for(const g of map.values())g.plans.sort((a,b)=>Number(a.planNumber)-Number(b.planNumber));
    return [...map.values()].sort((a,b)=>String(a.orientation).localeCompare(String(b.orientation),'es')||String(a.course).localeCompare(String(b.course),'es')||String(a.groupName).localeCompare(String(b.groupName),'es'));
  }

  function closureType(g){
    return g.plans.length>=4?'Cierre anual':'Cierre cuatrimestral';
  }

  function visibleClosureGroups(){
    const all=closureGroups();
    if(accessScope.role==='admin')return all;
    if(accessScope.role==='teacher'){
      if(!accessScope.teacherId)return [];
      return all.filter(g=>teachersFor(g).some(t=>String(t.id||t.teacherId||'')===String(accessScope.teacherId)));
    }
    return [];
  }

  function studentCommissionKeys(dni){
    const id=String(dni||'').replace(/\D/g,'');
    return Object.entries(root().commissions||{}).filter(([,c])=>(c.students||[]).map(String).includes(id)).map(([key])=>key);
  }

  function publishedGroupsForStudent(dni,commissionKey=''){
    const keys=new Set(studentCommissionKeys(dni));
    return closureGroups().filter(g=>keys.has(g.commissionKey)&&(!commissionKey||g.commissionKey===commissionKey)&&root().grading.closures?.[g.key]?.status==='publicado');
  }

  function teachersFor(g){
    try{
      const all=window.PCIGradingV76?.allContexts?.()||[];
      const ctx=all.find(x=>x.orientation===g.orientation&&x.group?.id===g.groupId&&x.commission?.key===g.commissionKey);
      if(!ctx)return[];
      const api=window.PCIInstitutionalV48;
      const r=root(),ids=new Set();
      for(const row of (api?.implementationRows?.(g.orientation)||[])){
        if(row.course!==g.course)continue;
        if(!(ctx.group.subjectIds||[]).includes(row.subjectId))continue;
        const tid=r.assignments?.[row.instanceId];
        if(tid)ids.add(tid);
      }
      return [...ids].map(id=>r.teachers?.[id]).filter(Boolean);
    }catch{return[]}
  }

  function ensureClosure(g){
    const store=root().grading.closures;
    if(!store[g.key])store[g.key]={
      key:g.key,
      orientation:g.orientation,
      groupId:g.groupId,
      groupName:g.groupName,
      commissionKey:g.commissionKey,
      course:g.course,
      year:g.year,
      type:closureType(g),
      status:'carga',
      validatorTeacherId:'',
      rows:{},
      validatedAt:'',
      publishedAt:''
    };
    const c=store[g.key];
    c.rows=c.rows||{};
    c.type=closureType(g);
    return c;
  }

  function rowFor(c,s){
    if(!c.rows[s.dni])c.rows[s.dni]={dni:s.dni,final:'',observation:''};
    return c.rows[s.dni];
  }

  function planGrade(p,dni){
    const r=p.rows?.[dni];
    return r?.final??'';
  }

  function planDate(p,dni){
    return String(p.rows?.[dni]?.completedAt||'');
  }

  function baseGroupId(groupId){
    return String(groupId||'').replace(/-c\d+$/,'');
  }

  function termNumber(g){
    const m=String(g?.groupId||'').match(/-c(\d+)$/);
    return m?Number(m[1]):null;
  }

  function definitiveKey(g){
    if(closureType(g)==='Cierre anual')return ['annual',g.orientation,g.groupId,g.commissionKey].join('|||');
    return ['cuatrimestral',g.orientation,baseGroupId(g.groupId),g.year,g.commissionKey].join('|||');
  }

  function definitiveGroups(g){
    if(closureType(g)==='Cierre anual')return [g];
    const base=baseGroupId(g.groupId);
    return closureGroups().filter(x=>
      x.orientation===g.orientation&&
      x.commissionKey===g.commissionKey&&
      Number(x.year)===Number(g.year)&&
      closureType(x)==='Cierre cuatrimestral'&&
      baseGroupId(x.groupId)===base
    ).sort((a,b)=>(termNumber(a)||0)-(termNumber(b)||0));
  }

  function ensureDefinitive(g){
    const store=root().grading.definitives;
    const key=definitiveKey(g);
    if(!store[key])store[key]={
      key,
      orientation:g.orientation,
      baseGroupId:closureType(g)==='Cierre anual'?g.groupId:baseGroupId(g.groupId),
      year:g.year,
      commissionKey:g.commissionKey,
      course:g.course,
      rows:{}
    };
    store[key].rows=store[key].rows||{};
    return store[key];
  }

  function definitiveRowFor(d,s){
    if(!d.rows[s.dni])d.rows[s.dni]={dni:s.dni,final:'',observation:''};
    return d.rows[s.dni];
  }

  function definitiveReady(g,s){
    const groups=definitiveGroups(g);
    if(closureType(g)==='Cierre anual'){
      const c=ensureClosure(g);
      return !!String(rowFor(c,s).final||'').trim();
    }
    if(groups.length<2)return false;
    return groups.every(group=>!!String(rowFor(ensureClosure(group),s).final||'').trim());
  }

  function showDefinitiveInBulletin(g){
    if(closureType(g)==='Cierre anual')return true;
    const groups=definitiveGroups(g);
    return groups.length&&groups[groups.length-1]?.key===g.key;
  }

  const localDate=now=>new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);

  function regularityFor(dni,asOf=localDate(new Date())){
    try{return window.PCIRegularityV79?.summarize?.(dni,{asOf})||null}
    catch(error){console.warn('V77 regularidad',error);return null}
  }

  function familyGrade(finalValue,regularity){
    if(regularity&&regularity.regular===false)return 'No Regular';
    return String(finalValue||'').trim()||'—';
  }

  function fmtDate(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');
  }

  function hasMissing(g,c){
    const students=studentsFor(g.commissionKey);
    return students.some(s=>String(rowFor(c,s).final||'').trim()==='');
  }

  function canValidate(g,c){
    return !hasMissing(g,c);
  }

  function ensureScreen(){
    let s=$('bulletins');
    if(s)return s;
    const main=document.querySelector('main.wrap');if(!main)return null;
    s=document.createElement('section');s.id='bulletins';s.className='screen';
    s.innerHTML='<div id="v77Root"></div>';main.appendChild(s);return s;
  }

  function showScreen(){
    const s=ensureScreen();if(!s)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    s.classList.add('active');window.scrollTo(0,0);
  }

  function goHome(){
    const h=$('home');if(!h)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    h.classList.add('active');
    window.PCIHomeRedesignV74?.refresh?.();
    window.scrollTo(0,0);
  }

  function patchHome(){
    const home=$('home'), grading=$('v75Grading');if(!home||!grading)return;
    let card=$('v77BulletinsEntry');
    if(!card){
      card=document.createElement('article');
      card.id='v77BulletinsEntry';card.className='card v75-grading v77-home-entry';
      grading.after(card);
    }
    const familyMode=['student','family'].includes(accessScope.role);
    card.innerHTML=familyMode
      ?'<div><div class="eyebrow">Resultados</div><h2>Boletines publicados</h2><p>Consulta únicamente los resultados que la escuela ya publicó.</p><small>Las cargas internas, revisiones y criterios ocultos no se muestran.</small></div><button type="button" class="btn primary" data-v77-open>Ver resultados</button>'
      :'<div><div class="eyebrow">4 · Boletines</div><h2>Boletines y cierres</h2><p>Valida el cierre común de cada agrupamiento y genera la vista institucional del boletín.</p><small>Un único cierre oficial por agrupamiento, comisión y período.</small></div><button type="button" class="btn primary" data-v77-open>Abrir Boletines</button>';
    card.hidden=false;
    card.querySelector('[data-v77-open]').onclick=open;
  }

  function open(){
    showScreen();
    selectedKey='';
    if(['student','family'].includes(accessScope.role))renderPublishedHome();else renderHome();
  }

  function statusLabel(s){return STATUSES.find(x=>x[0]===s)?.[1]||s}

  function renderHome(){
    const host=$('v77Root');if(!host)return;
    if(['student','family'].includes(accessScope.role))return renderPublishedHome();
    const groups=visibleClosureGroups();
    const settings=root().grading.settings;

    const orientations=[...new Set(groups.map(g=>g.orientation))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
    const years=[...new Set(groups.map(g=>Number(g.year)))].filter(Boolean).sort((a,b)=>a-b);
    const courses=[...new Set(groups.map(g=>g.course))].sort((a,b)=>String(a).localeCompare(String(b),'es'));

    const filtered=groups.filter(g=>
      (!homeFilters.orientation||g.orientation===homeFilters.orientation)&&
      (!homeFilters.year||String(g.year)===String(homeFilters.year))&&
      (!homeFilters.course||g.course===homeFilters.course)
    );

    const byCourse=new Map();
    for(const g of filtered){
      const key=[g.orientation,g.course].join('|||');
      if(!byCourse.has(key))byCourse.set(key,{orientation:g.orientation,course:g.course,year:g.year,groups:[]});
      byCourse.get(key).groups.push(g);
    }

    const published=filtered.filter(g=>ensureClosure(g).status==='publicado').length;
    const validated=filtered.filter(g=>['validado','publicado'].includes(ensureClosure(g).status)).length;

    host.innerHTML=`
      <div class="v77-topbar"><button class="btn soft" type="button" data-v77-home>← Inicio</button></div>
      <div class="v77-hero">
        <div class="eyebrow">Boletines</div>
        <h1>Cierres y publicación</h1>
        <p>El cierre es único para todo el agrupamiento. Los docentes cargan; el equipo revisa; un responsable valida; recién después puede publicarse.</p>
      </div>

      <section class="v77-browser">
        <div class="v77-browser-head">
          <div><div class="eyebrow">Navegación</div><h2>Buscar qué querés cerrar o publicar</h2></div>
          <button type="button" class="btn soft" data-v77-clear>Limpiar filtros</button>
        </div>
        <div class="v77-filters">
          <label><span>Orientación</span><select data-v77-filter="orientation"><option value="">Todas</option>${orientations.map(v=>`<option value="${esc(v)}" ${homeFilters.orientation===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <label><span>Nivel</span><select data-v77-filter="year"><option value="">Todos</option>${years.map(v=>`<option value="${v}" ${String(homeFilters.year)===String(v)?'selected':''}>Nivel ${v}</option>`).join('')}</select></label>
          <label><span>Comisión</span><select data-v77-filter="course"><option value="">Todas</option>${courses.map(v=>`<option value="${esc(v)}" ${homeFilters.course===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        </div>
        <div class="v77-summary">
          <span><strong>${filtered.length}</strong> cierres</span>
          <span><strong>${validated}</strong> validados</span>
          <span><strong>${published}</strong> publicados</span>
          <span><strong>${byCourse.size}</strong> comisiones visibles</span>
        </div>
      </section>

      ${accessScope.role==='admin'?`<section class="card v77-settings">
        <div><div class="eyebrow">Familias y estudiantes</div><h2>Visibilidad</h2><p>Por defecto los criterios no son visibles.</p></div>
        <label><input type="checkbox" data-v77-criteria ${settings.showCriteriaToFamilies?'checked':''}> Mostrar criterios a familias y estudiantes</label>
      </section>`:''}

      <div class="v77-course-stack">${byCourse.size?[...byCourse.values()].map(block=>`
        <section class="v77-course-block">
          <header class="v77-course-head">
            <div><small>${esc(block.orientation)}</small><h2>${esc(block.course)}</h2></div>
            <span>Nivel ${esc(block.year)}</span>
          </header>
          <div class="v77-grid">${block.groups.map(g=>{
            const c=ensureClosure(g),students=studentsFor(g.commissionKey),missing=students.filter(s=>!String(rowFor(c,s).final||'').trim()).length;
            return `<article class="v77-card">
              <div class="v77-card-head"><span>${esc(closureType(g))}</span><b>${g.plans.length} planes</b></div>
              <h3>${esc(g.groupName)}</h3>
              <div class="v77-tags"><span class="status ${esc(c.status)}">${esc(statusLabel(c.status))}</span><span>${students.length-missing}/${students.length} cierres cargados</span></div>
              <button type="button" class="btn primary" data-v77-open-closure="${esc(g.key)}">Abrir cierre</button>
            </article>`;
          }).join('')}</div>
        </section>`).join(''):'<div class="v77-empty"><strong>No hay resultados con estos filtros.</strong><span>Cambiá orientación, nivel o comisión para volver a ver los cierres disponibles.</span></div>'}</div>`;

    host.querySelector('[data-v77-home]').onclick=goHome;
    host.querySelector('[data-v77-clear]').onclick=()=>{homeFilters={orientation:'',year:'',course:''};renderHome()};
    host.querySelectorAll('[data-v77-filter]').forEach(s=>s.onchange=()=>{homeFilters[s.dataset.v77Filter]=s.value;renderHome()});
    const criteriaToggle=host.querySelector('[data-v77-criteria]');if(criteriaToggle)criteriaToggle.onchange=e=>{settings.showCriteriaToFamilies=!!e.target.checked;save();toast('Configuración de visibilidad guardada.')};
    host.querySelectorAll('[data-v77-open-closure]').forEach(b=>b.onclick=()=>{selectedKey=b.dataset.v77OpenClosure;renderClosure()});
  }

  function renderClosure(){
    const host=$('v77Root');if(!host)return;
    if(!['admin','teacher'].includes(accessScope.role))return renderPublishedHome();
    const g=visibleClosureGroups().find(x=>x.key===selectedKey);if(!g)return renderHome();
    const c=ensureClosure(g),students=studentsFor(g.commissionKey),teachers=teachersFor(g);
    const ready=canValidate(g,c);
    host.innerHTML=`
      <div class="v77-topbar"><button class="btn soft" type="button" data-v77-back>← Boletines</button></div>
      <div class="v77-hero">
        <div class="eyebrow">${esc(g.orientation)} · ${esc(g.course)}</div>
        <h1>${esc(g.groupName)}</h1>
        <p>${esc(c.type)} · ${g.plans.length} planes · ${students.length} estudiantes</p>
      </div>
      <section class="card v77-workflow">
        <div><div class="eyebrow">Flujo de cierre</div><h2>${esc(statusLabel(c.status))}</h2></div>
        <label>Responsable de validación
          <select data-v77-validator>
            <option value="">Seleccionar</option>
            ${teachers.map(t=>`<option value="${esc(t.id)}" ${String(c.validatorTeacherId)===String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>
        <div class="v77-actions">
          <button class="btn soft" type="button" data-v77-review>Enviar a revisión</button>
          <button class="btn primary" type="button" data-v77-validate ${ready?'':'disabled'}>Validar cierre</button>
          <button class="btn primary" type="button" data-v77-publish ${c.status==='validado'?'':'disabled'}>Publicar</button>
        </div>
      </section>
      ${!ready?'<div class="v77-warning">Faltan calificaciones de cierre. No se puede validar todavía.</div>':''}
      <section class="card v77-table-card">
        <div class="eyebrow">Cierre común del agrupamiento</div>
        <h2>Planilla de cierre</h2>
        <div class="v77-table-wrap"><table class="v77-table"><thead><tr>
          <th>DNI</th><th>Estudiante</th>
          ${g.plans.map(p=>`<th>Plan ${esc(p.planNumber)}<small>${esc(p.planName||'')}</small></th>`).join('')}
          <th>${closureType(g)==='Cierre anual'?'Calificación anual':'Calificación cuatrimestral'}</th><th>Calificación definitiva</th><th>Observación</th>
        </tr></thead><tbody>
          ${students.map(s=>{const r=rowFor(c,s),d=ensureDefinitive(g),dr=definitiveRowFor(d,s),defReady=definitiveReady(g,s);return `<tr data-dni="${esc(s.dni)}">
            <td>${esc(s.dni)}</td><td><strong>${esc((s.lastName||'')+' '+(s.firstName||''))}</strong></td>
            ${g.plans.map(p=>`<td><strong>${esc(planGrade(p,s.dni)||'—')}</strong>${planDate(p,s.dni)?`<small>${esc(fmtDate(planDate(p,s.dni)))}</small>`:''}</td>`).join('')}
            <td><input data-v77-final value="${esc(r.final)}" ${c.status==='publicado'?'readonly':''}></td>
            <td><input data-v77-definitive value="${esc(dr.final)}" ${defReady?'':'disabled'} title="${defReady?'Definición colegiada manual':'Primero deben estar cargados los cierres necesarios'}"><small>${defReady?'Carga colegiada · sin promedio automático':'Pendiente de cierres previos'}</small></td>
            <td><input data-v77-obs value="${esc(r.observation)}" ${c.status==='publicado'?'readonly':''}></td>
          </tr>`}).join('')}
        </tbody></table></div>
      </section>
      <section class="card v77-preview">
        <div class="eyebrow">Vista de boletín</div><h2>Boletín muestra</h2>
        <p>Visualizá cómo quedaría el boletín individual del estudiante tomando todos los cierres de esta comisión.</p>
        <div class="v77-preview-controls">
          <label>Estudiante
            <select data-v77-student-preview>
              <option value="">Seleccionar</option>
              ${students.map(s=>`<option value="${esc(s.dni)}">${esc((s.lastName||'')+' '+(s.firstName||''))}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="btn primary" data-v77-show-bulletin>Ver boletín muestra</button>
          <button type="button" class="btn soft" data-v77-print>Imprimir cierre actual</button>
        </div>
      </section>`;

    host.querySelector('[data-v77-back]').onclick=renderHome;
    host.querySelector('[data-v77-validator]').onchange=e=>{c.validatorTeacherId=e.target.value;save()};
    host.querySelectorAll('tbody tr').forEach(tr=>{
      const r=c.rows[tr.dataset.dni];
      tr.querySelector('[data-v77-final]').onchange=e=>{r.final=e.target.value.trim();save();renderClosure()};
      const defInput=tr.querySelector('[data-v77-definitive]');
      if(defInput)defInput.onchange=e=>{
        const d=ensureDefinitive(g),dr=definitiveRowFor(d,{dni:tr.dataset.dni});
        dr.final=e.target.value.trim();
        save();
        renderClosure();
      };
      tr.querySelector('[data-v77-obs]').onchange=e=>{r.observation=e.target.value;save()};
    });
    host.querySelector('[data-v77-review]').onclick=()=>{c.status='revision';save();renderClosure();toast('Cierre enviado a revisión.')};
    host.querySelector('[data-v77-validate]').onclick=()=>{
      if(!c.validatorTeacherId)return toast('Seleccioná un responsable de validación.',true);
      if(!canValidate(g,c))return toast('Faltan calificaciones de cierre.',true);
      c.status='validado';c.validatedAt=new Date().toISOString();save();renderClosure();toast('Cierre validado.');
    };
    host.querySelector('[data-v77-publish]').onclick=()=>{
      c.status='publicado';c.publishedAt=new Date().toISOString();save();renderClosure();toast('Cierre publicado para boletines.');
    };
    host.querySelector('[data-v77-show-bulletin]').onclick=()=>{
      const dni=host.querySelector('[data-v77-student-preview]')?.value;
      const student=students.find(s=>String(s.dni)===String(dni));
      if(!student)return toast('Seleccioná un estudiante.',true);
      renderStudentBulletin(g,student);
    };
    host.querySelector('[data-v77-print]').onclick=()=>printPreview(g,c,students);
  }

  function studentBulletinRows(g,student,publishedOnly=false){
    const sameCommission=closureGroups().filter(x=>x.orientation===g.orientation&&x.commissionKey===g.commissionKey&&(!publishedOnly||root().grading.closures?.[x.key]?.status==='publicado'));
    return sameCommission.map(group=>{
      const closure=publishedOnly?root().grading.closures?.[group.key]:ensureClosure(group);
      if(!closure)return null;
      const row=publishedOnly?(closure.rows?.[student.dni]||{final:'',observation:''}):rowFor(closure,student);
      const d=publishedOnly?root().grading.definitives?.[definitiveKey(group)]:ensureDefinitive(group);
      const dr=publishedOnly?(d?.rows?.[student.dni]||{final:'',observation:''}):definitiveRowFor(d,student);
      return {
        groupName:group.groupName,
        groupType:group.groupType,
        closureType:closure.type,
        status:closure.status,
        plans:group.plans.map(p=>({planNumber:p.planNumber,planName:p.planName||'',grade:planGrade(p,student.dni)||'',date:planDate(p,student.dni)||''})),
        final:row.final||'',
        definitive:showDefinitiveInBulletin(group)?(dr.final||''):'',
        observation:row.observation||''
      };
    }).filter(Boolean);
  }

  function renderStudentBulletin(g,student,publishedOnly=false){
    const content=$('printContent'),modal=$('printModal');
    if(!content||!modal)return toast('No está disponible la vista de impresión.',true);
    const rows=studentBulletinRows(g,student,publishedOnly);
    const criteriaVisible=!!root().grading.settings.showCriteriaToFamilies;
    const regularity=regularityFor(student.dni);
    const regularityStatus=regularity?.status||'Sin datos';
    const regularityContext=regularity?.period?.label ? `${regularity.period.label} · al ${fmtDate(regularity.asOf)}` : (regularity?.asOf?`al ${fmtDate(regularity.asOf)}`:'');
    content.className='print-preview-wrap';
    content.innerHTML=`
      <article class="pci-print-sheet v77-bulletin-sheet">
        <div class="v77-bulletin-head">
          <div>
            <div class="pci-print-kicker">Boletín de trayectoria</div>
            <h1>${esc(state.school||'Escuela')}</h1>
            <p>${esc(g.orientation)} · ${esc(g.course)}</p>
          </div>
          <div class="v77-bulletin-student">
            <small>Estudiante</small>
            <strong>${esc((student.lastName||'')+' '+(student.firstName||''))}</strong>
            <span>DNI ${esc(student.dni||'')}</span>
          </div>
        </div>
        <div class="v77-bulletin-meta">
          <span><b>Nivel</b> ${esc(g.year)}</span>
          <span><b>Comisión</b> ${esc(g.course)}</span>
          <span><b>Orientación</b> ${esc(g.orientation)}</span>
          <span class="v77-regularity-status ${regularity?.regular===false?'no-regular':'regular'}"><b>Regularidad</b> ${esc(regularityStatus)}</span>
          ${regularityContext?`<span><b>Período</b> ${esc(regularityContext)}</span>`:''}
          ${regularity?`<span><b>Injustificadas</b> ${esc(regularity.bimester)} bimestre · ${esc(regularity.annual)} anuales</span>`:''}
        </div>
        <table class="v77-bulletin-table">
          <thead><tr><th>Espacio / agrupamiento</th><th>Planes</th><th>Cierre</th><th>Calificación definitiva</th><th>Estado</th><th>Observación</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td><strong>${esc(r.groupName)}</strong><small>${esc(r.closureType)}</small></td>
              <td>${r.plans.map(p=>`<div class="v77-plan-result"><b>Plan ${esc(p.planNumber)}</b> ${esc(p.grade||'—')}${p.date?` <small>${esc(fmtDate(p.date))}</small>`:''}</div>`).join('')}</td>
              <td class="v77-bulletin-grade">${esc(familyGrade(r.final,regularity))}</td>
              <td class="v77-bulletin-grade">${r.definitive?esc(familyGrade(r.definitive,regularity)):'—'}</td>
              <td>${esc(statusLabel(r.status))}</td>
              <td>${esc(r.observation||'')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="v77-bulletin-foot">
          <span>Criterios visibles para familias: <strong>${criteriaVisible?'Sí':'No'}</strong></span>
          <span>${regularity?.regular===false?'Las calificaciones permanecen registradas internamente; esta vista muestra No Regular según la condición de regularidad.':'Documento de muestra generado desde los cierres del sistema.'}</span>
        </div>
      </article>`;
    modal.classList.add('open');
  }

  function renderPublishedHome(){
    const host=$('v77Root');if(!host)return;
    const dnis=(accessScope.studentDnis||[]).map(x=>String(x||'').replace(/\D/g,'')).filter(Boolean);
    const students=dnis.map(dni=>root().students?.[dni]).filter(Boolean);
    const cards=[];
    for(const student of students){
      for(const key of studentCommissionKeys(student.dni)){
        const groups=publishedGroupsForStudent(student.dni,key);if(!groups.length)continue;
        const c=root().commissions?.[key]||{};cards.push({student,key,groups,course:c.course||groups[0]?.course||'',orientation:c.orientation||groups[0]?.orientation||''});
      }
    }
    const body=cards.length?cards.map((x,i)=>'<article class="v77-card"><div class="v77-card-head"><span>'+esc(x.orientation)+'</span><b>'+x.groups.length+' resultados publicados</b></div><h3>'+esc((x.student.lastName||'')+' '+(x.student.firstName||''))+'</h3><p>'+esc(x.course)+' · DNI '+esc(x.student.dni)+'</p><button type="button" class="btn primary" data-v77-published="'+i+'">Ver boletín publicado</button></article>').join(''):'<div class="v77-empty"><strong>No hay resultados publicados.</strong><span>Cuando la escuela publique un cierre, aparecerá en esta sección.</span></div>';
    host.innerHTML='<div class="v77-topbar"><button class="btn soft" type="button" data-v77-home>← Inicio</button></div><div class="v77-hero"><div class="eyebrow">Resultados publicados</div><h1>Boletines</h1><p>Solo se muestran cierres que la escuela ya publicó para los estudiantes vinculados a esta sesión.</p></div><div class="v77-course-stack">'+body+'</div>';
    host.querySelector('[data-v77-home]')?.addEventListener('click',goHome);
    host.querySelectorAll('[data-v77-published]').forEach(b=>b.onclick=()=>{const x=cards[Number(b.dataset.v77Published)];if(x)renderStudentBulletin(x.groups[0],x.student,true)});
  }

  function printPreview(g,c,students){
    const content=$('printContent'),modal=$('printModal');
    if(!content||!modal)return toast('No está disponible la vista de impresión.',true);
    const criteriaVisible=!!root().grading.settings.showCriteriaToFamilies;
    content.className='print-preview-wrap';
    content.innerHTML=`<article class="pci-print-sheet"><div class="pci-print-kicker">Boletín · ${esc(state.school||'Escuela')}</div><h1>${esc(g.course)} · ${esc(g.groupName)}</h1><p><strong>${esc(c.type)}</strong> · Estado: ${esc(statusLabel(c.status))}</p>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="border:1px solid #bbb;padding:6px">Estudiante</th><th style="border:1px solid #bbb;padding:6px">Calificación</th><th style="border:1px solid #bbb;padding:6px">Observación</th></tr></thead><tbody>
      ${students.map(s=>{const r=rowFor(c,s);return `<tr><td style="border:1px solid #bbb;padding:6px">${esc((s.lastName||'')+' '+(s.firstName||''))}</td><td style="border:1px solid #bbb;padding:6px">${esc(r.final||'—')}</td><td style="border:1px solid #bbb;padding:6px">${esc(r.observation||'')}</td></tr>`}).join('')}</tbody></table>
      <p style="margin-top:12px;font-size:.8rem">Criterios visibles para familias: <strong>${criteriaVisible?'Sí':'No'}</strong></p></article>`;
    modal.classList.add('open');
  }

  function start(){ensureScreen();patchHome()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1200));
  setTimeout(start,1800);

  const style=document.createElement('style');style.textContent=`
    .v77-home-entry{margin-top:12px!important}.v77-topbar{margin-bottom:12px}.v77-hero{padding:24px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(135deg,#f6fafc,#eef6f4)}.v77-hero h1{margin:4px 0 5px}.v77-hero p{margin:0;color:var(--muted);font-size:.7rem}
    .v77-browser{margin:14px 0;padding:16px;border:1px solid var(--line);border-radius:18px;background:#fff}.v77-browser-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.v77-browser-head h2{margin:4px 0 0}.v77-filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:12px}.v77-filters label{display:grid;gap:5px}.v77-filters span{font-size:.56rem;font-weight:900;color:var(--muted)}.v77-filters select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}.v77-summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v77-summary span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--band);font-size:.6rem}.v77-course-stack{display:grid;gap:18px;margin-top:14px}.v77-course-block{padding:16px;border:1px solid var(--line);border-radius:20px;background:#f9fbfc}.v77-course-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:12px}.v77-course-head small{display:block;color:var(--muted);font-size:.55rem}.v77-course-head h2{margin:3px 0 0}.v77-course-head>span{padding:6px 9px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:.54rem;font-weight:900}
    .v77-settings,.v77-workflow,.v77-table-card,.v77-preview{margin-top:14px;padding:17px}.v77-settings{display:flex;justify-content:space-between;align-items:center;gap:14px}.v77-settings h2,.v77-workflow h2,.v77-table-card h2,.v77-preview h2{margin:4px 0}.v77-settings p,.v77-preview p{margin:0;color:var(--muted);font-size:.64rem}.v77-preview-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:12px}.v77-preview-controls label{display:grid;gap:5px;min-width:240px;font-size:.58rem;font-weight:900}.v77-preview-controls select{padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff}.v77-bulletin-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.v77-bulletin-student{text-align:right}.v77-bulletin-student small,.v77-bulletin-student span{display:block;color:#5f7180;font-size:.75rem}.v77-bulletin-student strong{display:block;font-size:1.05rem;margin:3px 0}.v77-bulletin-meta{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.v77-bulletin-meta span{padding:6px 9px;border:1px solid #ccd7df;border-radius:999px;font-size:.72rem}.v77-regularity-status.regular{background:#edf8f3}.v77-regularity-status.no-regular{background:#fff0f2;border-color:#d6a4ae}.v77-bulletin-table{width:100%;border-collapse:collapse;font-size:.78rem}.v77-bulletin-table th,.v77-bulletin-table td{padding:8px;border:1px solid #cfd8df;text-align:left}.v77-bulletin-table th{background:#eef4f7}.v77-bulletin-grade{font-size:1rem;font-weight:900;text-align:center!important}.v77-bulletin-foot{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:#607280;font-size:.7rem}
    .v77-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.v77-card{padding:15px;border:1px solid var(--line);border-radius:17px;background:#fff}.v77-card-head{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:.55rem}.v77-card h3{margin:8px 0 4px}.v77-card p{margin:0;color:var(--muted);font-size:.6rem}.v77-tags{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.v77-tags span{padding:5px 7px;border-radius:999px;background:var(--band);font-size:.52rem}.v77-tags .publicado{background:var(--ok-soft);color:var(--ok)}.v77-tags .validado{background:var(--mint-soft);color:var(--mint-dark)}.v77-empty,.v77-warning{margin-top:14px;padding:14px;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}.v77-warning{border-color:#dfc476;background:#fff8df;color:#775b0c}
    .v77-workflow{display:grid;grid-template-columns:1fr minmax(220px,320px) auto;gap:12px;align-items:end}.v77-workflow label{display:grid;gap:5px;font-size:.58rem;font-weight:900}.v77-workflow select{padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff}.v77-actions{display:flex;gap:6px;flex-wrap:wrap}
    .v77-table-wrap{overflow:auto;margin-top:10px;border:1px solid var(--line);border-radius:12px}.v77-table{width:100%;min-width:1100px;border-collapse:collapse;font-size:.58rem}.v77-table th,.v77-table td{padding:7px;border-bottom:1px solid var(--line);vertical-align:middle}.v77-table th{background:var(--band);text-align:left}.v77-table th small,.v77-table td small{display:block;margin-top:2px;color:var(--muted);font-weight:500}.v77-table input{width:100%;padding:7px;border:1px solid var(--line);border-radius:8px}.v77-plan-result{white-space:nowrap;margin:2px 0}.v77-plan-result small{display:inline;margin-left:4px;color:#607280}
    @media(max-width:980px){.v77-grid{grid-template-columns:1fr}.v77-filters{grid-template-columns:1fr 1fr}}@media(max-width:760px){.v77-browser-head,.v77-course-head,.v77-bulletin-head,.v77-bulletin-foot{align-items:flex-start;flex-direction:column}.v77-bulletin-student{text-align:left}.v77-filters{grid-template-columns:1fr}.v77-settings,.v77-workflow{grid-template-columns:1fr;align-items:stretch;flex-direction:column}.v77-actions,.v77-preview-controls{display:grid;grid-template-columns:1fr}.v77-actions .btn,.v77-preview-controls .btn,.v77-preview-controls label{width:100%;min-width:0}}
  `;document.head.appendChild(style);

  function setAccessScope(scope={}){
    const role=['admin','teacher','student','family'].includes(scope.role)?scope.role:'admin';
    accessScope={role,teacherId:String(scope.teacherId||''),studentDnis:Array.isArray(scope.studentDnis)?scope.studentDnis.map(x=>String(x||'').replace(/\D/g,'')).filter(Boolean):[],commissionKeys:Array.isArray(scope.commissionKeys)?scope.commissionKeys.map(String):null};
    selectedKey='';homeFilters={orientation:'',year:'',course:''};patchHome();
    if($('bulletins')?.classList.contains('active'))open();
  }

  window.PCIBulletinsV77={open,renderHome,renderClosure,closureGroups,visibleClosureGroups,regularityFor,familyGrade,studentBulletinRows,publishedGroupsForStudent,studentCommissionKeys,renderPublishedHome,planGrade,planDate,baseGroupId,definitiveKey,definitiveGroups,ensureDefinitive,definitiveRowFor,definitiveReady,showDefinitiveInBulletin,setAccessScope,getAccessScope:()=>({...accessScope})};
})();