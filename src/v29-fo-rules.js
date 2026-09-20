(() => {
  // V40 oculta el acceso visual a Reglas, pero el init base todavía enlaza
  // el evento sobre #rulesBtn. Si el nodo no existe, init() se corta y Fase 2
  // no termina de montar. Conservamos un ancla oculta para compatibilidad.
  let rulesBtn=document.getElementById('rulesBtn');
  if(!rulesBtn){
    rulesBtn=document.createElement('button');
    rulesBtn.id='rulesBtn';
    rulesBtn.type='button';
    rulesBtn.hidden=true;
    rulesBtn.setAttribute('aria-hidden','true');
    rulesBtn.style.display='none';
    const printBtn=document.getElementById('printBtn');
    if(printBtn?.parentElement) printBtn.parentElement.insertBefore(rulesBtn,printBtn);
    else document.body.prepend(rulesBtn);
  }else{
    rulesBtn.hidden=true;
    rulesBtn.setAttribute('aria-hidden','true');
    rulesBtn.style.display='none';
  }

  const modal=document.getElementById('rulesModal');
  if(!modal)return;
  const box=modal.querySelector('.modal-box');
  if(!box)return;

  const rules=[...box.querySelectorAll('.rule')];
  const existing=rules.find(r=>/Formación Orientada:/i.test(r.textContent||''));
  const html=`<strong>Formación Orientada · composición mínima:</strong> los laboratorios y talleres de FO deben estar conformados por al menos <strong>dos asignaturas / espacios curriculares del mismo año</strong>. La única excepción general es <strong>Nivel 3</strong>, donde un laboratorio o un taller puede quedar conformado por una sola asignatura. En Nivel 4 y Nivel 5, una sola asignatura no alcanza para conformar válidamente el espacio. Si una articulación o un movimiento deja un laboratorio/taller FO por debajo de ese mínimo, el sistema debe impedirlo y explicar el motivo.`;

  if(existing)existing.innerHTML=html;
  else{
    const rule=document.createElement('div');
    rule.className='rule';
    rule.innerHTML=html;
    box.appendChild(rule);
  }
})();
