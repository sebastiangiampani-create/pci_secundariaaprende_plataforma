(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);
  const SOCIAL3=['Historia','Geografía','Formación Ética y Ciudadana','Economía'];

  const style=document.createElement('style');
  style.textContent=`
    .social-choice-chip{cursor:pointer!important}
    .social-choice-chip:after{content:''}
    .placed.social-swap-ready{outline:2px solid var(--mint-dark);background:var(--mint-soft)!important}
  `;
  document.head.appendChild(style);

  function option(){
    const m=current();
    if(!['A','B'].includes(m.socialOption))m.socialOption='A';
    return m.socialOption;
  }

  function subject(id){return byId(id)}
  function isCoreSocial(id){const s=subject(id);return !!s&&s.origin==='FG'&&s.year===3&&SOCIAL3.includes(s.name)}
  function canonicalIds(){return SOCIAL3.map(name=>fg().find(s=>s.origin==='FG'&&s.year===3&&s.name===name)?.id).filter(Boolean)}
  function unique(a){return [...new Set(a)]}
  function p(){return current().placements}
  function nonCore(ids){return (ids||[]).filter(id=>!isCoreSocial(id))}
  function presentCore(){
    return unique(['socialA-c5','socialA-c6','socialB-c5','socialB-c6'].flatMap(slot=>p()[slot]||[]).filter(isCoreSocial));
  }

  function setPair(group,ids){
    for(const term of [5,6]){
      const slot=`social${group}-c${term}`;
      const extras=nonCore(p()[slot]);
      p()[slot]=unique([...extras,...ids]);
    }
  }

  function choose(next){
    if(!['A','B'].includes(next)||next===option())return;
    const present=presentCore();
    const canonical=canonicalIds().filter(id=>present.includes(id));

    if(next==='B'){
      current().socialOption='B';
      // Si las cuatro materias ya estaban prearmadas juntas, la opción 12 las
      // transforma automáticamente en dos pares iniciales, que luego pueden permutarse.
      const first=canonical.slice(0,2),second=canonical.slice(2);
      setPair('A',first);
      setPair('B',second);
    }else{
      // Al volver a 10 laboratorios se reúnen las cuatro materias sin perder
      // articulaciones adicionales que estuvieran en el segundo laboratorio.
      const extrasB5=nonCore(p()['socialB-c5']),extrasB6=nonCore(p()['socialB-c6']);
      current().socialOption='A';
      setPair('A',canonical);
      p()['socialA-c5']=unique([...(p()['socialA-c5']||[]),...extrasB5]);
      p()['socialA-c6']=unique([...(p()['socialA-c6']||[]),...extrasB6]);
      p()['socialB-c5']=[];
      p()['socialB-c6']=[];
    }
    current().valid=false;
    save();
    renderOffer();
    toast(next==='A'?'Sociales: Opción 10 laboratorios. Las cuatro materias quedaron reunidas.':'Sociales: Opción 12 laboratorios. Se generó un 2 + 2 inicial; podés intercambiar las materias entre ambos laboratorios.');
  }

  function group(slot){const m=String(slot||'').match(/^social([AB])-c([56])$/);return m?m[1]:null}
  function replace(arr,from,to){const out=[...(arr||[])],i=out.indexOf(from);if(i>=0)out[i]=to;return unique(out)}

  function swapSocial(fromSlot,sourceId,toSlot,targetId){
    const fromGroup=group(fromSlot),toGroup=group(toSlot);
    if(option()!=='B'||!fromGroup||!toGroup||fromGroup===toGroup||!isCoreSocial(sourceId)||!isCoreSocial(targetId))return false;
    for(const term of [5,6]){
      const a=`social${fromGroup}-c${term}`,b=`social${toGroup}-c${term}`;
      p()[a]=replace(p()[a],sourceId,targetId);
      p()[b]=replace(p()[b],targetId,sourceId);
    }
    current().valid=false;save();renderOffer();
    toast(`${subject(sourceId).name} y ${subject(targetId).name} intercambiaron agrupamiento en C5 y C6.`);
    return true;
  }

  function decodeMove(raw){
    if(!raw||!raw.startsWith('move:'))return null;
    const rest=raw.slice(5),i=rest.indexOf(':');
    if(i<0)return null;
    return{from:decodeURIComponent(rest.slice(0,i)),id:decodeURIComponent(rest.slice(i+1))};
  }

  function moveToSocialGroup(fromSlot,toSlot,id){
    const a=group(fromSlot),b=group(toSlot);
    if(option()!=='B'||!a||!b||a===b||!isCoreSocial(id))return false;
    const targetIds=(p()[`social${b}-c5`]||[]).filter(isCoreSocial);
    if(targetIds.length>=2){
      const box=$id('validation');
      if(box){box.className='validation rule-block';box.innerHTML='<strong>Intercambio entre agrupamientos</strong>Ese laboratorio ya tiene dos materias. Soltá la materia directamente sobre la materia con la que querés intercambiarla.'}
      toast('Soltala sobre una materia del otro agrupamiento para intercambiarlas.',true);
      return true;
    }
    for(const term of [5,6]){
      const src=`social${a}-c${term}`,dst=`social${b}-c${term}`;
      p()[src]=(p()[src]||[]).filter(x=>x!==id);
      p()[dst]=unique([...(p()[dst]||[]),id]);
    }
    current().valid=false;save();renderOffer();toast(`${subject(id).name} pasó al otro agrupamiento en C5 y C6.`);return true;
  }

  function bindDesktopSwaps(matrix){
    matrix.querySelectorAll('.placed[data-map-id][data-from^="social"]').forEach(card=>{
      const targetId=card.dataset.mapId,targetSlot=card.dataset.from;
      if(!isCoreSocial(targetId))return;
      card.ondragover=e=>{
        const mv=decodeMove(e.dataTransfer?.getData('text/plain')||'');
        if(mv&&group(mv.from)&&group(mv.from)!==group(targetSlot)&&isCoreSocial(mv.id)){e.preventDefault();e.stopPropagation();card.classList.add('social-swap-ready')}
      };
      card.ondragleave=e=>{e.stopPropagation();card.classList.remove('social-swap-ready')};
      card.ondrop=e=>{
        const mv=decodeMove(e.dataTransfer?.getData('text/plain')||'');
        if(!mv)return;
        if(swapSocial(mv.from,mv.id,targetSlot,targetId)){e.preventDefault();e.stopPropagation();card.classList.remove('social-swap-ready')}
      };
    });
  }

  function bindTouchSwaps(matrix){
    matrix.querySelectorAll('.placed[data-map-id][data-from^="social"] .map-grip').forEach(grip=>{
      const card=grip.closest('.placed'),id=card?.dataset.mapId,from=card?.dataset.from;
      if(!card||!isCoreSocial(id)||!group(from))return;
      grip.onpointerdown=e=>{
        if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
        e.preventDefault();e.stopPropagation();
        const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=subject(id)?.name||id;document.body.appendChild(ghost);
        const move=ev=>{ghost.style.left=`${ev.clientX}px`;ghost.style.top=`${ev.clientY}px`};
        const cleanup=()=>{ghost.remove();grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',cancel)};
        const up=ev=>{
          const under=document.elementFromPoint(ev.clientX,ev.clientY),targetCard=under?.closest('.placed[data-map-id][data-from^="social"]'),targetDrop=under?.closest('[data-slot^="social"]');
          cleanup();
          if(targetCard&&swapSocial(from,id,targetCard.dataset.from,targetCard.dataset.mapId))return;
          if(targetDrop&&moveToSocialGroup(from,targetDrop.dataset.slot,id))return;
          toast('Para cambiar de agrupamiento, soltá la materia en el otro laboratorio.');
        };
        const cancel=()=>cleanup();move(e);grip.setPointerCapture?.(e.pointerId);grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',cancel);
      };
    });
  }

  function decorate(){
    document.querySelectorAll('.social-choice-chip[data-choice]').forEach(button=>{
      button.draggable=false;
      button.removeAttribute('title');
      button.onclick=e=>{e.preventDefault();e.stopPropagation();choose(button.dataset.choice)};
    });
    const matrix=$id('matrix');if(!matrix)return;
    bindDesktopSwaps(matrix);bindTouchSwaps(matrix);

    // Si se suelta sobre la celda del otro agrupamiento y hay lugar, se mueve.
    if(matrix.__v24SocialCapture)matrix.removeEventListener('drop',matrix.__v24SocialCapture,true);
    const capture=e=>{
      const mv=decodeMove(e.dataTransfer?.getData('text/plain')||'');if(!mv||!isCoreSocial(mv.id))return;
      const targetCard=e.target.closest('.placed[data-map-id][data-from^="social"]');
      if(targetCard&&swapSocial(mv.from,mv.id,targetCard.dataset.from,targetCard.dataset.mapId)){e.preventDefault();e.stopImmediatePropagation();return}
      const target=e.target.closest('[data-slot^="social"]');
      if(target&&moveToSocialGroup(mv.from,target.dataset.slot,mv.id)){e.preventDefault();e.stopImmediatePropagation()}
    };
    matrix.__v24SocialCapture=capture;matrix.addEventListener('drop',capture,true);
  }

  const previousRenderOffer=renderOffer;
  renderOffer=function(){previousRenderOffer();decorate()};

  const modal=$id('rulesModal');
  if(modal){
    const rule=document.createElement('div');rule.className='rule';
    rule.innerHTML='<strong>Sociales de 3.º · cambio de opción:</strong> los botones 10/12 laboratorios pueden cambiarse aunque las materias ya estén ubicadas. Al pasar a 12 se genera un 2+2 inicial. Las materias de ambos agrupamientos pueden intercambiarse arrastrando una directamente sobre otra; el cambio se replica en C5 y C6.';
    modal.querySelector('.modal-box')?.appendChild(rule);
  }
})();
