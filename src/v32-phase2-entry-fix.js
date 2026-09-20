(() => {
  const $id=id=>document.getElementById(id);

  function ensureProposalAnchor(){
    const proposal=$id('proposal');
    if(!proposal)return;
    let title=$id('proposalTitle');
    if(!title){
      title=document.createElement('h1');
      title.id='proposalTitle';
      title.hidden=true;
      title.setAttribute('aria-hidden','true');
      proposal.prepend(title);
    }
  }

  function fixButtons(){
    ensureProposalAnchor();
    const card=$id('proposalCard');
    const button=$id('openProposal');
    if(card)card.classList.remove('locked');
    if(button){
      button.disabled=false;
      // No reemplazamos el onclick instalado por V28: esa función es la que
      // abre la interfaz Matriz PCI y ejecuta su render propio.
      if(!button.onclick){
        button.onclick=()=>{
          ensureProposalAnchor();
          if(typeof screen==='function')screen('proposal');
        };
      }
    }
  }

  // V28 reemplaza el contenido de #proposal durante su instalación y, al
  // hacerlo, eliminaba proposalTitle. El screen() base intenta actualizar ese
  // nodo antes de mostrar Fase 2 y fallaba con null.textContent. Restauramos el
  // ancla una vez terminada toda la inicialización.
  const previousInit=window.__pciBaseInit;
  if(typeof previousInit==='function'){
    window.__pciBaseInit=async function(){
      await previousInit();
      ensureProposalAnchor();
      fixButtons();
    };
  }else{
    setTimeout(()=>{ensureProposalAnchor();fixButtons()},0);
  }

  // Cada regreso al panel puede volver a tocar el estado del botón.
  const previousRenderPanel=renderPanel;
  renderPanel=function(){
    previousRenderPanel();
    setTimeout(fixButtons,0);
  };
})();
