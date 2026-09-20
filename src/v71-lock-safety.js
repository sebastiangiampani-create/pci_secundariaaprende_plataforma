(() => {
  const base=window.PCIAnnualSchedulerV71||window.PCIAnnualSchedulerV68||null;
  const staff=()=>window.PCIStaffPlanningV68||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const slot=(d,p)=>`${d}:${p}`;
  function root(){state.institutional=state.institutional||{};return state.institutional}
  const available=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  function add(map,tid,s){if(!tid)return true;if(!map.has(tid))map.set(tid,new Set());const set=map.get(tid);if(set.has(s))return false;set.add(s);return true}
  function teamMembers(teamId,assignments){
    const out=new Set();for(const row of window.PCIInstitutionalV48?.allImplementationRows?.()||[]){const tid=assignments?.[row.instanceId];if(tid&&(staff()?.rowTeamIds?.(row)||[]).includes(teamId))out.add(tid)}return[...out];
  }
  function validate(assignments=root().assignments||{}){
    const issues=[],s1=new Map(),s2=new Map(),course=new Map(),groups=new Map();
    for(const lock of root().annualScheduleLocks||[]){const sk=slot(lock.day,lock.period);
      if(lock.type==='classpair'){
        const t1=lock.s1?.instanceId?assignments[lock.s1.instanceId]||'':null,t2=lock.s2?.instanceId?assignments[lock.s2.instanceId]||'':null;
        if(lock.s1&&t1!==lock.s1.teacherId){issues.push(`${lock.courseKey}: la asignación docente del 1.er cuatrimestre cambió respecto del bloque fijado.`);continue}
        if(lock.s2&&t2!==lock.s2.teacherId){issues.push(`${lock.courseKey}: la asignación docente del 2.º cuatrimestre cambió respecto del bloque fijado.`);continue}
        if(lock.s1&&(!available(t1,lock.day,lock.period)||!add(s1,t1,sk)))issues.push(`${root().teachers?.[t1]?.name||'Docente'} tiene conflicto en un bloque anual fijado (${lock.day} HC ${lock.period}).`);
        if(lock.s2&&(!available(t2,lock.day,lock.period)||!add(s2,t2,sk)))issues.push(`${root().teachers?.[t2]?.name||'Docente'} tiene conflicto en un bloque anual fijado (${lock.day} HC ${lock.period}).`);
        if(lock.courseKey){if(!course.has(lock.courseKey))course.set(lock.courseKey,new Set());if(course.get(lock.courseKey).has(sk))issues.push(`${lock.courseKey}: hay dos posiciones fijadas en ${lock.day} HC ${lock.period}.`);course.get(lock.courseKey).add(sk)}
      }else if(lock.type==='institutional'){
        const tid=lock.teacherId;if(!available(tid,lock.day,lock.period)||!add(s1,tid,sk)||!add(s2,tid,sk))issues.push(`${root().teachers?.[tid]?.name||'Docente'} tiene conflicto en un bloque institucional fijado (${lock.day} HC ${lock.period}).`);
      }else if(lock.type==='area'){
        if(!groups.has(lock.areaId))groups.set(lock.areaId,[]);groups.get(lock.areaId).push(lock);
        const members=teamMembers(lock.areaId,assignments);if(!members.length)issues.push(`${lock.label||lock.areaId}: el equipo fijado ya no tiene docentes activos.`);
        for(const tid of members)if(!available(tid,lock.day,lock.period)||!add(s1,tid,sk)||!add(s2,tid,sk))issues.push(`${root().teachers?.[tid]?.name||'Docente'} tiene conflicto con el equipo fijado ${lock.label||lock.areaId} (${lock.day} HC ${lock.period}).`);
      }
    }
    for(const[areaId,locks]of groups){const ps=locks.map(x=>Number(x.period)).sort((a,b)=>a-b),sameDay=locks.every(x=>x.day===locks[0].day),contiguous=ps.every((p,i)=>i===0||p===ps[i-1]+1);if(!sameDay||!contiguous)issues.push(`${locks[0]?.label||areaId}: el bloque fijado del equipo debe mantenerse continuo en un mismo día.`)}
    return{ok:!issues.length,issues};
  }
  function show(result){
    const section=document.getElementById('v68AnnualScheduler');if(!section)return;section.querySelector('.v71-lock-guard')?.remove();if(result.ok)return;const box=document.createElement('div');box.className='v71-lock-guard';box.innerHTML=`<strong>Revisá los bloques anuales fijados</strong>${result.issues.slice(0,10).map(x=>`<div>• ${String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div>`).join('')}`;(section.querySelector('.v65-actions')||section.firstElementChild)?.after(box);
  }
  if(base){
    const wrapped={...base,
      preflight(options={}){const r=base.preflight?.(options)||{ok:false,issues:[],warnings:[]},g=validate(root().assignments||{});return{...r,issues:[...(r.issues||[]),...g.issues],ok:!!r.ok&&g.ok,lockSafety:g}},
      simulateAssignments(assignments,maxAttempts){const g=validate(assignments);if(!g.ok)return{ok:false,issues:g.issues,warnings:[],preflight:true,lockSafety:g};return base.simulateAssignments?.(assignments,maxAttempts)},
      generate(){const g=validate(root().assignments||{});show(g);if(!g.ok){toast('Hay bloques fijados con conflictos. Revisalos antes de regenerar.',true);return}return base.generate?.()}
    };
    window.PCIAnnualSchedulerV71=wrapped;window.PCIAnnualSchedulerV68=wrapped;window.PCIAnnualSchedulerV65=wrapped;
  }
  window.addEventListener('click',e=>{
    const generate=e.target.closest?.('[data-v68-generate]'),check=e.target.closest?.('[data-v68-check]');if(!generate&&!check)return;const g=validate(root().assignments||{});show(g);if(!g.ok){e.preventDefault();e.stopImmediatePropagation();toast('Los bloques fijados tienen conflictos con la planta o la disponibilidad actual.',true)}
  },true);
  document.addEventListener('change',e=>{if(e.target.closest?.('[data-v48-assignment],#v60Availability,[data-day]'))setTimeout(()=>show(validate(root().assignments||{})),120)},true);
  const style=document.createElement('style');style.textContent=`.v71-lock-guard{margin-top:10px;padding:10px 11px;border-radius:11px;background:var(--danger-soft);color:var(--danger);font-size:.58rem;line-height:1.45}.v71-lock-guard strong{display:block;font-size:.68rem;margin-bottom:4px}`;document.head.appendChild(style);
  window.PCIAnnualLockSafetyV71={validate,show};
})();