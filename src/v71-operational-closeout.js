(() => {
  const $=id=>document.getElementById(id);
  const baseScheduler=window.PCIAnnualSchedulerV68||window.PCIAnnualSchedulerV65||null;
  const pci=()=>window.PCIInstitutionalV48||null;
  const staff=()=>window.PCIStaffPlanningV68||null;
  const autoTeams=()=>window.PCIAutoAreaCoincidenceV54||null;
  const availability=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const grid=()=>window.PCIScheduleConfigV51||null;
  let lastCheck=null,observer=null,timer=null,pendingRestore=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const slug=v=>norm(v).replace(/\s+/g,'-');
  const deep=x=>JSON.parse(JSON.stringify(x));
  const slotKey=(d,p)=>`${d}:${p}`;
  const days=()=>grid()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  const periods=()=>Math.max(1,Number(grid()?.periodCount?.()||8));
  const available=(tid,d,p)=>availability()?.available?.(tid,d,p)!==false;
  const pref=(tid,d,p)=>Number(availability()?.penalty?.(tid,d,p)||0);
  const uid=()=>`annual-v71-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  function root(){
    state.institutional=state.institutional||{};const r=state.institutional;
    r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};
    r.planningOverrides=r.planningOverrides||{};r.assignmentLocks=r.assignmentLocks||{};
    r.planningPolicy=r.planningPolicy||{threePlus:'manual'};
    r.annualScheduleLocks=Array.isArray(r.annualScheduleLocks)?r.annualScheduleLocks:[];
    r.annualScheduleManagedAssignmentLocks=r.annualScheduleManagedAssignmentLocks||{};
    r.annualScheduleVersions=r.annualScheduleVersions||[];
    return r;
  }
  const teachers=()=>Object.values(root().teachers||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const rows=()=>pci()?.allImplementationRows?.()||[];
  const latest=()=>root().annualScheduleVersions.at(-1)||null;
  const active=()=>root().annualScheduleVersions.find(x=>x.id===root().activeAnnualScheduleId)||null;
  function rowSemesters(row){
    if(Array.isArray(row.semesters)&&row.semesters.length)return row.semesters;
    if((row.locations||[]).some(x=>String(x).toLowerCase().includes('anual')))return[1,2];
    const out=new Set();for(const loc of row.locations||[]){const m=String(loc).match(/C(\d+)/i);if(m)out.add(Number(m[1])%2?1:2)}return out.size?[...out]:[1,2];
  }
  function pairRank(row){
    const ns=(row.locations||[]).map(x=>String(x).match(/C(\d+)/i)).filter(Boolean).map(m=>Number(m[1]));
    return ns.length?Math.min(...ns.map(n=>Math.ceil(n/2))):0;
  }
  function relationKey(row){return(staff()?.relationsForRow?.(row)||[]).map(x=>x.id).sort().join('|')||norm(row.name)}
  function addOcc(map,key,slot){if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(slot)}
  function free(map,tid,d,p){return !!tid&&available(tid,d,p)&&!map.get(tid)?.has(slotKey(d,p))}

  // --- Regla institucional para 3 o más equipos ---
  function syncPlanningPolicy(assignments=root().assignments){
    if(root().planningPolicy.threePlus!=='two-per-team')return;
    const s=staff();if(!s?.teacherPlanning)return;
    for(const t of teachers()){
      const p=s.teacherPlanning(t.id,assignments);if(!p||p.count<3)continue;
      const byTeam={};for(const team of p.teams||[])byTeam[team.id]=2;
      root().planningOverrides[t.id]={...(root().planningOverrides[t.id]||{}),byTeam,validated:true,policy:'two-per-team'};
    }
  }
  function setPlanningPolicy(value){
    root().planningPolicy.threePlus=value;
    if(value==='two-per-team')syncPlanningPolicy();
    save();staff()?.decorate?.();renderPlanningPolicy();setTimeout(()=>window.PCIInstitutionalAccordionV69?.refresh?.(),80);
    toast(value==='two-per-team'?'Regla institucional aplicada: 2 HC por equipo para docentes en 3 o más equipos.':'La distribución para 3 o más equipos vuelve a requerir validación individual.');
  }

  // --- Emparejamiento curricular anual C1/C2, C3/C4... ---
  function unit(row,sem,i){return{instanceId:row.instanceId,teacherId:row.teacherId||root().assignments[row.instanceId]||'',teacherName:row.teacherName||root().teachers[root().assignments[row.instanceId]]?.name||'',orientation:row.orientation,course:row.course,courseKey:`${row.orientation}|${row.course}`,subjectId:row.subjectId,name:row.name,unitIndex:i,sem,pairRank:pairRank(row),relationKey:relationKey(row)}}
  function buildPairs(report){
    const courses=new Map(),crossRank=[];
    for(const row of report.rows||[]){
      const key=`${row.orientation}|${row.course}`;if(!courses.has(key))courses.set(key,{courseKey:key,orientation:row.orientation,course:row.course,s1:[],s2:[]});const b=courses.get(key);
      const sems=rowSemesters(row),h=Number(row.hours||0);for(let i=0;i<h;i++)for(const sem of sems)b[`s${sem}`].push(unit(row,sem,i));
    }
    const pairs=[];
    for(const b of courses.values()){
      const s1=[...b.s1],s2=[...b.s2],used1=new Set(),used2=new Set();
      // Primero: la misma instancia anual, misma unidad.
      for(let i=0;i<s1.length;i++){
        const a=s1[i],j=s2.findIndex((x,k)=>!used2.has(k)&&x.instanceId===a.instanceId&&x.unitIndex===a.unitIndex);
        if(j>=0){used1.add(i);used2.add(j);pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:a,s2:s2[j]})}
      }
      const r1=s1.map((x,i)=>({x,i})).filter(o=>!used1.has(o.i)),r2=s2.map((x,i)=>({x,i})).filter(o=>!used2.has(o.i));
      while(r1.length){
        const a=r1.shift().x;let best=-1,bestScore=Infinity;
        for(let j=0;j<r2.length;j++){
          const z=r2[j].x;let score=Math.abs((a.pairRank||0)-(z.pairRank||0))*30;
          if(a.pairRank&&z.pairRank&&a.pairRank===z.pairRank)score-=20;
          if(a.relationKey===z.relationKey)score-=6;
          score+=String(z.name).localeCompare(String(a.name),'es')===0?-1:0;
          if(score<bestScore){bestScore=score;best=j}
        }
        const z=best>=0?r2.splice(best,1)[0].x:null;
        if(z&&a.pairRank&&z.pairRank&&a.pairRank!==z.pairRank)crossRank.push(`${b.orientation} · ${b.course}: ${a.name} (C${a.pairRank*2-1}/C${a.pairRank*2}) con ${z.name} (C${z.pairRank*2-1}/C${z.pairRank*2})`);
        pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:a,s2:z});
      }
      for(const o of r2)pairs.push({courseKey:b.courseKey,orientation:b.orientation,course:b.course,s1:null,s2:o.x});
    }
    return{pairs,courses,crossRank};
  }
  const pairId=p=>`${p.courseKey}|${p.s1?`${p.s1.instanceId}#${p.s1.unitIndex}`:'-'}|${p.s2?`${p.s2.instanceId}#${p.s2.unitIndex}`:'-'}`;

  // --- Bloqueos del horario anual ---
  function lockKey(e){
    if(e.type==='classpair')return`classpair|${e.courseKey}|${e.day}|${e.period}|${e.s1?`${e.s1.instanceId}#${e.s1.unitIndex}`:'-'}|${e.s2?`${e.s2.instanceId}#${e.s2.unitIndex}`:'-'}`;
    if(e.type==='area')return`area|${e.areaId}|${e.day}|${e.period}`;
    return`institutional|${e.instanceId}|${e.day}|${e.period}`;
  }
  function minimalLock(e){
    if(e.type==='classpair')return{type:'classpair',day:e.day,period:Number(e.period),courseKey:e.courseKey,orientation:e.orientation,course:e.course,s1:e.s1?{instanceId:e.s1.instanceId,unitIndex:e.s1.unitIndex,teacherId:e.s1.teacherId}:null,s2:e.s2?{instanceId:e.s2.instanceId,unitIndex:e.s2.unitIndex,teacherId:e.s2.teacherId}:null};
    if(e.type==='area')return{type:'area',day:e.day,period:Number(e.period),areaId:e.areaId,label:e.label,teacherIds:[...(e.teacherIds||[])]};
    return{type:'institutional',day:e.day,period:Number(e.period),instanceId:e.instanceId,teacherId:e.teacherId,label:e.label};
  }
  function refreshManagedAssignmentLocks(){
    const r=root(),needed=new Set();
    for(const e of r.annualScheduleLocks)if(e.type==='classpair'){if(e.s1?.instanceId)needed.add(e.s1.instanceId);if(e.s2?.instanceId)needed.add(e.s2.instanceId)}
    for(const id of needed)if(!r.assignmentLocks[id]){r.assignmentLocks[id]=true;r.annualScheduleManagedAssignmentLocks[id]=true}
    for(const id of Object.keys(r.annualScheduleManagedAssignmentLocks||{}))if(!needed.has(id)){if(r.annualScheduleManagedAssignmentLocks[id])delete r.assignmentLocks[id];delete r.annualScheduleManagedAssignmentLocks[id]}
  }
  function setLocks(list){root().annualScheduleLocks=list.map(minimalLock);refreshManagedAssignmentLocks();save();staff()?.decorate?.();renderLocks();}
  function groupLatest(){
    const s=latest();if(!s)return[];const map=new Map();
    for(const e of s.entries||[]){let id,label;
      if(e.type==='classpair'){id=`course:${e.courseKey}`;label=`Curso · ${e.orientation} · ${e.course}`}
      else if(e.type==='area'){id=`area:${e.areaId}`;label=`Equipo · ${e.label||e.areaId}`}
      else{id=`inst:${e.instanceId}`;label=`Institucional · ${e.label||e.instanceId}`}
      if(!map.has(id))map.set(id,{id,label,entries:[]});map.get(id).entries.push(e)
    }
    return[...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es'));
  }
  function toggleGroup(id){
    const g=groupLatest().find(x=>x.id===id);if(!g)return;const current=new Map(root().annualScheduleLocks.map(x=>[lockKey(x),x])),keys=g.entries.map(lockKey),all=keys.every(k=>current.has(k));
    if(all)for(const k of keys)current.delete(k);else for(const e of g.entries)current.set(lockKey(e),minimalLock(e));
    setLocks([...current.values()]);toast(all?'Bloque liberado.':'Bloque fijado para futuras regeneraciones.');
  }

  function validateLocks(report,pairs){
    const issues=[],pairMap=new Map(pairs.map(p=>[pairId(p),p])),outsideMap=new Map((report.outside||[]).map(x=>[x.id,x])),teamMap=new Map((report.teams||[]).map(x=>[x.id,x]));
    const teacher1=new Map(),teacher2=new Map(),courseOcc=new Map(),usedPairs=new Set(),usedOutside=new Map(),areaGroups=new Map(),valid=[];
    const pairLookup=l=>pairs.find(p=>p.courseKey===l.courseKey&&(!l.s1||p.s1&&p.s1.instanceId===l.s1.instanceId&&p.s1.unitIndex===l.s1.unitIndex)&&(!l.s2||p.s2&&p.s2.instanceId===l.s2.instanceId&&p.s2.unitIndex===l.s2.unitIndex));
    for(const lock of root().annualScheduleLocks){
      const slot=slotKey(lock.day,lock.period);
      if(lock.type==='classpair'){
        const p=pairLookup(lock);if(!p){issues.push(`Un bloque fijado de ${lock.courseKey} ya no coincide con el emparejamiento curricular actual.`);continue}
        if(lock.s1&&p.s1?.teacherId!==lock.s1.teacherId||lock.s2&&p.s2?.teacherId!==lock.s2.teacherId){issues.push(`${lock.courseKey}: cambió un docente de una posición horaria fijada.`);continue}
        if(courseOcc.get(p.courseKey)?.has(slot)){issues.push(`${p.courseKey}: hay dos bloques fijados en ${lock.day} HC ${lock.period}.`);continue}
        if(p.s1&&(!available(p.s1.teacherId,lock.day,lock.period)||teacher1.get(p.s1.teacherId)?.has(slot))){issues.push(`${p.s1.teacherName||'Docente'} no puede sostener un bloque fijado en ${lock.day} HC ${lock.period}.`);continue}
        if(p.s2&&(!available(p.s2.teacherId,lock.day,lock.period)||teacher2.get(p.s2.teacherId)?.has(slot))){issues.push(`${p.s2.teacherName||'Docente'} no puede sostener un bloque fijado en ${lock.day} HC ${lock.period}.`);continue}
        usedPairs.add(pairId(p));addOcc(courseOcc,p.courseKey,slot);if(p.s1)addOcc(teacher1,p.s1.teacherId,slot);if(p.s2)addOcc(teacher2,p.s2.teacherId,slot);valid.push({...lock,__pair:p});
      }else if(lock.type==='area'){
        const t=teamMap.get(lock.areaId);if(!t){issues.push(`El equipo fijado “${lock.label||lock.areaId}” ya no existe.`);continue}if(!areaGroups.has(lock.areaId))areaGroups.set(lock.areaId,[]);areaGroups.get(lock.areaId).push(lock);valid.push(lock);
      }else{
        const x=outsideMap.get(lock.instanceId);if(!x){issues.push(`El bloque institucional fijado “${lock.label||lock.instanceId}” ya no existe.`);continue}if(x.teacherId!==lock.teacherId){issues.push(`${lock.label||lock.instanceId}: cambió el docente de un bloque institucional fijado.`);continue}const n=(usedOutside.get(lock.instanceId)||0)+1;if(n>Number(x.hours||0)){issues.push(`${lock.label||lock.instanceId}: hay más posiciones fijadas que HC requeridas.`);continue}if(!free(teacher1,x.teacherId,lock.day,lock.period)||!free(teacher2,x.teacherId,lock.day,lock.period)){issues.push(`${root().teachers[x.teacherId]?.name||'Docente'} no puede sostener un bloque institucional fijado.`);continue}usedOutside.set(lock.instanceId,n);addOcc(teacher1,x.teacherId,slot);addOcc(teacher2,x.teacherId,slot);valid.push(lock);
      }
    }
    for(const[areaId,group]of areaGroups){const t=teamMap.get(areaId),len=Number(t?.coordinationHours||0),ps=group.map(x=>Number(x.period)).sort((a,b)=>a-b),sameDay=group.every(x=>x.day===group[0].day),contiguous=ps.every((p,i)=>i===0||p===ps[i-1]+1);if(group.length!==len||!sameDay||!contiguous)issues.push(`${t?.name||areaId}: un equipo fijado debe conservar su bloque completo y continuo de ${len} HC.`)}
    return{ok:!issues.length,issues,valid,usedPairs,usedOutside,areaGroups};
  }

  function preflight(options={}){
    syncPlanningPolicy(root().assignments);
    const base=baseScheduler?.preflight?.(options)||{ok:false,issues:['No está disponible el preflight anual.'],warnings:[],rows:[],outside:[],teams:[]};
    const issues=[...(base.issues||[])],warnings=[...(base.warnings||[])],built=buildPairs(base);
    const load={};for(const r of base.rows||[]){const tid=r.teacherId;if(!tid)continue;load[tid]=load[tid]||{s1:0,s2:0};for(const sem of rowSemesters(r))load[tid][`s${sem}`]+=Number(r.hours||0)}
    for(const[tid,l]of Object.entries(load))if(l.s1!==l.s2)issues.push(`${root().teachers[tid]?.name||'Docente'}: para mantener un horario personal anual necesita la misma carga frente a curso en ambos cuatrimestres (${l.s1}/${l.s2} HC).`);
    if(built.crossRank.length)warnings.push(`${built.crossRank.length} emparejamiento${built.crossRank.length===1?'':'s'} requirieron cruzar pares temporales C1/C2, C3/C4, etc. Revisar la estructura si no es intencional.`);
    const lv=validateLocks(base,built.pairs);issues.push(...lv.issues);
    return{...base,issues,warnings,ok:!issues.length,v71Pairs:built.pairs,v71CrossRank:built.crossRank,v71Locks:lv};
  }

  function seed(report){
    const ctx={occ1:new Map(),occ2:new Map(),courseOcc:new Map(),dayLoad:new Map(),courseDayLoad:new Map(),entries:[],usedPairs:new Set(),usedOutside:new Map(),lockedAreas:new Set()};
    const lv=report.v71Locks||validateLocks(report,report.v71Pairs||buildPairs(report).pairs),teamMap=new Map((report.teams||[]).map(x=>[x.id,x])),outsideMap=new Map((report.outside||[]).map(x=>[x.id,x]));
    for(const lock of lv.valid||[]){const slot=slotKey(lock.day,lock.period);
      if(lock.type==='classpair'){
        const p=lock.__pair;ctx.entries.push({type:'classpair',day:lock.day,period:Number(lock.period),slot,courseKey:p.courseKey,orientation:p.orientation,course:p.course,s1:p.s1,s2:p.s2,locked:true});ctx.usedPairs.add(pairId(p));addOcc(ctx.courseOcc,p.courseKey,slot);if(p.s1){addOcc(ctx.occ1,p.s1.teacherId,slot);ctx.dayLoad.set(`1|${p.s1.teacherId}|${lock.day}`,(ctx.dayLoad.get(`1|${p.s1.teacherId}|${lock.day}`)||0)+1)}if(p.s2){addOcc(ctx.occ2,p.s2.teacherId,slot);ctx.dayLoad.set(`2|${p.s2.teacherId}|${lock.day}`,(ctx.dayLoad.get(`2|${p.s2.teacherId}|${lock.day}`)||0)+1)}addOcc(ctx.courseOcc,p.courseKey,slot);
      }else if(lock.type==='area'){
        const t=teamMap.get(lock.areaId),members=(t?.teacherIds||[]).filter(id=>root().teachers[id]);ctx.entries.push({type:'area',day:lock.day,period:Number(lock.period),slot,areaId:lock.areaId,label:`Encuentro de equipo · ${t?.name||lock.label||lock.areaId}`,teacherIds:members,teacherNames:members.map(id=>root().teachers[id]?.name||''),locked:true});ctx.lockedAreas.add(lock.areaId);for(const tid of members){addOcc(ctx.occ1,tid,slot);addOcc(ctx.occ2,tid,slot)}
      }else{
        const x=outsideMap.get(lock.instanceId);ctx.entries.push({type:'institutional',day:lock.day,period:Number(lock.period),slot,instanceId:x.id,teacherId:x.teacherId,teacherName:root().teachers[x.teacherId]?.name||'',label:x.label,locked:true});ctx.usedOutside.set(x.id,(ctx.usedOutside.get(x.id)||0)+1);addOcc(ctx.occ1,x.teacherId,slot);addOcc(ctx.occ2,x.teacherId,slot)
      }
    }
    return ctx;
  }
  function teamChoices(team,ctx){
    const members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0),out=[];
    for(const[d]of days())for(let start=1;start<=periods()-len+1;start++){let ok=true,score=Math.random();for(const tid of members)for(let p=start;p<start+len;p++){if(!free(ctx.occ1,tid,d,p)||!free(ctx.occ2,tid,d,p)){ok=false;break}score+=pref(tid,d,p)*12}if(ok)out.push({day:d,start,len,members,score})}
    return out.sort((a,b)=>a.score-b.score);
  }
  function placeTeams(report,ctx){
    for(const team of [...(report.teams||[])].sort((a,b)=>(b.teacherIds?.length||0)-(a.teacherIds?.length||0))){if(ctx.lockedAreas.has(team.id))continue;const members=(team.teacherIds||[]).filter(id=>root().teachers[id]),len=Number(team.coordinationHours||0);if(members.length<2||!(len>0))continue;const pick=teamChoices(team,ctx)[0];if(!pick)return false;for(let p=pick.start;p<pick.start+pick.len;p++){const slot=slotKey(pick.day,p);ctx.entries.push({type:'area',day:pick.day,period:p,slot,areaId:team.id,label:`Encuentro de equipo · ${team.name}`,teacherIds:[...members],teacherNames:members.map(id=>root().teachers[id]?.name||'')});for(const tid of members){addOcc(ctx.occ1,tid,slot);addOcc(ctx.occ2,tid,slot)}}}
    return true;
  }
  function placeOutside(report,ctx){
    const units=[];for(const x of report.outside||[]){const skip=ctx.usedOutside.get(x.id)||0;for(let i=skip;i<Number(x.hours||0);i++)units.push({...x,unitIndex:i})}units.sort(()=>Math.random()-.5);
    for(const u of units){const choices=[];for(const[d]of days())for(let p=1;p<=periods();p++){if(!free(ctx.occ1,u.teacherId,d,p)||!free(ctx.occ2,u.teacherId,d,p))continue;const score=pref(u.teacherId,d,p)*12+(ctx.dayLoad.get(`${u.teacherId}|${d}`)||0)*.4+Math.random()*1.5;choices.push({day:d,period:p,score})}choices.sort((a,b)=>a.score-b.score);const pick=choices[0];if(!pick)return false;const slot=slotKey(pick.day,pick.period);ctx.entries.push({type:'institutional',day:pick.day,period:pick.period,slot,instanceId:u.id,teacherId:u.teacherId,teacherName:root().teachers[u.teacherId]?.name||'',label:u.label});addOcc(ctx.occ1,u.teacherId,slot);addOcc(ctx.occ2,u.teacherId,slot);ctx.dayLoad.set(`${u.teacherId}|${pick.day}`,(ctx.dayLoad.get(`${u.teacherId}|${pick.day}`)||0)+1)}return true;
  }
  function pairChoices(pair,ctx){
    const out=[];for(const[d]of days())for(let p=1;p<=periods();p++){const slot=slotKey(d,p);if(ctx.courseOcc.get(pair.courseKey)?.has(slot))continue;if(pair.s1&&!free(ctx.occ1,pair.s1.teacherId,d,p))continue;if(pair.s2&&!free(ctx.occ2,pair.s2.teacherId,d,p))continue;let score=Math.random()*1.4+(ctx.courseDayLoad.get(`${pair.courseKey}|${d}`)||0)*.45;
      if(pair.s1){score+=pref(pair.s1.teacherId,d,p)*10+(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${d}`)||0)*.3;if(pair.s1.teacherId!==pair.s2?.teacherId)score+=ctx.occ2.get(pair.s1.teacherId)?.has(slot)?-7:1.5}
      if(pair.s2){score+=pref(pair.s2.teacherId,d,p)*10+(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${d}`)||0)*.3;if(pair.s2.teacherId!==pair.s1?.teacherId)score+=ctx.occ1.get(pair.s2.teacherId)?.has(slot)?-7:1.5}
      out.push({day:d,period:p,slot,score})}
    return out.sort((a,b)=>a.score-b.score);
  }
  function placePairs(report,ctx){
    const pending=(report.v71Pairs||buildPairs(report).pairs).filter(p=>!ctx.usedPairs.has(pairId(p))).sort((a,b)=>{const aa=(a.s1&&a.s2&&a.s1.teacherId!==a.s2.teacherId)?0:1,bb=(b.s1&&b.s2&&b.s1.teacherId!==b.s2.teacherId)?0:1;return aa-bb||Math.random()-.5});
    for(const pair of pending){const pick=pairChoices(pair,ctx)[0];if(!pick)return false;ctx.entries.push({type:'classpair',day:pick.day,period:pick.period,slot:pick.slot,courseKey:pair.courseKey,orientation:pair.orientation,course:pair.course,s1:pair.s1,s2:pair.s2});addOcc(ctx.courseOcc,pair.courseKey,pick.slot);ctx.courseDayLoad.set(`${pair.courseKey}|${pick.day}`,(ctx.courseDayLoad.get(`${pair.courseKey}|${pick.day}`)||0)+1);if(pair.s1){addOcc(ctx.occ1,pair.s1.teacherId,pick.slot);ctx.dayLoad.set(`1|${pair.s1.teacherId}|${pick.day}`,(ctx.dayLoad.get(`1|${pair.s1.teacherId}|${pick.day}`)||0)+1)}if(pair.s2){addOcc(ctx.occ2,pair.s2.teacherId,pick.slot);ctx.dayLoad.set(`2|${pair.s2.teacherId}|${pick.day}`,(ctx.dayLoad.get(`2|${pair.s2.teacherId}|${pick.day}`)||0)+1)}}return true;
  }
  function teacherSlotSets(entries){
    const a=new Map(),b=new Map();const both=(tid,slot)=>{addOcc(a,tid,slot);addOcc(b,tid,slot)};
    for(const e of entries){const slot=slotKey(e.day,e.period);if(e.type==='area'){for(const tid of e.teacherIds||[])both(tid,slot)}else if(e.type==='institutional')both(e.teacherId,slot);else{if(e.s1)addOcc(a,e.s1.teacherId,slot);if(e.s2)addOcc(b,e.s2.teacherId,slot)}}return{a,b};
  }
  function continuity(entries){
    const {a,b}=teacherSlotSets(entries),mismatches=[];for(const t of teachers()){const x=a.get(t.id)||new Set(),y=b.get(t.id)||new Set(),only1=[...x].filter(s=>!y.has(s)),only2=[...y].filter(s=>!x.has(s));if(only1.length||only2.length)mismatches.push({teacherId:t.id,name:t.name,only1,only2,count:only1.length+only2.length})}return{ok:!mismatches.length,mismatches,total:mismatches.reduce((s,x)=>s+x.count,0)};
  }
  function quality(entries){
    let q=0;const by=new Map();for(const e of entries){const tids=e.type==='area'?(e.teacherIds||[]):e.type==='institutional'?[e.teacherId]:[e.s1?.teacherId,e.s2?.teacherId].filter(Boolean);for(const tid of tids){q+=pref(tid,e.day,e.period)*8;const k=`${tid}|${e.day}`;if(!by.has(k))by.set(k,[]);by.get(k).push(Number(e.period))}}for(const ps of by.values()){const uniq=[...new Set(ps)].sort((a,b)=>a-b);if(uniq.length>1)q+=(uniq.at(-1)-uniq[0]+1-uniq.length)*1.1}return q;
  }
  function attempt(report){const ctx=seed(report);if(!placeTeams(report,ctx))return{ok:false,entries:ctx.entries,reason:'teams'};if(!placeOutside(report,ctx))return{ok:false,entries:ctx.entries,reason:'outside'};if(!placePairs(report,ctx))return{ok:false,entries:ctx.entries,reason:'classes'};const c=continuity(ctx.entries);return{ok:c.ok,entries:ctx.entries,continuity:c,quality:quality(ctx.entries),reason:c.ok?'':'continuity'}}
  function solve(report,maxAttempts=900){
    let best=null,bestPartial=null,bestContinuity=null;for(let i=0;i<maxAttempts;i++){const r=attempt(report);if(r.ok){if(!best||r.quality<best.quality)best=r;if(r.quality<.5)break}else{const placed=r.entries.length,delta=r.continuity?.total??999999;if(!bestPartial||placed>bestPartial.entries.length||placed===bestPartial.entries.length&&delta<(bestPartial.continuity?.total??999999))bestPartial=r;if(r.continuity&&(!bestContinuity||r.continuity.total<bestContinuity.continuity.total))bestContinuity=r}}return{best,bestPartial,bestContinuity};
  }

  function simulateAssignments(assignments,maxAttempts=220){
    const r=root(),oldAssignments=r.assignments,oldTeams=deep(r.areaTeams||{}),oldOverrides=deep(r.planningOverrides||{});r.assignments={...assignments};
    try{autoTeams()?.deriveTeams?.();const report=preflight({proposalMode:true,allowMinimumOffer:true});if(!report.ok)return{ok:false,issues:report.issues,warnings:report.warnings,preflight:true};const solved=solve(report,maxAttempts);if(!solved.best){const c=solved.bestContinuity?.continuity;return{ok:false,issues:[c&&c.total<999999?`No se encontró una grilla con posiciones docentes idénticas todo el año. La mejor tentativa dejó ${c.total} diferencias de posición.`:`No se encontró una combinación anual completa. La mejor tentativa ubicó ${solved.bestPartial?.entries.length||0} posiciones.`],warnings:report.warnings,preflight:false}}return{ok:true,issues:[],warnings:report.warnings,quality:solved.best.quality,positions:solved.best.entries.length,continuity:'strict'}
    }finally{r.assignments=oldAssignments;r.areaTeams=oldTeams;r.planningOverrides=oldOverrides;autoTeams()?.deriveTeams?.()}
  }
  function generate(){
    const report=preflight();lastCheck=report;if(!report.ok){decorateScheduler();toast('Hay condiciones pendientes antes de generar el horario anual V71.',true);return}
    const solved=solve(report,1400);if(!solved.best){const c=solved.bestContinuity?.continuity;lastCheck={...report,ok:false,issues:[...(report.issues||[]),c?`No se logró igualdad total de posiciones docentes; la mejor tentativa dejó ${c.total} diferencias.`:`No se encontró una combinación anual completa.`]};decorateScheduler();toast('No se encontró todavía una grilla anual estrictamente estable.',true);return}
    const schedule={id:uid(),engine:'v71-annual-strict',generator:'v71-curricular-pairing-lock-aware',createdAt:new Date().toISOString(),status:'draft',grid:grid()?.snapshot?.(),entries:solved.best.entries,quality:solved.best.quality,continuity:'teacher-slots-identical',pairing:'fase1-temporal-pairs',locksApplied:root().annualScheduleLocks.length};root().annualScheduleVersions.push(schedule);if(root().annualScheduleVersions.length>12)root().annualScheduleVersions.splice(0,root().annualScheduleVersions.length-12);save();lastCheck={...report,generated:schedule};baseScheduler?.render?.();setTimeout(()=>{decorateScheduler();renderLocks()},100);toast('Horario anual V71 generado: misma posición semanal del docente en ambos cuatrimestres.');
  }

  // --- Restauración integral de JSON ---
  const storageKey=()=>typeof STORAGE!=='undefined'?STORAGE:'pci-sa-v2-app-20260910-21';
  function validateBackup(payload){
    const s=payload?.state;if(!s||typeof s!=='object')return{ok:false,error:'El archivo no contiene un estado completo.'};if(typeof s.school!=='string'||!s.school.trim())return{ok:false,error:'Falta el nombre de la escuela.'};if(!Array.isArray(s.selected)||!s.maps||typeof s.maps!=='object')return{ok:false,error:'El respaldo no contiene la estructura de PCI esperada.'};const inst=s.institutional||{};return{ok:true,state:s,school:s.school,orientations:s.selected.length,teachers:Object.keys(inst.teachers||{}).length,schedules:(inst.annualScheduleVersions||[]).length,version:payload.version||'sin versión'};
  }
  async function readBackup(file){try{const payload=JSON.parse(await file.text()),v=validateBackup(payload);if(!v.ok)throw new Error(v.error);pendingRestore={payload,validation:v};renderRestorePreview()}catch(e){pendingRestore=null;const box=$('v71RestorePreview');if(box)box.innerHTML=`<div class="v71-error">${esc(e.message||String(e))}</div>`}}
  function renderRestorePreview(){const box=$('v71RestorePreview');if(!box||!pendingRestore)return;const v=pendingRestore.validation;box.innerHTML=`<div class="v71-restore-metrics"><span><strong>${esc(v.school)}</strong> escuela</span><span><strong>${v.orientations}</strong> orientaciones</span><span><strong>${v.teachers}</strong> docentes</span><span><strong>${v.schedules}</strong> horarios guardados</span><span><strong>${esc(v.version)}</strong> versión del respaldo</span></div><label class="v71-confirm"><input id="v71RestoreConfirm" type="checkbox"> Entiendo que este respaldo reemplazará el estado actual de la escuela.</label><button type="button" class="btn primary" id="v71ApplyRestore">Restaurar respaldo completo</button>`;$('v71ApplyRestore').onclick=applyRestore;}
  function applyRestore(){if(!pendingRestore)return;if(!$('v71RestoreConfirm')?.checked)return toast('Confirmá que querés reemplazar el estado actual.',true);try{const key=storageKey();localStorage.setItem(`${key}-before-restore`,JSON.stringify(state));state=deep(pendingRestore.payload.state);localStorage.setItem(key,JSON.stringify(state));location.reload()}catch(e){toast(`No se pudo restaurar: ${e.message||e}`,true)}}
  function downloadBackup(){try{const payload={version:'v71',exportedAt:new Date().toISOString(),state},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`respaldo-completo-v71-${slug(state.school||'escuela')||'escuela'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){toast('No se pudo generar el respaldo V71.',true)}}

  // --- UI ---
  function renderPlanningPolicy(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;let section=$('v71PlanningPolicy');if(!section){section=document.createElement('section');section.id='v71PlanningPolicy';section.className='card v48-section v71-policy';const target=$('v68Planning');if(target)target.after(section);else host.appendChild(section)}
    const policy=root().planningPolicy.threePlus,pending=staff()?.pendingTeachers?.()||[];section.innerHTML=`<div class="eyebrow">Regla institucional · planificación</div><h2>Docentes que integran 3 o más equipos</h2><p>La regla de 1 equipo = 3 HC y 2 equipos = 4 HC totales (2 + 2) se mantiene. Para 3 o más equipos la escuela puede conservar validación individual o adoptar 2 HC por equipo como regla automática.</p><div class="v71-policy-status"><span><strong>${policy==='two-per-team'?'2 HC por equipo':'Validación individual'}</strong> política actual</span><span class="${pending.length?'warn':''}"><strong>${pending.length}</strong> docentes pendientes de validación</span></div><div class="v71-actions"><button type="button" class="btn ${policy==='manual'?'primary':''}" data-v71-policy="manual">Validación individual</button><button type="button" class="btn ${policy==='two-per-team'?'primary':''}" data-v71-policy="two-per-team">Usar 2 HC por equipo para 3+</button></div>`;section.querySelectorAll('[data-v71-policy]').forEach(b=>b.onclick=()=>setPlanningPolicy(b.dataset.v71Policy));window.PCIInstitutionalAccordionV69?.refresh?.();
  }
  function renderLocks(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;let section=$('v71AnnualLocks');if(!section){section=document.createElement('section');section.id='v71AnnualLocks';section.className='card v48-section v71-locks';const sched=$('v68AnnualScheduler');if(sched)sched.after(section);else host.appendChild(section)}const s=latest(),groups=groupLatest(),locked=new Set(root().annualScheduleLocks.map(lockKey)),strict=s?.engine==='v71-annual-strict';
    section.innerHTML=`<div class="eyebrow">Horario anual · bloqueos</div><h2>Fijar partes ya resueltas</h2><p>Los bloques fijados conservan exactamente día y HC cuando se regenera el resto. Al fijar un curso también se protege su asignación docente mientras exista ese bloqueo.</p>${!s?'<div class="v48-empty">Primero generá un horario anual.</div>':!strict?'<div class="v71-warning">El último horario pertenece a una versión anterior. Generá primero un horario V71 estricto antes de fijar posiciones.</div>':`<div class="v71-lock-summary"><span><strong>${root().annualScheduleLocks.length}</strong> posiciones fijadas</span><span><strong>${groups.length}</strong> bloques disponibles</span></div><div class="v71-actions"><button type="button" class="btn" data-v71-lock-all>Fijar todo el horario actual</button><button type="button" class="btn soft" data-v71-unlock-all>Liberar todo</button></div><div class="v71-lock-list">${groups.map(g=>{const keys=g.entries.map(lockKey),all=keys.every(k=>locked.has(k));return`<article><div><strong>${esc(g.label)}</strong><small>${g.entries.length} posición${g.entries.length===1?'':'es'}</small></div><button type="button" class="btn small ${all?'primary':'soft'}" data-v71-group="${esc(g.id)}">${all?'🔒 Fijado':'○ Fijar'}</button></article>`}).join('')}</div>`}`;
    section.querySelector('[data-v71-lock-all]')?.addEventListener('click',()=>{setLocks((s.entries||[]).map(minimalLock));toast('Horario actual fijado completo.')});section.querySelector('[data-v71-unlock-all]')?.addEventListener('click',()=>{setLocks([]);toast('Se liberaron todos los bloqueos del horario anual.')});section.querySelectorAll('[data-v71-group]').forEach(b=>b.onclick=()=>toggleGroup(b.dataset.v71Group));window.PCIInstitutionalAccordionV69?.refresh?.();
  }
  function renderRestore(){
    const host=$('v48InstitutionalContent');if(!host||!$('institutional')?.classList.contains('active'))return;let section=$('v71Restore');if(!section){section=document.createElement('section');section.id='v71Restore';section.className='card v48-section v71-restore';const ex=$('v68InstitutionalExport');if(ex)ex.after(section);else host.appendChild(section)}section.innerHTML=`<div class="eyebrow">Respaldo y recuperación · V71</div><h2>Respaldo completo restaurable</h2><p>Podés descargar el estado completo o restaurar un JSON generado por V68/V69/V70/V71. Antes de restaurar se guarda automáticamente una copia local del estado actual.</p><div class="v71-actions"><button type="button" class="btn soft" data-v71-backup>Descargar respaldo V71</button><label class="btn primary v71-file">Elegir JSON para restaurar<input id="v71RestoreFile" type="file" accept=".json,application/json" hidden></label></div><div id="v71RestorePreview"></div>`;section.querySelector('[data-v71-backup]').onclick=downloadBackup;$('v71RestoreFile').onchange=e=>{const f=e.target.files?.[0];if(f)readBackup(f)};if(pendingRestore)renderRestorePreview();window.PCIInstitutionalAccordionV69?.refresh?.();
  }
  function reportBox(report){if(!report)return'';return`<div class="v71-report ${report.ok?'ok':'bad'}"><strong>${report.ok?'Listo para horario anual estricto':'Hay condiciones pendientes'}</strong>${report.issues?.length?`<div>${report.issues.slice(0,10).map(x=>`• ${esc(x)}`).join('<br>')}</div>`:'<span>La planta, la disponibilidad, los equipos y los bloqueos admiten una única grilla anual con posiciones docentes estables.</span>'}${report.warnings?.length?`<small>${report.warnings.slice(0,5).map(x=>`⚠ ${esc(x)}`).join('<br>')}</small>`:''}</div>`}
  function decorateScheduler(){
    const section=$('v68AnnualScheduler');if(!section)return;const eye=section.querySelector('.eyebrow');if(eye)eye.textContent='Horario institucional · anual · V71';const h=section.querySelector('h2');if(h)h.textContent='Una única grilla anual, también para cada docente';const p=section.querySelector('h2 + p');if(p)p.textContent='V71 empareja los espacios desde la ubicación temporal de Fase 1, exige la misma posición semanal del docente en ambos cuatrimestres y respeta los bloques del horario que hayan sido fijados.';section.querySelector('.v71-report')?.remove();const actions=section.querySelector('.v65-actions');if(actions){const box=document.createElement('div');box.innerHTML=reportBox(lastCheck);if(box.firstElementChild)actions.after(box.firstElementChild)}const s=latest(),version=section.querySelector('.v65-version');if(version&&s?.engine==='v71-annual-strict')version.querySelector('div').innerHTML=version.querySelector('div').innerHTML.replace(/motor\s+[^·<]+/i,'motor v71-annual-strict');
  }
  function renderAll(){renderPlanningPolicy();renderRestore();setTimeout(()=>{decorateScheduler();renderLocks()},80)}
  function refresh(){clearTimeout(timer);timer=setTimeout(renderAll,90)}
  function start(){refresh();const host=$('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(refresh);observer.observe(host,{childList:true,subtree:false})}}

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v68-check]')){e.preventDefault();e.stopImmediatePropagation();lastCheck=preflight();setTimeout(decorateScheduler,0);return}
    if(e.target.closest('[data-v68-generate]')){e.preventDefault();e.stopImmediatePropagation();generate();return}
    if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v48-home]'))setTimeout(start,250);
  },true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1750));window.addEventListener('pci-schedule-grid-changed',()=>{lastCheck=null;refresh()});document.addEventListener('change',e=>{if(e.target.closest('[data-v48-assignment],[data-v68-plan-hours],[data-v65-pct]')){lastCheck=null;setTimeout(refresh,150)}},true);

  const style=document.createElement('style');style.textContent=`.v71-policy,.v71-locks,.v71-restore{border-color:#b8d9e8;background:#fbfdff}.v71-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v71-policy-status,.v71-lock-summary,.v71-restore-metrics{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v71-policy-status span,.v71-lock-summary span,.v71-restore-metrics span{padding:7px 9px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:.57rem;color:var(--muted)}.v71-policy-status strong,.v71-lock-summary strong,.v71-restore-metrics strong{color:var(--ink)}.v71-policy-status .warn{background:#fff8df;border-color:#dfc476;color:#765b18}.v71-lock-list{display:grid;gap:6px;margin-top:10px}.v71-lock-list article{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:#fff}.v71-lock-list strong{display:block;font-size:.61rem}.v71-lock-list small{display:block;margin-top:2px;font-size:.52rem;color:var(--muted)}.v71-warning,.v71-error{margin-top:9px;padding:9px 10px;border-radius:10px;background:#fff8df;color:#765b18;font-size:.58rem;line-height:1.45}.v71-error{background:var(--danger-soft);color:var(--danger)}.v71-file{cursor:pointer}.v71-confirm{display:flex;gap:6px;align-items:flex-start;margin:10px 0;font-size:.58rem;color:var(--muted)}.v71-report{margin-top:10px;padding:10px 11px;border-radius:11px;background:var(--band);font-size:.58rem;line-height:1.45}.v71-report.ok{background:var(--ok-soft);color:var(--ok)}.v71-report.bad{background:var(--danger-soft);color:var(--danger)}.v71-report strong{display:block;font-size:.68rem;margin-bottom:3px}.v71-report small{display:block;margin-top:5px;color:inherit}@media(max-width:720px){.v71-lock-list article{align-items:flex-start;flex-direction:column}.v71-lock-list .btn{width:100%}}`;document.head.appendChild(style);

  const api={...baseScheduler,preflight,solve,simulateAssignments,generate,latest,render:()=>{baseScheduler?.render?.();setTimeout(decorateScheduler,0)},openPrint:()=>baseScheduler?.openPrint?.()};
  window.PCIAnnualSchedulerV71=api;window.PCIAnnualSchedulerV68=api;window.PCIAnnualSchedulerV65=api;
  window.PCIOperationalCloseoutV71={preflight,solve,simulateAssignments,generate,buildPairs,continuity,setPlanningPolicy,renderAll,downloadBackup,validateBackup};
})();