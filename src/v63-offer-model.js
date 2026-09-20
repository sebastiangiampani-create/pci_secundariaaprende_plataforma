(() => {
  const $id=id=>document.getElementById(id);
  const loadsApi=()=>window.PCIDerivedTeacherLoadV52||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const workApi=()=>window.PCIInstitutionalWorkV53||null;
  let observer=null,timer=null,rendering=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const pctLabel=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');
  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};r.areaTeams=r.areaTeams||{};r.outsideWork=r.outsideWork||{};
    return r;
  }
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  const teams=()=>Object.values(root().areaTeams||{});
  const frontLoad=(tid,sem)=>Number(loadsApi()?.teacherLoads?.()?.[tid]?.[`S${sem}`]||0);
  const legacyRows=sem=>Object.values(root().outsideWork||{}).filter(x=>x.semester==='both'||Number(x.semester)===Number(sem));
  const explicitOutside=(tid,sem)=>legacyRows(sem).filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0);
  const teamHours=tid=>teams().filter(t=>(t.teacherIds||[]).includes(tid)).reduce((a,t)=>a+Number(t.coordinationHours||0),0);
  const singleMemberTeamRows=(tid,sem)=>teams().filter(t=>(t.teacherIds||[]).includes(tid)&&(t.teacherIds||[]).filter(id=>root().teachers[id]).length<2).map(t=>({id:`team-single-${t.id}-${tid}-S${sem}`,teacherId:tid,label:`Planificación de equipo · ${t.name}`,hours:Number(t.coordinationHours||0),semester:sem,__v56TeamSingle:true}));

  function outsideForShare(front,pct){
    const p=clamp(pct,0,50);
    if(!front||p<=0)return 0;
    if(p>=50)return front;
    return Math.floor(front*p/(100-p));
  }

  function offer(tid,sem){
    teamsApi()?.deriveTeams?.();
    const t=root().teachers[tid]||{},front=frontLoad(tid,sem),team=teamHours(tid),explicit=explicitOutside(tid,sem),minimumOutside=team+explicit,minimumTotal=front+minimumOutside;
    const maxOutside=front,maxTotal=front+maxOutside,minPct=minimumTotal?Math.ceil(minimumOutside/minimumTotal*100):0,conflict=front>0&&minimumOutside>maxOutside;
    t.offerPctBySemester=t.offerPctBySemester||{};
    const stored=Number(t.offerPctBySemester[`S${sem}`]);
    const defaultPct=Math.min(50,Math.max(0,minPct));
    const selectedRaw=Number.isFinite(stored)?clamp(stored,0,50):defaultPct;
    const selected=conflict?50:Math.max(minPct,selectedRaw);
    const targetOutside=conflict?minimumOutside:Math.max(minimumOutside,outsideForShare(front,selected));
    const configuredTotal=front+targetOutside;
    const additionalOutside=Math.max(0,targetOutside-minimumOutside);
    const actualPct=configuredTotal?targetOutside/configuredTotal*100:0;
    return{front,team,explicit,minimumOutside,minimumTotal,maxOutside,maxTotal,minPct,selected,targetOutside,configuredTotal,additionalOutside,actualPct,conflict};
  }

  function percentageOptions(minPct,current){
    if(minPct>50)return '<option value="50">50 %</option>';
    const set=new Set([minPct,current,50]);for(let p=0;p<=50;p+=5)if(p>=minPct)set.add(p);
    return [...set].filter(v=>v>=minPct&&v<=50).sort((a,b)=>a-b).map(v=>`<option value="${v}" ${Number(v)===Number(current)?'selected':''}>${v} %</option>`).join('');
  }

  const style=document.createElement('style');
  style.textContent=`
    #v53Workload{display:none!important}
    .v56-section{margin-top:16px;padding:17px}.v56-section h2{margin:4px 0 5px;font-size:1.05rem}.v56-section>p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.42}
    .v56-note{margin-top:11px;padding:11px 12px;border-radius:11px;background:var(--mint-soft);color:var(--mint-dark);font-size:.66rem;line-height:1.45}
    .v56-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:10px;margin-top:13px}.v56-card{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.v56-card h3{margin:0;font-size:.9rem}.v56-sem{margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}.v56-sem:first-of-type{margin-top:8px}.v56-sem-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.68rem;font-weight:900}
    .v56-metrics{display:grid;grid-template-columns:1fr auto;gap:5px 9px;margin-top:8px;font-size:.62rem}.v56-metrics span{color:var(--muted)}.v56-metrics strong{text-align:right}.v56-min{font-weight:900!important;color:var(--mint-dark)!important}.v56-max{font-weight:900!important;color:var(--ink)!important}
    .v56-choice{display:grid;grid-template-columns:1fr 120px;gap:8px;align-items:end;margin-top:9px}.v56-choice label{display:grid;gap:3px;font-size:.57rem;font-weight:850;color:var(--muted)}.v56-choice select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-weight:850}.v56-result{padding:8px 9px;border-radius:9px;background:var(--band);font-size:.6rem;line-height:1.35}.v56-result strong{display:block;font-size:.72rem;color:var(--ink)}
    .v56-conflict{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--danger-soft);color:var(--danger);font-size:.6rem;line-height:1.4;font-weight:750}
    .v56-teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px;margin-top:12px}.v56-team{border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--band)}.v56-team-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v56-team h3{margin:0;font-size:.78rem}.v56-team small{display:block;margin-top:3px;color:var(--muted);font-size:.57rem;line-height:1.35}.v56-team select{padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-weight:850}.v56-members{margin-top:8px;font-size:.59rem;line-height:1.45;color:var(--muted)}
    @media(max-width:720px){.v56-cards{grid-template-columns:1fr}.v56-choice{grid-template-columns:1fr}.v56-team-head{align-items:center}}
  `;
  document.head.appendChild(style);

  function teacherCard(t){
    const semesters=[1,2].map(sem=>{const o=offer(t.id,sem);return`<div class="v56-sem"><div class="v56-sem-head"><span>${sem===1?'1.er':'2.º'} cuatrimestre</span><span>${o.front} HC frente a curso</span></div><div class="v56-metrics"><span>Planificación/equipo obligatoria</span><strong>${o.team} HC</strong>${o.explicit?`<span>Otras tareas institucionales ya definidas</span><strong>${o.explicit} HC</strong>`:''}<span class="v56-min">Mínimo obligatorio fuera de curso</span><strong>${o.minimumOutside} HC</strong><span class="v56-min">Oferta mínima total</span><strong>${o.minimumTotal} HC</strong><span class="v56-max">Máximo fuera de curso (50 % del total)</span><strong>${o.maxOutside} HC</strong><span class="v56-max">Máximo total</span><strong>${o.maxTotal} HC</strong></div>${o.front?`<div class="v56-choice"><label>Tope de trabajo fuera de curso sobre la carga total<select data-v56-pct="${esc(t.id)}" data-sem="${sem}" ${o.conflict?'disabled':''}>${percentageOptions(o.minPct,o.selected)}</select></label><div class="v56-result"><strong>${o.configuredTotal} HC totales</strong>${o.targetOutside} HC fuera de curso · ${pctLabel(o.actualPct)} % de la carga total${o.additionalOutside?` · ${o.additionalOutside} HC por encima del mínimo obligatorio`:''}</div></div>`:'<div class="v56-result" style="margin-top:9px"><strong>Sin horas frente a curso asignadas</strong>La oferta se calcula cuando exista carga docente.</div>'}${o.conflict?`<div class="v56-conflict">Las ${o.minimumOutside} HC obligatorias fuera de curso superan el máximo de ${o.maxOutside} HC que permite mantener el trabajo fuera de curso dentro del 50 % de la carga total. Revisá la carga o la pertenencia a equipos antes de generar el horario.</div>`:''}</div>`}).join('');
    return`<article class="v56-card"><h3>${esc(t.name)}</h3>${semesters}</article>`;
  }

  function teamCards(){
    const list=teams().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
    if(!list.length)return '<div class="v48-empty">Los equipos aparecen automáticamente cuando asignás docentes a las materias de Fase 1.</div>';
    return`<div class="v56-teams">${list.map(team=>{const members=(team.teacherIds||[]).map(id=>root().teachers[id]?.name).filter(Boolean);return`<article class="v56-team"><div class="v56-team-head"><div><h3>${esc(team.name)}</h3><small>${team.kind==='FO'?'Formación Orientada':'Formación General'} · bloque semanal común obligatorio</small></div><select data-v56-team-hours="${esc(team.id)}"><option value="3" ${Number(team.coordinationHours)===3?'selected':''}>3 HC</option><option value="4" ${Number(team.coordinationHours)===4?'selected':''}>4 HC</option></select></div><div class="v56-members"><strong>Docentes:</strong> ${members.map(esc).join(' · ')||'sin docentes asignados todavía'}</div></article>`}).join('')}</div>`;
  }

  function setPct(tid,sem,value){
    const t=root().teachers[tid];if(!t)return;
    const o=offer(tid,sem);if(o.conflict)return;
    t.offerPctBySemester=t.offerPctBySemester||{};t.offerPctBySemester[`S${sem}`]=Math.max(o.minPct,clamp(value,0,50));t.maxTotalHours=null;save();render();workApi()?.renderScheduler?.();
  }
  function setTeamHours(id,value){const team=root().areaTeams[id];if(!team)return;team.coordinationHours=[3,4].includes(Number(value))?Number(value):3;save();render();workApi()?.renderScheduler?.()}

  function syntheticOutsideRows(sem){
    teamsApi()?.deriveTeams?.();
    const rows=[...legacyRows(sem)];
    for(const t of teachers()){
      const o=offer(t.id,sem);
      rows.push(...singleMemberTeamRows(t.id,sem));
      if(o.additionalOutside>0)rows.push({id:`offer-extra-${t.id}-S${sem}`,teacherId:t.id,label:'Trabajo institucional adicional',hours:o.additionalOutside,semester:sem,__v56Offer:true});
    }
    return rows;
  }

  function patchSchedulerApi(){
    const w=workApi();if(!w||w.__v56Patched)return;
    w.outsideRows=sem=>syntheticOutsideRows(Number(sem)||1);
    w.__v56Patched=true;
  }

  function render(){
    if(rendering)return;rendering=true;
    try{
      const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
      teamsApi()?.deriveTeams?.();patchSchedulerApi();
      for(const t of teachers()){t.maxTotalHours=null;delete t.extraPct}
      let section=$id('v56OfferModel');
      if(!section){section=document.createElement('section');section.id='v56OfferModel';section.className='card v56-section';const before=$id('v51ScheduleConfig')||$id('v49Availability')||$id('v53Scheduler')||$id('v50Scheduler');if(before)host.insertBefore(section,before);else host.appendChild(section)}
      section.innerHTML=`<div class="eyebrow">Carga y ofrecimiento docente</div><h2>Oferta mínima y porcentaje variable</h2><p>Primero se calcula la carga frente a curso. Las horas fuera de curso —incluida la planificación obligatoria con equipos— pueden representar hasta el 50 % de la carga total ofrecida al docente.</p><div class="v56-note"><strong>Mínimo automático:</strong> horas frente a curso + horas obligatorias fuera de curso. <strong>Rango posible:</strong> desde ese mínimo hasta un máximo en el que las horas fuera de curso representen el 50 % de la carga total. Las 3/4 HC de planificación de equipo forman parte de ese porcentaje: no se suman por afuera. Ejemplo: 5 HC frente a curso + 3 HC de planificación = 8 HC totales; las 3 HC fuera de curso representan el 37,5 %, por lo tanto es una oferta válida.</div>${teachers().length?`<div class="v56-cards">${teachers().map(teacherCard).join('')}</div>`:'<div class="v48-empty">Primero cargá docentes y asignales materias/cursos.</div>'}<h2 style="margin-top:19px">Bloques obligatorios de planificación</h2><p>Los equipos se detectan automáticamente desde las asignaciones de Fase 1. Cada área de Formación General y cada Formación Orientada debe tener un bloque semanal común continuo de 3 o 4 HC dentro de la jornada escolar.</p>${teamCards()}`;
      section.querySelectorAll('[data-v56-pct]').forEach(sel=>sel.onchange=()=>setPct(sel.dataset.v56Pct,Number(sel.dataset.sem),Number(sel.value)));
      section.querySelectorAll('[data-v56-team-hours]').forEach(sel=>sel.onchange=()=>setTeamHours(sel.dataset.v56TeamHours,Number(sel.value)));
    }finally{rendering=false}
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{patchSchedulerApi();render()},90)}
  function start(){refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,320));
  window.addEventListener('pci-schedule-grid-changed',refresh);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,230)},true);
  window.PCIOfferModelV56={offer,teamHours,syntheticOutsideRows,render};
})();
