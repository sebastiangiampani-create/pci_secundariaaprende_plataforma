(() => {
'use strict';

const STORAGE='pci_secundaria_aprende_v2_state_5';
const SOCIAL_NAMES=new Set(['Historia','Geografía','Formación Ética y Ciudadana','Economía','Filosofía']);
const NATURAL_NAMES=new Set(['Biología','Físico-Química','Física','Química']);
const ART_TERMS=new Set([1,2,3,4,7,8]);
const TECH_TERMS=new Set([1,2,3,4,5,6,7,8,9,10]);
const EF_TERMS=new Set([1,2,3,4,5,6,7,8,9,10]);
const ORIENTATIONS=['Ciencias Naturales','Matemática y Física','Energía y Sustentabilidad','Economía y Administración','Educación Física','Comunicación','Literatura','Turismo','Lenguas','Informática','Educación','Ciencias Sociales y Humanidades','Arte - Artes Visuales','Arte - Música','Arte - Teatro','Agro y Ambiente'];

let DATA=null;
let state={schoolName:'Escuela Muestra',selected:['Economía y Administración'],active:'Economía y Administración',maps:{}};
let selectedSubject=null;
let currentProposalSlot=null;
let mapFocus=false;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slug=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const levelForTerm=t=>Math.ceil(Number(t)/2);
const termsForYear=y=>[Number(y)*2-1,Number(y)*2];
const pairTerm=t=>Number(t)%2?Number(t)+1:Number(t)-1;

function notify(msg,bad=false){const t=$('toast');if(!t)return;t.textContent=msg;t.className='toast show'+(bad?' bad':'');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.className='toast',2400)}
function save(){if($('schoolName'))state.schoolName=$('schoolName').value||state.schoolName;localStorage.setItem(STORAGE,JSON.stringify(state))}
function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw&&raw.maps)state={...state,...raw}}catch{}}
function ensureMap(name){
  if(!state.maps[name])state.maps[name]={alt:'A',level3Mode:'one',placements:{},teachers:'',validated:false,phase2:{},customSubjects:[]};
  const m=state.maps[name];
  m.placements=m.placements||{};m.phase2=m.phase2||{};m.level3Mode=m.level3Mode||m.socialMode||'one';m.customSubjects=m.customSubjects||[];
  return m;
}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});if(id==='home')renderHome();if(id==='pciPanel')renderPanel();if(id==='phase1')renderPhase1();if(id==='phase2')renderPhase2()}

function fgSubjects(){const out=[];for(let y=1;y<=5;y++)for(const name of DATA.formacion_general[String(y)]||[])out.push({id:`fg-${y}-${slug(name)}`,name,year:y,origin:'FG',annual:true});return out}
function foSubjects(orientation){const d=DATA.formacion_orientada[orientation]||{};const m=ensureMap(orientation);const alt=d.sinAlternativas?'A':m.alt;const out=[];(d['3']||[]).forEach((name,i)=>out.push({id:`fo-${slug(orientation)}-3-${i}-${slug(name)}`,name,year:3,origin:'FO',annual:true}));for(const y of [4,5])((d[alt]||{})[String(y)]||[]).forEach((name,i)=>out.push({id:`fo-${slug(orientation)}-${y}-${i}-${slug(name)}`,name,year:y,origin:'FO',annual:true}));return out}
function customSubjects(){return ensureMap(state.active).customSubjects.map(s=>({...s,origin:'CUSTOM',annual:true}))}
function allSubjects(){return [...fgSubjects(),...foSubjects(state.active),...customSubjects()]}
function subjectById(id){return allSubjects().find(s=>s.id===id)||null}
function slotEntries(){const m=ensureMap(state.active);return Object.entries(m.placements).flatMap(([slot,ids])=>(ids||[]).map(id=>({slot,id})))}
function termOfSlot(slot){const m=slot.match(/-c(\d+)$/);return m?Number(m[1]):null}
function annualYearOfSlot(slot){const m=slot.match(/-n(\d+)$/);return m?Number(m[1]):null}
function usage(subjectId){const terms=new Set();for(const {slot,id} of slotEntries()){if(id!==subjectId)continue;const y=annualYearOfSlot(slot);if(y){termsForYear(y).forEach(t=>terms.add(t));continue}const t=termOfSlot(slot);if(t)terms.add(t)}return terms}
function usageText(s){const u=[...usage(s.id)].sort((a,b)=>a-b);return u.length?u.map(t=>'C'+t).join('+'):'Anual'}

