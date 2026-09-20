(() => {
  let timer=null,wrapped=false,profileTid='';

  function institutional(){
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.teacherProfiles=state.institutional.teacherProfiles||{};
    return state.institutional;
  }

  function wrapSimulation(){
    if(wrapped)return;const api=window.PCIAnnualSchedulerV68;if(!api?.simulateAssignments)return;
    const original=api.simulateAssignments.bind(api);
    api.simulateAssignments=(...args)=>{const result=original(...args);if(result&&result.entries)delete result.entries;return result};
    window.PCIAnnualSchedulerV65=api;wrapped=true;
  }

  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
  function setAttr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value)}

  function labels(){
    // V71d: este módulo observa childList en todo el documento. Reescribir
    // textContent aunque no cambie reemplaza nodos de texto y vuelve a disparar
    // el MutationObserver. Solo mutamos cuando el valor realmente cambia.
    const sub=document.querySelector('#offer .custom-box .subhead');
    setText(sub,'Bilingüe · Extracurricular · otro espacio extra-plan');
    const name=document.getElementById('customName');
    setAttr(name,'placeholder','Nombre de la materia / espacio extra-plan');
    const add=document.getElementById('addCustom');
    setText(add,'Agregar espacio extra-plan');
    document.querySelectorAll('#v48InstitutionalContent .v48-origin.custom').forEach(x=>setText(x,'Extra-plan'));
  }

  function syncProfileFields(){
    if(!profileTid)return;
    const r=institutional(),teacher=r.teachers[profileTid];if(!teacher)return;
    const p=r.teacherProfiles[profileTid]||(r.teacherProfiles[profileTid]={teacherId:profileTid,email:teacher.email||'',targetHours:null,maxHours:null,rules:[]});
    p.rules=Array.isArray(p.rules)?p.rules:[];
    const email=document.getElementById('v68ProfileEmail'),target=document.getElementById('v68ProfileTarget'),max=document.getElementById('v68ProfileMax');
    if(email){p.email=email.value.trim();teacher.email=p.email}
    if(target)p.targetHours=target.value===''?null:Number(target.value);
    if(max)p.maxHours=max.value===''?null:Number(max.value);
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{wrapSimulation();labels()},60)}
  window.addEventListener('pci-app-ready',()=>setTimeout(refresh,1500));
  document.addEventListener('click',e=>{
    const profile=e.target.closest('[data-v68-profile]');if(profile)profileTid=profile.dataset.v68Profile||'';
    if(e.target.closest('[data-v68-add-rule]'))syncProfileFields();
    if(e.target.closest('[data-v68-close],[data-v68-save-profile]')){syncProfileFields();setTimeout(()=>{profileTid=''},0)}
    if(e.target.closest('#openOffer,#openInstitutionalGeneral,#openInstitutional,[data-go="home"]'))setTimeout(refresh,120);
  },true);
  document.addEventListener('input',e=>{if(e.target.matches('#v68ProfileEmail,#v68ProfileTarget,#v68ProfileMax'))syncProfileFields()},true);
  document.addEventListener('change',e=>{if(e.target.matches('#v68ProfileEmail,#v68ProfileTarget,#v68ProfileMax')){syncProfileFields();save()}},true);

  const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{childList:true,subtree:true});
  window.PCIRuntimeFixV68={refresh,syncProfileFields};
})();