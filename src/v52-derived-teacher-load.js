(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  let observer=null,refreshTimer=null,decorating=false;

  const inst=()=>{
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.assignments=state.institutional.assignments||{};
    return state.institutional;
  };

  function activeInSemester(row,semester){
    const term=Number(row.year)*2-(Number(semester)===1?1:0);
    return row.locations?.includes(`C${term}`)||row.locations?.some(x=>String(x).includes('anual'));
  }

  function teacherLoads(){
    const result={};
    for(const id of Object.keys(inst().teachers))result[id]={S1:0,S2:0,pendingS1:0,pendingS2:0};
    for(const row of api()?.allImplementationRows?.()||[]){
      const tid=inst().assignments[row.instanceId];
      if(!tid)continue;
      result[tid]=result[tid]||{S1:0,S2:0,pendingS1:0,pendingS2:0};
      for(const semester of [1,2]){
        if(!activeInSemester(row,semester))continue;
        const key=`S${semester}`,pending=`pendingS${semester}`;
        if(row.hours==null||Number(row.hours)<=0)result[tid][pending]++;
        else result[tid][key]+=Number(row.hours);
      }
    }
    return result;
  }

  function syncDerivedBaseHours(){
    const loads=teacherLoads();let changed=false;
    for(const teacher of Object.values(inst().teachers)){
      const load=loads[teacher.id]||{S1:0,S2:0};
      const derived=Math.max(Number(load.S1||0),Number(load.S2||0));
      if(Number(teacher.baseHours)!==derived){teacher.baseHours=derived;changed=true}
      if(teacher.baseHoursSource!=='assignments'){teacher.baseHoursSource='assignments';changed=true}
      if(teacher.maxTotalHours===undefined){teacher.maxTotalHours=null;changed=true}
    }
    return changed;
  }

  function addTeacher(name){
    const clean=String(name||'').trim();
    if(!clean)return toast('Escribí el nombre del docente.',true);
    const id=`doc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    inst().teachers[id]={id,name:clean,baseHours:0,baseHoursSource:'assignments',maxTotalHours:null};
    save();api()?.renderInstitutional?.();
  }

  function editTeacher(id){
    const teacher=inst().teachers[id];if(!teacher)return;
    const name=prompt('Nombre y apellido:',teacher.name);if(name===null)return;
    if(!String(name).trim())return toast('Escribí un nombre válido.',true);
    teacher.name=String(name).trim();syncDerivedBaseHours();save();api()?.renderInstitutional?.();
  }

  function decorate(){
    if(decorating)return;decorating=true;
    try{
      const host=$id('v48InstitutionalContent');
      if(!host||!$id('institutional')?.classList.contains('active'))return;
      if(syncDerivedBaseHours())save();
      const form=host.querySelector('.v48-teacher-form');if(!form)return;
      const section=form.closest('.v48-section');
      const title=section?.querySelector('h2');if(title)title.textContent='Plantel y carga frente a curso';
      const intro=section?.querySelector('h2 + p');
      if(intro)intro.textContent='Al dar de alta un docente solo se carga su nombre. La carga se construye después, al asignarle materias y cursos. El máximo total se define recién cuando ya existe una carga real.';
      if(form.dataset.v52!=='derived-load-v53'){
        form.dataset.v52='derived-load-v53';
        form.innerHTML='<label>Nombre y apellido<input id="v48TeacherName" autocomplete="off"></label><button id="v48AddTeacher" class="btn primary">Agregar docente</button>';
      }
      const loads=teacherLoads();
      host.querySelectorAll('.v48-teacher-card').forEach(card=>{
        const edit=card.querySelector('[data-v48-edit-teacher]'),teacher=edit?inst().teachers[edit.dataset.v48EditTeacher]:null;if(!teacher)return;
        const load=loads[teacher.id]||{S1:0,S2:0,pendingS1:0,pendingS2:0};
        const firstSmall=card.querySelector('.v48-teacher-head small');
        if(firstSmall)firstSmall.textContent=`Frente a curso: 1.er C ${load.S1} h · 2.º C ${load.S2} h`;
        const bar=card.querySelector('.v48-load');if(bar)bar.style.display='none';
        const summary=[...card.querySelectorAll(':scope > small')].at(-1);
        if(summary){
          const pending=Number(load.pendingS1||0)+Number(load.pendingS2||0);
          summary.innerHTML=`<strong>Carga derivada de las asignaciones</strong>${pending?` · ${pending} carga${pending===1?'':'s'} pendiente${pending===1?'':'s'}`:''}`;
        }
      });
    }finally{decorating=false}
  }

  function scheduleDecorate(){clearTimeout(refreshTimer);refreshTimer=setTimeout(decorate,20)}
  function start(){
    scheduleDecorate();
    const host=$id('v48InstitutionalContent');
    if(host&&!observer){observer=new MutationObserver(scheduleDecorate);observer.observe(host,{childList:true,subtree:false})}
  }

  document.addEventListener('click',e=>{
    const add=e.target.closest('#v48AddTeacher');
    if(add){e.preventDefault();e.stopImmediatePropagation();addTeacher($id('v48TeacherName')?.value);return}
    const edit=e.target.closest('[data-v48-edit-teacher]');
    if(edit){e.preventDefault();e.stopImmediatePropagation();editTeacher(edit.dataset.v48EditTeacher)}
  },true);

  document.addEventListener('change',e=>{
    const sel=e.target.closest('[data-v48-assignment]');if(!sel)return;
    e.stopImmediatePropagation();
    const id=sel.dataset.v48Assignment,next=sel.value;
    if(next)inst().assignments[id]=next;else delete inst().assignments[id];
    syncDerivedBaseHours();save();api()?.renderInstitutional?.();
  },true);

  window.addEventListener('pci-app-ready',()=>setTimeout(start,120));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,100)},true);
  window.PCIDerivedTeacherLoadV52={teacherLoads,syncDerivedBaseHours,activeInSemester,decorate};
})();
