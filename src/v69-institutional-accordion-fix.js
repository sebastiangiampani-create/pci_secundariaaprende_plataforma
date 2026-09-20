(() => {
  const $=id=>document.getElementById(id);
  let observer=null,observedHost=null,timer=null,cleaning=false;

  function sections(){
    const host=$('v48InstitutionalContent');
    return host?[...host.querySelectorAll(':scope > .v48-section')]:[];
  }

  function makeAlwaysOpen(section){
    if(!section)return;
    // V71e: Gestión Institucional deja de usar acordeones.
    // Conservamos los flags legacy para impedir que módulos anteriores vuelvan
    // a crear botones de abrir/cerrar, pero todos los contenidos quedan visibles.
    section.dataset.v69Collapsible='1';
    section.dataset.v69dAccordion='1';
    section.classList.remove('v69-collapsed','v69-collapsible','v69d-collapsed','v69d-accordion');
    section.querySelectorAll(':scope > .v69-section-toggle,:scope > .v69d-accordion-toggle').forEach(x=>x.remove());
    const h=section.querySelector(':scope > h2');
    if(h){
      h.onclick=null;
      h.removeAttribute('title');
      h.classList.remove('v69d-accordion-title');
    }
  }

  function refresh(){
    if(cleaning)return;
    const screen=$('institutional'),host=$('v48InstitutionalContent');
    if(!screen||!host||!screen.classList.contains('active'))return;
    cleaning=true;
    try{
      // No eliminamos controles legacy del DOM: ocultarlos evita ciclos de
      // MutationObserver create/remove/create entre módulos viejos.
      const old=$('v69AccordionToolbar');if(old)old.classList.add('v71e-hidden');
      const newer=$('v69dAccordionToolbar');if(newer)newer.classList.add('v71e-hidden');
      document.querySelectorAll('#v69ImportHero').forEach(x=>x.classList.add('v71e-hidden'));
      sections().forEach(makeAlwaysOpen);
    }finally{cleaning=false}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,60)}
  function bind(){
    const host=$('v48InstitutionalContent');
    if(!host||host===observedHost)return;
    observer?.disconnect();
    observedHost=host;
    observer=new MutationObserver(schedule);
    observer.observe(host,{childList:true,subtree:false});
  }
  function burst(){[0,100,300,700].forEach(ms=>setTimeout(()=>{bind();refresh()},ms))}

  document.addEventListener('click',e=>{
    if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home],[data-v48-panel]'))burst();
  },true);
  window.addEventListener('pci-app-ready',burst);
  document.addEventListener('DOMContentLoaded',burst,{once:true});
  burst();

  const style=document.createElement('style');
  style.textContent=`
    #v69AccordionToolbar,#v69dAccordionToolbar,.v69-section-toggle,.v69d-accordion-toggle{display:none!important}
    #v69ImportHero.v71e-hidden{display:none!important}
    #v48InstitutionalContent>.v48-section{display:block!important}
    #v48InstitutionalContent>.v48-section>*{display:revert}
    #v48InstitutionalContent>.v48-section>h2{cursor:default!important;padding-right:0!important}
    #v48InstitutionalContent>.v48-section>h2:hover{text-decoration:none!important}
  `;
  document.head.appendChild(style);

  // Compatibilidad con V70/V71: cualquier intento de colapsar simplemente
  // reafirma que la sección debe permanecer abierta.
  function setCollapsed(section){makeAlwaysOpen(section)}
  window.PCIInstitutionalAccordionV69={refresh,sections,setCollapsed,burst};
})();