(() => {
  const STYLE_ID='pci-nav-consistency-style';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #pciGlobalDock{position:sticky;top:8px;z-index:110;display:flex;justify-content:center;margin:8px auto 18px;pointer-events:none}
      #pciGlobalDock .pci-dock-inner{display:flex;align-items:center;justify-content:center;gap:3px;max-width:min(760px,calc(100vw - 24px));padding:7px 10px;border:1px solid #d7e0e7;border-radius:22px;background:rgba(255,255,255,.97);box-shadow:0 10px 30px rgba(18,57,92,.12);backdrop-filter:blur(12px);overflow-x:auto;scrollbar-width:none;pointer-events:auto}
      #pciGlobalDock .pci-dock-inner::-webkit-scrollbar{display:none}
      #pciGlobalDock button{flex:0 0 auto;min-height:44px;padding:8px 14px;border:0;border-radius:999px;background:transparent;color:#12395c;font:800 .72rem/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:7px}
      #pciGlobalDock button:hover{background:#eef4f7}#pciGlobalDock button.is-active{background:#12395c;color:#fff}
      #pciGlobalDock .pci-dock-icon{font-size:1rem;font-weight:900;line-height:1}#pciGlobalDock[hidden],#pciGlobalDock button[hidden]{display:none!important}
      #panel .phase-grid>#institutionalCard,#panel #v71LeanPanelEntry{display:none!important}
      #institutional>.back,#institutional>.pci-backbar,#offer>.back,#offer>.pci-backbar{display:none!important}
      #proposal [id="v28panel"],#proposal>.back,#proposal>.pci-backbar{display:none!important}
      #proposal #v28back,#proposal #v28mback,#proposal #v28err{display:inline-flex!important;align-items:center!important;gap:6px!important;min-height:38px!important;padding:8px 12px!important;margin:0 0 10px!important;border:1px solid #cfd9e1!important;border-radius:999px!important;background:#fff!important;color:#12395c!important;font-weight:850!important;box-shadow:0 4px 12px rgba(18,57,92,.06)!important}
      #proposal{padding-top:0!important}
      #proposal>.hero{display:none!important}
      #proposal>h2#proposalTitle:empty,#proposal>#proposalTitle:empty{display:none!important;margin:0!important;padding:0!important;height:0!important;min-height:0!important}
      #proposal>.card:empty,#proposal>.panel:empty,#proposal>.card.panel:has(> #proposalTitle:empty):not(:has(:not(#proposalTitle))){display:none!important;margin:0!important;padding:0!important;height:0!important;min-height:0!important;border:0!important}
      .screen>.back{display:none!important}
      @media(max-width:760px){
        body{padding-bottom:76px}
        #pciGlobalDock{position:fixed;top:auto;left:0;right:0;bottom:8px;margin:0;z-index:150;padding:0 8px}
        #pciGlobalDock .pci-dock-inner{width:100%;max-width:none;justify-content:space-around;border-radius:20px;padding:6px;box-sizing:border-box}
        #pciGlobalDock button{min-height:48px;padding:9px 11px;font-size:.68rem}
        #pciGlobalDock .pci-dock-icon{font-size:1.05rem}
      }
    `;document.head.appendChild(style);
  }

  const visible=el=>!!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  const sectionVisible=id=>visible(document.getElementById(id));
  function goHome(){window.screen?.('home')}
  function goOffer(){window.screen?.('offer')}
  function goProposal(){window.screen?.('proposal');setTimeout(()=>document.getElementById('v28home')?.removeAttribute('hidden'),0)}
  function goManagement(){
    window.screen?.('institutional');
    setTimeout(()=>{const open=document.querySelector('[data-v71n-open],#v71LeanPanelEntry button,#institutional [data-open-management]');if(open)open.click()},60);
  }
  function currentScreen(){
    if(sectionVisible('home'))return'home';
    if(sectionVisible('offer'))return'offer';
    if(sectionVisible('proposal'))return'proposal';
    if(sectionVisible('institutional'))return'institutional';
    if(sectionVisible('panel'))return'panel';
    return'';
  }
  function ensureDock(){
    let dock=document.getElementById('pciGlobalDock');
    if(!dock){
      dock=document.createElement('nav');dock.id='pciGlobalDock';dock.setAttribute('aria-label','Navegación principal');
      dock.innerHTML=`<div class="pci-dock-inner">
        <button type="button" data-dock="home"><span class="pci-dock-icon">⌂</span><span>Inicio</span></button>
        <button type="button" data-dock="offer"><span class="pci-dock-icon">◇</span><span>Mapa de la Oferta</span></button>
        <button type="button" data-dock="proposal"><span class="pci-dock-icon">△</span><span>Desarrollo Curricular</span></button>
        <button type="button" data-dock="institutional"><span class="pci-dock-icon">▦</span><span>Gestión</span></button>
      </div>`;
      const header=document.querySelector('header');
      if(header?.parentNode)header.insertAdjacentElement('afterend',dock);else document.body.prepend(dock);
      dock.querySelector('[data-dock="home"]').onclick=goHome;
      dock.querySelector('[data-dock="offer"]').onclick=goOffer;
      dock.querySelector('[data-dock="proposal"]').onclick=goProposal;
      dock.querySelector('[data-dock="institutional"]').onclick=goManagement;
    }
    const current=currentScreen();
    const curricular=current==='panel'||current==='offer'||current==='proposal';
    const management=current==='institutional';
    dock.hidden=!(curricular||management);

    const offer=dock.querySelector('[data-dock="offer"]');
    const proposal=dock.querySelector('[data-dock="proposal"]');
    const institutional=dock.querySelector('[data-dock="institutional"]');

    if(offer)offer.hidden=management;
    if(proposal)proposal.hidden=management;
    if(institutional)institutional.hidden=curricular;

    dock.querySelectorAll('[data-dock]').forEach(b=>b.classList.toggle('is-active',b.dataset.dock===current));
  }
  function refresh(){ensureDock()}
  document.addEventListener('click',()=>setTimeout(refresh,0),true);
  window.addEventListener('popstate',refresh);
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(refresh,40)});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style','class']});
  setTimeout(refresh,0);
  window.PCINavigation={goHome,goOffer,goProposal,goManagement,refresh};
})();