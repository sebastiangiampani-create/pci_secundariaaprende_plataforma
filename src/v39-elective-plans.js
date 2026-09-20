(() => {
  const api=()=>window.PCIPhase2V28||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STAGES=[['punto_partida','Punto de partida'],['indagacion','Indagación'],['produccion','Producción'],['evaluacion','Evaluación']];
  const group=id=>api()?.gb?.(id)||null;
  const persist=()=>{try{api()?.save?.()}catch(_){try{save()}catch(_){}}};
  const blankStage=()=>({description:'',duration:'',resources:'',activities:''});

  function styles(){if(document.getElementById('v39styles'))return;const s=document.createElement('style');s.id='v39styles';s.textContent=`
    .v39-modal{position:fixed;inset:0;z-index:2600;display:grid;place-items:center;padding:16px;background:rgba(18,57,92,.4)}.v39-modal[hidden]{display:none}
    .v39-shell{width:min(1100px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:1px solid #d8e1e8;border-radius:18px;box-shadow:0 20px 60px rgba(18,57,92,.2)}
    .v39-top{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #e2e9ec;background:#fff}.v39-top h2{margin:3px 0 0;font-size:1.2rem}
    .v39-body{padding:18px}.v39-note{padding:10px 12px;border-radius:10px;background:#fff7df;color:#735515;font-size:.78rem;line-height:1.4}
    .v39-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v39-card,.v39-section{padding:14px;border:1px solid #d8e1e8;border-radius:14px;background:#fff}.v39-card h3,.v39-section h3{margin:7px 0 10px}.v39-status{display:inline-flex;padding:4px 8px;border-radius:999px;background:#fff4d8;color:#805700;font-size:.68rem;font-weight:900}
    .v39-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v39-option{padding:14px;border:1px solid #d8e1e8;border-radius:14px;background:#fbfdfd}.v39-option h3{margin:0 0 10px;color:#12395c}.v39-chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e7f8f5;color:#126e65;font-size:.66rem;font-weight:900;margin-bottom:8px}
    .v39-fields{display:grid;gap:10px}.v39-field{display:grid;gap:5px}.v39-field span{font-size:.75rem;font-weight:900;color:#12395c}.v39-field input,.v39-field textarea{width:100%;padding:10px 11px;border:1px solid #d8e1e8;border-radius:10px;font:inherit;color:#12395c;background:#fff}.v39-field textarea{min-height:88px;resize:vertical}.v39-field textarea.activities{min-height:150px}
    .v39-stage{border:1px solid #d8e1e8;border-radius:12px;overflow:hidden;margin-top:9px}.v39-stage summary{padding:11px 13px;background:#f1f8f7;font-weight:900;cursor:pointer}.v39-stage-body{display:grid;gap:9px;padding:12px}
    .v39-shared{margin-bottom:12px;padding:13px;border:1px solid #bfe3dc;border-radius:13px;background:#f5fbfa}.v39-shared h3{margin:0 0 8px}.v39-pick{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:8px;border:1px solid #d8e1e8;border-radius:9px;background:#fff;margin-top:6px}.v39-pick small{display:block;color:#5f7382;margin-bottom:2px}.v39-pick p{margin:0;font-size:.82rem;line-height:1.35}
    .v39-footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:14px}.v39-btn{min-height:36px;padding:8px 12px;border-radius:999px;font-weight:850;border:1px solid #cbd8dc;background:#fff;color:#12395c}.v39-btn.primary{border-color:#12395c;background:#12395c;color:#fff}.v39-btn.accent{border-color:#126e65;background:#e7f8f5;color:#126e65}
    @media(max-width:820px){.v39-options,.v39-grid{grid-template-columns:1fr}.v39-modal{padding:6px;align-items:end}.v39-shell{max-height:95vh;border-radius:16px 16px 7px 7px}.v39-body,.v39-top{padding:13px}}
  `;document.head.appendChild(s)}

  function modal(){styles();let m=document.getElementById('v39modal');if(m)return m;m=document.createElement('div');m.id='v39modal';m.className='v39-modal';m.hidden=true;m.innerHTML='<section id="v39shell" class="v39-shell" role="dialog" aria-modal="true"></section>';document.body.appendChild(m);m.onclick=e=>{if(e.target===m)m.hidden=true};return m}
  function open(html){const m=modal();document.getElementById('v39shell').innerHTML=html;m.hidden=false}
  function close(){const m=document.getElementById('v39modal');if(m)m.hidden=true}
  const shell=()=>document.getElementById('v39shell');

  function removeObsoleteFields(){
    document.querySelectorAll('#proposal .v28-group[data-g]').forEach(card=>{
      card.querySelectorAll('.v28-field').forEach(label=>{
        const t=label.querySelector(':scope > span')?.textContent?.trim()||'';
        if(/^Puerta de entrada/i.test(t)||/^Planes\s*\/\s*proyectos/i.test(t))label.remove();
      });
    });
  }

  function ensureElectivePlans(g){
    const gd=g.data;const count=String(g.term||'').includes('-')?4:2;
    gd.plansBimestrales=Array.isArray(gd.plansBimestrales)?gd.plansBimestrales:[];
    for(let i=0;i<count;i++){
      const p=gd.plansBimestrales[i]||{};p.number=i+1;p.contentIds=Array.isArray(p.contentIds)?p.contentIds.map(String):[];p.objectives=p.objectives||'';
      p.elective=p.elective||{};
      for(const key of ['A','B']){
        const src=key==='A'?gd:(gd.twin||{}),opt=p.elective[key]||{};opt.name=opt.name||`${src.name||gd.name||g.name} · Plan ${i+1}`;opt.synopsis=opt.synopsis||'';opt.stages=opt.stages||{};STAGES.forEach(([id])=>opt.stages[id]={...blankStage(),...(opt.stages[id]||{})});p.elective[key]=opt;
      }
      gd.plansBimestrales[i]=p;
    }
    if(gd.plansBimestrales.length>count)gd.plansBimestrales.length=count;
    return gd.plansBimestrales;
  }

  function status(p){const options=['A','B'].map(k=>p.elective?.[k]||{});const has=!!(p.objectives||(p.contentIds||[]).length||options.some(o=>o.name||o.synopsis||STAGES.some(([id])=>{const s=o.stages?.[id]||{};return s.description||s.duration||s.resources||s.activities})));if(!has)return'Sin iniciar';const complete=String(p.objectives||'').trim()&&(p.contentIds||[]).length&&options.every(o=>STAGES.every(([id])=>String(o.stages?.[id]?.activities||'').trim()));return complete?'Completo':'En elaboración'}

  function contentRows(g,p){const rows=(g.data.contents||[]).map(id=>api()?.findContent?.(id)).filter(Boolean);return rows.length?rows.map(c=>`<label class="v39-pick"><input type="checkbox" data-content="${esc(c.id)}" ${(p.contentIds||[]).includes(String(c.id))?'checked':''}><span><small>${esc(c.component==='CUSTOM'?'Propio · ':c.component+' · ')}${esc(c.subject||'')}${c.axis?` · ${esc(c.axis)}`:''}</small><p>${esc(c.text||'')}</p></span></label>`).join(''):'<div class="v39-note">Este agrupamiento todavía no tiene contenidos asignados.</div>'}
  function stageEditor(option,id,label,s){return`<details class="v39-stage"><summary>${esc(label)}</summary><div class="v39-stage-body"><label class="v39-field"><span>Presentación <small>(opcional)</small></span><textarea data-opt="${option}" data-stage="${id}" data-sfield="description">${esc(s.description)}</textarea></label><label class="v39-field"><span>Duración</span><input data-opt="${option}" data-stage="${id}" data-sfield="duration" value="${esc(s.duration)}"></label><label class="v39-field"><span>Recursos</span><textarea data-opt="${option}" data-stage="${id}" data-sfield="resources">${esc(s.resources)}</textarea></label><label class="v39-field"><span>Actividades dirigidas al estudiante</span><textarea class="activities" data-opt="${option}" data-stage="${id}" data-sfield="activities">${esc(s.activities)}</textarea></label></div></details>`}

  function planList(gid){const g=group(gid);if(!g||!g.data.elective)return;const ps=ensureElectivePlans(g);persist();open(`<div class="v39-top"><div><div class="v28-eye">Propuesta electiva A/B</div><h2>Planes bimestrales · ${esc(g.data.name||g.name)}</h2></div><button class="v39-btn" data-close>Cerrar</button></div><div class="v39-body"><div class="v39-note"><strong>Electividad A/B:</strong> cada bimestre desarrolla las dos opciones. Objetivos y contenidos son compartidos; el desarrollo pedagógico de A y B se completa por separado.</div><div class="v39-grid" style="margin-top:12px">${ps.map(p=>`<article class="v39-card"><span class="v39-status">Electivo A/B · ${esc(status(p))}</span><h3>Plan ${p.number}</h3><p style="margin:0;color:#5f7382">Opción A: ${esc(p.elective.A.name)}<br>Opción B: ${esc(p.elective.B.name)}</p><button class="v39-btn accent" style="margin-top:10px" data-open="${p.number}">Abrir plan</button></article>`).join('')}</div></div>`);const s=shell();s.querySelector('[data-close]').onclick=close;s.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>planEditor(gid,+b.dataset.open))}

  function planEditor(gid,n){const g=group(gid);if(!g)return;const ps=ensureElectivePlans(g),p=ps[n-1],labels={A:g.data.name||g.name,B:g.data.twin?.name||`${g.data.name||g.name} · Opción B`};open(`<div class="v39-top"><div><div class="v28-eye">Plan ${n} · Propuesta electiva</div><h2>${esc(g.data.name||g.name)} · A/B</h2></div><button class="v39-btn" data-close>Cerrar</button></div><div class="v39-body"><form id="v39form"><section class="v39-shared"><h3>Compartido por las dos opciones</h3><label class="v39-field"><span>Objetivos de aprendizaje</span><textarea data-objectives>${esc(p.objectives||'')}</textarea></label><div style="margin-top:10px"><strong style="font-size:.75rem">Contenidos del plan</strong>${contentRows(g,p)}</div></section><div class="v39-options">${['A','B'].map(k=>{const o=p.elective[k];return`<section class="v39-option"><span class="v39-chip">Opción ${k}</span><h3>${esc(labels[k])}</h3><div class="v39-fields"><label class="v39-field"><span>Nombre del plan</span><input data-opt="${k}" data-ofield="name" value="${esc(o.name)}"></label><label class="v39-field"><span>Sinopsis</span><textarea data-opt="${k}" data-ofield="synopsis">${esc(o.synopsis)}</textarea></label></div><div style="margin-top:10px">${STAGES.map(([id,l])=>stageEditor(k,id,l,o.stages[id])).join('')}</div></section>`}).join('')}</div><div class="v39-footer"><button type="button" class="v39-btn" data-back>← Planes</button><button type="submit" class="v39-btn primary">Guardar plan electivo</button></div></form></div>`);const s=shell();s.querySelector('[data-close]').onclick=close;s.querySelector('[data-back]').onclick=()=>{savePlan(p);planList(gid)};s.querySelector('#v39form').onsubmit=e=>{e.preventDefault();savePlan(p);planList(gid)}}

  function savePlan(p){const f=shell()?.querySelector('#v39form');if(!f)return;p.objectives=f.querySelector('[data-objectives]')?.value||'';p.contentIds=[...f.querySelectorAll('[data-content]:checked')].map(x=>String(x.dataset.content));f.querySelectorAll('[data-opt][data-ofield]').forEach(x=>p.elective[x.dataset.opt][x.dataset.ofield]=x.value);f.querySelectorAll('[data-opt][data-stage][data-sfield]').forEach(x=>{const o=p.elective[x.dataset.opt],id=x.dataset.stage;o.stages[id]=o.stages[id]||blankStage();o.stages[id][x.dataset.sfield]=x.value});p.updatedAt=new Date().toISOString();persist()}

  function interceptPlans(){document.addEventListener('click',e=>{const b=e.target.closest('#proposal .v38-actions [data-plans]');if(!b)return;const card=b.closest('.v28-group[data-g]'),g=card?group(card.dataset.g):null;if(!g?.data?.elective)return;e.preventDefault();e.stopImmediatePropagation();planList(card.dataset.g)},true)}

  function refresh(){removeObsoleteFields();document.querySelectorAll('#proposal .v28-group[data-g]').forEach(card=>{const g=group(card.dataset.g);if(!g?.data?.elective)return;const planButton=card.querySelector('.v38-actions [data-plans]');if(planButton)planButton.textContent=`Planes bimestrales (${ensureElectivePlans(g).length}) · Electivo A/B`;const badge=card.querySelector('.v28-pill.e');if(badge)badge.textContent='Electivo · Opción A / B'})}

  function start(){styles();modal();interceptPlans();window.addEventListener('pci-phase2-groups-rendered',refresh);requestAnimationFrame(refresh)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
