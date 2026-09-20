(() => {
  const $id=id=>document.getElementById(id);
  const work=()=>window.PCIInstitutionalWorkV53||null;
  let observer=null,timer=null;
  const slug=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const AREA_BY_SLOT={
    lengua:'Lengua y Literatura',
    matematica:'Matemática',
    adicional:'Lenguas Adicionales',
    naturales:'Ciencias Naturales',
    socialA:'Ciencias Sociales',
    socialB:'Ciencias Sociales',
    artes:'Artes',
    tecnologias:'Tecnología / Informática',
    ef:'Educación Física',
    otros:'Otros formatos pedagógicos'
  };

  function inst(){
    state.institutional=state.institutional||{};
    state.institutional.areaTeams=state.institutional.areaTeams||{};
    state.institutional.assignments=state.institutional.assignments||{};
    state.institutional.teachers=state.institutional.teachers||{};
    return state.institutional;
  }
  function slotKey(slot){return String(slot||'').replace(/-c\d+$/,'').replace(/-n\d+$/,'')}
  function addMember(map,id,name,teacherId,kind,orientation=''){
    if(!teacherId)return;
    if(!map.has(id))map.set(id,{id,name,kind,orientation,teacherIds:new Set()});
    map.get(id).teacherIds.add(teacherId);
  }

  function deriveTeams(){
    const root=inst(),teams=new Map();
    for(const orientation of state.selected||[]){
      const map=ensure(orientation),subjectAreas=new Map();
      for(const [slot,ids] of Object.entries(map.placements||{})){
        const area=AREA_BY_SLOT[slotKey(slot)];
        if(!area)continue;
        for(const sid of ids||[]){if(!subjectAreas.has(sid))subjectAreas.set(sid,new Set());subjectAreas.get(sid).add(area)}
      }
      for(const row of window.PCIInstitutionalV48?.implementationRows?.(orientation)||[]){
        const teacherId=root.assignments[row.instanceId];if(!teacherId)continue;
        for(const area of subjectAreas.get(row.subjectId)||[]){
          const id=`auto-fg-${slug(area)}`;addMember(teams,id,`Formación General · ${area}`,teacherId,'FG');
        }
        if(row.origin==='FO'){
          const id=`auto-fo-${slug(orientation)}`;addMember(teams,id,`Formación Orientada · ${orientation}`,teacherId,'FO',orientation);
        }
      }
    }
    const previous=root.areaTeams||{},next={};
    for(const team of teams.values()){
      const old=previous[team.id]||{};
      const h=[3,4].includes(Number(old.coordinationHours))?Number(old.coordinationHours):3;
      next[team.id]={id:team.id,name:team.name,coordinationHours:h,teacherIds:[...team.teacherIds],autoDerived:true,kind:team.kind,orientation:team.orientation||''};
    }
    root.areaTeams=next;
    return next;
  }

  function teamsHtml(){
    const root=inst(),teams=Object.values(root.areaTeams||{}).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    if(!teams.length)return '<div class="v48-empty">Los equipos se arman automáticamente cuando asignás docentes a las materias y cursos de Fase 1.</div>';
    return `<div class="v53-teams">${teams.map(team=>`<article class="v53-team"><div class="v53-team-head"><div><h3>${esc(team.name)}</h3><small>${team.kind==='FO'?'Equipo de la orientación':'Área de Formación General'} · coincidencia semanal obligatoria</small></div><select data-v54-hours="${esc(team.id)}"><option value="3" ${Number(team.coordinationHours)===3?'selected':''}>3 HC</option><option value="4" ${Number(team.coordinationHours)===4?'selected':''}>4 HC</option></select></div><div style="margin-top:9px;font-size:.59rem;line-height:1.45;color:var(--muted)"><strong style="color:var(--ink)">Docentes detectados automáticamente:</strong><br>${(team.teacherIds||[]).map(id=>esc(root.teachers[id]?.name||'Docente')).join(' · ')||'Sin docentes asignados todavía'}</div></article>`).join('')}</div>`;
  }

  function decorate(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    deriveTeams();
    const section=$id('v53Workload');if(!section)return;
    const teamBox=section.querySelector('.v53-teams');if(teamBox)teamBox.outerHTML=teamsHtml();
    section.querySelector('.v53-add-area')?.remove();
    const headings=[...section.querySelectorAll('h2')];
    const h=headings.find(x=>x.textContent.includes('Coincidencia obligatoria por área'));
    if(h){h.textContent='Coincidencia semanal por área y orientación';const p=h.nextElementSibling;if(p?.tagName==='P')p.textContent='El sistema detecta automáticamente, a partir de las asignaciones de Fase 1, qué docentes integran cada área de Formación General y cada Formación Orientada. Cada equipo debe compartir una franja semanal fuera de clases de 3 o 4 horas cátedra.'}
    section.querySelectorAll('[data-v54-hours]').forEach(sel=>sel.onchange=()=>{const team=inst().areaTeams[sel.dataset.v54Hours];if(team){team.coordinationHours=Number(sel.value);save();work()?.renderScheduler?.();decorate()}});
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{deriveTeams();decorate();work()?.renderScheduler?.()},70)}
  function start(){refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})}}
  document.addEventListener('change',e=>{if(e.target.closest('[data-v48-assignment]'))setTimeout(refresh,90)},true);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,180)},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,260));
  window.PCIAutoAreaCoincidenceV54={deriveTeams,decorate};
})();
