(() => {
  const $id=id=>document.getElementById(id);
  const DEFAULT_DAYS=[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  let selectedTeacher=null,observer=null,refreshTimer=null;
  const scheduleGrid=()=>window.PCIScheduleConfigV51||null;
  const inst=()=>{state.institutional=state.institutional||{};state.institutional.availability=state.institutional.availability||{};return state.institutional};
  const teachers=()=>Object.values(inst().teachers||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const days=()=>scheduleGrid()?.days?.()||DEFAULT_DAYS;
  const periods=()=>Math.max(1,Number(scheduleGrid()?.periodCount?.()||8));
  const slotLabel=p=>scheduleGrid()?.slotLabel?.(p)||`Hora ${p}`;
  const key=(day,p)=>`${day}:${p}`;
  const available=(teacherId,day,p)=>inst().availability?.[teacherId]?.[key(day,p)]!==false;
  function setAvailable(teacherId,day,p,value){const root=inst();root.availability[teacherId]=root.availability[teacherId]||{};if(value)delete root.availability[teacherId][key(day,p)];else root.availability[teacherId][key(day,p)]=false;save()}

  const style=document.createElement('style');style.textContent=`
    .v49-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}.v49-controls label{display:grid;gap:4px;font-size:.62rem;font-weight:850}.v49-controls select{padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}.v49-grid-meta{padding:8px 10px;border-radius:9px;background:var(--band);font-size:.61rem;color:var(--muted)}
    .v49-grid-wrap{overflow:auto;margin-top:12px;border:1px solid var(--line);border-radius:13px}.v49-grid{width:100%;min-width:700px;border-collapse:collapse;font-size:.66rem}.v49-grid th{padding:8px;background:var(--band);font-size:.58rem;text-transform:uppercase;letter-spacing:.04em}.v49-grid td{padding:5px;border-top:1px solid var(--line);text-align:center}.v49-period{font-weight:900;background:#fafcfd;white-space:nowrap}.v49-period small{display:block;margin-top:2px;color:var(--muted);font-size:.5rem;font-weight:700}.v49-slot{width:100%;min-height:34px;border:1px solid #b9d9d5;border-radius:8px;background:var(--mint-soft);color:var(--mint-dark);font-size:.6rem;font-weight:900}.v49-slot.off{border-color:#e0bdc5;background:var(--danger-soft);color:var(--danger)}
    .v49-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:.61rem;color:var(--muted)}.v49-legend span{display:inline-flex;align-items:center;gap:5px}.v49-dot{width:9px;height:9px;border-radius:50%;background:var(--mint)}.v49-dot.off{background:#d57a8d}
    .v49-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v49-actions button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:.62rem;font-weight:850;color:var(--ink)}
  `;document.head.appendChild(style);

  function renderGrid(section){
    const list=teachers();if(!list.length){section.querySelector('[data-v49-body]').innerHTML='<div class="v48-empty">Primero cargá docentes en la sección anterior.</div>';return}
    if(!selectedTeacher||!inst().teachers?.[selectedTeacher])selectedTeacher=list[0].id;
    const body=section.querySelector('[data-v49-body]'),n=periods(),activeDays=days();
    body.innerHTML=`<div class="v49-controls"><label>Docente<select id="v49Teacher">${list.map(t=>`<option value="${esc(t.id)}" ${t.id===selectedTeacher?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><div class="v49-grid-meta">Jornada actual: <strong>${n} horas cátedra</strong> · ${activeDays.map(([,l])=>l).join(', ')}</div></div><div class="v49-grid-wrap"><table class="v49-grid"><thead><tr><th>Hora cátedra</th>${activeDays.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${Array.from({length:n},(_,i)=>{const p=i+1;return`<tr><td class="v49-period">${p}.ª HC<small>${esc(slotLabel(p))}</small></td>${activeDays.map(([d])=>{const ok=available(selectedTeacher,d,p);return`<td><button type="button" class="v49-slot ${ok?'':'off'}" data-v49-slot="${d}" data-period="${p}">${ok?'Disponible':'No disponible'}</button></td>`}).join('')}</tr>`}).join('')}</tbody></table></div><div class="v49-legend"><span><i class="v49-dot"></i> Disponible para asignar</span><span><i class="v49-dot off"></i> Bloqueo declarado por el docente</span></div><div class="v49-actions"><button type="button" data-v49-all="on">Marcar todo disponible</button><button type="button" data-v49-all="off">Marcar todo no disponible</button></div>`;
    $id('v49Teacher').onchange=e=>{selectedTeacher=e.target.value;renderGrid(section)};
    body.querySelectorAll('[data-v49-slot]').forEach(b=>b.onclick=()=>{const d=b.dataset.v49Slot,p=Number(b.dataset.period),next=!available(selectedTeacher,d,p);setAvailable(selectedTeacher,d,p,next);renderGrid(section)});
    body.querySelectorAll('[data-v49-all]').forEach(b=>b.onclick=()=>{const value=b.dataset.v49All==='on';for(const[d]of activeDays)for(let p=1;p<=n;p++)setAvailable(selectedTeacher,d,p,value);renderGrid(section)});
  }

  function ensureSection(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let section=$id('v49Availability');if(!section){section=document.createElement('section');section.id='v49Availability';section.className='card v48-section';section.innerHTML='<div class="eyebrow">Disponibilidad docente</div><h2>Disponibilidad sobre la jornada real</h2><p>Cada docente parte como disponible. Marcá solamente las horas cátedra en las que no puede trabajar. Los horarios mostrados provienen de la configuración institucional y no modifican Fase 1 ni Fase 2.</p><div data-v49-body></div>';host.appendChild(section)}
    renderGrid(section);
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(ensureSection,40)}
  function start(){scheduleRefresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(scheduleRefresh);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,80));
  window.addEventListener('pci-schedule-grid-changed',scheduleRefresh);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional,[data-v48-panel]'))setTimeout(start,80)},true);
  window.PCIAvailabilityV49={get DAYS(){return days()},days,periods,slotLabel,available,setAvailable,ensureSection};
})();
