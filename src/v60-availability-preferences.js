(() => {
  const $id=id=>document.getElementById(id);
  const base=()=>window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  let selectedTeacher=null,timer=null;
  const key=(day,p)=>`${day}:${p}`;
  function root(){
    state.institutional=state.institutional||{};
    state.institutional.availabilityPreferences=state.institutional.availabilityPreferences||{};
    state.institutional.availability=state.institutional.availability||{};
    return state.institutional;
  }
  const teachers=()=>Object.values(root().teachers||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const days=()=>grid()?.days?.()||base()?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||base()?.periods?.()||8));
  const label=p=>grid()?.slotLabel?.(p)||base()?.slotLabel?.(p)||`Hora ${p}`;
  function status(teacherId,day,p){
    const pref=root().availabilityPreferences?.[teacherId]?.[key(day,p)];
    if(pref==='avoid'||pref==='unavailable')return pref;
    if(root().availability?.[teacherId]?.[key(day,p)]===false)return'unavailable';
    return'available';
  }
  function setStatus(teacherId,day,p,value){
    const r=root();r.availabilityPreferences[teacherId]=r.availabilityPreferences[teacherId]||{};
    if(value==='available')delete r.availabilityPreferences[teacherId][key(day,p)];
    else r.availabilityPreferences[teacherId][key(day,p)]=value;
    if(value==='unavailable'){r.availability[teacherId]=r.availability[teacherId]||{};r.availability[teacherId][key(day,p)]=false}else if(r.availability[teacherId])delete r.availability[teacherId][key(day,p)];
    save();
  }
  const available=(teacherId,day,p)=>status(teacherId,day,p)!=='unavailable';
  const penalty=(teacherId,day,p)=>status(teacherId,day,p)==='avoid'?8:0;
  const next=s=>s==='available'?'avoid':s==='avoid'?'unavailable':'available';

  const style=document.createElement('style');
  style.textContent=`#v49Availability{display:none!important}.v60-av-section{margin-top:16px;padding:17px}.v60-av-section h2{margin:4px 0 5px}.v60-av-section>p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.4}.v60-av-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}.v60-av-controls label{display:grid;gap:4px;font-size:.62rem;font-weight:850}.v60-av-controls select{padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff}.v60-av-wrap{overflow:auto;margin-top:12px;border:1px solid var(--line);border-radius:13px}.v60-av-grid{width:100%;min-width:700px;border-collapse:collapse;font-size:.66rem}.v60-av-grid th{padding:8px;background:var(--band);font-size:.58rem}.v60-av-grid td{padding:5px;border-top:1px solid var(--line);text-align:center}.v60-av-period{font-weight:900;background:#fafcfd;white-space:nowrap}.v60-av-period small{display:block;color:var(--muted);font-size:.5rem}.v60-av-slot{width:100%;min-height:36px;border:1px solid #b9d9d5;border-radius:8px;background:var(--mint-soft);color:var(--mint-dark);font-size:.56rem;font-weight:900}.v60-av-slot.avoid{border-color:#dfc476;background:#fff8df;color:#775b0c}.v60-av-slot.unavailable{border-color:#e0bdc5;background:var(--danger-soft);color:var(--danger)}.v60-av-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:9px;font-size:.6rem;color:var(--muted)}.v60-av-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.v60-av-actions button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:6px 9px;font-size:.58rem;font-weight:850}`;
  document.head.appendChild(style);

  function render(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let section=$id('v60Availability');if(!section){section=document.createElement('section');section.id='v60Availability';section.className='card v60-av-section';const scheduler=$id('v53Scheduler')||$id('v50Scheduler');if(scheduler)host.insertBefore(section,scheduler);else host.appendChild(section)}
    const list=teachers();
    if(!list.length){section.innerHTML='<div class="eyebrow">Disponibilidad docente</div><h2>Disponibilidad y preferencias</h2><div class="v48-empty">Primero cargá docentes.</div>';return}
    if(!selectedTeacher||!root().teachers[selectedTeacher])selectedTeacher=list[0].id;
    const ds=days(),n=periods();
    const text=s=>s==='available'?'Disponible':s==='avoid'?'Preferentemente no':'No disponible';
    section.innerHTML=`<div class="eyebrow">Disponibilidad docente</div><h2>Disponibilidad y preferencias</h2><p>Disponible es libre para asignar. “Preferentemente no” es una preferencia que el optimizador evita cuando existe otra solución. “No disponible” es una restricción dura.</p><div class="v60-av-controls"><label>Docente<select id="v60AvTeacher">${list.map(t=>`<option value="${t.id}" ${t.id===selectedTeacher?'selected':''}>${t.name}</option>`).join('')}</select></label></div><div class="v60-av-wrap"><table class="v60-av-grid"><thead><tr><th>Hora cátedra</th>${ds.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${Array.from({length:n},(_,i)=>{const p=i+1;return`<tr><td class="v60-av-period">${p}.ª HC<small>${label(p)}</small></td>${ds.map(([d])=>{const s=status(selectedTeacher,d,p);return`<td><button type="button" class="v60-av-slot ${s}" data-day="${d}" data-period="${p}">${text(s)}</button></td>`}).join('')}</tr>`}).join('')}</tbody></table></div><div class="v60-av-legend"><span>Disponible</span><span>Preferentemente no</span><span>No disponible</span></div><div class="v60-av-actions"><button data-all="available">Todo disponible</button><button data-all="avoid">Todo preferentemente no</button><button data-all="unavailable">Todo no disponible</button></div>`;
    $id('v60AvTeacher').onchange=e=>{selectedTeacher=e.target.value;render()};
    section.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const d=b.dataset.day,p=Number(b.dataset.period);setStatus(selectedTeacher,d,p,next(status(selectedTeacher,d,p)));render()});
    section.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{for(const[d]of ds)for(let p=1;p<=n;p++)setStatus(selectedTeacher,d,p,b.dataset.all);render()});
  }
  function patch(){const a=base();if(!a||a.__v60Preferences)return;a.available=available;a.preferencePenalty=penalty;a.status=status;a.setStatus=setStatus;a.__v60Preferences=true}
  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{patch();render()},70)}
  function start(){refresh()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,320));
  window.addEventListener('pci-schedule-grid-changed',refresh);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,180)},true);
  window.PCIAvailabilityPreferencesV60={status,setStatus,available,penalty,render};
})();
