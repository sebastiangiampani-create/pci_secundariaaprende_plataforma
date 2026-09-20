(() => {
  const $id=id=>document.getElementById(id);
  const pciApi=()=>window.PCIInstitutionalV48||null;
  const staff=()=>window.PCIStaffPlanningV68||null;
  const offerApi=()=>window.PCIAnnualOfferV65||null;
  const scheduleApi=()=>window.PCIAnnualSchedulerV68||window.PCIAnnualSchedulerV65||null;
  const availabilityApi=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const gridApi=()=>window.PCIScheduleConfigV51||null;
  let timer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const fmt=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');
  function root(){state.institutional=state.institutional||{};const r=state.institutional;r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};return r}
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const rows=()=>pciApi()?.allImplementationRows?.()||[];
  const teacherName=id=>root().teachers[id]?.name||'';
  const teacherEmail=id=>root().teachers[id]?.email||'';
  const originLabel=o=>o==='FO'?'Formación Orientada':o==='CUSTOM'?'Extra-plan':'Formación General';

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el generador de Excel.')),{once:true});return}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.dataset.pciXlsx='1';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar el generador de Excel.'));document.head.appendChild(s);
    });
  }

  function assignmentsData(){
    return rows().map(r=>{const tid=root().assignments[r.instanceId]||'',relations=staff()?.relationsForRow?.(r)||[];return{
      'ID instancia':r.instanceId,'Orientación':r.orientation,'Año':r.year,'División':r.division,'Curso':r.course,'Materia / espacio':r.name,'Origen':originLabel(r.origin),'Ubicación Fase 1':(r.locations||[]).join(' · '),'HC semanales':r.hours??'','Docente':teacherName(tid),'Email docente':teacherEmail(tid),'Equipos derivados':relations.map(x=>x.name).join(' · '),'Asignación fija':root().assignmentLocks?.[r.instanceId]?'Sí':'No','Estado':tid?'Asignado':'Sin asignar'
    }})
  }
  function teacherData(){
    const all=rows();return teachers().map(t=>{const mine=all.filter(r=>root().assignments[r.instanceId]===t.id),orientations=[...new Set(mine.map(r=>r.orientation))],courses=[...new Set(mine.map(r=>`${r.orientation} · ${r.course}`))],o=offerApi()?.offer?.(t.id)||{},min=staff()?.minimumLoad?.(t.id)||{},p=staff()?.profile?.(t.id)||{};return{
      'Docente':t.name,'Email':t.email||p.email||'','Orientaciones':orientations.join(' · '),'Cursos':courses.join(' · '),'HC objetivo':p.targetHours??'','HC máximo':p.maxHours??'','HC frente a curso':o.front??min.front??'','HC planificación mínima':o.team??min.planning??'','Otras HC institucionales':o.explicit??min.explicit??'','Carga mínima':min.total??o.minimumTotal??'','% fuera de curso elegido':o.selected??'','HC fuera de curso resultantes':o.targetOutside??'','HC totales ofrecidas':o.configuredTotal??'','Reglas de habilitación':Array.isArray(p.rules)?p.rules.length:0,'Conflicto':o.conflict?'Sí':'No'
    }})
  }
  function teamData(){
    return Object.values(root().areaTeams||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')).map(t=>({
      'Equipo':t.name,'Tipo':t.kind==='FO'?'Formación Orientada':'Formación General','Orientación':t.orientation||'','HC comunes derivadas':staff()?.teamCommonHours?.(t.id)??t.coordinationHours??0,'Docentes':(t.teacherIds||[]).map(teacherName).filter(Boolean).join(' · ')
    }))
  }
  function availabilityData(){
    const av=availabilityApi(),days=gridApi()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']],n=Math.max(1,Number(gridApi()?.periodCount?.()||8)),out=[];
    for(const t of teachers())for(const[d,label]of days)for(let p=1;p<=n;p++){const status=av?.status?.(t.id,d,p)||((av?.available?.(t.id,d,p)===false)?'unavailable':'available');out.push({'Docente':t.name,'Día':label,'HC':p,'Horario':gridApi()?.slotLabel?.(p)||'','Estado':status==='avoid'?'Preferentemente no':status==='unavailable'?'No disponible':'Disponible'})}
    return out;
  }
  function scheduleData(){
    const s=scheduleApi()?.latest?.();if(!s)return[];const days=new Map((s.grid?.days||[]).map(x=>[x.id,x.label])),slots=s.grid?.slots||[];
    return(s.entries||[]).map(e=>{const slot=slots[Number(e.period)-1]||{};if(e.type==='classpair')return{'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,'Tipo':'Clase','Orientación':e.orientation||'','Curso':e.course||'','1.er cuatrimestre':e.s1?.name||'','Docente C1':e.s1?.teacherName||'','2.º cuatrimestre':e.s2?.name||'','Docente C2':e.s2?.teacherName||''};if(e.type==='area')return{'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,'Tipo':'Planificación común','Orientación':'','Curso':'','1.er cuatrimestre':e.label||'','Docente C1':(e.teacherNames||[]).join(' · '),'2.º cuatrimestre':e.label||'','Docente C2':(e.teacherNames||[]).join(' · ')};return{'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,'Tipo':'Trabajo institucional','Orientación':'','Curso':'','1.er cuatrimestre':e.label||'','Docente C1':e.teacherName||'','2.º cuatrimestre':e.label||'','Docente C2':e.teacherName||''}})
  }
  function pciData(){return(state.selected||[]).map(o=>{const map=ensure(o),r=pciApi()?.implementationRows?.(o)||[];return{'Orientación':o,'Estado Fase 1':map.valid?'Validado':'En construcción','Instancias institucionales':r.length,'Con HC':r.filter(x=>x.hours!=null).length,'HC pendientes':r.filter(x=>x.hours==null).length}})}

  async function exportExcel(){
    try{
      const XLSX=await loadXLSX(),wb=XLSX.utils.book_new(),add=(name,data)=>{const safe=data?.length?data:[{'Sin datos':'—'}],ws=XLSX.utils.json_to_sheet(safe);XLSX.utils.book_append_sheet(wb,ws,name)};
      add('Demanda',staff()?.demandRows?.()||[]);add('Asignaciones',assignmentsData());add('Docentes',teacherData());add('Perfiles',staff()?.profileRows?.()||[]);add('Planificacion',staff()?.planningRows?.()||[]);add('Equipos',teamData());add('Disponibilidad',availabilityData());add('Horario anual',scheduleData());add('PCI fuentes',pciData());add('Propuesta',staff()?.proposalRows?.()||[]);
      XLSX.writeFile(wb,`implementacion-institucional-v68-${slug(state.school||'escuela')||'escuela'}.xlsx`);
    }catch(e){toast(e.message||String(e),true)}
  }
  function downloadBackup(){
    try{
      const payload={version:'v68',exportedAt:new Date().toISOString(),state};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`respaldo-completo-v68-${slug(state.school||'escuela')||'escuela'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){toast('No se pudo generar el respaldo completo.',true)}
  }

  function printImplementation(){
    const content=$id('printContent'),modal=$id('printModal');if(!content||!modal)return;const asg=assignmentsData(),docs=teacherData(),teams=teamData(),pcis=pciData(),d=staff()?.demand?.()||{},min=staff()?.institutionalMinimum?.()||{},proposal=staff()?.currentProposal?.();
    content.className='print-preview-wrap';content.innerHTML=`<article class="pci-print-sheet v68-sheet"><div class="pci-print-kicker">Implementación institucional general · V68</div><h1>${esc(state.school)}</h1><div class="pci-print-meta"><div><strong>Demanda anual</strong>${fmt(d.annualGrid||0)} HC</div><div><strong>Plan oficial</strong>${fmt(d.officialAnnual||0)} HC</div><div><strong>Extra-plan</strong>${fmt(d.extraAnnual||0)} HC</div><div><strong>Carga mínima actual</strong>${fmt(min.total||0)} HC</div><div><strong>Docentes</strong>${docs.length}</div><div><strong>Generado</strong>${new Date().toLocaleString('es-AR')}</div></div><h2>PCI que alimentan la implementación</h2><table><thead><tr><th>Orientación</th><th>Estado Fase 1</th><th>Instancias</th><th>HC pendientes</th></tr></thead><tbody>${pcis.map(x=>`<tr><td>${esc(x['Orientación'])}</td><td>${esc(x['Estado Fase 1'])}</td><td>${esc(x['Instancias institucionales'])}</td><td>${esc(x['HC pendientes'])}</td></tr>`).join('')}</tbody></table><h2>Plantel y carga mínima</h2><table><thead><tr><th>Docente</th><th>Orientaciones</th><th>Frente a curso</th><th>Planificación mínima</th><th>Carga mínima</th></tr></thead><tbody>${docs.map(x=>`<tr><td>${esc(x['Docente'])}</td><td>${esc(x['Orientaciones'])}</td><td>${esc(x['HC frente a curso'])}</td><td>${esc(x['HC planificación mínima'])}</td><td>${esc(x['Carga mínima'])}</td></tr>`).join('')}</tbody></table><h2>Equipos de planificación</h2><table><thead><tr><th>Equipo</th><th>Tipo</th><th>HC comunes</th><th>Docentes</th></tr></thead><tbody>${teams.map(x=>`<tr><td>${esc(x['Equipo'])}</td><td>${esc(x['Tipo'])}</td><td>${esc(x['HC comunes derivadas'])}</td><td>${esc(x['Docentes'])}</td></tr>`).join('')}</tbody></table>${proposal?`<h2>Propuesta de planta en estudio</h2><p>Estado: ${proposal.viability?.ok?'viable en simulación':proposal.viability?'con incompatibilidades':'pendiente de simular'} · ${proposal.stats?.assigned||0}/${proposal.stats?.instances||0} instancias asignadas · ${proposal.stats?.changes||0} cambios respecto de la planta vigente.</p>`:''}<h2 class="v68-break">Asignación docente consolidada</h2><table><thead><tr><th>Orientación</th><th>Curso</th><th>Materia / espacio</th><th>Origen</th><th>HC</th><th>Docente</th><th>Fija</th></tr></thead><tbody>${asg.map(x=>`<tr><td>${esc(x['Orientación'])}</td><td>${esc(x['Curso'])}</td><td>${esc(x['Materia / espacio'])}</td><td>${esc(x['Origen'])}</td><td>${esc(x['HC semanales'])}</td><td>${esc(x['Docente']||'Sin asignar')}</td><td>${esc(x['Asignación fija'])}</td></tr>`).join('')}</tbody></table></article>`;modal.classList.add('open');
  }

  function decorate(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;let box=$id('v67InstitutionalExport')||$id('v68InstitutionalExport');if(!box){box=document.createElement('section');host.prepend(box)}box.id='v68InstitutionalExport';box.className='card v48-section v68-export';box.innerHTML=`<div class="eyebrow">Documentación institucional · V68</div><h2>Descargar e imprimir</h2><p>El Excel incluye demanda, asignaciones, plantel, perfiles, planificación mínima, equipos, disponibilidad, propuesta y horario anual. El respaldo JSON guarda el estado completo de la escuela, incluidos los PCI, sin modificar Fase 1 ni Fase 2.</p><div class="v68-actions"><button type="button" class="btn primary" data-v68-xlsx>Descargar Excel institucional</button><button type="button" class="btn" data-v68-print>Imprimir implementación</button><button type="button" class="btn soft" data-v68-backup>Descargar respaldo completo JSON</button>${scheduleApi()?.latest?.()?'<button type="button" class="btn" data-v68-schedule-print>Imprimir horario anual</button>':''}</div>`;box.querySelector('[data-v68-xlsx]').onclick=exportExcel;box.querySelector('[data-v68-print]').onclick=printImplementation;box.querySelector('[data-v68-backup]').onclick=downloadBackup;box.querySelector('[data-v68-schedule-print]')?.addEventListener('click',()=>scheduleApi()?.openPrint?.());
  }
  const style=document.createElement('style');style.textContent=`.v68-export{margin-top:0!important;border-color:#b9ddd7;background:#fbfffe}.v68-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v68-sheet{max-width:1100px;margin:auto}.v68-sheet h2{margin:22px 0 8px;font-size:1rem}.v68-sheet table{width:100%;border-collapse:collapse;font-size:.58rem}.v68-sheet th,.v68-sheet td{border:1px solid #b8c5ce;padding:5px;vertical-align:top}.v68-sheet th{background:#edf3f8;text-align:left}.v68-break{break-before:page}@media print{.v68-break{break-before:page}}`;document.head.appendChild(style);
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,100)}
  function start(){schedule()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1450));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(start,450)},true);
  const publicApi={exportExcel,downloadBackup,printImplementation,decorate,assignmentsData,teacherData,teamData};window.PCIInstitutionalExportV68=publicApi;window.PCIInstitutionalExportV67=publicApi;
})();