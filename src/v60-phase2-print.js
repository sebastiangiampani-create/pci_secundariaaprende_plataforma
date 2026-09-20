(() => {
  const api=()=>window.PCIPhase2V28;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const br=v=>esc(v).replace(/\r?\n/g,'<br>');
  function contentRows(g){return(g.data?.contents||[]).map(id=>api()?.findContent?.(id)).filter(Boolean)}
  function planStatus(p){const has=String(p?.objectives||'').trim()||(p?.contentIds||[]).length||String(p?.name||'').trim();return has?'Con desarrollo':'Sin iniciar'}
  function groupHtml(g){
    const d=g.data||{},contents=contentRows(g),plans=Array.isArray(d.plansBimestrales)?d.plansBimestrales:[];
    return `<section class="v60-print-group"><div class="v60-print-title"><div><small>${esc(g.area)} · ${esc(api()?.typeLabel?.(g.type)||g.type)} · ${esc(api()?.termText?.(g)||g.term)}</small><h3>${esc(d.name||g.name)}</h3></div>${d.elective?'<span>Electivo A/B</span>':''}</div>${d.objectives?`<p><strong>Objetivos:</strong> ${br(d.objectives)}</p>`:''}${d.context?`<p><strong>Contexto problematizador:</strong> ${br(d.context)}</p>`:''}${d.practice?`<p><strong>Práctica / producción / producto / eje:</strong> ${br(d.practice)}</p>`:''}${d.synopsis?`<p><strong>Sinopsis:</strong> ${br(d.synopsis)}</p>`:''}<div><strong>Contenidos</strong>${contents.length?`<ul>${contents.map(c=>`<li>${esc(c.text||'')}${c.component==='CUSTOM'?' <em>(institucional)</em>':''}</li>`).join('')}</ul>`:'<p class="v60-print-empty">Sin contenidos cargados.</p>'}</div>${plans.length?`<div><strong>Planes bimestrales</strong><ul>${plans.map(p=>`<li>Plan ${p.number}${p.name?` · ${esc(p.name)}`:''} · ${planStatus(p)}</li>`).join('')}</ul></div>`:''}</section>`;
  }
  function openPrint(){
    const content=document.getElementById('printContent'),modal=document.getElementById('printModal');if(!content||!modal)return;
    const groups=api()?.groups?.()||[];
    content.className='print-preview-wrap';
    content.innerHTML=`<article class="pci-print-sheet v60-phase2-sheet"><div class="pci-print-kicker">PCI · Secundaria Aprende · Fase 2</div><h1>Desarrollo curricular</h1><div class="pci-print-meta"><div><strong>Escuela</strong>${esc(state.school)}</div><div><strong>Orientación</strong>${esc(state.active)}</div><div><strong>Documento</strong>Parte II · Propuesta curricular</div><div><strong>Espacios</strong>${groups.length}</div></div>${groups.map(groupHtml).join('')}</article>`;
    modal.classList.add('open');
  }
  function decorate(){
    const row=document.querySelector('#v28home .v28-hero .v28-row');if(!row)return;
    let button=row.querySelector('[data-v60-print]');if(!button){button=document.createElement('button');button.type='button';button.className='v28-btn primary';button.dataset.v60Print='1';button.textContent='Impresión de desarrollo curricular';row.appendChild(button)}
    button.onclick=openPrint;
  }
  const style=document.createElement('style');style.textContent='.v60-phase2-sheet{max-width:980px;margin:auto}.v60-print-group{padding:14px 0;border-top:2px solid var(--ink);break-inside:avoid-page}.v60-print-title{display:flex;justify-content:space-between;gap:8px}.v60-print-title h3{margin:3px 0 8px}.v60-print-title small{color:var(--muted)}.v60-print-title span{font-size:.58rem;font-weight:900}.v60-print-group p,.v60-print-group li{font-size:.68rem;line-height:1.45}.v60-print-empty{color:#8a9aa5;font-style:italic}';document.head.appendChild(style);
  window.addEventListener('pci-app-ready',()=>setTimeout(decorate,250));
  window.addEventListener('pci-phase2-groups-rendered',decorate);
  document.addEventListener('click',e=>{if(e.target.closest('#openProposal,#v28back,#v28panel'))setTimeout(decorate,120)},true);
  window.PCIPhase2PrintV60={decorate,openPrint};
})();
