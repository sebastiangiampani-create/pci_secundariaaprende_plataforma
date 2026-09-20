(() => {
  const $=id=>document.getElementById(id);
  const v64=()=>window.PCITeacherImportV64||null;
  let observer=null,observedHost=null,timer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  function go(id){if(typeof window.screen==='function')window.screen(id)}
  function ensureBack(screenId,target,label){
    const screen=$(screenId);if(!screen)return;
    let bar=screen.querySelector(':scope > .v69-backbar');
    if(!bar){bar=document.createElement('div');bar.className='v69-backbar';screen.prepend(bar)}
    bar.innerHTML=`<button type="button" class="v69-back-btn" data-v69-go="${target}">← ${esc(label)}</button>`;
  }
  function navigation(){
    ensureBack('panel','home','Volver a la escuela');
    ensureBack('offer','panel','Volver al panel del PCI');
    ensureBack('proposal','panel','Volver al panel del PCI');
    ensureBack('institutional','home','Volver a la escuela');
    $('proposal')?.querySelectorAll('.v28-back').forEach(b=>b.classList.add('v69-existing-back'));
  }

  function sectionKey(section){const eye=section.querySelector(':scope > .eyebrow')?.textContent||'',h=section.querySelector(':scope > h2')?.textContent||'';return norm(`${eye}-${h}`)||Math.random().toString(36).slice(2)}
  function savedState(key){try{return JSON.parse(localStorage.getItem(`pci-v69-collapse:${state.school}:${key}`)||'null')}catch{return null}}
  function persist(section){const key=section.dataset.v69Key;if(!key)return;localStorage.setItem(`pci-v69-collapse:${state.school}:${key}`,JSON.stringify(section.classList.contains('v69-collapsed')))}
  function toggleSection(section,force){
    if(!section)return;const collapsed=typeof force==='boolean'?force:!section.classList.contains('v69-collapsed');section.classList.toggle('v69-collapsed',collapsed);
    const btn=section.querySelector(':scope > .v69-section-toggle');if(btn){btn.textContent=collapsed?'▸ Mostrar':'▾ Ocultar';btn.setAttribute('aria-expanded',String(!collapsed))}persist(section)
  }
  function makeCollapsible(section){
    if(!section||section.dataset.v69Collapsible==='1')return;const h=section.querySelector(':scope > h2');if(!h)return;
    section.dataset.v69Collapsible='1';section.dataset.v69Key=sectionKey(section);section.classList.add('v69-collapsible');
    const btn=document.createElement('button');btn.type='button';btn.className='v69-section-toggle';section.insertBefore(btn,h.nextSibling);
    let collapsed=savedState(section.dataset.v69Key);if(collapsed===null){const text=norm(h.textContent);collapsed=!(text.includes('horas-catedra-reales')||text.includes('importar-docentes')||text.includes('carga-masiva'))}
    toggleSection(section,!!collapsed);btn.onclick=e=>{e.stopPropagation();toggleSection(section)};h.title='Abrir / cerrar sección';h.onclick=()=>toggleSection(section);
  }
  function toolbar(host){
    if(!host||$('v69AccordionToolbar'))return;const bar=document.createElement('div');bar.id='v69AccordionToolbar';bar.className='v69-accordion-toolbar';bar.innerHTML='<strong>Vista por bloques</strong><span>Las secciones se pueden abrir y cerrar.</span><button type="button" class="btn small soft" data-v69-expand>Abrir todo</button><button type="button" class="btn small soft" data-v69-collapse>Cerrar todo</button>';host.prepend(bar)
  }
  function accordions(){
    const host=$('v48InstitutionalContent');if(!host)return;toolbar(host);host.querySelectorAll(':scope > .v48-section').forEach(makeCollapsible)
  }
  function bindObserver(){
    const host=$('v48InstitutionalContent');if(!host||host===observedHost)return;
    observer?.disconnect();observedHost=host;observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})
  }

  function ensureImport(){
    if(!$('institutional')?.classList.contains('active'))return;
    try{v64()?.decorate?.()}catch{}
    const screen=$('institutional'),actions=screen?.querySelector('.v48-hero-actions');if(actions&&!$('v69ImportHero')){
      const box=document.createElement('div');box.id='v69ImportHero';box.className='v69-import-hero';box.innerHTML='<button type="button" class="btn soft" data-v69-template>Descargar modelo Excel</button><button type="button" class="btn primary" data-v69-import>Importar Excel / CSV</button>';actions.appendChild(box)
    }
    accordions()
  }
  function openImport(){ensureImport();const section=$('v64TeacherImport');if(section){toggleSection(section,false);section.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('v64TeacherFile')?.click(),250);return}toast('No se pudo abrir la importación todavía. Volvé a intentar en un instante.',true)}
  function downloadTemplate(){ensureImport();if(v64()?.downloadTemplate)return v64().downloadTemplate();toast('El modelo Excel todavía no está disponible.',true)}

  function subjectNames(slot){return (ensure(state.active).placements?.[slot]||[]).map(id=>byId(id)).filter(Boolean).map(s=>s.name)}
  function compactCell(slot){const names=subjectNames(slot);return names.length?names.map(x=>`<span>${esc(x)}</span>`).join(''):'<em>—</em>'}
  function offerMatrixRows(){
    return rowDefs().filter(r=>!r.socialConfig&&!r.otherCreate&&r.k!=='otrosCreate').map(r=>{
      let cells='';
      if(r.annual){for(let y=1;y<=5;y++){const slot=`${r.k}-n${y}`;cells+=`<td colspan="2">${compactCell(slot)}</td>`}}
      else if(r.annualLevel){for(let y=1;y<=5;y++){if(y===Number(r.annualLevel)){const slot=`${r.k}-n${y}`;cells+=`<td colspan="2">${compactCell(slot)}</td>`}else cells+='<td colspan="2"><em>—</em></td>'}}
      else{for(let t=1;t<=10;t++){const active=r.a?.(t);cells+=`<td>${active?compactCell(`${r.k}-c${t}`):'<em>—</em>'}</td>`}}
      return `<tr><th>${esc(r.l)}</th>${cells}</tr>`
    }).join('')
  }
  function printLandscapeOffer(){
    const content=$('printContent'),modal=$('printModal');if(!content||!modal)return;
    content.className='print-preview-wrap v69-print-wrap';content.innerHTML=`<article class="v69-landscape-sheet"><header><div><small>PCI · Secundaria Aprende · Mapa de la Oferta</small><h1>${esc(state.school)} · ${esc(state.active)}</h1></div><strong>${ensure(state.active).valid?'VALIDADO':'EN CONSTRUCCIÓN'}</strong></header><table><thead><tr><th>Espacio</th>${Array.from({length:10},(_,i)=>`<th>C${i+1}</th>`).join('')}</tr><tr class="v69-level-row"><th>Nivel</th>${[1,2,3,4,5].map(y=>`<th colspan="2">Nivel ${y}</th>`).join('')}</tr></thead><tbody>${offerMatrixRows()}</tbody></table><footer>Plan oficial + espacios extra-plan efectivamente ubicados en Fase 1. Generado ${new Date().toLocaleString('es-AR')}.</footer></article>`;modal.classList.add('open')
  }
  function phase2MatrixPrint(){
    const matrix=document.querySelector('#v28matrix .v28-matrix'),content=$('printContent'),modal=$('printModal');if(!matrix||!content||!modal)return;
    const clone=matrix.cloneNode(true);clone.querySelectorAll('[data-mg]').forEach(x=>x.removeAttribute('data-mg'));
    content.className='print-preview-wrap v69-print-wrap';content.innerHTML=`<article class="v69-landscape-sheet v69-phase2-matrix-print"><header><div><small>PCI · Secundaria Aprende · Fase 2</small><h1>${esc(state.school)} · ${esc(state.active)} · Matriz completa</h1></div></header><div class="v69-phase2-clone"></div><footer>Lectura integral del desarrollo curricular por C1–C10.</footer></article>`;content.querySelector('.v69-phase2-clone').appendChild(clone);modal.classList.add('open')
  }
  function ensurePhase2PrintButton(){
    const hero=document.querySelector('#v28matrix .v28-hero');if(!hero||hero.querySelector('[data-v69-print-matrix]'))return;let row=hero.querySelector('.v28-row');if(!row){row=document.createElement('div');row.className='v28-row';hero.appendChild(row)}const b=document.createElement('button');b.type='button';b.className='v28-btn primary';b.dataset.v69PrintMatrix='1';b.textContent='Imprimir matriz apaisada';b.onclick=phase2MatrixPrint;row.appendChild(b)
  }
  function patchPrint(){
    window.printPCI=printLandscapeOffer;const btn=$('printBtn');if(btn){btn.textContent='Impresión apaisada de PCI';btn.onclick=printLandscapeOffer}ensurePhase2PrintButton()
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{bindObserver();navigation();ensureImport();accordions();patchPrint()},90)}
  function start(){refresh()}

  document.addEventListener('click',e=>{
    const goBtn=e.target.closest('[data-v69-go]');if(goBtn){go(goBtn.dataset.v69Go);return}
    if(e.target.closest('[data-v69-template]')){downloadTemplate();return}
    if(e.target.closest('[data-v69-import]')){openImport();return}
    if(e.target.closest('[data-v69-expand]')){$('v48InstitutionalContent')?.querySelectorAll(':scope > .v48-section').forEach(s=>toggleSection(s,false));return}
    if(e.target.closest('[data-v69-collapse]')){$('v48InstitutionalContent')?.querySelectorAll(':scope > .v48-section').forEach(s=>toggleSection(s,true));return}
    if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,#openOffer,#openProposal,#v28full,#v28mat,[data-go]'))setTimeout(refresh,180)
  },true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1200));

  const style=document.createElement('style');style.textContent=`
  #panel>.back,#offer>.back,#institutional>.back{display:none!important}
  .v69-backbar{position:sticky;top:68px;z-index:45;display:flex;align-items:center;padding:8px 0;background:rgba(255,255,255,.96);backdrop-filter:blur(6px)}
  .v69-back-btn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 12px;border-radius:999px;font-weight:900;font-size:.68rem;box-shadow:0 5px 14px rgba(18,57,92,.08)}
  .v69-existing-back{display:inline-flex!important;align-items:center;min-height:34px;padding:7px 11px!important;border:1px solid var(--line)!important;border-radius:999px;background:#fff!important}
  .v69-accordion-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:11px 12px;margin:12px 0;border:1px solid var(--line);border-radius:13px;background:var(--band);font-size:.62rem}.v69-accordion-toolbar span{color:var(--muted);margin-right:auto}
  .v69-collapsible{position:relative;padding-top:17px}.v69-collapsible>h2{padding-right:95px;cursor:pointer}.v69-section-toggle{position:absolute;right:15px;top:14px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:5px 8px;font-size:.55rem;font-weight:900}.v69-collapsed{padding-bottom:12px}.v69-collapsed>:not(.eyebrow):not(h2):not(.v69-section-toggle){display:none!important}.v69-collapsed h2{margin-bottom:0!important}
  .v69-import-hero{display:flex;gap:7px;flex-wrap:wrap}
  #printModal .modal-box{width:min(1500px,98vw)!important}.v69-print-wrap{padding:10px!important}.v69-landscape-sheet{background:#fff;color:#12395c;padding:10px;max-width:1400px;margin:auto}.v69-landscape-sheet header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:7px}.v69-landscape-sheet header small{font-size:.55rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.v69-landscape-sheet header h1{font-size:1rem;margin:2px 0}.v69-landscape-sheet header>strong{font-size:.55rem;border:1px solid #b8c5ce;border-radius:999px;padding:4px 7px}.v69-landscape-sheet table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.45rem}.v69-landscape-sheet th,.v69-landscape-sheet td{border:1px solid #9baebb;padding:3px;vertical-align:top;overflow-wrap:anywhere}.v69-landscape-sheet thead th{background:#eaf1f6;text-align:center}.v69-landscape-sheet tbody th{width:14%;background:#f4f7f9;text-align:left}.v69-landscape-sheet td span{display:block;padding:2px;border-radius:3px;background:#f9f3df;margin:1px 0;font-weight:800}.v69-landscape-sheet td em{color:#9aa8b1}.v69-landscape-sheet footer{font-size:.45rem;margin-top:5px;color:#5f7382}.v69-level-row th{font-size:.42rem}.v69-phase2-matrix-print .v69-phase2-clone{overflow:visible}.v69-phase2-matrix-print .v28-matrix{min-width:0!important;width:100%!important;padding:0!important}.v69-phase2-matrix-print .v28-mrow{grid-template-columns:120px repeat(10,minmax(0,1fr))!important;gap:2px!important;margin-bottom:2px!important}.v69-phase2-matrix-print .v28-cell,.v69-phase2-matrix-print .v59-annual-cell{min-height:28px!important;padding:2px!important}.v69-phase2-matrix-print .v28-chip{font-size:.4rem!important;padding:3px!important}.v69-phase2-matrix-print .v28-mlabel,.v69-phase2-matrix-print .v28-term{font-size:.42rem!important;padding:3px!important}
  @media print{@page{size:A4 landscape;margin:4mm}body *{visibility:hidden!important}#printModal,#printModal *{visibility:visible!important}#printModal{display:block!important;position:absolute!important;inset:0!important;background:#fff!important;padding:0!important;overflow:visible!important}#printModal .modal-box{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;padding:0!important;background:#fff!important;border-radius:0!important}#printModal .print-modal-head,#printModal .top-actions{display:none!important}#printModal .print-preview-wrap{padding:0!important}.v69-landscape-sheet{width:420mm!important;max-width:none!important;zoom:.68!important;padding:0!important;break-after:avoid-page!important;page-break-after:avoid!important}.v69-landscape-sheet table{font-size:5px!important}.v69-landscape-sheet th,.v69-landscape-sheet td{padding:1.5px!important}.v69-landscape-sheet header h1{font-size:10px!important}.v69-landscape-sheet header small,.v69-landscape-sheet footer{font-size:5px!important}.v69-phase2-matrix-print .v28-mrow{grid-template-columns:38mm repeat(10,minmax(0,1fr))!important}.v69-phase2-matrix-print .v28-chip,.v69-phase2-matrix-print .v28-mlabel,.v69-phase2-matrix-print .v28-term{font-size:4px!important;line-height:1.1!important}.v69-phase2-matrix-print .v28-cell,.v69-phase2-matrix-print .v59-annual-cell{min-height:8mm!important}}
  `;document.head.appendChild(style);
  window.PCIUXWorkflowV69={refresh,navigation,accordions,ensureImport,printLandscapeOffer,phase2MatrixPrint};
})();