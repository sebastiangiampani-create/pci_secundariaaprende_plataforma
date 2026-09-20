(() => {
  const $id=id=>document.getElementById(id);
  const loadApi=()=>window.PCIDerivedTeacherLoadV52||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const workApi=()=>window.PCIInstitutionalWorkV53||null;
  const staffApi=()=>window.PCIStaffPlanningV68||null;
  const originalTeacherLoads=loadApi()?.teacherLoads?.bind(loadApi())||(()=>({}));
  let observer=null,timer=null,rendering=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const fmt=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');

  function root(){state.institutional=state.institutional||{};const r=state.institutional;r.teachers=r.teachers||{};r.areaTeams=r.areaTeams||{};r.outsideWork=r.outsideWork||{};return r}
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  const teams=()=>Object.values(root().areaTeams||{});
  const semesterLoads=()=>originalTeacherLoads()||{};
  function front(tid){const l=semesterLoads()[tid]||{};return Math.max(Number(l.S1||0),Number(l.S2||0))}
  function pending(tid){const l=semesterLoads()[tid]||{};return Math.max(Number(l.pendingS1||0),Number(l.pendingS2||0))}
  function teamHours(tid){
    const derived=staffApi()?.teacherPlanning?.(tid);
    if(derived)return Number(derived.total||0);
    return teams().filter(t=>(t.teacherIds||[]).includes(tid)).reduce((a,t)=>a+Number(t.coordinationHours||0),0);
  }
  const explicitRows=()=>Object.values(root().outsideWork||{});
  const explicitOutside=tid=>explicitRows().filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0);
  function planningResidualRows(tid){
    const derived=staffApi()?.residualRows?.(tid);
    if(Array.isArray(derived))return derived;
    return teams().filter(t=>(t.teacherIds||[]).includes(tid)&&(t.teacherIds||[]).filter(id=>root().teachers[id]).length<2).map(t=>({id:`team-single-${t.id}-${tid}-annual`,teacherId:tid,label:`Planificación de equipo · ${t.name}`,hours:Number(t.coordinationHours||0),semester:'both',__v65TeamSingle:true}));
  }

  function outsideForShare(frontHours,share){const p=clamp(share,0,50);if(!frontHours||p<=0)return 0;if(p>=50)return frontHours;return Math.floor(frontHours*p/(100-p)+1e-9)}
  function offer(tid){
    teamsApi()?.deriveTeams?.();
    const t=root().teachers[tid]||{},f=front(tid),team=teamHours(tid),explicit=explicitOutside(tid),minimumOutside=team+explicit,minimumTotal=f+minimumOutside,minPct=minimumTotal?minimumOutside/minimumTotal*100:0,maxOutside=f,maxTotal=f+maxOutside,conflict=f>0&&minimumOutside>maxOutside;
    const raw=t.offerAnnualPct,selected=raw===null||raw===undefined||raw===''?null:clamp(Number(raw),minPct,50);
    const targetOutside=conflict?minimumOutside:(selected===null?minimumOutside:Math.max(minimumOutside,outsideForShare(f,selected)));
    const configuredTotal=f+targetOutside,actualPct=configuredTotal?targetOutside/configuredTotal*100:0,additionalOutside=Math.max(0,targetOutside-minimumOutside);
    const planning=staffApi()?.teacherPlanning?.(tid)||null;
    return{front:f,team,explicit,minimumOutside,minimumTotal,minPct,maxOutside,maxTotal,selected,targetOutside,configuredTotal,actualPct,additionalOutside,conflict,pending:pending(tid),planning,pendingPlanning:!!planning?.needsValidation};
  }
  function syntheticOutsideRows(){
    const out=[...explicitRows().map(x=>({...x,semester:'both'}))];
    for(const t of teachers()){
      const o=offer(t.id);out.push(...planningResidualRows(t.id));
      if(o.additionalOutside>0)out.push({id:`offer-extra-${t.id}-annual`,teacherId:t.id,label:'Trabajo institucional adicional',hours:o.additionalOutside,semester:'both',__v65Offer:true});
    }
    return out;
  }

  function setPct(tid,value){const t=root().teachers[tid];if(!t)return;const o=offer(tid);if(o.conflict)return;if(value===''){t.offerAnnualPct=null}else{const n=Number(value);if(!Number.isFinite(n)||n<o.minPct-1e-9||n>50)return toast(`Elegí un porcentaje entre ${fmt(o.minPct)} % y 50 %.`,true);t.offerAnnualPct=n}save();render();workApi()?.renderScheduler?.()}
  function useMinimum(tid){const t=root().teachers[tid];if(!t)return;const o=offer(tid);if(o.conflict)return;t.offerAnnualPct=Number(o.minPct.toFixed(2));save();render();workApi()?.renderScheduler?.()}

  function teacherCard(t){
    const o=offer(t.id),chosen=o.selected!==null;
    return`<article class="v65-card"><h3>${esc(t.name)}</h3><div class="v65-metrics"><span>Horas frente a curso · anuales</span><strong>${fmt(o.front)} HC</strong><span>Planificación mínima por equipos</span><strong>${fmt(o.team)} HC</strong>${o.explicit?`<span>Otras tareas institucionales</span><strong>${fmt(o.explicit)} HC</strong>`:''}<span class="min">Mínimo fuera de curso</span><strong>${fmt(o.minimumOutside)} HC</strong><span class="min">Carga mínima total</span><strong>${fmt(o.minimumTotal)} HC</strong><span>Máximo fuera de curso (50 % del total)</span><strong>${fmt(o.maxOutside)} HC</strong><span>Máximo total</span><strong>${fmt(o.maxTotal)} HC</strong></div>${o.front?`<div class="v65-choice"><label>Porcentaje elegido por la escuela<input data-v65-pct="${esc(t.id)}" type="number" min="${Math.ceil(o.minPct*10)/10}" max="50" step="0.5" value="${chosen?o.selected:''}" placeholder="Elegir ${fmt(o.minPct)}–50 %" ${o.conflict||o.pendingPlanning?'disabled':''}></label><button type="button" data-v65-min="${esc(t.id)}" ${o.conflict||o.pendingPlanning?'disabled':''}>Usar mínimo</button></div><div class="v65-result ${chosen?'chosen':'pending'}"><strong>${chosen?`${fmt(o.configuredTotal)} HC totales`:'Porcentaje todavía no definido'}</strong>${chosen?`${fmt(o.targetOutside)} HC fuera de curso · ${fmt(o.actualPct)} % real de la carga total`:`Mínimo disponible: ${fmt(o.minimumOutside)} HC fuera de curso (${fmt(o.minPct)} % de ${fmt(o.minimumTotal)} HC totales). Elegí el porcentaje o pulsá “Usar mínimo”.`}</div>`:'<div class="v65-result pending"><strong>Sin horas frente a curso asignadas</strong>La oferta se habilita cuando el docente tenga materias/cursos asignados.</div>'}${o.pending?`<div class="v65-warning">Hay ${o.pending} carga${o.pending===1?'':'s'} horaria${o.pending===1?'':'s'} pendiente${o.pending===1?'':'s'} de completar.</div>`:''}${o.pendingPlanning?`<div class="v65-warning">Este docente integra tres o más equipos. Validá primero la distribución de planificación mínima.</div>`:''}${o.conflict?`<div class="v65-conflict">Las ${fmt(o.minimumOutside)} HC obligatorias fuera de curso superan el máximo de ${fmt(o.maxOutside)} HC que permite mantenerlas dentro del 50 % de la carga total.</div>`:''}</article>`;
  }
  function teamCards(){
    const list=teams().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));if(!list.length)return '<div class="v48-empty">Los equipos se detectan automáticamente cuando asignás docentes.</div>';
    return`<div class="v65-teams">${list.map(t=>{const common=staffApi()?.teamCommonHours?.(t.id);const hc=Number.isFinite(Number(common))?Number(common):Number(t.coordinationHours||0);return`<article><div><strong>${esc(t.name)}</strong><small>${t.kind==='FO'?'Formación Orientada':'Formación General'} · bloque semanal común anual</small></div><strong class="v65-team-hours">${fmt(hc)} HC comunes</strong><p>${(t.teacherIds||[]).map(id=>esc(root().teachers[id]?.name||'')).filter(Boolean).join(' · ')||'Sin docentes asignados'}</p></article>`}).join('')}</div>`;
  }

  const style=document.createElement('style');style.textContent=`#v56OfferModel,#v64AnnualOffer{display:none!important}.v65-section{margin-top:16px;padding:17px}.v65-section h2{margin:4px 0 5px;font-size:1.05rem}.v65-section>p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.42}.v65-note{margin-top:11px;padding:11px 12px;border-radius:11px;background:var(--mint-soft);color:var(--mint-dark);font-size:.66rem;line-height:1.45}.v65-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:10px;margin-top:13px}.v65-card{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.v65-card h3{margin:0 0 9px;font-size:.9rem}.v65-metrics{display:grid;grid-template-columns:1fr auto;gap:5px 9px;font-size:.62rem}.v65-metrics span{color:var(--muted)}.v65-metrics strong{text-align:right}.v65-metrics .min{color:var(--mint-dark);font-weight:900}.v65-choice{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:end;margin-top:10px}.v65-choice label{display:grid;gap:4px;color:var(--muted);font-size:.57rem;font-weight:850}.v65-choice input{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px}.v65-choice button{padding:8px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;font-weight:850;color:var(--ink)}.v65-result{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--band);font-size:.6rem;line-height:1.4}.v65-result strong{display:block;font-size:.72rem}.v65-result.pending{background:#fff9e8;color:#6d581c}.v65-warning{margin-top:7px;color:#8a6414;font-size:.59rem}.v65-conflict{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--danger-soft);color:var(--danger);font-size:.6rem;font-weight:750;line-height:1.4}.v65-teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px;margin-top:12px}.v65-teams article{display:grid;grid-template-columns:1fr auto;gap:7px 9px;padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--band)}.v65-teams strong{font-size:.72rem}.v65-teams small{display:block;margin-top:2px;color:var(--muted);font-size:.55rem}.v65-team-hours{white-space:nowrap;color:var(--mint-dark)}.v65-teams p{grid-column:1/-1!important;font-size:.58rem!important}@media(max-width:720px){.v65-cards{grid-template-columns:1fr}.v65-choice{grid-template-columns:1fr}}`;document.head.appendChild(style);

  function decorateTeacherCards(){const loads=semesterLoads();document.querySelectorAll('#v48InstitutionalContent .v48-teacher-card').forEach(card=>{const edit=card.querySelector('[data-v48-edit-teacher]'),t=edit?root().teachers[edit.dataset.v48EditTeacher]:null;if(!t)return;const l=loads[t.id]||{},annual=Math.max(Number(l.S1||0),Number(l.S2||0)),small=card.querySelector('.v48-teacher-head small');if(small)small.textContent=`Frente a curso anual: ${fmt(annual)} HC`;const summary=[...card.querySelectorAll(':scope > small')].at(-1);if(summary)summary.innerHTML='<strong>Carga anual derivada de las asignaciones</strong>'})}
  function render(){if(rendering)return;rendering=true;try{const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;teamsApi()?.deriveTeams?.();window.PCIOfferModelV56={offer:(tid)=>offer(tid),teamHours,syntheticOutsideRows,render,__v65Annual:true};let section=$id('v65AnnualOffer');if(!section){section=document.createElement('section');section.id='v65AnnualOffer';section.className='card v65-section';const before=$id('v51ScheduleConfig')||$id('v49Availability')||$id('v53Scheduler');if(before)host.insertBefore(section,before);else host.appendChild(section)}section.innerHTML=`<div class="eyebrow">Carga y ofrecimiento docente · anual</div><h2>Una sola carga para todo el año</h2><p>La carga docente y el horario institucional son anuales. Los cuatrimestres siguen existiendo en el desarrollo curricular, pero no generan dos ofrecimientos docentes ni dos horarios escolares distintos.</p><div class="v65-note"><strong>La planificación mínima se deriva de la asignación.</strong> Un equipo parte de 3 HC por docente; dos equipos parten de 4 HC totales (2 + 2). Para tres o más equipos la distribución debe validarse. Después la escuela puede ampliar el trabajo fuera de curso hasta 50 % de la carga total.</div>${teachers().length?`<div class="v65-cards">${teachers().map(teacherCard).join('')}</div>`:'<div class="v48-empty">Primero cargá docentes y asignales materias/cursos.</div>'}<h2 style="margin-top:20px">Planificación común obligatoria</h2><p>Los bloques comunes se calculan desde la planificación asignada a sus integrantes. Si una persona necesita más horas de planificación que el bloque común, la diferencia queda como planificación individual.</p>${teamCards()}`;section.querySelectorAll('[data-v65-pct]').forEach(i=>i.onchange=()=>setPct(i.dataset.v65Pct,i.value));section.querySelectorAll('[data-v65-min]').forEach(b=>b.onclick=()=>useMinimum(b.dataset.v65Min));decorateTeacherCards()}finally{rendering=false}}
  function schedule(){clearTimeout(timer);timer=setTimeout(render,90)}
  function start(){schedule();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,700));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(start,280)},true);document.addEventListener('change',e=>{if(e.target.closest('[data-v48-assignment],[data-v65-pct],[data-v68-plan-hours]'))setTimeout(schedule,150)},true);
  window.PCIAnnualOfferV65={offer,front,semesterLoads,teamHours,syntheticOutsideRows,render};
})();