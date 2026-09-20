(() => {
  const $=id=>document.getElementById(id);
  const pci=()=>window.PCIInstitutionalV48||null;
  let timer=null,observer=null,observedHost=null,importing=false;

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};
    r.assignments=r.assignments||{};
    return r;
  }
  const rows=()=>pci()?.allImplementationRows?.()||[];
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const slug=v=>norm(v).replace(/\s+/g,'-');
  const uid=()=>`doc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const CARGO_OPTIONS=['TC · 36 HC','TP1 · 30 HC','TP2 · 24 HC','TP3 · 18 HC','TP4 · 12 HC','Por horas · ingresar HC'];
  function cargoCode(value){
    const v=String(value||'').trim().toUpperCase();
    if(v.startsWith('TC'))return'TC';
    if(v.startsWith('TP1'))return'TP1';
    if(v.startsWith('TP2'))return'TP2';
    if(v.startsWith('TP3'))return'TP3';
    if(v.startsWith('TP4'))return'TP4';
    if(v.includes('POR HORAS')||v==='POR_HORAS')return'POR_HORAS';
    return'';
  }

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){
        if(window.XLSX)return resolve(window.XLSX);
        prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});
        prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el lector de Excel.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.async=true;s.dataset.pciXlsx='1';
      s.onload=()=>resolve(window.XLSX);
      s.onerror=()=>reject(new Error('No se pudo cargar el lector de Excel.'));
      document.head.appendChild(s);
    });
  }

  function loadExcelJS(){
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-exceljs]');
      if(prior){
        if(window.ExcelJS)return resolve(window.ExcelJS);
        prior.addEventListener('load',()=>resolve(window.ExcelJS),{once:true});
        prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el generador de Excel.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.async=true;s.dataset.pciExceljs='1';
      s.onload=()=>resolve(window.ExcelJS);
      s.onerror=()=>reject(new Error('No se pudo cargar el generador de Excel.'));
      document.head.appendChild(s);
    });
  }

  function teacherForAssignment(instanceId){
    const r=root(),tid=r.assignments[instanceId]||'';
    return r.teachers[tid]||null;
  }

  async function downloadSimpleWorkbook(){
    try{
      const ExcelJS=await loadExcelJS();
      const wb=new ExcelJS.Workbook();
      wb.creator='PCI Secundaria Aprende';
      wb.created=new Date();

      const catalog=wb.addWorksheet('CATALOGOS');
      CARGO_OPTIONS.forEach((x,i)=>catalog.getCell(i+1,1).value=x);
      catalog.state='veryHidden';

      const plant=wb.addWorksheet('PLANTA DOCENTE');
      plant.columns=[
        {header:'Nombre y apellido',key:'name',width:30},
        {header:'DNI',key:'dni',width:16},
        {header:'Mail',key:'email',width:34},
        {header:'Tipo de cargo',key:'cargo',width:24},
        {header:'HC por horas',key:'manualHours',width:14}
      ];
      const list=Object.values(root().teachers||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
      for(const t of list){
        const cargo=t.cargoType==='POR_HORAS'?'Por horas · ingresar HC':t.cargoType&&['TC','TP1','TP2','TP3','TP4'].includes(t.cargoType)?`${t.cargoType} · ${({TC:36,TP1:30,TP2:24,TP3:18,TP4:12})[t.cargoType]} HC`:'';
        plant.addRow({name:t.name||'',dni:t.dni||'',email:t.email||'',cargo,manualHours:t.cargoType==='POR_HORAS'?(t.manualHours||''):''});
      }
      while(plant.rowCount<101)plant.addRow({});
      plant.views=[{state:'frozen',ySplit:1}];
      plant.autoFilter={from:'A1',to:'E1'};
      for(let r=2;r<=plant.rowCount;r++){
        plant.getCell(r,4).dataValidation={type:'list',allowBlank:true,formulae:["'CATALOGOS'!$A$1:$A$6"],showErrorMessage:true,errorTitle:'Tipo de cargo',error:'Elegí un cargo del desplegable.'};
      }
      plant.getRow(1).font={bold:true};

      const asg=wb.addWorksheet('ASIGNACIONES');
      asg.columns=[
        {header:'Orientación',key:'orientation',width:28},
        {header:'Curso',key:'course',width:16},
        {header:'Materia / espacio',key:'subject',width:38},
        {header:'HC',key:'hours',width:9},
        {header:'Docente',key:'teacher',width:30},
        {header:'DNI docente',key:'dni',width:16},
        {header:'__ID',key:'id',width:16}
      ];
      for(const row of rows()){
        const t=teacherForAssignment(row.instanceId);
        asg.addRow({orientation:row.orientation||'',course:row.course||'',subject:row.name||'',hours:row.hours??'',teacher:t?.name||'',dni:t?.dni||'',id:row.instanceId});
      }
      asg.getColumn(7).hidden=true;
      asg.views=[{state:'frozen',ySplit:1}];
      asg.autoFilter={from:'A1',to:'F1'};
      asg.getRow(1).font={bold:true};
      const maxPlant=Math.max(101,plant.rowCount);
      for(let r=2;r<=Math.max(2,asg.rowCount);r++){
        asg.getCell(r,5).dataValidation={type:'list',allowBlank:true,formulae:[`'PLANTA DOCENTE'!$A$2:$A$${maxPlant}`],showErrorMessage:false};
      }

      const buffer=await wb.xlsx.writeBuffer();
      const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`planta-y-asignaciones-${slug(state.school||'escuela')||'escuela'}.xlsx`;
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    }catch(e){toast(e.message||String(e),true)}
  }

  function findTeacher(name,email){
    const list=Object.values(root().teachers||{});
    if(email){const hit=list.find(t=>norm(t.email)===norm(email));if(hit)return hit}
    if(name){const hit=list.find(t=>norm(t.name)===norm(name));if(hit)return hit}
    return null;
  }
  function ensureTeacher(name,email,dni='',cargoType='',manualHours='',appendCargo=false){ cargoType=cargoCode(cargoType)||cargoType;
    let t=findTeacher(name,email);
    if(t){
      if(email&&!t.email)t.email=email;if(name&&!t.name)t.name=name;if(dni&&!t.dni)t.dni=dni;if(t.meetingHours==null)t.meetingHours=3;
      if(!Array.isArray(t.cargos)||!t.cargos.length)t.cargos=[{id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:t.cargoType||'TP4',manualHours:t.cargoType==='POR_HORAS'?Math.max(0,Number(t.manualHours)||0):0}];
      if(appendCargo&&cargoType){
        const h=cargoType==='POR_HORAS'?Math.max(0,Number(manualHours)||0):({TC:36,TP1:30,TP2:24,TP3:18,TP4:12}[cargoType]||0);
        const total=t.cargos.reduce((n,c)=>n+(c.type==='POR_HORAS'?Math.max(0,Number(c.manualHours)||0):({TC:36,TP1:30,TP2:24,TP3:18,TP4:12}[c.type]||0)),0);
        if(total+h>72)throw new Error(`${t.name} supera el tope de 72 HC con los cargos informados.`);
        t.cargos.push({id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:cargoType,manualHours:cargoType==='POR_HORAS'?Math.max(0,Number(manualHours)||0):0});
      }
      return t
    }
    if(!name&&!email)return null;
    t={id:uid(),name:name||email,dni:dni||'',email:email||'',cargoType:cargoType||'TP4',manualHours:cargoType==='POR_HORAS'?Math.max(0,Number(manualHours)||0):0,cargos:[{id:`cargo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:cargoType||'TP4',manualHours:cargoType==='POR_HORAS'?Math.max(0,Number(manualHours)||0):0}],meetingHours:3,baseHours:0,baseHoursSource:'assignments'};
    root().teachers[t.id]=t;
    return t;
  }

  function rowIndex(){
    const byId=new Map(),byKey=new Map();
    for(const row of rows()){
      byId.set(String(row.instanceId),row);
      const key=`${norm(row.orientation)}|${norm(row.course)}|${norm(row.name)}`;
      if(!byKey.has(key))byKey.set(key,[]);
      byKey.get(key).push(row);
    }
    return{byId,byKey};
  }
  function findRow(raw,index){
    const id=String(raw.__ID||'').trim();
    if(id&&index.byId.has(id))return index.byId.get(id);
    const key=`${norm(raw['Orientación'])}|${norm(raw['Curso'])}|${norm(raw['Materia / espacio'])}`;
    const hits=index.byKey.get(key)||[];
    return hits.length===1?hits[0]:null;
  }

  function setImportUi(text,kind='note'){
    const result=$('v71SimpleExcelResult');
    if(result)result.innerHTML=`<div class="v71-simple-${kind}">${text}</div>`;
  }

  async function importSimpleWorkbook(file){
    if(importing)return;
    importing=true;
    const input=document.querySelector('input[data-v71-simple-file]');
    if(input)input.disabled=true;
    setImportUi('Leyendo planta y asignaciones…');
    try{
      const XLSX=await loadXLSX(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'});
      const r=root(),index=rowIndex();
      let created=0,updated=0,assigned=0,skipped=0;

      const plantName=wb.SheetNames.find(n=>norm(n)==='planta docente');
      const assignmentName=wb.SheetNames.find(n=>norm(n)==='asignaciones'||norm(n)==='asignacion docente');

      if(plantName){
        const plantData=XLSX.utils.sheet_to_json(wb.Sheets[plantName],{defval:''});
        for(const raw of plantData){
          const name=String(raw['Nombre y apellido']||raw['Docente']||'').trim();
          const dni=String(raw['DNI']||'').trim();
          const email=String(raw['Mail']||raw['Email']||'').trim();
          const cargoType=cargoCode(raw['Tipo de cargo']);
          const manualHours=raw['HC por horas'];
          if(!name&&!email&&!dni)continue;
          const before=findTeacher(name,email);
          const t=ensureTeacher(name,email,dni,cargoType||'TP4',manualHours,!!before);
          if(!t){skipped++;continue}
          if(before)updated++;else created++;
        }
      }

      const sheetName=assignmentName||(!plantName?wb.SheetNames[0]:null);
      if(sheetName){
        const data=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{defval:''});
        for(const raw of data){
          const row=findRow(raw,index);if(!row){if(raw['Materia / espacio'])skipped++;continue}
          const name=String(raw['Docente']||'').trim();
          const dni=String(raw['DNI docente']||raw['DNI']||'').trim();
          const email=String(raw['Email']||'').trim();
          if(!name&&!dni&&!email)continue;
          let t=Object.values(r.teachers).find(x=>(dni&&String(x.dni||'')===dni)||(email&&norm(x.email)===norm(email))||(name&&norm(x.name)===norm(name)));
          if(!t){
            const cargoType=cargoCode(raw['Tipo de cargo'])||'TP4';
            t=ensureTeacher(name,email,dni,cargoType,raw['HC por horas']);
            if(t)created++;
          }
          if(!t){skipped++;continue}
          r.assignments[row.instanceId]=t.id;assigned++;
        }
      }

      save();
      try{window.PCIAutoAreaCoincidenceV54?.deriveTeams?.()}catch(e){console.warn('V71 deriveTeams',e)}
      setImportUi(`<strong>${created}</strong> docentes nuevos · <strong>${updated}</strong> actualizados · <strong>${assigned}</strong> asignaciones cargadas${skipped?` · ${skipped} filas no identificadas`:''}.<br><span>Primero se cargó la planta/cargo y después las asignaciones frente a curso.</span>`,'ok');
      toast(`Planta importada: ${created+updated} docentes · ${assigned} asignaciones.`);
      setTimeout(()=>{
        try{window.PCILeanManagementV71?.render?.()}catch(e){console.warn('V71 management refresh',e)}
        try{window.PCIAnnualSchedulerV68?.render?.()}catch(e){console.warn('V71 schedule refresh',e)}
      },350);
    }catch(e){
      setImportUi(String(e.message||e),'error');
      toast(e.message||String(e),true);
    }finally{
      importing=false;
      if(input){input.disabled=false;input.value=''}
    }
  }

  function render(){
    const host=$('v48InstitutionalContent');
    if(!host||!$('institutional')?.classList.contains('active'))return;
    const old=$('v70StaffWorkbook');if(old)old.style.setProperty('display','none','important');
    const optimizer=$('v70Optimizer');if(optimizer)optimizer.style.setProperty('display','none','important');
    let section=$('v71SimpleAssignmentExcel');
    if(!section){
      section=document.createElement('section');section.id='v71SimpleAssignmentExcel';section.className='card v48-section v71-simple-excel';
      const source=host.querySelector('.v66-source-section');if(source)source.after(section);else host.prepend(section);
    }
    if(section.dataset.ready==='1')return;
    section.dataset.ready='1';
    section.innerHTML=`
      <div class="eyebrow">Carga masiva simple</div>
      <h2>Planta primero, asignaciones después</h2>
      <p>El archivo tiene dos hojas. En <strong>PLANTA DOCENTE</strong> cargás nombre, DNI, mail y el <strong>tipo de cargo desde un desplegable</strong>. En <strong>ASIGNACIONES</strong> vinculás después cada materia/curso con un docente de esa planta.</p>
      <div class="v71-simple-actions">
        <button type="button" class="btn soft" data-v71-simple-download>Descargar Excel</button>
        <label class="btn primary v71-simple-file">Importar Excel<input type="file" accept=".xlsx,.xls" hidden data-v71-simple-file></label>
      </div>
      <div class="v71-simple-example"><strong>Orden correcto:</strong><span>1. Juan Pérez · TP2 · 24 HC → 2. Matemática 1.º A · 4 HC → Juan Pérez</span></div>
      <div id="v71SimpleExcelResult"></div>`;
    section.querySelector('[data-v71-simple-download]').onclick=downloadSimpleWorkbook;
    section.querySelector('input[data-v71-simple-file]').onchange=e=>{const f=e.target.files?.[0];if(f)importSimpleWorkbook(f)};
  }

  function decorate(){if(!importing)render()}
  function refresh(){if(importing)return;clearTimeout(timer);timer=setTimeout(decorate,70)}
  function bind(){
    const host=$('v48InstitutionalContent');if(!host||host===observedHost)return;
    observer?.disconnect();observedHost=host;observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false});
  }
  function burst(){[0,120,350,800].forEach(ms=>setTimeout(()=>{bind();decorate()},ms))}
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home]'))burst()},true);
  window.addEventListener('pci-app-ready',burst);burst();

  const style=document.createElement('style');style.textContent=`
    #v70StaffWorkbook,#v70Optimizer{display:none!important}
    .v71-simple-excel{border-color:#a8d4ce;background:#fbfffe}
    .v71-simple-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .v71-simple-file{cursor:pointer}
    .v71-simple-example{margin-top:10px;padding:9px 10px;border-radius:10px;background:var(--band);font-size:.58rem;line-height:1.45}.v71-simple-example strong{display:block}.v71-simple-example span{color:var(--muted)}
    .v71-simple-note,.v71-simple-ok,.v71-simple-error{margin-top:10px;padding:9px 10px;border-radius:10px;font-size:.58rem;line-height:1.45}.v71-simple-ok{background:var(--ok-soft);color:var(--ok)}.v71-simple-ok span{color:inherit;opacity:.85}.v71-simple-error{background:var(--danger-soft);color:var(--danger)}
    @media(max-width:780px){.v71-simple-actions{flex-direction:column}.v71-simple-actions>.btn,.v71-simple-actions>.v71-simple-file{width:100%;box-sizing:border-box;justify-content:center;text-align:center}}
  `;document.head.appendChild(style);
  window.PCISimpleAssignmentExcelV71={downloadSimpleWorkbook,importSimpleWorkbook,render};
})();