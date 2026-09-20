(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);

  const style=document.createElement('style');
  style.textContent=`
    .rename-subject{margin-top:4px;border:0;background:transparent;color:var(--mint-dark);padding:0;font-size:.48rem;font-weight:900;text-decoration:underline;cursor:pointer}
    .other-space-create{background:#fffdf5!important}
    .other-space-create .drop{border-color:#caa95b}
    .other-space-create-note{display:block;margin-top:5px;color:#80651d;font-size:.46rem;line-height:1.25;font-weight:700}
    .other-space-row .rowlabel{background:#f6f0ff}
    .other-space-row .placed{background:#f2ecff}
    #ediNameDialog{border:0;border-radius:16px;padding:0;max-width:min(92vw,460px);width:100%;box-shadow:0 22px 70px rgba(18,57,92,.28);color:var(--ink)}
    #ediNameDialog::backdrop{background:rgba(18,57,92,.32)}
    .edi-dialog{padding:20px}.edi-dialog h3{margin:0 0 5px}.edi-dialog p{margin:0 0 13px;color:var(--muted);font-size:.75rem;line-height:1.4}
    .edi-dialog input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:10px 11px;font:inherit}
    .edi-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}.edi-dialog-actions button{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:#fff;font-weight:900}.edi-dialog-actions .primary{background:var(--ink);color:#fff;border-color:var(--ink)}
  `;
  document.head.appendChild(style);

  function ensureModel(){
    const m=current();
    m.subjectNames=m.subjectNames||{};
    m.otherSpaces=m.otherSpaces||[];
    return m;
  }
  function isEdiId(id){return /^fg-\d+-espacios-de-definicion-institucional$/.test(String(id||''))}
  function isTutoriaId(id){return /^fg-\d+-tutoria$/.test(String(id||''))}
  function isFlexible(s){return !!s&&(s.origin==='CUSTOM'||isEdiId(s.id)||isTutoriaId(s.id))}

  // El nombre oficial funciona como punto de partida; dentro de cada PCI la escuela puede
  // nombrar su EDI sin modificar el catálogo general ni otros PCI/orientaciones.
  const previousFg=fg;
  fg=function(){
    const names=ensureModel().subjectNames;
    return previousFg().map(s=>isEdiId(s.id)&&names[s.id]?{...s,name:names[s.id]}:s);
  };

  function rowForSlot(slot){
    const c=String(slot||'').match(/-c(\d+)$/);if(!c)return null;
    const term=Number(c[1]),key=slot.replace(/-c\d+$/,'');
    return {term,year:Math.ceil(term/2),key,row:rowDefs().find(r=>r.k===key)};
  }
  function activeSlot(slot){
    const i=rowForSlot(slot);if(!i)return true;
    return !!i.row&&(!i.row.a||i.row.a(i.term));
  }
  function pairSlot(slot){
    const i=rowForSlot(slot);if(!i)return null;
    const pair=i.term%2?i.term+1:i.term-1;
    return `${i.key}-c${pair}`;
  }
  function pairAdd(slot,id){
    const p=current().placements;p[slot]=p[slot]||[];if(!p[slot].includes(id))p[slot].push(id);
    const pair=pairSlot(slot);if(pair&&activeSlot(pair)){p[pair]=p[pair]||[];if(!p[pair].includes(id))p[pair].push(id)}
  }
  function pairRemove(slot,id){
    const p=current().placements;p[slot]=(p[slot]||[]).filter(x=>x!==id);
    const pair=pairSlot(slot);if(pair)p[pair]=(p[pair]||[]).filter(x=>x!==id);
  }
  function usedInYearTerm(id,term,except=[]){
    const skip=new Set(except);
    for(const [slot,ids] of Object.entries(current().placements||{})){
      if(skip.has(slot)||!(ids||[]).includes(id))continue;
      const i=rowForSlot(slot);if(i&&i.term===term)return slot;
      const a=String(slot).match(/-n(\d+)$/);if(a&&Number(a[1])===Math.ceil(term/2))return slot;
    }
    return null;
  }

  function minFo(slot){
    if(/^foN3-c[56]$/.test(slot))return 1;
    if(/^foN4-c[78]$/.test(slot))return 2;
    if(/^(foLab5|foTaller5)-c(9|10)$/.test(slot))return 2;
    return 0;
  }
  function sourceCanLose(slot,id){
    const min=minFo(slot);if(!min)return[true,''];
    const after=(current().placements[slot]||[]).filter(x=>x!==id).length;
    if(after>=min)return[true,''];
    const i=rowForSlot(slot);
    return[false,i?.year===3?`No se puede mover esta materia porque el espacio FO de C${i.term} quedaría vacío.`:`No se puede mover esta materia porque el espacio FO de C${i?.term||''} quedaría con ${after} materia${after===1?'':'s'} y necesita al menos ${min}.`];
  }
  function block(message,resolution=''){
    const box=$id('validation');
    if(box){box.className='validation rule-block';box.innerHTML='<strong>Acción no permitida</strong>'+esc(message)+(resolution?'<br><span>'+esc(resolution)+'</span>':'')}
    toast(message,true);
  }

  function otherKey(id){return `otherSpace_${id}`}
  function parseOtherKey(key){const m=String(key||'').match(/^otherSpace_(.+)$/);return m?m[1]:null}
  function newOtherSpace(year){
    const m=ensureModel();
    const id=`g${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    m.otherSpaces.push({id,year});return id;
  }
  function otherMembers(group){
    const g=ensureModel().otherSpaces.find(x=>x.id===group);if(!g)return[];
    const c=g.year*2-1;
    return [...new Set(current().placements[`${otherKey(group)}-c${c}`]||[])].map(byId).filter(Boolean);
  }
  function groupLabel(group){
    const members=otherMembers(group);
    if(!members.length)return'Otro formato pedagógico';
    const names=members.map(s=>s.name);
    return names.length===1?`Otro formato · ${names[0]}`:`Otro formato integrado · ${names.join(' + ')}`;
  }
  function cleanOtherSpaces(){
    const m=ensureModel();
    m.otherSpaces=m.otherSpaces.filter(g=>{
      const a=`${otherKey(g.id)}-c${g.year*2-1}`,b=`${otherKey(g.id)}-c${g.year*2}`;
      return (m.placements[a]||[]).length||(m.placements[b]||[]).length;
    });
  }

  const previousRows=rowDefs;
  rowDefs=function(){
    cleanOtherSpaces();
    const rows=previousRows().filter(r=>r.k!=='otros');
    for(const g of ensureModel().otherSpaces){
      const c1=g.year*2-1,c2=g.year*2,key=otherKey(g.id);
      rows.push({k:key,l:groupLabel(g.id),a:t=>t===c1||t===c2,otherSpace:true});
    }
    rows.push({k:'otrosCreate',l:'Otros formatos pedagógicos',a:t=>true,otherCreate:true});
    return rows;
  };

  const previousLabel=label;
  label=function(k,t){
    if(k==='otrosCreate')return`Nuevo espacio · C${t}`;
    if(parseOtherKey(k))return`Espacio · C${t}`;
    return previousLabel(k,t);
  };

  const previousValidTarget=validTarget;
  validTarget=function(slot,s){
    const flex=isFlexible(s);
    const annual=String(slot||'').match(/-n(\d+)$/);
    if(flex&&annual){
      const year=Number(annual[1]);
      return s.year===year?[true,'']:[false,`${s.name} corresponde a ${s.year}.º y este espacio es de ${year}.º.`];
    }
    const i=rowForSlot(slot);
    if(flex&&i){
      if(s.year!==i.year)return[false,`${s.name} corresponde a ${s.year}.º y C${i.term} pertenece a ${i.year}.º.`];
      if(!activeSlot(slot))return[false,'Ese espacio no está habilitado en este cuatrimestre.'];
      return[true,''];
    }
    if(i&&(i.key==='otrosCreate'||parseOtherKey(i.key)))return[false,'Los Otros formatos pedagógicos se construyen con EDI, Tutoría o materias/espacios agregados por la escuela.'];
    return previousValidTarget(slot,s);
  };

  function validateFlexibleTarget(slot,s,source=null){
    const check=validTarget(slot,s);if(!check[0])return check;
    const annual=String(slot).match(/-n(\d+)$/);
    if(annual)return[true,''];
    const i=rowForSlot(slot);if(!i)return[true,''];
    const pair=pairSlot(slot),except=[source,pairSlot(source)].filter(Boolean);
    for(const t of [i.term,pair?rowForSlot(pair)?.term:null].filter(Boolean)){
      const used=usedInYearTerm(s.id,t,except);
      if(used&&used!==slot&&used!==pair)return[false,`${s.name} ya está ubicada en C${t}. Para cambiar su articulación, movela desde el espacio donde está.`];
    }
    return[true,''];
  }

  function createStandalone(slot,id,source=null){
    const s=byId(id);if(!isFlexible(s))return false;
    const i=rowForSlot(slot);if(!i||i.key!=='otrosCreate')return false;
    const check=validateFlexibleTarget(slot,s,source);if(!check[0]){block(check[1]);return true}
    if(source){const lose=sourceCanLose(source,id);if(!lose[0]){block(lose[1]);return true}pairRemove(source,id)}
    const gid=newOtherSpace(i.year),target=`${otherKey(gid)}-c${i.term}`;
    pairAdd(target,id);current().valid=false;save();renderOffer();
    toast(`${s.name} creó un espacio propio en Otros formatos pedagógicos.`);return true;
  }

  function moveFlexible(source,target,id){
    const s=byId(id);if(!isFlexible(s)||!source||!target||source===target)return false;
    const ti=rowForSlot(target);
    if(ti?.key==='otrosCreate')return createStandalone(target,id,source);
    const check=validateFlexibleTarget(target,s,source);if(!check[0]){block(check[1]);return true}
    const lose=sourceCanLose(source,id);if(!lose[0]){block(lose[1]);return true}
    pairRemove(source,id);
    if(String(target).match(/-n\d+$/)){
      const arr=current().placements[target]=current().placements[target]||[];if(!arr.includes(id))arr.push(id);
    }else pairAdd(target,id);
    current().valid=false;save();renderOffer();
    const targetKey=rowForSlot(target)?.key;
    toast(parseOtherKey(targetKey)?`${s.name} quedó integrada en un espacio de Otros formatos.`:`${s.name} quedó articulada con el nuevo agrupamiento.`);return true;
  }

  // Desde la bolsa, soltar sobre “Nuevo espacio” crea una fila propia. Soltar sobre
  // cualquier agrupamiento FG/FO articula directamente la materia.
  const previousAssign=assign;
  assign=function(slot,id){
    const s=byId(id);
    if(isFlexible(s)&&rowForSlot(slot)?.key==='otrosCreate'){
      const used=usedInYearTerm(id,rowForSlot(slot).term);
      if(used){block(`${s.name} ya está ubicada en C${rowForSlot(slot).term}.`,`Movela desde su ubicación actual si querés convertirla en un espacio propio.`);return}
      createStandalone(slot,id);return;
    }
    previousAssign(slot,id);
  };

  function decode(raw){
    if(!raw)return null;
    if(raw.startsWith('subject:'))return{kind:'subject',id:decodeURIComponent(raw.slice(8))};
    if(raw.startsWith('move:')){const rest=raw.slice(5),i=rest.indexOf(':');if(i<0)return null;return{kind:'move',from:decodeURIComponent(rest.slice(0,i)),id:decodeURIComponent(rest.slice(i+1))}}
    return null;
  }

  function bindOtherDropCapture(){
    const matrix=$id('matrix');if(!matrix)return;
    if(matrix.__v25Capture)matrix.removeEventListener('drop',matrix.__v25Capture,true);
    const capture=e=>{
      const payload=decode(e.dataTransfer?.getData('text/plain')||'');if(!payload)return;
      const target=e.target.closest('[data-slot]');if(!target)return;
      const s=byId(payload.id);if(!isFlexible(s))return;
      const targetKey=rowForSlot(target.dataset.slot)?.key;
      if(payload.kind==='move'&&(targetKey==='otrosCreate'||parseOtherKey(targetKey))){
        e.preventDefault();e.stopImmediatePropagation();moveFlexible(payload.from,target.dataset.slot,payload.id);return;
      }
    };
    matrix.__v25Capture=capture;matrix.addEventListener('drop',capture,true);
  }

  function touchDrag(handle,payload,text){
    handle.onpointerdown=e=>{
      if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
      e.preventDefault();e.stopPropagation();
      const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=text;document.body.appendChild(ghost);
      const move=ev=>{ghost.style.left=`${ev.clientX}px`;ghost.style.top=`${ev.clientY}px`};
      const cleanup=()=>{ghost.remove();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel)};
      const up=ev=>{
        const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot]');cleanup();if(!target)return;
        if(payload.kind==='subject')assign(target.dataset.slot,payload.id);else moveFlexible(payload.from,target.dataset.slot,payload.id);
      };
      const cancel=()=>cleanup();move(e);handle.setPointerCapture?.(e.pointerId);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);
    };
  }

  function ensureEdiDialog(){
    let d=$id('ediNameDialog');if(d)return d;
    d=document.createElement('dialog');d.id='ediNameDialog';d.innerHTML=`<div class="edi-dialog"><h3>Editar EDI</h3><p id="ediNameContext"></p><input id="ediNameInput" maxlength="120"><div class="edi-dialog-actions"><button type="button" id="ediCancel">Cancelar</button><button type="button" class="primary" id="ediSave">Guardar nombre</button></div></div>`;document.body.appendChild(d);$id('ediCancel').onclick=()=>d.close();return d;
  }
  function editEdi(id){
    const s=byId(id);if(!s||!isEdiId(id))return;
    const d=ensureEdiDialog(),input=$id('ediNameInput');$id('ediNameContext').textContent=`${s.year}.º año · nombre institucional del Espacio de Definición Institucional`;
    input.value=s.name==='Espacios de Definición Institucional'?'':s.name;
    $id('ediSave').onclick=()=>{const name=input.value.trim();const m=ensureModel();if(name)m.subjectNames[id]=name;else delete m.subjectNames[id];save();d.close();renderOffer();toast('Nombre del EDI actualizado.')};
    if(d.showModal){d.showModal();setTimeout(()=>input.focus(),0)}else{const name=window.prompt('Nombre institucional del EDI:',input.value);if(name!==null){const m=ensureModel();if(name.trim())m.subjectNames[id]=name.trim();else delete m.subjectNames[id];save();renderOffer()}}
  }

  function decorate(){
    const bag=$id('bagContent');
    if(bag){
      bag.querySelectorAll('.subject[data-sub]').forEach(card=>{
        const id=card.dataset.sub,s=byId(id);if(!s)return;
        if(isEdiId(id)&&!card.querySelector('.rename-subject')){
          const host=card.children[1];const b=document.createElement('button');b.type='button';b.className='rename-subject';b.textContent='Editar nombre EDI';b.onclick=e=>{e.preventDefault();e.stopPropagation();editEdi(id)};host?.appendChild(b);
        }
        if(isFlexible(s)){const grip=card.querySelector('.drag-handle');if(grip)touchDrag(grip,{kind:'subject',id},s.name)}
      });
    }
    const matrix=$id('matrix');
    if(matrix){
      matrix.querySelectorAll('[data-slot^="otrosCreate-c"]').forEach(drop=>{drop.closest('.cell')?.classList.add('other-space-create');if(!drop.querySelector('.other-space-create-note'))drop.insertAdjacentHTML('beforeend','<span class="other-space-create-note">Soltá EDI, Tutoría o una materia agregada: crea un espacio propio. Si la soltás sobre un espacio ya creado, se integran.</span>')});
      matrix.querySelectorAll('[data-slot^="otherSpace_"]').forEach(drop=>drop.closest('.grid')?.classList.add('other-space-row'));
      matrix.querySelectorAll('.placed[data-map-id]').forEach(card=>{
        const id=card.dataset.mapId,s=byId(id);if(!isFlexible(s))return;
        if(isEdiId(id)&&!card.querySelector('.rename-subject')){const b=document.createElement('button');b.type='button';b.className='rename-subject';b.textContent='editar';b.style.position='static';b.style.width='auto';b.style.height='auto';b.onclick=e=>{e.preventDefault();e.stopPropagation();editEdi(id)};card.appendChild(b)}
        const grip=card.querySelector('.map-grip');if(grip)touchDrag(grip,{kind:'move',from:card.dataset.from,id},s.name);
      });
    }
    bindOtherDropCapture();
  }

  const previousRenderOffer=renderOffer;
  renderOffer=function(){ensureModel();previousRenderOffer();decorate()};

  const modal=$id('rulesModal');
  if(modal){
    const rule=document.createElement('div');rule.className='rule';rule.innerHTML='<strong>EDI, Tutoría y materias agregadas:</strong> pueden funcionar como un espacio propio de Otros formatos pedagógicos o articularse con cualquier agrupamiento FG/FO del mismo año. En Otros formatos, cada materia crea inicialmente un espacio separado; al arrastrar otra materia sobre ese espacio se conforma un espacio integrado más amplio. Una materia integrada puede volver a separarse arrastrándola a “Nuevo espacio”. El nombre del EDI es editable dentro de cada PCI.';modal.querySelector('.modal-box')?.appendChild(rule);
  }
})();
