(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  const offerApi=()=>window.PCIAnnualOfferV65||null;
  const scheduleApi=()=>window.PCIAnnualSchedulerV65||null;
  const availabilityApi=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const gridApi=()=>window.PCIScheduleConfigV51||null;
  let observer=null,timer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function root(){state.institutional=state.institutional||{};const r=state.institutional;r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};return r}
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const rows=()=>api()?.allImplementationRows?.()||[];
  const teacherName=id=>root().teachers[id]?.name||'';
  const teacherEmail=id=>root().teachers[id]?.email||'';
  const originLabel=o=>o==='FO'?'Formación Orientada':o==='CUSTOM'?'Institucional':'Formación General';

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el generador de Excel.')),{once:true});return}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.dataset.pciXlsx='1';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar el generador de Excel.'));document.head.appendChild(s);
    });
  }

  function assignmentsData(){
    return rows().map(r=>{
      const tid=root().assignments[r.instanceId]||'';
      return {
        'ID instancia':r.instanceId,
        'Orientación':r.orientation,
        'Año':r.year,
        'División':r.division,
        'Curso':r.course,
        'Materia / espacio':r.name,
        'Origen':originLabel(r.origin),
        'Ubicación Fase 1':(r.locations||[]).join(' · '),
        'HC semanales':r.hours??'',
        'Docente':teacherName(tid),
        'Email docente':teacherEmail(tid),
        'Estado':tid?'Asignado':'Sin asignar'
      };
    });
  }

  function teacherData(){
    const all=rows();
    return teachers().map(t=>{
      const mine=all.filter(r=>root().assignments[r.instanceId]===t.id);
      const orientations=[...new Set(mine.map(r=>r.orientation))];
      const courses=[...new Set(mine.map(r=>`${r.orientation} · ${r.course}`))];
      const o=offerApi()?.offer?.(t.id)||{};
      return {
        'Docente':t.name,
        'Email':t.email||'',
        'Orientaciones':orientations.join(' · '),
        'Cursos':courses.join(' · '),
        'HC frente a curso':o.front??'',
        'HC planificación/equipo':o.team??'',
        'Otras HC institucionales':o.explicit??'',
        'Mínimo fuera de curso':o.minimumOutside??'',
        '% fuera de curso elegido':o.selected??'',
        'HC fuera de curso resultantes':o.targetOutside??'',
        'HC totales ofrecidas':o.configuredTotal??'',
        'Conflicto':o.conflict?'Sí':'No'
      };
    });
  }

  function teamData(){
    return Object.values(root().areaTeams||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')).map(t=>({
      'Equipo':t.name,
      'Tipo':t.kind==='FO'?'Formación Orientada':'Formación General',
      'Orientación':t.orientation||'',
      'HC comunes':Number(t.coordinationHours||0),
      'Docentes':(t.teacherIds||[]).map(teacherName).filter(Boolean).join(' · ')
    }));
  }

  function availabilityData(){
    const apiAv=availabilityApi(),days=gridApi()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']],n=Math.max(1,Number(gridApi()?.periodCount?.()||8));
    const out=[];
    for(const t of teachers())for(const[d,label]of days)for(let p=1;p<=n;p++){
      const status=apiAv?.status?.(t.id,d,p)||((apiAv?.available?.(t.id,d,p)===false)?'unavailable':'available');
      out.push({'Docente':t.name,'Día':label,'HC':p,'Horario':gridApi()?.slotLabel?.(p)||'', 'Estado':status==='avoid'?'Preferentemente no':status==='unavailable'?'No disponible':'Disponible'});
    }
    return out;
  }

  function scheduleData(){
    const s=scheduleApi()?.latest?.();if(!s)return[];
    const days=new Map((s.grid?.days||[]).map(x=>[x.id,x.label]));
    const slots=s.grid?.slots||[];
    return (s.entries||[]).map(e=>{
      const slot=slots[Number(e.period)-1]||{};
      if(e.type==='classpair')return {
        'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,
        'Tipo':'Clase','Orientación':e.orientation||'','Curso':e.course||'',
        '1.er cuatrimestre':e.s1?.name||'','Docente C1':e.s1?.teacherName||'',
        '2.º cuatrimestre':e.s2?.name||'','Docente C2':e.s2?.teacherName||''
      };
      if(e.type==='area')return {'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,'Tipo':'Planificación común','Orientación':'','Curso':'','1.er cuatrimestre':e.label||'','Docente C1':(e.teacherNames||[]).join(' · '),'2.º cuatrimestre':e.label||'','Docente C2':(e.teacherNames||[]).join(' · ')};
      return {'Día':days.get(e.day)||e.day,'HC':e.period,'Horario':`${slot.start||''}–${slot.end||''}`,'Tipo':'Trabajo institucional','Orientación':'','Curso':'','1.er cuatrimestre':e.label||'','Docente C1':e.teacherName||'','2.º cuatrimestre':e.label||'','Docente C2':e.teacherName||''};
    });
  }

  function pciData(){
    return (state.selected||[]).map(o=>{const map=ensure(o),r=api()?.implementationRows?.(o)||[];return {'Orientación':o,'Estado Fase 1':map.valid?'Validado':'En construcción','Instancias institucionales':r.length,'Con HC':r.filter(x=>x.hours!=null).length,'HC pendientes':r.filter(x=>x.hours==null).length}});
  }

  async function exportExcel(){
    try{
      const XLSX=await loadXLSX(),wb=XLSX.utils.book_new();
      const add=(name,data)=>{const rows=data.length?data:[{'Sin datos':'—'}];const ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,name)};
      add('Asignaciones',assignmentsData());
      add('Docentes',teacherData());
      add('Equipos',teamData());
      add('Disponibilidad',availabilityData());
      add('Horario anual',scheduleData());
      add('PCI fuentes',pciData());
      XLSX.writeFile(wb,`implementacion-institucional-${norm(state.school||'escuela')||'escuela'}.xlsx`);
    }catch(e){toast(e.message||String(e),true)}
  }

  function downloadBackup(){
    const payload={version:'v67',exportedAt:new Date().toISOString(),school:state.school,selectedOrientations:[...(state.selected||[])],institutional:root()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`respaldo-institucional-${norm(state.school||'escuela')||'escuela'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function printImplementation(){
    const content=$id('printContent'),modal=$id('printModal');if(!content||!modal)return;
    const asg=assignmentsData(),docs=teacherData(),teams=teamData(),pcis=pciData();
    const rowsHtml=asg.map(x=>`<tr><td>${esc(x['Orientación'])}</td><td>${esc(x['Curso'])}</td><td>${esc(x['Materia / espacio'])}</td><td>${esc(x['HC semanales'])}</td><td>${esc(x['Docente']||'Sin asignar')}</td></tr>`).join('');
    content.className='print-preview-wrap';
    content.innerHTML=`<article class="pci-print-sheet v67-sheet"><div class="pci-print-kicker">Implementación institucional general</div><h1>${esc(state.school)}</h1><div class="pci-print-meta"><div><strong>PCI</strong>${pcis.length}</div><div><strong>Docentes</strong>${docs.length}</div><div><strong>Asignaciones</strong>${asg.length}</div><div><strong>Generado</strong>${new Date().toLocaleString('es-AR')}</div></div><h2>PCI que alimentan la implementación</h2><table><thead><tr><th>Orientación</th><th>Estado Fase 1</th><th>Instancias</th><th>HC pendientes</th></tr></thead><tbody>${pcis.map(x=>`<tr><td>${esc(x['Orientación'])}</td><td>${esc(x['Estado Fase 1'])}</td><td>${esc(x['Instancias institucionales'])}</td><td>${esc(x['HC pendientes'])}</td></tr>`).join('')}</tbody></table><h2>Plantel y carga institucional</h2><table><thead><tr><th>Docente</th><th>Orientaciones</th><th>Frente a curso</th><th>Fuera de curso</th><th>Total ofrecido</th></tr></thead><tbody>${docs.map(x=>`<tr><td>${esc(x['Docente'])}</td><td>${esc(x['Orientaciones'])}</td><td>${esc(x['HC frente a curso'])}</td><td>${esc(x['HC fuera de curso resultantes'])}</td><td>${esc(x['HC totales ofrecidas'])}</td></tr>`).join('')}</tbody></table><h2>Equipos de planificación</h2><table><thead><tr><th>Equipo</th><th>Tipo</th><th>HC</th><th>Docentes</th></tr></thead><tbody>${teams.map(x=>`<tr><td>${esc(x['Equipo'])}</td><td>${esc(x['Tipo'])}</td><td>${esc(x['HC comunes'])}</td><td>${esc(x['Docentes'])}</td></tr>`).join('')}</tbody></table><h2 class="v67-break">Asignación docente consolidada</h2><table><thead><tr><th>Orientación</th><th>Curso</th><th>Materia / espacio</th><th>HC</th><th>Docente</th></tr></thead><tbody>${rowsHtml}</tbody></table></article>`;
    modal.classList.add('open');
  }

  function decorate(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let box=$id('v67InstitutionalExport');
    if(!box){box=document.createElement('section');box.id='v67InstitutionalExport';box.className='card v48-section v67-export';host.prepend(box)}
    box.innerHTML=`<div class="eyebrow">Documentación institucional</div><h2>Descargar e imprimir</h2><p>La implementación institucional se puede documentar completa. El Excel incluye asignaciones, plantel, carga, equipos, disponibilidad y el último horario anual generado. El respaldo JSON conserva los datos institucionales para recuperación.</p><div class="v67-actions"><button type="button" class="btn primary" data-v67-xlsx>Descargar Excel institucional</button><button type="button" class="btn" data-v67-print>Imprimir implementación</button><button type="button" class="btn soft" data-v67-backup>Descargar respaldo JSON</button>${scheduleApi()?.latest?.()?'<button type="button" class="btn" data-v67-schedule-print>Imprimir horario anual</button>':''}</div>`;
    box.querySelector('[data-v67-xlsx]').onclick=exportExcel;
    box.querySelector('[data-v67-print]').onclick=printImplementation;
    box.querySelector('[data-v67-backup]').onclick=downloadBackup;
    box.querySelector('[data-v67-schedule-print]')?.addEventListener('click',()=>scheduleApi()?.openPrint?.());
  }

  const style=document.createElement('style');style.textContent=`.v67-export{margin-top:0!important;border-color:#b9ddd7;background:#fbfffe}.v67-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v67-sheet{max-width:1100px;margin:auto}.v67-sheet h2{margin:22px 0 8px;font-size:1rem}.v67-sheet table{width:100%;border-collapse:collapse;font-size:.58rem}.v67-sheet th,.v67-sheet td{border:1px solid #b8c5ce;padding:5px;vertical-align:top}.v67-sheet th{background:#edf3f8;text-align:left}.v67-break{break-before:page}@media print{.v67-break{break-before:page}}`;document.head.appendChild(style);
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,100)}
  function start(){schedule();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1000));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(start,350)},true);
  window.PCIInstitutionalExportV67={exportExcel,downloadBackup,printImplementation,decorate};
})();
