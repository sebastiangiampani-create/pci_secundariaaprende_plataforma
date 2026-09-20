(() => {
  const work=()=>window.PCIInstitutionalWorkV53||null;
  const offerApi=()=>window.PCIOfferModelV56||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function patchScheduler(){
    const w=work(),api=offerApi();
    if(!w||!api?.syntheticOutsideRows)return;
    w.outsideRows=sem=>api.syntheticOutsideRows(Number(sem)||1);
    w.__v56Patched=true;
    w.__v63OfferPatched=true;
  }

  function conflictRows(){
    const api=offerApi();
    if(!api?.offer)return[];
    const sem=Number(document.getElementById('v53Semester')?.value)||1;
    return Object.values(state?.institutional?.teachers||{})
      .map(teacher=>({teacher,offer:api.offer(teacher.id,sem)}))
      .filter(x=>x.offer?.conflict);
  }

  function fixConflictCopy(){
    document.querySelectorAll('.v58-offer-conflict').forEach(box=>{
      if(box.dataset.v63Fixed==='1')return;
      const conflicts=conflictRows();
      if(!conflicts.length){box.remove();return;}
      box.dataset.v63Fixed='1';
      box.innerHTML=`<h3>La oferta obligatoria supera el máximo permitido</h3><ul>${conflicts.map(({teacher,offer})=>`<li>${esc(teacher.name)}: ${offer.front} HC frente a curso, ${offer.minimumOutside} HC obligatorias fuera de curso. El máximo permitido fuera de curso es ${offer.maxOutside} HC, equivalente al 50 % de la carga total.</li>`).join('')}</ul>`;
    });
  }

  patchScheduler();
  const observer=new MutationObserver(()=>{patchScheduler();fixConflictCopy()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pci-app-ready',()=>setTimeout(()=>{patchScheduler();fixConflictCopy()},120));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional,[data-v53-check],[data-v53-generate]'))setTimeout(()=>{patchScheduler();fixConflictCopy()},40)},true);
  window.PCIOfferRuntimeFixV63={patchScheduler,fixConflictCopy};
})();
