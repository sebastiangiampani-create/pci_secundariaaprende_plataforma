(() => {
  const api=()=>window.PCIPhase2V28||null;
  let observer=null,timer=null;

  function isOther(){
    const a=api(),id=a?.getTargetGroup?.(),g=id?a?.gb?.(id):null;
    return g?.area==='Otros formatos pedagógicos';
  }
  function neutralize(){
    if(!isOther())return;
    const list=document.getElementById('v28list');
    if(list)list.innerHTML='<div class="v28-empty">Este espacio no levanta contenidos oficiales de Tutoría. Los contenidos propios se desarrollan manualmente en cada propuesta.</div>';
    const count=document.getElementById('v28count');if(count)count.textContent='0 seleccionados';
    const assign=document.getElementById('v28assign');if(assign)assign.disabled=true;
    const coverage=document.getElementById('v47coverageCount');if(coverage)coverage.textContent='Sin bolsa oficial de Tutoría asociada';
    const bar=document.getElementById('v47coverageBar');if(bar)bar.style.width='0%';
    const meta=document.getElementById('v28meta');if(meta)meta.textContent='Otros formatos pedagógicos · contenidos de desarrollo manual';
    const tabs=document.querySelector('#v28board .v28-tabs');if(tabs)tabs.style.display='none';
    const filters=document.querySelector('#v28board .v28-filters');if(filters)filters.style.display='none';
  }
  function patchApi(){
    const a=api();if(!a||a.__v71NoTutoria)return;
    const basePool=a.getPool?.bind(a),baseArea=a.getAreaPool?.bind(a),baseCoverage=a.getCoverage?.bind(a);
    if(basePool)a.getPool=area=>area==='Otros formatos pedagógicos'?[]:basePool(area);
    if(baseArea)a.getAreaPool=area=>area==='Otros formatos pedagógicos'?[]:baseArea(area);
    if(baseCoverage)a.getCoverage=area=>area==='Otros formatos pedagógicos'?{used:new Set(),total:0,percent:0}:baseCoverage(area);
    a.__v71NoTutoria=true;
  }
  function patchNotice(){
    document.querySelectorAll('.notice').forEach(n=>{
      if(n.textContent.includes('Otros formatos pedagógicos utiliza la bolsa de contenidos priorizados de Tutoría'))n.innerHTML=n.innerHTML.replace('Otros formatos pedagógicos utiliza la bolsa de contenidos priorizados de Tutoría.','Otros formatos pedagógicos no levanta una bolsa oficial de Tutoría: sus contenidos se desarrollan manualmente en cada espacio.');
    });
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{patchApi();patchNotice();neutralize()},35)}
  function start(){patchApi();patchNotice();refresh();const proposal=document.getElementById('proposal');if(proposal&&!observer){observer=new MutationObserver(refresh);observer.observe(proposal,{childList:true,subtree:true})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,350));
  document.addEventListener('click',e=>{if(e.target.closest('#openProposal,[data-area],.v28-group,[data-mg],#v28back,#v28mback'))setTimeout(refresh,60)},true);
  window.PCINoTutoriaContentsV71={refresh,isOther};
})();