function renderHome(){
  if($('schoolName'))$('schoolName').value=state.schoolName||'Escuela Muestra';
  const grid=$('orientationGrid');if(!grid)return;grid.innerHTML='';
  for(const o of ORIENTATIONS){const l=document.createElement('label');l.className='orientation-choice';l.innerHTML=`<input type="checkbox" ${state.selected.includes(o)?'checked':''}><span><strong>${esc(o)}</strong><small>Genera un PCI independiente</small></span>`;l.querySelector('input').onchange=e=>{if(e.target.checked){if(!state.selected.includes(o))state.selected.push(o);ensureMap(o);state.active=o}else{state.selected=state.selected.filter(x=>x!==o);if(state.active===o)state.active=state.selected[0]||null}save();renderHome()};grid.appendChild(l)}
  const pg=$('pciGrid');pg.innerHTML='';if(!state.selected.length){pg.innerHTML='<div class="notice warning">Elegí al menos una orientación para crear su PCI.</div>';return}
  for(const o of state.selected){const m=ensureMap(o);const card=document.createElement('article');card.className='card pci-card';card.innerHTML=`<p class="eyebrow">PCI independiente</p><h3>${esc(o)}</h3><span class="status ${m.validated?'ok':''}">${m.validated?'Mapa de la Oferta validado':'Mapa de la Oferta en construcción'}</span><button class="button primary">Abrir PCI</button>`;card.querySelector('button').onclick=()=>{state.active=o;save();showScreen('pciPanel')};pg.appendChild(card)}
}
function renderPanel(){const m=ensureMap(state.active);$('pciTitle').textContent=`${state.schoolName} · ${state.active}`;$('pciSubtitle').textContent='Este PCI conserva sus propios agrupamientos, docentes y desarrollo curricular.';$('phase1Status').textContent=m.validated?'Validado':'En construcción';$('phase1Status').className='status'+(m.validated?' ok':'');$('openPhase2').disabled=!m.validated;$('phase2Card').classList.toggle('locked',!m.validated);$('phase2Status').textContent=m.validated?'Habilitado':'Requiere Fase 1';$('phase2Status').className='status '+(m.validated?'ok':'lock')}

function dragItemHTML(s){const origin=s.origin==='FG'?'Formación General':s.origin==='FO'?'Formación Orientada':'Institucional / intensificada / EDI';return `<div class="drag-item" draggable="true" data-subject="${esc(s.id)}"><span class="grip">⠿</span><span><strong>${esc(s.name)} · ${s.year}.º</strong><small>${origin}</small></span><span class="usage">${esc(usageText(s))}</span></div>`}
function renderBag(){
  const m=ensureMap(state.active);$('bagTitle').textContent=state.active;const box=$('bagContent');let html='';
  for(let y=1;y<=5;y++){const list=fgSubjects().filter(s=>s.year===y);html+=`<section class="bag-year"><div class="bag-year-head"><strong>${y}.º año</strong><span>Nivel ${y} · C${y*2-1}/C${y*2}</span></div><div class="bag-subhead">Formación General</div>${list.map(dragItemHTML).join('')}</section>`}
  const fo=foSubjects(state.active);html+=`<section class="bag-year"><div class="bag-year-head"><strong>Formación Orientada</strong><span>3.º–5.º</span></div>`;const od=DATA.formacion_orientada[state.active]||{};if(!od.sinAlternativas)html+=`<div class="segmented" style="margin:8px 0 10px"><button data-alt="A" class="${m.alt==='A'?'active':''}">Alternativa A</button><button data-alt="B" class="${m.alt==='B'?'active':''}">Alternativa B</button></div>`;for(const y of [3,4,5])html+=`<div class="bag-subhead">${y}.º año · Formación Orientada</div>${fo.filter(x=>x.year===y).map(dragItemHTML).join('')}`;html+='</section>';
  html+=`<section class="bag-year custom-box"><div class="bag-year-head"><strong>Materias adicionales</strong><span>Bilingüe · intensificada · EDI</span></div><p class="muted custom-help">Agregá una materia institucional que no figure en la caja común. Puede integrarse a un laboratorio o usarse en “Otros formatos pedagógicos”.</p><div class="custom-form"><input id="customSubjectName" placeholder="Nombre de la materia"><select id="customSubjectYear" aria-label="Año"><option value="1">1.º</option><option value="2">2.º</option><option value="3">3.º</option><option value="4">4.º</option><option value="5">5.º</option></select><button id="addCustomSubject" class="button small soft" type="button">+ Agregar</button></div>${m.customSubjects.length?`<div class="bag-subhead">Agregadas en este PCI</div>${customSubjects().map(dragItemHTML).join('')}`:'<p class="muted custom-empty">Todavía no agregaste materias.</p>'}</section>`;
  box.innerHTML=html;
  box.querySelectorAll('[data-subject]').forEach(el=>{el.addEventListener('dragstart',e=>{selectedSubject=el.dataset.subject;e.dataTransfer.setData('text/plain',selectedSubject)});el.onclick=()=>{selectedSubject=el.dataset.subject;box.querySelectorAll('.drag-item').forEach(x=>x.classList.toggle('selected',x===el));notify('Materia seleccionada. Tocá el espacio de destino.')}});
  box.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>{m.alt=b.dataset.alt;m.validated=false;save();renderPhase1()});
  const add=$('addCustomSubject');if(add)add.onclick=()=>{const name=$('customSubjectName').value.trim(),year=Number($('customSubjectYear').value);if(!name)return notify('Escribí el nombre de la materia.',true);const id=`custom-${year}-${slug(name)}-${Date.now().toString(36)}`;m.customSubjects.push({id,name,year});m.validated=false;save();renderPhase1();notify(`${name} agregada a la bolsa de este PCI.`)};
}

