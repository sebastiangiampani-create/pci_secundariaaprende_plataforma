(() => {
  const API=()=>window.PCIPhase2V28||null;
  const SOURCE='data/tutoria.json';
  let catalog=null,loading=null,observer=null,timer=null,selected=new Set();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function load(){
    if(catalog)return Promise.resolve(catalog);
    if(loading)return loading;
    loading=fetch(`${SOURCE}?v=20260914-69`,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('No se pudo cargar la base oficial de contenidos de Tutoría.');return r.json()}).then(rows=>{
      catalog=(Array.isArray(rows)?rows:[]).map(x=>({id:`tutoria:${x.id}`,sourceId:x.id,component:'FG',area:'Tutoría',subject:'Tutoría',axis:String(x.axis||'').replace(/^Eje:\s*/i,''),text:x.text||'',allowedLevels:Array.isArray(x.allowedLevels)?x.allowedLevels:[1,2],officialTutor:true}));
      return catalog;
    }).finally(()=>{loading=null});
    return loading;
  }
  function apiState(){const api=API();return api?.p2?.()||null}
  function target(){const api=API(),id=api?.getTargetGroup?.();return id?api.gb?.(id):null}
  function hasTutor(g){if(!g)return false;return (API()?.members?.(g)||[]).some(s=>norm(s?.name)==='tutoria')}
  function tutorGroups(){return (API()?.groups?.()||[]).filter(hasTutor)}
  function installRows(rows){
    const p=apiState();if(!p)return;
    p.customContents=Array.isArray(p.customContents)?p.customContents:[];
    const existing=new Set(p.customContents.map(x=>x.id));
    for(const row of rows)if(!existing.has(row.id))p.customContents.push({...row});
  }
  function usedIds(){const out=new Set();for(const g of tutorGroups())for(const id of g.data?.contents||[])if(String(id).startsWith('tutoria:'))out.add(id);return out}
  function renderCoverage(rows){
    const n=document.getElementById('v47coverageCount'),b=document.getElementById('v47coverageBar');if(!n||!b)return;
    const ids=new Set(rows.map(x=>x.id)),used=[...usedIds()].filter(id=>ids.has(id)).length,total=rows.length,p=total?Math.round(used/total*100):0;
    n.textContent=`${used} de ${total} contenidos oficiales de Tutoría cubiertos · ${p}%`;b.style.width=`${p}%`;
  }
  function visibleRows(rows,g){
    let out=rows.filter(x=>x.allowedLevels.includes(Number(g.year)));
    const q=norm(document.getElementById('v28search')?.value),subject=document.getElementById('v28subject')?.value||'',axis=document.getElementById('v28axis')?.value||'',pending=document.getElementById('v28pending')?.checked;
    if(q)out=out.filter(x=>norm(`${x.subject} ${x.axis} ${x.text}`).includes(q));
    if(subject)out=out.filter(x=>x.subject===subject);
    if(axis)out=out.filter(x=>x.axis===axis);
    if(pending){const used=usedIds();out=out.filter(x=>!used.has(x.id))}
    return out;
  }
  function populateFilters(rows,g){
    const subject=document.getElementById('v28subject'),axis=document.getElementById('v28axis');if(!subject||!axis)return;
    const currentSubject=subject.value,currentAxis=axis.value,eligible=rows.filter(x=>x.allowedLevels.includes(Number(g.year)));
    const subjects=[...new Set(eligible.map(x=>x.subject))].sort((a,b)=>a.localeCompare(b,'es')),axes=[...new Set(eligible.map(x=>x.axis).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    subject.innerHTML='<option value="">Todas</option>'+subjects.map(x=>`<option ${x===currentSubject?'selected':''}>${esc(x)}</option>`).join('');
    axis.innerHTML='<option value="">Todos</option>'+axes.map(x=>`<option ${x===currentAxis?'selected':''}>${esc(x)}</option>`).join('');
  }
  function assignSelected(rows,g){
    if(!g||!selected.size)return;
    g.data.contents=Array.isArray(g.data.contents)?g.data.contents:[];let added=0;
    const valid=new Set(rows.filter(x=>x.allowedLevels.includes(Number(g.year))).map(x=>x.id));
    for(const id of selected)if(valid.has(id)&&!g.data.contents.includes(id)){g.data.contents.push(id);added++}
    selected.clear();save();API()?.renderGroups?.();setTimeout(schedule,50);toast(added?`${added} contenido${added===1?'':'s'} de Tutoría asignado${added===1?'':'s'}.`:'No había contenidos nuevos para asignar.',!added);
  }
  async function decorate(){
    const board=document.getElementById('v28board'),g=target();if(!board||board.hidden||!hasTutor(g))return;
    try{
      const rows=await load();installRows(rows);renderCoverage(rows);
      const tabs=board.querySelector('.v28-tabs');if(tabs)tabs.style.display='none';
      const meta=document.getElementById('v28meta');if(meta)meta.textContent=`${rows.filter(x=>x.allowedLevels.includes(Number(g.year))).length} contenidos oficiales de Tutoría disponibles para Nivel ${g.year}.`;
      populateFilters(rows,g);
      const list=document.getElementById('v28list'),assign=document.getElementById('v28assign'),count=document.getElementById('v28count'),targetLabel=document.getElementById('v28target');if(!list||!assign)return;
      const visible=visibleRows(rows,g),used=usedIds();
      list.innerHTML=visible.length?visible.map(c=>`<div class="v28-content ${selected.has(c.id)?'sel':''} ${used.has(c.id)?'used':''}" draggable="true" data-v69-tutor="${esc(c.id)}"><input type="checkbox" ${selected.has(c.id)?'checked':''} tabindex="-1"><div><small>${esc(c.subject)} · ${esc(c.axis||'Sin eje')}</small><p>${esc(c.text)}</p>${used.has(c.id)?'<span class="v28-loc">Ya utilizado en Tutoría</span>':''}</div></div>`).join(''):'<div class="v28-empty">No hay contenidos de Tutoría que coincidan con los filtros.</div>';
      if(count)count.textContent=`${selected.size} seleccionado${selected.size===1?'':'s'}`;if(targetLabel)targetLabel.textContent=`Destino: ${g.data?.name||g.name}`;assign.disabled=!selected.size;assign.onclick=()=>assignSelected(rows,g);
      for(const id of['v28search','v28subject','v28axis','v28pending']){const el=document.getElementById(id);if(!el)continue;el.oninput=()=>renderTutorBag();el.onchange=()=>renderTutorBag()}
      list.querySelectorAll('[data-v69-tutor]').forEach(card=>{
        card.onclick=()=>{const id=card.dataset.v69Tutor;if(selected.has(id))selected.delete(id);else selected.add(id);renderTutorBag()};
        card.ondragstart=e=>{e.dataTransfer.setData('text/plain',card.dataset.v69Tutor)};
      });
    }catch(e){const meta=document.getElementById('v28meta');if(meta)meta.textContent=e.message||String(e)}
  }
  function renderTutorBag(){clearTimeout(timer);timer=setTimeout(decorate,20)}
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,90)}
  function start(){const proposal=document.getElementById('proposal');if(proposal&&!observer){observer=new MutationObserver(schedule);observer.observe(proposal,{childList:true,subtree:true})}schedule()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,250));
  window.addEventListener('pci-phase2-groups-rendered',schedule);
  document.addEventListener('click',e=>{if(e.target.closest('#openProposal,#v28back,#v28mback,[data-mg],.v28-group'))setTimeout(schedule,80)},true);
  window.PCITutoriaContentsV69={load,decorate,hasTutor,usedIds};
})();