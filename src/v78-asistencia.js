(() => {
  const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TYPES=[['TARDE','Tarde',0.5],['AUSENTE','Ausente',1],['AUSENTE_PRESENCIA','Ausente con presencia',1],['AUSENTE_EF','Ausente a EF',0.5]];
  const localDate=now=>new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  let commission='',date=localDate(new Date());
  let accessScope={role:'admin',commissionKeys:null};
  function root(){state.institutional=state.institutional||{};state.institutional.attendance=state.institutional.attendance||{records:[]};return state.institutional.attendance}
  function defs(){const all=window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];if(accessScope.role==='admin')return all;if(accessScope.role!=='teacher'||!Array.isArray(accessScope.commissionKeys))return[];const allowed=new Set(accessScope.commissionKeys);return all.filter(x=>allowed.has(x.key))}
  function students(k){return window.PCIStudentsCommissionsV72?.studentsFor?.(k)||[]}
  function val(t){return TYPES.find(x=>x[0]===t)?.[2]||0}
  function dayRecords(dni,d){return root().records.filter(r=>r.dni===dni&&r.date===d)}
  function total(dni,d){return dayRecords(dni,d).reduce((n,r)=>n+Number(r.value||0),0)}
  function conditionFor(dni){const a=root().records.filter(r=>r.dni===dni&&!r.justified).reduce((n,r)=>n+Number(r.value||0),0);return{annual:a,regular:a<=20}}
  function validateAddition(x){
    const v=val(x.type), existing=dayRecords(x.dni,x.date);
    if(existing.some(r=>r.type===x.type))throw new Error('Ese tipo de falta ya fue registrado para este estudiante en la fecha seleccionada.');
    if(total(x.dni,x.date)+v>1)throw new Error('La suma de faltas no puede superar 1 por estudiante y por día.');
    return v
  }
  function add(x){
    if(!['admin','teacher'].includes(accessScope.role))throw new Error('No tenés permiso para registrar asistencia.');
    const v=validateAddition(x);
    root().records.push({id:'att-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),...x,value:v,createdAt:new Date().toISOString()});save()
  }
  function del(id){if(!['admin','teacher'].includes(accessScope.role))return toast('No tenés permiso para modificar asistencia.',true);root().records=root().records.filter(r=>r.id!==id);save();render()}
  function ensure(){
    let e=$('v78Attendance');if(e)return e;
    const main=document.querySelector('main.wrap');if(!main)return null;
    e=document.createElement('section');e.id='v78Attendance';e.className='screen';
    e.innerHTML='<div id="v78AttendanceRoot"></div>';
    main.appendChild(e);return e
  }
  function host(){ensure();return $('v78AttendanceRoot')}
  function show(){
    const e=ensure();if(!e)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    e.classList.add('active');window.scrollTo(0,0)
  }
  function goHome(){
    const home=$('home');if(!home)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    home.classList.add('active');
    window.PCIHomeRedesignV74?.refresh?.();
    window.scrollTo(0,0)
  }
  function patchHome(){
    const home=$('home');if(!home)return;
    let card=$('v78AttendanceEntry');
    if(!card){
      card=document.createElement('article');
      card.id='v78AttendanceEntry';card.className='card v75-grading v78-home-entry';
      const anchor=$('v77BulletinsEntry')||$('v75Grading')||$('v71LeanHomeEntry');
      anchor?.after(card);
    }
    card.innerHTML='<div><div class="eyebrow">5 · Asistencia</div><h2>Asistencia</h2><p>Registro diario por estudiante, tipo de falta, motivo y justificación.</p><small>Usa las comisiones y los estudiantes cargados en Gestión, identificados por DNI.</small></div><button type="button" class="btn primary" data-v78-open>Abrir Asistencia</button>';
    card.hidden=!['admin','teacher'].includes(accessScope.role);
    card.querySelector('[data-v78-open]')?.addEventListener('click',open);
  }
  function render(){const h=host();if(!h)return;const ds=defs();if(!ds.some(x=>x.key===commission))commission=ds[0]?.key||'';const ss=commission?students(commission):[],rs=root().records.filter(r=>r.commissionKey===commission&&r.date===date);
    h.innerHTML=`<div class="v78-topbar"><button type="button" class="btn soft" data-v78-home>← Inicio</button></div><div class="v78-hero"><div class="eyebrow">Asistencia</div><h2>Registro diario</h2><p>Levanta los estudiantes ya cargados en Gestión y calcula el cómputo diario.</p></div>
    <div class="v78-filters"><label>Comisión<select data-c>${ds.map(c=>`<option value="${esc(c.key)}" ${c.key===commission?'selected':''}>${esc(c.course)} · ${esc(c.orientation)}</option>`).join('')}</select></label><label>Fecha<input type="date" data-d value="${date}"></label></div>
    <div class="v78-list">${ss.map(s=>{const rr=rs.filter(r=>r.dni===s.dni),sum=rr.reduce((n,r)=>n+Number(r.value||0),0),co=conditionFor(s.dni);return `<article class="v78-row" data-dni="${esc(s.dni)}"><div><strong>${esc(s.lastName||'')} ${esc(s.firstName||'')}</strong><small>DNI ${esc(s.dni)} · Día: ${sum} · Injustificadas anuales: ${co.annual}</small></div><select data-t>${TYPES.map(([k,l,v])=>`<option value="${k}">${l} (+${v})</option>`).join('')}</select><input data-r placeholder="Motivo"><label><input type="checkbox" data-j> Justificada</label><button data-a>Registrar</button><div class="v78-tags">${rr.map(r=>`<span>${TYPES.find(x=>x[0]===r.type)?.[1]} +${r.value} · ${r.justified?'Justificada':'Injustificada'}${r.reason?' · '+esc(r.reason):''}<button data-x="${r.id}">×</button></span>`).join('')}</div></article>`}).join('')||'<p class="v78-empty">No hay estudiantes en esta comisión.</p>'}</div>`;
    h.querySelector('[data-v78-home]')?.addEventListener('click',goHome);
    h.querySelector('[data-c]')?.addEventListener('change',e=>{commission=e.target.value;render()});h.querySelector('[data-d]')?.addEventListener('change',e=>{date=e.target.value;render()});
    h.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-dni]');try{add({commissionKey:commission,dni:r.dataset.dni,date,type:r.querySelector('[data-t]').value,reason:r.querySelector('[data-r]').value.trim(),justified:r.querySelector('[data-j]').checked});render();toast('Asistencia registrada.')}catch(e){toast(e.message,true)}});
    h.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>del(b.dataset.x));
  }
  const s=document.createElement('style');s.textContent=`#v78Attendance.screen{display:none;gap:14px}#v78Attendance.screen.active{display:grid}.v78-hero,.v78-filters,.v78-row{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px}.v78-hero{background:linear-gradient(135deg,#f8fbfd,#eef5f8)}.v78-hero h2{margin:4px 0}.v78-hero p{margin:0;color:var(--muted)}.v78-filters{display:grid;grid-template-columns:2fr 1fr;gap:10px}.v78-filters label{display:grid;gap:5px;font-weight:800}.v78-filters select,.v78-filters input,.v78-row select,.v78-row>input{padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff}.v78-list{display:grid;gap:9px}.v78-row{display:grid;grid-template-columns:minmax(220px,1.5fr) 180px minmax(140px,1fr) auto auto;gap:8px;align-items:center}.v78-row small{display:block;color:var(--muted);margin-top:3px}.v78-row>button{border:0;border-radius:999px;background:var(--ink);color:#fff;padding:9px 12px;font-weight:850}.v78-tags{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}.v78-tags span{padding:5px 8px;border-radius:999px;background:var(--band);font-size:.55rem}.v78-tags button{border:0;background:transparent;font-weight:900}@media(max-width:850px){.v78-filters,.v78-row{grid-template-columns:1fr}.v78-tags{grid-column:1}.v78-row>button{width:100%}}`;document.head.appendChild(s);
  function open(){if(!['admin','teacher'].includes(accessScope.role))return toast('No tenés permiso para acceder a Asistencia.',true);show();render()}
  function setAccessScope(scope={}){accessScope={role:['admin','teacher','student','family'].includes(scope.role)?scope.role:'admin',commissionKeys:Array.isArray(scope.commissionKeys)?scope.commissionKeys.map(String):null};commission='';patchHome();if($('v78Attendance')?.classList.contains('active'))render()}
  function start(){ensure();patchHome()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1100));setTimeout(start,1800);
  window.PCIAttendanceV78={render,open,addRecord:add,records:()=>root().records,conditionFor,total,dayRecords,validateAddition,setAccessScope,getAccessScope:()=>({...accessScope}),defs};
})();
