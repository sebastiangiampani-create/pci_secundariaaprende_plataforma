(() => {
  const $=id=>document.getElementById(id);
  let timer=null,importing=false;

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.students=r.students||{};
    r.commissions=r.commissions||{};
    return r;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const keyOf=(orientation,year,division)=>`${orientation}|||${year}|||${division}`;
  const selectedOrientations=()=>Array.isArray(state.selected)?state.selected:[];
  const cfgApi=()=>window.PCICustomDivisionsV57||null;
  const baseCfgApi=()=>window.PCIInstitutionalV48||null;
  const defaultLabels=count=>Array.from({length:Math.max(0,Math.min(12,Number(count)||0))},(_,i)=>String.fromCharCode(65+i));

  function labelsFor(orientation,year){
    const custom=cfgApi()?.cfg?.(orientation);
    const labels=custom?.divisionLabels?.[year];
    if(Array.isArray(labels)&&labels.length)return labels;
    const base=baseCfgApi()?.orientationConfig?.(orientation);
    return defaultLabels(base?.courseCounts?.[year]??0);
  }

  function commissionDefs(){
    const out=[];
    for(const orientation of selectedOrientations()){
      for(let year=1;year<=5;year++){
        const labels=labelsFor(orientation,year);
        for(const division of labels){
          out.push({
            key:keyOf(orientation,year,division),
            orientation,year,division,
            course:`${year}.º ${division}`
          });
        }
      }
    }
    return out;
  }

  function courseConfigHtml(){
    const orientations=selectedOrientations();
    if(!orientations.length)return '<div class="v72-warning"><strong>No hay orientaciones seleccionadas.</strong> Volvé al Inicio y seleccioná al menos una orientación.</div>';
    return '<section class="v72-course-config"><div class="eyebrow">Cursos y divisiones</div><h2>Configurar cursos</h2><p>Definí cuántas divisiones tiene cada nivel. Gestión usa esta estructura para comisiones, asignaciones, estudiantes y horarios.</p><div class="v72-course-config-grid">'+orientations.map(orientation=>{
      const base=baseCfgApi()?.orientationConfig?.(orientation);
      return '<article class="v72-course-config-card"><h3>'+esc(orientation)+'</h3><div class="v72-course-years">'+[1,2,3,4,5].map(year=>{
        const labels=labelsFor(orientation,year);
        const count=labels.length||Number(base?.courseCounts?.[year]||0);
        return '<label><span>'+year+'.º</span><input type="number" min="0" max="12" step="1" value="'+count+'" data-v72-course-count="'+year+'" data-orientation="'+esc(orientation)+'"><small>'+esc(labels.join(', ')||'Sin divisiones')+'</small></label>';
      }).join('')+'</div></article>';
    }).join('')+'</div></section>';
  }

  function updateCourseCount(orientation,year,count){
    const n=Math.max(0,Math.min(12,Number(count)||0));
    const base=baseCfgApi()?.orientationConfig?.(orientation);
    if(base){base.courseCounts=base.courseCounts||{};base.courseCounts[year]=n}
    const custom=cfgApi()?.cfg?.(orientation);
    if(custom){
      custom.courseCounts=custom.courseCounts||{};
      custom.divisionLabels=custom.divisionLabels||{};
      custom.courseCounts[year]=n;
      const current=Array.isArray(custom.divisionLabels[year])?[...custom.divisionLabels[year]]:[];
      while(current.length<n)current.push(String.fromCharCode(65+current.length));
      current.length=n;
      custom.divisionLabels[year]=current;
    }
    save();
  }

  function studentsFor(key){
    const ids=root().commissions[key]?.students||[];
    return ids.map(dni=>root().students[dni]).filter(Boolean).sort((a,b)=>String(a.lastName||'').localeCompare(String(b.lastName||''),'es')||String(a.firstName||'').localeCompare(String(b.firstName||''),'es'));
  }
  function ensureCommission(def){
    const r=root();
    r.commissions[def.key]=r.commissions[def.key]||{key:def.key,orientation:def.orientation,year:def.year,division:def.division,course:def.course,students:[]};
    return r.commissions[def.key];
  }

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){
        if(window.XLSX)return resolve(window.XLSX);
        prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});
        prior.addEventListener('error',()=>reject(new Error('No se pudo cargar Excel.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.async=true;s.dataset.pciXlsx='1';
      s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar Excel.'));
      document.head.appendChild(s);
    });
  }

  async function downloadTemplate(key){
    const def=commissionDefs().find(x=>x.key===key);if(!def)return;
    try{
      const XLSX=await loadXLSX();
      const rows=studentsFor(key).map(s=>({
        'DNI':s.dni||'',
        'Apellido':s.lastName||'',
        'Nombre':s.firstName||'',
        'Mail':s.email||''
      }));
      if(!rows.length)rows.push({'DNI':'','Apellido':'','Nombre':'','Mail':''});
      const ws=XLSX.utils.json_to_sheet(rows,{header:['DNI','Apellido','Nombre','Mail']});
      ws['!cols']=[{wch:16},{wch:24},{wch:24},{wch:34}];
      const meta=XLSX.utils.aoa_to_sheet([
        ['Orientación',def.orientation],
        ['Nivel',def.year],
        ['División',def.division],
        ['Comisión',def.course],
        ['__COMMISSION_KEY',def.key]
      ]);
      meta['!cols']=[{wch:22},{wch:40}];
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'ESTUDIANTES');
      XLSX.utils.book_append_sheet(wb,meta,'COMISION');
      XLSX.writeFile(wb,`estudiantes-${def.year}-${String(def.division).replace(/\s+/g,'-')}-${norm(def.orientation).replace(/\s+/g,'-')}.xlsx`);
    }catch(e){toast(e.message||String(e),true)}
  }

  function commissionKeyFromWorkbook(XLSX,wb){
    const meta=wb.Sheets['COMISION'];if(!meta)return'';
    const data=XLSX.utils.sheet_to_json(meta,{header:1,defval:''});
    const row=data.find(r=>String(r[0])==='__COMMISSION_KEY');
    return String(row?.[1]||'');
  }

  async function importStudents(key,file){
    if(importing)return;
    importing=true;
    try{
      const XLSX=await loadXLSX(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'});
      const fileKey=commissionKeyFromWorkbook(XLSX,wb);
      if(fileKey&&fileKey!==key)throw new Error('El Excel pertenece a otra comisión.');
      const sheet=wb.Sheets['ESTUDIANTES']||wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(sheet,{defval:''});
      const def=commissionDefs().find(x=>x.key===key);if(!def)throw new Error('La comisión ya no existe en el Mapa de la Oferta.');
      const commission=ensureCommission(def),newIds=[];
      let loaded=0,updated=0,invalid=0;
      for(const raw of data){
        const dni=String(raw['DNI']||'').replace(/\D/g,'').trim();
        const lastName=String(raw['Apellido']||'').trim();
        const firstName=String(raw['Nombre']||'').trim();
        const email=String(raw['Mail']||raw['Email']||'').trim();
        if(!dni&&!lastName&&!firstName&&!email)continue;
        if(!dni){invalid++;continue}
        const exists=root().students[dni];
        root().students[dni]={dni,lastName,firstName,email,...(exists||{})};
        // Los datos del archivo prevalecen si fueron informados.
        if(lastName)root().students[dni].lastName=lastName;
        if(firstName)root().students[dni].firstName=firstName;
        if(email)root().students[dni].email=email;
        if(exists)updated++;else loaded++;
        newIds.push(dni);
      }
      commission.students=[...new Set(newIds)];
      save();render();
      toast(`${def.course}: ${commission.students.length} estudiantes cargados.${invalid?` ${invalid} filas sin DNI.`:''}`);
    }catch(e){toast(e.message||String(e),true)}
    finally{importing=false}
  }

  function removeStudent(key,dni){
    const c=root().commissions[key];if(!c)return;
    c.students=(c.students||[]).filter(x=>x!==dni);
    save();render();
  }

  function addStudentManual(key){
    const def=commissionDefs().find(x=>x.key===key);if(!def)return;
    const dni=prompt('DNI del estudiante:');if(!dni)return;
    const clean=String(dni).replace(/\D/g,'');if(!clean)return toast('Ingresá un DNI válido.',true);
    const lastName=prompt('Apellido:')||'';
    const firstName=prompt('Nombre:')||'';
    const email=prompt('Mail (opcional):')||'';
    root().students[clean]={...(root().students[clean]||{}),dni:clean,lastName,firstName,email};
    const c=ensureCommission(def);if(!c.students.includes(clean))c.students.push(clean);
    save();render();
  }

  function orphanWarnings(defs){
    const valid=new Set(defs.map(x=>x.key)),warnings=[];
    for(const [key,c] of Object.entries(root().commissions||{})){
      if(!valid.has(key)&&(c.students||[]).length)warnings.push({key,count:c.students.length,course:c.course||key,orientation:c.orientation||''});
    }
    return warnings;
  }

  function render(){
    const host=$('v48InstitutionalContent');
    if(!host||!$('institutional')?.classList.contains('active'))return;
    const defs=commissionDefs();
    defs.forEach(ensureCommission);
    let section=$('v72StudentsCommissions');
    if(!section){
      section=document.createElement('section');
      section.id='v72StudentsCommissions';
      section.className='card v48-section v72-students';
      const availability=$('v60Availability');
      if(availability)host.insertBefore(section,availability);else host.appendChild(section);
    }
    const orphan=orphanWarnings(defs);
    const totalStudents=new Set(defs.flatMap(d=>root().commissions[d.key]?.students||[])).size;
    section.innerHTML=`
      ${courseConfigHtml()}
      <div class="eyebrow" style="margin-top:16px">Comisiones y estudiantes</div>
      <h2>Listados generados desde los cursos configurados</h2>
      <p>Las comisiones no se crean de nuevo acá. Se generan automáticamente según las orientaciones, niveles y divisiones configuradas en el Mapa de la Oferta. El <strong>DNI es el identificador único</strong> del estudiante.</p>
      <div class="v72-summary"><span><strong>${defs.length}</strong> comisiones</span><span><strong>${totalStudents}</strong> estudiantes únicos</span></div>
      ${orphan.length?`<div class="v72-warning"><strong>Atención:</strong> hay ${orphan.length} comisión/es que ya no existen en el Mapa de la Oferta pero conservan estudiantes. No se borraron automáticamente.</div>`:''}
      <div class="v72-grid">
        ${defs.map(def=>{
          const list=studentsFor(def.key);
          return `<article class="v72-card">
            <div class="v72-card-head">
              <div><small>${esc(def.orientation)}</small><h3>${esc(def.course)}</h3></div>
              <span class="v72-count">${list.length} estudiantes</span>
            </div>
            <div class="v72-actions">
              <button type="button" class="btn soft" data-v72-download="${esc(def.key)}">Descargar Excel</button>
              <label class="btn primary v72-file">Importar listado<input type="file" accept=".xlsx,.xls" hidden data-v72-import="${esc(def.key)}"></label>
              <button type="button" class="btn soft" data-v72-add="${esc(def.key)}">+ Alumno</button>
            </div>
            ${list.length?`<details class="v72-list"><summary>Ver listado</summary><div>${list.map(s=>`<div class="v72-student"><span><strong>${esc(s.lastName||'')} ${esc(s.firstName||'')}</strong><small>DNI ${esc(s.dni)}${s.email?` · ${esc(s.email)}`:''}</small></span><button type="button" data-v72-remove="${esc(s.dni)}" data-key="${esc(def.key)}">×</button></div>`).join('')}</div></details>`:''}
          </article>`;
        }).join('')}
      </div>
      ${orphan.length?`<div class="v72-orphans">${orphan.map(o=>`<div><strong>${esc(o.orientation)} · ${esc(o.course)}</strong><span>${o.count} estudiantes pendientes de reubicar</span></div>`).join('')}</div>`:''}
    `;

    section.querySelectorAll('[data-v72-course-count]').forEach(input=>input.onchange=()=>{
      updateCourseCount(input.dataset.orientation,Number(input.dataset.v72CourseCount),input.value);
      render();
      try{window.PCILeanManagementV71?.render?.()}catch{}
      try{window.PCIManagementHomeV73?.refresh?.()}catch{}
    });
    section.querySelectorAll('[data-v72-course-count]').forEach(input=>input.onchange=()=>{
      updateCourseCount(input.dataset.orientation,Number(input.dataset.v72CourseCount),input.value);
      render();
      try{window.PCILeanManagementV71?.render?.()}catch{}
      try{window.PCIManagementHomeV73?.refresh?.()}catch{}
    });
    section.querySelectorAll('[data-v72-download]').forEach(b=>b.onclick=()=>downloadTemplate(b.dataset.v72Download));
    section.querySelectorAll('[data-v72-import]').forEach(i=>i.onchange=e=>{const f=e.target.files?.[0];if(f)importStudents(i.dataset.v72Import,f);e.target.value=''});
    section.querySelectorAll('[data-v72-add]').forEach(b=>b.onclick=()=>addStudentManual(b.dataset.v72Add));
    section.querySelectorAll('[data-v72-remove]').forEach(b=>b.onclick=()=>{if(confirm('Quitar este estudiante de la comisión?'))removeStudent(b.dataset.key,b.dataset.v72Remove)});
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(render,80)}
  function start(){refresh();}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,700));
  document.addEventListener('click',e=>{if(e.target.closest('[data-v71n-open],#openInstitutional,#openInstitutionalGeneral'))setTimeout(start,250)},true);
  setTimeout(start,1500);

  const style=document.createElement('style');
  style.textContent=`
    .v72-students{margin-top:16px;padding:17px}.v72-students h2{margin:4px 0 5px}.v72-course-config{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--band)}.v72-course-config>p{margin:0;color:var(--muted);font-size:.66rem}.v72-course-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:12px}.v72-course-config-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.v72-course-config-card h3{margin:0 0 8px;font-size:.78rem}.v72-course-years{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.v72-course-years label{display:grid;gap:3px}.v72-course-years span{font-size:.52rem;font-weight:900}.v72-course-years input{width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;text-align:center;font-weight:900}.v72-course-years small{font-size:.45rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v72-course-config{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--band)}.v72-course-config>p{margin:0;color:var(--muted);font-size:.66rem}.v72-course-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:12px}.v72-course-config-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.v72-course-config-card h3{margin:0 0 8px;font-size:.78rem}.v72-course-years{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.v72-course-years label{display:grid;gap:3px}.v72-course-years span{font-size:.52rem;font-weight:900}.v72-course-years input{width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;text-align:center;font-weight:900}.v72-course-years small{font-size:.45rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v72-students>p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.45}
    .v72-summary{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.v72-summary span{padding:6px 9px;border-radius:999px;background:var(--band);font-size:.56rem;color:var(--muted)}.v72-summary strong{color:var(--ink)}
    .v72-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px;margin-top:12px}.v72-card{border:1px solid var(--line);border-radius:13px;padding:11px;background:#fff}.v72-card-head{display:flex;justify-content:space-between;gap:8px;align-items:start}.v72-card-head h3{margin:2px 0;font-size:.82rem}.v72-card-head small{font-size:.52rem;color:var(--muted)}.v72-count{padding:5px 7px;border-radius:999px;background:var(--mint-soft);font-size:.5rem;font-weight:850;color:var(--mint-dark);white-space:nowrap}
    .v72-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.v72-actions .btn,.v72-file{font-size:.54rem;padding:7px 9px}.v72-file{cursor:pointer}
    .v72-list{margin-top:9px;border-top:1px solid var(--line);padding-top:7px}.v72-list summary{cursor:pointer;font-size:.56rem;font-weight:850;color:var(--ink)}.v72-student{display:flex;justify-content:space-between;gap:7px;align-items:center;padding:7px 0;border-bottom:1px solid #edf1f4}.v72-student strong{display:block;font-size:.58rem}.v72-student small{display:block;font-size:.49rem;color:var(--muted);margin-top:2px}.v72-student button{width:24px;height:24px;border:0;border-radius:50%;background:var(--danger-soft);color:var(--danger);font-weight:900}
    .v72-warning{margin:9px 0;padding:9px 10px;border-radius:9px;background:var(--danger-soft);color:var(--danger);font-size:.58rem;line-height:1.4}.v72-orphans{display:grid;gap:6px;margin-top:9px}.v72-orphans div{display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid #e3c6cd;border-radius:9px;background:#fff9fa;font-size:.55rem}
    @media(max-width:760px){.v72-course-years{grid-template-columns:repeat(2,1fr)}.v72-grid{grid-template-columns:1fr}.v72-actions{flex-direction:column}.v72-actions .btn,.v72-actions .v72-file{width:100%;box-sizing:border-box;text-align:center}.v72-card-head{flex-direction:column}.v72-orphans div{flex-direction:column}}
  `;
  document.head.appendChild(style);

  window.PCIStudentsCommissionsV72={render,commissionDefs,studentsFor,downloadTemplate,importStudents};
})();