function matrixRows(){const mode=ensureMap(state.active).level3Mode;return[
  {key:'trunk-lengua',label:'Lengua y Literatura',kind:'trunk'},
  {key:'trunk-matematica',label:'Matemática',kind:'trunk'},
  {key:'trunk-lengua-adicional',label:'Lengua Adicional',kind:'trunk'},
  {key:'naturales',label:'Laboratorios · Ciencias Naturales',kind:'quarter',active:t=>true},
  {key:'social-a',label:mode==='split'?'Ciencias Sociales · Laboratorio A':'Laboratorios · Ciencias Sociales',kind:'quarter',active:t=>true},
  {key:'social-b',label:'Ciencias Sociales · Laboratorio B',kind:'quarter',active:t=>mode==='split'&&(t===5||t===6)},
  {key:'artes',label:'Talleres · Artes',kind:'quarter',active:t=>ART_TERMS.has(t)},
  {key:'tecnologias',label:'Talleres · Tecnologías',kind:'quarter',active:t=>TECH_TERMS.has(t)},
  {key:'educacion-fisica',label:'Talleres · Educación Física',kind:'quarter',active:t=>EF_TERMS.has(t)},
  {key:'otros',label:'Otros formatos pedagógicos',kind:'quarter',active:t=>true},
  {key:'fo-lab-1',label:'FO · Laboratorio 1',kind:'quarter',active:t=>t===5||t===6},
  {key:'fo-taller-1',label:'FO · Taller 1',kind:'quarter',active:t=>t===5||t===6},
  {key:'fo-lab-2',label:'FO · Laboratorio 2',kind:'quarter',active:t=>t===7||t===8},
  {key:'fo-taller-2',label:'FO · Taller 2',kind:'quarter',active:t=>t===7||t===8},
  {key:'fo-lab-3',label:'FO · Laboratorio 3',kind:'quarter',active:t=>t===9||t===10},
  {key:'fo-lab-4',label:'FO · Laboratorio 4',kind:'quarter',active:t=>t===9||t===10},
  {key:'fo-taller-3',label:'FO · Taller 3',kind:'quarter',active:t=>t===9||t===10},
  {key:'fo-taller-4',label:'FO · Taller 4',kind:'quarter',active:t=>t===9||t===10},
  {key:'proyecto-vinculacion',label:'Proyecto de Vinculación',kind:'quarter',active:t=>t===9||t===10}
]}
function rowActive(key,t){const r=matrixRows().find(x=>x.key===key);return !!(r&&r.kind==='quarter'&&r.active(t))}
function pairSlot(slot){const t=termOfSlot(slot);if(!t)return null;const key=slot.replace(/-c\d+$/,'');const p=pairTerm(t);return rowActive(key,p)?`${key}-c${p}`:null}
function cellLabel(key,t){if(key==='naturales')return`Lab. Naturales · C${t}`;if(key==='social-a')return`${ensureMap(state.active).level3Mode==='split'?'Social A':'Lab. Sociales'} · C${t}`;if(key==='social-b')return`Social B · C${t}`;if(key==='artes')return`Artes · C${t}`;if(key==='tecnologias')return`Tecnologías · C${t}`;if(key==='educacion-fisica')return`Ed. Física · C${t}`;if(key==='otros')return`Otro formato · C${t}`;if(key.startsWith('fo-lab'))return`Laboratorio FO · C${t}`;if(key.startsWith('fo-taller'))return`Taller FO · C${t}`;if(key==='proyecto-vinculacion')return`Proyecto · C${t}`;return`C${t}`}
function placedHTML(slot){const ids=ensureMap(state.active).placements[slot]||[];return `<div class="drop-items">${ids.map(id=>{const s=subjectById(id);return s?`<div class="placed ${s.origin.toLowerCase()}">${esc(s.name)}<button data-remove="${esc(id)}" data-slot="${esc(slot)}">×</button></div>`:''}).join('')}</div>`}
function renderMatrix(){
  let html='<div class="level-strip"><div></div>';for(let y=1;y<=5;y++)html+=`<div class="level-head">Nivel ${y}</div>`;html+='</div><div class="term-strip"><div>Espacio</div>';for(let t=1;t<=10;t++)html+=`<div>C${t}</div>`;html+='</div>';
  for(const row of matrixRows()){html+=`<div class="matrix-row"><div class="row-label">${esc(row.label)}</div>`;if(row.kind==='trunk'){for(let y=1;y<=5;y++){const slot=`${row.key}-n${y}`;html+=`<div class="matrix-cell annual-slot"><div class="dropzone" data-slot="${slot}"><strong>Nivel ${y} · C${y*2-1}+C${y*2}</strong>${placedHTML(slot)}</div></div>`}}else{for(let t=1;t<=10;t++){if(row.active(t)){const slot=`${row.key}-c${t}`;html+=`<div class="matrix-cell"><div class="dropzone" data-slot="${slot}"><strong>${cellLabel(row.key,t)}</strong>${placedHTML(slot)}</div></div>`}else html+='<div class="matrix-cell inactive">—</div>'}}html+='</div>'}
  $('matrix').innerHTML=html;$('matrix').querySelectorAll('.dropzone').forEach(z=>{z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('ready')});z.addEventListener('dragleave',()=>z.classList.remove('ready'));z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('ready');const id=e.dataTransfer.getData('text/plain')||selectedSubject;if(id)assign(z.dataset.slot,id)});z.addEventListener('click',e=>{if(e.target.closest('[data-remove]'))return;if(selectedSubject)assign(z.dataset.slot,selectedSubject)})});$('matrix').querySelectorAll('[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();removeAssignment(b.dataset.slot,b.dataset.remove)})
}
function classify(s){if(s.origin==='CUSTOM')return'custom';if(SOCIAL_NAMES.has(s.name))return'social';if(NATURAL_NAMES.has(s.name))return'natural';if(s.name==='Artes')return'artes';if(['Educación Tecnológica','Tecnologías de la Información'].includes(s.name))return'tecnologias';if(s.name==='Educación Física')return'ef';if(['Lengua y Literatura','Matemática','Lengua Adicional'].includes(s.name))return'trunk';if(['Espacios de Definición Institucional','Tutoría'].includes(s.name))return'otros';return s.origin==='FO'?'fo':'other'}
function canAssign(slot,s){const yAnnual=annualYearOfSlot(slot),t=termOfSlot(slot),year=yAnnual||levelForTerm(t);if(s.year!==year)return[false,`Esta materia es de ${s.year}.º y el destino pertenece a ${year}.º.`];if(yAnnual){const expected=slot.startsWith('trunk-lengua-adicional')?'Lengua Adicional':slot.startsWith('trunk-lengua')?'Lengua y Literatura':'Matemática';if(s.name!==expected)return[false,`El espacio troncal ${expected} solo admite esa materia del mismo nivel.`]}const c=classify(s);if(slot.startsWith('naturales-')&&!(c==='natural'||c==='custom'||(s.origin==='FO'&&t>=5)))return[false,'Este laboratorio recibe Ciencias Naturales y, desde Nivel 3, las articulaciones permitidas.'];if(slot.startsWith('social-')&&!(c==='social'||c==='custom'||(s.origin==='FO'&&t>=5)))return[false,'Este laboratorio recibe Ciencias Sociales y, desde Nivel 3, las articulaciones permitidas.'];if(slot.startsWith('artes-')&&c!=='artes')return[false,'Los talleres de Artes reciben Artes.'];if(slot.startsWith('tecnologias-')&&c!=='tecnologias')return[false,'Los talleres de Tecnologías reciben Educación Tecnológica / Tecnologías de la Información.'];if(slot.startsWith('educacion-fisica-')&&c!=='ef')return[false,'Los talleres de Educación Física reciben Educación Física.'];if(slot.startsWith('otros-'))return[true,''];if(slot.startsWith('fo-lab-1')&&t<=6){if(!(s.origin==='FO'||c==='custom'||(ensureMap(state.active).level3Mode==='articulated'&&c==='social')))return[false,'En el Laboratorio FO de Nivel 3 va la materialización de la orientación y, si elegiste la articulación, una materia de Ciencias Sociales.'];return[true,'']}if((slot.startsWith('fo-')||slot.startsWith('proyecto-vinculacion'))&&!(s.origin==='FO'||c==='custom'))return[false,'Este espacio recibe materializaciones de Formación Orientada o materias institucionales agregadas.'];return[true,'']}
function pushPlacement(slot,id){const p=ensureMap(state.active).placements;p[slot]=p[slot]||[];if(!p[slot].includes(id))p[slot].push(id)}
function assign(slot,id){const s=subjectById(id);if(!s)return;const[ok,msg]=canAssign(slot,s);if(!ok)return notify(msg,true);pushPlacement(slot,id);const paired=pairSlot(slot);if(paired)pushPlacement(paired,id);ensureMap(state.active).validated=false;selectedSubject=null;save();renderPhase1();notify(paired?`${s.name}: ubicado y replicado automáticamente en ${slot.match(/c\d+/)[0].toUpperCase()} y ${paired.match(/c\d+/)[0].toUpperCase()}.`:`${s.name} ubicada.`)}
function removeAssignment(slot,id){const p=ensureMap(state.active).placements;p[slot]=(p[slot]||[]).filter(x=>x!==id);const paired=pairSlot(slot);if(paired)p[paired]=(p[paired]||[]).filter(x=>x!==id);ensureMap(state.active).validated=false;save();renderPhase1()}

