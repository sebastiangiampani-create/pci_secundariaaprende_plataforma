(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);

  const style=document.createElement('style');
  style.textContent=`
    .teacher-control{display:flex;align-items:center;gap:5px;margin-top:5px;min-width:0}
    .teacher-label{font-size:.47rem;color:var(--muted);font-weight:800;white-space:nowrap}
    .teacher-button{min-width:0;max-width:100%;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:7px;padding:4px 6px;font:700 .48rem/1.2 Archivo,Arial,sans-serif;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
    .teacher-button.assigned{background:var(--mint-soft);border-color:#9edfd7;color:var(--mint-dark)}
    .teacher-note{font-size:.54rem;color:var(--muted);line-height:1.35;margin:6px 0 2px}
    #teacherDialog{border:0;border-radius:16px;padding:0;max-width:min(92vw,460px);width:100%;box-shadow:0 22px 70px rgba(18,57,92,.28);color:var(--ink)}
    #teacherDialog::backdrop{background:rgba(18,57,92,.32)}
    .teacher-dialog-box{padding:20px}
    .teacher-dialog-box h3{margin:0 0 4px;font-size:1rem}
    .teacher-dialog-box p{margin:0 0 14px;color:var(--muted);font-size:.78rem;line-height:1.4}
    .teacher-dialog-box label{display:block;font-size:.7rem;font-weight:900;margin-bottom:6px}
    .teacher-dialog-box input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:10px 11px;font:inherit;color:var(--ink);background:#fff}
    .teacher-dialog-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
    .teacher-dialog-actions button{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:#fff;color:var(--ink);font-weight:900;cursor:pointer}
    .teacher-dialog-actions .save-teacher{background:var(--ink);border-color:var(--ink);color:#fff}
  `;
  document.head.appendChild(style);

  function ensureTeachers(){
    const m=current();
    m.teachers=m.teachers||{};
    return m.teachers;
  }

  function teacherFor(id){
    return String(ensureTeachers()[id]||'').trim();
  }

  function setTeacher(id,value){
    const teachers=ensureTeachers();
    const clean=String(value||'').trim();
    if(clean)teachers[id]=clean;
    else delete teachers[id];
    save();
  }

  function subjectLabel(id){
    const s=byId(id);
    return s?`${s.name} · ${s.year}.º`:id;
  }

  function ensureDialog(){
    let dialog=$id('teacherDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='teacherDialog';
    dialog.innerHTML=`
      <form method="dialog" class="teacher-dialog-box">
        <h3>Asignar docente</h3>
        <p id="teacherSubjectName"></p>
        <label for="teacherInput">Docente</label>
        <input id="teacherInput" type="text" autocomplete="off" placeholder="Nombre y apellido">
        <div class="teacher-note">La asignación docente es opcional en el Mapa de la Oferta y no interviene en su validación.</div>
        <div class="teacher-dialog-actions">
          <button type="button" id="clearTeacher">Quitar docente</button>
          <button type="button" id="cancelTeacher">Cancelar</button>
          <button type="button" class="save-teacher" id="saveTeacher">Guardar</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    $id('cancelTeacher').onclick=()=>dialog.close();
    return dialog;
  }

  function openTeacherEditor(id){
    const dialog=ensureDialog();
    const input=$id('teacherInput');
    $id('teacherSubjectName').textContent=subjectLabel(id);
    input.value=teacherFor(id);
    $id('saveTeacher').onclick=()=>{
      setTeacher(id,input.value);
      dialog.close();
      renderOffer();
      toast(input.value.trim()?'Docente asignado a la materia.':'Materia sin docente asignado.');
    };
    $id('clearTeacher').onclick=()=>{
      setTeacher(id,'');
      dialog.close();
      renderOffer();
      toast('Se quitó la asignación docente.');
    };
    if(typeof dialog.showModal==='function'){
      dialog.showModal();
      setTimeout(()=>input.focus(),0);
    }else{
      const value=window.prompt(`Docente para ${subjectLabel(id)} (opcional):`,teacherFor(id));
      if(value!==null){setTeacher(id,value);renderOffer();}
    }
  }

  function controlHtml(id){
    const teacher=teacherFor(id);
    return `<div class="teacher-control"><span class="teacher-label">Docente:</span><button type="button" draggable="false" class="teacher-button ${teacher?'assigned':''}" data-teacher-id="${esc(id)}" title="${teacher?esc(teacher):'Asignación opcional'}">${teacher?esc(teacher):'Sin asignar'}</button></div>`;
  }

  function decorateBagTeachers(){
    const box=$id('bagContent');
    if(!box)return;
    box.querySelectorAll('.subject[data-sub]').forEach(card=>{
      const id=card.dataset.sub;
      if(!id||card.querySelector('.teacher-control'))return;
      const content=card.children[1];
      if(content)content.insertAdjacentHTML('beforeend',controlHtml(id));
    });
    bindTeacherButtons(box);
  }

  function decorateMatrixTeachers(){
    const matrix=$id('matrix');
    if(!matrix)return;
    matrix.querySelectorAll('.placed[data-map-id]').forEach(card=>{
      const id=card.dataset.mapId;
      if(!id||card.querySelector('.teacher-control'))return;
      card.insertAdjacentHTML('beforeend',controlHtml(id));
    });
    bindTeacherButtons(matrix);
  }

  function bindTeacherButtons(root){
    root.querySelectorAll('[data-teacher-id]').forEach(button=>{
      button.onpointerdown=e=>e.stopPropagation();
      button.ondragstart=e=>{e.preventDefault();e.stopPropagation()};
      button.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        openTeacherEditor(button.dataset.teacherId);
      };
    });
  }

  const previousRenderBag=renderBag;
  renderBag=function(){
    ensureTeachers();
    previousRenderBag();
    decorateBagTeachers();
  };

  const previousRenderMatrix=renderMatrix;
  renderMatrix=function(){
    ensureTeachers();
    previousRenderMatrix();
    decorateMatrixTeachers();
  };

  const previousRenderOffer=renderOffer;
  renderOffer=function(){
    ensureTeachers();
    previousRenderOffer();
    const validation=$id('validation');
    if(validation && !validation.querySelector('.teacher-note')){
      const note=document.createElement('div');
      note.className='teacher-note';
      note.textContent='Docentes: asignación opcional. Una materia sin docente no impide validar el Mapa de la Oferta.';
      validation.insertAdjacentElement('afterend',note);
    }
  };

  const modal=$id('rulesModal');
  if(modal){
    const rule=document.createElement('div');
    rule.className='rule';
    rule.innerHTML='<strong>Asignación docente:</strong> se realiza sobre cada materia y es opcional en Fase 1. La materia conserva su docente cuando se mueve o se replica entre cuatrimestres. La falta de docente no bloquea la validación del Mapa de la Oferta.';
    modal.querySelector('.modal-box')?.appendChild(rule);
  }
})();
