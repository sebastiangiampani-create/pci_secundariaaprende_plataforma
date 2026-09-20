(()=>{
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=()=>{state.institutional=state.institutional||{};return state.institutional};
  const days=()=>window.PCIScheduleConfigV51?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(window.PCIScheduleConfigV51?.periodCount?.()||10));
  const label=p=>window.PCIScheduleConfigV51?.slotLabel?.(p)||`${p}.ª HC`;
  let mode='year',year='1',teacher='';

  function sem(){return Number($('v53Semester')?.value||1)||1}
  function currentSchedule(){
    const s=sem(),arr=root().scheduleVersions?.[`S${s}`]||[];
    if(arr.length)return arr.at(-1);
    return (root().annualScheduleVersions||[]).at(-1)||null;
  }
  function classInfo(e,s){
    if(e.type==='class')return{teacherId:e.teacherId,teacherName:e.teacherName||'',name:e.subjectName||e.label||'',course:e.course||'',orientation:e.orientation||''};
    if(e.type==='classpair'){
      const u=s===1?e.s1:e.s2;if(!u)return null;
      return{teacherId:u.teacherId,teacherName:u.teacherName||'',name:u.name||'',course:e.course||u.course||'',orientation:e.orientation||u.orientation||''};
    }
    return null;
  }
  const yearOf=c=>{const m=String(c||'').match(/[1-5]/);return m?m[0]:''};
  function teachers(){return Object.values(root().teachers||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'))}
  function latestEntries(){return currentSchedule()?.entries||[]}

  function eventsAt(d,p,filter){return latestEntries().filter(e=>e.day===d&&Number(e.period)===p).map(filter).filter(Boolean)}
  function cell(items){return items.length?items.map(x=>`<div class="sv-event ${x.kind||''}"><strong>${esc(x.title)}</strong>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div>`).join(''):'<span class="sv-empty">—</span>'}
  function grid(filter){
    return `<div class="sv-wrap"><table class="sv-grid"><thead><tr><th>HC</th>${days().map(([,n])=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${Array.from({length:periods()},(_,i)=>{const p=i+1;return`<tr><th>${esc(label(p))}</th>${days().map(([d])=>`<td>${cell(eventsAt(d,p,filter))}</td>`).join('')}</tr>`}).join('')}</tbody></table></div>`;
  }
  function yearView(){const s=sem();return grid(e=>{const u=classInfo(e,s);if(!u||yearOf(u.course)!==year)return null;return{title:u.name,sub:`${u.teacherName}${u.course?` · ${u.course}`:''}`}})}
  function teacherView(){const s=sem();return grid(e=>{const u=classInfo(e,s);if(u?.teacherId===teacher)return{title:u.name,sub:`${u.course}${u.orientation?` · ${u.orientation}`:''}`,kind:'class'};if(e.type==='area'&&(e.teacherIds||[]).includes(teacher))return{title:e.label||'Reunión de equipo',sub:'Planificación común',kind:'team'};if(e.type==='institutional'&&e.teacherId===teacher)return{title:e.label||'Extra clase',sub:/planificaci[oó]n/i.test(e.label||'')?'Planificación':'Trabajo institucional',kind:'outside'};return null})}
  function meetingsView(){
    const list=[];
    for(const e of latestEntries()){
      if(e.type==='area')list.push({day:e.day,period:e.period,label:e.label||'Reunión de equipo',names:(e.teacherNames||[]).join(' · ')});
      else if(e.type==='institutional'&&/planificaci[oó]n/i.test(String(e.label||'')))list.push({day:e.day,period:e.period,label:e.label,names:e.teacherName||root().teachers?.[e.teacherId]?.name||''});
    }
    if(!list.length)return'<div class="sv-note">Todavía no hay reuniones de equipo ubicadas en el horario generado.</div>';
    const dayName=Object.fromEntries(days());
    return `<div class="sv-meetings">${list.map(x=>`<div><strong>${esc(x.label)}</strong><span>${esc(dayName[x.day]||x.day)} · ${esc(label(x.period))}</span><small>${esc(x.names)}</small></div>`).join('')}</div>`;
  }
  function render(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;
    const sched=$('v68AnnualScheduler')||$('v53Scheduler')||[...host.querySelectorAll('section')].find(x=>/horario/i.test(x.querySelector('h2')?.textContent||''));
    if(!sched)return;
    let box=$('scheduleViews');if(!box){box=document.createElement('section');box.id='scheduleViews';box.className='card sv-section';sched.after(box)}
    const s=currentSchedule();
    if(!s){box.innerHTML='<div class="eyebrow">Horarios</div><h2>Vistas del horario</h2><div class="sv-note">Generá primero el horario del cuatrimestre.</div>';return}
    const ts=teachers();if(!teacher||!root().teachers?.[teacher])teacher=ts[0]?.id||'';
    box.innerHTML=`<div class="eyebrow">Horarios del ${sem()===1?'1.er':'2.º'} cuatrimestre</div><h2>Vistas del horario</h2><div class="sv-tabs"><button data-sv="year" class="${mode==='year'?'active':''}">Por año</button><button data-sv="teacher" class="${mode==='teacher'?'active':''}">Por docente</button><button data-sv="teams" class="${mode==='teams'?'active':''}">Reuniones de equipo</button></div><div class="sv-controls">${mode==='year'?`<label>Año<select id="svYear">${[1,2,3,4,5].map(n=>`<option value="${n}" ${year==n?'selected':''}>${n}.º año</option>`).join('')}</select></label>`:''}${mode==='teacher'?`<label>Docente<select id="svTeacher">${ts.map(t=>`<option value="${esc(t.id)}" ${teacher===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`:''}</div><div class="sv-content">${mode==='year'?yearView():mode==='teacher'?teacherView():meetingsView()}</div>`;
    box.querySelectorAll('[data-sv]').forEach(b=>b.onclick=()=>{mode=b.dataset.sv;render()});
    $('svYear')?.addEventListener('change',e=>{year=e.target.value;render()});
    $('svTeacher')?.addEventListener('change',e=>{teacher=e.target.value;render()});
  }
  let timer=null;const scheduleRender=()=>{clearTimeout(timer);timer=setTimeout(render,100)};
  document.addEventListener('change',e=>{if(e.target.closest('#v53Semester,#v65Semester'))scheduleRender()},true);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional,#openInstitutionalGeneral,[data-v61-generate],[data-v68-generate]'))setTimeout(render,300)},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(render,900));
  setInterval(()=>{if($('institutional')?.classList.contains('active'))render()},1800);
  const style=document.createElement('style');style.textContent=`.sv-section{margin-top:16px;padding:16px}.sv-section h2{margin:4px 0 8px}.sv-tabs{display:flex;gap:7px;flex-wrap:wrap}.sv-tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-weight:850}.sv-tabs button.active{background:var(--ink);color:#fff}.sv-controls{margin:10px 0}.sv-controls label{display:grid;gap:4px;max-width:360px;font-size:.62rem;font-weight:850}.sv-controls select{padding:8px;border:1px solid var(--line);border-radius:9px;background:#fff}.sv-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}.sv-grid{width:100%;min-width:760px;border-collapse:collapse;font-size:.6rem}.sv-grid th{background:var(--band);padding:7px;border-bottom:1px solid var(--line)}.sv-grid td{min-width:125px;vertical-align:top;padding:5px;border-top:1px solid var(--line);border-left:1px solid var(--line)}.sv-event{padding:6px;border-radius:7px;background:#f5f8fa;margin:2px}.sv-event strong,.sv-event small{display:block}.sv-event.team{background:#eef8f5}.sv-event.outside{background:#fff8df}.sv-empty{color:var(--muted)}.sv-note{padding:12px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}.sv-meetings{display:grid;gap:7px}.sv-meetings>div{padding:10px;border:1px solid var(--line);border-radius:10px}.sv-meetings strong,.sv-meetings span,.sv-meetings small{display:block}.sv-meetings span,.sv-meetings small{margin-top:3px;color:var(--muted)}@media(max-width:780px){.sv-tabs button{flex:1 1 auto}.sv-section{padding:12px}}`;document.head.appendChild(style);
  window.PCIScheduleViews={render};
})();