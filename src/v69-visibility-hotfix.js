(() => {
  const $=id=>document.getElementById(id);
  const importer=()=>window.PCITeacherImportV64||null;
  let screenObserver=null,contentObserver=null,observedContent=null,timer=null;

  function visibleInstitutional(){
    return !!$('institutional')?.classList.contains('active');
  }

  function dedupeControls(){
    // Los controles legacy permanecen en DOM pero ocultos para no reactivar
    // ciclos de MutationObserver entre módulos anteriores.
    document.querySelectorAll('#v69ImportHero').forEach(el=>{
      el.classList.add('v71f-hidden');
      el.setAttribute('aria-hidden','true');
    });
    document.querySelectorAll('#v69ExcelPinned').forEach(el=>{
      el.classList.add('v71f-hidden');
      el.setAttribute('aria-hidden','true');
    });
    const section=$('v64TeacherImport');
    if(section){
      const actions=section.querySelector('.v64-import-actions');
      if(actions)actions.style.display='none';
    }
  }

  function showSection(){
    const section=$('v64TeacherImport');
    if(!section)return false;
    if(!section.dataset.v69dAccordion){
      section.classList.remove('v69-collapsed');
      const toggle=section.querySelector(':scope > .v69-section-toggle');
      if(toggle){
        toggle.textContent='▾ Ocultar';
        toggle.setAttribute('aria-expanded','true');
      }
    }
    dedupeControls();
    return true;
  }

  // V71f: se elimina definitivamente el bloque Excel fijado en el hero.
  // El único punto visible de carga masiva es V70StaffWorkbook dentro del cuerpo.
  function ensureHeroActions(){
    const screen=$('institutional');
    if(!screen)return;
    dedupeControls();
  }

  function ensureImportSection(){
    if(!visibleInstitutional())return;
    const section=$('v64TeacherImport');
    if(!section){
      try{importer()?.decorate?.()}catch(e){console.warn('V69 Excel import decorate',e)}
    }
    dedupeControls();
    if(showSection())return;
    setTimeout(()=>{
      if(!$('v64TeacherImport')){try{importer()?.decorate?.()}catch{}}
      dedupeControls();showSection();
    },120);
  }

  function openImport(){
    ensureImportSection();
    const attempts=[0,120,320,700];
    for(const delay of attempts)setTimeout(()=>{
      ensureImportSection();
      const section=$('v64TeacherImport'),input=$('v64TeacherFile');
      if(section){
        showSection();
        if(delay===320)section.scrollIntoView({behavior:'smooth',block:'start'});
      }
      if(input&&delay===700)input.click();
    },delay);
  }

  function bindObservers(){
    const screen=$('institutional');
    if(screen&&!screenObserver){
      screenObserver=new MutationObserver(()=>schedule());
      screenObserver.observe(screen,{attributes:true,attributeFilter:['class'],childList:true,subtree:false});
    }
    const host=$('v48InstitutionalContent');
    if(host&&host!==observedContent){
      contentObserver?.disconnect();
      observedContent=host;
      contentObserver=new MutationObserver(()=>schedule());
      contentObserver.observe(host,{childList:true,subtree:false});
    }
  }

  function refresh(){
    bindObservers();
    dedupeControls();
    ensureHeroActions();
    if(visibleInstitutional())ensureImportSection();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,80)}
  function burst(){[0,100,260,650,1200].forEach(ms=>setTimeout(refresh,ms))}

  document.addEventListener('click',e=>{
    if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home],[data-v48-panel]'))burst();
  },true);
  window.addEventListener('pci-app-ready',burst);
  document.addEventListener('DOMContentLoaded',burst,{once:true});
  burst();

  const style=document.createElement('style');
  style.textContent=`
    #v69ImportHero.v71f-hidden,#v69ExcelPinned.v71f-hidden{display:none!important}
    #v64TeacherImport .v64-import-actions{display:none!important}
  `;
  document.head.appendChild(style);

  window.PCIVisibilityHotfixV69={refresh,openImport,ensureImportSection,ensureHeroActions,dedupeControls};
})();