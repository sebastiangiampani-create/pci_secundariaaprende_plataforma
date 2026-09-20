(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const style=document.createElement('style');
  style.textContent=`
    #proposal{padding-bottom:70px}
    .phase2-preview-note{margin:0 0 14px;padding:12px 14px;border:1px solid #d8c98e;background:#fff9df;border-radius:12px;color:#6f5a16;font-size:.72rem;line-height:1.45}
    .phase2-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 0}
    .phase2-levels{display:flex;gap:6px;flex-wrap:wrap}
    .phase2-level-btn{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:7px 10px;font-size:.65rem;font-weight:900}
    .phase2-level-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}
    .phase2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
    .phase2-space{border:1px solid var(--line);border-radius:14px;background:#fff;padding:13px;box-shadow:var(--shadow);display:flex;flex-direction:column;min-height:190px}
    .phase2-space.incomplete{background:#fbfcfd}
    .phase2-space-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
    .phase2-space h3{font-size:.86rem;line-height:1.2;margin:3px 0 4px}
    .phase2-kicker{font-size:.54rem;color:var(--mint-dark);font-weight:900;text-transform:uppercase;letter-spacing:.06em}
    .phase2-term{font-size:.56rem;color:var(--muted);font-weight:800}
    .phase2-status{font-size:.52rem;font-weight:900;border-radius:999px;padding:4px 7px;background:var(--band);white-space:nowrap}
    .phase2-status.done{background:var(--ok-soft);color:var(--ok)}
    .phase2-subjects{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
    .phase2-subject{font-size:.53rem;font-weight:800;background:var(--gold-soft);border-radius:999px;padding:4px 6px}
    .phase2-subject.fo{background:var(--mint-soft);color:var(--mint-dark)}
    .phase2-empty{font-size:.62rem;color:var(--muted);font-style:italic;margin:8px 0}
    .phase2-summary{font-size:.62rem;color:var(--muted);line-height:1.35;margin:6px 0 10px;min-height:34px}
    .phase2-space .btn{margin-top:auto;width:max-content}
    .phase2-editor{margin-top:14px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:var(--shadow);padding:16px}
    .phase2-editor.hidden{display:none}
    .phase2-editor-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px}
    .phase2-editor h2{font-size:1.05rem;margin:2px 0}
    .phase2-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .phase2-field.full{grid-column:1/-1}
    .phase2-field label{display:block;font-size:.61rem;font-weight:900;margin-bottom:5px;color:var(--ink)}
    .phase2-field input,.phase2-field textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:9px 10px;color:var(--ink);background:#fff;resize:vertical}
    .phase2-field textarea{min-height:88px}
    .phase2-help{display:block;color:var(--muted);font-size:.52rem;line-height:1.35;margin-top:4px}
    .phase2-readonly{padding:9px 10px;background:var(--band);border-radius:10px;font-size:.64rem;line-height:1.45}
    .phase2-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}
    .phase2-preview-tag{display:inline-flex;align-items:center;border-radius:999px;background:#fff4d8;color:#795d0a;padding:5px 8px;font-size:.58rem;font-weight:900}
    @media(max-width:700px){.phase2-form{grid-template-columns:1fr}.phase2-field.full{grid-column:auto}.phase2-grid{grid-template-columns:1fr}.phase2-editor{padding:13px}}
  `;
  document.head.appendChild(style);

  function ensurePhase2(){
    const m=current();
    m.phase2=m.phase2||{spaces:{}};
    m.phase2.spaces=m.phase2.spaces||{};
    return m.phase2;
  }

  function foType(slot){
    const m=current();
    if(/^foN3-c/.test(slot))return m.foTypes?.['3']?.[slot.split('-c')[1]]||'lab';
    if(/^foN4-c/.test(slot))return m.foTypes?.['4']?.[slot.split('-c')[1]]||'lab';
    if(/^(foLab5|foTaller5)-c/.test(slot))return m.foTypes5?.[slot]||(slot.startsWith('foLab5')?'lab':'taller');
    return null;
  }

  function typeFor(row,slot){
    if(row.annual)return'troncal';
    if(row.annualLevel)return'proyecto';
    if(row.k==='naturales'||row.k==='socialA'||row.k==='socialB')return'laboratorio';
    if(row.k==='artes'||row.k==='tecnologias'||row.k==='ef')return'taller';
    if(/^fo/.test(row.k))return foType(slot)==='taller'?'taller':'laboratorio';
    if(/^otherSpace_/.test(row.k)){
      const id=row.k.replace('otherSpace_','');
      const g=current().otherSpaces?.find(x=>x.id===id);
      return g?.formatType==='seminario'?'seminario':'asignatura';
    }
    return'asignatura';
  }

  function typeLabel(type){
    return({troncal:'Troncal anual',laboratorio:'Laboratorio',taller:'Taller',proyecto:'Proyecto anual',seminario:'Seminario',asignatura:'Asignatura / materia'})[type]||'Espacio curricular';
  }

  function defaultName(row,slot,year,type){
    if(row.annual)return`${row.l} · Nivel ${year}`;
    if(row.annualLevel)return row.l;
    if(/^otherSpace_/.test(row.k)){
      const ids=current().placements?.[slot]||[];
      const names=ids.map(byId).filter(Boolean).map(s=>s.name);
      return names.length?names.join(' + '):typeLabel(type);
    }
    if(/^fo/.test(row.k))return`${typeLabel(type)} · Formación Orientada · Nivel ${year}`;
    return `${row.l.replace(/^↳\s*/,'')} · ${slot.match(/-c(\d+)$/)?.[1]?'C'+slot.match(/-c(\d+)$/)[1]:''}`.replace(/ · $/,'');
  }

  function spaces(){
    const list=[];
    for(const row of rowDefs()){
      if(row.k==='otrosCreate'||row.socialConfig)continue;
      if(row.annual){
        for(let year=1;year<=5;year++){
          const slot=`${row.k}-n${year}`;
          list.push(makeSpace(row,slot,year,`${year*2-1}+C${year*2}`));
        }
        continue;
      }
      if(row.annualLevel){
        const year=row.annualLevel,slot=`${row.k}-n${year}`;
        list.push(makeSpace(row,slot,year,`C${year*2-1}+C${year*2}`));
        continue;
      }
      for(let term=1;term<=10;term++){
        if(!row.a?.(term))continue;
        const year=Math.ceil(term/2),slot=`${row.k}-c${term}`;
        list.push(makeSpace(row,slot,year,`C${term}`));
      }
    }
    return list;
  }

  function makeSpace(row,slot,year,termLabel){
    const ids=current().placements?.[slot]||[];
    const type=typeFor(row,slot);
    const data=ensurePhase2().spaces[slot]||{};
    return{row,slot,year,termLabel,type,ids,data,name:data.name||defaultName(row,slot,year,type)};
  }

  function completion(space){
    const d=space.data||{};
    if(!space.ids.length)return{done:false,label:'Pendiente Fase 1'};
    const core=String(d.objectives||'').trim()||String(d.contents||'').trim()||String(d.synopsis||'').trim()||String(d.context||'').trim()||String(d.practice||'').trim();
    return core?{done:true,label:'En desarrollo'}:{done:false,label:'Sin desarrollar'};
  }

  function summary(space){
    const d=space.data||{};
    const parts=[];
    if(d.objectives?.trim())parts.push('objetivos');
    if(d.contents?.trim())parts.push('contenidos');
    if(d.context?.trim())parts.push('contexto');
    if(d.practice?.trim())parts.push('práctica/producto/eje');
    if(d.synopsis?.trim())parts.push('sinopsis');
    return parts.length?`Cargado: ${parts.join(', ')}.`:'Todavía no tiene desarrollo curricular cargado.';
  }

  function card(space){
    const status=completion(space);
    const subjects=space.ids.map(id=>{
      const s=byId(id);if(!s)return'';
      return`<span class="phase2-subject ${s.origin==='FO'?'fo':''}">${escapeHtml(s.name)}</span>`;
    }).join('');
    return`<article class="phase2-space ${space.ids.length?'':'incomplete'}" data-space-card="${escapeHtml(space.slot)}">
      <div class="phase2-space-head"><div><div class="phase2-kicker">${escapeHtml(typeLabel(space.type))} · Nivel ${space.year}</div><h3>${escapeHtml(space.name)}</h3><div class="phase2-term">${escapeHtml(space.termLabel)}</div></div><span class="phase2-status ${status.done?'done':''}">${escapeHtml(status.label)}</span></div>
      ${subjects?`<div class="phase2-subjects">${subjects}</div>`:'<div class="phase2-empty">Este espacio todavía no está conformado en el Mapa de la Oferta.</div>'}
      <div class="phase2-summary">${escapeHtml(summary(space))}</div>
      <button type="button" class="btn small ${space.ids.length?'primary':'soft'}" data-edit-space="${escapeHtml(space.slot)}" ${space.ids.length?'':'disabled'}>${space.ids.length?'Editar desarrollo':'Completar primero en Fase 1'}</button>
    </article>`;
  }

  let activeLevel=1;
  function renderPhase2(level=activeLevel){
    activeLevel=Number(level)||1;
    const proposal=$id('proposal');if(!proposal)return;
    $id('proposalTitle').textContent=`${state.school} · ${state.active}`;
    let host=$id('phase2Host');
    if(!host){
      host=document.createElement('div');host.id='phase2Host';
      const notice=proposal.querySelector('.notice');
      notice?.insertAdjacentElement('afterend',host);
    }
    const all=spaces(),visible=all.filter(s=>s.year===activeLevel);
    host.innerHTML=`
      ${current().valid?'':'<div class="phase2-preview-note"><strong>Vista de prueba de Fase 2.</strong> Podés recorrer y editar el desarrollo para probar el diseño. Para cerrar formalmente el PCI seguirá siendo obligatorio validar primero el Mapa de la Oferta.</div>'}
      <div class="phase2-toolbar"><div class="phase2-levels">${[1,2,3,4,5].map(y=>`<button type="button" class="phase2-level-btn ${y===activeLevel?'active':''}" data-p2-level="${y}">Nivel ${y}</button>`).join('')}</div>${current().valid?'':'<span class="phase2-preview-tag">Modo prueba</span>'}</div>
      <div class="phase2-grid">${visible.map(card).join('')}</div>
      <div id="phase2Editor" class="phase2-editor hidden"></div>`;
    host.querySelectorAll('[data-p2-level]').forEach(b=>b.onclick=()=>renderPhase2(Number(b.dataset.p2Level)));
    host.querySelectorAll('[data-edit-space]').forEach(b=>b.onclick=()=>openEditor(b.dataset.editSpace));
  }

  function openEditor(slot){
    const space=spaces().find(s=>s.slot===slot);if(!space||!space.ids.length)return;
    const editor=$id('phase2Editor');if(!editor)return;
    const d=ensurePhase2().spaces[slot]||{};
    const subjects=space.ids.map(id=>byId(id)).filter(Boolean).map(s=>s.name).join(' + ');
    const conditional=space.type==='laboratorio'
      ?`<div class="phase2-field full"><label>Contexto problematizador</label><textarea data-p2-field="context" placeholder="Contexto o problema que organiza el laboratorio">${escapeHtml(d.context||'')}</textarea></div>`
      :space.type==='taller'
      ?`<div class="phase2-field full"><label>Práctica / producto / eje</label><textarea data-p2-field="practice" placeholder="Práctica, producto o eje que organiza el taller">${escapeHtml(d.practice||'')}</textarea></div>`:'';
    editor.classList.remove('hidden');
    editor.dataset.editing=slot;
    editor.innerHTML=`
      <div class="phase2-editor-head"><div><div class="phase2-kicker">${escapeHtml(typeLabel(space.type))} · ${escapeHtml(space.termLabel)}</div><h2>Desarrollo del espacio</h2></div><button type="button" class="btn small soft" id="closePhase2Editor">Cerrar</button></div>
      <div class="phase2-form">
        <div class="phase2-field full"><label>Nombre visible del espacio</label><input data-p2-field="name" value="${escapeHtml(d.name||space.name)}"><span class="phase2-help">Este será el nombre que luego deberá aparecer en la impresión del PCI.</span></div>
        <div class="phase2-field full"><label>Materias que lo componen</label><div class="phase2-readonly">${escapeHtml(subjects)}</div><span class="phase2-help">La composición se hereda de Fase 1 y no se modifica desde acá.</span></div>
        <div class="phase2-field"><label>Objetivos de aprendizaje</label><textarea data-p2-field="objectives" placeholder="Objetivos del espacio">${escapeHtml(d.objectives||'')}</textarea></div>
        <div class="phase2-field"><label>Contenidos priorizados</label><textarea data-p2-field="contents" placeholder="En esta primera vista podés cargarlos. Luego conectaremos la bolsa oficial de contenidos.">${escapeHtml(d.contents||'')}</textarea><span class="phase2-help">Esta carga manual es provisoria para probar la Fase 2.</span></div>
        ${conditional}
        <div class="phase2-field full"><label>Sinopsis <span style="font-weight:500;color:var(--muted)">(opcional)</span></label><textarea data-p2-field="synopsis" placeholder="Síntesis de lo que sucede en este espacio">${escapeHtml(d.synopsis||'')}</textarea></div>
      </div>
      <div class="phase2-actions"><button type="button" class="btn primary" id="savePhase2Space">Guardar desarrollo</button></div>`;
    $id('closePhase2Editor').onclick=()=>editor.classList.add('hidden');
    $id('savePhase2Space').onclick=()=>saveEditor(slot);
    editor.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function saveEditor(slot){
    const editor=$id('phase2Editor');if(!editor)return;
    const data=ensurePhase2().spaces[slot]=ensurePhase2().spaces[slot]||{};
    editor.querySelectorAll('[data-p2-field]').forEach(el=>data[el.dataset.p2Field]=el.value);
    save();
    renderPhase2(activeLevel);
    toast('Desarrollo curricular guardado.');
  }

  function updateAccess(){
    const card=$id('proposalCard'),button=$id('openProposal');
    if(!card||!button)return;
    card.classList.remove('locked');
    button.disabled=false;
    if(!current().valid){
      button.textContent='Ver Fase 2 · prueba';
      const p=card.querySelector('p');
      if(p)p.textContent='Vista operativa para probar el desarrollo curricular. El cierre formal seguirá requiriendo validar primero el Mapa de la Oferta.';
    }else{
      button.textContent='Entrar';
    }
    button.onclick=()=>{screen('proposal');renderPhase2(1)};
  }

  function install(){
    ensurePhase2();
    updateAccess();
    const baseScreen=window.screen;
    if(typeof baseScreen==='function'&&!baseScreen.__p2Wrapped){
      const wrapped=function(name){const out=baseScreen(name);if(name==='panel')setTimeout(updateAccess,0);if(name==='proposal')setTimeout(()=>renderPhase2(activeLevel),0);return out};
      wrapped.__p2Wrapped=true;
      window.screen=wrapped;
    }
  }

  const baseInit=window.__pciBaseInit;
  if(typeof baseInit==='function'){
    window.__pciBaseInit=async function(){await baseInit();install()};
  }else setTimeout(install,0);
})();
