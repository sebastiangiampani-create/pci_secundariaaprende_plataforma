(() => {
  const $id=id=>document.getElementById(id);
  const api=()=>window.PCIInstitutionalV48||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const schedulerApi=()=>window.PCIAnnualSchedulerV65||null;
  const availabilityApi=()=>window.PCIAvailabilityPreferencesV60||window.PCIAvailabilityV49||null;
  const gridApi=()=>window.PCIScheduleConfigV51||null;
  let observer=null,timer=null,rendering=false,editingTeacherId='';

  const AREA_BY_SLOT={
    lengua:'Lengua y Literatura',matematica:'Matemática',adicional:'Lenguas Adicionales',
    naturales:'Ciencias Naturales',socialA:'Ciencias Sociales',socialB:'Ciencias Sociales',
    artes:'Artes',tecnologias:'Tecnología / Informática',ef:'Educación Física',otros:'Otros formatos pedagógicos'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[“”«»"']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const slug=s=>norm(s).replace(/\s+/g,'-');
  const fmt=n=>String(Math.round(Number(n||0)*10)/10).replace('.',',');
  const deep=x=>JSON.parse(JSON.stringify(x));

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.teachers=r.teachers||{};r.assignments=r.assignments||{};r.areaTeams=r.areaTeams||{};
    r.teacherProfiles=r.teacherProfiles||{};r.assignmentLocks=r.assignmentLocks||{};
    r.planningOverrides=r.planningOverrides||{};r.outsideWork=r.outsideWork||{};
    return r;
  }
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  const rows=()=>api()?.allImplementationRows?.()||[];
  const rowById=()=>new Map(rows().map(r=>[r.instanceId,r]));
  const teacherName=id=>root().teachers[id]?.name||'';
  const activeAssignments=()=>root().assignments;

  function rowSemesters(row){
    if((row.locations||[]).some(x=>String(x).toLowerCase().includes('anual')))return[1,2];
    const out=new Set();
    for(const loc of row.locations||[]){const m=String(loc).match(/C(\d+)/i);if(m)out.add(Number(m[1])%2?1:2)}
    return out.size?[...out]:[1,2];
  }
  const slotBase=slot=>String(slot||'').replace(/-c\d+$/,'').replace(/-n\d+$/,'');

  function relationCatalogForOrientation(orientation){
    const map=ensure(orientation),bySubject=new Map();
    for(const [slot,ids] of Object.entries(map.placements||{})){
      const base=slotBase(slot),area=AREA_BY_SLOT[base],isFO=/^fo/i.test(base);
      for(const sid of ids||[]){
        if(!bySubject.has(sid))bySubject.set(sid,new Map());
        const bucket=bySubject.get(sid);
        if(area){const id=`auto-fg-${slug(area)}`;bucket.set(id,{id,kind:'FG',name:`Formación General · ${area}`,label:area,orientation:''})}
        if(isFO){const id=`auto-fo-${slug(orientation)}`;bucket.set(id,{id,kind:'FO',name:`Formación Orientada · ${orientation}`,label:orientation,orientation})}
      }
    }
    return bySubject;
  }
  function relationsForRow(row){
    if(!row)return[];
    const bucket=relationCatalogForOrientation(row.orientation).get(row.subjectId)||new Map();
    const out=new Map(bucket);
    if(row.origin==='FO'){
      const id=`auto-fo-${slug(row.orientation)}`;
      out.set(id,{id,kind:'FO',name:`Formación Orientada · ${row.orientation}`,label:row.orientation,orientation:row.orientation});
    }
    return [...out.values()];
  }
  const rowTeamIds=row=>relationsForRow(row).map(x=>x.id);

  function demand(){
    const courses=new Map();let pending=0,instances=0;
    for(const row of rows()){
      instances++;
      const key=`${row.orientation}|${row.course}`;
      if(!courses.has(key))courses.set(key,{orientation:row.orientation,course:row.course,s1:{total:0,official:0,extra:0},s2:{total:0,official:0,extra:0}});
      const c=courses.get(key),h=Number(row.hours||0);
      if(!(h>0)){pending++;continue}
      for(const sem of rowSemesters(row)){
        const b=c[`s${sem}`];b.total+=h;
        if(row.origin==='CUSTOM')b.extra+=h;else b.official+=h;
      }
    }
    const total={s1:0,s2:0,officialS1:0,officialS2:0,extraS1:0,extraS2:0,annualGrid:0,officialAnnual:0,extraAnnual:0};
    for(const c of courses.values()){
      total.s1+=c.s1.total;total.s2+=c.s2.total;
      total.officialS1+=c.s1.official;total.officialS2+=c.s2.official;
      total.extraS1+=c.s1.extra;total.extraS2+=c.s2.extra;
      total.annualGrid+=Math.max(c.s1.total,c.s2.total);
      total.officialAnnual+=Math.max(c.s1.official,c.s2.official);
      total.extraAnnual+=Math.max(c.s1.extra,c.s2.extra);
    }
    return{...total,courses:[...courses.values()],pending,instances,courseCount:courses.size};
  }

  function profile(tid){
    const r=root(),t=r.teachers[tid];if(!t)return null;
    if(!r.teacherProfiles[tid])r.teacherProfiles[tid]={teacherId:tid,email:t.email||'',targetHours:null,maxHours:null,rules:[]};
    const p=r.teacherProfiles[tid];p.rules=Array.isArray(p.rules)?p.rules:[];
    if(p.email&&!t.email)t.email=p.email;if(t.email&&!p.email)p.email=t.email;
    return p;
  }
  function parseYears(value){
    const raw=String(value||'').trim();if(!raw||raw==='1-5'||raw==='1–5')return[1,2,3,4,5];
    const out=new Set();
    for(const part of raw.split(/[;,\s]+/).filter(Boolean)){
      const m=part.match(/^(\d)\s*[-–]\s*(\d)$/);if(m){for(let y=Number(m[1]);y<=Number(m[2]);y++)if(y>=1&&y<=5)out.add(y)}
      else{const y=Number(part);if(y>=1&&y<=5)out.add(y)}
    }
    return [...out].sort();
  }
  const yearsLabel=years=>(years||[]).length===5?'1–5':(years||[]).join(', ');
  function ruleMatches(rule,row){
    if(!rule||!row)return false;
    const years=(rule.years||[]).map(Number);if(years.length&&!years.includes(Number(row.year)))return false;
    if(rule.orientation&&rule.orientation!=='*'&&rule.orientation!==row.orientation)return false;
    const target=norm(rule.value),rels=relationsForRow(row);
    if(rule.kind==='subject')return norm(row.name)===target||norm(row.name).includes(target)||target.includes(norm(row.name));
    if(rule.kind==='fo')return rels.some(x=>x.kind==='FO'&&norm(x.label)===target);
    return rels.some(x=>x.kind==='FG'&&(norm(x.label)===target||norm(x.name).includes(target)||target.includes(norm(x.label))));
  }
  function candidateStatus(tid,row){
    const p=profile(tid);if(!p)return null;
    const hits=p.rules.filter(rule=>ruleMatches(rule,row));
    if(hits.some(x=>x.priority==='blocked'))return null;
    if(hits.some(x=>x.priority==='preferred'))return'preferred';
    if(hits.some(x=>x.priority==='allowed'))return'allowed';
    return null;
  }

  function membershipMap(assignments=activeAssignments()){
    const map=new Map();for(const t of teachers())map.set(t.id,new Set());
    for(const row of rows()){
      const tid=assignments[row.instanceId];if(!tid)continue;
      if(!map.has(tid))map.set(tid,new Set());
      for(const id of rowTeamIds(row))map.get(tid).add(id);
    }
    return map;
  }
  function teamCatalog(){
    const out=new Map();
    for(const row of rows())for(const rel of relationsForRow(row))out.set(rel.id,rel);
    for(const team of Object.values(root().areaTeams||{}))out.set(team.id,{id:team.id,kind:team.kind,name:team.name,label:team.name,orientation:team.orientation||''});
    return out;
  }
  function teacherPlanning(tid,assignments=activeAssignments()){
    const teamsFor=[...(membershipMap(assignments).get(tid)||[])],catalog=teamCatalog(),override=root().planningOverrides[tid]||{},byTeam={};
    const count=teamsFor.length;
    for(const teamId of teamsFor){
      const custom=Number(override.byTeam?.[teamId]);
      if(custom>0)byTeam[teamId]=custom;
      else byTeam[teamId]=count===1?3:2;
    }
    const hasCompleteOverride=teamsFor.length>0&&teamsFor.every(id=>Number(override.byTeam?.[id])>0);
    const needsValidation=count>=3&&!(override.validated&&hasCompleteOverride);
    const total=Object.values(byTeam).reduce((a,b)=>a+Number(b||0),0);
    return{teacherId:tid,teams:teamsFor.map(id=>catalog.get(id)||{id,name:id,kind:''}),byTeam,total,count,needsValidation,validated:!!override.validated,custom:hasCompleteOverride};
  }
  function teamMembers(teamId,assignments=activeAssignments()){
    const memberships=membershipMap(assignments),out=[];for(const [tid,set] of memberships)if(set.has(teamId)&&root().teachers[tid])out.push(tid);return out;
  }
  function teamCommonHours(teamId,assignments=activeAssignments()){
    const members=teamMembers(teamId,assignments);if(members.length<2)return 0;
    const values=members.map(tid=>Number(teacherPlanning(tid,assignments).byTeam[teamId]||0)).filter(x=>x>0);
    return values.length===members.length?Math.min(...values):0;
  }
  function residualRows(tid,assignments=activeAssignments()){
    const p=teacherPlanning(tid,assignments),out=[];
    for(const team of p.teams){
      const allocation=Number(p.byTeam[team.id]||0),common=teamCommonHours(team.id,assignments),residual=Math.max(0,allocation-common);
      if(residual>0)out.push({id:`v68-plan-${tid}-${team.id}`,teacherId:tid,label:`Planificación individual · ${team.name}`,hours:residual,semester:'both',__v68Planning:true,teamId:team.id});
    }
    return out;
  }
  const pendingTeachers=(assignments=activeAssignments())=>teachers().filter(t=>teacherPlanning(t.id,assignments).needsValidation).map(t=>({id:t.id,name:t.name,planning:teacherPlanning(t.id,assignments)}));

  function loadByTeacher(assignments=activeAssignments()){
    const result={};for(const t of teachers())result[t.id]={s1:0,s2:0,pending:0};
    for(const row of rows()){
      const tid=assignments[row.instanceId];if(!tid)continue;
      result[tid]=result[tid]||{s1:0,s2:0,pending:0};const h=Number(row.hours||0);
      if(!(h>0)){result[tid].pending++;continue}
      for(const sem of rowSemesters(row))result[tid][`s${sem}`]+=h;
    }
    return result;
  }
  const explicitOutside=tid=>Object.values(root().outsideWork||{}).filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0);
  function minimumLoad(tid,assignments=activeAssignments()){
    const l=loadByTeacher(assignments)[tid]||{s1:0,s2:0},front=Math.max(Number(l.s1||0),Number(l.s2||0)),planning=teacherPlanning(tid,assignments),explicit=explicitOutside(tid);
    return{front,planning:planning.total,explicit,total:front+planning.total+explicit,pendingPlanning:planning.needsValidation};
  }
  function institutionalMinimum(assignments=activeAssignments()){
    const perTeacher=teachers().map(t=>({teacherId:t.id,name:t.name,...minimumLoad(t.id,assignments)}));
    return{total:perTeacher.reduce((a,x)=>a+x.total,0),front:perTeacher.reduce((a,x)=>a+x.front,0),planning:perTeacher.reduce((a,x)=>a+x.planning,0),explicit:perTeacher.reduce((a,x)=>a+x.explicit,0),perTeacher,pending:perTeacher.filter(x=>x.pendingPlanning)};
  }

  function availableCapacity(tid){
    const av=availabilityApi(),days=gridApi()?.days?.()||window.PCIAvailabilityV49?.days?.()||[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']],count=Math.max(1,Number(gridApi()?.periodCount?.()||8));
    if(!av?.available)return Infinity;let n=0;for(const[d]of days)for(let p=1;p<=count;p++)if(av.available(tid,d,p)!==false)n++;return n;
  }
  function proposalCandidateCount(row){return teachers().filter(t=>candidateStatus(t.id,row)).length}
  function projectedTeamCount(tid,row,assignments){const set=new Set(membershipMap(assignments).get(tid)||[]);for(const id of rowTeamIds(row))set.add(id);return set.size}
  function sameSubjectCount(tid,row,assignments){return rows().filter(r=>assignments[r.instanceId]===tid&&norm(r.name)===norm(row.name)).length}

  function buildProposal(mode='pending'){
    const all=rows(),r=root(),current={...r.assignments},proposal=mode==='rebalance'?{}:{...current};
    if(mode==='rebalance')for(const [instanceId,locked] of Object.entries(r.assignmentLocks||{}))if(locked&&current[instanceId])proposal[instanceId]=current[instanceId];
    const process=all.filter(row=>mode==='rebalance'?!(r.assignmentLocks[row.instanceId]&&current[row.instanceId]):!current[row.instanceId]);
    process.sort((a,b)=>proposalCandidateCount(a)-proposalCandidateCount(b)||Number(b.hours||0)-Number(a.hours||0)||String(a.name).localeCompare(String(b.name),'es'));
    const unresolved=[];
    for(const row of process){
      const h=Number(row.hours||0);if(!(h>0)){if(current[row.instanceId])proposal[row.instanceId]=current[row.instanceId];else unresolved.push({instanceId:row.instanceId,reason:'HC pendientes'});continue}
      const load=loadByTeacher(proposal),candidates=[];
      for(const t of teachers()){
        let status=candidateStatus(t.id,row);const isCurrent=current[row.instanceId]===t.id;
        if(!status&&isCurrent)status='current';if(!status)continue;
        const l=load[t.id]||{s1:0,s2:0},next={s1:l.s1,s2:l.s2};for(const sem of rowSemesters(row))next[`s${sem}`]+=h;
        const annual=Math.max(next.s1,next.s2),p=profile(t.id),max=Number(p?.maxHours),target=Number(p?.targetHours),capacity=availableCapacity(t.id);
        if(max>0&&annual>max+1e-9)continue;if(Number.isFinite(capacity)&&annual>capacity)continue;
        let score=status==='preferred'?-100:status==='current'?-35:0;
        if(target>0)score+=annual<=target?-(annual/target)*12:(annual-target)*5;
        score+=projectedTeamCount(t.id,row,proposal)*2.5;
        score-=sameSubjectCount(t.id,row,proposal)*2;
        score+=annual*.06;
        candidates.push({id:t.id,status,annual,score});
      }
      candidates.sort((a,b)=>a.score-b.score||a.annual-b.annual||teacherName(a.id).localeCompare(teacherName(b.id),'es'));
      if(candidates[0])proposal[row.instanceId]=candidates[0].id;
      else if(current[row.instanceId])proposal[row.instanceId]=current[row.instanceId];
      else unresolved.push({instanceId:row.instanceId,reason:'Sin docente compatible'});
    }
    const assigned=all.filter(x=>proposal[x.instanceId]).length,minimum=institutionalMinimum(proposal),changes=all.filter(x=>(current[x.instanceId]||'')!==(proposal[x.instanceId]||'')).length;
    r.staffingProposal={id:`staff-${Date.now()}`,createdAt:new Date().toISOString(),mode,assignments:proposal,unresolved,viability:null,stats:{instances:all.length,assigned,pending:all.length-assigned,changes,front:minimum.front,planning:minimum.planning,explicit:minimum.explicit,minimumTotal:minimum.total,pendingPlanning:minimum.pending.length}};
    save();decorate();toast(mode==='rebalance'?'Propuesta de reorganización preparada. Falta validar el horario.':'Propuesta para completar pendientes preparada. Falta validar el horario.');
    return r.staffingProposal;
  }
  function currentProposal(){return root().staffingProposal||null}

  function simulateProposal(){
    const p=currentProposal();if(!p)return toast('Primero generá una propuesta de asignación.',true);
    const scheduler=schedulerApi();if(!scheduler)return toast('No está disponible el generador anual de horarios.',true);
    try{
      const result=scheduler.simulateAssignments?scheduler.simulateAssignments(p.assignments,350):null;
      if(result)p.viability=result;
      else{
        const r=root(),oldAssignments=r.assignments,oldTeams=deep(r.areaTeams||{});r.assignments={...p.assignments};
        try{teamsApi()?.deriveTeams?.();const report=scheduler.preflight?.();p.viability={ok:!!report?.ok,issues:report?.issues||[],warnings:report?.warnings||[],preflightOnly:true}}
        finally{r.assignments=oldAssignments;r.areaTeams=oldTeams;teamsApi()?.deriveTeams?.()}
      }
      save();decorate();
      toast(p.viability?.ok?'La propuesta es compatible con la simulación horaria.':'La propuesta todavía tiene incompatibilidades horarias.',!p.viability?.ok);
      return p.viability;
    }catch(e){toast(e.message||String(e),true);return null}
  }
  function applyProposal(){
    const p=currentProposal();if(!p)return;
    if(!p.viability?.ok)return toast('Primero validá la propuesta con la simulación de horario.',true);
    root().assignments={...p.assignments};root().staffingProposal=null;teamsApi()?.deriveTeams?.();save();api()?.renderInstitutional?.();toast('Propuesta aplicada. La asignación docente vigente fue actualizada.')
  }
  function discardProposal(){root().staffingProposal=null;save();decorate()}

  function demandRows(){
    const d=demand(),out=[];for(const c of d.courses)out.push({'Orientación':c.orientation,'Curso':c.course,'HC C1':c.s1.total,'HC C2':c.s2.total,'HC grilla anual':Math.max(c.s1.total,c.s2.total),'HC oficiales C1':c.s1.official,'HC oficiales C2':c.s2.official,'HC extra-plan C1':c.s1.extra,'HC extra-plan C2':c.s2.extra});return out;
  }
  function profileRows(){
    return teachers().map(t=>{const p=profile(t.id);return{'Docente':t.name,'Email':p?.email||t.email||'','HC objetivo':p?.targetHours??'','HC máximo':p?.maxHours??'','Reglas':(p?.rules||[]).map(r=>`${r.priority}:${r.kind}:${r.value}:${yearsLabel(r.years)}:${r.orientation==='*'?'todas':r.orientation}`).join(' | ')}});
  }
  function planningRows(assignments=activeAssignments()){
    const out=[];for(const t of teachers()){const p=teacherPlanning(t.id,assignments);for(const team of p.teams)out.push({'Docente':t.name,'Equipo':team.name,'HC asignadas al equipo':p.byTeam[team.id]||0,'HC comunes del equipo':teamCommonHours(team.id,assignments),'Estado':p.needsValidation?'Requiere validación':p.custom?'Validado/ajustado':'Automático'});if(!p.teams.length)out.push({'Docente':t.name,'Equipo':'Sin equipo','HC asignadas al equipo':0,'HC comunes del equipo':0,'Estado':'Sin planificación por equipo'})}return out;
  }
  function proposalRows(){
    const p=currentProposal();if(!p)return[];const by=rowById();return Object.entries(p.assignments).map(([id,tid])=>{const row=by.get(id);if(!row)return null;return{'Orientación':row.orientation,'Curso':row.course,'Materia / espacio':row.name,'HC':row.hours??'','Docente propuesto':teacherName(tid),'Docente actual':teacherName(root().assignments[id]||''),'Fija':root().assignmentLocks[id]?'Sí':'No'}}).filter(Boolean);
  }

  function profileRuleOptions(){
    const values=new Set();for(const row of rows()){values.add(row.name);for(const rel of relationsForRow(row))values.add(rel.label)}return[...values].sort((a,b)=>a.localeCompare(b,'es'));
  }
  function ensureProfileModal(){
    let modal=$id('v68ProfileModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='v68ProfileModal';modal.className='modal v68-modal';
    modal.innerHTML='<div class="modal-box v68-modal-box"><div id="v68ProfileBody"></div></div>';document.body.appendChild(modal);return modal;
  }
  function renderProfileModal(tid){
    editingTeacherId=tid;const t=root().teachers[tid],p=profile(tid),modal=ensureProfileModal(),body=$id('v68ProfileBody');if(!t||!p)return;
    const orientations=[...(state.selected||[])];
    body.innerHTML=`<div class="v68-modal-head"><div><div class="eyebrow">Perfil docente institucional</div><h2>${esc(t.name)}</h2></div><button type="button" class="btn soft" data-v68-close>Cerrar</button></div><div class="v68-profile-grid"><label>Email<input id="v68ProfileEmail" value="${esc(p.email||t.email||'')}" type="email"></label><label>HC frente a curso objetivo<input id="v68ProfileTarget" value="${p.targetHours??''}" type="number" min="0" step="1" placeholder="Opcional"></label><label>HC frente a curso máximo<input id="v68ProfileMax" value="${p.maxHours??''}" type="number" min="0" step="1" placeholder="Opcional"></label></div><div class="v68-rule-head"><div><h3>Qué puede dictar</h3><p>La propuesta automática solo usa estas reglas. “Preferente” tiene prioridad sobre “Puede dictar”; “No asignar” bloquea la coincidencia.</p></div></div><div class="v68-rule-list">${p.rules.length?p.rules.map((r,i)=>`<article><strong>${r.priority==='preferred'?'Preferente':r.priority==='blocked'?'No asignar':'Puede dictar'}</strong><span>${r.kind==='subject'?'Materia':r.kind==='fo'?'Formación Orientada':'Área'} · ${esc(r.value)}</span><small>Años ${esc(yearsLabel(r.years))} · ${r.orientation==='*'?'todas las orientaciones':esc(r.orientation)}</small><button type="button" data-v68-rule-delete="${i}">Quitar</button></article>`).join(''):'<div class="v48-empty">Todavía no hay habilitaciones cargadas para este docente.</div>'}</div><datalist id="v68RuleValues">${profileRuleOptions().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist><div class="v68-new-rule"><label>Tipo<select id="v68RuleKind"><option value="area">Área / equipo FG</option><option value="subject">Materia / espacio</option><option value="fo">Formación Orientada</option></select></label><label>Área / materia<input id="v68RuleValue" list="v68RuleValues" placeholder="Ej. Matemática"></label><label>Años<input id="v68RuleYears" value="1-5" placeholder="1-5 o 1,2,3"></label><label>Orientación<select id="v68RuleOrientation"><option value="*">Todas</option>${orientations.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></label><label>Prioridad<select id="v68RulePriority"><option value="preferred">Preferente</option><option value="allowed">Puede dictar</option><option value="blocked">No asignar</option></select></label><button type="button" class="btn soft" data-v68-add-rule>Agregar regla</button></div><div class="v68-modal-actions"><button type="button" class="btn primary" data-v68-save-profile>Guardar perfil</button><button type="button" class="btn" data-v68-close>Cerrar</button></div>`;
    modal.classList.add('open');
  }
  function saveProfile(){
    const t=root().teachers[editingTeacherId],p=profile(editingTeacherId);if(!t||!p)return;
    p.email=$id('v68ProfileEmail')?.value.trim()||'';t.email=p.email;
    const target=$id('v68ProfileTarget')?.value,max=$id('v68ProfileMax')?.value;p.targetHours=target===''?null:Number(target);p.maxHours=max===''?null:Number(max);
    if(p.targetHours!==null&&p.maxHours!==null&&p.targetHours>p.maxHours)return toast('La carga objetivo no puede superar la carga máxima.',true);
    save();ensureProfileModal().classList.remove('open');decorate();toast('Perfil docente guardado.')
  }
  function addRule(){
    const p=profile(editingTeacherId);if(!p)return;const value=$id('v68RuleValue')?.value.trim();if(!value)return toast('Indicá el área, materia u orientación.',true);
    const years=parseYears($id('v68RuleYears')?.value);if(!years.length)return toast('Indicá años válidos entre 1 y 5.',true);
    p.rules.push({id:`rule-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,kind:$id('v68RuleKind')?.value||'area',value,years,orientation:$id('v68RuleOrientation')?.value||'*',priority:$id('v68RulePriority')?.value||'allowed'});save();renderProfileModal(editingTeacherId)
  }

  function demandHtml(){
    const d=demand();return `<section id="v68Demand" class="card v48-section v68-demand"><div class="eyebrow">Demanda institucional automática</div><h2>Horas cátedra reales de la escuela</h2><p>Se leen todos los PCI y todas las divisiones. EDI y Tutoría ya forman parte del plan oficial. Solo los espacios de origen institucional/CUSTOM se contabilizan como extra-plan.</p><div class="v68-metrics"><article><strong>${fmt(d.annualGrid)} HC</strong><span>demanda semanal de grilla anual</span></article><article><strong>${fmt(d.s1)} / ${fmt(d.s2)} HC</strong><span>1.er / 2.º cuatrimestre</span></article><article><strong>${fmt(d.officialAnnual)} HC</strong><span>componente oficial anualizado</span></article><article><strong>${fmt(d.extraAnnual)} HC</strong><span>componente extra-plan anualizado</span></article><article><strong>${d.courseCount}</strong><span>cursos/divisiones</span></article><article class="${d.pending?'warn':''}"><strong>${d.pending}</strong><span>instancias con HC pendientes</span></article></div>${d.officialAnnual+d.extraAnnual!==d.annualGrid?'<small class="v68-footnote">Cuando un espacio oficial y uno extra-plan se alternan entre cuatrimestres en la misma posición anual, los subtotales por origen pueden no ser aditivos. La demanda de grilla anual evita contar dos veces esa posición.</small>':''}</section>`;
  }
  function planningHtml(){
    teamsApi()?.deriveTeams?.();const cards=teachers().filter(t=>teacherPlanning(t.id).count>0).map(t=>{const p=teacherPlanning(t.id);return`<article class="v68-plan-card ${p.needsValidation?'pending':''}"><div class="v68-plan-title"><div><h3>${esc(t.name)}</h3><small>${p.count} equipo${p.count===1?'':'s'} · ${p.needsValidation?'requiere validación':'regla resuelta'}</small></div><strong>${fmt(p.total)} HC</strong></div><div class="v68-plan-lines">${p.teams.map(team=>`<label><span>${esc(team.name)}<small>Bloque común estimado: ${fmt(teamCommonHours(team.id))} HC</small></span><input data-v68-plan-hours="${esc(t.id)}|${esc(team.id)}" type="number" min="1" max="12" step="1" value="${esc(p.byTeam[team.id]||0)}"></label>`).join('')}</div><div class="v68-plan-actions">${p.count>=3?`<button type="button" class="btn small ${p.needsValidation?'primary':'soft'}" data-v68-validate-plan="${esc(t.id)}">${p.needsValidation?'Validar distribución':'Distribución validada'}</button>`:''}<button type="button" class="btn small soft" data-v68-reset-plan="${esc(t.id)}">Restablecer automático</button></div></article>`}).join('');
    const min=institutionalMinimum();return `<section id="v68Planning" class="card v48-section v68-planning"><div class="eyebrow">Planificación mínima derivada</div><h2>La carga mínima surge después de la asignación</h2><p>Un docente en un equipo recibe 3 HC de base. En dos equipos recibe 4 HC totales, inicialmente 2 + 2. Si integra tres o más equipos, el sistema deja una distribución provisoria de 2 HC por equipo y exige validación explícita antes de cerrar el horario.</p><div class="v68-min-summary"><span><strong>${fmt(min.front)} HC</strong> frente a curso</span><span><strong>${fmt(min.planning)} HC</strong> planificación mínima</span>${min.explicit?`<span><strong>${fmt(min.explicit)} HC</strong> otras tareas</span>`:''}<span class="total"><strong>${fmt(min.total)} HC</strong> carga mínima institucional actual</span></div>${cards?`<div class="v68-plan-grid">${cards}</div>`:'<div class="v48-empty">La planificación por equipos aparecerá cuando existan asignaciones docentes.</div>'}</section>`;
  }
  function proposalHtml(){
    const p=currentProposal(),all=rows(),current=root().assignments;
    let detail='';if(p){const diffs=all.filter(r=>(current[r.instanceId]||'')!==(p.assignments[r.instanceId]||''));const status=p.viability?p.viability.ok?'Viable':'Con incompatibilidades':'Sin simular';detail=`<div class="v68-proposal-status ${p.viability?.ok?'ok':p.viability?'bad':''}"><div><strong>${status}</strong><span>${p.mode==='rebalance'?'Reorganización de asignaciones no fijadas':'Completar asignaciones pendientes'} · ${new Date(p.createdAt).toLocaleString('es-AR')}</span></div><div class="v68-proposal-metrics"><span>${p.stats.assigned}/${p.stats.instances} asignadas</span><span>${p.stats.pending} pendientes</span><span>${p.stats.changes} cambios</span><span>${fmt(p.stats.minimumTotal)} HC mínimas</span></div></div>${p.viability?.issues?.length?`<div class="v68-issues">${p.viability.issues.slice(0,12).map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>`:''}${diffs.length?`<div class="v48-table-wrap"><table class="v48-table v68-diff-table"><thead><tr><th>Orientación</th><th>Curso</th><th>Espacio</th><th>Actual</th><th>Propuesta</th></tr></thead><tbody>${diffs.slice(0,120).map(r=>`<tr><td>${esc(r.orientation)}</td><td>${esc(r.course)}</td><td>${esc(r.name)}</td><td>${esc(teacherName(current[r.instanceId])||'Sin asignar')}</td><td><strong>${esc(teacherName(p.assignments[r.instanceId])||'Sin asignar')}</strong></td></tr>`).join('')}</tbody></table></div>`:'<div class="v48-empty">La propuesta no cambia la asignación actual.</div>'}`}
    return `<section id="v68Proposal" class="card v48-section v68-proposal"><div class="eyebrow">Propuesta de planta docente</div><h2>Asignar y comprobar antes de aplicar</h2><p>El motor usa los perfiles docentes, las asignaciones fijadas, las HC objetivo/máximas, los equipos derivados y la disponibilidad. La propuesta no modifica la planta vigente hasta superar la simulación horaria y ser aceptada.</p><div class="v68-proposal-actions"><button type="button" class="btn" data-v68-propose="pending">Completar pendientes</button><button type="button" class="btn" data-v68-propose="rebalance">Reorganizar no fijadas</button>${p?'<button type="button" class="btn mint" data-v68-simulate>Simular horario</button>':''}${p?.viability?.ok?'<button type="button" class="btn primary" data-v68-apply>Aplicar propuesta</button>':''}${p?'<button type="button" class="btn soft" data-v68-discard>Descartar propuesta</button>':''}</div>${p?detail:'<div class="v48-empty">Definí los perfiles docentes y generá una propuesta. Las asignaciones marcadas como fijas no se tocan.</div>'}</section>`;
  }

  function decorateTeacherCards(){
    document.querySelectorAll('#v48InstitutionalContent .v48-teacher-card').forEach(card=>{
      const edit=card.querySelector('[data-v48-edit-teacher]'),tid=edit?.dataset.v48EditTeacher;if(!tid)return;const p=profile(tid),plan=teacherPlanning(tid),min=minimumLoad(tid);
      let extra=card.querySelector('.v68-teacher-extra');if(!extra){extra=document.createElement('div');extra.className='v68-teacher-extra';card.appendChild(extra)}
      extra.innerHTML=`<div><span>Perfil</span><strong>${p.rules.length} regla${p.rules.length===1?'':'s'}${p.maxHours?` · máx. ${fmt(p.maxHours)} HC`:''}</strong></div><div><span>Planificación mínima</span><strong>${fmt(plan.total)} HC · ${plan.count} equipo${plan.count===1?'':'s'}</strong></div><div><span>Carga mínima actual</span><strong>${fmt(min.total)} HC</strong></div><button type="button" class="btn small soft" data-v68-profile="${esc(tid)}">Editar perfil</button>`;
    });
  }
  function decorateLocks(){
    document.querySelectorAll('#v48InstitutionalContent [data-v48-assignment]').forEach(sel=>{
      const id=sel.dataset.v48Assignment,td=sel.closest('td');if(!td)return;let b=td.querySelector('[data-v68-lock]');if(!b){b=document.createElement('button');b.type='button';b.className='v68-lock';b.dataset.v68Lock=id;td.appendChild(b)}
      const locked=!!root().assignmentLocks[id];sel.disabled=locked;b.textContent=locked?'🔒 Fija':'○ Fijar';b.classList.toggle('locked',locked);
    });
  }
  function decorate(){
    if(rendering)return;const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;rendering=true;
    try{
      teamsApi()?.deriveTeams?.();
      let demandSection=$id('v68Demand');if(!demandSection){const temp=document.createElement('div');temp.innerHTML=demandHtml();demandSection=temp.firstElementChild;const source=host.querySelector('.v66-source-section');if(source)host.insertBefore(demandSection,source);else host.prepend(demandSection)}else demandSection.outerHTML=demandHtml();
      decorateTeacherCards();decorateLocks();
      let plan=$id('v68Planning');if(!plan){const temp=document.createElement('div');temp.innerHTML=planningHtml();plan=temp.firstElementChild;const assign=host.querySelector('.v66-assignment-section');if(assign)assign.after(plan);else host.appendChild(plan)}else plan.outerHTML=planningHtml();
      let proposal=$id('v68Proposal');if(!proposal){const temp=document.createElement('div');temp.innerHTML=proposalHtml();proposal=temp.firstElementChild;const planNow=$id('v68Planning');if(planNow)planNow.after(proposal);else host.appendChild(proposal)}else proposal.outerHTML=proposalHtml();
    }finally{rendering=false}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,80)}
  function start(){schedule();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false})}}

  document.addEventListener('click',e=>{
    const profileBtn=e.target.closest('[data-v68-profile]');if(profileBtn){renderProfileModal(profileBtn.dataset.v68Profile);return}
    if(e.target.closest('[data-v68-close]')){ensureProfileModal().classList.remove('open');return}
    if(e.target.closest('[data-v68-save-profile]')){saveProfile();return}
    if(e.target.closest('[data-v68-add-rule]')){addRule();return}
    const del=e.target.closest('[data-v68-rule-delete]');if(del){const p=profile(editingTeacherId);if(p){p.rules.splice(Number(del.dataset.v68RuleDelete),1);save();renderProfileModal(editingTeacherId)}return}
    const lock=e.target.closest('[data-v68-lock]');if(lock){const id=lock.dataset.v68Lock;if(root().assignmentLocks[id])delete root().assignmentLocks[id];else{if(!root().assignments[id])return toast('Asigná primero un docente antes de fijar esta instancia.',true);root().assignmentLocks[id]=true}save();api()?.renderInstitutional?.();return}
    const prop=e.target.closest('[data-v68-propose]');if(prop){buildProposal(prop.dataset.v68Propose);return}
    if(e.target.closest('[data-v68-simulate]')){simulateProposal();return}
    if(e.target.closest('[data-v68-apply]')){applyProposal();return}
    if(e.target.closest('[data-v68-discard]')){discardProposal();return}
    const validate=e.target.closest('[data-v68-validate-plan]');if(validate){const tid=validate.dataset.v68ValidatePlan,ov=root().planningOverrides[tid]||{byTeam:{}};ov.byTeam=ov.byTeam||{};const p=teacherPlanning(tid);for(const team of p.teams)if(!(Number(ov.byTeam[team.id])>0))ov.byTeam[team.id]=Number(p.byTeam[team.id]||2);ov.validated=true;root().planningOverrides[tid]=ov;save();window.PCIAnnualOfferV65?.render?.();window.PCIAnnualSchedulerV65?.render?.();decorate();toast('Distribución de planificación validada.');return}
    const reset=e.target.closest('[data-v68-reset-plan]');if(reset){delete root().planningOverrides[reset.dataset.v68ResetPlan];save();window.PCIAnnualOfferV65?.render?.();window.PCIAnnualSchedulerV65?.render?.();decorate();return}
  },true);
  document.addEventListener('change',e=>{
    const input=e.target.closest('[data-v68-plan-hours]');if(input){const [tid,teamId]=input.dataset.v68PlanHours.split('|'),value=Number(input.value);if(!(value>0)){toast('La planificación asignada al equipo debe ser mayor que 0.',true);decorate();return}const ov=root().planningOverrides[tid]||{byTeam:{},validated:false};ov.byTeam=ov.byTeam||{};ov.byTeam[teamId]=value;ov.validated=teacherPlanning(tid).count<3;root().planningOverrides[tid]=ov;save();window.PCIAnnualOfferV65?.render?.();window.PCIAnnualSchedulerV65?.render?.();decorate();return}
    if(e.target.closest('[data-v48-assignment]'))setTimeout(schedule,160);
  },true);
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional'))setTimeout(start,320)},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1150));

  const style=document.createElement('style');style.textContent=`.v68-demand{border-color:#b8d9e8;background:#fbfdff}.v68-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px}.v68-metrics article{padding:11px;border:1px solid var(--line);border-radius:12px;background:#fff}.v68-metrics strong{display:block;font-size:1rem}.v68-metrics span{display:block;margin-top:2px;color:var(--muted);font-size:.58rem;line-height:1.35}.v68-metrics .warn{background:#fff9e8}.v68-footnote{display:block;margin-top:9px;color:var(--muted);font-size:.56rem;line-height:1.4}.v68-teacher-extra{display:grid;grid-template-columns:repeat(3,1fr) auto;gap:7px;align-items:end;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}.v68-teacher-extra div{font-size:.55rem;color:var(--muted)}.v68-teacher-extra strong{display:block;color:var(--ink);font-size:.61rem;margin-top:2px}.v68-lock{display:block;margin-top:5px;border:1px solid var(--line);border-radius:999px;background:#fff;padding:4px 7px;font-size:.5rem;font-weight:850;color:var(--muted)}.v68-lock.locked{background:#fff4d8;color:#765b18}.v68-min-summary{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0}.v68-min-summary span{padding:7px 9px;border-radius:999px;background:var(--band);font-size:.58rem}.v68-min-summary .total{background:var(--mint-soft);color:var(--mint-dark)}.v68-plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:9px;margin-top:12px}.v68-plan-card{border:1px solid var(--line);border-radius:13px;padding:11px;background:#fff}.v68-plan-card.pending{border-color:#e5c96f;background:#fffdf5}.v68-plan-title{display:flex;justify-content:space-between;gap:8px}.v68-plan-title h3{margin:0;font-size:.8rem}.v68-plan-title small{color:var(--muted);font-size:.53rem}.v68-plan-title>strong{font-size:.82rem}.v68-plan-lines{margin-top:8px;display:grid;gap:5px}.v68-plan-lines label{display:grid;grid-template-columns:1fr 72px;gap:7px;align-items:center;font-size:.56rem}.v68-plan-lines span{font-weight:800}.v68-plan-lines small{display:block;color:var(--muted);font-weight:500;margin-top:2px}.v68-plan-lines input{width:100%;padding:6px;border:1px solid var(--line);border-radius:8px}.v68-plan-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v68-proposal-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.v68-proposal-status{margin-top:11px;padding:11px;border-radius:12px;background:var(--band);display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v68-proposal-status.ok{background:var(--ok-soft);color:var(--ok)}.v68-proposal-status.bad{background:var(--danger-soft);color:var(--danger)}.v68-proposal-status strong{font-size:.78rem}.v68-proposal-status span{display:block;font-size:.55rem;margin-top:2px}.v68-proposal-metrics{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.v68-proposal-metrics span{padding:4px 6px;background:#fff;border-radius:999px;color:var(--ink)}.v68-issues{margin-top:8px;padding:9px;border:1px solid #eed3d9;border-radius:10px;font-size:.57rem;line-height:1.4;color:var(--danger)}.v68-diff-table{min-width:900px!important}.v68-modal-box{width:min(980px,96vw)}.v68-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v68-modal-head h2{margin:4px 0 0}.v68-profile-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-top:14px}.v68-profile-grid label,.v68-new-rule label{display:grid;gap:4px;font-size:.57rem;font-weight:850;color:var(--muted)}.v68-profile-grid input,.v68-new-rule input,.v68-new-rule select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px}.v68-rule-head{margin-top:18px}.v68-rule-head h3{margin:0;font-size:.9rem}.v68-rule-head p{margin:4px 0 0;color:var(--muted);font-size:.62rem;line-height:1.4}.v68-rule-list{display:grid;gap:6px;margin-top:9px}.v68-rule-list article{display:grid;grid-template-columns:110px 1fr 1fr auto;gap:7px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:9px;font-size:.57rem}.v68-rule-list button{border:0;background:transparent;text-decoration:underline;font-weight:800;color:var(--ink)}.v68-new-rule{display:grid;grid-template-columns:130px 1.2fr 130px 1fr 130px auto;gap:7px;align-items:end;margin-top:10px;padding:10px;border-radius:10px;background:var(--band)}.v68-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}@media(max-width:900px){.v68-teacher-extra{grid-template-columns:1fr 1fr}.v68-profile-grid{grid-template-columns:1fr}.v68-new-rule{grid-template-columns:1fr 1fr}.v68-new-rule button{grid-column:1/-1}.v68-rule-list article{grid-template-columns:1fr 1fr}.v68-proposal-status{flex-direction:column}.v68-proposal-metrics{justify-content:flex-start}}`;document.head.appendChild(style);

  window.PCIStaffPlanningV68={demand,demandRows,relationsForRow,rowTeamIds,profile,profileRows,teacherPlanning,teamCommonHours,residualRows,pendingTeachers,loadByTeacher,minimumLoad,institutionalMinimum,planningRows,proposalRows,buildProposal,simulateProposal,applyProposal,currentProposal,decorate};
})();