(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  let filterOrientation='all',filterYear='all',filterStatus='all',filterText='';
  let rendering=false,homeObserver=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function root(){
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.assignments=state.institutional.assignments||{};
    return state.institutional;
  }
  const teacherList=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const selectedOrientations=()=>[...(state.selected||[])];
  const allRows=()=>api()?.allImplementationRows?.()||[];
  const originLabel=o=>o==='FO'?'Formación Orientada':o==='CUSTOM'?'Institucional':'Formación General';

  function loads(){
    return window.PCIDerivedTeacherLoadV52?.teacherLoads?.()||{};
  }
  function annualFront(id){
    const l=loads()[id]||{};
    return Math.max(Number(l.S1||0),Number(l.S2||0));
  }
  function teacherCards(){
    const list=teacherList();
    if(!list.length)return '<div class="v48-empty">Todavía no hay docentes cargados. Podés agregarlos manualmente o importar la asignación desde Excel.</div>';
    return `<div class="v48-teacher-list">${list.map(t=>`<article class="v48-teacher-card"><div class="v48-teacher-head"><div><h3>${esc(t.name)}</h3><small>Frente a curso anual: ${annualFront(t.id)} HC</small>${t.email?`<small>${esc(t.email)}</small>`:''}</div><button type="button" data-v48-edit-teacher="${esc(t.id)}">Editar</button></div><small><strong>Carga institucional única</strong> · integra todas sus asignaciones, aunque correspondan a distintas orientaciones.</small></article>`).join('')}</div>`;
  }

  function visibleRows(rows){
    return rows.filter(r=>{
      if(filterOrientation!=='all'&&r.orientation!==filterOrientation)return false;
      if(filterYear!=='all'&&Number(r.year)!==Number(filterYear))return false;
      const assigned=!!root().assignments[r.instanceId];
      if(filterStatus==='assigned'&&!assigned)return false;
      if(filterStatus==='pending'&&assigned)return false;
      if(filterText){
        const hay=norm([r.orientation,r.course,r.name,r.origin,r.locations?.join(' ')].join(' '));
        if(!hay.includes(norm(filterText)))return false;
      }
      return true;
    });
  }

  function assignmentTable(rows){
    const list=teacherList(),assignments=root().assignments,filtered=visibleRows(rows);
    if(!rows.length)return '<div class="v48-empty">Los PCI seleccionados todavía no tienen instancias curriculares para implementar.</div>';
    return `<div class="v66-filters"><label>Orientación<select id="v66FilterOrientation"><option value="all">Todas</option>${selectedOrientations().map(o=>`<option value="${esc(o)}" ${filterOrientation===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label><label>Año<select id="v66FilterYear"><option value="all">Todos</option>${[1,2,3,4,5].map(y=>`<option value="${y}" ${String(filterYear)===String(y)?'selected':''}>${y}.º</option>`).join('')}</select></label><label>Asignación<select id="v66FilterStatus"><option value="all" ${filterStatus==='all'?'selected':''}>Todas</option><option value="pending" ${filterStatus==='pending'?'selected':''}>Sin docente</option><option value="assigned" ${filterStatus==='assigned'?'selected':''}>Asignadas</option></select></label><label class="v66-search">Buscar<input id="v66FilterText" value="${esc(filterText)}" placeholder="materia, curso u orientación"></label></div><div class="v66-filter-count">Mostrando <strong>${filtered.length}</strong> de ${rows.length} instancias curriculares institucionales.</div><div class="v48-table-wrap"><table class="v48-table v66-table"><thead><tr><th>Orientación</th><th>Curso</th><th>Materia / espacio</th><th>Origen</th><th>Ubicación Fase 1</th><th>HC</th><th>Docente</th></tr></thead><tbody>${filtered.map(r=>`<tr><td><strong>${esc(r.orientation)}</strong></td><td>${esc(r.course)}</td><td><strong>${esc(r.name)}</strong></td><td><span class="v48-origin ${r.origin==='FO'?'fo':r.origin==='CUSTOM'?'custom':''}">${esc(originLabel(r.origin))}</span></td><td>${esc(r.locations?.join(' · ')||'—')}</td><td class="${r.hours==null?'v48-pending':'v48-known'}">${r.hours==null?'Pendiente':`${esc(r.hours)} HC`}</td><td><select data-v48-assignment="${esc(r.instanceId)}"><option value="">Sin asignar</option>${list.map(t=>`<option value="${esc(t.id)}" ${assignments[r.instanceId]===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  }

  function pciStatusHtml(){
    const list=selectedOrientations();
    if(!list.length)return '<div class="v48-empty">Seleccioná al menos una orientación para que la capa institucional tenga PCI de origen.</div>';
    return `<div class="v66-pci-sources">${list.map(o=>{const m=ensure(o),count=api()?.implementationRows?.(o)?.length||0;return`<article><div><strong>${esc(o)}</strong><small>${m.valid?'Mapa de la Oferta validado':'PCI en construcción'}</small></div><span class="status ${m.valid?'v66-ok':'v66-building'}">${count} instancias</span></article>`}).join('')}</div>`;
  }

  function bindFilters(){
    const rerender=()=>renderGeneral();
    const o=$id('v66FilterOrientation');if(o)o.onchange=()=>{filterOrientation=o.value;rerender()};
    const y=$id('v66FilterYear');if(y)y.onchange=()=>{filterYear=y.value;rerender()};
    const s=$id('v66FilterStatus');if(s)s.onchange=()=>{filterStatus=s.value;rerender()};
    const q=$id('v66FilterText');if(q)q.oninput=()=>{filterText=q.value;clearTimeout(q.__v66Timer);q.__v66Timer=setTimeout(rerender,180)};
  }

  async function renderGeneral(){
    if(rendering)return;
    const screen=$id('institutional'),host=$id('v48InstitutionalContent');
    if(!screen||!host||!screen.classList.contains('active'))return;
    rendering=true;
    try{
      const back=screen.querySelector('[data-v48-panel]');
      if(back){back.textContent='← Volver a la escuela';back.onclick=()=>window.screen?.('home')}
      const title=$id('v48InstitutionalTitle');if(title)title.textContent=`${state.school} · Implementación institucional general`;
      const hero=screen.querySelector('.hero p');if(hero)hero.textContent='Esta capa institucional levanta en conjunto los Mapas de la Oferta de todos los PCI de la escuela. Los docentes, la carga, la disponibilidad y el horario pertenecen a la escuela, no a una orientación.';
      const homeButton=screen.querySelector('[data-v48-home]');if(homeButton)homeButton.textContent='Volver a los PCI';
      host.innerHTML='<div class="v48-empty">Consolidando los PCI de la escuela…</div>';
      try{await api()?.loadHours?.()}catch(e){host.innerHTML=`<div class="notice"><strong>No se pudo leer la carga horaria.</strong> ${esc(e.message||e)}</div>`;return}
      const rows=allRows(),orientations=selectedOrientations(),assigned=rows.filter(r=>root().assignments[r.instanceId]).length,pendingHours=rows.filter(r=>r.hours==null).length,knownHours=rows.filter(r=>r.hours!=null).reduce((a,r)=>a+Number(r.hours||0),0),courses=new Set(rows.map(r=>`${r.orientation}|${r.course}`)).size;
      host.innerHTML=`<div class="notice"><strong>Implementación institucional general:</strong> se construye automáticamente a partir de todos los PCI seleccionados. Podés trabajar aunque alguno siga en construcción. Ninguna asignación docente modifica Fase 1 ni Fase 2.</div><div class="v48-summary"><article><strong>${orientations.length}</strong><span>PCI de orientación tomados como fuente</span></article><article><strong>${courses}</strong><span>cursos/divisiones detectados entre todos los PCI</span></article><article><strong>${rows.length}</strong><span>instancias curriculares institucionales</span></article><article><strong>${assigned}</strong><span>instancias con docente asignado</span></article><article><strong>${teacherList().length}</strong><span>docentes únicos de la escuela</span></article><article><strong>${pendingHours}</strong><span>instancias con HC pendientes</span></article></div><section class="card v48-section v66-source-section"><div class="eyebrow">Fuentes curriculares</div><h2>PCI que alimentan la implementación institucional</h2><p>Cada orientación conserva su propio Mapa de la Oferta y su Desarrollo Curricular. Esta pantalla solamente los consolida para implementar la escuela real.</p>${pciStatusHtml()}</section><section class="card v48-section"><div class="eyebrow">Plantel institucional</div><h2>Docentes de toda la escuela</h2><p>Un docente existe una sola vez, aunque trabaje en varias orientaciones, cursos o espacios. Su carga, disponibilidad y horario personal son institucionales y únicos.</p><div class="v48-teacher-form"><label>Nombre y apellido<input id="v48TeacherName" autocomplete="off"></label><button id="v48AddTeacher" class="btn primary">Agregar docente</button></div>${teacherCards()}</section><section class="card v48-section v66-assignment-section"><div class="eyebrow">Asignación global</div><h2>Asignación docente de todos los PCI</h2><p>La orientación funciona como dato de origen y como filtro. El plantel es único: el mismo docente puede aparecer en varias orientaciones sin duplicarse.</p>${assignmentTable(rows)}</section>`;
      bindFilters();
      setTimeout(()=>window.PCIAutoAreaCoincidenceV54?.deriveTeams?.(),20);
    }finally{rendering=false}
  }

  function homeCard(){
    const home=$id('home'),list=$id('pciList');if(!home||!list)return;
    let card=$id('v66InstitutionalHome');
    if(!card){card=document.createElement('section');card.id='v66InstitutionalHome';card.className='card v66-home-card';list.after(card)}
    const rows=allRows(),assigned=rows.filter(r=>root().assignments[r.instanceId]).length,pending=Math.max(0,rows.length-assigned);
    card.innerHTML=`<div><div class="eyebrow">Nivel escuela</div><h2>Implementación institucional general</h2><p>Consolida todos los PCI de orientación para asignar docentes, calcular cargas, organizar equipos, disponibilidad y generar un único horario institucional.</p><div class="v66-home-metrics"><span><strong>${selectedOrientations().length}</strong> PCI</span><span><strong>${teacherList().length}</strong> docentes</span><span><strong>${rows.length}</strong> asignaciones posibles</span><span><strong>${pending}</strong> pendientes</span></div></div><button id="openInstitutionalGeneral" class="btn primary">Abrir gestión institucional</button>`;
    $id('openInstitutionalGeneral').onclick=()=>{window.screen?.('institutional');setTimeout(renderGeneral,30)};
  }

  function install(){
    const a=api();if(!a)return;
    if(!a.__v66OriginalRender)a.__v66OriginalRender=a.renderInstitutional;
    a.renderInstitutional=renderGeneral;
    const card=$id('institutionalCard');if(card)card.style.display='none';
    homeCard();
    const pci=$id('pciList');if(pci&&!homeObserver){homeObserver=new MutationObserver(()=>setTimeout(homeCard,0));homeObserver.observe(pci,{childList:true})}
  }

  const style=document.createElement('style');
  style.textContent=`#panel #institutionalCard{display:none!important}.v66-home-card{margin-top:16px;padding:19px;display:flex;justify-content:space-between;gap:18px;align-items:center;border-color:#9edfd7;background:linear-gradient(135deg,#f7fffd,#edf8f7)}.v66-home-card h2{margin:5px 0 6px;font-size:1.2rem}.v66-home-card p{margin:0;max-width:850px;color:var(--muted);font-size:.76rem;line-height:1.45}.v66-home-card>.btn{flex:0 0 auto}.v66-home-metrics{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.v66-home-metrics span{padding:6px 8px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:.59rem;color:var(--muted)}.v66-home-metrics strong{color:var(--ink)}.v66-pci-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-top:12px}.v66-pci-sources article{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--band)}.v66-pci-sources strong{font-size:.68rem}.v66-pci-sources small{display:block;margin-top:2px;font-size:.55rem;color:var(--muted)}.v66-pci-sources .status{white-space:nowrap}.v66-ok{background:var(--ok-soft)!important;color:var(--ok)!important}.v66-building{background:#fff7df!important;color:#7a5c13!important}.v66-filters{display:grid;grid-template-columns:repeat(3,minmax(130px,180px)) minmax(220px,1fr);gap:8px;margin-top:12px}.v66-filters label{display:grid;gap:4px;font-size:.58rem;font-weight:850;color:var(--muted)}.v66-filters select,.v66-filters input{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}.v66-filter-count{margin-top:8px;font-size:.59rem;color:var(--muted)}.v66-table{min-width:1120px!important}@media(max-width:820px){.v66-home-card{align-items:flex-start;flex-direction:column}.v66-filters{grid-template-columns:1fr 1fr}.v66-search{grid-column:1/-1}}`;
  document.head.appendChild(style);

  const previousScreen=window.screen;
  if(typeof previousScreen==='function'){
    const wrapped=function(id){const result=previousScreen(id);if(id==='home')setTimeout(homeCard,0);if(id==='panel')setTimeout(()=>{$id('institutionalCard')?.style.setProperty('display','none','important')},0);if(id==='institutional')setTimeout(renderGeneral,25);return result};
    Object.assign(wrapped,previousScreen);window.screen=wrapped;
  }

  window.addEventListener('pci-app-ready',()=>setTimeout(install,850));
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="home"],[data-v48-home]'))setTimeout(homeCard,60)},true);
  window.PCIInstitutionalGeneralV66={render:renderGeneral,homeCard,visibleRows};
})();
