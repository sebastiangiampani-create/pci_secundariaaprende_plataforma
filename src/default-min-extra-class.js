(()=>{
  let timer=null,running=false;
  const offerApi=()=>window.PCIAnnualOfferV65||null;
  function root(){
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    return state.institutional;
  }
  function applyMinimums(){
    if(running)return;
    const api=offerApi();if(!api?.offer)return;
    running=true;
    try{
      let changed=false;
      for(const t of Object.values(root().teachers||{})){
        const o=api.offer(t.id);if(!o||!(Number(o.front)>0)||o.conflict)continue;
        const hasManual=t.offerAnnualPct!==null&&t.offerAnnualPct!==undefined&&t.offerAnnualPct!=='';
        const autoFlag=t.__autoMinimumOutside===true;
        if(!hasManual||autoFlag){
          const next=Number(Number(o.minPct||0).toFixed(2));
          if(Number(t.offerAnnualPct)!==next||!autoFlag){t.offerAnnualPct=next;t.__autoMinimumOutside=true;changed=true}
        }
      }
      if(changed){save();try{api.render?.()}catch(e){console.warn('auto minimum render',e)}}
    }finally{running=false}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(applyMinimums,120)}
  document.addEventListener('change',e=>{if(e.target.closest('[data-v71o-assignment],[data-v48-assignment]'))schedule()},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(applyMinimums,900));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional,#openInstitutionalGeneral,[data-v71n-open]'))setTimeout(applyMinimums,500)},true);
  setTimeout(applyMinimums,1400);
  window.PCIAutoMinimumExtraClass={applyMinimums};
})();