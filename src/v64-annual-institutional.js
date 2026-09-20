(() => {
  const $id=id=>document.getElementById(id);
  const baseLoadApi=()=>window.PCIDerivedTeacherLoadV52||null;
  const instApi=()=>window.PCIInstitutionalV48||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const workApi=()=>window.PCIInstitutionalWorkV53||null;
  let observer=null,timer=null,rendering=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const pct=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};r.outsideWork=r.outsideWork||{};
    return r;
  }
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  const teams=()=>Object.values(root().areaTeams||{});
  const rows=()=>instApi()?.allImplementationRows?.()||[];

  function annualTeacherLoads(){
    const out={};
    for(const id of Object.keys(root().teachers))out[id]={annual:0,pendingAnnual:0,S1:0,S2:0,pendingS1:0,pendingS2:0};
    for(const row of rows()){
      const tid=root().assignments[row.instanceId];if(!tid)continue;
      out[tid]=out[tid]||{annual:0,pendingAnnual:0,S1:0,S2:0,pendingS1:0,pendingS2:0};
      if(row.hours==null||Number(row.hours)<=0)out[tid].pendingAnnual++;
      else out[tid].annual+=Number(row.hours);
    }
    for(const v of Object.values(out)){
      v.S1=v.S2=v.annual;
      v.pendingS1=v.pendingS2=v.pendingAnnual;
    }
    return out;
  }

  function syncDerivedBaseHours(){
    const loads=annualTeacherLoads();let changed=false;
    for(const t of teachers()){
      const h=Number(loads[t.id]?.annual||0);
      if(Number(t.baseHours)!==h){t.baseHours=h;changed=true}
      if(t.baseHoursSource!=='annual-assignments'){t.baseHoursSource='annual-assignments';changed=true}
    }
    return changed;
  }

  function patchLoadApi(){
    const api=baseLoadApi();if(!api||api.__v64Annual)return;
    api.teacherLoads=annualTeacherLoads;
    api.activeInSemester=()=>true;
    api.syncDerivedBaseHours=syncDerivedBaseHours;
    api.__v64Annual=true;
  }

  const teamHours=tid=>teams().filter(t=>(t.teacherIds||[]).includes(tid)).reduce((a,t)=>a+Number(t.coordinationHours||0),0);
  const annualOutsideRows=()=>Object.values(root().outsideWork||{});
  const explicitOutside=tid=>annualOutsideRows().filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0);
  const singleMemberTeamRows=tid=>teams().filter(t=>(t.teacherIds||[]).includes(tid)&&(t.teacherIds||[]).filter(id=>root().teachers[id]).length<2).map(t=>({id:`team-single-${t.id}-${tid}`,teacherId:tid,label:`Planificación de equipo · ${t.name}`,hours:Number(t.coordinationHours||0),semester:'both',__v56TeamSingle:true}));

  function outsideForShare(front,share){
    const p=clamp(share,0,50);
    if(!front||p<=0)return 0;
    if(p>=50)return front;
    return Math.max(0,Math.round(front*p/(100-p)));
  }

  function offer(tid){
    teamsApi()?.deriveTeams?.();
    const t=root().teachers[tid]||{},front=Number(annualTeacherLoads()[tid]?.annual||0),team=teamHours(tid),explicit=explicitOutside(tid),minimumOutside=team+explicit,minimumTotal=front+minimumOutside;
    const minPct=minimumTotal?minimumOutside/minimumTotal*100:0,maxOutside=front,maxTotal=front+maxOutside,conflict=front>0&&minimumOutside>maxOutside;
    const stored=t.offerAnnualPct;
    const selected=stored===null||stored===undefined||stored===''?null:clamp(stored,Math.ceil(minPct),50);
    const targetOutside=conflict?minimumOutside:(selected===null?minimumOutside:Math.max(minimumOutside,outsideForShare(front,selected)));
    const configuredTotal=front+targetOutside,additionalOutside=Math.max(0,targetOutside-minimumOutside),actualPct=configuredTotal?targetOutside/configuredTotal*100:0;
    return{front,team,explicit,minimumOutside,minimumTotal,minPct,maxOutside,maxTotal,selected,targetOutside,configuredTotal,additionalOutside,actualPct,conflict};
  }

  function syntheticOutsideRows(){
    const list=[...annualOutsideRows()];
    for(const t of teachers()){
      const o=offer(t.id);
      list.push(...singleMemberTeamRows(t.id));
      if(o.additionalOutside>0)list.push({id:`offer-extra-${t.id}-annual`,teacherId:t.id,label:'Trabajo institucional adicional',hours:o.additionalOutside,semester:'both',__v56Offer:true});
    }
    return list;
  }

  function annualOfferApi(){
    return{offer:(tid)=>offer(tid),teamHours,syntheticOutsideRows,render:renderAnnualOffer,__v64Annual:true};
  }

  function setOfferPct(tid,value){
    const t=root().teachers[tid];if(!t)return;
    const o=offer(tid);if(o.conflict)return;
    if(value===''){t.offerAnnualPct=null;}
    else t.offerAnnualPct=clamp(Number(value),Math.ceil(o.minPct),50);
    save();renderAnnualOffer();workApi()?.renderScheduler?.();
  }

  function setTeamHours(id,value){
    const t=root().areaTeams[id];if(!t)return;
    t.coordinationHours=[3,4].includes(Number(value))?Number(value):3;
    save();renderAnnualOffer();workApi()?.renderScheduler?.();
  }

  function offerOptions(o){
    const min=Math.ceil(o.minPct),set=new Set([min,50]);
    for(let p=Math.max(0,Math.ceil(min/5)*5);p<=50;p+=5)set.add(p);
    const opts=[`<option value="" ${o.selected===null?'selected':''}>Mínimo obligatorio (${pct(o.minPct)} %)</option>`];
    [...set].filter(x=>x>=min&&x<=50).sort((a,b)=>a-b).forEach(x=>opts.push(`<option value="${x}" ${Number(o.selected)===x?'selected':''}>${x} %</option>`));
    return opts.join('');
  }

  function teacherCard(t){
    const o=offer(t.id);
    return`<article class="v64-card"><h3>${esc(t.name)}</h3><div class="v64-metrics"><span>Horas frente a curso</span><strong>${o.front} HC</strong><span>Planificación/equipo obligatoria</span><strong>${o.team} HC</strong>${o.explicit?`<span>Otras tareas institucionales</span><strong>${o.explicit} HC</strong>`:''}<span class="min">Mínimo fuera de curso</span><strong>${o.minimumOutside} HC</strong><span class="min">Oferta mínima total</span><strong>${o.minimumTotal} HC</strong><span>Máximo fuera de curso (50 % del total)</span><strong>${o.maxOutside} HC</strong><span>Máximo total</span><strong>${o.maxTotal} HC</strong></div>${o.front?`<label class="v64-choice">Porcentaje de trabajo fuera de curso <select data-v64-pct="${esc(t.id)}" ${o.conflict?'disabled':''}>${offerOptions(o)}</select></label><div class="v64-result"><strong>${o.configuredTotal} HC totales</strong>${o.targetOutside} HC fuera de curso · ${pct(o.actualPct)} % de la carga total${o.selected===null?' · usando solo el mínimo obligatorio':''}</div>`:'<div class="v64-result"><strong>Sin horas frente a curso asignadas</strong>La oferta se habilita cuando el docente tenga materias/cursos asignados.</div>'}${o.conflict?`<div class="v64-conflict">Las ${o.minimumOutside} HC obligatorias fuera de curso superan el máximo de ${o.maxOutside} HC permitido para mantenerlas dentro del 50 % de la carga total.</div>`:''}</article>`;
  }

  function teamCards(){
    const list=teams().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
    if(!list.length)return '<div class="v48-empty">Los equipos aparecerán automáticamente al asignar docentes a las materias de Fase 1.</div>';
    return`<div class="v64-teams">${list.map(t=>`<article><div><strong>${esc(t.name)}</strong><small>${t.kind==='FO'?'Formación Orientada':'Formación General'} · bloque anual semanal común</small></div><select data-v64-team="${esc(t.id)}"><option value="3" ${Number(t.coordinationHours)===3?'selected':''}>3 HC</option><option value="4" ${Number(t.coordinationHours)===4?'selected':''}>4 HC</option></select><p>${(t.teacherIds||[]).map(id=>esc(root().teachers[id]?.name||'')).filter(Boolean).join(' · ')||'Sin docentes asignados'}</p></article>`).join('')}</div>`;
  }

  function renderAnnualOffer(){
    if(rendering)return;rendering=true;
    try{
      const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
      patchLoadApi();teamsApi()?.deriveTeams?.();syncDerivedBaseHours();
      window.PCIOfferModelV56=annualOfferApi();
      let section=$id('v64AnnualOffer');
      if(!section){section=document.createElement('section');section.id='v64AnnualOffer';section.className='card v64-section';const before=$id('v51ScheduleConfig')||$id('v49Availability')||$id('v53Scheduler');if(before)host.insertBefore(section,before);else host.appendChild(section)}
      section.innerHTML=`<div class="eyebrow">Carga y ofrecimiento docente · anual</div><h2>Una sola carga para todo el año</h2><p>El horario institucional es anual: no se calcula un ofrecimiento distinto por cuatrimestre. Las 3/4 HC de planificación con equipo integran el trabajo fuera de curso y forman parte del límite máximo del 50 % de la carga total.</p><div class="v64-note"><strong>El porcentaje no se asigna automáticamente.</strong> El sistema calcula el mínimo obligatorio. Si no elegís un porcentaje adicional, se conserva ese mínimo; si la escuela quiere ampliar la oferta, puede elegir un valor hasta 50 %.</div>${teachers().length?`<div class="v64-cards">${teachers().map(teacherCard).join('')}</div>`:'<div class="v48-empty">Primero cargá docentes y asignales materias/cursos.</div>'}<h2 style="margin-top:20px">Planificación común obligatoria</h2><p>Cada equipo de Formación General y cada Formación Orientada tiene un único bloque semanal común de 3 o 4 HC durante todo el año.</p>${teamCards()}`;
      section.querySelectorAll('[data-v64-pct]').forEach(s=>s.onchange=()=>setOfferPct(s.dataset.v64Pct,s.value));
      section.querySelectorAll('[data-v64-team]').forEach(s=>s.onchange=()=>setTeamHours(s.dataset.v64Team,s.value));
      save();
    }finally{rendering=false}
  }

  function decorateTeacherCards(){
    const loads=annualTeacherLoads();
    document.querySelectorAll('#v48InstitutionalContent .v48-teacher-card').forEach(card=>{
      const edit=card.querySelector('[data-v48-edit-teacher]'),t=edit?root().teachers[edit.dataset.v48EditTeacher]:null;if(!t)return;
      const small=card.querySelector('.v48-teacher-head small');if(small)small.textContent=`Frente a curso anual: ${Number(loads[t.id]?.annual||0)} HC`;
      const summary=[...card.querySelectorAll(':scope > small')].at(-1);if(summary){const pending=Number(loads[t.id]?.pendingAnnual||0);summary.innerHTML=`<strong>Carga anual derivada de las asignaciones</strong>${pending?` · ${pending} carga${pending===1?'':'s'} pendiente${pending===1?'':'s'}`:''}`}
    });
  }

  function decorateScheduler(){
    const scheduler=$id('v53Scheduler');if(!scheduler)return;
    const sem=$id('v53Semester');
    if(sem&&sem.value!=='1'){sem.value='1';sem.dispatchEvent(new Event('change',{bubbles:true}));return}
    const label=sem?.closest('label');if(label){label.style.display='none';if(!scheduler.querySelector('.v64-annual-badge')){const badge=document.createElement('span');badge.className='v64-annual-badge';badge.textContent='Horario anual';label.after(badge)}}
    const title=scheduler.querySelector('h2');if(title)title.textContent='Horario escolar anual';
    const p=scheduler.querySelector('h2 + p');if(p)p.textContent='El motor genera una única grilla para todo el año. Ubica las horas frente a curso, el trabajo institucional y los bloques comunes de planificación sin separar el horario por cuatrimestres.';
  }

  function decoratePrint(){
    const content=$id('printContent');if(!content)return;
    content.querySelectorAll('h1').forEach(h=>{if(/^Horarios · /.test(h.textContent||''))h.textContent='Horarios anuales'});
  }

  const style=document.createElement('style');
  style.textContent=`
    #v56OfferModel{display:none!important}.v64-section{margin-top:16px;padding:17px}.v64-section h2{margin:4px 0 5px;font-size:1.05rem}.v64-section>p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.42}.v64-note{margin-top:11px;padding:11px 12px;border-radius:11px;background:var(--mint-soft);color:var(--mint-dark);font-size:.66rem;line-height:1.45}
    .v64-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:10px;margin-top:13px}.v64-card{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.v64-card h3{margin:0 0 9px;font-size:.9rem}.v64-metrics{display:grid;grid-template-columns:1fr auto;gap:5px 9px;font-size:.62rem}.v64-metrics span{color:var(--muted)}.v64-metrics strong{text-align:right}.v64-metrics .min{font-weight:900;color:var(--mint-dark)}.v64-choice{display:grid;gap:4px;margin-top:10px;font-size:.58rem;font-weight:850;color:var(--muted)}.v64-choice select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-weight:850}.v64-result{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--band);font-size:.6rem;line-height:1.35}.v64-result strong{display:block;font-size:.72rem}.v64-conflict{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--danger-soft);color:var(--danger);font-size:.6rem;line-height:1.4;font-weight:750}
    .v64-teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px;margin-top:12px}.v64-teams article{display:grid;grid-template-columns:1fr auto;gap:7px 10px;border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--band)}.v64-teams strong{font-size:.72rem}.v64-teams small{display:block;margin-top:2px;color:var(--muted);font-size:.55rem}.v64-teams select{padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-weight:850}.v64-teams p{grid-column:1/-1!important;font-size:.58rem!important}.v64-annual-badge{align-self:end;display:inline-flex;padding:8px 11px;border-radius:999px;background:var(--mint-soft);color:var(--mint-dark);font-size:.62rem;font-weight:900}
    @media(max-width:720px){.v64-cards{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function normalizeOutsideWork(){let changed=false;for(const row of Object.values(root().outsideWork||{})){if(row.semester!=='both'){row.semester='both';changed=true}}if(changed)save()}
  function patchWorkApi(){const w=workApi();if(!w)return;w.outsideRows=()=>syntheticOutsideRows();}
  function refresh(){clearTimeout(timer);timer=setTimeout(()=>{patchLoadApi();normalizeOutsideWork();patchWorkApi();window.PCIOfferModelV56=annualOfferApi();decorateTeacherCards();renderAnnualOffer();decorateScheduler();decoratePrint()},80)}
  function start(){patchLoadApi();normalizeOutsideWork();patchWorkApi();window.PCIOfferModelV56=annualOfferApi();refresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:true})}}

  window.addEventListener('pci-app-ready',()=>setTimeout(start,520));
  window.addEventListener('pci-schedule-grid-changed',refresh);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional,[data-v53-generate],[data-v53-check],[data-v61-print]'))setTimeout(refresh,180)},true);
  document.addEventListener('change',e=>{if(e.target.closest('[data-v48-assignment]'))setTimeout(refresh,140)},true);

  window.PCIAnnualInstitutionalV64={annualTeacherLoads,offer,syntheticOutsideRows,renderAnnualOffer,refresh};
})();
