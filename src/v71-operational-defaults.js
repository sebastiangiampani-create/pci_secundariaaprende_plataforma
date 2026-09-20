(() => {
  state.institutional=state.institutional||{};
  state.institutional.planningPolicy={...(state.institutional.planningPolicy||{}),threePlus:'two-per-team',closedByV71:true};

  function apply(){
    const r=state.institutional=state.institutional||{};
    r.planningPolicy={...(r.planningPolicy||{}),threePlus:'two-per-team',closedByV71:true};
    r.planningOverrides=r.planningOverrides||{};
    const staff=window.PCIStaffPlanningV68;if(!staff?.teacherPlanning)return;
    for(const teacher of Object.values(r.teachers||{})){
      const p=staff.teacherPlanning(teacher.id,r.assignments||{});if(!p||p.count<3)continue;
      const byTeam={};for(const team of p.teams||[])byTeam[team.id]=2;
      r.planningOverrides[teacher.id]={...(r.planningOverrides[teacher.id]||{}),byTeam,validated:true,policy:'two-per-team'};
    }
    save();staff.decorate?.();
    const manual=document.querySelector('[data-v71-policy="manual"]');if(manual)manual.style.display='none';
    const auto=document.querySelector('[data-v71-policy="two-per-team"]');if(auto){auto.textContent='Regla vigente · 2 HC por equipo para 3+';auto.disabled=true}
    setTimeout(()=>window.PCIInstitutionalAccordionV69?.refresh?.(),80);
  }

  document.addEventListener('click',e=>{if(e.target.closest('[data-v71-policy="manual"]')){e.preventDefault();e.stopImmediatePropagation();toast('La regla institucional V71 queda fijada en 2 HC por equipo para docentes que integran 3 o más equipos.')}},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(apply,1850));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(apply,500)},true);
  window.PCIOperationalDefaultsV71={apply};
})();