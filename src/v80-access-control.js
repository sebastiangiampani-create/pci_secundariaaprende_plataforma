(() => {
  const $=id=>document.getElementById(id);
  const ROLES=new Set(['admin','teacher','student','family']);
  const cleanDni=v=>String(v??'').replace(/\D/g,'');
  const norm=v=>String(v??'').trim().toLowerCase();
  let session={role:'admin',teacherId:'',studentDnis:[],email:''};
  let observer=null,timer=null,lastModuleSignature='';

  function root(){
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.teacherProfiles=state.institutional.teacherProfiles||{};
    state.institutional.assignments=state.institutional.assignments||{};
    state.institutional.areaTeams=state.institutional.areaTeams||{};
    state.institutional.students=state.institutional.students||{};
    state.institutional.commissions=state.institutional.commissions||{};
    return state.institutional;
  }

  function teachers(){return Object.values(root().teachers||{})}
  function teacherByEmail(email){
    const e=norm(email);if(!e)return null;
    return teachers().find(t=>norm(t.email||root().teacherProfiles?.[t.id]?.email)===e)||null;
  }
  function studentDnisByEmail(email){
    const e=norm(email);if(!e)return[];
    return Object.values(root().students||{}).filter(s=>norm(s.email)===e).map(s=>cleanDni(s.dni)).filter(Boolean);
  }
  function implementationRows(){
    const api=window.PCIInstitutionalV48;
    if(api?.allImplementationRows)return api.allImplementationRows()||[];
    return (state.selected||[]).flatMap(o=>api?.implementationRows?.(o)||[]);
  }
  function commissionDefs(){return window.PCIStudentsCommissionsV72?.commissionDefs?.()||[]}

  function teacherCommissionKeys(teacherId){
    const tid=String(teacherId||'');if(!tid)return[];
    const assigned=implementationRows().filter(r=>String(root().assignments?.[r.instanceId]||'')===tid);
    const pairs=new Set(assigned.map(r=>[r.orientation,r.course].join('|||')));
    return commissionDefs().filter(c=>pairs.has([c.orientation,c.course].join('|||'))).map(c=>c.key);
  }

  function groupsForOrientation(orientation){
    const prev=state.active;state.active=orientation;
    try{return window.PCIPhase2V28?.groups?.()||[]}
    finally{state.active=prev}
  }

  function teacherAreasByOrientation(teacherId){
    const tid=String(teacherId||''),out={};if(!tid)return out;
    const assignments=root().assignments||{},rows=implementationRows();
    for(const orientation of (state.selected||[])){
      const assignedSubjects=new Set(rows.filter(r=>r.orientation===orientation&&String(assignments[r.instanceId]||'')===tid).map(r=>r.subjectId));
      const areas=new Set();
      for(const g of groupsForOrientation(orientation)){
        if((g.subjectIds||[]).some(id=>assignedSubjects.has(id)))areas.add(g.area);
      }
      if(areas.size)out[orientation]=[...areas];
    }
    for(const team of Object.values(root().areaTeams||{})){
      if(!(team.teacherIds||[]).map(String).includes(tid)||team.kind!=='FO'||!team.orientation)continue;
      const set=new Set(out[team.orientation]||[]);set.add('Formación Orientada');out[team.orientation]=[...set];
    }
    return out;
  }

  function normalizeSession(scope={}){
    const role=ROLES.has(scope.role)?scope.role:'admin';
    let teacherId=String(scope.teacherId||'');
    const email=String(scope.email||'').trim();
    if(role==='teacher'&&!teacherId&&email)teacherId=String(teacherByEmail(email)?.id||'');
    let studentDnis=Array.isArray(scope.studentDnis)?scope.studentDnis.map(cleanDni).filter(Boolean):[];
    if(role==='student'&&!studentDnis.length&&scope.studentDni)studentDnis=[cleanDni(scope.studentDni)].filter(Boolean);
    if(role==='student'&&!studentDnis.length&&email)studentDnis=studentDnisByEmail(email);
    return {role,teacherId,studentDnis:[...new Set(studentDnis)],email};
  }

  function derivedAccess(scope=session){
    const role=scope.role;
    const areas=role==='teacher'?teacherAreasByOrientation(scope.teacherId):{};
    const commissionKeys=role==='teacher'?teacherCommissionKeys(scope.teacherId):[];
    return {
      role,
      teacherId:scope.teacherId,
      studentDnis:[...(scope.studentDnis||[])],
      allowedAreasByOrientation:areas,
      commissionKeys,
      orientations:role==='admin'?[...(state.selected||[])]:role==='teacher'?Object.keys(areas):[]
    };
  }

  function canOpen(id,access=derivedAccess()){
    if(access.role==='admin')return true;
    if(access.role==='teacher'){
      if(['home','grading','bulletins','v78Attendance'].includes(id))return true;
      if(['panel','offer','proposal'].includes(id))return (access.allowedAreasByOrientation[state.active]||[]).length>0;
      return false;
    }
    return ['home','bulletins'].includes(id);
  }

  function setHidden(el,hidden){if(el)el.hidden=!!hidden}

  function applyHome(access){
    const family=['student','family'].includes(access.role);
    setHidden(document.querySelector('#home > .card.panel'),access.role!=='admin');
    setHidden($('v75CurricularArea'),family);
    setHidden($('v74PciTitle'),family);
    setHidden($('pciList'),family);
    setHidden($('v71LeanHomeEntry'),access.role!=='admin');
    if($('v75Grading'))$('v75Grading').hidden=family;
    if($('v78AttendanceEntry'))$('v78AttendanceEntry').hidden=family;
    document.querySelectorAll('#pciList .pci-card').forEach(card=>{
      if(access.role!=='teacher')return;
      const orientation=card.querySelector('h3')?.textContent?.trim()||'';
      card.hidden=!(access.allowedAreasByOrientation[orientation]||[]).length;
      card.querySelectorAll('.v48-course-config').forEach(x=>x.hidden=true);
    });
    if(access.role==='admin')document.querySelectorAll('#pciList .pci-card,#pciList .v48-course-config').forEach(x=>x.hidden=false);
    const hero=$('home')?.querySelector(':scope > .hero');
    if(hero&&family){
      const h1=hero.querySelector('h1');if(h1&&h1.textContent!=='Resultados académicos')h1.textContent='Resultados académicos';
      const p=hero.querySelector('p');if(p&&p.textContent!=='Consultá los boletines y resultados que la escuela haya publicado.')p.textContent='Consultá los boletines y resultados que la escuela haya publicado.';
      hero.querySelector('.v74-home-stats')?.setAttribute('hidden','');
    }else if(hero){
      const h1=hero.querySelector('h1');if(h1&&h1.textContent!=='Organización curricular de la escuela')h1.textContent='Organización curricular de la escuela';
      const p=hero.querySelector('p');if(p&&p.textContent!=='Elegí las orientaciones de la escuela, configurá sus divisiones y construí cada PCI de manera independiente. Gestión institucional integra toda la escuela.')p.textContent='Elegí las orientaciones de la escuela, configurá sus divisiones y construí cada PCI de manera independiente. Gestión institucional integra toda la escuela.';
      hero.querySelector('.v74-home-stats')?.removeAttribute('hidden');
    }
  }

  function applyOffer(access){
    const offer=$('offer');if(!offer)return;
    const readOnly=access.role==='teacher';
    offer.classList.toggle('v80-readonly-offer',readOnly);
    let banner=$('v80OfferReadonly');
    if(readOnly&&!banner){
      banner=document.createElement('div');banner.id='v80OfferReadonly';banner.className='v80-access-note';
      banner.innerHTML='<strong>Mapa de la Oferta · solo lectura.</strong> Podés consultar la estructura. Los cambios curriculares quedan reservados a administración.';
      offer.querySelector('.hero')?.after(banner);
    }
    if(!readOnly)banner?.remove();
    offer.querySelectorAll('input,select,textarea,button').forEach(el=>{
      const allowed=el.matches('.back,#toggleBag');
      if(readOnly&&!allowed&&!el.disabled){el.disabled=true;el.dataset.v80AccessDisabled='1'}
      if(!readOnly&&el.dataset.v80AccessDisabled==='1'){el.disabled=false;delete el.dataset.v80AccessDisabled}
    });
    offer.querySelectorAll('[draggable="true"],[data-sub]').forEach(el=>{
      if(readOnly){if(el.getAttribute('draggable')==='true')el.dataset.v80Draggable='1';el.setAttribute('draggable','false')}
      else if(el.dataset.v80Draggable==='1'){el.setAttribute('draggable','true');delete el.dataset.v80Draggable}
    });
  }

  function accessSignature(access){
    const areas=Object.fromEntries(Object.entries(access.allowedAreasByOrientation||{}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,[...v].sort()]));
    return JSON.stringify({role:access.role,teacherId:access.teacherId,studentDnis:[...(access.studentDnis||[])].sort(),commissionKeys:[...(access.commissionKeys||[])].sort(),areas});
  }

  function applyModules(access,force=false){
    const signature=accessSignature(access);
    if(!force&&signature===lastModuleSignature)return;
    lastModuleSignature=signature;
    window.PCIGradingV76?.setAccessScope?.({role:access.role,teacherId:access.teacherId});
    window.PCIAttendanceV78?.setAccessScope?.({role:access.role,commissionKeys:access.commissionKeys});
    window.PCIBulletinsV77?.setAccessScope?.({role:access.role,teacherId:access.teacherId,studentDnis:access.studentDnis,commissionKeys:access.commissionKeys});
    window.PCIPhase2V28?.setAccessScope?.({role:access.role,teacherId:access.teacherId,allowedAreasByOrientation:access.allowedAreasByOrientation});
  }

  function apply(){
    const access=derivedAccess();
    document.body.dataset.pciRole=access.role;
    applyModules(access);
    applyHome(access);
    applyOffer(access);
    const active=document.querySelector('.screen.active')?.id||'home';
    if(!canOpen(active,access)){
      const home=$('home');document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));home?.classList.add('active');
      window.PCIHomeRedesignV74?.refresh?.();
    }
    return access;
  }

  function setSession(scope={}){
    session=normalizeSession(scope);
    lastModuleSignature='';
    const access=derivedAccess();
    applyModules(access,true);
    document.body.dataset.pciRole=access.role;
    applyHome(access);applyOffer(access);
    const active=document.querySelector('.screen.active')?.id||'home';
    if(!canOpen(active,access)){const home=$('home');document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));home?.classList.add('active');window.PCIHomeRedesignV74?.refresh?.()}
    try{window.dispatchEvent(new CustomEvent('pci-access-changed',{detail:{role:access.role,teacherId:access.teacherId}}))}catch{}
    return access;
  }

  const previousScreen=window.screen;
  if(typeof previousScreen==='function'&&!previousScreen.__v80){
    const wrapped=function(id){
      const access=derivedAccess();
      if(!canOpen(id,access)){toast('No tenés permiso para acceder a este módulo.',true);return}
      const out=previousScreen(id);
      setTimeout(()=>{applyHome(access);applyOffer(access)},0);
      return out;
    };
    Object.assign(wrapped,previousScreen);wrapped.__v80=true;window.screen=wrapped;
  }

  document.addEventListener('dragstart',e=>{
    if(session.role==='teacher'&&e.target.closest?.('#offer')){e.preventDefault();toast('El Mapa de la Oferta está en modo solo lectura.',true)}
  },true);
  document.addEventListener('drop',e=>{
    if(session.role==='teacher'&&e.target.closest?.('#offer')){e.preventDefault();e.stopPropagation()}
  },true);

  function refresh(){clearTimeout(timer);timer=setTimeout(apply,80)}
  function start(){
    const home=$('home');
    if(home&&!observer){observer=new MutationObserver(refresh);observer.observe(home,{childList:true,subtree:true})}
    setSession(window.PCI_ACCESS_SESSION||session);
  }
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1400));
  setTimeout(start,2200);

  const style=document.createElement('style');
  style.textContent=`
    .v80-access-note{margin:12px 0;padding:12px 14px;border:1px solid #b7ccd9;border-radius:14px;background:#f3f8fb;color:#31536d;font-size:.65rem;line-height:1.4}
    #offer.v80-readonly-offer .slot{pointer-events:none}
    body[data-pci-role="teacher"] #home .v74-school-setup{display:none!important}
    body[data-pci-role="teacher"] #v71LeanHomeEntry{display:none!important}
    body[data-pci-role="student"] #home .v74-school-setup,body[data-pci-role="family"] #home .v74-school-setup{display:none!important}
  `;
  document.head.appendChild(style);

  window.PCIAppAccessV80={
    setSession,getSession:()=>({...session,studentDnis:[...session.studentDnis]}),
    derivedAccess,teacherCommissionKeys,teacherAreasByOrientation,teacherByEmail,studentDnisByEmail,canOpen,apply
  };
})();