function socialSet(slot){return new Set((ensureMap(state.active).placements[slot]||[]).map(subjectById).filter(Boolean).filter(s=>SOCIAL_NAMES.has(s.name)&&s.year===3).map(s=>s.name))}
function naturalSet(slot){return new Set((ensureMap(state.active).placements[slot]||[]).map(subjectById).filter(Boolean).filter(s=>NATURAL_NAMES.has(s.name)&&s.year===3).map(s=>s.name))}
function foYear3Count(slot){return (ensureMap(state.active).placements[slot]||[]).map(subjectById).filter(Boolean).filter(s=>s.origin==='FO'&&s.year===3).length}
function sameSet(a,b){return a.size===b.size&&[...a].every(x=>b.has(x))}
function level3Validation(){
  const m=ensureMap(state.active),mode=m.level3Mode;
  const A5=socialSet('social-a-c5'),A6=socialSet('social-a-c6'),B5=socialSet('social-b-c5'),B6=socialSet('social-b-c6');
  const FO5=socialSet('fo-lab-1-c5'),FO6=socialSet('fo-lab-1-c6');
  const N5=naturalSet('naturales-c5'),N6=naturalSet('naturales-c6');
  const allSocial=new Set(['Historia','Geografía','Formación Ética y Ciudadana','Economía']);
  const allNatural=new Set(['Biología','Físico-Química']);
  if(!sameSet(N5,allNatural)||!sameSet(N6,allNatural))return{ok:false,msg:'Nivel 3 · Formación General: completá el Laboratorio de Ciencias Naturales con Biología + Físico-Química. La conformación se replica automáticamente entre C5 y C6.'};
  if(foYear3Count('fo-lab-1-c5')<1||foYear3Count('fo-lab-1-c6')<1)return{ok:false,msg:'Nivel 3 · Formación Orientada: ubicá la materialización de 3.º en el Laboratorio FO. Se replica automáticamente entre C5 y C6.'};
  if(mode==='one'){
    if(!sameSet(A5,allSocial)||!sameSet(A6,allSocial))return{ok:false,msg:'Opción 3 laboratorios: el Laboratorio de Ciencias Sociales debe reunir Historia, Geografía, FEC y Economía; Naturales y FO quedan como laboratorios propios.'};
    if(FO5.size||FO6.size)return{ok:false,msg:'En esta opción el Laboratorio FO queda independiente: no debe contener materias de Formación General.'};
    return{ok:true,msg:'Nivel 3 válido: 3 laboratorios — Ciencias Naturales + Ciencias Sociales + Formación Orientada.'};
  }
  if(mode==='split'){
    if(A5.size!==2||B5.size!==2||A6.size!==2||B6.size!==2)return{ok:false,msg:'Opción 4 laboratorios: armá dos agrupamientos de Ciencias Sociales de 2+2. Naturales y FO conservan sus laboratorios propios.'};
    const u5=new Set([...A5,...B5]),u6=new Set([...A6,...B6]);
    if(!sameSet(u5,allSocial)||!sameSet(u6,allSocial)||!sameSet(A5,A6)||!sameSet(B5,B6))return{ok:false,msg:'Las cuatro materias sociales deben quedar repartidas 2+2, sin repetir, y con la misma conformación en C5 y C6.'};
    if(FO5.size||FO6.size)return{ok:false,msg:'En esta opción el Laboratorio FO queda independiente: no debe contener materias de Formación General.'};
    return{ok:true,msg:'Nivel 3 válido: 4 laboratorios — Naturales + Sociales A + Sociales B + Formación Orientada.'};
  }
  if(A5.size!==3||A6.size!==3||FO5.size!==1||FO6.size!==1)return{ok:false,msg:'Opción articulada: dejá 3 materias sociales juntas en el Laboratorio FG y 1 materia social dentro del Laboratorio FO junto con la materialización de la orientación.'};
  const u5=new Set([...A5,...FO5]),u6=new Set([...A6,...FO6]);
  if(!sameSet(u5,allSocial)||!sameSet(u6,allSocial)||!sameSet(A5,A6)||!sameSet(FO5,FO6))return{ok:false,msg:'La articulación debe cubrir exactamente las cuatro materias sociales y mantener la misma conformación en C5 y C6.'};
  return{ok:true,msg:'Nivel 3 válido: 3 laboratorios — Naturales + Sociales + Formación Orientada articulada con una materia de FG.'};
}
function renderLevel3Controls(){
  const m=ensureMap(state.active);
  document.querySelectorAll('#socialModes button').forEach(b=>b.classList.toggle('active',b.dataset.mode===m.level3Mode));
  const help={
    one:'La decisión es sobre todo el conjunto de laboratorios de Nivel 3: Naturales queda con Biología + Físico-Química; Sociales reúne las 4 materias; el Laboratorio FO queda independiente.',
    split:'Se organizan 4 laboratorios: Naturales, Sociales A, Sociales B y FO. Elegís libremente cómo repartir Historia, Geografía, FEC y Economía en dos parejas 2+2.',
    articulated:'Se organizan 3 laboratorios: Naturales, Sociales y FO. Una de las cuatro materias sociales se integra al Laboratorio FO junto con la materialización de 3.º; las otras tres quedan juntas en Sociales.'
  };
  $('socialModeHelp').textContent=help[m.level3Mode];
}
function setLevel3Mode(mode){
  const m=ensureMap(state.active);m.level3Mode=mode;
  if(mode!=='split'){delete m.placements['social-b-c5'];delete m.placements['social-b-c6']}
  if(mode!=='articulated')for(const slot of ['fo-lab-1-c5','fo-lab-1-c6'])m.placements[slot]=(m.placements[slot]||[]).filter(id=>subjectById(id)?.origin!=='FG');
  m.validated=false;save();renderPhase1();
}

