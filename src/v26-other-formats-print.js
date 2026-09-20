(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);
  const FORMAT_OPTIONS=[
    {value:'asignatura',label:'Asignatura / materia'},
    {value:'seminario',label:'Seminario'}
  ];

  const style=document.createElement('style');
  style.textContent=`
    .other-format-picker{margin-top:7px;padding-top:7px;border-top:1px solid rgba(18,57,92,.12)}
    .other-format-picker label{display:block;font-size:.46rem;color:var(--muted);font-weight:800;margin-bottom:3px}
    .other-format-select{width:100%;min-width:0;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);padding:6px 7px;font:800 .5rem/1.2 Archivo,Arial,sans-serif}

    #printModal .modal-box{width:min(1120px,96vw);max-height:94vh;padding:0;overflow:auto;background:#f5f8fa}
    #printModal .print-modal-head{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid var(--line);padding:14px 18px}
    #printModal .print-modal-head h2{margin:0;font-size:1rem}
    #printModal .print-preview-wrap{padding:18px}
    .pci-print-sheet{background:#fff;border:1px solid var(--line);border-radius:14px;max-width:980px;margin:0 auto;padding:30px 34px;color:#12395c;box-shadow:0 10px 28px rgba(18,57,92,.06)}
    .pci-print-kicker{font-size:.66rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--mint-dark);margin-bottom:7px}
    .pci-print-sheet h1{font-size:1.7rem;line-height:1.1;margin:0 0 16px}
    .pci-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;padding:13px 15px;background:var(--band);border-radius:10px;margin-bottom:14px}
    .pci-print-meta div{font-size:.72rem;line-height:1.35}.pci-print-meta strong{display:block;font-size:.55rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px}
    .pci-print-summary{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 18px}
    .pci-print-badge{border:1px solid var(--line);border-radius:999px;padding:6px 9px;font-size:.6rem;font-weight:800;background:#fff}
    .pci-print-badge.ok{background:var(--ok-soft);color:var(--ok);border-color:#b8dec9}
    .pci-print-level{margin:18px 0 24px;break-inside:avoid-page}
    .pci-print-level-head{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;border-bottom:3px solid var(--ink);padding-bottom:6px;margin-bottom:8px}
    .pci-print-level-head h2{font-size:1rem;margin:0}.pci-print-level-head span{font-size:.62rem;color:var(--muted);font-weight:800}
    .pci-print-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.64rem;table-layout:fixed}
    .pci-print-table th{background:var(--band);padding:7px 8px;text-align:left;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.58rem;text-transform:uppercase;letter-spacing:.04em}
    .pci-print-table th:first-child{width:28%;border-left:1px solid var(--line);border-radius:8px 0 0 0}.pci-print-table th:last-child{border-right:1px solid var(--line);border-radius:0 8px 0 0}
    .pci-print-table td{vertical-align:top;padding:7px 8px;border-bottom:1px solid var(--line);border-left:1px solid var(--line);line-height:1.3;overflow-wrap:anywhere}
    .pci-print-table td:last-child{border-right:1px solid var(--line)}
    .pci-print-space-title{font-weight:900;font-size:.64rem}.pci-print-space-sub{display:block;color:var(--muted);font-size:.53rem;margin-top:2px;line-height:1.25}
    .pci-print-cell-label{font-size:.49rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:900;margin-bottom:4px}
    .pci-print-subject{padding:4px 5px;border-radius:6px;background:#faf7ea;margin:3px 0;font-weight:800}
    .pci-print-subject.fo{background:var(--mint-soft)}.pci-print-subject.flex{background:#f2ecff}
    .pci-print-teacher{display:block;margin-top:2px;font-size:.49rem;color:var(--muted);font-weight:600}
    .pci-print-empty{color:#98a6af;font-style:italic;padding:4px 0}
    .pci-print-footer{margin-top:18px;padding-top:11px;border-top:1px solid var(--line);font-size:.58rem;color:var(--muted);line-height:1.45}
    #printModal .top-actions{max-width:980px;margin:12px auto 22px;padding:0 18px}

    @media(max-width:700px){
      #printModal .modal-box{width:96vw}.pci-print-sheet{padding:20px 16px;border-radius:10px}.pci-print-meta{grid-template-columns:1fr}.pci-print-table{font-size:.58rem}.pci-print-table th:first-child{width:31%}.pci-print-table th,.pci-print-table td{padding:6px 5px}
    }
    @media print{
      @page{size:A4 portrait;margin:10mm}
      body *{visibility:hidden!important}
      #printModal,#printModal *{visibility:visible!important}
      #printModal{display:block!important;position:absolute!important;inset:0!important;background:#fff!important;padding:0!important;overflow:visible!important}
      #printModal .modal-box{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;background:#fff!important;border-radius:0!important;box-shadow:none!important}
      #printModal .print-modal-head,#printModal .top-actions{display:none!important}
      #printModal .print-preview-wrap{padding:0!important}
      .pci-print-sheet{max-width:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important}
      .pci-print-level{break-inside:avoid-page}
      .pci-print-table tr{break-inside:avoid}
    }
  `;
  document.head.appendChild(style);

  function model(){
    const m=current();
    m.otherSpaces=m.otherSpaces||[];
    for(const g of m.otherSpaces)if(!g.formatType)g.formatType='asignatura';
    return m;
  }
  function parseOtherKey(key){const x=String(key||'').match(/^otherSpace_(.+)$/);return x?x[1]:null}
  function otherGroup(id){return model().otherSpaces.find(g=>g.id===id)||null}
  function formatLabel(value){return FORMAT_OPTIONS.find(x=>x.value===value)?.label||'Asignatura / materia'}

  function decorateOtherFormats(){
    const matrix=$id('matrix');if(!matrix)return;
    model();
    for(const g of current().otherSpaces||[]){
      const slotPrefix=`otherSpace_${g.id}-c`;
      const drop=matrix.querySelector(`[data-slot^="${slotPrefix}"]`);if(!drop)continue;
      const row=drop.closest('.grid'),label=row?.querySelector('.rowlabel');if(!label||label.querySelector('.other-format-picker'))continue;
      const picker=document.createElement('div');picker.className='other-format-picker';
      picker.innerHTML=`<label>Formato del espacio</label><select class="other-format-select" data-other-format="${esc(g.id)}">${FORMAT_OPTIONS.map(o=>`<option value="${o.value}" ${g.formatType===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
      label.appendChild(picker);
    }
    matrix.querySelectorAll('[data-other-format]').forEach(select=>{
      select.onpointerdown=e=>e.stopPropagation();
      select.onclick=e=>e.stopPropagation();
      select.onchange=e=>{
        e.stopPropagation();
        const g=otherGroup(select.dataset.otherFormat);if(!g)return;
        g.formatType=select.value;current().valid=false;save();renderOffer();toast(`Formato definido: ${formatLabel(g.formatType)}.`);
      };
    });
  }

  const previousRenderOffer=renderOffer;
  renderOffer=function(){previousRenderOffer();decorateOtherFormats()};

  function teacher(id){return String(model().teachers?.[id]||'').trim()}
  function isFlexible(s){return !!s&&(s.origin==='CUSTOM'||/^fg-\d+-espacios-de-definicion-institucional$/.test(s.id)||/^fg-\d+-tutoria$/.test(s.id))}
  function subjectHtml(id){
    const s=byId(id);if(!s)return'';
    const cls=s.origin==='FO'?'fo':isFlexible(s)?'flex':'';
    const t=teacher(id);
    return `<div class="pci-print-subject ${cls}">${esc(s.name)}${t?`<span class="pci-print-teacher">Docente: ${esc(t)}</span>`:'<span class="pci-print-teacher">Docente: sin asignar</span>'}</div>`;
  }
  function slotHtml(slot,cellLabel=''){
    const ids=current().placements?.[slot]||[];
    return `${cellLabel?`<div class="pci-print-cell-label">${esc(cellLabel)}</div>`:''}${ids.length?ids.map(subjectHtml).join(''):'<div class="pci-print-empty">Sin conformar</div>'}`;
  }
  function relevantRow(r,year){
    if(r.k==='otrosCreate'||r.socialConfig)return false;
    if(r.annual)return true;
    if(r.annualLevel)return r.annualLevel===year;
    const a=year*2-1,b=year*2;
    return !!(r.a&&(r.a(a)||r.a(b)));
  }
  function printRow(r,year){
    const a=year*2-1,b=year*2;
    let title=r.l,sub='';
    const groupId=parseOtherKey(r.k);
    if(groupId){const g=otherGroup(groupId);sub=title;title=formatLabel(g?.formatType)}
    if(r.annual){
      const slot=`${r.k}-n${year}`;
      return `<tr><td><span class="pci-print-space-title">${esc(title)}</span>${sub?`<span class="pci-print-space-sub">${esc(sub)}</span>`:''}<span class="pci-print-space-sub">Anual</span></td><td colspan="2">${slotHtml(slot,`C${a} + C${b}`)}</td></tr>`;
    }
    if(r.annualLevel){
      const slot=`${r.k}-n${year}`;
      return `<tr><td><span class="pci-print-space-title">${esc(title)}</span><span class="pci-print-space-sub">Anual</span></td><td colspan="2">${slotHtml(slot,`C${a} + C${b}`)}</td></tr>`;
    }
    const activeA=r.a?.(a),activeB=r.a?.(b);
    const slotA=`${r.k}-c${a}`,slotB=`${r.k}-c${b}`;
    const labelA=activeA?label(r.k,a):'',labelB=activeB?label(r.k,b):'';
    return `<tr><td><span class="pci-print-space-title">${esc(title)}</span>${sub?`<span class="pci-print-space-sub">${esc(sub)}</span>`:''}</td><td>${activeA?slotHtml(slotA,labelA):'<div class="pci-print-empty">—</div>'}</td><td>${activeB?slotHtml(slotB,labelB):'<div class="pci-print-empty">—</div>'}</td></tr>`;
  }
  function teacherCoverage(){
    const ids=[...new Set(Object.values(current().placements||{}).flat())].filter(id=>byId(id));
    const assigned=ids.filter(id=>teacher(id)).length;
    return {assigned,total:ids.length};
  }
  function printLevel(year){
    const a=year*2-1,b=year*2;
    const rows=rowDefs().filter(r=>relevantRow(r,year)).map(r=>printRow(r,year)).join('');
    return `<section class="pci-print-level"><div class="pci-print-level-head"><h2>Nivel ${year}</h2><span>C${a} · C${b}</span></div><table class="pci-print-table"><thead><tr><th>Espacio / formato</th><th>C${a}</th><th>C${b}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  printPCI=function(){
    const m=model(),coverage=teacherCoverage(),social=m.socialOption==='B'?'Opción 12 laboratorios':'Opción 10 laboratorios';
    const content=$id('printContent');
    const modal=$id('printModal');
    if(!content||!modal)return;
    const modalBox=modal.querySelector('.modal-box');
    if(modalBox){
      modalBox.classList.add('print-modal-box');
      const head=modalBox.querySelector(':scope > .row');if(head)head.classList.add('print-modal-head');
    }
    content.className='print-preview-wrap';
    content.innerHTML=`<article class="pci-print-sheet">
      <div class="pci-print-kicker">PCI · Secundaria Aprende</div>
      <h1>Mapa de la Oferta</h1>
      <div class="pci-print-meta">
        <div><strong>Escuela</strong>${esc(state.school)}</div>
        <div><strong>Orientación</strong>${esc(state.active)}</div>
        <div><strong>Documento</strong>Parte I · Armado curricular</div>
        <div><strong>Estado</strong>${m.valid?'Mapa validado':'En construcción'}</div>
      </div>
      <div class="pci-print-summary">
        <span class="pci-print-badge ${m.valid?'ok':''}">${m.valid?'Mapa de la Oferta validado':'Mapa todavía no validado'}</span>
        <span class="pci-print-badge">Sociales: ${esc(social)}</span>
        <span class="pci-print-badge">Docentes: ${coverage.assigned}/${coverage.total} asignados</span>
      </div>
      ${[1,2,3,4,5].map(printLevel).join('')}
      <div class="pci-print-footer"><strong>Mapa Propuesta Curricular:</strong> ${m.valid?'habilitado para continuar el desarrollo curricular.':'se habilitará cuando el Mapa de la Oferta quede validado.'}<br>La asignación docente es informativa y no condiciona la validación curricular.</div>
    </article>`;
    modal.classList.add('open');
  };

  const rules=$id('rulesModal');
  if(rules){
    const rule=document.createElement('div');rule.className='rule';rule.innerHTML='<strong>Otros formatos pedagógicos:</strong> cada espacio construido debe indicar su formato. Por ahora están disponibles “Asignatura / materia” y “Seminario”. La lista se ampliará con la resolución correspondiente.';rules.querySelector('.modal-box')?.appendChild(rule);
  }
})();
