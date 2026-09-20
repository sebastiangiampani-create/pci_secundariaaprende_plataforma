(() => {
  const phase2=()=>window.PCIPhase2V28;
  const institutional=()=>window.PCIInstitutionalV48;
  const data=()=>{state.auditV60=state.auditV60||{baselines:{}};return state.auditV60};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function snapshot(){
    const groups=(phase2()?.groups?.()||[]).map(g=>({id:g.id,term:g.term,subjectIds:[...(g.subjectIds||[])].sort()})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const c=institutional()?.orientationConfig?.(state.active)||{};
    const divisions={};for(let y=1;y<=5;y++)divisions[y]=Array.isArray(c.divisionLabels?.[y])?[...c.divisionLabels[y]]:Number(c.courseCounts?.[y])||0;
    return{groups,divisions};
  }
  function report(kind){
    const root=data(),slot=root.baselines[state.active]=root.baselines[state.active]||{},current=snapshot(),previous=slot[kind];
    if(!previous){slot[kind]=current;save();return{changed:false}}
    return{changed:!same(previous,current),previous,current};
  }
  function accept(kind){const root=data(),slot=root.baselines[state.active]=root.baselines[state.active]||{};slot[kind]=snapshot();save();render(kind)}
  function render(kind){
    const host=kind==='phase2'?document.getElementById('proposal'):document.getElementById('v48InstitutionalContent');if(!host)return;
    host.querySelector('.v60-reconcile')?.remove();const r=report(kind);if(!r.changed)return;
    const box=document.createElement('div');box.className='v60-reconcile';box.innerHTML='<strong>Fase 1 cambió.</strong> El desarrollo existente se conserva. Revisá la nueva estructura antes del cierre. <button type="button">Aceptar estructura actual</button>';
    const anchor=kind==='phase2'?host.querySelector('.v28-hero,.hero'):host.firstElementChild;if(anchor)anchor.after(box);else host.prepend(box);box.querySelector('button').onclick=()=>accept(kind);
  }
  const style=document.createElement('style');style.textContent='.v60-reconcile{margin:0 0 14px;padding:12px;border:1px solid #dfc476;border-radius:12px;background:#fff8df;color:#665113;font-size:.66rem}.v60-reconcile button{margin-left:8px;border:1px solid currentColor;border-radius:999px;background:#fff;padding:5px 8px;color:inherit;font-weight:800}';document.head.appendChild(style);
  document.addEventListener('click',e=>{if(e.target.closest('#openProposal,#openInstitutional'))setTimeout(()=>{render('phase2');render('institutional')},120)},true);
  window.PCIReconciliationV60={snapshot,report,accept,render};
})();
