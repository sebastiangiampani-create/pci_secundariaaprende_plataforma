(() => {
  let observer=null;
  const $id=id=>document.getElementById(id);

  function addModeBanner(){
    const screen=$id('institutional');
    if(!screen||!screen.classList.contains('active'))return;
    const hero=screen.querySelector('.hero');
    if(!hero||hero.querySelector('[data-v51-preview-banner]'))return;
    const note=document.createElement('div');
    note.dataset.v51PreviewBanner='1';
    note.style.cssText='margin-top:12px;padding:10px 12px;border:1px dashed #8aa9bd;border-radius:10px;background:#f4f8fb;color:#12395c;font-size:.68rem;line-height:1.4';
    note.innerHTML='<strong>Modo prueba V51.</strong> La Fase 3 está habilitada para explorar aunque Fase 1 todavía no esté validada. Todo lo que cargues acá queda en el almacenamiento aislado de esta preview y no modifica la V47 estable.';
    hero.appendChild(note);
  }

  function enablePhase3(){
    const card=$id('institutionalCard'),button=$id('openInstitutional');
    if(!card||!button)return;
    card.classList.remove('locked');
    button.disabled=false;
    button.textContent='Entrar · modo prueba';
    button.onclick=()=>{
      try{
        const map=typeof ensure==='function'&&state?.active?ensure(state.active):null;
        if(map&&!map.valid){map.__previewPhase3Bypass=true;map.valid=true;}
      }catch(_){ }
      if(typeof window.screen==='function')window.screen('institutional');
      setTimeout(()=>{
        try{window.PCIInstitutionalV48?.renderInstitutional?.()}catch(_){ }
        addModeBanner();
      },80);
    };
  }

  function refresh(){
    enablePhase3();
    addModeBanner();
  }

  window.addEventListener('pci-app-ready',()=>{
    setTimeout(refresh,80);
    const panel=$id('panel');
    if(panel&&!observer){
      observer=new MutationObserver(()=>setTimeout(refresh,0));
      observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
    }
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-pci],.pci-card,.back,#openInstitutional'))setTimeout(refresh,80);
  },true);
  window.PCIPreviewPhase3V51={refresh};
})();
