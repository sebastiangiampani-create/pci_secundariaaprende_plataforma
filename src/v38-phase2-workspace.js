(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const br = v => esc(v).replace(/\r?\n/g, '<br>');
  const STAGES = [['punto_partida','Punto de partida'],['indagacion','Indagación'],['produccion','Producción'],['evaluacion','Evaluación']];
  const api = () => window.PCIPhase2V28 || null;
  const model = () => { try { return ensure(state.active); } catch (_) { return null; } };
  const p2 = () => {
    const m = model(); if (!m) return null;
    m.phase2V28 = m.phase2V28 || { groups:{} };
    m.phase2V28.groups = m.phase2V28.groups || {};
    m.phase2V28.customContents = Array.isArray(m.phase2V28.customContents) ? m.phase2V28.customContents : [];
    return m.phase2V28;
  };
  const customs = () => p2()?.customContents || [];
  const group = id => api()?.gb?.(id) || null;
  const gdata = id => group(id)?.data || p2()?.groups?.[id] || null;
  const content = id => api()?.findContent?.(id) || customs().find(x => x.id === id) || null;
  const persist = () => { try { api()?.save?.(); } catch (_) { try { save(); } catch (_) {} } };
  const uid = () => `custom:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;

  function ensureStyles(){
    if(document.getElementById('v38styles')) return;
    const s=document.createElement('style'); s.id='v38styles'; s.textContent=`
      #proposal .v28-card{box-shadow:0 6px 18px rgba(18,57,92,.055)!important;border-radius:16px!important}
      #proposal .v28-group{padding:16px!important;content-visibility:auto;contain-intrinsic-size:620px}
      #proposal .v28-content{content-visibility:auto;contain-intrinsic-size:84px;border-radius:10px!important}
      .v38-own{margin-top:12px;padding:13px;border:1px solid #d8e1e8;border-radius:13px;background:#f8fbfb}
      .v38-own-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .v38-own-head strong{font-size:.78rem}.v38-own-head small{display:block;margin-top:2px;color:#5f7382;font-size:.65rem}
      .v38-own-add{border:1px solid #126e65;border-radius:999px;background:#fff;color:#126e65;padding:7px 10px;font-size:.68rem;font-weight:900}
      .v38-own-list{display:grid;gap:7px}.v38-own-item{position:relative;padding:9px 78px 9px 10px;border:1px solid #dfe8ea;border-left:3px solid #126e65;border-radius:10px;background:#fff}
      .v38-own-item small{display:block;margin-bottom:3px;color:#5f7382;font-size:.64rem;font-weight:800}.v38-own-item p{margin:0;font-size:.82rem;line-height:1.35}
      .v38-own-actions{position:absolute;right:7px;top:7px;display:flex;gap:4px}.v38-own-actions button{border:0;border-radius:999px;background:#edf3f8;color:#12395c;padding:5px 7px;font-size:.58rem;font-weight:850}
      .v38-empty{padding:9px 10px;border:1px dashed #cbd8dc;border-radius:10px;color:#6b7f89;font-size:.72rem}
      .v38-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px solid #e2e9ec}
      .v38-actions button{min-height:34px;padding:7px 11px;border-radius:999px;font-size:.68rem;font-weight:850}.v38-actions .main{border:0;background:#e7f8f5;color:#126e65}.v38-actions .secondary{border:1px solid #cbd8dc;background:#fff;color:#12395c}
      .v38-modal{position:fixed;inset:0;z-index:2400;display:grid;place-items:center;padding:16px;background:rgba(18,57,92,.38)}.v38-modal[hidden]{display:none}
      .v38-shell{width:min(1000px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:1px solid #d8e1e8;border-radius:18px;box-shadow:0 18px 54px rgba(18,57,92,.18)}
      .v38-top{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #e2e9ec;background:#fff}.v38-top h2{margin:3px 0 0;font-size:1.2rem}
      .v38-body{padding:18px}.v38-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v38-card,.v38-section{padding:14px;border:1px solid #d8e1e8;border-radius:14px;background:#fff}.v38-card h3,.v38-section h3{margin:6px 0 9px}
      .v38-status{display:inline-flex;padding:4px 8px;border-radius:999px;background:#edf3f8;color:#365d78;font-size:.68rem;font-weight:900}
      .v38-form{display:grid;gap:13px}.v38-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v38-field{display:grid;gap:5px}.v38-field.full{grid-column:1/-1}.v38-field span{font-size:.75rem;font-weight:900;color:#12395c}.v38-field small{color:#5f7382}
      .v38-field input,.v38-field textarea{width:100%;padding:10px 11px;border:1px solid #d8e1e8;border-radius:10px;font:inherit;color:#12395c;background:#fff}.v38-field textarea{min-height:88px;resize:vertical}.v38-field textarea.activities{min-height:165px}
      .v38-stage{border:1px solid #d8e1e8;border-radius:12px;overflow:hidden}.v38-stage summary{padding:12px 14px;background:#f1f8f7;font-weight:900;cursor:pointer}.v38-stage-body{display:grid;gap:10px;padding:13px}
      .v38-note{padding:10px 12px;border-radius:10px;background:#f5f8fa;color:#5f7382;font-size:.77rem;line-height:1.4}.v38-footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .v38-pick-group{display:grid;gap:7px}.v38-pick-title{margin:8px 0 2px;color:#12395c;font-size:.73rem;font-weight:900}.v38-pick{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:9px;border:1px solid #d8e1e8;border-radius:10px}.v38-pick small{display:block;margin-bottom:3px;color:#5f7382}.v38-pick p{margin:0;line-height:1.35}
      @media(max-width:760px){.v38-modal{padding:6px;align-items:end}.v38-shell{max-height:95vh;border-radius:16px 16px 7px 7px}.v38-grid,.v38-fields{grid-template-columns:1fr}.v38-field.full{grid-column:auto}.v38-body,.v38-top{padding:13px}.v38-own-head{align-items:flex-start;flex-direction:column}}
    `; document.head.appendChild(s);
  }

  function modal(){
    ensureStyles(); let m=document.getElementById('v38modal'); if(m) return m;
    m=document.createElement('div'); m.id='v38modal'; m.className='v38-modal'; m.hidden=true;
    m.innerHTML='<section id="v38shell" class="v38-shell" role="dialog" aria-modal="true"></section>';
    document.body.appendChild(m); m.addEventListener('click',e=>{if(e.target===m)closeModal()}); return m;
  }
  function openModal(html){const m=modal();document.getElementById('v38shell').innerHTML=html;m.hidden=false}
  function closeModal(){const m=document.getElementById('v38modal');if(m)m.hidden=true}
  const shell=()=>document.getElementById('v38shell');

  function migrateCustoms(){
    const gs=api()?.groups?.()||[];
    customs().forEach(row=>{
      if(row.groupId) return;
      const hit=gs.find(g=>(g.data?.contents||[]).includes(row.id));
      if(hit){row.groupId=hit.id;row.area=hit.area;}
    });
  }
  const groupCustoms = gid => customs().filter(x => x.groupId === gid && (gdata(gid)?.contents||[]).includes(x.id));
  const defaultSubject = g => (api()?.members?.(g)||[]).map(x=>x.name).filter(Boolean).join(' + ');

  function customEditor(gid,id=null){
    const g=group(gid); if(!g) return;
    const old=id?customs().find(x=>x.id===id&&x.groupId===gid):null;
    openModal(`<div class="v38-top"><div><div class="v28-eye">${esc(api()?.typeLabel?.(g.type)||g.type)} · ${esc(g.data?.name||g.name)}</div><h2>${old?'Editar contenido propio':'Agregar contenido propio'}</h2></div><button class="v28-btn secondary small" type="button" data-close>Cerrar</button></div><div class="v38-body"><form id="v38custom" class="v38-form"><div class="v38-note">Este contenido pertenece solamente a este espacio curricular. Queda separado de los contenidos priorizados oficiales.</div><div class="v38-fields"><label class="v38-field full"><span>Materia / bloque</span><input name="subject" required value="${esc(old?.subject||defaultSubject(g))}"></label><label class="v38-field full"><span>Eje / bloque <small>(opcional)</small></span><input name="axis" value="${esc(old?.axis||'')}"></label><label class="v38-field full"><span>Contenido propio del espacio</span><textarea name="text" required>${esc(old?.text||'')}</textarea></label></div><div class="v38-footer"><div>${old?'<button class="v28-btn secondary" type="button" data-delete>Eliminar</button>':''}</div><button class="v28-btn primary" type="submit">${old?'Guardar cambios':'Agregar contenido'}</button></div></form></div>`);
    const s=shell(); s.querySelector('[data-close]').onclick=closeModal;
    s.querySelector('[data-delete]')?.addEventListener('click',()=>deleteCustom(gid,old.id));
    s.querySelector('#v38custom').onsubmit=e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget); const gd=g.data;
      const row=old||{id:uid(),component:'CUSTOM',createdAt:new Date().toISOString(),groupId:gid,area:g.area};
      row.groupId=gid; row.area=g.area; row.subject=String(fd.get('subject')||'').trim(); row.axis=String(fd.get('axis')||'').trim(); row.text=String(fd.get('text')||'').trim();
      if(!old) customs().push(row); gd.contents=Array.isArray(gd.contents)?gd.contents:[]; if(!gd.contents.includes(row.id))gd.contents.push(row.id);
      persist(); closeModal(); api()?.renderGroups?.();
    };
  }
  function deleteCustom(gid,id){
    if(!confirm('¿Eliminar este contenido propio de este espacio?'))return;
    const rows=customs(),i=rows.findIndex(x=>x.id===id);if(i>=0)rows.splice(i,1);
    const gd=gdata(gid);if(gd){gd.contents=(gd.contents||[]).filter(x=>x!==id);(gd.plansBimestrales||[]).forEach(p=>p.contentIds=(p.contentIds||[]).filter(x=>x!==id));}
    persist();closeModal();api()?.renderGroups?.();
  }

  const blankStage=()=>({description:'',duration:'',resources:'',activities:''});
  function planCount(g){return String(g.term||'').includes('-')?4:2}
  function plans(g){
    const gd=g.data,n=planCount(g); gd.plansBimestrales=Array.isArray(gd.plansBimestrales)?gd.plansBimestrales:[];
    for(let i=0;i<n;i++){
      if(!gd.plansBimestrales[i])gd.plansBimestrales[i]={number:i+1,name:'',synopsis:'',contentIds:[],objectives:'',stages:{},updatedAt:null};
      const p=gd.plansBimestrales[i];p.number=i+1;p.contentIds=Array.isArray(p.contentIds)?p.contentIds.map(String):[];p.stages=p.stages||{};
      STAGES.forEach(([id])=>p.stages[id]={...blankStage(),...(p.stages[id]||{})});
    }
    if(gd.plansBimestrales.length>n)gd.plansBimestrales.length=n;
    return gd.plansBimestrales;
  }
  function planStatus(p){const stages=STAGES.map(([id])=>p.stages?.[id]||{}),has=!!(p.name||p.synopsis||p.objectives||(p.contentIds||[]).length||stages.some(x=>x.description||x.duration||x.resources||x.activities));if(!has)return'Sin iniciar';if(String(p.objectives||'').trim()&&(p.contentIds||[]).length&&stages.every(x=>String(x.activities||'').trim()))return'Completo';return'En elaboración'}

  function planList(gid){
    const g=group(gid);if(!g)return;const ps=plans(g);
    openModal(`<div class="v38-top"><div><div class="v28-eye">${esc(g.area)} · ${esc(api()?.typeLabel?.(g.type)||g.type)}</div><h2>Planes bimestrales · ${esc(g.data.name||g.name)}</h2></div><button class="v28-btn secondary small" type="button" data-close>Cerrar</button></div><div class="v38-body"><div class="v38-note">${ps.length===4?'Espacio anual: 4 planes bimestrales.':'Espacio cuatrimestral: 2 planes bimestrales.'}</div><div class="v38-grid" style="margin-top:12px">${ps.map(p=>`<article class="v38-card"><span class="v38-status">${esc(planStatus(p))}</span><h3>Plan ${p.number}</h3><p style="margin:0;color:#5f7382">${esc(p.name||`Bimestre ${p.number}`)}</p><div class="v38-actions" style="border:0;padding:0"><button class="main" data-open="${p.number}">Abrir</button><button class="secondary" data-print="${p.number}">Imprimir</button></div></article>`).join('')}</div></div>`);
    const s=shell();s.querySelector('[data-close]').onclick=closeModal;s.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>planEditor(gid,+b.dataset.open));s.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>printPlan(gid,+b.dataset.print));
  }
  function planChoices(g,p){
    const rows=(g.data.contents||[]).map(content).filter(Boolean),official=rows.filter(x=>x.component!=='CUSTOM'),own=rows.filter(x=>x.component==='CUSTOM');
    const render=(arr,label)=>arr.length?`<div class="v38-pick-title">${esc(label)}</div><div class="v38-pick-group">${arr.map(c=>`<label class="v38-pick"><input type="checkbox" data-pcontent="${esc(c.id)}" ${(p.contentIds||[]).includes(String(c.id))?'checked':''}><span><small>${esc(c.subject||'')}${c.axis?` · ${esc(c.axis)}`:''}</small><p>${esc(c.text||'')}</p></span></label>`).join('')}</div>`:'';
    return rows.length?`${render(official,'Contenidos priorizados / oficiales')}${render(own,'Contenidos propios del espacio')}`:'<div class="v38-note">Primero asigná contenidos priorizados o agregá contenidos propios al espacio.</div>';
  }
  function stageEditor(id,label,s){return`<details class="v38-stage" open><summary>${esc(label)}</summary><div class="v38-stage-body"><label class="v38-field full"><span>Presentación de la etapa <small>(opcional)</small></span><textarea data-stage="${id}" data-sfield="description">${esc(s.description)}</textarea></label><label class="v38-field"><span>Duración estimada</span><input data-stage="${id}" data-sfield="duration" value="${esc(s.duration)}"></label><label class="v38-field full"><span>Recursos</span><textarea data-stage="${id}" data-sfield="resources">${esc(s.resources)}</textarea></label><label class="v38-field full"><span>Actividades dirigidas al estudiante</span><textarea class="activities" data-stage="${id}" data-sfield="activities">${esc(s.activities)}</textarea></label></div></details>`}
  function planEditor(gid,n){
    const g=group(gid);if(!g)return;const ps=plans(g),p=ps[n-1];
    openModal(`<div class="v38-top"><div><div class="v28-eye">${esc(g.area)} · ${esc(g.data.name||g.name)}</div><h2>Plan bimestral ${n} de ${ps.length}</h2></div><button class="v28-btn secondary small" type="button" data-close>Cerrar</button></div><div class="v38-body"><form id="v38plan" class="v38-form"><section class="v38-section"><h3>Datos generales</h3><div class="v38-fields"><label class="v38-field"><span>Tipo</span><input readonly value="${esc(api()?.typeLabel?.(g.type)||g.type)}"></label><label class="v38-field"><span>Ubicación</span><input readonly value="${esc(api()?.termText?.(g)||g.term)} · Bimestre ${n}"></label><label class="v38-field full"><span>Nombre del plan</span><input data-pfield="name" value="${esc(p.name)}"></label><label class="v38-field full"><span>Sinopsis</span><textarea data-pfield="synopsis">${esc(p.synopsis)}</textarea></label></div></section><section class="v38-section"><h3>Contenidos del plan</h3>${planChoices(g,p)}</section><section class="v38-section"><h3>Objetivos de aprendizaje</h3><textarea data-pfield="objectives" style="width:100%;min-height:105px;padding:10px;border:1px solid #d8e1e8;border-radius:10px">${esc(p.objectives)}</textarea></section><section class="v38-section"><h3>Etapas del plan</h3><div style="display:grid;gap:10px">${STAGES.map(([id,l])=>stageEditor(id,l,p.stages[id])).join('')}</div></section><div class="v38-footer"><div><button class="v28-btn secondary" type="button" data-back>← Planes</button> <button class="v28-btn secondary" type="button" data-preview>Vista previa / imprimir</button></div><button class="v28-btn primary" type="submit">Guardar plan</button></div></form></div>`);
    const s=shell();s.querySelector('[data-close]').onclick=closeModal;s.querySelector('[data-back]').onclick=()=>{savePlan(p);planList(gid)};s.querySelector('[data-preview]').onclick=()=>{savePlan(p);printPlan(gid,n)};s.querySelector('#v38plan').onsubmit=e=>{e.preventDefault();savePlan(p);planList(gid)};
  }
  function savePlan(p){const f=shell()?.querySelector('#v38plan');if(!f)return;f.querySelectorAll('[data-pfield]').forEach(x=>p[x.dataset.pfield]=x.value);p.contentIds=[...f.querySelectorAll('[data-pcontent]:checked')].map(x=>String(x.dataset.pcontent));p.stages=p.stages||{};f.querySelectorAll('[data-stage][data-sfield]').forEach(x=>{const id=x.dataset.stage;p.stages[id]=p.stages[id]||blankStage();p.stages[id][x.dataset.sfield]=x.value});p.updatedAt=new Date().toISOString();persist()}

  function printPopup(title,body){const w=window.open('','_blank');if(!w){alert('El navegador bloqueó la vista de impresión. Habilitá ventanas emergentes.');return}w.document.open();w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:18mm 15mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,sans-serif;color:#1d2b35;font-size:10.5pt;line-height:1.42}.tools{position:sticky;top:0;padding:10px;background:#fff;border-bottom:1px solid #ccd6d9}.tools button{margin-right:7px;padding:9px 12px;border:0;border-radius:8px;background:#12395c;color:#fff;font-weight:700}.sheet{max-width:180mm;margin:auto}.brand{padding-bottom:10px;border-bottom:2px solid #12395c}.brand small{display:block;color:#5f7382;font-weight:700}.brand h1{margin:5px 0 2px;color:#12395c;font-size:19pt}.meta{display:grid;grid-template-columns:1fr 1fr;margin-top:14px;border:1px solid #aebcc1;border-bottom:0}.cell{padding:8px;border-bottom:1px solid #aebcc1}.cell:nth-child(odd){border-right:1px solid #aebcc1}.cell.full{grid-column:1/-1;border-right:0!important}.label{display:block;margin-bottom:3px;color:#5f7382;font-size:8pt;font-weight:800;text-transform:uppercase}.section,.stage{margin-top:15px}.section h2,.stage h2{margin:0 0 8px;padding:7px 9px;background:#edf3f8;border-left:4px solid #12395c;color:#12395c;font-size:11.5pt}.stage h2{background:#e7f8f5;border-color:#126e65}.box,.content{padding:9px;border:1px solid #bdc9cd;break-inside:avoid}.content{margin:6px 0}.content small{display:block;color:#5f7382;font-weight:700;margin-bottom:2px}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.chips{display:flex;gap:5px;flex-wrap:wrap}.chip{padding:5px 7px;border-radius:999px;background:#e7f8f5;font-size:8.5pt;font-weight:700}@media print{.tools{display:none}.sheet{max-width:none}}@media(max-width:650px){.meta,.two{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}}</style></head><body><div class="tools"><button onclick="window.print()">Imprimir / Guardar PDF</button><button onclick="window.close()">Cerrar</button></div><main class="sheet"><header class="brand"><small>Escuela de Maestros · Secundaria Aprende · PCI</small><h1>${esc(title)}</h1><small>${esc(state.school||'Escuela')} · ${esc(state.active||'')}</small></header>${body}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);w.document.close()}
  function renderPrintContents(rows,title){return`<section class="section"><h2>${esc(title)}</h2>${rows.length?rows.map(c=>`<article class="content"><small>${esc(c.subject||'')}${c.axis?` · ${esc(c.axis)}`:''}</small><div>${esc(c.text||'')}</div></article>`).join(''):'<div class="box">Sin contenidos.</div>'}</section>`}
  function printGroup(gid){const g=group(gid);if(!g)return;const d=g.data,ms=api()?.members?.(g)||[],rows=(d.contents||[]).map(content).filter(Boolean),official=rows.filter(x=>x.component!=='CUSTOM'),own=rows.filter(x=>x.component==='CUSTOM'),specific=g.type==='laboratorio'?['Contexto problematizador',d.context]:g.type==='taller'?['Práctica / producción / producto / eje',d.practice]:null;printPopup(d.name||g.name,`<section class="meta"><div class="cell"><span class="label">Área</span><strong>${esc(g.area)}</strong></div><div class="cell"><span class="label">Tipo</span><strong>${esc(api()?.typeLabel?.(g.type)||g.type)}</strong></div><div class="cell"><span class="label">Ubicación temporal</span><strong>${esc(api()?.termText?.(g)||g.term)}</strong></div><div class="cell"><span class="label">Orientación</span><strong>${esc(state.active||'')}</strong></div><div class="cell full"><span class="label">Materias que integran el agrupamiento</span><div class="chips">${ms.length?ms.map(m=>`<span class="chip">${esc(m.name)}</span>`).join(''):'—'}</div></div></section><section class="section"><h2>Objetivos de aprendizaje</h2><div class="box">${d.objectives?br(d.objectives):'—'}</div></section>${specific?`<section class="section"><h2>${esc(specific[0])}</h2><div class="box">${specific[1]?br(specific[1]):'—'}</div></section>`:''}<section class="section"><h2>Sinopsis</h2><div class="box">${d.synopsis?br(d.synopsis):'—'}</div></section><section class="section"><h2>Puerta de entrada</h2><div class="box">${d.door?br(d.door):'—'}</div></section>${renderPrintContents(official,(state.active==='Agro y Ambiente'?'Contenidos del Diseño Curricular':'Contenidos priorizados'))}${renderPrintContents(own,'Contenidos propios del espacio')}`)}
  function printPlan(gid,n){const g=group(gid);if(!g)return;const p=plans(g)[n-1],rows=(p.contentIds||[]).map(content).filter(Boolean),official=rows.filter(x=>x.component!=='CUSTOM'),own=rows.filter(x=>x.component==='CUSTOM');printPopup(p.name||`Plan bimestral ${n}`,`<section class="meta"><div class="cell"><span class="label">Espacio</span><strong>${esc(g.data.name||g.name)}</strong></div><div class="cell"><span class="label">Tipo</span><strong>${esc(api()?.typeLabel?.(g.type)||g.type)}</strong></div><div class="cell"><span class="label">Duración</span><strong>1 bimestre</strong></div><div class="cell"><span class="label">Ubicación</span><strong>${esc(api()?.termText?.(g)||g.term)} · Plan ${n} de ${planCount(g)}</strong></div><div class="cell full"><span class="label">Sinopsis</span>${p.synopsis?br(p.synopsis):'—'}</div></section>${renderPrintContents(official,'Contenidos priorizados / oficiales')}${own.length?renderPrintContents(own,'Contenidos propios del espacio'):''}<section class="section"><h2>Objetivos de aprendizaje</h2><div class="box">${p.objectives?br(p.objectives):'—'}</div></section>${STAGES.map(([id,l])=>{const s=p.stages?.[id]||{};return`<section class="stage"><h2>${esc(l)}</h2>${s.description?`<div class="box"><span class="label">Presentación</span>${br(s.description)}</div>`:''}<div class="two" style="margin-top:8px"><div class="box"><span class="label">Duración</span>${s.duration?br(s.duration):'—'}</div><div class="box"><span class="label">Recursos</span>${s.resources?br(s.resources):'—'}</div></div><div class="box" style="margin-top:8px"><span class="label">Actividades dirigidas al estudiante</span>${s.activities?br(s.activities):'—'}</div></section>`}).join('')}`)}

  function enhanceGroups(){
    migrateCustoms();
    document.querySelectorAll('#proposal .v28-group[data-g]').forEach(card=>{
      const gid=card.dataset.g,g=group(gid);if(!g)return;
      card.querySelector('[data-v37-tools]')?.remove();
      card.querySelector('.v37-tools')?.remove();
      card.querySelector('.v38-own')?.remove();
      card.querySelector('.v38-actions')?.remove();
      const assigned=card.querySelector('.v28-assigned-wrap');if(!assigned)return;
      const own=groupCustoms(gid);
      const section=document.createElement('section');section.className='v38-own';section.innerHTML=`<div class="v38-own-head"><div><strong>Contenidos propios del espacio</strong><small>Desarrollo institucional, separado de los priorizados.</small></div><button class="v38-own-add" type="button">+ Agregar contenido</button></div><div class="v38-own-list">${own.length?own.map(c=>`<article class="v38-own-item"><small>${esc(c.subject||'')}${c.axis?` · ${esc(c.axis)}`:''}</small><p>${esc(c.text||'')}</p><div class="v38-own-actions"><button type="button" data-edit="${esc(c.id)}">Editar</button><button type="button" data-delete="${esc(c.id)}">Quitar</button></div></article>`).join(''):'<div class="v38-empty">Todavía no agregaste contenidos propios a este espacio.</div>'}</div>`;
      section.querySelector('.v38-own-add').onclick=e=>{e.stopPropagation();customEditor(gid)};
      section.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();customEditor(gid,b.dataset.edit)});
      section.querySelectorAll('[data-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteCustom(gid,b.dataset.delete)});
      assigned.insertAdjacentElement('afterend',section);
      const ps=plans(g),started=ps.filter(p=>planStatus(p)!=='Sin iniciar').length;
      const actions=document.createElement('div');actions.className='v38-actions';actions.innerHTML=`<button class="main" type="button" data-plans>Planes bimestrales (${ps.length}) · ${started} iniciados</button><button class="secondary" type="button" data-print>Imprimir agrupamiento</button>`;
      actions.querySelector('[data-plans]').onclick=e=>{e.stopPropagation();planList(gid)};actions.querySelector('[data-print]').onclick=e=>{e.stopPropagation();printGroup(gid)};section.insertAdjacentElement('afterend',actions);
    });
  }

  function start(){ensureStyles();modal();window.addEventListener('pci-phase2-groups-rendered',enhanceGroups);requestAnimationFrame(enhanceGroups)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
