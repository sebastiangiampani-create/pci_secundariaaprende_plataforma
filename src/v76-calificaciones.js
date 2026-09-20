(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const STAGES=[['punto_partida','Punto de partida'],['indagacion','Indagación'],['produccion','Producción'],['evaluacion','Evaluación']];
  const PLAN_STATUS=[['no_iniciado','No iniciado'],['en_proceso','En proceso'],['finalizado','Finalizado']];
  const localDate=now=>new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  let selectedContext=null;
  let homeFilters={orientation:'',year:'',course:''};
  let accessScope={role:'admin',teacherId:''};

  function root(){
    state.institutional=state.institutional||{};
    state.institutional.grading=state.institutional.grading||{plans:{}};
    state.institutional.grading.plans=state.institutional.grading.plans||{};
    return state.institutional;
  }

  function withOrientation(orientation,fn){
    const prev=state.active; state.active=orientation;
    try{return fn()}finally{state.active=prev}
  }

  function curricularGroups(orientation){
    return withOrientation(orientation,()=>window.PCIPhase2V28?.groups?.()||[]);
  }

  function commissionDefs(){
    return window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];
  }

  function studentsFor(key){
    return window.PCIStudentsCommissionsV72?.studentsFor?.(key)||[];
  }

  function expectedPlanCount(g){
    return String(g.term||'').includes('-')?4:2;
  }

  function planName(ctx){
    const p=ctx?.plan;
    const direct=String(p?.name||'').trim();
    if(direct)return direct;
    const electiveA=String(p?.elective?.A?.name||'').trim();
    const electiveB=String(p?.elective?.B?.name||'').trim();
    if(electiveA&&electiveB)return electiveA+' / '+electiveB;
    if(electiveA)return electiveA;
    if(electiveB)return electiveB;
    const stored=String(ctx?.group?.data?.plansBimestrales?.[Number(ctx?.planNumber||1)-1]?.name||'').trim();
    if(stored)return stored;
    return `${ctx?.group?.data?.name||ctx?.group?.name||'Agrupamiento'} · Plan ${ctx?.planNumber||''}`.trim();
  }

  function allContexts(){
    const out=[];
    for(const orientation of (state.selected||[])){
      const groups=curricularGroups(orientation);
      const commissions=commissionDefs().filter(c=>c.orientation===orientation);
      for(const g of groups){
        const comms=commissions.filter(c=>Number(c.year)===Number(g.year));
        const plans=Array.from({length:expectedPlanCount(g)},(_,i)=>g.data?.plansBimestrales?.[i]||null);
        for(const c of comms){
          plans.forEach((p,i)=>out.push({
            orientation,group:g,commission:c,plan:p,planNumber:i+1,
            key:[orientation,g.id,i+1,c.key].join('|||')
          }));
        }
      }
    }
    return out;
  }

  function scopedContexts(){
    const all=allContexts();
    if(accessScope.role==='admin')return all;
    if(accessScope.role!=='teacher'||!accessScope.teacherId)return [];
    return all.filter(ctx=>teachersFor(ctx).some(t=>String(t.id||t.teacherId||'')===String(accessScope.teacherId)));
  }

  function teachersFor(ctx){
    const api=window.PCIInstitutionalV48;
    const assignments=root().assignments||{};
    const teachers=root().teachers||{};
    if(!api?.implementationRows)return[];
    const ids=new Set();
    const rows=api.implementationRows(ctx.orientation)||[];
    for(const row of rows){
      if(row.course!==ctx.commission.course)continue;
      if(!(ctx.group.subjectIds||[]).includes(row.subjectId))continue;
      const tid=assignments[row.instanceId];
      if(tid)ids.add(tid);
    }
    return [...ids].map(id=>teachers[id]).filter(Boolean);
  }

  function ensureEval(ctx){
    const plans=root().grading.plans;
    let e=plans[ctx.key];
    if(!e){
      e=plans[ctx.key]={
        key:ctx.key,
        orientation:ctx.orientation,
        groupId:ctx.group.id,
        groupName:ctx.group.data?.name||ctx.group.name,
        groupType:ctx.group.type,
        year:ctx.group.year,
        commissionKey:ctx.commission.key,
        course:ctx.commission.course,
        planNumber:ctx.planNumber,
        planName:planName(ctx),
        criteria:['','','','',''],
        rows:{}
      };
    }
    e.planName=planName(ctx)||e.planName||'';
    e.criteria=Array.isArray(e.criteria)?e.criteria.slice(0,5):['','','','',''];
    while(e.criteria.length<5)e.criteria.push('');
    e.rows=e.rows||{};
    return e;
  }

  function criteriaReady(e){return e.criteria.slice(0,4).every(x=>String(x||'').trim())}

  function rowFor(e,s){
    if(!e.rows[s.dni])e.rows[s.dni]={dni:s.dni,status:'no_iniciado',stage:'',criteria:['','','','',''],final:'',completedAt:'',weight:'',weighted:''};
    const r=e.rows[s.dni];
    r.status=r.status||((r.final||r.stage)?'en_proceso':'no_iniciado');
    r.completedAt=String(r.completedAt||'');
    r.criteria=Array.isArray(r.criteria)?r.criteria.slice(0,5):['','','','',''];while(r.criteria.length<5)r.criteria.push('');
    return r;
  }

  function saveAll(){save()}

  function ensureScreen(){
    if($('grading'))return $('grading');
    const main=document.querySelector('main.wrap');if(!main)return null;
    const section=document.createElement('section');
    section.id='grading';section.className='screen';
    section.innerHTML='<div id="v76GradingRoot"></div>';
    main.appendChild(section);
    return section;
  }

  function patchHomeEntry(){
    const card=$('v75Grading');if(!card)return;
    card.hidden=!['admin','teacher'].includes(accessScope.role);
    const btn=card.querySelector('button');
    if(btn){
      btn.disabled=false;btn.className='btn primary';btn.textContent='Abrir Calificaciones';
      btn.onclick=()=>openGrading();
    }
    const small=card.querySelector('small');if(small)small.textContent='Plan piloto habilitado para prueba.';
  }

  function showGradingScreen(){
    const section=ensureScreen();if(!section)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    section.classList.add('active');
    window.scrollTo(0,0);
  }

  function goHome(){
    const home=$('home');if(!home)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    home.classList.add('active');
    window.PCIHomeRedesignV74?.refresh?.();
    window.PCINavigation?.refresh?.();
    window.scrollTo(0,0);
  }

  function openGrading(){
    if(!['admin','teacher'].includes(accessScope.role))return toast('No tenés permiso para acceder a Calificaciones.',true);
    showGradingScreen();
    renderHome();
  }

  function renderHome(){
    const host=$('v76GradingRoot');if(!host)return;
    selectedContext=null;
    let contexts=[];
    try{contexts=scopedContexts()}catch(error){
      console.error('V76 contexts',error);
      host.innerHTML='<div class="v76-topbar"><button type="button" class="btn soft" data-v76-home>← Inicio</button></div><div class="v76-hero"><div class="eyebrow">Calificaciones</div><h1>Evaluación de planes</h1><p>No se pudo reconstruir todavía la relación entre planes y comisiones.</p></div><div class="v76-empty-state"><strong>Calificaciones todavía no pudo leer la estructura curricular.</strong><span>Volvé a Inicio y comprobá que existan planes en Desarrollo Curricular y comisiones en Gestión.</span></div>';
      host.querySelector('[data-v76-home]').onclick=goHome;
      return;
    }

    const orientations=[...new Set(contexts.map(x=>x.orientation))].sort((a,b)=>a.localeCompare(b,'es'));
    const years=[...new Set(contexts.map(x=>Number(x.group.year)))].filter(Boolean).sort((a,b)=>a-b);
    const courses=[...new Set(contexts.map(x=>x.commission.course))].sort((a,b)=>a.localeCompare(b,'es'));

    const filtered=contexts.filter(ctx=>
      (!homeFilters.orientation||ctx.orientation===homeFilters.orientation)&&
      (!homeFilters.year||String(ctx.group.year)===String(homeFilters.year))&&
      (!homeFilters.course||ctx.commission.course===homeFilters.course)
    );

    const grouped=new Map();
    for(const ctx of filtered){
      const k=[ctx.orientation,ctx.commission.key,ctx.group.id].join('|||');
      if(!grouped.has(k))grouped.set(k,{ctx,plans:[]});
      grouped.get(k).plans.push(ctx);
    }

    const byCourse=new Map();
    for(const value of grouped.values()){
      const key=[value.ctx.orientation,value.ctx.commission.course].join('|||');
      if(!byCourse.has(key))byCourse.set(key,{ctx:value.ctx,groups:[]});
      byCourse.get(key).groups.push(value);
    }

    host.innerHTML=`
      <div class="v76-topbar"><button type="button" class="btn soft" data-v76-home>← Inicio</button></div>
      <div class="v76-hero">
        <div class="eyebrow">Calificaciones</div>
        <h1>Evaluación de planes</h1>
        <p>Elegí orientación, nivel o comisión y trabajá sobre los planes que ya existen en Desarrollo Curricular.</p>
      </div>

      <section class="v76-browser">
        <div class="v76-browser-head">
          <div><div class="eyebrow">Navegación</div><h2>Buscar qué querés calificar</h2></div>
          <button type="button" class="btn soft" data-v76-clear>Limpiar filtros</button>
        </div>
        <div class="v76-filters">
          <label><span>Orientación</span><select data-v76-filter="orientation"><option value="">Todas</option>${orientations.map(v=>`<option value="${esc(v)}" ${homeFilters.orientation===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <label><span>Nivel</span><select data-v76-filter="year"><option value="">Todos</option>${years.map(v=>`<option value="${v}" ${String(homeFilters.year)===String(v)?'selected':''}>Nivel ${v}</option>`).join('')}</select></label>
          <label><span>Comisión</span><select data-v76-filter="course"><option value="">Todas</option>${courses.map(v=>`<option value="${esc(v)}" ${homeFilters.course===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        </div>
        <div class="v76-summary">
          <span><strong>${grouped.size}</strong> agrupamientos</span>
          <span><strong>${filtered.length}</strong> planes</span>
          <span><strong>${byCourse.size}</strong> comisiones visibles</span>
        </div>
      </section>

      <div class="v76-course-stack">${byCourse.size?[...byCourse.values()].map(({ctx,groups})=>`
        <section class="v76-course-block">
          <header class="v76-course-head">
            <div>
              <small>${esc(ctx.orientation)}</small>
              <h2>${esc(ctx.commission.course)}</h2>
            </div>
            <span>Nivel ${esc(ctx.group.year)}</span>
          </header>
          <div class="v76-grid">${groups.map(({ctx,plans})=>{
            const teachers=teachersFor(ctx);
            const ready=plans.filter(p=>criteriaReady(ensureEval(p))).length;
            return `<article class="v76-card">
              <div class="v76-card-head"><span>${esc(window.PCIPhase2V28?.typeLabel?.(ctx.group.type)||ctx.group.type)}</span><b>${ready}/${plans.length} criterios listos</b></div>
              <h3>${esc(ctx.group.data?.name||ctx.group.name)}</h3>
              <small class="v76-teachers">${teachers.length?teachers.map(t=>esc(t.name)).join(' · '):'Sin docentes asignados todavía'}</small>
              <div class="v76-plan-buttons">${plans.map(p=>`<button type="button" data-v76-open="${esc(p.key)}"><span>Plan ${p.planNumber}</span><strong>${esc(planName(p))}</strong><small>${criteriaReady(ensureEval(p))?'Criterios listos':'Definir criterios'}</small></button>`).join('')}</div>
            </article>`;
          }).join('')}</div>
        </section>`).join(''):'<div class="v76-empty-state"><strong>No hay resultados con estos filtros.</strong><span>Cambiá orientación, nivel o comisión para volver a ver los planes disponibles.</span></div>'}</div>`;

    host.querySelector('[data-v76-home]').onclick=goHome;
    host.querySelector('[data-v76-clear]').onclick=()=>{homeFilters={orientation:'',year:'',course:''};renderHome()};
    host.querySelectorAll('[data-v76-filter]').forEach(s=>s.onchange=()=>{homeFilters[s.dataset.v76Filter]=s.value;renderHome()});
    host.querySelectorAll('[data-v76-open]').forEach(b=>b.onclick=()=>openPlan(b.dataset.v76Open));
  }

  function openPlan(key){
    const ctx=allContexts().find(x=>x.key===key);if(!ctx)return;
    selectedContext=ctx;
    renderPlan();
  }

  function dashboardHtml(e,students){
    const counts=Object.fromEntries(STAGES.map(([k])=>[k,[]]));
    for(const s of students){const r=rowFor(e,s);if(counts[r.stage])counts[r.stage].push(s)}
    return `<div class="v76-dashboard">${STAGES.map(([k,l])=>{
      const names=counts[k].map(s=>`${s.lastName||''} ${s.firstName||''}`.trim()).join('\n')||'Sin estudiantes';
      return `<button type="button" title="${esc(names)}"><strong>${counts[k].length}</strong><span>${esc(l)}</span><small>Pasá o tocá para ver quiénes</small></button>`;
    }).join('')}</div>`;
  }

  function renderPlan(){
    const ctx=selectedContext;if(!ctx)return;
    const host=$('v76GradingRoot'),e=ensureEval(ctx),students=studentsFor(ctx.commission.key),teachers=teachersFor(ctx);
    const ready=criteriaReady(e);
    host.innerHTML=`
      <div class="v76-plan-top">
        <button type="button" class="btn soft" data-v76-back>← Calificaciones</button>
        <div>
          <div class="eyebrow">${esc(ctx.orientation)} · ${esc(ctx.commission.course)}</div>
          <h1>${esc(e.groupName)} · Plan ${ctx.planNumber}</h1>
          <h2 class="v76-plan-name">${esc(planName(ctx)||e.planName||'Plan sin nombre')}</h2>
          <p>${esc(window.PCIPhase2V28?.typeLabel?.(ctx.group.type)||ctx.group.type)} · Equipo: ${teachers.length?teachers.map(t=>esc(t.name)).join(' · '):'sin docentes asignados'}</p>
        </div>
      </div>

      <section class="card v76-criteria">
        <div class="eyebrow">Criterios colegiados</div>
        <h2>Definir 4 criterios obligatorios y un 5.º opcional</h2>
        <p>Los criterios pertenecen a este plan y a esta comisión. Todo el equipo docente trabaja sobre los mismos criterios: cuatro son obligatorios y el quinto es opcional.</p>
        <div class="v76-criteria-grid">${e.criteria.map((c,i)=>`<label><span>Criterio ${i+1}${i===4?' · opcional':''}</span><textarea data-v76-criterion="${i}" placeholder="Escribí el criterio acordado por el equipo docente">${esc(c)}</textarea></label>`).join('')}</div>
        <div class="v76-criteria-actions"><button type="button" class="btn primary" data-v76-save-criteria>Guardar criterios</button><span class="${ready?'ok':'pending'}">${ready?'Criterios completos':'Faltan criterios'}</span></div>
      </section>

      ${dashboardHtml(e,students)}

      <section class="card v76-sheet-section">
        <div class="v76-sheet-head">
          <div><div class="eyebrow">Carga de calificaciones</div><h2>Planilla de ${students.length} estudiantes</h2><p>Carga manual y Excel trabajan sobre la misma información.</p></div>
          <div class="v76-excel-actions">
            <button type="button" class="btn soft" data-v76-download>Descargar Excel</button>
            <label class="btn primary">Importar Excel<input type="file" accept=".xlsx" hidden data-v76-import></label>
          </div>
        </div>
        ${ready?sheetHtml(e,students):'<div class="v76-lock">Primero completá y guardá los cuatro criterios obligatorios.</div>'}
      </section>`;
    host.querySelector('[data-v76-back]').onclick=renderHome;
    host.querySelector('[data-v76-save-criteria]').onclick=()=>{
      host.querySelectorAll('[data-v76-criterion]').forEach(x=>e.criteria[Number(x.dataset.v76Criterion)]=x.value.trim());
      saveAll();renderPlan();toast(criteriaReady(e)?'Criterios guardados. Ya podés calificar.':'Guardado. Todavía faltan criterios.',!criteriaReady(e));
    };
    host.querySelector('[data-v76-download]').onclick=()=>downloadExcel(ctx,e,students);
    host.querySelector('[data-v76-import]').onchange=ev=>{const f=ev.target.files?.[0];if(f)importExcel(ctx,e,students,f);ev.target.value=''};
    bindSheet(e,students);
  }

  function sheetHtml(e,students){
    return `<div class="v76-sheet-wrap"><table class="v76-sheet"><thead><tr>
      <th>DNI</th><th>Estudiante</th><th>Estado del plan</th><th>Etapa alcanzada</th>
      ${e.criteria.map((c,i)=>c?`<th title="${esc(c)}">${esc(c)}${i===4?' (opcional)':''}</th>`:'').join('')}
      <th>Calificación final</th><th>Fecha de finalización</th>
    </tr></thead><tbody>${students.map(s=>{const r=rowFor(e,s);return`<tr data-dni="${esc(s.dni)}">
      <td>${esc(s.dni)}</td><td><strong>${esc(s.lastName||'')} ${esc(s.firstName||'')}</strong></td>
      <td><select data-v76-field="status">${PLAN_STATUS.map(([k,l])=>`<option value="${k}" ${r.status===k?'selected':''}>${l}</option>`).join('')}</select></td>
      <td><select data-v76-field="stage" ${r.status==='no_iniciado'?'disabled':''}><option value="">—</option>${STAGES.map(([k,l])=>`<option value="${k}" ${r.stage===k?'selected':''}>${l}</option>`).join('')}</select></td>
      ${r.criteria.map((v,i)=>e.criteria[i]?`<td><input data-v76-score="${i}" value="${esc(v)}"></td>`:'').join('')}
      <td><input type="number" min="6" max="10" step="1" data-v76-field="final" value="${esc(r.final)}" ${r.status==='finalizado'?'':'disabled'}></td>
      <td><input type="date" data-v76-field="completedAt" value="${esc(r.completedAt)}" ${r.status==='finalizado'?'':'disabled'}></td>
    </tr>`}).join('')}</tbody></table></div>`;
  }

  function bindSheet(e,students){
    const table=$('v76GradingRoot')?.querySelector('.v76-sheet');if(!table)return;
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const dni=tr.dataset.dni,s=students.find(x=>x.dni===dni),r=rowFor(e,s);
      tr.querySelectorAll('[data-v76-score]').forEach(x=>x.onchange=()=>{r.criteria[Number(x.dataset.v76Score)]=x.value;saveAll()});
      tr.querySelectorAll('[data-v76-field]').forEach(x=>x.onchange=()=>{
        const field=x.dataset.v76Field;
        if(field==='status'){
          r.status=x.value;
          if(r.status==='no_iniciado'){r.stage='';r.final='';r.completedAt=''}
          if(r.status!=='finalizado'){r.final='';r.completedAt=''}
          if(r.status==='finalizado'&&!r.completedAt)r.completedAt=localDate(new Date());
        }else if(field==='final'){
          const n=Number(x.value);
          r.final=(r.status==='finalizado'&&Number.isFinite(n)&&n>=6&&n<=10)?String(n):'';
          x.value=r.final;
          if(r.final&&!r.completedAt)r.completedAt=localDate(new Date());
          if(r.status==='finalizado'&&!r.final)toast('Un plan Finalizado se califica de 6 a 10.',true);
        }else if(field==='completedAt'){
          r.completedAt=r.status==='finalizado'?String(x.value||''):'';
          x.value=r.completedAt;
        }else r[field]=x.value;
        saveAll();
        if(field==='stage'||field==='status'||field==='final')renderPlan();
      });
    });
  }

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-pci-xlsx]');
      if(old){old.addEventListener('load',()=>resolve(window.XLSX),{once:true});if(window.XLSX)resolve(window.XLSX);return}
      const s=document.createElement('script');s.dataset.pciXlsx='1';s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar Excel.'));document.head.appendChild(s);
    });
  }

  async function downloadExcel(ctx,e,students){
    if(!criteriaReady(e))return toast('Primero completá los cuatro criterios obligatorios.',true);
    try{
      const XLSX=await loadXLSX();
      const rows=students.map(s=>{const r=rowFor(e,s);const o={DNI:s.dni,Apellido:s.lastName||'',Nombre:s.firstName||'','Estado del plan':PLAN_STATUS.find(x=>x[0]===r.status)?.[1]||'No iniciado','Etapa alcanzada':STAGES.find(x=>x[0]===r.stage)?.[1]||''};
        e.criteria.forEach((c,i)=>{if(c)o[c]=r.criteria[i]||''});
        o['Calificación final']=r.final||'';o['Fecha de finalización']=r.completedAt||'';return o;
      });
      const ws=XLSX.utils.json_to_sheet(rows);
      const meta=XLSX.utils.aoa_to_sheet([
        ['__PLAN_KEY',ctx.key],['Orientación',ctx.orientation],['Agrupamiento',e.groupName],['Plan',ctx.planNumber],['Comisión',ctx.commission.course],
        ['IMPORTANTE','No modificar DNI ni encabezados. Solo un Plan Finalizado admite calificación numérica de 6 a 10.']
      ]);
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'CALIFICACIONES');XLSX.utils.book_append_sheet(wb,meta,'PLAN');
      XLSX.writeFile(wb,`calificaciones-${slug(e.groupName)}-plan-${ctx.planNumber}-${slug(ctx.commission.course)}.xlsx`);
    }catch(err){toast(err.message||String(err),true)}
  }

  async function importExcel(ctx,e,students,file){
    try{
      const XLSX=await loadXLSX(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'});
      const meta=wb.Sheets.PLAN?XLSX.utils.sheet_to_json(wb.Sheets.PLAN,{header:1,defval:''}):[];
      const fileKey=String(meta.find(r=>r[0]==='__PLAN_KEY')?.[1]||'');
      if(fileKey&&fileKey!==ctx.key)throw new Error('El Excel pertenece a otro plan o comisión.');
      const sheet=wb.Sheets.CALIFICACIONES||wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(sheet,{defval:''}),studentMap=new Map(students.map(s=>[String(s.dni),s]));
      let updated=0,unknown=0;
      for(const raw of data){
        const dni=String(raw.DNI||'').replace(/\D/g,'');const s=studentMap.get(dni);if(!s){if(dni)unknown++;continue}
        const r=rowFor(e,s);
        const statusLabel=String(raw['Estado del plan']||'').trim();
        r.status=PLAN_STATUS.find(x=>x[1].toLowerCase()===statusLabel.toLowerCase())?.[0]||r.status||'no_iniciado';
        const stageLabel=String(raw['Etapa alcanzada']||'').trim();
        r.stage=STAGES.find(x=>x[1].toLowerCase()===stageLabel.toLowerCase())?.[0]||r.stage||'';
        e.criteria.forEach((c,i)=>{if(c&&Object.prototype.hasOwnProperty.call(raw,c))r.criteria[i]=String(raw[c]??'')});
        const importedFinal=Number(String(raw['Calificación final']??'').replace(',','.'));
        r.final=(r.status==='finalizado'&&Number.isFinite(importedFinal)&&importedFinal>=6&&importedFinal<=10)?String(importedFinal):'';
        r.completedAt=r.status==='finalizado'?String(raw['Fecha de finalización']||r.completedAt||'').slice(0,10):'';
        if(r.final&&!r.completedAt)r.completedAt=localDate(new Date());
        updated++;
      }
      saveAll();renderPlan();toast(`${updated} estudiantes actualizados${unknown?` · ${unknown} DNI no encontrados`:''}.`,unknown>0);
    }catch(err){toast(err.message||String(err),true)}
  }

  const prevScreen=window.screen;
  if(typeof prevScreen==='function'&&!prevScreen.__v76){
    const wrapped=function(id){const out=prevScreen(id);if(id==='grading')setTimeout(renderHome,0);return out};Object.assign(wrapped,prevScreen);wrapped.__v76=true;window.screen=wrapped;
  }

  function start(){ensureScreen();patchHomeEntry()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,900));
  setTimeout(start,1600);

  const style=document.createElement('style');style.textContent=`
    .v76-topbar{display:flex;justify-content:flex-start;margin:0 0 12px}.v76-empty-state{display:grid;gap:5px;margin-top:14px;padding:22px;border:1px dashed var(--line);border-radius:16px;background:#fff;color:var(--muted)}.v76-empty-state strong{color:var(--ink)}
    #grading .v76-hero{margin:-22px -24px 16px;padding:28px 24px;border-radius:0 0 28px 28px;background:linear-gradient(135deg,#edf3f8,#f7fbfa)}#grading .v76-hero h1{margin:4px 0 6px;font-size:clamp(1.8rem,3vw,3rem)}#grading .v76-hero p{margin:0;color:var(--muted)}
    .v76-browser{margin:12px 0 18px;padding:16px;border:1px solid var(--line);border-radius:18px;background:#fff}.v76-browser-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.v76-browser-head h2{margin:4px 0 0}.v76-filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:12px}.v76-filters label{display:grid;gap:5px}.v76-filters span{font-size:.56rem;font-weight:900;color:var(--muted)}.v76-filters select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}.v76-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}.v76-summary span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--band);font-size:.6rem}.v76-course-stack{display:grid;gap:18px}.v76-course-block{padding:16px;border:1px solid var(--line);border-radius:20px;background:#f9fbfc}.v76-course-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:12px}.v76-course-head small{display:block;color:var(--muted);font-size:.55rem}.v76-course-head h2{margin:3px 0 0}.v76-course-head>span{padding:6px 9px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:.54rem;font-weight:900}.v76-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.v76-card{padding:18px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:var(--shadow);min-width:0}.v76-card-head{display:flex;justify-content:space-between;gap:8px;font-size:.56rem;color:var(--muted)}.v76-card h3{margin:8px 0 4px}.v76-card p,.v76-card>small{color:var(--muted);font-size:.62rem;line-height:1.4}.v76-teachers{display:block;min-height:2.5em;margin-top:5px}.v76-plan-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.v76-plan-buttons button{min-height:88px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--band);text-align:left;color:var(--ink);overflow:hidden}.v76-plan-buttons span{display:block;font-weight:900;font-size:.72rem}.v76-plan-buttons strong{display:-webkit-box;margin:5px 0 6px;font-size:.62rem;line-height:1.25;font-weight:700;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical}.v76-plan-buttons small{display:block;font-size:.52rem;color:var(--muted)}.v76-ready{margin-top:9px;font-size:.55rem;color:var(--muted)}
    .v76-plan-top{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}.v76-plan-top h1{margin:4px 0}.v76-plan-name{margin:2px 0 5px;font-size:1rem;color:var(--mint-dark)}.v76-plan-top p{margin:0;color:var(--muted);font-size:.68rem}.v76-criteria,.v76-sheet-section{padding:18px;margin-top:14px}.v76-criteria h2,.v76-sheet-section h2{margin:4px 0}.v76-criteria>p,.v76-sheet-section p{margin:0;color:var(--muted);font-size:.68rem}.v76-criteria-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.v76-criteria-grid label{display:grid;gap:4px}.v76-criteria-grid span{font-size:.6rem;font-weight:900}.v76-criteria-grid textarea{min-height:82px;padding:9px;border:1px solid var(--line);border-radius:10px}.v76-criteria-actions{display:flex;align-items:center;gap:8px;margin-top:10px}.v76-criteria-actions .ok{color:var(--ok);font-size:.58rem;font-weight:900}.v76-criteria-actions .pending{color:#8a6414;font-size:.58rem;font-weight:900}
    .v76-dashboard{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.v76-dashboard button{padding:13px;border:1px solid var(--line);border-radius:16px;background:#fff;text-align:left;color:var(--ink)}.v76-dashboard strong{display:block;font-size:1.35rem}.v76-dashboard span{display:block;font-weight:900;font-size:.62rem}.v76-dashboard small{display:block;margin-top:3px;color:var(--muted);font-size:.48rem}
    .v76-sheet-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v76-excel-actions{display:flex;gap:7px;flex-wrap:wrap}.v76-excel-actions label{cursor:pointer}.v76-lock{margin-top:12px;padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);text-align:center}.v76-sheet-wrap{overflow:auto;margin-top:12px;border:1px solid var(--line);border-radius:14px}.v76-sheet{width:100%;min-width:1400px;border-collapse:collapse;font-size:.6rem}.v76-sheet th{position:sticky;top:0;background:var(--band);z-index:2;text-align:left;max-width:220px}.v76-sheet th,.v76-sheet td{padding:7px;border-bottom:1px solid var(--line);vertical-align:middle}.v76-sheet input,.v76-sheet select{width:100%;min-width:88px;padding:7px;border:1px solid var(--line);border-radius:8px;background:#fff}.v76-sheet td:nth-child(2){min-width:190px}
    @media(max-width:980px){.v76-grid{grid-template-columns:1fr}.v76-filters{grid-template-columns:1fr 1fr}}@media(max-width:760px){.v76-browser-head,.v76-course-head{align-items:flex-start;flex-direction:column}.v76-filters{grid-template-columns:1fr}.v76-course-block{padding:12px}#grading .v76-hero{margin:-18px -12px 14px;padding:20px 14px}.v76-plan-top{flex-direction:column}.v76-criteria-grid{grid-template-columns:1fr}.v76-dashboard{grid-template-columns:1fr 1fr}.v76-sheet-head{flex-direction:column}.v76-excel-actions{width:100%}.v76-excel-actions .btn{flex:1;text-align:center}}
  `;document.head.appendChild(style);

  function setAccessScope(scope={}){
    const role=['admin','teacher','student','family'].includes(scope.role)?scope.role:'admin';
    accessScope={role,teacherId:String(scope.teacherId||'')};
    homeFilters={orientation:'',year:'',course:''};
    patchHomeEntry();
    if($('grading')?.classList.contains('active')){
      if(!['admin','teacher'].includes(accessScope.role))goHome();else renderHome();
    }
  }

  function contextsForTeacher(teacherId){
    const prev=accessScope;
    accessScope={role:'teacher',teacherId:String(teacherId||'')};
    try{return scopedContexts()}finally{accessScope=prev}
  }

  window.PCIGradingV76={
    openGrading,renderHome,openPlan,allContexts,scopedContexts,setAccessScope,contextsForTeacher,
    getAccessScope:()=>({...accessScope})
  };
})();