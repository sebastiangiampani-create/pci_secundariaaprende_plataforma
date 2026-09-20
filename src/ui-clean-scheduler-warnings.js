(()=>{
  const individual=/tiene menos de dos docentes asignados; su planificación queda individual\.?/i;

  function filterReport(report){
    if(!report||!Array.isArray(report.warnings))return report;
    report.warnings=report.warnings.filter(x=>!individual.test(String(x||'')));
    return report;
  }

  function patchApi(){
    const api=window.PCIAnnualSchedulerV68||window.PCIAnnualSchedulerV65;
    if(!api||api.__singleTeacherPatched)return;
    if(typeof api.preflight==='function'){
      const original=api.preflight.bind(api);
      api.preflight=(...args)=>filterReport(original(...args));
    }
    api.__singleTeacherPatched=true;
  }

  function cleanWarnings(root=document){
    root.querySelectorAll?.('.v65-report .warn').forEach(report=>{
      const parts=report.innerHTML.split(/<br\s*\/?>/i).filter(part=>{
        const txt=document.createElement('div');
        txt.innerHTML=part;
        return !individual.test(txt.textContent||'');
      });
      if(parts.length)report.innerHTML=parts.join('<br>');
      else report.remove();
    });
  }

  let timer=null;
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(()=>{patchApi();cleanWarnings();},20);
  }
  function start(){
    patchApi();cleanWarnings();
    if(document.body)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.addEventListener('pci-app-ready',schedule);
  document.addEventListener('click',e=>{if(e.target.closest('[data-v68-check],[data-v68-generate]'))setTimeout(schedule,0)},true);
})();