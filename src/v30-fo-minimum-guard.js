(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);

  const style=document.createElement('style');
  style.textContent=`
    .drop.fo-incomplete{background:var(--danger-soft)!important;border-color:#d77f93!important}
    .fo-minimum-warning{display:block;margin-top:5px;padding:5px 6px;border-radius:6px;background:#fff;color:var(--danger);font-size:.47rem;line-height:1.25;font-weight:900}
  `;
  document.head.appendChild(style);

  const RULES={
    'foN4-c7':2,'foN4-c8':2,
    'foLab5-c9':2,'foLab5-c10':2,
    'foTaller5-c9':2,'foTaller5-c10':2
  };

  function count(slot){
    return [...new Set((current().placements?.[slot]||[]).filter(id=>byId(id)))].length;
  }

  function label(slot){
    const term=slot.match(/c(\d+)$/)?.[1]||'';
    if(slot.startsWith('foN4')) return `el espacio de Formación Orientada de C${term}`;
    if(slot.startsWith('foLab5')) return `el laboratorio de Formación Orientada de C${term}`;
    if(slot.startsWith('foTaller5')) return `el taller de Formación Orientada de C${term}`;
    return 'el espacio de Formación Orientada';
  }

  function incomplete(){
    return Object.entries(RULES).filter(([slot,min])=>count(slot)<min);
  }

  function showBlocked(message,resolution=''){
    const box=$id('validation');
    if(box){
      box.className='validation rule-block';
      box.innerHTML=`<strong>Acción no permitida</strong>${esc(message)}${resolution?`<br><span>${esc(resolution)}</span>`:''}`;
    }
    toast(message,true);
  }

  function decorate(){
    const matrix=$id('matrix');
    if(!matrix)return;
    for(const [slot,min] of Object.entries(RULES)){
      const drop=matrix.querySelector(`[data-slot="${slot}"]`);
      if(!drop)continue;
      drop.classList.remove('fo-incomplete');
      drop.querySelectorAll('.fo-minimum-warning').forEach(x=>x.remove());
      const c=count(slot);
      if(c<min){
        drop.classList.add('fo-incomplete');
        const warning=document.createElement('span');
        warning.className='fo-minimum-warning';
        warning.textContent=c===0?`Faltan ${min} materias para conformar este espacio.`:`Falta ${min-c} materia para alcanzar el mínimo de ${min}.`;
        drop.appendChild(warning);
      }
    }
    const btn=$id('validateBtn');
    if(btn){
      const bad=incomplete();
      btn.disabled=bad.length>0;
      btn.title=bad.length?'Completá todos los laboratorios/talleres FO de Nivel 4 y 5 con al menos dos materias.':'';
    }
  }

  // Refuerzo del cierre: aunque otro parche habilite el botón, nunca valida con FO incompleta.
  const previousValidate=validateOffer;
  validateOffer=function(){
    const bad=incomplete();
    if(bad.length){
      const [slot,min]=bad[0],c=count(slot);
      showBlocked(`${label(slot)} no puede quedar con ${c} materia${c===1?'':'s'}. En Nivel 4 y Nivel 5 se requieren al menos ${min}.`,'Agregá otra materia del mismo año. La excepción de una sola materia corresponde únicamente a Nivel 3.');
      decorate();
      return;
    }
    return previousValidate();
  };

  // Evita que una eliminación deje un espacio que ya estaba válidamente conformado en 1 materia.
  function bindRemovalGuard(){
    const matrix=$id('matrix');
    if(!matrix||matrix.__v30RemovalGuard)return;
    matrix.__v30RemovalGuard=true;
    matrix.addEventListener('click',e=>{
      const button=e.target.closest('button[data-rm][data-slot]');
      if(!button)return;
      const slot=button.dataset.slot,min=RULES[slot];
      if(!min)return;
      const before=count(slot);
      if(before<=min){
        e.preventDefault();
        e.stopImmediatePropagation();
        showBlocked(`No se puede quitar esta materia porque ${label(slot)} quedaría por debajo del mínimo de ${min} materias.`,'Primero reorganizá el espacio agregando otra materia compatible.');
      }
    },true);
  }

  const previousRender=renderOffer;
  renderOffer=function(){
    previousRender();
    decorate();
    bindRemovalGuard();
  };
})();
