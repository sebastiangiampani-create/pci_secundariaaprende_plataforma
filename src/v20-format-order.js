(() => {
  const $id = id => document.getElementById(id);
  const current = () => ensure(state.active);

  const style = document.createElement('style');
  style.textContent = `
    .fo-format-badge{display:inline-flex;align-items:center;gap:4px;margin:4px 0 5px;padding:5px 7px;border-radius:7px;border:1px solid var(--line);font-size:.5rem;font-weight:900;cursor:grab;touch-action:none;user-select:none;background:#fff}
    .fo-format-badge.lab{background:var(--mint-soft);border-color:#9edfd7;color:var(--mint-dark)}
    .fo-format-badge.taller{background:var(--band);color:var(--ink)}
    .fo-format-badge:before{content:'⠿';font-weight:900}
    .fo-format-note{width:100%;font-size:.6rem;line-height:1.35;color:var(--muted);font-weight:700}
  `;
  document.head.appendChild(style);

  const groups = {
    n3:['foN3-c5','foN3-c6'],
    n4:['foN4-c7','foN4-c8'],
    n5:['foLab5-c9','foTaller5-c9','foLab5-c10','foTaller5-c10']
  };

  function groupOf(slot){
    return Object.entries(groups).find(([,slots])=>slots.includes(slot))?.[0] || null;
  }

  function ensureDefaults(){
    const m=current();
    m.foTypes=m.foTypes||{'3':{},'4':{}};
    if(!m.foTypes['3'])m.foTypes['3']={};
    if(!m.foTypes['4'])m.foTypes['4']={};
    if(!m.foTypes['3']['5']&&!m.foTypes['3']['6']){
      m.foTypes['3']['5']='lab';
      m.foTypes['3']['6']='taller';
    }
    if(!m.foTypes['4']['7']&&!m.foTypes['4']['8']){
      m.foTypes['4']['7']='lab';
      m.foTypes['4']['8']='taller';
    }
    m.foTypes5=m.foTypes5||{};
    const defaults={
      'foLab5-c9':'lab',
      'foTaller5-c9':'taller',
      'foLab5-c10':'lab',
      'foTaller5-c10':'taller'
    };
    for(const [slot,type] of Object.entries(defaults))if(!m.foTypes5[slot])m.foTypes5[slot]=type;
  }

  function getType(slot){
    ensureDefaults();
    if(slot.startsWith('foN3-c'))return current().foTypes['3'][slot.split('-c')[1]];
    if(slot.startsWith('foN4-c'))return current().foTypes['4'][slot.split('-c')[1]];
    return current().foTypes5[slot];
  }

  function setType(slot,type){
    if(slot.startsWith('foN3-c'))current().foTypes['3'][slot.split('-c')[1]]=type;
    else if(slot.startsWith('foN4-c'))current().foTypes['4'][slot.split('-c')[1]]=type;
    else current().foTypes5[slot]=type;
  }

  function blocked(message){
    const box=$id('validation');
    if(box){box.className='validation rule-block';box.innerHTML='<strong>Acción no permitida</strong>'+esc(message)}
    toast(message,true);
  }

  function swapFormat(source,target){
    const gs=groupOf(source),gt=groupOf(target);
    if(!gs||gs!==gt){
      blocked('Los formatos solo pueden reordenarse dentro del mismo nivel.');
      return;
    }
    if(source===target)return;
    const a=getType(source),b=getType(target);
    if(!a||!b)return;
    setType(source,b);
    setType(target,a);
    current().valid=false;
    save();
    renderOffer();
    if(gs==='n3')toast('Nivel 3 reordenado: se mantiene exactamente 1 Laboratorio + 1 Taller.');
    else if(gs==='n4')toast('Nivel 4 reordenado: se mantiene exactamente 1 Laboratorio + 1 Taller.');
    else toast('Nivel 5 reordenado: se mantienen exactamente 2 Laboratorios + 2 Talleres.');
  }

  function bindTouchFormat(el,slot){
    el.onpointerdown=e=>{
      if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
      e.preventDefault();
      const ghost=document.createElement('div');
      ghost.className='drag-ghost';
      ghost.textContent=getType(slot)==='lab'?'Laboratorio':'Taller';
      document.body.appendChild(ghost);
      const move=ev=>{ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'};
      const cleanup=()=>{ghost.remove();el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel)};
      const up=ev=>{
        const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot]');
        cleanup();
        if(target)swapFormat(slot,target.dataset.slot);
      };
      const cancel=()=>cleanup();
      move(e);
      el.setPointerCapture?.(e.pointerId);
      el.addEventListener('pointermove',move);
      el.addEventListener('pointerup',up);
      el.addEventListener('pointercancel',cancel);
    };
  }

  const v19RowDefs=rowDefs;
  rowDefs=function(){
    ensureDefaults();
    const rows=v19RowDefs();
    return rows.map(r=>{
      if(r.k==='foN3')return {...r,l:'Formación Orientada · Nivel 3'};
      if(r.k==='foN4')return {...r,l:'Formación Orientada · Nivel 4'};
      if(r.k==='foLab5')return {...r,l:'Formación Orientada · Nivel 5 · Espacio A'};
      if(r.k==='foTaller5')return {...r,l:'Formación Orientada · Nivel 5 · Espacio B'};
      return r;
    });
  };

  const v19Label=label;
  label=function(k,t){
    if(k==='foN3'||k==='foN4')return 'C'+t;
    if(k==='foLab5')return 'Espacio A · C'+t;
    if(k==='foTaller5')return 'Espacio B · C'+t;
    return v19Label(k,t);
  };

  function decorateFormats(){
    ensureDefaults();
    const matrix=$id('matrix');
    if(!matrix)return;
    const slots=[...groups.n3,...groups.n4,...groups.n5];
    for(const slot of slots){
      const drop=matrix.querySelector('[data-slot="'+slot+'"]');
      if(!drop)continue;
      const type=getType(slot);
      let badge=drop.querySelector('.fo-format-badge');
      if(!badge){
        badge=document.createElement('div');
        const strong=drop.querySelector('strong');
        if(strong)strong.insertAdjacentElement('afterend',badge);else drop.prepend(badge);
      }
      badge.className='fo-format-badge '+type;
      badge.textContent=type==='lab'?'LABORATORIO':'TALLER';
      badge.draggable=true;
      badge.dataset.foFormatSource=slot;
      badge.ondragstart=e=>{
        e.stopPropagation();
        e.dataTransfer.setData('text/plain','fo-format:'+encodeURIComponent(slot));
      };
      bindTouchFormat(badge,slot);
    }

    if(matrix.__v20DropCapture)matrix.removeEventListener('drop',matrix.__v20DropCapture,true);
    const capture=e=>{
      const raw=e.dataTransfer?.getData('text/plain')||'';
      if(!raw.startsWith('fo-format:'))return;
      const target=e.target.closest('[data-slot]');
      if(!target)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const source=decodeURIComponent(raw.slice(10));
      swapFormat(source,target.dataset.slot);
    };
    matrix.__v20DropCapture=capture;
    matrix.addEventListener('drop',capture,true);
  }

  const v19RenderMatrix=renderMatrix;
  renderMatrix=function(){
    ensureDefaults();
    v19RenderMatrix();
    decorateFormats();
  };

  function tidyPalette(){
    const box=$id('compositionPalette');
    if(!box)return;
    box.querySelectorAll('[data-format]').forEach(el=>el.remove());
    const hint=box.querySelector('.hint');
    if(hint)hint.textContent='Definición institucional de Sociales de 3.º:';
    let note=box.querySelector('.fo-format-note');
    if(!note){note=document.createElement('div');note.className='fo-format-note';box.appendChild(note)}
    note.textContent='Formación Orientada ya aparece con una distribución válida de referencia. Arrastrá las etiquetas LABORATORIO/TALLER dentro de cada nivel para cambiar el orden sin romper la cantidad prescripta.';
  }

  const v19RenderOffer=renderOffer;
  renderOffer=function(){
    ensureDefaults();
    v19RenderOffer();
    tidyPalette();
  };

  const v19ValidateOffer=validateOffer;
  validateOffer=function(){
    ensureDefaults();
    const n3=groups.n3.map(getType),n4=groups.n4.map(getType),n5=groups.n5.map(getType);
    const validPair=arr=>arr.filter(x=>x==='lab').length===1&&arr.filter(x=>x==='taller').length===1;
    const valid5=n5.filter(x=>x==='lab').length===2&&n5.filter(x=>x==='taller').length===2;
    if(!validPair(n3)){blocked('Nivel 3 debe conservar exactamente 1 Laboratorio y 1 Taller.');return}
    if(!validPair(n4)){blocked('Nivel 4 debe conservar exactamente 1 Laboratorio y 1 Taller.');return}
    if(!valid5){blocked('Nivel 5 debe conservar exactamente 2 Laboratorios y 2 Talleres.');return}
    v19ValidateOffer();
  };

  const modal=$id('rulesModal');
  if(modal){
    const rules=[...modal.querySelectorAll('.rule')];
    const foRule=rules.find(r=>r.textContent.includes('Formación Orientada:'));
    if(foRule)foRule.innerHTML='<strong>Formación Orientada:</strong> la matriz presenta inicialmente una distribución válida: Nivel 3 C5 Laboratorio/C6 Taller; Nivel 4 C7 Laboratorio/C8 Taller; Nivel 5 un Laboratorio + un Taller en C9 y un Laboratorio + un Taller en C10. Es una presentación inicial, no una imposición de orden. Las etiquetas de formato se pueden reordenar por drag & drop dentro del mismo nivel. El motor conserva siempre 1+1 en Nivel 3, 1+1 en Nivel 4 y 2+2 en Nivel 5.';
    const dragRule=rules.find(r=>r.textContent.includes('Drag & drop:'));
    if(dragRule)dragRule.innerHTML='<strong>Drag & drop:</strong> materias, agrupamientos y formatos se modifican por arrastre. En Formación Orientada se arrastra la etiqueta LABORATORIO/TALLER ya ubicada en el mapa para cambiar el orden, evitando configuraciones inválidas como dos laboratorios en Nivel 3 o tres laboratorios en Nivel 5.';
  }
})();
