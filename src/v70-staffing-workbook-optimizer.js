(() => {
  const $=id=>document.getElementById(id);
  const pci=()=>window.PCIInstitutionalV48||null;
  const staff=()=>window.PCIStaffPlanningV68||null;
  const scheduler=()=>window.PCIAnnualSchedulerV68||window.PCIAnnualSchedulerV65||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  let parsedWorkbook=null,observer=null,observedHost=null,timer=null,searching=false,profileObserver=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[“”«»"']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const slug=v=>norm(v).replace(/\s+/g,'-');
  const fmt=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');
  const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const yes=v=>['si','sí','s','yes','1','true','x'].includes(norm(v));
  const number=v=>{const s=String(v??'').trim().replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null};

  function root(){
    state.institutional=state.institutional||{};const r=state.institutional;
    r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.teacherProfiles=r.teacherProfiles||{};
    r.assignmentLocks=r.assignmentLocks||{};r.availabilityPreferences=r.availabilityPreferences||{};r.availability=r.availability||{};
    return r;
  }
  const rows=()=>pci()?.allImplementationRows?.()||[];
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  function profile(tid){return staff()?.profile?.(tid)||root().teacherProfiles[tid]||null}
  function rowSemesters(row){
    if((row.locations||[]).some(x=>String(x).toLowerCase().includes('anual')))return[1,2];
    const out=new Set();for(const loc of row.locations||[]){const m=String(loc).match(/C(\d+)/i);if(m)out.add(Number(m[1])%2?1:2)}return out.size?[...out]:[1,2];
  }
  function parseYears(v){
    const raw=String(v||'').trim();if(!raw||raw==='1-5'||raw==='1–5')return[1,2,3,4,5];const out=new Set();
    for(const p of raw.split(/[;,\s]+/).filter(Boolean)){const m=p.match(/^(\d)\s*[-–]\s*(\d)$/);if(m){for(let y=Number(m[1]);y<=Number(m[2]);y++)if(y>=1&&y<=5)out.add(y)}else{const y=Number(p);if(y>=1&&y<=5)out.add(y)}}return[...out].sort();
  }
  const yearsLabel=a=>(a||[]).length===5?'1-5':(a||[]).join(',');

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const prior=document.querySelector('script[data-pci-xlsx]');
      if(prior){prior.addEventListener('load',()=>resolve(window.XLSX),{once:true});prior.addEventListener('error',()=>reject(new Error('No se pudo cargar el lector de Excel.')),{once:true});return}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.dataset.pciXlsx='1';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('No se pudo cargar el lector de Excel.'));document.head.appendChild(s);
    });
  }
  const dayRows=()=>grid()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periodCount=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  function dayId(v){const n=norm(v);for(const[id,label]of dayRows())if(n===norm(id)||n===norm(label)||norm(label).startsWith(n)||n.startsWith(norm(label)))return id;return''}
  function statusLabel(v){const n=norm(v);if(n.includes('no disponible')||n==='unavailable'||n==='no')return'unavailable';if(n.includes('prefer')||n==='avoid')return'avoid';return'available'}

  function blank(keys){const o={};for(const k of keys)o[k]='';return o}
  function setCols(ws,widths){ws['!cols']=widths.map(w=>({wch:w}))}
  async function downloadWorkbook(){
    try{
      const XLSX=await loadXLSX(),wb=XLSX.utils.book_new(),r=root(),ts=teachers();
      const instructions=[
        {'HOJA':'DOCENTES','USO':'Una fila por docente. Email, legajo o DNI/CUIL ayudan a mantener identidad única. HC objetivo y HC máximo son frente a curso.'},
        {'HOJA':'HABILITACIONES','USO':'Define qué puede dictar cada docente. Tipo: Área FG, Materia o FO. Prioridad: Preferente, Puede dictar o No asignar.'},
        {'HOJA':'ASIGNACIONES FIJAS','USO':'La plantilla lista todas las instancias curriculares. Completá Docente/Email y marcá Fija=Sí solo en las que el optimizador no debe mover.'},
        {'HOJA':'DISPONIBILIDAD','USO':'Una fila por día y HC. Estado: Disponible, Preferentemente no o No disponible.'},
        {'HOJA':'CATALOGO','USO':'Referencia de las instancias que provienen de Fase 1. No se importa ni modifica Fase 1.'}
      ];
      const docs=ts.map(t=>{const p=profile(t.id)||{};return{'ID docente':t.id,'Docente':t.name||'','Email':t.email||p.email||'','Legajo':p.legajo||t.legajo||'','DNI/CUIL':p.documentId||t.documentId||'','ID institucional':p.institutionalId||t.institutionalId||'','HC objetivo':p.targetHours??'','HC máximo':p.maxHours??''}});
      const rules=[];for(const t of ts){const p=profile(t.id)||{};for(const rule of p.rules||[])rules.push({'ID docente':t.id,'Docente':t.name||'','Email':t.email||p.email||'','Tipo':rule.kind==='subject'?'Materia':rule.kind==='fo'?'FO':'Área FG','Área / materia / orientación':rule.value||'','Años':yearsLabel(rule.years),'Orientación':rule.orientation==='*'?'Todas':rule.orientation||'Todas','Prioridad':rule.priority==='preferred'?'Preferente':rule.priority==='blocked'?'No asignar':'Puede dictar'})}
      const fixed=rows().map(x=>{const tid=r.assignments[x.instanceId]||'',locked=!!r.assignmentLocks[x.instanceId],t=r.teachers[tid]||{};return{'ID instancia':x.instanceId,'Orientación':x.orientation,'Año':x.year,'División':x.division,'Curso':x.course,'Materia / espacio':x.name,'HC semanales':x.hours??'','Docente':locked?t.name||'':'','Email docente':locked?t.email||'':'','Fija':locked?'Sí':'No'}});
      const av=[];for(const t of ts)for(const[d,label]of dayRows())for(let h=1;h<=periodCount();h++){const s=availability()?.status?.(t.id,d,h)||'available';av.push({'ID docente':t.id,'Docente':t.name||'','Email':t.email||'','Día':label,'HC':h,'Estado':s==='unavailable'?'No disponible':s==='avoid'?'Preferentemente no':'Disponible'})}
      const catalog=rows().map(x=>({'ID instancia':x.instanceId,'Orientación':x.orientation,'Año':x.year,'División':x.division,'Curso':x.course,'Materia / espacio':x.name,'Origen':x.origin==='CUSTOM'?'Extra-plan':x.origin==='FO'?'Formación Orientada':'Formación General','Ubicación Fase 1':(x.locations||[]).join(' · '),'HC semanales':x.hours??'','Equipos / correlaciones':(staff()?.relationsForRow?.(x)||[]).map(y=>y.name).join(' · ')}));
      const add=(name,data,headers,widths)=>{const ws=XLSX.utils.json_to_sheet(data.length?data:[blank(headers)],{header:headers});setCols(ws,widths);XLSX.utils.book_append_sheet(wb,ws,name)};
      add('INSTRUCCIONES',instructions,['HOJA','USO'],[22,105]);
      add('DOCENTES',docs,['ID docente','Docente','Email','Legajo','DNI/CUIL','ID institucional','HC objetivo','HC máximo'],[23,28,30,16,18,20,13,13]);
      add('HABILITACIONES',rules,['ID docente','Docente','Email','Tipo','Área / materia / orientación','Años','Orientación','Prioridad'],[23,26,28,14,34,12,28,18]);
      add('ASIGNACIONES FIJAS',fixed,['ID instancia','Orientación','Año','División','Curso','Materia / espacio','HC semanales','Docente','Email docente','Fija'],[38,28,8,10,12,34,13,28,30,10]);
      add('DISPONIBILIDAD',av,['ID docente','Docente','Email','Día','HC','Estado'],[23,26,28,14,8,22]);
      add('CATALOGO',catalog,['ID instancia','Orientación','Año','División','Curso','Materia / espacio','Origen','Ubicación Fase 1','HC semanales','Equipos / correlaciones'],[38,28,8,10,12,34,20,22,13,38]);
      XLSX.writeFile(wb,`planta-docente-integral-${slug(state.school||'escuela')||'escuela'}.xlsx`);
    }catch(e){toast(e.message||String(e),true)}
  }

  function sheetRows(wb,nameAliases){
    const XLSX=window.XLSX;const wanted=nameAliases.map(norm);const name=wb.SheetNames.find(n=>wanted.includes(norm(n)));if(!name)return[];return XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:''}).filter(r=>Object.values(r).some(v=>String(v??'').trim()!==''));
  }
  async function readWorkbook(file){const XLSX=await loadXLSX(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'});return{docs:sheetRows(wb,['DOCENTES']),rules:sheetRows(wb,['HABILITACIONES']),fixed:sheetRows(wb,['ASIGNACIONES FIJAS','ASIGNACIONES_FIJAS']),availability:sheetRows(wb,['DISPONIBILIDAD'])}}
  function val(obj,names){const entries=Object.entries(obj||{});for(const name of names){const hit=entries.find(([k])=>norm(k)===norm(name));if(hit)return String(hit[1]??'').trim()}return''}
  function teacherRef(raw){return{id:val(raw,['ID docente','ID']),name:val(raw,['Docente','Nombre y apellido','Profesor']),email:val(raw,['Email','Email docente','Mail']),legajo:val(raw,['Legajo']),documentId:val(raw,['DNI/CUIL','DNI','CUIL']),institutionalId:val(raw,['ID institucional'])}}
  function findTeacher(ref,list=teachers()){
    if(ref.id&&root().teachers[ref.id])return root().teachers[ref.id];
    const by=(field,value)=>value?list.filter(t=>norm((profile(t.id)||{})[field]||t[field]||'')===norm(value)):[];
    let hit=ref.email?list.filter(t=>norm(t.email||profile(t.id)?.email||'')===norm(ref.email)):[];if(hit.length===1)return hit[0];
    for(const[f,v]of [['legajo',ref.legajo],['documentId',ref.documentId],['institutionalId',ref.institutionalId]]){hit=by(f,v);if(hit.length===1)return hit[0]}
    hit=ref.name?list.filter(t=>norm(t.name)===norm(ref.name)):[];return hit.length===1?hit[0]:null;
  }
  function ensureTeacher(ref){
    let t=findTeacher(ref);if(!t){if(!ref.name&&!ref.email)return null;const id=ref.id&&!root().teachers[ref.id]?ref.id:uid('doc');t={id,name:ref.name||ref.email,email:ref.email||'',baseHours:0,baseHoursSource:'assignments',maxTotalHours:null,offerAnnualPct:null};root().teachers[id]=t}
    if(ref.name)t.name=ref.name;if(ref.email)t.email=ref.email;if(ref.legajo)t.legajo=ref.legajo;if(ref.documentId)t.documentId=ref.documentId;if(ref.institutionalId)t.institutionalId=ref.institutionalId;
    const p=staff()?.profile?.(t.id)||root().teacherProfiles[t.id]||(root().teacherProfiles[t.id]={teacherId:t.id,rules:[]});
    p.rules=Array.isArray(p.rules)?p.rules:[];if(ref.email)p.email=ref.email;if(ref.legajo)p.legajo=ref.legajo;if(ref.documentId)p.documentId=ref.documentId;if(ref.institutionalId)p.institutionalId=ref.institutionalId;
    return t;
  }
  function rowMatch(raw){
    const all=rows(),id=val(raw,['ID instancia']);if(id){const hit=all.find(x=>String(x.instanceId)===id);if(hit)return hit}
    const orientation=val(raw,['Orientación','Orientacion']),year=Number((val(raw,['Año','Ano'])||'').match(/[1-5]/)?.[0]||0),division=val(raw,['División','Division']),course=val(raw,['Curso']),subject=val(raw,['Materia / espacio','Materia','Espacio']);
    let c=all;if(orientation)c=c.filter(x=>norm(x.orientation)===norm(orientation));if(year)c=c.filter(x=>Number(x.year)===year);if(division)c=c.filter(x=>norm(x.division)===norm(division));if(course)c=c.filter(x=>norm(x.course)===norm(course));if(subject)c=c.filter(x=>norm(x.name)===norm(subject));return c.length===1?c[0]:null;
  }
  function kindValue(v){const n=norm(v);if(n==='fo'||n.includes('orientada'))return'fo';if(n.includes('materia')||n.includes('asignatura')||n.includes('espacio'))return'subject';return'area'}
  function priorityValue(v){const n=norm(v);if(n.includes('no asign')||n.includes('bloq')||n==='blocked')return'blocked';if(n.includes('prefer')||n==='preferred')return'preferred';return'allowed'}
  function orientationValue(v){const s=String(v||'').trim();return!s||norm(s)==='todas'||s==='*'?'*':s}

  function analyzeWorkbook(data){
    const a={docs:0,newTeachers:0,rules:0,fixed:0,availability:0,warnings:[],teacherRefs:new Map(),ruleRows:[],fixedRows:[],availabilityRows:[]},existing=teachers();
    for(const raw of data.docs||[]){const ref=teacherRef(raw);if(!ref.name&&!ref.email&&!ref.id)continue;a.docs++;const found=findTeacher(ref,existing);if(!found)a.newTeachers++;a.teacherRefs.set(norm(ref.id||ref.email||ref.legajo||ref.documentId||ref.name),ref)}
    for(const raw of data.rules||[]){const ref=teacherRef(raw),value=val(raw,['Área / materia / orientación','Area / materia / orientacion','Valor','Materia','Área','Area']);if(!value){a.warnings.push('Hay una habilitación sin área/materia/orientación.');continue}a.rules++;a.ruleRows.push({raw,ref,value,kind:kindValue(val(raw,['Tipo'])),years:parseYears(val(raw,['Años','Anos'])),orientation:orientationValue(val(raw,['Orientación','Orientacion'])),priority:priorityValue(val(raw,['Prioridad']))})}
    for(const raw of data.fixed||[]){if(!yes(val(raw,['Fija','Fijo','Lock'])))continue;const row=rowMatch(raw),ref=teacherRef(raw);if(!row){a.warnings.push(`No se identificó una asignación fija: ${val(raw,['Materia / espacio','Materia'])||val(raw,['ID instancia'])||'fila sin nombre'}.`);continue}if(!ref.name&&!ref.email&&!ref.id){a.warnings.push(`${row.course} · ${row.name}: está marcada fija pero no tiene docente.`);continue}a.fixed++;a.fixedRows.push({raw,row,ref})}
    for(const raw of data.availability||[]){const ref=teacherRef(raw),day=dayId(val(raw,['Día','Dia'])),h=Number(val(raw,['HC','Hora','Periodo'])),status=statusLabel(val(raw,['Estado']));if(!day||!(h>=1&&h<=periodCount())){a.warnings.push('Hay una fila de disponibilidad con día u HC inválida.');continue}a.availability++;a.availabilityRows.push({raw,ref,day,h,status})}
    return a;
  }
  function applyWorkbook(){
    if(!parsedWorkbook)return;const a=parsedWorkbook.analysis,r=root();
    const replaceRules=$('v70ReplaceRules')?.checked!==false,replaceLocks=$('v70ReplaceLocks')?.checked===true,replaceAvailability=$('v70ReplaceAvailability')?.checked!==false;
    const teacherMap=new Map();
    for(const raw of parsedWorkbook.data.docs||[]){const ref=teacherRef(raw);if(!ref.name&&!ref.email&&!ref.id)continue;const t=ensureTeacher(ref);if(!t)continue;const p=staff()?.profile?.(t.id)||r.teacherProfiles[t.id],target=number(val(raw,['HC objetivo'])),max=number(val(raw,['HC máximo']));if(target!==null)p.targetHours=target;if(max!==null)p.maxHours=max;teacherMap.set(norm(ref.id||ref.email||ref.legajo||ref.documentId||ref.name),t)}
    const resolve=ref=>findTeacher(ref)||teacherMap.get(norm(ref.id||ref.email||ref.legajo||ref.documentId||ref.name))||ensureTeacher(ref);
    if(replaceRules){const ids=new Set(a.ruleRows.map(x=>resolve(x.ref)?.id).filter(Boolean));for(const id of ids){const p=staff()?.profile?.(id)||r.teacherProfiles[id];if(p)p.rules=[]}}
    for(const x of a.ruleRows){const t=resolve(x.ref);if(!t)continue;const p=staff()?.profile?.(t.id)||r.teacherProfiles[t.id];p.rules=p.rules||[];const rule={id:uid('rule'),kind:x.kind,value:x.value,years:x.years,orientation:x.orientation,priority:x.priority};const key=norm(`${rule.kind}|${rule.value}|${rule.years.join(',')}|${rule.orientation}|${rule.priority}`);if(!p.rules.some(y=>norm(`${y.kind}|${y.value}|${(y.years||[]).join(',')}|${y.orientation}|${y.priority}`)===key))p.rules.push(rule)}
    if(replaceLocks)r.assignmentLocks={};
    for(const x of a.fixedRows){const t=resolve(x.ref);if(!t)continue;r.assignments[x.row.instanceId]=t.id;r.assignmentLocks[x.row.instanceId]=true}
    if(replaceAvailability){const ids=new Set(a.availabilityRows.map(x=>resolve(x.ref)?.id).filter(Boolean));for(const id of ids){r.availabilityPreferences[id]={};r.availability[id]={}}}
    for(const x of a.availabilityRows){const t=resolve(x.ref);if(!t)continue;const k=`${x.day}:${x.h}`;r.availabilityPreferences[t.id]=r.availabilityPreferences[t.id]||{};r.availability[t.id]=r.availability[t.id]||{};if(x.status==='available'){delete r.availabilityPreferences[t.id][k];delete r.availability[t.id][k]}else if(x.status==='avoid'){r.availabilityPreferences[t.id][k]='avoid';delete r.availability[t.id][k]}else{r.availabilityPreferences[t.id][k]='unavailable';r.availability[t.id][k]=false}}
    save();window.PCIAutoAreaCoincidenceV54?.deriveTeams?.();pci()?.renderInstitutional?.();setTimeout(()=>{decorate();window.PCIInstitutionalAccordionV69?.burst?.()},250);toast(`Excel integral aplicado: ${a.docs} docentes · ${a.rules} habilitaciones · ${a.fixed} asignaciones fijas · ${a.availability} filas de disponibilidad.`);parsedWorkbook=null;
  }
  function previewImport(){
    const box=$('v70ImportPreview');if(!box||!parsedWorkbook)return;const a=parsedWorkbook.analysis;
    box.innerHTML=`<div class="v70-import-metrics"><span><strong>${a.docs}</strong> docentes</span><span><strong>${a.newTeachers}</strong> nuevos</span><span><strong>${a.rules}</strong> habilitaciones</span><span><strong>${a.fixed}</strong> fijas</span><span><strong>${a.availability}</strong> disponibilidad</span><span class="${a.warnings.length?'warn':''}"><strong>${a.warnings.length}</strong> observaciones</span></div>${a.warnings.length?`<div class="v70-warnings">${a.warnings.slice(0,14).map(x=>`<div>• ${esc(x)}</div>`).join('')}${a.warnings.length>14?`<small>y ${a.warnings.length-14} más…</small>`:''}</div>`:''}<div class="v70-import-options"><label><input id="v70ReplaceRules" type="checkbox" checked> Reemplazar habilitaciones de los docentes incluidos</label><label><input id="v70ReplaceAvailability" type="checkbox" checked> Reemplazar disponibilidad de los docentes incluidos</label><label><input id="v70ReplaceLocks" type="checkbox"> Reemplazar todas las asignaciones fijas actuales</label></div><button type="button" class="btn primary" id="v70ApplyWorkbook">Aplicar Excel integral</button>`;
    $('v70ApplyWorkbook').onclick=applyWorkbook;
  }
  async function handleWorkbook(file){const box=$('v70ImportPreview');if(box)box.innerHTML='<div class="v48-empty">Leyendo libro integral…</div>';try{const data=await readWorkbook(file),analysis=analyzeWorkbook(data);parsedWorkbook={data,analysis};previewImport()}catch(e){parsedWorkbook=null;if(box)box.innerHTML=`<div class="v70-error">${esc(e.message||String(e))}</div>`}}

  function ruleDecision(tid,row){
    const p=profile(tid)||{},rels=staff()?.relationsForRow?.(row)||[],hits=[];
    for(const rule of p.rules||[]){const years=(rule.years||[]).map(Number);if(years.length&&!years.includes(Number(row.year)))continue;if(rule.orientation&&rule.orientation!=='*'&&rule.orientation!==row.orientation)continue;const target=norm(rule.value),match=rule.kind==='subject'?(norm(row.name)===target||norm(row.name).includes(target)||target.includes(norm(row.name))):rule.kind==='fo'?rels.some(x=>x.kind==='FO'&&norm(x.label)===target):rels.some(x=>x.kind==='FG'&&(norm(x.label)===target||norm(x.name).includes(target)||target.includes(norm(x.label))));if(match)hits.push(rule.priority)}
    if(hits.includes('blocked'))return{allowed:false,blocked:true,priority:'blocked'};if(hits.includes('preferred'))return{allowed:true,blocked:false,priority:'preferred'};if(hits.includes('allowed'))return{allowed:true,blocked:false,priority:'allowed'};return{allowed:false,blocked:false,priority:'none'};
  }
  function capacity(tid){let n=0;for(const[d]of dayRows())for(let h=1;h<=periodCount();h++)if(availability()?.available?.(tid,d,h)!==false)n++;return n||Infinity}
  function loadMap(assignments){const out={};for(const t of teachers())out[t.id]={s1:0,s2:0};for(const row of rows()){const tid=assignments[row.instanceId];if(!tid)continue;out[tid]=out[tid]||{s1:0,s2:0};for(const sem of rowSemesters(row))out[tid][`s${sem}`]+=Number(row.hours||0)}return out}
  function teamCount(tid,row,assignments){const before=new Set();for(const r of rows())if(assignments[r.instanceId]===tid)for(const id of staff()?.rowTeamIds?.(r)||[])before.add(id);for(const id of staff()?.rowTeamIds?.(row)||[])before.add(id);return before.size}
  function candidateCount(row,current){return teachers().filter(t=>{const d=ruleDecision(t.id,row);return d.allowed||(!d.blocked&&current[row.instanceId]===t.id)}).length}
  function buildCandidate(mode='pending',jitter=0){
    const r=root(),current={...r.assignments},assignments=mode==='rebalance'?{}:{...current};
    if(mode==='rebalance')for(const[id,locked]of Object.entries(r.assignmentLocks||{}))if(locked&&current[id])assignments[id]=current[id];
    const process=rows().filter(row=>mode==='rebalance'?!(r.assignmentLocks[row.instanceId]&&current[row.instanceId]):!current[row.instanceId]);
    process.sort((a,b)=>candidateCount(a,current)-candidateCount(b,current)||Number(b.hours||0)-Number(a.hours||0)||(Math.random()-.5)*jitter);
    const unresolved=[];
    for(const row of process){const h=Number(row.hours||0);if(!(h>0)){unresolved.push({instanceId:row.instanceId,reason:'HC pendientes'});continue}const loads=loadMap(assignments),cands=[];
      for(const t of teachers()){const d=ruleDecision(t.id,row),isCurrent=current[row.instanceId]===t.id;if(!d.allowed&&!(isCurrent&&!d.blocked))continue;const l=loads[t.id]||{s1:0,s2:0},next={...l};for(const sem of rowSemesters(row))next[`s${sem}`]+=h;const annual=Math.max(next.s1,next.s2),p=profile(t.id)||{},max=Number(p.maxHours),target=Number(p.targetHours),cap=capacity(t.id);if(max>0&&annual>max+.001)continue;if(Number.isFinite(cap)&&annual>cap)continue;let score=d.priority==='preferred'?-28:d.priority==='allowed'?0:-6;if(target>0)score+=Math.abs(target-annual)*.7;if(max>0)score+=annual/max*2;score+=teamCount(t.id,row,assignments)*1.25;score-=rows().filter(x=>assignments[x.instanceId]===t.id&&norm(x.name)===norm(row.name)).length*1.5;score+=Math.random()*jitter;cands.push({tid:t.id,score,annual})}
      cands.sort((a,b)=>a.score-b.score||a.annual-b.annual);if(cands[0])assignments[row.instanceId]=cands[0].tid;else unresolved.push({instanceId:row.instanceId,reason:'Sin docente compatible/capacidad'})
    }
    const changes=rows().filter(x=>(current[x.instanceId]||'')!==(assignments[x.instanceId]||'')).length,min=staff()?.institutionalMinimum?.(assignments)||{};
    return{assignments,unresolved,changes,minimum:min};
  }
  function compatibilityDiagnosis(){
    const map=new Map(),current=root().assignments;
    for(const row of rows()){const rel=(staff()?.relationsForRow?.(row)||[])[0],key=rel?.name||row.name;if(!map.has(key))map.set(key,{name:key,s1:0,s2:0,rows:[]});const b=map.get(key);for(const sem of rowSemesters(row))b[`s${sem}`]+=Number(row.hours||0);b.rows.push(row)}
    return[...map.values()].map(b=>{const eligible=teachers().filter(t=>b.rows.some(r=>ruleDecision(t.id,r).allowed||(!ruleDecision(t.id,r).blocked&&current[r.instanceId]===t.id)));const declared=eligible.reduce((sum,t)=>{const p=profile(t.id)||{},m=Number(p.maxHours),target=Number(p.targetHours);return sum+(m>0?m:target>0?target:0)},0);const demand=Math.max(b.s1,b.s2);return{...b,demand,eligible:eligible.length,declared,deficit:declared>0&&demand>declared?demand-declared:0}}).sort((a,b)=>b.deficit-a.deficit||b.demand-a.demand);
  }
  async function searchProposal(mode='pending'){
    if(searching)return;searching=true;renderOptimizer();
    try{
      const maxVariants=14,sched=scheduler();if(!sched?.simulateAssignments)throw new Error('No está disponible la simulación anual de horarios.');let best=null,viable=null,seen=new Set(),tested=0;
      for(let i=0;i<maxVariants;i++){
        const c=buildCandidate(mode,i===0?0:12+i*1.5),hash=Object.entries(c.assignments).sort().map(x=>x.join('=')).join('|');if(seen.has(hash)){await new Promise(r=>setTimeout(r,0));continue}seen.add(hash);tested++;
        let sim={ok:false,issues:c.unresolved.length?[`${c.unresolved.length} instancias sin docente compatible.`]:[],warnings:[]};if(!c.unresolved.length)sim=sched.simulateAssignments(c.assignments,i===0?220:130);
        const penalty=(c.unresolved.length*10000)+(sim.ok?0:(sim.issues?.length||1)*120)+c.changes*2+Number(c.minimum?.total||0)*.01;
        const item={...c,sim,penalty};if(!best||item.penalty<best.penalty)best=item;if(sim.ok){viable=item;break}
        root().staffingProposalSearch={running:true,mode,tested,maxVariants,lastIssues:sim.issues||[]};renderOptimizer();await new Promise(r=>setTimeout(r,0));
      }
      const pick=viable||best;if(!pick)throw new Error('No se pudo construir ninguna alternativa de planta.');
      const current=root().assignments;root().staffingProposal={id:uid('staff-v70'),createdAt:new Date().toISOString(),mode,engine:'v70-schedule-search',assignments:pick.assignments,unresolved:pick.unresolved,viability:pick.sim,search:{tested,maxVariants,foundViable:!!viable},stats:{instances:rows().length,assigned:rows().filter(x=>pick.assignments[x.instanceId]).length,pending:rows().filter(x=>!pick.assignments[x.instanceId]).length,changes:rows().filter(x=>(current[x.instanceId]||'')!==(pick.assignments[x.instanceId]||'')).length,front:pick.minimum?.front||0,planning:pick.minimum?.planning||0,explicit:pick.minimum?.explicit||0,minimumTotal:pick.minimum?.total||0,pendingPlanning:pick.minimum?.pending?.length||0}};delete root().staffingProposalSearch;save();staff()?.decorate?.();renderOptimizer();toast(viable?`Planta viable encontrada después de ${tested} alternativa${tested===1?'':'s'}.`:`Se probaron ${tested} alternativas, pero ninguna cerró el horario completo.`,!viable);
    }catch(e){delete root().staffingProposalSearch;toast(e.message||String(e),true);renderOptimizer()}finally{searching=false;renderOptimizer()}
  }
  function applyProposal(){const p=root().staffingProposal;if(!p?.viability?.ok)return toast('La propuesta todavía no tiene una simulación horaria viable.',true);staff()?.applyProposal?.();renderOptimizer()}
  function discardProposal(){root().staffingProposal=null;delete root().staffingProposalSearch;save();staff()?.decorate?.();renderOptimizer()}

  function renderOptimizer(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;let section=$('v70Optimizer');if(!section){section=document.createElement('section');section.id='v70Optimizer';section.className='card v48-section v70-optimizer';const old=$('v68Proposal');if(old)old.after(section);else host.appendChild(section)}
    const p=root().staffingProposal,run=root().staffingProposalSearch,diag=compatibilityDiagnosis(),deficits=diag.filter(x=>x.deficit>0),noEligible=diag.filter(x=>x.eligible===0&&x.demand>0);
    let result='<div class="v48-empty">El sistema todavía no generó una propuesta V70.</div>';
    if(run)result=`<div class="v70-searching"><strong>Buscando una planta compatible con el horario…</strong><span>${run.tested} de hasta ${run.maxVariants} alternativas evaluadas.</span></div>`;
    else if(p){const good=!!p.viability?.ok,issues=p.viability?.issues||[];result=`<div class="v70-result ${good?'ok':'bad'}"><div><strong>${good?'Propuesta viable':'Todavía sin solución completa'}</strong><span>${p.search?.tested||1} alternativa${(p.search?.tested||1)===1?'':'s'} probada${(p.search?.tested||1)===1?'':'s'} · ${p.stats?.changes||0} cambios · ${p.stats?.assigned||0}/${p.stats?.instances||0} instancias asignadas</span></div><div><strong>${fmt(p.stats?.minimumTotal||0)} HC</strong><span>carga mínima institucional resultante</span></div></div>${issues.length?`<div class="v70-issues">${issues.slice(0,12).map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>`:''}<div class="v70-result-actions">${good?'<button type="button" class="btn primary" data-v70-apply>Aplicar propuesta viable</button>':''}<button type="button" class="btn soft" data-v70-discard>Descartar propuesta</button></div>`}
    section.innerHTML=`<div class="eyebrow">Motor de planta docente · V70</div><h2>Proponer planta y comprobar el horario</h2><p>Las asignaciones fijas no se mueven. El motor usa habilitaciones, prioridad, HC objetivo/máximas, disponibilidad, equipos derivados y prueba distintas distribuciones hasta encontrar una combinación que también pueda entrar en el horario anual.</p><div class="v70-diagnosis"><span><strong>${rows().length}</strong> instancias</span><span><strong>${teachers().length}</strong> docentes</span><span class="${noEligible.length?'warn':''}"><strong>${noEligible.length}</strong> áreas/espacios sin candidato declarado</span><span class="${deficits.length?'warn':''}"><strong>${deficits.length}</strong> posibles déficits de capacidad</span></div>${(deficits.length||noEligible.length)?`<details class="v70-capacity"><summary>Ver diagnóstico previo</summary>${diag.filter(x=>x.deficit>0||x.eligible===0).slice(0,12).map(x=>`<div><strong>${esc(x.name)}</strong><span>Demanda ${fmt(x.demand)} HC · ${x.eligible} docente${x.eligible===1?'':'s'} compatible${x.eligible===1?'':'s'}${x.declared?` · capacidad declarada potencial ${fmt(x.declared)} HC`:''}${x.deficit?` · faltan ${fmt(x.deficit)} HC`:''}</span></div>`).join('')}</details>`:''}<div class="v70-actions"><button type="button" class="btn" data-v70-search="pending" ${searching?'disabled':''}>Completar pendientes + validar horario</button><button type="button" class="btn primary" data-v70-search="rebalance" ${searching?'disabled':''}>Reorganizar no fijadas + buscar horario viable</button></div>${result}`;
    section.querySelector('[data-v70-search="pending"]')?.addEventListener('click',()=>searchProposal('pending'));section.querySelector('[data-v70-search="rebalance"]')?.addEventListener('click',()=>searchProposal('rebalance'));section.querySelector('[data-v70-apply]')?.addEventListener('click',applyProposal);section.querySelector('[data-v70-discard]')?.addEventListener('click',discardProposal);
    window.PCIInstitutionalAccordionV69?.refresh?.();
  }

  function renderImport(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;let section=$('v70StaffWorkbook');if(!section){section=document.createElement('section');section.id='v70StaffWorkbook';section.className='card v48-section v70-workbook';const source=host.querySelector('.v66-source-section');if(source)source.after(section);else host.prepend(section)}
    section.innerHTML=`<div class="eyebrow">Carga masiva integral</div><h2>Excel de planta docente</h2><p>Un solo libro para cargar identidad docente, HC objetivo/máximas, habilitaciones, asignaciones fijas y disponibilidad. La hoja CATÁLOGO refleja Fase 1 y es solo de referencia.</p><div class="v70-workbook-actions"><button type="button" class="btn soft" data-v70-template>Descargar modelo integral</button><label class="btn primary v70-file">Importar Excel integral<input id="v70WorkbookFile" type="file" accept=".xlsx,.xls" hidden></label></div><div id="v70ImportPreview"></div>`;
    section.querySelector('[data-v70-template]').onclick=downloadWorkbook;$('v70WorkbookFile').onchange=e=>{const f=e.target.files?.[0];if(f)handleWorkbook(f)};
    window.PCIInstitutionalAccordionV69?.refresh?.();
  }
  function pinActions(){
    const box=$('v69ExcelPinned');if(!box)return;const title=box.querySelector('strong');if(title)title.textContent='Planta docente por Excel';const small=box.querySelector('small');if(small)small.textContent='Modelo integral: docentes, habilitaciones, asignaciones fijas y disponibilidad.';
    const a=$('v69PinnedTemplate'),b=$('v69PinnedImport');if(a){a.textContent='Descargar modelo integral';a.onclick=e=>{e.preventDefault();e.stopPropagation();downloadWorkbook()}}if(b){b.textContent='Importar Excel integral';b.onclick=e=>{e.preventDefault();e.stopPropagation();renderImport();const s=$('v70StaffWorkbook');window.PCIInstitutionalAccordionV69?.setCollapsed?.(s,false);s?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('v70WorkbookFile')?.click(),260)}}
  }
  function hideLegacy(){const old=$('v64TeacherImport');if(old)old.style.setProperty('display','none','important');const oldProposal=$('v68Proposal');if(oldProposal)oldProposal.style.setProperty('display','none','important')}

  function injectIdentityFields(){
    const body=$('v68ProfileBody'),modal=$('v68ProfileModal');if(!body||!modal?.classList.contains('open'))return;const email=$('v68ProfileEmail');if(!email||$('v70ProfileIdentity'))return;const tid=document.querySelector('[data-v68-profile][data-v70-active="1"]')?.dataset.v68Profile||window.__v70LastProfileTid||'';if(!tid)return;const p=profile(tid)||{},wrap=document.createElement('div');wrap.id='v70ProfileIdentity';wrap.className='v70-profile-identity';wrap.innerHTML=`<label>Legajo<input id="v70ProfileLegajo" value="${esc(p.legajo||root().teachers[tid]?.legajo||'')}"></label><label>DNI / CUIL<input id="v70ProfileDocument" value="${esc(p.documentId||root().teachers[tid]?.documentId||'')}"></label><label>ID institucional<input id="v70ProfileInstitutionalId" value="${esc(p.institutionalId||root().teachers[tid]?.institutionalId||'')}"></label>`;email.closest('.v68-profile-grid')?.appendChild(wrap);for(const id of['v70ProfileLegajo','v70ProfileDocument','v70ProfileInstitutionalId'])$(id)?.addEventListener('input',()=>syncIdentity(tid))
  }
  function syncIdentity(tid){const t=root().teachers[tid],p=profile(tid);if(!t||!p)return;const leg=$('v70ProfileLegajo')?.value.trim(),doc=$('v70ProfileDocument')?.value.trim(),inst=$('v70ProfileInstitutionalId')?.value.trim();if(leg!==undefined){t.legajo=leg;p.legajo=leg}if(doc!==undefined){t.documentId=doc;p.documentId=doc}if(inst!==undefined){t.institutionalId=inst;p.institutionalId=inst}}
  function watchProfiles(){if(profileObserver)return;profileObserver=new MutationObserver(()=>setTimeout(injectIdentityFields,20));profileObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}

  function decorate(){hideLegacy();renderImport();renderOptimizer();pinActions();watchProfiles()}
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,90)}
  function bind(){const host=$('v48InstitutionalContent');if(!host||host===observedHost)return;observer?.disconnect();observedHost=host;observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})}
  function burst(){[0,120,320,750,1300].forEach(ms=>setTimeout(()=>{bind();decorate()},ms))}
  document.addEventListener('click',e=>{const p=e.target.closest('[data-v68-profile]');if(p){window.__v70LastProfileTid=p.dataset.v68Profile;document.querySelectorAll('[data-v68-profile][data-v70-active]').forEach(x=>x.removeAttribute('data-v70-active'));p.dataset.v70Active='1';setTimeout(injectIdentityFields,40)}if(e.target.closest('[data-v68-save-profile]')){const tid=window.__v70LastProfileTid;if(tid){syncIdentity(tid);save()}}if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home]'))burst()},true);
  window.addEventListener('pci-app-ready',burst);document.addEventListener('DOMContentLoaded',burst,{once:true});burst();

  const style=document.createElement('style');style.textContent=`#v64TeacherImport,#v68Proposal{display:none!important}.v70-workbook{border-color:#a8d4ce;background:#fbfffe}.v70-workbook-actions,.v70-actions,.v70-result-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.v70-file{cursor:pointer}.v70-import-metrics,.v70-diagnosis{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.v70-import-metrics span,.v70-diagnosis span{padding:7px 9px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:.57rem;color:var(--muted)}.v70-import-metrics strong,.v70-diagnosis strong{color:var(--ink)}.v70-import-metrics .warn,.v70-diagnosis .warn{background:#fff8df;border-color:#dfc476;color:#765b18}.v70-warnings,.v70-issues,.v70-error{margin-top:9px;padding:9px 10px;border-radius:10px;background:#fff8df;color:#765b18;font-size:.58rem;line-height:1.45}.v70-error,.v70-issues{background:var(--danger-soft);color:var(--danger)}.v70-import-options{display:grid;gap:5px;margin:10px 0;font-size:.58rem;color:var(--muted)}.v70-import-options label{display:flex;gap:6px;align-items:flex-start}.v70-optimizer{border-color:#b9cfe0;background:#fbfdff}.v70-capacity{margin-top:9px;border:1px solid var(--line);border-radius:11px;padding:8px 10px;background:#fff}.v70-capacity summary{cursor:pointer;font-size:.59rem;font-weight:900}.v70-capacity div{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:.55rem}.v70-capacity div:first-of-type{margin-top:7px}.v70-capacity span{color:var(--muted);text-align:right}.v70-searching,.v70-result{margin-top:11px;padding:11px;border-radius:12px;background:var(--band);display:flex;justify-content:space-between;gap:12px}.v70-result.ok{background:var(--ok-soft);color:var(--ok)}.v70-result.bad{background:var(--danger-soft);color:var(--danger)}.v70-searching strong,.v70-result strong{display:block;font-size:.7rem}.v70-searching span,.v70-result span{display:block;margin-top:3px;font-size:.55rem}.v70-profile-identity{display:contents}.v70-profile-identity label{display:grid;gap:4px;font-size:.57rem;font-weight:850;color:var(--muted)}.v70-profile-identity input{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px}@media(max-width:780px){.v70-capacity div,.v70-result,.v70-searching{flex-direction:column}.v70-capacity span{text-align:left}}`;document.head.appendChild(style);

  window.PCIStaffingV70={downloadWorkbook,readWorkbook,analyzeWorkbook,applyWorkbook,compatibilityDiagnosis,buildCandidate,searchProposal,renderImport,renderOptimizer,decorate};
})();