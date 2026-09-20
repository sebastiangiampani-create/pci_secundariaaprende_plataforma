(() => {
  const $=id=>document.getElementById(id);
  let timer=null,activeKey='home',applying=false;

  const defs=[
    {key:'docentes',title:'Docentes y cargos',desc:'Planta docente, cargos, bolsas de horas y carga disponible.',icon:'👥',
      find:()=>[...document.querySelectorAll('#v48InstitutionalContent > .v71m-teacher-section')]},
    {key:'asignaciones',title:'Asignaciones',desc:'Asignación frente a curso desde las materias y agrupamientos del Mapa de la Oferta.',icon:'↔',
      find:()=>[...document.querySelectorAll('#v48InstitutionalContent > .v71o-assignment')]},
    {key:'comisiones',title:'Cursos, comisiones y estudiantes',desc:'Cursos y divisiones de la escuela, con sus listados de estudiantes.',icon:'▤',
      find:()=>[$('v72StudentsCommissions')].filter(Boolean)},
    {key:'equipos',title:'Equipos y reuniones',desc:'Equipos derivados de los agrupamientos reales y coincidencias semanales.',icon:'◎',
      find:()=>[$('v53Workload')].filter(Boolean)},
    {key:'disponibilidad',title:'Disponibilidad',desc:'Días disponibles, no disponibles y preferencias de cada docente.',icon:'◫',
      find:()=>[$('v60Availability')].filter(Boolean)},
    {key:'horarios',title:'Horarios',desc:'Generación y vistas por curso, docente y reuniones.',icon:'◷',
      find:()=>findByHeading(/Vistas del horario|horario institucional|grilla|horario/i)},
    {key:'excel',title:'Carga masiva',desc:'Importación de planta, cargos y asignaciones mediante Excel.',icon:'⇩',
      find:()=>[$('v71SimpleAssignmentExcel')].filter(Boolean)},
    {key:'respaldo',title:'Respaldo',desc:'Exportación, impresión y respaldo de la gestión institucional.',icon:'□',
      find:()=>[$('v68InstitutionalExport')].filter(Boolean).concat(findByHeading(/Descargar e imprimir|respaldo/i))}
  ];

  function host(){return $('v48InstitutionalContent')}
  function visibleManagement(){return !!$('institutional')?.classList.contains('active')}
  function findByHeading(re){
    const h=host();if(!h)return[];
    return [...h.children].filter(el=>re.test(el.querySelector?.('h2')?.textContent||''));
  }
  function institutional(){
    state.institutional=state.institutional||{};
    return state.institutional;
  }
  function rows(){return window.PCIInstitutionalV48?.allImplementationRows?.()||[]}
  function commissionDefs(){return window.PCIStudentsCommissionsV72?.commissionDefs?.()||[]}

  function metrics(){
    const r=institutional(),all=rows(),teachers=Object.values(r.teachers||{}),assigned=all.filter(x=>r.assignments?.[x.instanceId]).length;
    const commissions=commissionDefs(),validKeys=new Set(commissions.map(x=>x.key));
    const students=new Set();
    for(const [k,c] of Object.entries(r.commissions||{}))if(validKeys.has(k))for(const dni of c.students||[])students.add(dni);
    const loadedCommissions=commissions.filter(c=>(r.commissions?.[c.key]?.students||[]).length>0).length;
    const teams=Object.values(r.areaTeams||{});
    const availCount=Object.keys(r.availabilityPreferences||r.availability||{}).length;
    const scheduleCount=(r.annualScheduleVersions||[]).length,scheduleStatus=window.PCIScheduleStableV81?.status?.()||null;
    return {teachers,assigned,total:all.length,commissions,loadedCommissions,students:students.size,teams,availCount,scheduleCount,scheduleStatus};
  }

  function statusFor(key,m){
    if(key==='docentes')return `${m.teachers.length} docentes cargados`;
    if(key==='asignaciones')return `${m.assigned}/${m.total} espacios asignados`;
    if(key==='comisiones')return `${m.commissions.length} cursos · ${m.students} estudiantes`;
    if(key==='equipos')return `${m.teams.length} equipos detectados`;
    if(key==='disponibilidad')return `${m.availCount}/${m.teachers.length} docentes configurados`;
    if(key==='horarios')return m.scheduleStatus?.label||(m.scheduleCount?'Borrador generado':'Pendiente de generar');
    if(key==='excel')return 'Planta y asignaciones';
    if(key==='respaldo')return 'Exportación institucional';
    return '';
  }

  function renderHome(){
    const h=host();if(!h||!visibleManagement())return;
    let home=$('v73ManagementHome');
    if(!home){
      home=document.createElement('section');
      home.id='v73ManagementHome';
      home.className='v73-management-home';
      h.prepend(home);
    }
    const m=metrics();
    const alerts=[];
    if(m.total-m.assigned>0)alerts.push(`${m.total-m.assigned} espacios sin docente`);
    if(m.commissions.length-m.loadedCommissions>0)alerts.push(`${m.commissions.length-m.loadedCommissions} comisiones sin listado`);
    const over=m.teachers.filter(t=>{
      const cargos=Array.isArray(t.cargos)&&t.cargos.length?t.cargos:[{type:t.cargoType||'TP4',manualHours:t.manualHours||0}];
      const nominal=cargos.reduce((n,c)=>n+(c.type==='POR_HORAS'?Number(c.manualHours)||0:({TC:36,TP1:30,TP2:24,TP3:18,TP4:12}[c.type]||0)),0);
      const front=allAssignedHours(t.id);
      return front+(t.meetingHours==null?3:Number(t.meetingHours)||0)>nominal;
    }).length;
    if(over)alerts.push(`${over} docentes con sobreasignación`);
    if(m.scheduleStatus?.state==='stale')alerts.push('horario vigente desactualizado');

    home.innerHTML=`
      <div class="v73-hero">
        <div>
          <div class="eyebrow">Gestión institucional</div>
          <h2>Organización docente y académica</h2>
          <p>Accedé a cada módulo sin recorrer una página interminable. Toda la información sigue conectada con el Mapa de la Oferta y el Desarrollo Curricular.</p>
        </div>
        <div class="v73-kpis">
          <span><strong>${m.teachers.length}</strong> docentes</span>
          <span><strong>${m.assigned}/${m.total}</strong> asignaciones</span>
          <span><strong>${m.students}</strong> estudiantes</span>
          <span><strong>${m.commissions.length}</strong> comisiones</span>
        </div>
      </div>
      ${alerts.length?`<div class="v73-alert"><strong>Para revisar:</strong> ${alerts.join(' · ')}</div>`:'<div class="v73-ok">Gestión sin alertas críticas en este momento.</div>'}
      <div class="v73-grid">
        ${defs.map(d=>`<article class="v73-card" data-v73-card="${d.key}">
          <div class="v73-card-top"><span class="v73-card-icon">${d.icon}</span><span class="v73-status">${statusFor(d.key,m)}</span></div>
          <h3>${d.title}</h3>
          <p>${d.desc}</p>
          <button type="button" data-v73-open="${d.key}">Entrar</button>
        </article>`).join('')}
      </div>
      <div class="v73-danger">
        <div><strong>Reiniciar Gestión</strong><span>Borra únicamente los datos de Gestión Institucional. No modifica el Mapa de la Oferta ni el Desarrollo Curricular.</span></div>
        <button type="button" data-v73-reset>Reiniciar</button>
      </div>`;

    home.querySelectorAll('[data-v73-open]').forEach(b=>b.onclick=()=>openModule(b.dataset.v73Open));
    home.querySelector('[data-v73-reset]')?.addEventListener('click',()=>window.PCIManagementNavResetV71?.resetManagement?.());
  }

  function allAssignedHours(tid){
    return rows().filter(r=>institutional().assignments?.[r.instanceId]===tid).reduce((n,r)=>n+(Number(r.hours)||0),0);
  }

  function ensureToolbar(){
    const h=host();if(!h)return null;
    let bar=$('v73ModuleToolbar');
    if(!bar){
      bar=document.createElement('div');bar.id='v73ModuleToolbar';bar.className='v73-module-toolbar';
      h.prepend(bar);
    }
    return bar;
  }

  function prepareModule(key){
    try{
      if(key==='comisiones')window.PCIStudentsCommissionsV72?.render?.();
      if(key==='disponibilidad')window.PCIAvailabilityPreferencesV60?.render?.();
      if(key==='excel')window.PCISimpleAssignmentExcelV71?.render?.();
      if(key==='respaldo')window.PCIInstitutionalExportV68?.decorate?.();
      if(key==='horarios')window.PCIAnnualSchedulerV68?.render?.();
      if(key==='equipos')window.PCIAutoAreaCoincidenceV54?.deriveTeams?.();
    }catch(e){console.warn('V73 prepare module',key,e)}
  }

  function openModule(key){
    activeKey=key;
    const def=defs.find(x=>x.key===key);if(!def)return;
    prepareModule(key);
    setTimeout(()=>{
      applyView();
      requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
    },90);
  }
  function goHome(){activeKey='home';applyView();window.scrollTo({top:0,behavior:'smooth'})}

  function applyView(){
    const h=host();if(!h||!visibleManagement()||applying)return;
    applying=true;
    try{
    renderHome();
    const home=$('v73ManagementHome'),bar=ensureToolbar();
    const allChildren=[...h.children].filter(x=>x!==home&&x!==bar);
    allChildren.forEach(x=>x.classList.add('v73-hidden'));

    if(activeKey==='home'){
      if(home)home.classList.remove('v73-hidden');
      if(bar)bar.classList.add('v73-hidden');
      document.body.classList.add('v73-management-home-active');
    } else {
    document.body.classList.remove('v73-management-home-active');
    if(home)home.classList.add('v73-hidden');
    const def=defs.find(x=>x.key===activeKey);
    const targets=def?.find?.()||[];
    targets.forEach(x=>x?.classList.remove('v73-hidden'));
    if(bar){
      bar.classList.remove('v73-hidden');
      bar.innerHTML=`<button type="button" data-v73-home>← Inicio de Gestión</button><div><span>Gestión institucional</span><strong>${def?.title||''}</strong></div>`;
      bar.querySelector('[data-v73-home]').onclick=goHome;
    }
    }
    } finally {
      applying=false;
    }
  }

  function refresh(){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!visibleManagement())return;
      applyView();
    },80);
  }

  function start(){if(!host())return;refresh();}

  window.addEventListener('pci-app-ready',()=>setTimeout(start,900));
  document.addEventListener('click',e=>{if(e.target.closest('[data-v71n-open],#openInstitutional,#openInstitutionalGeneral')){activeKey='home';setTimeout(start,250)}},true);
  setTimeout(start,1600);

  const style=document.createElement('style');
  style.textContent=`
    .v73-hidden{display:none!important}
    .v73-management-home{display:grid;gap:16px}
    .v73-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.7fr);gap:22px;padding:24px;border:1px solid #d8e1e8;border-radius:24px;background:linear-gradient(135deg,#f8fbfd 0%,#eef5f8 100%);box-shadow:0 14px 34px rgba(18,57,92,.08)}
    .v73-hero:after{content:"";position:absolute;width:210px;height:210px;border-radius:50%;right:-70px;bottom:-105px;background:#dfe7ec}
    .v73-hero>div{position:relative;z-index:1}.v73-hero h2{font-size:clamp(1.5rem,3vw,2.4rem);margin:5px 0 8px;letter-spacing:-.03em}.v73-hero p{margin:0;color:var(--muted);line-height:1.5;max-width:760px}
    .v73-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start}.v73-kpis span{padding:12px;border:1px solid rgba(18,57,92,.08);border-radius:14px;background:rgba(255,255,255,.78);font-size:.68rem;color:var(--muted)}.v73-kpis strong{display:block;font-size:1.2rem;color:var(--ink);margin-bottom:2px}
    .v73-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .v73-card{display:flex;flex-direction:column;min-height:210px;padding:18px;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 10px 26px rgba(18,57,92,.06);transition:.18s ease}.v73-card:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(18,57,92,.1)}
    .v73-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.v73-card-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:var(--band);font-size:1.3rem}.v73-status{max-width:68%;padding:5px 7px;border-radius:999px;background:var(--mint-soft);color:var(--mint-dark);font-size:.51rem;font-weight:850;text-align:right}
    .v73-card h3{margin:15px 0 6px;font-size:1rem}.v73-card p{margin:0 0 16px;color:var(--muted);font-size:.67rem;line-height:1.45}.v73-card button{margin-top:auto;width:max-content;min-width:100px;padding:9px 16px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-weight:850}
    .v73-alert,.v73-ok{padding:11px 14px;border-radius:14px;font-size:.67rem;line-height:1.4}.v73-alert{background:var(--danger-soft);color:var(--danger);border:1px solid #efcbd2}.v73-ok{background:var(--ok-soft);color:var(--ok);border:1px solid #c5e6d4}
    .v73-danger{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid #ebc8cf;border-radius:16px;background:#fffafb}.v73-danger strong{display:block;color:var(--danger);font-size:.72rem}.v73-danger span{display:block;margin-top:3px;color:var(--muted);font-size:.58rem}.v73-danger button{border:1px solid #d7a8b2;border-radius:999px;background:#fff5f6;color:var(--danger);padding:8px 13px;font-weight:850}
    .v73-module-toolbar{position:sticky;top:8px;z-index:95;display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:9px 12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 8px 22px rgba(18,57,92,.09);backdrop-filter:blur(10px)}
    .v73-module-toolbar button{border:1px solid var(--line);border-radius:999px;background:var(--band);color:var(--ink);padding:8px 12px;font-weight:850}.v73-module-toolbar span{display:block;color:var(--muted);font-size:.52rem}.v73-module-toolbar strong{display:block;font-size:.76rem}
    #institutional #v71ManagementNav{display:none!important}
    #institutional > .back[data-v48-panel],#institutional .v48-hero-actions{display:none!important}
    @media(max-width:1150px){.v73-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:850px){.v73-hero{grid-template-columns:1fr}.v73-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.v73-grid{grid-template-columns:1fr}.v73-hero{padding:18px;border-radius:20px}.v73-kpis{grid-template-columns:1fr 1fr}.v73-card{min-height:0}.v73-card button{width:100%}.v73-module-toolbar{top:6px}.v73-danger{align-items:stretch;flex-direction:column}.v73-danger button{width:100%}}
  `;
  document.head.appendChild(style);

  window.PCIManagementHomeV73={openModule,goHome,refresh};
})();