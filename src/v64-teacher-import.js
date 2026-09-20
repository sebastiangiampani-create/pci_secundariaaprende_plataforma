(() => {
  const api=()=>window.PCIInstitutionalV48||null;
  const annual=()=>window.PCIAnnualInstitutionalV64||null;
  const $id=id=>document.getElementById(id);
  let parsed=null,observer=null,timer=null;

  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function root(){state.institutional=state.institutional||{};state.institutional.teachers=state.institutional.teachers||{};state.institutional.assignments=state.institutional.assignments||{};return state.institutional}
  const rows=()=>api()?.allImplementationRows?.()||[];

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el lector de Excel.')),{once:true});return}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.dataset.pciXlsx='1';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar el lector de Excel. Podés usar CSV como alternativa.'));document.head.appendChild(s);
    });
  }

  function findKey(obj,candidates){const map=new Map(Object.keys(obj||{}).map(k=>[norm(k),k]));for(const c of candidates){const exact=map.get(norm(c));if(exact)return exact}for(const[k,orig]of map)if(candidates.some(c=>k.includes(norm(c))||norm(c).includes(k)))return orig;return null}
  const keys={
    id:['ID instancia','instance id','id'],teacher:['Docente','Profesor','Nombre docente','Nombre y apellido'],email:['Email docente','Correo docente','Mail docente','Email'],orientation:['Orientación','Orientacion'],year:['Año','Ano','Nivel'],division:['División','Division','Curso división','Curso'],subject:['Materia / espacio','Materia','Asignatura','Espacio curricular','Espacio']
  };
  function value(obj,list){const k=findKey(obj,list);return k?String(obj[k]??'').trim():''}
  function numberYear(v){const m=String(v||'').match(/[1-5]/);return m?Number(m[0]):0}
  function divisionValue(v,year){let s=String(v||'').trim();if(!s)return'';s=s.replace(new RegExp(`^${year}\\s*[.º°oer]*\\s*`,'i'),'').trim();return s||String(v||'').trim()}

  function matchRow(raw,currentRows){
    const id=value(raw,keys.id);if(id){const hit=currentRows.find(r=>String(r.instanceId)===id);if(hit)return{row:hit,via:'id'}}
    const orientation=value(raw,keys.orientation),year=numberYear(value(raw,keys.year)),division=divisionValue(value(raw,keys.division),year),subject=value(raw,keys.subject);
    let candidates=currentRows;
    if(orientation)candidates=candidates.filter(r=>norm(r.orientation)===norm(orientation));
    if(year)candidates=candidates.filter(r=>Number(r.year)===year);
    if(division)candidates=candidates.filter(r=>norm(r.division)===norm(division)||norm(r.course)===norm(division)||norm(r.course).endsWith(' '+norm(division)));
    if(subject)candidates=candidates.filter(r=>norm(r.name)===norm(subject));
    if(candidates.length===1)return{row:candidates[0],via:'campos'};
    if(subject&&candidates.length>1){const exact=candidates.filter(r=>norm(r.name)===norm(subject));if(exact.length===1)return{row:exact[0],via:'campos'}}
    return{row:null,via:'',candidates:candidates.length};
  }

  function analyze(data){
    const current=rows(),matches=[],unresolved=[],blank=[];
    for(const raw of data){
      const teacher=value(raw,keys.teacher),email=value(raw,keys.email);
      if(!teacher&&!email){blank.push(raw);continue}
      const m=matchRow(raw,current);
      if(m.row)matches.push({raw,row:m.row,teacher,email,via:m.via});
      else unresolved.push({raw,teacher,email});
    }
    const newTeachers=new Set();const existing=Object.values(root().teachers);
    for(const m of matches){const byEmail=m.email&&existing.some(t=>norm(t.email)===norm(m.email)),byName=existing.some(t=>norm(t.name)===norm(m.teacher));if(!byEmail&&!byName)newTeachers.add(norm(m.email||m.teacher))}
    const conflicts=matches.filter(m=>{const old=root().assignments[m.row.instanceId];if(!old)return false;const t=root().teachers[old];return t&&norm(t.name)!==norm(m.teacher)&&(!m.email||norm(t.email)!==norm(m.email))});
    return{data,matches,unresolved,blank,newTeachers:newTeachers.size,conflicts};
  }

  async function readFile(file){
    const XLSX=await loadXLSX();const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error('El archivo no contiene una hoja legible.');const data=XLSX.utils.sheet_to_json(sheet,{defval:''});if(!data.length)throw new Error('La hoja está vacía.');return data;
  }

  function previewHtml(a){
    const unresolved=a.unresolved.slice(0,12).map(x=>`<li>${esc(x.teacher||x.email)} · no se pudo identificar materia/curso</li>`).join('');
    return`<div class="v64-import-summary"><strong>${a.matches.length}</strong><span>asignaciones reconocidas</span><strong>${a.newTeachers}</strong><span>docentes nuevos</span><strong>${a.conflicts.length}</strong><span>asignaciones que ya tienen otro docente</span><strong>${a.unresolved.length}</strong><span>filas sin coincidencia</span></div>${a.unresolved.length?`<div class="v64-import-warn"><strong>Revisar ${a.unresolved.length} fila${a.unresolved.length===1?'':'s'}:</strong><ul>${unresolved}</ul>${a.unresolved.length>12?`<small>y ${a.unresolved.length-12} más…</small>`:''}</div>`:''}<label class="v64-import-check"><input id="v64ImportOverwrite" type="checkbox"> Reemplazar asignaciones existentes cuando el Excel indique otro docente</label><button type="button" class="btn primary" id="v64ApplyImport" ${a.matches.length?'':'disabled'}>Aplicar importación</button>`;
  }

  function teacherFor(name,email){
    const list=Object.values(root().teachers);let t=null;
    if(email)t=list.find(x=>x.email&&norm(x.email)===norm(email));
    if(!t&&name)t=list.find(x=>norm(x.name)===norm(name));
    if(t){if(email&&!t.email)t.email=email;return t}
    const id=`doc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;t={id,name:name||email,email:email||'',baseHours:0,baseHoursSource:'assignments',maxTotalHours:null,offerAnnualPct:null};root().teachers[id]=t;return t;
  }

  function applyImport(){
    if(!parsed)return;const overwrite=$id('v64ImportOverwrite')?.checked;let applied=0,skipped=0,createdBefore=Object.keys(root().teachers).length;
    for(const m of parsed.matches){const teacher=teacherFor(m.teacher,m.email),old=root().assignments[m.row.instanceId];if(old&&old!==teacher.id&&!overwrite){skipped++;continue}root().assignments[m.row.instanceId]=teacher.id;applied++}
    save();const created=Object.keys(root().teachers).length-createdBefore;api()?.renderInstitutional?.();setTimeout(()=>annual()?.refresh?.(),180);toast(`Importación aplicada: ${applied} asignaciones${created?` · ${created} docentes nuevos`:''}${skipped?` · ${skipped} sin reemplazar`:''}.`);
  }

  async function downloadTemplate(){
    try{
      const XLSX=await loadXLSX(),data=rows().map(r=>({'ID instancia':r.instanceId,'Orientación':r.orientation,'Año':r.year,'División':r.division,'Materia / espacio':r.name,'HC semanales':r.hours??'','Docente':'','Email docente':''}));
      if(!data.length)return toast('No hay instancias de Fase 1 para armar la plantilla.',true);
      const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Asignaciones');XLSX.writeFile(wb,`plantilla-asignacion-docente-${String(state.school||'escuela').replace(/[^a-z0-9]+/gi,'-')}.xlsx`);
    }catch(e){toast(e.message||String(e),true)}
  }

  async function handleFile(file){
    const result=$id('v64ImportResult');if(result)result.innerHTML='<div class="v48-empty">Leyendo archivo…</div>';
    try{parsed=analyze(await readFile(file));if(result)result.innerHTML=previewHtml(parsed);$id('v64ApplyImport')?.addEventListener('click',applyImport)}catch(e){parsed=null;if(result)result.innerHTML=`<div class="v64-import-error">${esc(e.message||e)}</div>`}
  }

  function decorate(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;if($id('v64TeacherImport'))return;
    const assignment=host.querySelector('.v48-section:nth-of-type(2)')||[...host.querySelectorAll('.v48-section')].find(s=>s.querySelector('[data-v48-assignment]'));
    const section=document.createElement('section');section.id='v64TeacherImport';section.className='card v48-section v64-import';section.innerHTML=`<div class="eyebrow">Carga masiva</div><h2>Importar docentes y asignaciones desde Excel</h2><p>Podés descargar una plantilla ya armada con las materias, cursos y divisiones que vienen de Fase 1. La escuela completa únicamente Docente y, si quiere, Email docente, y vuelve a subir el archivo. También se aceptan planillas propias si contienen datos suficientes para identificar la asignación.</p><div class="v64-import-actions"><button type="button" class="btn soft" id="v64DownloadTeacherTemplate">Descargar plantilla Excel</button><label class="btn primary v64-file-btn">Subir Excel / CSV<input id="v64TeacherFile" type="file" accept=".xlsx,.xls,.csv" hidden></label></div><small class="v64-import-help">El archivo no modifica la estructura curricular ni las HC de Fase 1. Solo da de alta docentes y completa asignaciones.</small><div id="v64ImportResult"></div>`;
    if(assignment)assignment.before(section);else host.prepend(section);
    $id('v64DownloadTeacherTemplate').onclick=downloadTemplate;$id('v64TeacherFile').onchange=e=>{const f=e.target.files?.[0];if(f)handleFile(f)};
  }

  const style=document.createElement('style');style.textContent=`.v64-import-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v64-file-btn{cursor:pointer}.v64-import-help{display:block;margin-top:8px;color:var(--muted);font-size:.58rem;line-height:1.4}.v64-import-summary{display:grid;grid-template-columns:auto 1fr;gap:4px 9px;margin-top:12px;padding:10px 11px;border-radius:10px;background:var(--band);font-size:.62rem}.v64-import-summary strong{font-size:.72rem}.v64-import-warn,.v64-import-error{margin-top:9px;padding:9px 10px;border-radius:9px;background:#fff5e6;color:#755612;font-size:.61rem;line-height:1.4}.v64-import-error{background:var(--danger-soft);color:var(--danger)}.v64-import-warn ul{margin:5px 0 0;padding-left:17px}.v64-import-check{display:flex;gap:6px;align-items:flex-start;margin:9px 0;font-size:.59rem;color:var(--muted)}`;document.head.appendChild(style);
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,100)}
  function start(){schedule();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,650));document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,260)},true);
  window.PCITeacherImportV64={decorate,analyze,applyImport,downloadTemplate};
})();
