(() => {
  const current=()=>ensure(state.active);
  const MAX_HC=9;
  let HOURS=null;

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const info=slot=>{const m=String(slot||'').match(/^(.*)-c(\d+)$/);return m?{key:m[1],term:Number(m[2]),year:Math.ceil(Number(m[2])/2)}:null};
  const pair=slot=>{const i=info(slot);return i?`${i.key}-c${i.term%2?i.term+1:i.term-1}`:null};
  const isFgLab=slot=>/^(naturales|socialA|socialB)-c\d+$/.test(String(slot||''));
  const isFo=slot=>/^(foN3|foN4|foLab5|foTaller5)-c\d+$/.test(String(slot||''));
  const isFlexible=s=>!!s&&(s.origin==='CUSTOM'||/^fg-\d+-(espacios-de-definicion-institucional|tutoria)$/.test(String(s.id||'')));
  const curricular=s=>!!s&&!isFlexible(s);
  const SOCIAL3=new Set(['Historia','Geografía','Formación Ética y Ciudadana','Economía']);

  const style=document.createElement('style');
  style.textContent=`
    /* La matriz se desplaza; las referencias de nivel/cuatrimestre quedan visibles. */
    #offer .matrix-shell{max-height:calc(100vh - 155px);overflow:auto;position:relative}
    #offer #matrix>.grid.levels{position:sticky;top:0;z-index:12;background:#fff;padding-top:2px}
    #offer #matrix>.grid:nth-child(2){position:sticky;top:31px;z-index:11;background:#fff;padding-bottom:2px}
    #offer #matrix>.grid.levels>div:first-child,
    #offer #matrix>.grid:nth-child(2)>.term:first-child{position:sticky;left:0;z-index:14;background:#fff}
    #offer #matrix>.grid:nth-child(2)>.term:first-child{background:var(--band)}
    #offer .rowlabel{z-index:6}
    @media(max-width:760px){
      #offer .matrix-wrap,#offer .matrix-container{overflow-x:auto;-webkit-overflow-scrolling:touch}
      #offer .matrix-shell{max-height:70vh;-webkit-overflow-scrolling:touch}
      #offer #matrix{min-width:1180px}
      #offer .placed{font-size:.58rem;line-height:1.15}
      #offer .map-grip{padding:4px 3px;touch-action:none}
      #offer .validation.rule-block{position:sticky;left:8px;right:8px;bottom:8px;z-index:40;max-width:calc(100vw - 16px);box-sizing:border-box}
      #offer .composition-palette{position:relative;z-index:2}
    }
  `;
  document.head.appendChild(style);

  async function loadHours(){if(HOURS)return HOURS;try{const r=await fetch('data/horas-v2.json',{cache:'force-cache'});if(r.ok)HOURS=await r.json()}catch{}return HOURS}
  loadHours();

  function findHours(dict,name){const key=norm(name);for(const [n,h] of Object.entries(dict||{}))if(norm(n)===key)return Number(h)||0;return 0}
  function subjectHours(s){
    if(!s)return 0;
    if(s.origin==='CUSTOM')return Number(s.hours??s.weeklyHours??s.hc??0)||0;
    if(!HOURS)return 0;
    if(s.origin==='FG')return findHours(HOURS.formacion_general?.[String(s.year)],s.name);
    if(s.origin==='FO'){
      const o=HOURS.formacion_orientada?.[state.active];
      const d=Number(s.year)===3?o?.['3']:o?.[current().alt||'A']?.[String(s.year)];
      return findHours(d,s.name);
    }
    return 0;
  }
  function members(slot,excludeId=null){return [...new Set(current().placements?.[slot]||[])].filter(id=>id!==excludeId).map(byId).filter(Boolean)}
  function curricularCount(slot,excludeId=null){return members(slot,excludeId).filter(curricular).length}
  function totalHours(slot,excludeId=null,add=null){const list=members(slot,excludeId);if(add&&!list.some(s=>s.id===add.id))list.push(add);return list.reduce((n,s)=>n+subjectHours(s),0)}
  function minFo(slot){if(/^foN3-c[56]$/.test(slot))return 1;if(/^foN4-c[78]$/.test(slot))return 2;if(/^(foLab5|foTaller5)-c(9|10)$/.test(slot))return 2;return 0}
  function fgSingleAllowed(slot){const i=info(slot);if(!i)return false;if(i.key==='naturales'&&i.year===4)return true;if((i.key==='naturales'||i.key==='socialA'||i.key==='socialB')&&i.year===5)return true;return false}

  function block(message,resolution=''){
    const box=document.getElementById('validation');
    if(box){box.className='validation rule-block';box.innerHTML=`<strong>Acción no permitida</strong>${esc(message)}${resolution?`<br><span>${esc(resolution)}</span>`:''}`}
    toast(message,true);
  }
  function removePair(slot,id){const p=current().placements;p[slot]=(p[slot]||[]).filter(x=>x!==id);const q=pair(slot);if(q)p[q]=(p[q]||[]).filter(x=>x!==id)}
  function addPair(slot,id){const p=current().placements;p[slot]=p[slot]||[];if(!p[slot].includes(id))p[slot].push(id);const q=pair(slot);if(q){p[q]=p[q]||[];if(!p[q].includes(id))p[q].push(id)}}

  function sourceValidAfterMove(source,id){
    if(isFo(source)){
      const min=minFo(source),after=curricularCount(source,id);
      if(after<min)return[false,`El espacio de Formación Orientada quedaría con ${after} materia${after===1?'':'s'} y necesita al menos ${min}.`];
    }
    if(isFgLab(source)){
      const after=curricularCount(source,id),i=info(source);
      if(after===1&&!fgSingleAllowed(source))return[false,'El laboratorio de Formación General quedaría con una sola materia, configuración no permitida para este nivel.'];
      if(after===0&&!fgSingleAllowed(source))return[false,'El movimiento eliminaría un laboratorio mínimo prescripto de Formación General.'];
      if(i?.year===3&&(i.key==='socialA'||i.key==='socialB')&&after>=2)return[true,'social3'];
    }
    return[true,''];
  }
  function validateCross(source,target,s){
    const a=info(source),b=info(target);
    if(!a||!b||a.year!==b.year||Number(s.year)!==b.year)return[false,'La articulación FG ↔ FO solo puede realizarse dentro del mismo nivel.'];
    if(b.year<3)return[false,'La articulación FG ↔ FO se habilita desde Nivel 3.'];
    if(b.year===5&&s.origin==='FG'&&isFo(target)&&(a.key==='naturales'||a.key==='socialA'||a.key==='socialB'))return[false,'En Nivel 5, la materia única prescripta de Ciencias Sociales o Ciencias Naturales debe permanecer en Formación General.'];
    const src=sourceValidAfterMove(source,s.id);if(!src[0])return src;
    const hc=totalHours(target,null,s);if(HOURS&&hc>MAX_HC)return[false,`El agrupamiento resultante tendría ${hc} HC y el máximo permitido es ${MAX_HC} HC.`];
    return[true,''];
  }

  function articulatedSocial3Ids(){
    const ids=new Set();
    for(const slot of ['foN3-c5','foN3-c6'])for(const id of current().placements?.[slot]||[]){
      const s=byId(id);if(s?.origin==='FG'&&Number(s.year)===3&&SOCIAL3.has(s.name))ids.add(id);
    }
    return ids;
  }
  function socialCoreIds(slot){return (current().placements?.[slot]||[]).filter(id=>{const s=byId(id);return s?.origin==='FG'&&Number(s.year)===3&&SOCIAL3.has(s.name)})}
  function sameIds(a,b){const A=new Set(a),B=new Set(b);return A.size===B.size&&[...A].every(x=>B.has(x))}

  function normalizeSocial3(){
    const articulated=articulatedSocial3Ids();
    if(!articulated.size)return;
    current().socialOption='A';
    for(const t of [5,6]){
      const a=`socialA-c${t}`,b=`socialB-c${t}`;
      const merged=[...(current().placements[a]||[]),...(current().placements[b]||[])];
      current().placements[a]=[...new Set(merged)].filter(id=>!articulated.has(id));
      current().placements[b]=[];
    }
  }

  function articulatedSocial3Valid(){
    const articulated=articulatedSocial3Ids();
    if(!articulated.size)return false;
    const a5=socialCoreIds('socialA-c5'),a6=socialCoreIds('socialA-c6');
    const b5=socialCoreIds('socialB-c5'),b6=socialCoreIds('socialB-c6');
    const remaining=4-articulated.size;
    return current().socialOption==='A'&&remaining>=2&&a5.length===remaining&&a6.length===remaining&&sameIds(a5,a6)&&b5.length===0&&b6.length===0;
  }

  function moveCross(source,target,id){
    const s=byId(id);if(!s)return false;
    if(!((isFgLab(source)&&isFo(target))||(isFo(source)&&isFgLab(target))))return false;
    const check=validateCross(source,target,s);
    if(!check[0]){block(check[1],'Reorganizá las materias del mismo nivel sin romper mínimos ni superar 9 HC.');return true}
    removePair(source,id);addPair(target,id);normalizeSocial3();
    current().valid=false;save();renderOffer();toast(`${s.name} quedó articulada en el mismo nivel.`);return true;
  }

  function decode(raw){if(!raw?.startsWith('move:'))return null;const rest=raw.slice(5),i=rest.indexOf(':');if(i<0)return null;return{from:decodeURIComponent(rest.slice(0,i)),id:decodeURIComponent(rest.slice(i+1))}}

  function bindCapture(){
    const matrix=document.getElementById('matrix');if(!matrix||matrix.__v33Articulation)return;
    matrix.__v33Articulation=true;
    matrix.addEventListener('drop',e=>{
      const p=decode(e.dataTransfer?.getData('text/plain')||'');if(!p)return;
      const target=e.target.closest('[data-slot]')?.dataset.slot;if(!target)return;
      if(moveCross(p.from,target,p.id)){e.preventDefault();e.stopImmediatePropagation()}
    },true);
  }

  function bindTouchCapture(){
    const matrix=document.getElementById('matrix');if(!matrix||matrix.__v33Touch)return;
    matrix.__v33Touch=true;
    matrix.addEventListener('pointerup',e=>{
      if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
      const sourceEl=e.target.closest('[data-map-id][data-from]');
      if(!sourceEl)return;
      const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');
      if(!under)return;
      if(moveCross(sourceEl.dataset.from,under.dataset.slot,sourceEl.dataset.mapId)){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);
  }

  const previousValidTarget=validTarget;
  validTarget=function(slot,s){
    const i=info(slot);
    if(i&&i.year>=3&&Number(s?.year)===i.year){
      if(isFo(slot)&&s?.origin==='FG')return[true,''];
      if(isFgLab(slot)&&s?.origin==='FO')return[true,''];
    }
    return previousValidTarget(slot,s);
  };

  /*
    El validador histórico de Sociales N3 exige exactamente 4 materias en la
    opción de 10 laboratorios. Cuando hay articulación FG→FO, la regla vigente
    es "al menos 2". Para no duplicar el resto del validador, se completa solo
    durante la llamada de validación y se restaura inmediatamente el estado real.
  */
  const previousValidateOffer=validateOffer;
  validateOffer=function(){
    normalizeSocial3();
    if(!articulatedSocial3Valid())return previousValidateOffer();
    const articulated=[...articulatedSocial3Ids()];
    const p=current().placements;
    const snapshot={
      a5:[...(p['socialA-c5']||[])],a6:[...(p['socialA-c6']||[])],
      b5:[...(p['socialB-c5']||[])],b6:[...(p['socialB-c6']||[])]
    };
    for(const id of articulated){
      if(!p['socialA-c5'].includes(id))p['socialA-c5'].push(id);
      if(!p['socialA-c6'].includes(id))p['socialA-c6'].push(id);
    }
    try{return previousValidateOffer();}
    finally{
      p['socialA-c5']=snapshot.a5;p['socialA-c6']=snapshot.a6;p['socialB-c5']=snapshot.b5;p['socialB-c6']=snapshot.b6;
      save();
      setTimeout(()=>renderOffer(),0);
    }
  };

  const previousRender=renderOffer;
  renderOffer=function(){previousRender();bindCapture();bindTouchCapture()};
  window.addEventListener('pci-app-ready',()=>{loadHours();bindCapture();bindTouchCapture()});
})();
