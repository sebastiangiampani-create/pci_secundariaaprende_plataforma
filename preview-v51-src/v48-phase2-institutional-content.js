(() => {
  const api=()=>window.PCIPhase2V28||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const p2=()=>{const m=ensure(state.active);m.phase2V28=m.phase2V28||{groups:{}};m.phase2V28.customContents=Array.isArray(m.phase2V28.customContents)?m.phase2V28.customContents:[];return m.phase2V28};
  const rows=()=>p2().customContents;
  const group=id=>api()?.gb?.(id)||null;
  const persist=()=>{try{api()?.save?.()}catch(_){try{save()}catch(_){}}};
  const uid=()=>`custom:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;

  const style=document.createElement('style');style.textContent=`
    .v48-inst-content{margin-top:12px;padding:13px;border:1px solid #d8d0ed;border-radius:13px;background:#faf8ff}
    .v48-inst-block+.v48-inst-block{margin-top:12px;padding-top:12px;border-top:1px solid #e3ddf0}
    .v48-inst-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v48-inst-head h4{margin:0;font-size:.82rem;color:#4f3c78}.v48-inst-head small{display:block;margin-top:3px;color:#6d6381;font-size:.64rem;line-height:1.35;max-width:620px}
    .v48-inst-add{border:1px solid #745aa5;border-radius:999px;background:#fff;color:#5c458b;padding:7px 10px;font-size:.66rem;font-weight:900;white-space:nowrap}
    .v48-inst-list{display:grid;gap:7px;margin-top:9px}.v48-inst-item{position:relative;padding:9px 78px 9px 10px;border:1px solid #e0d9ed;border-left:3px solid #745aa5;border-radius:10px;background:#fff}.v48-inst-item p{margin:0;font-size:.82rem;line-height:1.4}.v48-inst-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px}.v48-inst-actions button{border:0;border-radius:999px;background:#f1edf8;color:#4f3c78;padding:5px 7px;font-size:.57rem;font-weight:850}
    .v48-inst-empty{padding:9px 10px;border:1px dashed #d8d0e5;border-radius:10px;color:#786f89;font-size:.7rem;background:#fff}
    .v48-inst-modal{position:fixed;inset:0;z-index:2800;display:grid;place-items:center;padding:16px;background:rgba(18,57,92,.4)}.v48-inst-modal[hidden]{display:none}.v48-inst-shell{width:min(680px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(18,57,92,.2)}
    .v48-inst-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #e2e9ec}.v48-inst-top h2{margin:3px 0 0;font-size:1.15rem}.v48-inst-body{padding:18px}.v48-inst-note{padding:10px 12px;border-radius:10px;background:#faf8ff;color:#5c4b76;font-size:.76rem;line-height:1.4;margin-bottom:12px}.v48-inst-field{display:grid;gap:6px}.v48-inst-field span{font-size:.75rem;font-weight:900}.v48-inst-field textarea{width:100%;min-height:140px;padding:11px;border:1px solid #d8e1e8;border-radius:10px;font:inherit;resize:vertical}.v48-inst-footer{display:flex;justify-content:space-between;gap:8px;margin-top:14px;flex-wrap:wrap}
  `;document.head.appendChild(style);

  function modal(){let m=document.getElementById('v48InstContentModal');if(m)return m;m=document.createElement('div');m.id='v48InstContentModal';m.className='v48-inst-modal';m.hidden=true;m.innerHTML='<section id="v48InstContentShell" class="v48-inst-shell" role="dialog" aria-modal="true"></section>';document.body.appendChild(m);m.onclick=e=>{if(e.target===m)m.hidden=true};return m}
  const close=()=>{const m=document.getElementById('v48InstContentModal');if(m)m.hidden=true};
  function manualRows(gid,subjectId){return rows().filter(x=>x.groupId===gid&&x.sourceSubjectId===subjectId)}
  function legacyRows(gid){const g=group(gid);return rows().filter(x=>x.groupId===gid&&!x.sourceSubjectId&&(g?.data?.contents||[]).includes(x.id))}

  function editor(gid,subject,id=null){
    const g=group(gid);if(!g||!subject)return;const old=id?rows().find(x=>x.id===id&&x.groupId===gid):null,m=modal(),shell=document.getElementById('v48InstContentShell');
    shell.innerHTML=`<div class="v48-inst-top"><div><div class="v28-eye">Materia institucional</div><h2>${old?'Editar contenido':'Agregar contenido'} · ${esc(subject.name)}</h2></div><button class="v28-btn secondary small" type="button" data-close>Cerrar</button></div><div class="v48-inst-body"><div class="v48-inst-note">${esc(subject.name)} fue incorporada por la institución en Fase 1. Sus contenidos no provienen de una bolsa oficial y deben cargarse manualmente.</div><form id="v48InstContentForm"><label class="v48-inst-field"><span>Contenido</span><textarea name="text" required>${esc(old?.text||'')}</textarea></label><div class="v48-inst-footer"><div>${old?'<button class="v28-btn secondary" type="button" data-delete>Eliminar</button>':''}</div><button class="v28-btn primary" type="submit">${old?'Guardar cambios':'Agregar contenido'}</button></div></form></div>`;
    m.hidden=false;shell.querySelector('[data-close]').onclick=close;
    shell.querySelector('[data-delete]')?.addEventListener('click',()=>remove(gid,old.id));
    shell.querySelector('#v48InstContentForm').onsubmit=e=>{e.preventDefault();const text=String(new FormData(e.currentTarget).get('text')||'').trim();if(!text)return;const gd=g.data,row=old||{id:uid(),component:'CUSTOM',createdAt:new Date().toISOString()};row.groupId=gid;row.area=g.area;row.sourceSubjectId=subject.id;row.subject=subject.name;row.axis='';row.text=text;if(!old)rows().push(row);gd.contents=Array.isArray(gd.contents)?gd.contents:[];if(!gd.contents.includes(row.id))gd.contents.push(row.id);persist();close();api()?.renderGroups?.()};
  }
  function editLegacy(gid,id){const old=rows().find(x=>x.id===id&&x.groupId===gid);if(!old)return;const text=prompt('Contenido:',old.text||'');if(text===null)return;const clean=String(text).trim();if(!clean)return;old.text=clean;old.axis='';persist();api()?.renderGroups?.()}
  function remove(gid,id){
    const i=rows().findIndex(x=>x.id===id);if(i>=0)rows().splice(i,1);const g=group(gid);if(g){g.data.contents=(g.data.contents||[]).filter(x=>x!==id);(g.data.plansBimestrales||[]).forEach(p=>p.contentIds=(p.contentIds||[]).filter(x=>x!==id))}persist();close();api()?.renderGroups?.();
  }

  function refresh(){
    document.querySelectorAll('#proposal .v28-group[data-g]').forEach(card=>{
      const gid=card.dataset.g,g=group(gid);if(!g)return;const institutional=(api()?.members?.(g)||[]).filter(s=>s.origin==='CUSTOM');
      card.querySelector('.v48-inst-content')?.remove();
      if(!institutional.length)return;
      const legacy=legacyRows(gid);
      if(institutional.length===1&&legacy.length){legacy.forEach(row=>{row.sourceSubjectId=institutional[0].id;row.subject=institutional[0].name;row.axis='' });persist()}
      card.querySelector('.v38-own')?.remove();
      const assigned=card.querySelector('.v28-assigned-wrap');if(!assigned)return;
      const section=document.createElement('section');section.className='v48-inst-content';
      const blocks=institutional.map(s=>{const own=manualRows(gid,s.id);return`<div class="v48-inst-block" data-subject="${esc(s.id)}"><div class="v48-inst-head"><div><h4>${esc(s.name)} · contenido institucional</h4><small>Este espacio incluye una materia incorporada por la institución. Sus contenidos deben ser agregados manualmente.</small></div><button class="v48-inst-add" type="button">+ Agregar contenido</button></div><div class="v48-inst-list">${own.length?own.map(c=>`<article class="v48-inst-item"><p>${esc(c.text)}</p><div class="v48-inst-actions"><button type="button" data-edit="${esc(c.id)}">Editar</button><button type="button" data-delete="${esc(c.id)}">Quitar</button></div></article>`).join(''):'<div class="v48-inst-empty">Todavía no hay contenidos cargados manualmente para esta materia.</div>'}</div></div>`}).join('');
      const remaining=legacyRows(gid);const legacyBlock=remaining.length?`<div class="v48-inst-block" data-legacy><div class="v48-inst-head"><div><h4>Contenidos propios previos</h4><small>Se conservan contenidos cargados antes de V48. No se eliminan ni afectan la cobertura oficial.</small></div></div><div class="v48-inst-list">${remaining.map(c=>`<article class="v48-inst-item"><p>${esc(c.text)}</p><div class="v48-inst-actions"><button type="button" data-legacy-edit="${esc(c.id)}">Editar</button><button type="button" data-delete="${esc(c.id)}">Quitar</button></div></article>`).join('')}</div></div>`:'';
      section.innerHTML=blocks+legacyBlock;
      section.querySelectorAll('.v48-inst-block[data-subject]').forEach(block=>{const subject=institutional.find(s=>s.id===block.dataset.subject);block.querySelector('.v48-inst-add').onclick=e=>{e.stopPropagation();editor(gid,subject)};block.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();editor(gid,subject,b.dataset.edit)})});
      section.querySelectorAll('[data-legacy-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();editLegacy(gid,b.dataset.legacyEdit)});
      section.querySelectorAll('[data-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();remove(gid,b.dataset.delete)});
      assigned.insertAdjacentElement('afterend',section);
    });
  }
  window.addEventListener('pci-phase2-groups-rendered',refresh);
  window.addEventListener('pci-app-ready',()=>setTimeout(refresh,0));
})();
