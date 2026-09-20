(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);
  let HOURS=null;

  const style=document.createElement('style');
  style.textContent=`
    .phase2-quick{margin-left:6px}
    .teacher-hours-btn{white-space:nowrap}
    #teacherHoursModal,#mapPrintModal{position:fixed;inset:0;z-index:180;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(18,57,92,.48)}
    #teacherHoursModal.open,#mapPrintModal.open{display:flex}
    .teacher-hours-box,.map-print-box{width:min(1120px,96vw);max-height:92vh;overflow:auto;border-radius:18px;background:#fff;padding:20px;box-shadow:0 22px 70px rgba(18,57,92,.24)}
    .teacher-hours-head,.map-print-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
    .teacher-hours-head h2,.map-print-head h2{margin:2px 0 5px}
    .teacher-hours-meta{color:var(--muted);font-size:.72rem;line-height:1.4}
    .teacher-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0 16px}
    .teacher-summary-card{padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--band)}
    .teacher-summary-card strong{display:block;font-size:.9rem;margin-bottom:4px}.teacher-summary-card span{font-size:.68rem;color:var(--muted);line-height:1.35}
    .teacher-hours-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:13px}
    .teacher-hours-table{width:100%;min-width:760px;border-collapse:collapse;font-size:.7rem}.teacher-hours-table th{background:var(--band);font-size:.6rem;text-transform:uppercase;letter-spacing:.04em;text-align:left}.teacher-hours-table th,.teacher-hours-table td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}.teacher-hours-table tr:last-child td{border-bottom:0}.teacher-hours-table .pending{color:#8a6414;font-weight:900}.teacher-hours-table .known{color:var(--mint-dark);font-weight:900}.teacher-total-row td{background:#fafcfd;font-weight:900}
    .teacher-hours-empty{padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);text-align:center}
    .map-print-preview{overflow:auto;border:1px solid var(--line);border-radius:13px;padding:12px;background:#f7fafc}.map-print-sheet{min-width:1280px;background:#fff;padding:18px}.map-print-title{margin-bottom:12px}.map-print-title h1{font-size:1.25rem;margin:2px 0 4px}.map-print-title p{margin:0;color:var(--muted);font-size:.72rem}.map-print-sheet .matrix{min-width:1240px}.map-print-sheet .teacher-control{display:block}.map-print-sheet .teacher-label{font-size:.44rem}.map-print-sheet .teacher-print-name{display:block;margin-top:2px;color:var(--mint-dark);font-size:.46rem;font-weight:800}.map-print-sheet .fo-format-badge{cursor:default!important}.map-print-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
    @media print{
      @page{size:A3 landscape;margin:7mm}
      body.print-map-mode *{visibility:hidden!important}
      body.print-map-mode #mapPrintModal,body.print-map-mode #mapPrintModal *{visibility:visible!important}
      body.print-map-mode #mapPrintModal{display:block!important;position:absolute!important;inset:0!important;background:#fff!important;padding:0!important;overflow:visible!important}
      body.print-map-mode #mapPrintModal .map-print-box{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;box-shadow:none!important;border-radius:0!important;padding:0!important}
      body.print-map-mode #mapPrintModal .map-print-head,body.print-map-mode #mapPrintModal .map-print-actions{display:none!important}
      body.print-map-mode #mapPrintModal .map-print-preview{border:0!important;padding:0!important;overflow:visible!important}
      body.print-map-mode #mapPrintModal .map-print-sheet{width:1500px!important;min-width:1500px!important;padding:0!important;zoom:.68}
      body.print-map-mode #printModal,body.print-map-mode #printModal *{visibility:hidden!important}
    }
  `;
  document.head.appendChild(style);

  function norm(value){
    return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[“”«»"']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }

  // --- Integración FO -> laboratorios FG ---
  const previousValidTarget=validTarget;
  validTarget=function(slot,s){
    const m=String(slot||'').match(/^(naturales|socialA|socialB)-c(\d+)$/);
    if(m && s?.origin==='FO'){
      const term=Number(m[2]),year=Math.ceil(term/2);
      if(year<3)return[false,'La integración entre Formación General y Formación Orientada se habilita a partir de Nivel 3.'];
      if(Number(s.year)!==year)return[false,`${s.name} corresponde a ${s.year}.º y este laboratorio pertenece a ${year}.º.`];
      if((current().placements?.[slot]||[]).includes(s.id))return[false,`${s.name} ya está en este laboratorio.`];
      if(typeof usedInTerm==='function'){
        const used=usedInTerm(s.id,term);
        if(used && used!==slot)return[false,`${s.name} ya está ubicada en C${term}. Para integrarla acá, movela desde su ubicación actual.`];
      }
      return[true,''];
    }
    return previousValidTarget(slot,s);
  };

  function amendRules(){
    const modal=$id('rulesModal');if(!modal)return;
    const box=modal.querySelector('.modal-box');if(!box)return;
    if(!box.querySelector('[data-v31-integration-rule]')){
      const rule=document.createElement('div');rule.className='rule';rule.dataset.v31IntegrationRule='1';
      rule.innerHTML='<strong>Integración FG + FO:</strong> desde Nivel 3, una materia/materialización de Formación Orientada puede incorporarse directamente a un Laboratorio de Ciencias Sociales o Ciencias Naturales del mismo año. También puede moverse desde un espacio FO ya conformado; en ese caso, el movimiento solo se permite si el espacio FO de origen conserva su composición mínima.';
      box.appendChild(rule);
    }
  }

  // --- Fase 2 siempre encontrable para prueba ---
  function openPhase2(){
    if(typeof window.screen==='function') window.screen('proposal');
    else{
      document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
      $id('proposal')?.classList.add('active');
    }
    setTimeout(()=>{
      const proposal=$id('proposal');
      if(!proposal)return;
      if(!proposal.querySelector('.v28')){
        proposal.innerHTML='<button class="back" data-v31-back>← Volver al panel</button><div class="hero"><div class="eyebrow">2 · Mapa Propuesta Curricular</div><h1>Fase 2</h1><p>La interfaz curricular no terminó de cargar. Recargá esta versión para volver a inicializarla.</p></div><div class="notice">La Fase 2 está habilitada en modo de prueba aun cuando el Mapa de la Oferta todavía no esté validado.</div>';
        proposal.querySelector('[data-v31-back]').onclick=()=>window.screen?.('panel');
      }
    },80);
  }

  function ensurePhase2Access(){
    const card=$id('proposalCard'),button=$id('openProposal');
    if(card)card.classList.remove('locked');
    if(button){button.disabled=false;button.textContent=current().valid?'Entrar':'Ver Fase 2 · prueba';button.onclick=openPhase2}
    const toolbar=document.querySelector('#offer .matrix-toolbar .row');
    if(toolbar&&!toolbar.querySelector('[data-phase2-quick]')){
      const b=document.createElement('button');b.type='button';b.className='btn small soft phase2-quick';b.dataset.phase2Quick='1';b.textContent='Ir a Fase 2';b.onclick=openPhase2;toolbar.prepend(b);
    }
  }

  const previousRenderPanel=renderPanel;
  renderPanel=function(){previousRenderPanel();ensurePhase2Access();ensureHeaderButtons();removeAutoReorderButtons()};
  const previousRenderOffer=renderOffer;
  renderOffer=function(){previousRenderOffer();ensurePhase2Access();ensureMapPrintButton();removeAutoReorderButtons()};

  // --- Cargas horarias / carga docente ---
  async function loadHours(){
    if(HOURS)return HOURS;
    const r=await fetch('data/horas-v2.json?v=20260911-31',{cache:'no-store'});
    if(!r.ok)throw new Error('No se pudo cargar la base de horas.');
    HOURS=await r.json();return HOURS;
  }

  function findHours(dict,name){
    if(!dict)return null;
    const key=norm(name),entries=Object.entries(dict);
    for(const [n,h] of entries)if(norm(n)===key)return Number(h);
    const candidates=entries.filter(([n])=>{const k=norm(n);return key.length>8&&k.length>8&&(k.startsWith(key)||key.startsWith(k))});
    if(candidates.length===1)return Number(candidates[0][1]);
    return null;
  }

  function canonicalFgName(s){
    if(/^fg-\d+-espacios-de-definicion-institucional$/.test(String(s.id||'')))return'Espacios de definición institucional';
    return s.name;
  }

  function hoursForSubject(s){
    if(!HOURS||!s||s.origin==='CUSTOM')return null;
    if(s.origin==='FG')return findHours(HOURS.formacion_general?.[String(s.year)],canonicalFgName(s));
    if(s.origin==='FO'){
      const o=HOURS.formacion_orientada?.[state.active];if(!o)return null;
      const dict=Number(s.year)===3?o['3']:o[current().alt||'A']?.[String(s.year)];
      return findHours(dict,s.name);
    }
    return null;
  }

  function locationsForSubject(id){
    const out=[];
    for(const [slot,ids] of Object.entries(current().placements||{})){
      if(!(ids||[]).includes(id))continue;
      const t=String(slot).match(/-c(\d+)$/),y=String(slot).match(/-n(\d+)$/);
      if(t)out.push('C'+t[1]);else if(y)out.push('Nivel '+y[1]+' · anual');
    }
    return [...new Set(out)];
  }

  function teacherRows(){
    const assignments=current().teachers||{},map=new Map();
    for(const [id,teacherRaw] of Object.entries(assignments)){
      const teacher=String(teacherRaw||'').trim(),s=byId(id);if(!teacher||!s)continue;
      const k=norm(teacher);if(!map.has(k))map.set(k,{name:teacher,subjects:[]});
      if(!map.get(k).subjects.some(x=>x.id===id))map.get(k).subjects.push({id,subject:s,hours:hoursForSubject(s),locations:locationsForSubject(id)});
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }

  function ensureTeacherHoursModal(){
    let modal=$id('teacherHoursModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='teacherHoursModal';
    modal.innerHTML='<div class="teacher-hours-box"><div class="teacher-hours-head"><div><div class="eyebrow">Carga docente</div><h2>Horas por docente</h2><div id="teacherHoursSubtitle" class="teacher-hours-meta"></div></div><button type="button" class="btn" data-close-teacher-hours>Cerrar</button></div><div id="teacherHoursContent"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close-teacher-hours]').onclick=()=>modal.classList.remove('open');
    modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};
    return modal;
  }

  async function openTeacherHours(){
    const modal=ensureTeacherHoursModal(),content=$id('teacherHoursContent');
    modal.classList.add('open');content.innerHTML='<div class="teacher-hours-empty">Cargando horas oficiales…</div>';
    try{await loadHours()}catch(e){content.innerHTML=`<div class="teacher-hours-empty">${esc(e.message||e)}</div>`;return}
    $id('teacherHoursSubtitle').textContent=`${state.school} · PCI ${state.active} · Las horas de cada materia anual se computan una sola vez, aunque aparezca en ambos cuatrimestres.`;
    const teachers=teacherRows();
    if(!teachers.length){content.innerHTML='<div class="teacher-hours-empty">Todavía no hay docentes asignados a materias en este PCI.</div>';return}
    const known=teachers.reduce((a,t)=>a+t.subjects.filter(s=>s.hours!=null).reduce((x,s)=>x+s.hours,0),0);
    const pending=teachers.reduce((a,t)=>a+t.subjects.filter(s=>s.hours==null).length,0);
    content.innerHTML=`<div class="teacher-summary"><div class="teacher-summary-card"><strong>${teachers.length} docente${teachers.length===1?'':'s'}</strong><span>Con asignaciones en este PCI.</span></div><div class="teacher-summary-card"><strong>${known} h conocidas</strong><span>Sumadas una sola vez por materia anual.</span></div><div class="teacher-summary-card"><strong>${pending} carga${pending===1?'':'s'} pendiente${pending===1?'':'s'}</strong><span>Materias agregadas o casos donde la fuente no explicita horas.</span></div></div>${teachers.map(t=>{const kh=t.subjects.filter(s=>s.hours!=null).reduce((a,s)=>a+s.hours,0),pp=t.subjects.filter(s=>s.hours==null).length;return`<section style="margin:16px 0"><div class="row" style="justify-content:space-between;margin-bottom:6px"><strong>${esc(t.name)}</strong><span class="status">${kh} h${pp?` + ${pp} pendiente${pp===1?'':'s'}`:''}</span></div><div class="teacher-hours-table-wrap"><table class="teacher-hours-table"><thead><tr><th>Materia</th><th>Nivel</th><th>Componente</th><th>Ubicación</th><th>Carga</th></tr></thead><tbody>${t.subjects.map(x=>`<tr><td><strong>${esc(x.subject.name)}</strong></td><td>${x.subject.year}.º</td><td>${x.subject.origin==='FO'?'Formación Orientada':x.subject.origin==='CUSTOM'?'Institucional':'Formación General'}</td><td>${x.locations.length?esc(x.locations.join(' · ')):'Sin ubicación'}</td><td class="${x.hours==null?'pending':'known'}">${x.hours==null?'Carga horaria pendiente':esc(x.hours)+' h'}</td></tr>`).join('')}<tr class="teacher-total-row"><td colspan="4">Total conocido de ${esc(t.name)}</td><td>${kh} h${pp?` + ${pp} pendiente${pp===1?'':'s'}`:''}</td></tr></tbody></table></div></section>`}).join('')}<p class="teacher-hours-meta">Fuente de cargas horarias: Cajas Horarias - NES - JS(1).xlsx. Las materias sin dato explícito no se estiman: figuran como “Carga horaria pendiente”.</p>`;
  }

  function ensureHeaderButtons(){
    const row=document.querySelector('header.top .row');if(!row)return;
    if(!row.querySelector('[data-teacher-hours]')){
      const b=document.createElement('button');b.type='button';b.className='btn soft teacher-hours-btn';b.dataset.teacherHours='1';b.textContent='Carga docente';b.onclick=openTeacherHours;
      const print=$id('printBtn');row.insertBefore(b,print||null);
    }
  }

  // --- Impresión separada del mapa visual ---
  function ensureMapPrintModal(){
    let modal=$id('mapPrintModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='mapPrintModal';
    modal.innerHTML='<div class="map-print-box"><div class="map-print-head"><div><div class="eyebrow">Mapa de la Oferta</div><h2>Vista conceptual para impresión</h2><div class="teacher-hours-meta">Se imprime la matriz visual C1–C10 tal como está construida.</div></div><button type="button" class="btn" data-close-map-print>Cerrar</button></div><div id="mapPrintPreview" class="map-print-preview"></div><div class="map-print-actions"><button type="button" class="btn primary" data-do-map-print>Imprimir / PDF</button></div></div>';
    document.body.appendChild(modal);
    const close=()=>{modal.classList.remove('open');document.body.classList.remove('print-map-mode')};
    modal.querySelector('[data-close-map-print]').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close()};
    modal.querySelector('[data-do-map-print]').onclick=()=>{document.body.classList.add('print-map-mode');window.print()};
    window.addEventListener('afterprint',()=>document.body.classList.remove('print-map-mode'));
    return modal;
  }

  function openMapPrint(){
    const matrix=$id('matrix');if(!matrix){toast('Abrí primero el Mapa de la Oferta.',true);return}
    const modal=ensureMapPrintModal(),preview=$id('mapPrintPreview'),clone=matrix.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[data-rm]').forEach(x=>x.remove());
    clone.querySelectorAll('.teacher-button').forEach(b=>{const span=document.createElement('span');span.className='teacher-print-name';span.textContent=b.textContent.trim();b.replaceWith(span)});
    clone.querySelectorAll('[draggable]').forEach(x=>x.removeAttribute('draggable'));
    preview.innerHTML=`<div class="map-print-sheet"><div class="map-print-title"><div class="eyebrow">PCI · ${esc(state.active)}</div><h1>${esc(state.school)} · Mapa de la Oferta</h1><p>Nivel 1 a Nivel 5 · C1 a C10</p></div></div>`;
    preview.querySelector('.map-print-sheet').appendChild(clone);
    modal.classList.add('open');
  }

  function ensureMapPrintButton(){
    const row=document.querySelector('#offer .matrix-toolbar .row');if(!row||row.querySelector('[data-map-print]'))return;
    const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.mapPrint='1';b.textContent='Imprimir Mapa de la Oferta';b.onclick=openMapPrint;row.appendChild(b);
  }

  // Eliminar únicamente controles de reordenado automático; el drag & drop curricular se conserva.
  function removeAutoReorderButtons(){
    document.querySelectorAll('button').forEach(b=>{
      const text=norm(`${b.textContent||''} ${b.title||''}`);
      if(/rearreg|reorden|reacomod|orden automatic|auto.*orden/.test(text))b.remove();
    });
  }

  amendRules();
  ensureHeaderButtons();
  ensurePhase2Access();
  ensureMapPrintButton();
  removeAutoReorderButtons();
})();