function renderPhase1(){if(!state.active)return showScreen('home');const m=ensureMap(state.active);$('phase1Title').textContent=`${state.schoolName} · ${state.active}`;$('teachers').value=m.teachers||'';renderLevel3Controls();renderBag();renderMatrix();const v=level3Validation();$('validationMsg').textContent=v.msg;$('validationMsg').style.color=v.ok?'#156746':'#8a6414';const ws=$('phase1Workspace');if(ws)ws.classList.toggle('map-focus',mapFocus);if($('toggleBagBtn'))$('toggleBagBtn').textContent=mapFocus?'Mostrar bolsa':'Ver solo mapa'}
function validateMap(){const m=ensureMap(state.active),v=level3Validation();if(!v.ok){notify(v.msg,true);return}m.validated=true;save();renderPhase1();notify('Mapa de la Oferta validado. Se habilitó el Mapa Propuesta Curricular.')}

function structuralSpaces(){const m=ensureMap(state.active),arr=[];for(const[slot,ids]of Object.entries(m.placements)){if(!ids?.length)continue;const names=ids.map(subjectById).filter(Boolean).map(s=>s.name);arr.push({slot,label:slotLabel(slot),subjects:names})}return arr.sort((a,b)=>a.label.localeCompare(b.label,'es'))}
function slotLabel(slot){const y=annualYearOfSlot(slot);if(y){if(slot.startsWith('trunk-lengua-adicional'))return`Lengua Adicional · Nivel ${y}`;if(slot.startsWith('trunk-lengua'))return`Lengua y Literatura · Nivel ${y}`;return`Matemática · Nivel ${y}`}const t=termOfSlot(slot),prefix=slot.replace(/-c\d+$/,''),labels={'naturales':'Laboratorio Ciencias Naturales','social-a':'Laboratorio Ciencias Sociales A','social-b':'Laboratorio Ciencias Sociales B','artes':'Taller de Artes','tecnologias':'Taller de Tecnologías','educacion-fisica':'Taller de Educación Física','otros':'Otro formato pedagógico','fo-lab-1':'Laboratorio FO 1','fo-taller-1':'Taller FO 1','fo-lab-2':'Laboratorio FO 2','fo-taller-2':'Taller FO 2','fo-lab-3':'Laboratorio FO 3','fo-lab-4':'Laboratorio FO 4','fo-taller-3':'Taller FO 3','fo-taller-4':'Taller FO 4','proyecto-vinculacion':'Proyecto de Vinculación'};return`${labels[prefix]||prefix} · C${t}`}
function renderPhase2(){const m=ensureMap(state.active);if(!m.validated){notify('Primero tenés que validar el Mapa de la Oferta.',true);return showScreen('pciPanel')}$('phase2Title').textContent=`${state.schoolName} · ${state.active}`;const spaces=structuralSpaces();if(!currentProposalSlot||!spaces.some(s=>s.slot===currentProposalSlot))currentProposalSlot=spaces[0]?.slot||null;const box=$('proposalSpaces');box.innerHTML=spaces.length?spaces.map(s=>`<button class="proposal-space ${s.slot===currentProposalSlot?'active':''}" data-space="${esc(s.slot)}">${esc(s.label)}<br><small>${esc(s.subjects.join(' + '))}</small></button>`).join(''):'<p class="muted">Todavía no hay espacios con materias asignadas.</p>';box.querySelectorAll('[data-space]').forEach(b=>b.onclick=()=>{currentProposalSlot=b.dataset.space;renderPhase2()});renderProposalForm()}
function renderProposalForm(){const box=$('proposalFields');if(!currentProposalSlot){$('proposalSpaceTitle').textContent='Elegí un espacio';box.innerHTML='';return}const m=ensureMap(state.active),space=structuralSpaces().find(s=>s.slot===currentProposalSlot);$('proposalSpaceTitle').textContent=space?.label||currentProposalSlot;const d=m.phase2[currentProposalSlot]||{name:'',objectives:'',context:'',synopsis:'',deepening:'',plans:''};box.innerHTML=`<div class="readonly-source"><strong>Estructura heredada de Fase 1:</strong><br>${esc(space?.subjects.join(' + ')||'')}</div><div class="field-grid" style="margin-top:14px"><label><span>Nombre del espacio</span><input data-p2="name" value="${esc(d.name)}"></label><label><span>Contexto / práctica / eje</span><input data-p2="context" value="${esc(d.context)}"></label><label class="full"><span>Objetivos de aprendizaje</span><textarea data-p2="objectives">${esc(d.objectives)}</textarea></label><label class="full"><span>Sinopsis</span><textarea data-p2="synopsis">${esc(d.synopsis)}</textarea></label><label class="full"><span>Contenidos de profundización</span><textarea data-p2="deepening">${esc(d.deepening)}</textarea></label><label class="full"><span>Planes</span><textarea data-p2="plans">${esc(d.plans)}</textarea></label></div>`;box.querySelectorAll('[data-p2]').forEach(el=>el.oninput=()=>{const cur=m.phase2[currentProposalSlot]||{};cur[el.dataset.p2]=el.value;m.phase2[currentProposalSlot]=cur;save()})}
function openPrint(){const m=ensureMap(state.active);$('printModalTitle').textContent=`${state.schoolName} · ${state.active}`;const spaces=structuralSpaces();const rows=spaces.map(s=>`<tr><td>${esc(s.label)}</td><td>${esc(s.subjects.join(' + '))}</td></tr>`).join('');$('docPreview').innerHTML=`<h1>Proyecto Curricular Institucional</h1><p><strong>Escuela:</strong> ${esc(state.schoolName)}</p><p><strong>Orientación:</strong> ${esc(state.active)}</p><h2>Parte I · Mapa de la Oferta</h2><p><strong>Estado:</strong> ${m.validated?'Validado':'En construcción'}</p><table><thead><tr><th>Espacio</th><th>Materias / materializaciones</th></tr></thead><tbody>${rows||'<tr><td colspan="2">Sin asignaciones todavía.</td></tr>'}</tbody></table><h2>Parte II · Mapa Propuesta Curricular</h2><p>${m.validated?'Disponible para desarrollo.':'Pendiente de validar el Mapa de la Oferta.'}</p>`;$('printModal').classList.add('open')}
function downloadDoc(){const html=`<!doctype html><html><head><meta charset="utf-8"><title>PCI</title></head><body>${$('docPreview').innerHTML}</body></html>`;const blob=new Blob([html],{type:'application/msword'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`PCI-${slug(state.schoolName)}-${slug(state.active)}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function patchLevel3Labels(){
  const box=document.querySelector('.social-controls');if(!box)return;
  const eyebrow=box.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='Nivel 3 · Composición de laboratorios';
  const title=box.querySelector('strong');if(title)title.textContent='Elegí cómo se organizan Formación General y Formación Orientada';
  const buttons=box.querySelectorAll('#socialModes [data-mode]');
  const labels={one:'3 laboratorios · Naturales + Sociales + FO',split:'4 laboratorios · Naturales + Sociales A/B + FO',articulated:'3 laboratorios · Naturales + Sociales + FO articulado'};
  buttons.forEach(b=>{if(labels[b.dataset.mode])b.textContent=labels[b.dataset.mode]});
  const note=box.querySelector('.auto-note');if(note)note.textContent='Las materias anuales se replican automáticamente C5 ↔ C6';
}

async function init(){
  try{DATA=await fetch('data/materias-v2.json?v=20260910-6').then(r=>{if(!r.ok)throw new Error('No se pudo cargar materias-v2.json');return r.json()})}catch(err){document.body.innerHTML=`<main><div class="notice danger"><strong>Error cargando la base de materias.</strong><br>${esc(err.message)}</div></main>`;return}
  load();state.selected=state.selected.filter(o=>ORIENTATIONS.includes(o));if(!state.selected.length)state.selected=['Economía y Administración'];state.active=ORIENTATIONS.includes(state.active)?state.active:state.selected[0];state.selected.forEach(ensureMap);patchLevel3Labels();renderHome();
  $('schoolName').oninput=()=>{state.schoolName=$('schoolName').value;save();renderHome()};document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showScreen(b.dataset.go));$('openPhase1').onclick=()=>showScreen('phase1');$('openPhase2').onclick=()=>showScreen('phase2');$('rulesBtn').onclick=()=>$('rulesModal').classList.add('open');$('printBtn').onclick=openPrint;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('open'));document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('open')});
  $('socialModes').onclick=e=>{const b=e.target.closest('[data-mode]');if(b)setLevel3Mode(b.dataset.mode)};$('validateBtn').onclick=validateMap;$('teachers').oninput=()=>{ensureMap(state.active).teachers=$('teachers').value;save()};$('browserPrint').onclick=()=>window.print();$('downloadDoc').onclick=downloadDoc;
  if($('toggleBagBtn'))$('toggleBagBtn').onclick=()=>{mapFocus=!mapFocus;renderPhase1()};
}
init();
})();
