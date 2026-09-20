(() => {
  const api=()=>window.PCIInstitutionalV48||null;
  let homeObserver=null,institutionalObserver=null,timer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults=n=>Array.from({length:Math.max(0,Math.min(12,Number(n)||0))},(_,i)=>String.fromCharCode(65+i));

  function cfg(orientation){
    const c=api()?.orientationConfig?.(orientation);if(!c)return null;
    c.courseCounts=c.courseCounts||{};c.divisionLabels=c.divisionLabels||{};
    for(let y=1;y<=5;y++){
      const count=Math.max(0,Math.min(12,Number(c.courseCounts[y])||0));
      if(!Array.isArray(c.divisionLabels[y]))c.divisionLabels[y]=defaults(count);
      const labels=c.divisionLabels[y].map(x=>String(x||'').trim()).filter(Boolean).slice(0,12);
      while(labels.length<count)labels.push(defaults(count)[labels.length]||String(labels.length+1));
      if(labels.length>count)labels.length=count;
      c.divisionLabels[y]=labels;c.courseCounts[y]=labels.length;
    }
    return c;
  }
  function labels(orientation,year){return cfg(orientation)?.divisionLabels?.[year]||[]}
  function syncCount(orientation,year,count){
    const c=cfg(orientation);if(!c)return;const n=Math.max(0,Math.min(12,Number(count)||0)),arr=[...(c.divisionLabels[year]||[])];
    while(arr.length<n)arr.push(defaults(n)[arr.length]||String(arr.length+1));arr.length=n;c.divisionLabels[year]=arr;c.courseCounts[year]=n;save();
  }
  function setLabels(orientation,year,raw){
    const c=cfg(orientation);if(!c)return;
    const seen=new Set(),arr=String(raw||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).filter(x=>{const k=x.toLocaleLowerCase('es');if(seen.has(k))return false;seen.add(k);return true}).slice(0,12);
    c.divisionLabels[year]=arr;c.courseCounts[year]=arr.length;save();return arr;
  }

  function patchApi(){
    const a=api();if(!a||a.__v57Patched)return;
    const original=a.implementationRows.bind(a);
    a.__v57OriginalImplementationRows=original;
    a.implementationRows=orientation=>{
      const rows=original(orientation),c=cfg(orientation);
      return rows.map(row=>{
        const old=String(row.division||''),idx=Math.max(0,old.toUpperCase().charCodeAt(0)-65),label=c?.divisionLabels?.[row.year]?.[idx]||old;
        return{...row,division:label,course:`${row.year}.º ${label}`,divisionSlot:old};
      });
    };
    a.allImplementationRows=()=> (state.selected||[]).flatMap(o=>a.implementationRows(o));
    a.__v57Patched=true;
  }

  const style=document.createElement('style');style.textContent=`
    .v57-toggle{margin-top:8px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:6px 9px;font-size:.55rem;font-weight:850}.v57-panel{display:none;margin-top:8px;padding:9px;border-radius:10px;background:var(--band)}.v57-panel.open{display:block}.v57-panel p{margin:0 0 7px!important;font-size:.55rem!important;color:var(--muted)!important;line-height:1.4!important}.v57-label-grid{display:grid;grid-template-columns:repeat(5,minmax(80px,1fr));gap:6px}.v57-label-grid label{display:grid;gap:3px;font-size:.52rem;font-weight:850;color:var(--muted)}.v57-label-grid input{width:100%;padding:6px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-size:.58rem}.v57-status{display:block;margin-top:6px;font-size:.52rem;color:var(--muted);line-height:1.35}@media(max-width:720px){.v57-label-grid{grid-template-columns:1fr 1fr}.v57-label-grid label:last-child{grid-column:1/-1}}
  `;document.head.appendChild(style);

  function renderPanel(card,orientation){
    const box=card.querySelector('.v48-course-config');if(!box)return;const c=cfg(orientation);if(!c)return;
    let toggle=box.querySelector('.v57-toggle'),panel=box.querySelector('.v57-panel');
    if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='v57-toggle';toggle.textContent='Personalizar nombres de divisiones';const grid=box.querySelector('.v48-course-grid');grid?.after(toggle)}
    if(!panel){panel=document.createElement('div');panel.className='v57-panel';toggle.after(panel)}
    panel.innerHTML=`<p>Para una organización regular alcanza con la cantidad de cursos. Si la escuela usa nombres especiales, escribilos separados por coma. Ej.: <strong>A, B</strong> · <strong>Única</strong> · <strong>1, 2, 3</strong> · <strong>Norte, Sur</strong>.</p><div class="v57-label-grid">${[1,2,3,4,5].map(y=>`<label>${y}.º<input data-v57-labels="${y}" value="${esc((c.divisionLabels[y]||[]).join(', '))}" placeholder="A, B"></label>`).join('')}</div><span class="v57-status">Los nombres cambian la identificación visible del curso; no modifican la estructura curricular de Fase 1.</span>`;
    toggle.onclick=()=>panel.classList.toggle('open');
    panel.querySelectorAll('[data-v57-labels]').forEach(input=>input.onchange=()=>{const y=Number(input.dataset.v57Labels),arr=setLabels(orientation,y,input.value);input.value=arr.join(', ');const count=box.querySelector(`[data-v48-course="${y}"]`);if(count)count.value=arr.length;decorateInstitutional();toast(`Divisiones de ${y}.º actualizadas.`)});
    const help=box.querySelector('.v48-course-help');if(help)help.textContent='Indicá cuántas divisiones tiene cada nivel. Si los nombres no son A/B/C, podés personalizarlos sin cambiar el PCI.';
  }

  function decorateHome(){
    patchApi();document.querySelectorAll('#pciList .pci-card').forEach(card=>{const orientation=card.querySelector('h3')?.textContent?.trim();if(orientation)renderPanel(card,orientation)});
  }
  function decorateInstitutional(){
    patchApi();const host=document.getElementById('v48InstitutionalContent'),orientation=state.active;if(!host||!orientation)return;
    const map=new Map((api()?.implementationRows?.(orientation)||[]).map(r=>[r.instanceId,r.course]));
    host.querySelectorAll('[data-v48-assignment]').forEach(sel=>{const course=map.get(sel.dataset.v48Assignment),row=sel.closest('tr');if(course&&row?.cells?.[0]){const strong=row.cells[0].querySelector('strong');if(strong)strong.textContent=course;else row.cells[0].textContent=course}});
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{decorateHome();decorateInstitutional()},50)}
  function start(){
    patchApi();refresh();
    const list=document.getElementById('pciList');if(list&&!homeObserver){homeObserver=new MutationObserver(refresh);homeObserver.observe(list,{childList:true,subtree:false})}
    const host=document.getElementById('v48InstitutionalContent');if(host&&!institutionalObserver){institutionalObserver=new MutationObserver(()=>setTimeout(decorateInstitutional,30));institutionalObserver.observe(host,{childList:true,subtree:false})}
  }
  document.addEventListener('change',e=>{const input=e.target.closest('[data-v48-course]');if(!input)return;const card=input.closest('.pci-card'),orientation=card?.querySelector('h3')?.textContent?.trim();if(!orientation)return;syncCount(orientation,Number(input.dataset.v48Course),Number(input.value));setTimeout(()=>renderPanel(card,orientation),0)},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-v48-home],#openInstitutional,.back'))setTimeout(refresh,80)},true);
  patchApi();
  window.addEventListener('pci-app-ready',()=>setTimeout(start,350));
  window.PCICustomDivisionsV57={cfg,labels,syncCount,setLabels,decorateHome,decorateInstitutional};
})();
