(() => {
  const $id=id=>document.getElementById(id);
  const institutionalApi=()=>window.PCIInstitutionalV48||null;
  const offerApi=()=>window.PCIOfferModelV56||null;
  let renderingInstitutional=false;

  const style=document.createElement('style');
  style.textContent=`
    .v58-partial-note{position:relative;z-index:3;display:block!important;margin:12px 0 14px;padding:11px 13px;border:1px solid #d8c68e;border-radius:12px;background:#fff9e8;color:#675317;font-size:.66rem;line-height:1.45}
    .v58-partial-note strong{font-weight:900}.v58-ready-note{margin:0 0 14px;padding:10px 12px;border-radius:11px;background:var(--mint-soft);color:var(--mint-dark);font-size:.64rem;line-height:1.4}
  `;
  document.head.appendChild(style);

  function currentMap(){
    if(!state?.active||typeof ensure!=='function')return null;
    return ensure(state.active);
  }
  function isValidated(){return !!currentMap()?.valid}

  function panelText(){
    const p=$id('panel')?.querySelector('.hero p');
    if(p)p.textContent='Fase 1, Fase 2 e Implementación institucional pueden trabajarse en paralelo. Si el Mapa de la Oferta todavía está en construcción, las otras capas utilizan la estructura disponible hasta ese momento y señalan lo que falte completar.';
  }

  function unlockPanel(){
    panelText();
    const proposalCard=$id('proposalCard'),proposalButton=$id('openProposal');
    proposalCard?.classList.remove('locked');
    if(proposalButton){proposalButton.disabled=false;proposalButton.textContent='Entrar';}
    const institutionalCard=$id('institutionalCard'),institutionalButton=$id('openInstitutional');
    institutionalCard?.classList.remove('locked');
    if(institutionalButton){
      institutionalButton.disabled=false;
      institutionalButton.textContent='Entrar';
      institutionalButton.onclick=()=>{
        if(typeof window.screen==='function')window.screen('institutional');
        setTimeout(renderInstitutionalPartial,0);
      };
    }
  }

  function proposalNote(){
    const proposal=$id('proposal');if(!proposal)return;
    $id('v58ProposalNote')?.remove();
    if(isValidated())return;
    const note=document.createElement('div');note.id='v58ProposalNote';note.className='v58-partial-note';
    note.innerHTML='<strong>Fase 1 en construcción.</strong> Podés trabajar la Fase 2 con los espacios que ya están definidos. Los contenidos, objetivos y planes cargados se conservan; si después cambia la estructura de Fase 1, la Fase 2 continúa desde la estructura vigente sin borrar el desarrollo ya realizado.';
    const liveHero=proposal.querySelector('#v28home .v28-hero:not([hidden]),#v28board .v28-hero:not([hidden]),#v28matrix .v28-hero:not([hidden])');
    const shell=proposal.querySelector('.v28');
    if(liveHero)liveHero.after(note);
    else if(shell)shell.prepend(note);
    else proposal.prepend(note);
  }

  function institutionalNote(wasValidated){
    const host=$id('v48InstitutionalContent');if(!host)return;
    $id('v58InstitutionalNote')?.remove();
    const note=document.createElement('div');note.id='v58InstitutionalNote';
    if(wasValidated){note.className='v58-ready-note';note.innerHTML='<strong>Fuente:</strong> Implementación institucional toma la estructura actual de Fase 1 y mantiene separada la Fase 2 curricular.';}
    else{note.className='v58-partial-note';note.innerHTML='<strong>Fase 1 en construcción.</strong> La implementación institucional funciona con la información ya disponible. Podés configurar divisiones, docentes, oferta, jornada y disponibilidad; antes de generar el horario completo el sistema avisará qué datos estructurales faltan.';}
    host.prepend(note);
  }

  function patchInstitutionalApi(){
    const api=institutionalApi();if(!api||api.__v58Patched)return api;
    const original=api.renderInstitutional?.bind(api);if(!original)return api;
    api.__v58OriginalRenderInstitutional=original;
    api.renderInstitutional=async function(){
      if(renderingInstitutional)return;
      const map=currentMap();if(!map)return;
      renderingInstitutional=true;
      const wasValidated=!!map.valid;
      if(!wasValidated)map.valid=true;
      try{
        await original();
      }catch(error){
        console.error('V58 institutional render',error);
      }finally{
        map.valid=wasValidated;
        renderingInstitutional=false;
      }
      institutionalNote(wasValidated);
    };
    api.__v58Patched=true;
    return api;
  }

  async function renderInstitutionalPartial(){
    const api=patchInstitutionalApi();
    await api?.renderInstitutional?.();
  }

  function selectedSemester(){return Number($id('v53Semester')?.value)||1}
  function offerConflicts(){
    const api=offerApi(),teachers=Object.values(state?.institutional?.teachers||{}),sem=selectedSemester();
    if(!api?.offer)return[];
    return teachers.map(t=>({teacher:t,offer:api.offer(t.id,sem)})).filter(x=>x.offer?.conflict);
  }
  function renderOfferConflictReport(conflicts){
    const section=$id('v53Scheduler');if(!section)return;
    section.querySelector('.v58-offer-conflict')?.remove();
    const box=document.createElement('div');box.className='v53-report bad v58-offer-conflict';
    box.innerHTML=`<h3>La oferta obligatoria supera el máximo permitido</h3><ul>${conflicts.map(({teacher,offer})=>`<li>${teacher.name}: ${offer.front} HC frente a curso, ${offer.minimumOutside} HC obligatorias fuera de curso. El máximo permitido fuera de curso es ${offer.maxOutside} HC (50 % de la carga frente a curso).</li>`).join('')}</ul>`;
    section.querySelector('.v53-actions')?.after(box);
  }

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-v53-generate],[data-v53-check]');if(!trigger)return;
    const conflicts=offerConflicts();if(!conflicts.length)return;
    e.preventDefault();e.stopImmediatePropagation();renderOfferConflictReport(conflicts);
    toast('Hay docentes cuya planificación obligatoria supera el máximo del 50 %.',true);
  },true);

  const previousRenderPanel=renderPanel;
  renderPanel=function(){previousRenderPanel();setTimeout(()=>{patchInstitutionalApi();unlockPanel()},0)};

  const previousScreen=window.screen;
  if(typeof previousScreen==='function'){
    const wrapped=function(id){
      const result=previousScreen(id);
      if(id==='proposal')setTimeout(proposalNote,20);
      if(id==='institutional')setTimeout(renderInstitutionalPartial,20);
      if(id==='panel')setTimeout(unlockPanel,20);
      return result;
    };
    Object.assign(wrapped,previousScreen);window.screen=wrapped;
  }

  window.addEventListener('pci-app-ready',()=>setTimeout(()=>{patchInstitutionalApi();unlockPanel();proposalNote()},180));
  document.addEventListener('click',e=>{
    if(e.target.closest('#openProposal'))setTimeout(proposalNote,80);
    if(e.target.closest('#openInstitutional'))setTimeout(renderInstitutionalPartial,80);
  },true);

  window.PCIParallelPhasesV58={unlockPanel,proposalNote,renderInstitutionalPartial,offerConflicts,patchInstitutionalApi};
})();
