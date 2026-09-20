(() => {
  const current = () => ensure(state.active);
  const PREARM_VERSION = 1;

  function findSubject(year,name){
    return fg().find(s=>s.origin==='FG' && s.year===year && s.name===name) || null;
  }

  function isPlacedAnywhere(id){
    return Object.values(current().placements||{}).some(ids=>(ids||[]).includes(id));
  }

  function hasAnyFGPlacement(){
    const m=current();
    return Object.values(m.placements||{}).some(ids=>(ids||[]).some(id=>byId(id)?.origin==='FG'));
  }

  function pushIfMissing(slot,id){
    if(!id)return;
    const p=current().placements;
    p[slot]=p[slot]||[];
    if(!p[slot].includes(id))p[slot].push(id);
  }

  function placeAnnual(year,name,key){
    const s=findSubject(year,name);
    if(!s || isPlacedAnywhere(s.id))return;
    pushIfMissing(`${key}-n${year}`,s.id);
  }

  function placePaired(year,name,key,group='A'){
    const s=findSubject(year,name);
    if(!s || isPlacedAnywhere(s.id))return;
    const c1=year*2-1,c2=year*2;
    const prefix=key==='social' ? `social${group}` : key;
    pushIfMissing(`${prefix}-c${c1}`,s.id);
    pushIfMissing(`${prefix}-c${c2}`,s.id);
  }

  function prearmMap(){
    if(!state.active)return false;
    const m=current();
    m.placements=m.placements||{};

    // Si la orientación ya tiene FG, nunca reconstruimos ni pisamos decisiones institucionales.
    // Si quedó marcada como prearmada pero no conserva ninguna FG (estado viejo/incompleto),
    // se repara una sola vez reconstruyendo exclusivamente la base de Formación General.
    if(m.prearmVersion>=PREARM_VERSION && hasAnyFGPlacement())return false;

    // Troncales anuales: aparecen armadas desde el inicio.
    for(let year=1;year<=5;year++){
      placeAnnual(year,'Lengua y Literatura','lengua');
      placeAnnual(year,'Matemática','matematica');
      placeAnnual(year,'Lengua Adicional','adicional');
    }

    // Ciencias Naturales: distribución base por año, replicada entre ambos cuatrimestres.
    placePaired(1,'Biología','naturales');
    placePaired(2,'Biología','naturales');
    placePaired(3,'Biología','naturales');
    placePaired(3,'Físico-Química','naturales');
    placePaired(4,'Física','naturales');
    placePaired(5,'Química','naturales');

    // Ciencias Sociales. En 3.º se respeta la opción institucional elegida.
    placePaired(1,'Historia','social');
    placePaired(1,'Geografía','social');
    placePaired(1,'Formación Ética y Ciudadana','social');
    placePaired(2,'Historia','social');
    placePaired(2,'Geografía','social');
    placePaired(2,'Formación Ética y Ciudadana','social');

    const social3=['Historia','Geografía','Formación Ética y Ciudadana','Economía'];
    if(m.socialOption==='B'){
      placePaired(3,social3[0],'social','A');
      placePaired(3,social3[1],'social','A');
      placePaired(3,social3[2],'social','B');
      placePaired(3,social3[3],'social','B');
    }else{
      social3.forEach(name=>placePaired(3,name,'social','A'));
    }

    placePaired(4,'Historia','social');
    placePaired(4,'Geografía','social');
    placePaired(4,'Formación Ética y Ciudadana','social');
    placePaired(5,'Filosofía','social');

    // Talleres de Formación General.
    placePaired(1,'Artes','artes');
    placePaired(2,'Artes','artes');
    placePaired(4,'Artes','artes');

    placePaired(1,'Educación Tecnológica','tecnologias');
    placePaired(2,'Educación Tecnológica','tecnologias');
    placePaired(3,'Tecnologías de la Información','tecnologias');
    placePaired(4,'Tecnologías de la Información','tecnologias');

    for(let year=1;year<=5;year++)placePaired(year,'Educación Física','ef');

    m.prearmVersion=PREARM_VERSION;
    m.valid=false;
    save();
    return true;
  }

  // Permite que Fase 2 asegure el mapa base aunque el usuario nunca haya abierto Fase 1.
  window.__pciEnsurePrearm=prearmMap;

  // Filosofía de 5.º forma parte del armado base de Sociales y debe poder moverse
  // dentro de los laboratorios de Sociales de su mismo nivel.
  const previousValidTarget=validTarget;
  validTarget=function(slot,s){
    if(s && s.origin==='FG' && s.year===5 && s.name==='Filosofía' && /^socialA-c(9|10)$/.test(slot)){
      const ids=current().placements[slot]||[];
      if(ids.includes(s.id))return[false,`${s.name} ya está en este espacio.`];
      return[true,''];
    }
    return previousValidTarget(slot,s);
  };

  // Asegurar Formación General apenas se abre cualquier PCI, antes de entrar a Fase 1 o Fase 2.
  const previousRenderPanel=renderPanel;
  renderPanel=function(){
    prearmMap();
    previousRenderPanel();
  };

  const previousRenderOffer=renderOffer;
  renderOffer=function(){
    prearmMap();
    previousRenderOffer();
  };

  const modal=document.getElementById('rulesModal');
  if(modal){
    const rule=document.createElement('div');
    rule.className='rule';
    rule.innerHTML='<strong>Mapa prearmado:</strong> la Formación General se presenta con una distribución base válida para que la institución parta de un mapa legible y pueda reorganizarlo. La Formación Orientada se mantiene más abierta: se muestran sus formatos y espacios prescriptos, pero las materializaciones quedan disponibles para distribuir por drag & drop.';
    modal.querySelector('.modal-box')?.appendChild(rule);
  }
})();
