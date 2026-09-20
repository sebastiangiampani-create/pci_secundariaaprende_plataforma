(() => {
  const $id=id=>document.getElementById(id);
  const VERSION='20260912-48';
  let HOURS=null;

  const style=document.createElement('style');
  style.textContent=`
    .v48-course-config{margin-top:12px;padding-top:11px;border-top:1px solid var(--line)}
    .v48-course-title{font-size:.62rem;font-weight:900;color:var(--ink);margin-bottom:7px}
    .v48-course-grid{display:grid;grid-template-columns:repeat(5,minmax(54px,1fr));gap:6px}
    .v48-course-grid label{display:grid;gap:3px;font-size:.52rem;font-weight:850;color:var(--muted)}
    .v48-course-grid input{width:100%;padding:6px;border:1px solid var(--line);border-radius:8px;color:var(--ink);background:#fff;text-align:center;font-weight:800}
    .v48-course-help{display:block;margin-top:7px;color:var(--muted);font-size:.55rem;line-height:1.35}
    .v48-hours-row{display:grid;grid-template-columns:1fr 84px;gap:6px;align-items:end;margin-top:5px}
    .v48-hours-row input{margin-top:0!important}.v48-hours-label{font-size:.54rem;font-weight:850;color:var(--muted)}
    .v48-custom-hours-badge{display:inline-flex;margin-top:4px;padding:3px 6px;border-radius:999px;background:#f2ecff;color:#604b8e;font-size:.5rem;font-weight:900;cursor:pointer;border:0}
    #institutional .v48-hero-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .v48-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:14px 0}
    .v48-summary article{padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff}
    .v48-summary strong{display:block;font-size:1.05rem;margin-bottom:3px}.v48-summary span{font-size:.65rem;color:var(--muted);line-height:1.35}
    .v48-section{margin-top:16px;padding:17px}.v48-section h2{margin:4px 0 5px;font-size:1.05rem}.v48-section p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.4}
    .v48-teacher-form{display:grid;grid-template-columns:minmax(180px,1fr) 120px 150px auto;gap:8px;align-items:end;margin-top:13px}
    .v48-teacher-form label{display:grid;gap:4px;font-size:.62rem;font-weight:850}.v48-teacher-form input{width:100%;padding:9px;border:1px solid var(--line);border-radius:9px}
    .v48-teacher-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:8px;margin-top:12px}
    .v48-teacher-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--band)}
    .v48-teacher-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v48-teacher-card h3{margin:0;font-size:.84rem}
    .v48-teacher-card small{display:block;margin-top:3px;color:var(--muted);font-size:.58rem;line-height:1.35}.v48-teacher-card button{border:0;background:transparent;color:var(--ink);font-weight:900;font-size:.6rem;text-decoration:underline}
    .v48-load{margin-top:8px;height:7px;border-radius:999px;background:#dfe7eb;overflow:hidden}.v48-load span{display:block;height:100%;background:var(--mint-dark)}
    .v48-load.warn span{background:#b98016}.v48-load.over span{background:var(--danger)}
    .v48-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:13px;margin-top:12px}.v48-table{width:100%;min-width:920px;border-collapse:collapse;font-size:.68rem}
    .v48-table th{background:var(--band);font-size:.57rem;text-transform:uppercase;letter-spacing:.04em;text-align:left}.v48-table th,.v48-table td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle}.v48-table tr:last-child td{border-bottom:0}
    .v48-table select{width:100%;min-width:170px;padding:7px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}
    .v48-origin{display:inline-flex;padding:3px 6px;border-radius:999px;background:var(--band);font-size:.54rem;font-weight:850}.v48-origin.fo{background:var(--mint-soft);color:var(--mint-dark)}.v48-origin.custom{background:#f2ecff;color:#604b8e}
    .v48-pending{color:#8a6414;font-weight:900}.v48-known{color:var(--mint-dark);font-weight:900}
    .v48-empty{padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);text-align:center;font-size:.72rem;margin-top:12px}
    @media(max-width:820px){.v48-course-grid{grid-template-columns:repeat(5,1fr)}.v48-teacher-form{grid-template-columns:1fr 1fr}.v48-teacher-form label:first-child{grid-column:1/-1}.v48-teacher-form button{grid-column:1/-1}.phase-grid{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);

  function institutional(){
    state.institutional=state.institutional||{};
    state.institutional.orientations=state.institutional.orientations||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.assignments=state.institutional.assignments||{};
    return state.institutional;
  }
  function orientationConfig(orientation){
    const root=institutional();
    root.orientations[orientation]=root.orientations[orientation]||{courseCounts:{1:1,2:1,3:1,4:1,5:1}};
    const cfg=root.orientations[orientation];cfg.courseCounts=cfg.courseCounts||{};
    for(let y=1;y<=5;y++)if(!Number.isFinite(Number(cfg.courseCounts[y])))cfg.courseCounts[y]=1;
    return cfg;
  }
  const letters=n=>Array.from({length:Math.max(0,Math.min(12,Number(n)||0))},(_,i)=>String.fromCharCode(65+i));
  const divisions=(orientation,year)=>letters(orientationConfig(orientation).courseCounts[year]);
  const slug=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[“”«»"']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  async function loadHours(){
    if(HOURS)return HOURS;
    const r=await fetch(`data/horas-v2.json?v=${VERSION}`,{cache:'force-cache'});
    if(!r.ok)throw new Error('No se pudo cargar la base de horas del plan.');
    HOURS=await r.json();return HOURS;
  }
  function findHours(dict,name){
    if(!dict)return null;const key=norm(name),entries=Object.entries(dict);
    for(const [n,h] of entries)if(norm(n)===key)return Number(h);
    const candidates=entries.filter(([n])=>{const k=norm(n);return key.length>8&&k.length>8&&(k.startsWith(key)||key.startsWith(k))});
    return candidates.length===1?Number(candidates[0][1]):null;
  }
  function hoursForSubject(s,orientation,map){
    if(!s)return null;
    if(s.origin==='CUSTOM')return Number(s.weeklyHours)>0?Number(s.weeklyHours):null;
    if(s.origin==='FG'){
      const canonical=/^fg-\d+-espacios-de-definicion-institucional$/.test(String(s.id||''))?'Espacios de definición institucional':s.name;
      return findHours(HOURS?.formacion_general?.[String(s.year)],canonical);
    }
    if(s.origin==='FO'){
      const o=HOURS?.formacion_orientada?.[orientation];if(!o)return null;
      const dict=Number(s.year)===3?o['3']:o[map?.alt||'A']?.[String(s.year)];
      return findHours(dict,s.name);
    }
    return null;
  }

  function withOrientation(orientation,fn){
    const prev=state.active;state.active=orientation;
    try{return fn()}finally{state.active=prev}
  }
  function placementLabels(map,id){
    const labels=[];
    for(const [slot,ids] of Object.entries(map.placements||{})){
      if(!(ids||[]).includes(id))continue;
      const t=String(slot).match(/-c(\d+)$/),y=String(slot).match(/-n(\d+)$/);
      if(t)labels.push('C'+t[1]);else if(y)labels.push('Nivel '+y[1]+' · anual');
    }
    return [...new Set(labels)];
  }
  function subjectRows(orientation){
    return withOrientation(orientation,()=>{
      const map=ensure(orientation),used=new Set(Object.values(map.placements||{}).flat());
      return [...used].map(id=>byId(id)).filter(Boolean).map(s=>({
        subjectId:s.id,name:s.name,year:Number(s.year),origin:s.origin,hours:hoursForSubject(s,orientation,map),locations:placementLabels(map,s.id)
      })).sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name,'es'));
    });
  }
  function implementationRows(orientation){
    const rows=[];
    for(const s of subjectRows(orientation))for(const division of divisions(orientation,s.year)){
      const course=`${s.year}.º ${division}`;
      const instanceId=`${slug(orientation)}|${s.year}${division}|${s.subjectId}`;
      rows.push({...s,orientation,division,course,instanceId});
    }
    return rows;
  }
  function allImplementationRows(){return (state.selected||[]).flatMap(implementationRows)}

  function ensureHoursInput(){
    const box=document.querySelector('#offer .custom-box');if(!box||$id('customHours'))return;
    const button=$id('addCustom');if(!button)return;
    const wrap=document.createElement('div');wrap.className='v48-hours-row';
    wrap.innerHTML='<label><span class="v48-hours-label">Nombre y nivel</span></label><label><span class="v48-hours-label">Horas semanales</span><input id="customHours" type="number" min="1" max="40" step="1" value="2" inputmode="numeric"></label>';
    button.before(wrap);
    const ghost=wrap.firstElementChild;ghost.appendChild($id('customName'));ghost.appendChild($id('customYear'));
  }

  const previousAddCustom=addCustom;
  addCustom=function(){
    ensureHoursInput();
    const name=$id('customName')?.value.trim()||'',year=Number($id('customYear')?.value),hours=Number($id('customHours')?.value);
    if(!name)return toast('Escribí el nombre de la materia.',true);
    if(!Number.isFinite(hours)||hours<=0)return toast('Indicá las horas semanales frente a curso.',true);
    const m=ensure(state.active);
    m.custom.push({id:`custom-${year}-${Date.now()}`,name,year,weeklyHours:hours,origin:'CUSTOM'});
    $id('customName').value='';$id('customHours').value='2';save();renderOffer();toast('Materia institucional agregada con su carga horaria.');
  };

  function decorateCustomHours(){
    const box=$id('bagContent');if(!box)return;
    box.querySelectorAll('.subject[data-sub]').forEach(card=>{
      const s=byId(card.dataset.sub);if(!s||s.origin!=='CUSTOM'||card.querySelector('.v48-custom-hours-badge'))return;
      const b=document.createElement('button');b.type='button';b.className='v48-custom-hours-badge';
      b.textContent=Number(s.weeklyHours)>0?`${s.weeklyHours} h semanales`:'Definir horas';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();const raw=prompt(`Horas semanales frente a curso para ${s.name}:`,Number(s.weeklyHours)>0?s.weeklyHours:'');if(raw===null)return;const h=Number(raw);if(!Number.isFinite(h)||h<=0)return toast('La carga debe ser mayor que 0.',true);const row=ensure(state.active).custom.find(x=>x.id===s.id);if(row){row.weeklyHours=h;save();renderOffer();toast('Carga horaria actualizada.')}};
      card.children[1]?.appendChild(b);
    });
  }

  function decorateHomeCourses(){
    institutional();
    $id('pciList')?.querySelectorAll('.pci-card').forEach(card=>{
      const orientation=card.querySelector('h3')?.textContent?.trim();if(!orientation||card.querySelector('.v48-course-config'))return;
      const cfg=orientationConfig(orientation),box=document.createElement('div');box.className='v48-course-config';
      box.innerHTML=`<div class="v48-course-title">Cursos / divisiones de esta orientación</div><div class="v48-course-grid">${[1,2,3,4,5].map(y=>`<label>${y}.º<input type="number" min="0" max="12" step="1" value="${Number(cfg.courseCounts[y])}" data-v48-course="${y}"></label>`).join('')}</div><small class="v48-course-help">Ejemplo: 2 cursos genera ${orientation} · A y B para ese nivel. Este dato se usa después en Implementación institucional.</small>`;
      card.appendChild(box);
      box.querySelectorAll('[data-v48-course]').forEach(input=>input.onchange=()=>{const y=Number(input.dataset.v48Course),value=Math.max(0,Math.min(12,Number(input.value)||0));cfg.courseCounts[y]=value;input.value=value;save();});
    });
  }

  function ensureInstitutionalScreen(){
    if($id('institutional'))return;
    const main=document.querySelector('main.wrap');if(!main)return;
    const section=document.createElement('section');section.id='institutional';section.className='screen';
    section.innerHTML='<button class="back" data-v48-panel>← Volver al panel</button><div class="hero"><div class="eyebrow">Implementación institucional</div><h1 id="v48InstitutionalTitle"></h1><p>Esta capa lee exclusivamente el Mapa de la Oferta de Fase 1. No modifica la estructura curricular ni la Fase 2.</p><div class="v48-hero-actions"><button class="btn soft" data-v48-home>Configurar cursos</button></div></div><div id="v48InstitutionalContent"></div>';
    main.appendChild(section);
    section.querySelector('[data-v48-panel]').onclick=()=>window.screen?.('panel');
    section.querySelector('[data-v48-home]').onclick=()=>window.screen?.('home');
  }

  function ensurePanelCard(){
    const grid=document.querySelector('#panel .phase-grid');if(!grid||$id('institutionalCard'))return;
    const card=document.createElement('article');card.id='institutionalCard';card.className='card phase locked';
    card.innerHTML='<div class="eyebrow">3 · Rama institucional</div><h2>Implementación institucional</h2><p>Levanta Fase 1 para generar cursos, asignaciones docentes, carga horaria y luego disponibilidad y horarios. No depende de Fase 2.</p><button id="openInstitutional" class="btn primary" disabled>Entrar</button>';
    grid.appendChild(card);
  }

  function teachers(){return institutional().teachers}
  function teacherList(){return Object.values(teachers()).sort((a,b)=>a.name.localeCompare(b.name,'es'))}
  function teacherMax(t){return Number(t.baseHours||0)*(1+Number(t.extraPct??50)/100)}
  function teacherLoads(){
    const result={};for(const t of teacherList())result[t.id]={known:0,pending:0};
    const assignments=institutional().assignments;
    for(const row of allImplementationRows()){
      const tid=assignments[row.instanceId];if(!tid)continue;if(!result[tid])result[tid]={known:0,pending:0};
      if(row.hours==null)result[tid].pending++;else result[tid].known+=Number(row.hours);
    }
    return result;
  }
  function addTeacher(name,baseHours,extraPct){
    const clean=String(name||'').trim(),base=Number(baseHours),pct=Number(extraPct);
    if(!clean)return toast('Escribí el nombre del docente.',true);
    if(!Number.isFinite(base)||base<0)return toast('Indicá una cantidad válida de horas base.',true);
    if(!Number.isFinite(pct)||pct<0)return toast('Indicá un porcentaje adicional válido.',true);
    const id=`doc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;teachers()[id]={id,name:clean,baseHours:base,extraPct:pct};save();renderInstitutional();
  }
  function editTeacher(id){
    const t=teachers()[id];if(!t)return;
    const name=prompt('Nombre y apellido:',t.name);if(name===null)return;
    const base=prompt('Horas base:',t.baseHours);if(base===null)return;
    const pct=prompt('Porcentaje adicional máximo:',t.extraPct??50);if(pct===null)return;
    const b=Number(base),p=Number(pct);if(!name.trim()||!Number.isFinite(b)||b<0||!Number.isFinite(p)||p<0)return toast('Datos docentes inválidos.',true);
    t.name=name.trim();t.baseHours=b;t.extraPct=p;save();renderInstitutional();
  }

  function teacherCards(){
    const list=teacherList(),loads=teacherLoads();
    if(!list.length)return '<div class="v48-empty">Todavía no cargaste docentes. Podés agregarlos arriba y luego asignarlos por curso.</div>';
    return `<div class="v48-teacher-list">${list.map(t=>{const l=loads[t.id]||{known:0,pending:0},max=teacherMax(t),ratio=max?l.known/max:0,cls=ratio>1?'over':ratio>.85?'warn':'';return`<article class="v48-teacher-card"><div class="v48-teacher-head"><div><h3>${esc(t.name)}</h3><small>Base: ${t.baseHours} h · máximo ofrecible: ${max.toFixed(1).replace('.0','')} h (+${t.extraPct??50}%)</small></div><button data-v48-edit-teacher="${esc(t.id)}">Editar</button></div><div class="v48-load ${cls}"><span style="width:${Math.min(100,Math.round(ratio*100))}%"></span></div><small><strong>${l.known} h asignadas</strong>${l.pending?` · ${l.pending} carga${l.pending===1?'':'s'} pendiente${l.pending===1?'':'s'}`:''}</small></article>`}).join('')}</div>`;
  }

  function originLabel(o){return o==='FO'?'Formación Orientada':o==='CUSTOM'?'Institucional':'Formación General'}
  function implementationTable(rows){
    if(!rows.length)return '<div class="v48-empty">Fase 1 todavía no tiene materias ubicadas para implementar en esta orientación.</div>';
    const list=teacherList(),assignments=institutional().assignments;
    return `<div class="v48-table-wrap"><table class="v48-table"><thead><tr><th>Curso</th><th>Materia / materialización</th><th>Origen</th><th>Ubicación Fase 1</th><th>Horas frente a curso</th><th>Docente</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.course)}</strong></td><td><strong>${esc(r.name)}</strong></td><td><span class="v48-origin ${r.origin==='FO'?'fo':r.origin==='CUSTOM'?'custom':''}">${esc(originLabel(r.origin))}</span></td><td>${esc(r.locations.join(' · ')||'—')}</td><td class="${r.hours==null?'v48-pending':'v48-known'}">${r.hours==null?'Pendiente':`${esc(r.hours)} h`}</td><td><select data-v48-assignment="${esc(r.instanceId)}"><option value="">Sin asignar</option>${list.map(t=>`<option value="${esc(t.id)}" ${assignments[r.instanceId]===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function renderInstitutional(){
    ensureInstitutionalScreen();const host=$id('v48InstitutionalContent');if(!host||!state.active)return;
    $id('v48InstitutionalTitle').textContent=`${state.school} · ${state.active}`;
    const map=ensure(state.active);
    if(!map.valid){host.innerHTML='<div class="notice"><strong>Primero validá Fase 1.</strong> La Implementación institucional toma como fuente el Mapa de la Oferta y no modifica ese mapa.</div>';return}
    host.innerHTML='<div class="v48-empty">Leyendo Fase 1 y cargas horarias…</div>';
    try{await loadHours()}catch(e){host.innerHTML=`<div class="notice"><strong>No se pudo leer la carga horaria.</strong> ${esc(e.message||e)}</div>`;return}
    const rows=implementationRows(state.active),courseTotal=[1,2,3,4,5].reduce((a,y)=>a+divisions(state.active,y).length,0),known=rows.filter(r=>r.hours!=null).reduce((a,r)=>a+r.hours,0),pending=rows.filter(r=>r.hours==null).length;
    host.innerHTML=`<div class="notice"><strong>Fuente institucional:</strong> esta pantalla se reconstruye desde Fase 1. Fase 2 no interviene en docentes, carga horaria ni horarios.</div><div class="v48-summary"><article><strong>${courseTotal}</strong><span>cursos/divisiones configurados para esta orientación</span></article><article><strong>${rows.length}</strong><span>instancias de materias generadas por curso desde Fase 1</span></article><article><strong>${known} h</strong><span>horas frente a curso conocidas en las instancias actuales</span></article><article><strong>${pending}</strong><span>instancias con carga horaria pendiente</span></article></div><section class="card v48-section"><div class="eyebrow">Docentes</div><h2>Plantel y máximo de ofrecimiento</h2><p>El máximo se calcula sobre las horas base. El porcentaje adicional es configurable por docente y parte de 50 %.</p><div class="v48-teacher-form"><label>Nombre y apellido<input id="v48TeacherName" autocomplete="off"></label><label>Horas base<input id="v48TeacherBase" type="number" min="0" step="1" value="20"></label><label>Adicional máximo %<input id="v48TeacherExtra" type="number" min="0" step="5" value="50"></label><button id="v48AddTeacher" class="btn primary">Agregar docente</button></div>${teacherCards()}</section><section class="card v48-section"><div class="eyebrow">Implementación por curso</div><h2>Asignación docente</h2><p>Una misma materia del PCI genera una instancia por cada división del nivel. Cada curso puede tener un docente distinto.</p>${implementationTable(rows)}</section>`;
    $id('v48AddTeacher').onclick=()=>addTeacher($id('v48TeacherName').value,$id('v48TeacherBase').value,$id('v48TeacherExtra').value);
    host.querySelectorAll('[data-v48-edit-teacher]').forEach(b=>b.onclick=()=>editTeacher(b.dataset.v48EditTeacher));
    host.querySelectorAll('[data-v48-assignment]').forEach(sel=>sel.onchange=()=>{
      const row=rows.find(x=>x.instanceId===sel.dataset.v48Assignment);if(!row)return;
      const root=institutional(),old=root.assignments[row.instanceId]||'',next=sel.value;
      if(next&&row.hours!=null){const loads=teacherLoads(),t=teachers()[next],current=loads[next]?.known||0,projected=current+(old===next?0:Number(row.hours));if(t&&projected>teacherMax(t)+1e-9){sel.value=old;toast(`${t.name} superaría su máximo ofrecible de ${teacherMax(t).toFixed(1).replace('.0','')} h.`,true);return}}
      if(next)root.assignments[row.instanceId]=next;else delete root.assignments[row.instanceId];save();renderInstitutional();
    });
  }

  const previousRenderHome=renderHome;
  renderHome=function(){previousRenderHome();institutional();decorateHomeCourses()};
  const previousRenderPanel=renderPanel;
  renderPanel=function(){previousRenderPanel();ensureInstitutionalScreen();ensurePanelCard();const valid=!!ensure(state.active).valid,card=$id('institutionalCard'),button=$id('openInstitutional');if(card)card.classList.toggle('locked',!valid);if(button){button.disabled=!valid;button.textContent=valid?'Entrar':'Validá Fase 1';button.onclick=()=>window.screen?.('institutional')}};
  const previousRenderOffer=renderOffer;
  renderOffer=function(){ensureHoursInput();previousRenderOffer();ensureHoursInput();decorateCustomHours()};
  const previousScreen=window.screen;
  if(typeof previousScreen==='function'){
    const wrapped=function(id){const result=previousScreen(id);if(id==='institutional')setTimeout(()=>renderInstitutional(),0);return result};
    Object.assign(wrapped,previousScreen);window.screen=wrapped;
  }

  window.PCIInstitutionalV48={institutional,orientationConfig,implementationRows,allImplementationRows,renderInstitutional,loadHours};
  ensureHoursInput();ensureInstitutionalScreen();
})();
