(() => {
  const $id=id=>document.getElementById(id);
  const root=()=>state.institutional||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const semester=()=>Number($id('v53Semester')?.value)||1;
  function latest(){const list=root().scheduleVersions?.[`S${semester()}`]||[];return [...list].reverse().find(x=>x.engine==='v53')||null}
  function days(s){return s?.grid?.days||[]}
  function slots(s){return s?.grid?.slots||[]}
  function table(s,mode,id,label){
    const entries=s.entries||[],ds=days(s),ss=slots(s);
    const match=(e,d,p)=>{if(e.day!==d||Number(e.period)!==Number(p))return false;if(mode==='course')return e.type==='class'&&e.courseKey===id;return e.teacherId===id||(e.type==='area'&&(e.teacherIds||[]).includes(id))};
    const cell=e=>e.type==='area'?`<strong>${esc(e.label)}</strong><small>Trabajo institucional común</small>`:e.type==='institutional'?`<strong>${esc(e.label)}</strong><small>Trabajo fuera de curso</small>`:`<strong>${esc(e.subjectName||e.label)}</strong><small>${mode==='course'?esc(e.teacherName):esc(`${e.orientation} · ${e.course}`)}</small>`;
    return`<section class="v61-print-section"><h2>${esc(label)}</h2><table class="v61-print-table"><thead><tr><th>HC</th>${ds.map(d=>`<th>${esc(d.label)}</th>`).join('')}</tr></thead><tbody>${ss.map((slot,i)=>{const p=i+1;return`<tr><th>${p}.ª<br><small>${esc(slot.start||'')}–${esc(slot.end||'')}</small></th>${ds.map(d=>{const rows=entries.filter(e=>match(e,d.id,p));return`<td>${rows.map(cell).join('<hr>')}</td>`}).join('')}</tr>`}).join('')}</tbody></table></section>`;
  }
  function openPrint(){
    const s=latest(),content=$id('printContent'),modal=$id('printModal');if(!s||!content||!modal){toast('Primero generá un horario.',true);return}
    const courses=[...new Map((s.entries||[]).filter(e=>e.type==='class').map(e=>[e.courseKey,`${e.orientation} · ${e.course}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'));
    const teachers=Object.values(root().teachers||{}).filter(t=>(s.entries||[]).some(e=>e.teacherId===t.id||(e.teacherIds||[]).includes(t.id))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
    content.className='print-preview-wrap';content.innerHTML=`<article class="pci-print-sheet"><div class="pci-print-kicker">Implementación institucional</div><h1>Horarios · ${semester()===1?'1.er':'2.º'} cuatrimestre</h1><div class="pci-print-meta"><div><strong>Escuela</strong>${esc(state.school)}</div><div><strong>Generado</strong>${new Date(s.createdAt).toLocaleString('es-AR')}</div><div><strong>Estado</strong>${s.status==='active'?'Vigente':'Borrador'}</div><div><strong>Motor</strong>${esc(s.generator||s.engine||'')}</div></div><h1 class="v61-print-break-title">Horarios por curso</h1>${courses.map(([id,l])=>table(s,'course',id,l)).join('')}<h1 class="v61-print-break">Horarios por docente</h1>${teachers.map(t=>table(s,'teacher',t.id,t.name)).join('')}</article>`;modal.classList.add('open');
  }
  function decorate(){const section=$id('v53Scheduler');if(!section)return;let actions=section.querySelector('.v61-print-actions');if(actions)return;actions=document.createElement('div');actions.className='v53-actions v61-print-actions';actions.innerHTML='<button type="button" data-v61-print>Imprimir horarios</button>';const anchor=section.querySelector('.v61-actions')||section.querySelector('.v53-actions');anchor?.after(actions);actions.querySelector('[data-v61-print]').onclick=openPrint}
  const style=document.createElement('style');style.textContent='.v61-print-section{margin:16px 0;break-inside:avoid-page}.v61-print-section h2{font-size:1rem}.v61-print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.55rem}.v61-print-table th,.v61-print-table td{border:1px solid #b8c5ce;padding:4px;vertical-align:top}.v61-print-table th{background:#edf3f8}.v61-print-table td strong{display:block}.v61-print-table td small{display:block;color:#5f7382;margin-top:2px}.v61-print-table hr{border:0;border-top:1px solid #d8e1e8}.v61-print-break{break-before:page;margin-top:0}@media print{.v61-print-section{break-inside:avoid-page}.v61-print-break{break-before:page}}';document.head.appendChild(style);
  const obs=new MutationObserver(()=>setTimeout(decorate,40));window.addEventListener('pci-app-ready',()=>setTimeout(()=>{decorate();const host=$id('v48InstitutionalContent');if(host)obs.observe(host,{childList:true,subtree:true})},500));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(decorate,240)},true);
  window.PCISchedulePrintV61={openPrint,decorate};
})();
