(() => {
  const $id=id=>document.getElementById(id);
  const BASE_DAYS=[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes']];
  let observer=null,refreshTimer=null;
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||min));
  const toMin=value=>{const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
  const toTime=min=>{min=Math.max(0,Math.min(1439,Math.round(min)));return`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`};
  const root=()=>{state.institutional=state.institutional||{};return state.institutional};

  function buildByCount(firstStart,count,classMinutes,breakEvery,breakMinutes){
    let current=toMin(firstStart)??465;const out=[];
    for(let i=1;i<=count;i++){
      const start=current,end=start+classMinutes;out.push({period:i,start:toTime(start),end:toTime(end)});current=end;
      if(i<count&&breakEvery>0&&i%breakEvery===0)current+=breakMinutes;
    }
    return out;
  }
  function buildByRange(firstStart,lastEnd,classMinutes,breakEvery,breakMinutes){
    let current=toMin(firstStart),limit=toMin(lastEnd);const out=[];
    if(current==null||limit==null||limit<=current)return out;
    for(let i=1;i<=16;i++){
      const end=current+classMinutes;if(end>limit)break;
      out.push({period:i,start:toTime(current),end:toTime(end)});current=end;
      if(breakEvery>0&&i%breakEvery===0)current+=breakMinutes;
    }
    return out;
  }
  function normalizeSlots(rows){
    return (Array.isArray(rows)?rows:[]).map((x,i)=>({period:i+1,start:String(x.start||''),end:String(x.end||'')}));
  }
  function config(){
    const r=root();r.scheduleConfig=r.scheduleConfig||{};const c=r.scheduleConfig;
    if(Number(c.version||0)<2){
      const oldCount=clamp(c.periodsPerDay||8,1,16),classMinutes=40,breakEvery=2,breakMinutes=15,firstStart='07:45';
      const slots=buildByCount(firstStart,oldCount,classMinutes,breakEvery,breakMinutes);
      Object.assign(c,{version:2,firstStart,lastEnd:slots.at(-1)?.end||'13:50',classMinutes,breakEvery,breakMinutes,activeDays:{mon:true,tue:true,wed:true,thu:true,fri:true},slots});
    }
    c.activeDays=c.activeDays||{mon:true,tue:true,wed:true,thu:true,fri:true};
    c.classMinutes=clamp(c.classMinutes||40,20,120);c.breakEvery=clamp(c.breakEvery||2,1,8);c.breakMinutes=clamp(c.breakMinutes||15,0,60);
    c.firstStart=String(c.firstStart||'07:45');c.lastEnd=String(c.lastEnd||'13:50');c.slots=normalizeSlots(c.slots);
    if(!c.slots.length)c.slots=buildByRange(c.firstStart,c.lastEnd,c.classMinutes,c.breakEvery,c.breakMinutes);
    return c;
  }
  const days=()=>BASE_DAYS.filter(([id])=>config().activeDays[id]!==false);
  const slots=()=>config().slots;
  const periodCount=()=>slots().length;
  const slot=p=>slots()[Number(p)-1]||null;
  const slotLabel=p=>{const s=slot(p);return s?`${s.start}–${s.end}`:`Hora ${p}`};
  const snapshot=()=>({version:2,days:days().map(([id,label])=>({id,label})),slots:slots().map(x=>({...x}))});

  function validate(){
    const c=config(),issues=[];if(!days().length)issues.push('Seleccioná al menos un día de cursada.');if(!c.slots.length)issues.push('La jornada no tiene horas de clase.');
    c.slots.forEach((s,i)=>{const a=toMin(s.start),b=toMin(s.end);if(a==null||b==null||b<=a)issues.push(`La hora ${i+1} tiene un rango inválido.`);if(i>0){const prev=toMin(c.slots[i-1].end);if(prev!=null&&a!=null&&a<prev)issues.push(`La hora ${i+1} se superpone con la anterior.`)}});
    return{ok:!issues.length,issues};
  }
  function saveConfig(){config().slots=normalizeSlots(config().slots);save();window.dispatchEvent(new Event('pci-schedule-grid-changed'));scheduleRefresh()}
  function regenerate(){
    const c=config(),rows=buildByRange(c.firstStart,c.lastEnd,clamp(c.classMinutes,20,120),clamp(c.breakEvery,1,8),clamp(c.breakMinutes,0,60));
    if(!rows.length){toast('Con esos horarios no entra ninguna hora cátedra.',true);return}
    c.slots=rows;saveConfig();toast(`Jornada generada: ${rows.length} horas cátedra por día.`);
  }

  const style=document.createElement('style');style.textContent=`
    .v51-grid-form{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px;margin-top:12px}.v51-grid-form label{display:grid;gap:4px;font-size:.61rem;font-weight:850}.v51-grid-form input{width:100%;padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}
    .v51-days{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v51-day{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid var(--line);border-radius:999px;font-size:.61rem;font-weight:850;background:#fff}.v51-day input{margin:0}
    .v51-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v51-actions button{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:.62rem;font-weight:850;color:var(--ink)}.v51-actions .primary{background:var(--ink);color:#fff;border-color:var(--ink)}
    .v51-slots{margin-top:12px;border:1px solid var(--line);border-radius:12px;overflow:hidden}.v51-slot{display:grid;grid-template-columns:70px 1fr 1fr auto;gap:7px;align-items:center;padding:7px 9px;border-top:1px solid var(--line)}.v51-slot:first-child{border-top:0}.v51-slot strong{font-size:.62rem}.v51-slot input{width:100%;padding:7px;border:1px solid var(--line);border-radius:8px}.v51-slot button{border:0;background:transparent;color:var(--danger);font-size:.58rem;font-weight:900;text-decoration:underline}.v51-gap{grid-column:2/-1;color:var(--muted);font-size:.55rem;margin-top:-2px}
    .v51-rule{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--mint-soft);font-size:.68rem;line-height:1.4;color:var(--mint-dark)}.v51-warning{margin-top:8px;padding:9px 11px;border-radius:10px;background:var(--danger-soft);color:var(--danger);font-size:.65rem;line-height:1.4}
    @media(max-width:850px){.v51-grid-form{grid-template-columns:1fr 1fr}.v51-grid-form label:first-child{grid-column:1}.v51-slot{grid-template-columns:58px 1fr 1fr auto}}
  `;document.head.appendChild(style);

  function render(section){
    const c=config(),check=validate();
    section.innerHTML=`<div class="eyebrow">Jornada escolar</div><h2>Configuración horaria de la escuela</h2><p>Esta grilla organiza <strong>cuándo</strong> se dictan las horas cátedra que ya vienen de Fase 1. No modifica, suma ni recalcula la estructura curricular y no interviene en Fase 2.</p><div class="v51-grid-form"><label>Primera hora comienza<input type="time" data-v51="firstStart" value="${esc2(c.firstStart)}"></label><label>Última hora termina<input type="time" data-v51="lastEnd" value="${esc2(c.lastEnd)}"></label><label>Duración hora cátedra<input type="number" min="20" max="120" step="5" data-v51="classMinutes" value="${c.classMinutes}"></label><label>Recreo cada N horas<input type="number" min="1" max="8" data-v51="breakEvery" value="${c.breakEvery}"></label><label>Duración recreo (min)<input type="number" min="0" max="60" step="5" data-v51="breakMinutes" value="${c.breakMinutes}"></label></div><div class="v51-days">${BASE_DAYS.map(([id,label])=>`<label class="v51-day"><input type="checkbox" data-v51-day="${id}" ${c.activeDays[id]!==false?'checked':''}>${label}</label>`).join('')}</div><div class="v51-actions"><button type="button" class="primary" data-v51-generate>Generar grilla</button><button type="button" data-v51-add>Agregar hora manual</button></div><div class="v51-rule"><strong>Regla de separación:</strong> Fase 1 aporta la cantidad de horas cátedra. Esta pantalla solamente crea posiciones horarias reales. Los recreos son huecos de la jornada y no cuentan como carga curricular.</div>${check.ok?'':`<div class="v51-warning">${check.issues.map(esc2).join('<br>')}</div>`}<div class="v51-slots">${c.slots.map((s,i)=>{const prev=i?c.slots[i-1]:null,gap=prev&&toMin(s.start)!=null&&toMin(prev.end)!=null?toMin(s.start)-toMin(prev.end):0;return`<div class="v51-slot" data-v51-slot="${i}"><strong>${i+1}.ª HC</strong><input type="time" data-start value="${esc2(s.start)}"><input type="time" data-end value="${esc2(s.end)}"><button type="button" data-remove>Quitar</button>${gap>0?`<div class="v51-gap">Pausa / recreo: ${gap} min</div>`:''}</div>`}).join('')}</div><small style="display:block;margin-top:8px;color:var(--muted);font-size:.6rem;line-height:1.4">La grilla generada se puede editar manualmente para escuelas con jornadas irregulares. Si cambiás horarios después de cargar disponibilidades docentes, revisá esas disponibilidades antes de volver a generar.</small>`;
    section.querySelectorAll('[data-v51]').forEach(input=>input.onchange=()=>{const key=input.dataset.v51;c[key]=key==='firstStart'||key==='lastEnd'?input.value:Number(input.value);saveConfig()});
    section.querySelectorAll('[data-v51-day]').forEach(input=>input.onchange=()=>{c.activeDays[input.dataset.v51Day]=input.checked;saveConfig()});
    section.querySelector('[data-v51-generate]').onclick=regenerate;
    section.querySelector('[data-v51-add]').onclick=()=>{const last=c.slots.at(-1),start=last?.end||c.firstStart,a=toMin(start)??465;c.slots.push({period:c.slots.length+1,start:toTime(a),end:toTime(a+c.classMinutes)});c.lastEnd=c.slots.at(-1).end;saveConfig()};
    section.querySelectorAll('[data-v51-slot]').forEach(row=>{const i=Number(row.dataset.v51Slot);row.querySelector('[data-start]').onchange=e=>{c.slots[i].start=e.target.value;saveConfig()};row.querySelector('[data-end]').onchange=e=>{c.slots[i].end=e.target.value;if(i===c.slots.length-1)c.lastEnd=e.target.value;saveConfig()};row.querySelector('[data-remove]').onclick=()=>{c.slots.splice(i,1);c.slots=normalizeSlots(c.slots);if(c.slots.length)c.lastEnd=c.slots.at(-1).end;saveConfig()}});
  }
  function ensureSection(){
    const host=$id('v48InstitutionalContent');if(!host||!$id('institutional')?.classList.contains('active'))return;
    let section=$id('v51ScheduleConfig');if(!section){section=document.createElement('section');section.id='v51ScheduleConfig';section.className='card v48-section';const availability=$id('v49Availability'),scheduler=$id('v50Scheduler');if(availability)host.insertBefore(section,availability);else if(scheduler)host.insertBefore(section,scheduler);else host.appendChild(section)}
    render(section);
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(ensureSection,45)}
  function start(){scheduleRefresh();const host=$id('v48InstitutionalContent');if(host&&!observer){observer=new MutationObserver(scheduleRefresh);observer.observe(host,{childList:true,subtree:false})}}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,60));
  window.addEventListener('pci-schedule-grid-changed',()=>setTimeout(ensureSection,0));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutional'))setTimeout(start,60)},true);
  window.PCIScheduleConfigV51={BASE_DAYS,config,days,slots,periodCount,slot,slotLabel,snapshot,validate,ensureSection,regenerate};
})();
