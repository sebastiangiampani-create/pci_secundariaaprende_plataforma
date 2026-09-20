(() => {
  const $=id=>document.getElementById(id);
  let observer=null,observedHost=null,timer=null;

  const ACADEMIC_KEYS=new Set(['grading','attendance']);

  function resetPayload(current){
    const source=current&&typeof current==='object'?current:{};
    const next={};
    for(const key of ACADEMIC_KEYS){
      if(Object.prototype.hasOwnProperty.call(source,key))next[key]=source[key];
    }
    return next;
  }

  function visible(){return !!$('institutional')?.classList.contains('active')}
  function host(){return $('v48InstitutionalContent')}

  function byHeading(pattern){
    const h=host();if(!h)return null;
    return [...h.querySelectorAll(':scope > section, :scope > .card')].find(section=>{
      const title=section.querySelector('h2')?.textContent||'';
      return pattern.test(title);
    })||null;
  }

  function targets(){
    return [
      {key:'resumen',label:'Resumen',find:()=>$('v71ManagementSummary')||host()?.querySelector('.v71m-summary')},
      {key:'docentes',label:'Docentes y cargos',find:()=>$('v71TeacherSection')||host()?.querySelector('.v71m-teacher-section')||byHeading(/Docentes y bolsa de horas|Docentes/i)},
      {key:'asignaciones',label:'Asignaciones',find:()=>$('v71AssignmentSection')||host()?.querySelector('.v71o-assignment')||byHeading(/Arrastrá un docente|Asignación/i)},
      {key:'comisiones',label:'Comisiones y estudiantes',find:()=>$('v72StudentsCommissions')||byHeading(/Comisiones y estudiantes|Listados generados/i)},
      {key:'equipos',label:'Equipos y reuniones',find:()=>byHeading(/Equipos y reuniones|equipo|planificaci[oó]n|carga docente/i)},
      {key:'disponibilidad',label:'Disponibilidad',find:()=>$('v60Availability')||byHeading(/Disponibilidad y preferencias/i)},
      {key:'horario',label:'Horarios',find:()=>$('v68AnnualScheduler')||byHeading(/Vistas del horario|grilla|horario/i)},
      {key:'excel',label:'Carga Excel',find:()=>$('v71SimpleAssignmentExcel')},
      {key:'respaldo',label:'Respaldo',find:()=>$('v68InstitutionalExport')||byHeading(/Descargar e imprimir|respaldo/i)}
    ];
  }

  function go(find){
    const el=find?.();if(!el)return;
    const nav=$('v71ManagementNav');
    const offset=(nav?.offsetHeight||0)+12;
    const top=el.getBoundingClientRect().top+window.scrollY-offset;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    el.classList.add('v71k-target-flash');
    setTimeout(()=>el.classList.remove('v71k-target-flash'),900);
  }

  function resetManagement(){
    const hasData=state?.institutional&&Object.keys(state.institutional).length>0;
    const message=hasData
      ?'Esto borra SOLO Gestión Institucional: docentes, asignaciones, disponibilidad, equipos, horarios, comisiones, estudiantes y respaldos internos. Conserva Calificaciones, Cierres/Boletines y Asistencia. Fase 1 y Fase 2 no se modifican. ¿Querés reiniciar Gestión?'
      :'Gestión Institucional ya está vacía. ¿Querés recargarla desde cero?';
    if(!window.confirm(message))return;
    try{
      state.institutional=resetPayload(state.institutional);
      save();
      try{sessionStorage.setItem('pci-v71k-management-reset-at',new Date().toISOString())}catch{}
      location.reload();
    }catch(e){
      console.error('V71k reset',e);
      toast('No se pudo reiniciar Gestión Institucional.',true);
    }
  }

  function renderNav(){
    if(!visible())return;
    const screen=$('institutional'),h=host();if(!screen||!h)return;
    let nav=$('v71ManagementNav');
    if(!nav){
      nav=document.createElement('nav');
      nav.id='v71ManagementNav';
      nav.className='v71k-management-nav';
      const hero=screen.querySelector('.hero');
      if(hero)hero.after(nav);else screen.prepend(nav);
    }
    const items=targets().filter(x=>x.find());
    nav.innerHTML=`<div class="v71k-nav-scroll">${items.map(x=>`<button type="button" data-v71k-go="${x.key}"><span class="v71k-icon" aria-hidden="true"></span><span>${x.label}</span></button>`).join('')}</div><button type="button" class="v71k-reset" data-v71k-reset><span class="v71k-reset-icon" aria-hidden="true">↻</span><span>Reiniciar Gestión</span></button>`;
    for(const item of items){
      nav.querySelector(`[data-v71k-go="${item.key}"]`)?.addEventListener('click',()=>go(item.find));
    }
    nav.querySelector('[data-v71k-reset]')?.addEventListener('click',resetManagement);
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(renderNav,90)}
  function bind(){
    const h=host();if(!h||h===observedHost)return;
    observer?.disconnect();observedHost=h;
    observer=new MutationObserver(refresh);
    observer.observe(h,{childList:true,subtree:false});
  }
  function burst(){[0,180,500,1100,1800].forEach(ms=>setTimeout(()=>{bind();renderNav()},ms))}

  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home],[data-v48-panel]'))burst()},true);
  window.addEventListener('pci-app-ready',burst);
  document.addEventListener('DOMContentLoaded',burst,{once:true});
  burst();

  const style=document.createElement('style');
  style.textContent=`
    .v71k-management-nav{
      position:sticky;top:0;z-index:80;display:grid;grid-template-columns:1fr;gap:10px;
      margin:10px 0 14px;padding:12px;border:1px solid #d7e2e9;border-radius:18px;
      background:rgba(255,255,255,.97);box-shadow:0 10px 28px rgba(18,57,92,.08);
      backdrop-filter:blur(12px)
    }
    .v71k-nav-scroll{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;overflow:visible;padding:0}
    .v71k-management-nav button{
      min-height:50px;border:1px solid #d9e3ea;border-radius:999px;background:#f7fafc;color:#12395c;
      padding:10px 16px;font-size:.72rem;font-weight:850;cursor:pointer;white-space:nowrap;
      display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 2px 5px rgba(18,57,92,.03)
    }
    .v71k-management-nav button:hover{border-color:#b8cad6;background:#eef4f7}
    .v71k-management-nav [data-v71k-go="excel"]{background:#163f68;color:#fff;border-color:#163f68}
    .v71k-management-nav [data-v71k-go="excel"]:hover{background:#12395c}
    .v71k-icon{display:inline-grid;place-items:center;width:20px;height:20px;font-size:1rem;font-weight:900}
    [data-v71k-go="resumen"] .v71k-icon::before{content:"▦"}
    [data-v71k-go="docentes"] .v71k-icon::before{content:"●"}
    [data-v71k-go="asignaciones"] .v71k-icon::before{content:"↔"}
    [data-v71k-go="comisiones"] .v71k-icon::before{content:"▤"}
    [data-v71k-go="equipos"] .v71k-icon::before{content:"◎"}
    [data-v71k-go="disponibilidad"] .v71k-icon::before{content:"♟"}
    [data-v71k-go="horario"] .v71k-icon::before{content:"◷"}
    [data-v71k-go="excel"] .v71k-icon::before{content:"⇩"}
    [data-v71k-go="respaldo"] .v71k-icon::before{content:"□"}
    .v71k-management-nav .v71k-reset{
      width:100%;min-height:48px;border:1.5px solid #dfa7b2;background:#fff7f8;color:#b6324a;
      font-size:.75rem;font-weight:900;box-shadow:none
    }
    .v71k-reset-icon{font-size:1.2rem;line-height:1}
    .v71k-target-flash{outline:3px solid rgba(70,160,145,.22);outline-offset:3px;transition:outline-color .9s ease}
    @media(max-width:780px){
      .v71k-management-nav{top:0;margin-left:-2px;margin-right:-2px;padding:10px;border-radius:16px;gap:10px}
      .v71k-nav-scroll{display:flex;gap:7px;width:100%;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;padding-bottom:2px}
      .v71k-nav-scroll::-webkit-scrollbar{display:none}
      .v71k-nav-scroll button{scroll-snap-align:start;min-width:max-content}
      .v71k-management-nav button{min-height:48px;padding:9px 8px;font-size:.68rem;gap:6px}
      .v71k-icon{width:18px;height:18px;font-size:.9rem}
      .v71k-management-nav .v71k-reset{min-height:46px}
    }
    @media(max-width:430px){
      .v71k-management-nav button{font-size:.64rem}
      .v71k-icon{display:none}
    }
  `;
  document.head.appendChild(style);

  window.PCIManagementNavResetV71={renderNav,resetManagement,go,resetPayload};
})();