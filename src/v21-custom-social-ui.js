(() => {
  const $id=id=>document.getElementById(id);
  const current=()=>ensure(state.active);

  const style=document.createElement('style');
  style.textContent=`
    #compositionPalette{display:none!important}
    .rowlabel.has-social-choice{display:block}
    .social-choice{margin-top:7px;padding-top:7px;border-top:1px solid rgba(18,57,92,.15)}
    .social-choice-title{font-size:.55rem;line-height:1.25;color:var(--muted);margin-bottom:5px}
    .social-choice-chip{display:block;width:100%;margin:5px 0;padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font-size:.58rem;font-weight:900;line-height:1.3;cursor:pointer;text-align:left}
    .social-choice-chip.active{background:var(--mint-soft);border-color:var(--mint-dark);color:var(--mint-dark)}
    .social-choice-chip:active{transform:translateY(1px)}
    .social-cell-note{display:block;margin:5px 0 4px;padding:5px 6px;border-radius:7px;background:var(--mint-soft);color:var(--mint-dark);font-size:.46rem;font-weight:900;line-height:1.2}
    .social-cell-note small{display:block;color:var(--muted);font-size:.43rem;font-weight:700;margin-top:2px}
  `;
  document.head.appendChild(style);

  function block(message,resolution=''){
    const box=$id('validation');
    if(box){box.className='validation rule-block';box.innerHTML='<strong>Acción no permitida</strong>'+esc(message)+(resolution?'<br><span>'+esc(resolution)+'</span>':'')}
    toast(message,true);
  }

  function socialOption(){const m=current();if(!['A','B'].includes(m.socialOption))m.socialOption='A';return m.socialOption}
  function socialOccupied(){return ['socialA-c5','socialA-c6','socialB-c5','socialB-c6'].some(slot=>(current().placements[slot]||[]).length>0)}

  function chooseSocial(option){
    if(!['A','B'].includes(option)||option===socialOption())return;
    if(socialOccupied()){
      block('No se puede cambiar la organización de Ciencias Sociales de 3.º con materias ya ubicadas.','Retirá primero las materias de los laboratorios de Sociales de Nivel 3 y luego cambiá la opción.');
      return;
    }
    current().socialOption=option;current().valid=false;save();renderOffer();
    toast(option==='A'?'Opción: 10 laboratorios de Sociales en toda la secundaria. En 3.º: 1 por cuatrimestre, con las 4 materias juntas.':'Opción: 12 laboratorios de Sociales en toda la secundaria. En 3.º: 2 por cuatrimestre, agrupados 2 + 2.');
  }

  // Una materia agregada por la escuela puede articular con cualquier espacio curricular
  // del mismo año. No queda reservada a “Otros formatos pedagógicos”.
  const previousValidTarget=validTarget;
  validTarget=function(slot,s){
    if(s&&s.origin==='CUSTOM'){
      let m=slot.match(/-n(\d+)$/);
      if(m){const year=Number(m[1]);return s.year===year?[true,'']:[false,`No se puede articular ${s.name} de ${s.year}.º con un espacio de ${year}.º.`]}
      m=slot.match(/-c(\d+)$/);
      if(m){
        const term=Number(m[1]),year=Math.ceil(term/2);
        if(s.year!==year)return[false,`No se puede articular ${s.name} de ${s.year}.º con C${term}, que corresponde a ${year}.º.`];
        const key=slot.replace(/-c\d+$/,'');
        const row=rowDefs().find(r=>r.k===key);
        if(!row||(row.a&&!row.a(term)))return[false,'Ese espacio no está habilitado en este cuatrimestre.'];
        return[true,''];
      }
    }
    return previousValidTarget(slot,s);
  };

  // La matriz de Sociales queda limpia: una fila base y, solo con Opción B,
  // una segunda fila visible exclusivamente en C5/C6.
  const previousRowDefs=rowDefs;
  rowDefs=function(){
    return previousRowDefs().filter(r=>r.k!=='socialConfig').map(r=>{
      if(r.k==='socialA')return{...r,l:'Ciencias Sociales'};
      if(r.k==='socialB')return{...r,l:'↳ Segundo laboratorio · Nivel 3'};
      return r;
    });
  };

  function decorateSocial(){
    const matrix=$id('matrix');if(!matrix)return;
    const opt=socialOption();
    const c5=matrix.querySelector('[data-slot="socialA-c5"]');
    const baseRow=c5?.closest('.grid');
    const rowLabel=baseRow?.querySelector('.rowlabel');
    if(rowLabel){
      rowLabel.classList.add('has-social-choice');
      let choice=rowLabel.querySelector('.social-choice');
      if(!choice){choice=document.createElement('div');choice.className='social-choice';rowLabel.appendChild(choice)}
      choice.innerHTML='<div class="social-choice-title">Total de Sociales en toda la secundaria:</div>'+
        '<button type="button" class="social-choice-chip '+(opt==='A'?'active':'')+'" data-choice="A" title="En 3.º: 1 laboratorio por cuatrimestre, con las 4 materias juntas.">Opción: 10 laboratorios</button>'+
        '<button type="button" class="social-choice-chip '+(opt==='B'?'active':'')+'" data-choice="B" title="En 3.º: 2 laboratorios por cuatrimestre, agrupados 2 + 2.">Opción: 12 laboratorios</button>';
      choice.querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>chooseSocial(el.dataset.choice));
    }

    for(const term of [5,6]){
      const drop=matrix.querySelector('[data-slot="socialA-c'+term+'"]');if(!drop)continue;
      const strong=drop.querySelector('strong');if(strong)strong.textContent=(opt==='A'?'Laboratorio único':'Laboratorio A')+' · C'+term;
      let note=drop.querySelector('.social-cell-note');if(!note){note=document.createElement('div');note.className='social-cell-note';strong?.insertAdjacentElement('afterend',note)}
      note.innerHTML=opt==='A'?'4 materias juntas<small>La composición se replica entre C5 y C6.</small>':'2 materias<small>La misma pareja se replica entre C5 y C6.</small>';
    }
    if(opt==='B')for(const term of [5,6]){
      const drop=matrix.querySelector('[data-slot="socialB-c'+term+'"]');if(!drop)continue;
      const strong=drop.querySelector('strong');if(strong)strong.textContent='Laboratorio B · C'+term;
      let note=drop.querySelector('.social-cell-note');if(!note){note=document.createElement('div');note.className='social-cell-note';strong?.insertAdjacentElement('afterend',note)}
      note.innerHTML='2 materias<small>La misma pareja se replica entre C5 y C6.</small>';
    }
  }

  const previousRenderMatrix=renderMatrix;
  renderMatrix=function(){previousRenderMatrix();decorateSocial()};

  const modal=$id('rulesModal');
  if(modal){
    const rules=[...modal.querySelectorAll('.rule')];
    const socialRule=rules.find(r=>r.textContent.includes('Ciencias Sociales de 3.º:'));
    if(socialRule)socialRule.innerHTML='<strong>Ciencias Sociales de 3.º:</strong> Opción: 10 laboratorios y Opción: 12 laboratorios indican el total de Sociales en toda la secundaria. Con 10, en 3.º hay un laboratorio en C5 y otro en C6, ambos con las cuatro materias. Con 12, en 3.º hay dos laboratorios en C5 y dos en C6, agrupados 2+2 y con las mismas parejas en ambos cuatrimestres. Esta definición institucional se selecciona tocando el botón correspondiente; no se arrastra.';
    const customRule=document.createElement('div');customRule.className='rule';customRule.innerHTML='<strong>Materias agregadas por la escuela:</strong> pueden articular con cualquier espacio curricular del mismo año —troncal, laboratorio, taller, Formación Orientada, Proyecto u Otros formatos— respetando las reglas y mínimos prescriptos del espacio de destino.';modal.querySelector('.modal-box')?.appendChild(customRule);
  }
})();
