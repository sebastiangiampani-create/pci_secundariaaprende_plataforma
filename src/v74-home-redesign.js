(() => {
  const $=id=>document.getElementById(id);
  let observer=null,timer=null;

  function homeActive(){return !!$('home')?.classList.contains('active')}
  function selected(){return Array.isArray(state.selected)?state.selected:[]}
  function mapValid(o){try{return !!ensure(o)?.valid}catch{return false}}
  function courseCount(o){
    const cfg=window.PCIInstitutionalV48?.orientationConfig?.(o);
    if(!cfg?.courseCounts)return 0;
    return [1,2,3,4,5].reduce((n,y)=>n+(Number(cfg.courseCounts[y])||0),0);
  }

  function decorate(){
    const home=$('home');if(!home)return;
    home.classList.add('v74-home');

    const hero=home.querySelector(':scope > .hero');
    if(hero){
      hero.classList.add('v74-home-hero');
      const eyebrow=hero.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='PCI Secundaria Aprende';
      const h1=hero.querySelector('h1');if(h1)h1.textContent='Organización curricular de la escuela';
      const p=hero.querySelector('p');if(p)p.textContent='Elegí las orientaciones de la escuela, configurá sus divisiones y construí cada PCI de manera independiente. Gestión institucional integra toda la escuela.';
      let stats=hero.querySelector('.v74-home-stats');
      if(!stats){stats=document.createElement('div');stats.className='v74-home-stats';hero.appendChild(stats)}
      const sel=selected(),valid=sel.filter(mapValid).length,totalCourses=sel.reduce((n,o)=>n+courseCount(o),0);
      stats.innerHTML=`
        <span><strong>${sel.length}</strong> orientaciones</span>
        <span><strong>${valid}</strong> mapas validados</span>
        <span><strong>${totalCourses}</strong> divisiones configuradas</span>`;
    }

    const setup=home.querySelector(':scope > .card.panel');
    if(setup){
      setup.classList.add('v74-school-setup');
      const schoolLabel=setup.querySelector('label');
      if(schoolLabel)schoolLabel.classList.add('v74-school-name');
      const schoolInput=$('schoolName');if(schoolInput)schoolInput.setAttribute('placeholder','Nombre de la escuela');

      let header=setup.querySelector('.v74-setup-head');
      if(!header){
        header=document.createElement('div');header.className='v74-setup-head';
        header.innerHTML='<div><div class="eyebrow">Configuración central</div><h2>Escuela y orientaciones</h2><p>Esta selección define qué PCI construye la institución. Podés cambiarla cuando lo necesites.</p></div>';
        setup.prepend(header);
      }

      const oldEyebrows=[...setup.querySelectorAll(':scope > .eyebrow')];
      oldEyebrows.forEach(x=>{if(!x.closest('.v74-setup-head'))x.style.display='none'});

      const orientationList=$('orientationList');
      if(orientationList){
        orientationList.classList.add('v74-orientation-list');
        orientationList.querySelectorAll('.orientation').forEach(label=>{
          const input=label.querySelector('input');
          label.classList.toggle('selected',!!input?.checked);
          let mark=label.querySelector('.v74-checkmark');
          if(!mark){mark=document.createElement('span');mark.className='v74-checkmark';mark.textContent='✓';label.prepend(mark)}
        });
      }
    }

    const pciList=$('pciList');
    if(pciList){
      pciList.classList.add('v74-pci-list');
      let title=$('v74PciTitle');
      if(!title){
        title=document.createElement('div');title.id='v74PciTitle';title.className='v74-section-title';
        pciList.before(title);
      }
      title.innerHTML=`<div><div class="eyebrow">PCI de la escuela</div><h2>Orientaciones seleccionadas</h2><p>Cada orientación conserva su propio Mapa de la Oferta y Desarrollo Curricular.</p></div><span>${selected().length} PCI</span>`;

      pciList.querySelectorAll('.pci-card').forEach(card=>{
        card.classList.add('v74-pci-card');
        const orientation=card.querySelector('h3')?.textContent?.trim()||'';
        const status=card.querySelector('.status');
        if(status)status.classList.add(mapValid(orientation)?'is-valid':'is-building');
        const open=card.querySelector('[data-open]');
        if(open){open.textContent='Abrir PCI';open.classList.add('v74-open-pci')}
        const config=card.querySelector('.v48-course-config');
        if(config){
          config.classList.add('v74-course-config');
          const title=config.querySelector('.v48-course-title');if(title)title.textContent='Divisiones por nivel';
        }
      });
    }

    const management=$('v71LeanHomeEntry');
    if(management){
      management.classList.add('v74-management-entry');
      const h2=management.querySelector('h2');if(h2)h2.textContent='Gestión institucional de la escuela';
      const p=management.querySelector('p');if(p)p.textContent='Docentes, cargos, asignaciones, comisiones, estudiantes, disponibilidad y horarios en una única gestión transversal.';
      const btn=management.querySelector('[data-v71n-open]');if(btn)btn.textContent='Abrir Gestión';
    }
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,60)}
  function start(){
    const home=$('home');if(!home)return;
    if(!observer){observer=new MutationObserver(refresh);observer.observe(home,{childList:true,subtree:true})}
    decorate();
  }

  document.addEventListener('change',e=>{if(e.target.closest('#orientationList input,#schoolName,[data-v48-course]'))setTimeout(refresh,20)},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="home"],[data-v48-home],[data-dock="home"]'))setTimeout(refresh,80)},true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,500));
  setTimeout(start,1200);

  const style=document.createElement('style');
  style.textContent=`
    #home.v74-home{display:none}
    #home.v74-home.active{display:block}
    .v74-home-hero{position:relative;overflow:hidden;border-radius:0 0 30px 30px!important;padding:30px 28px!important;background:linear-gradient(135deg,#edf3f8 0%,#f8fbfd 62%,#eef8f6 100%)!important}
    .v74-home-hero:after{content:"";position:absolute;width:300px;height:300px;border-radius:50%;right:-120px;bottom:-170px;background:#dce6ea;opacity:.85}
    .v74-home-hero>*{position:relative;z-index:1}.v74-home-hero h1{max-width:900px;letter-spacing:-.035em}.v74-home-hero p{max-width:900px!important}
    .v74-home-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.v74-home-stats span{padding:9px 12px;border:1px solid rgba(18,57,92,.09);border-radius:999px;background:rgba(255,255,255,.78);font-size:.62rem;color:var(--muted);backdrop-filter:blur(6px)}.v74-home-stats strong{color:var(--ink);font-size:.78rem;margin-right:3px}

    .v74-school-setup{margin-top:18px;padding:22px!important;border-radius:22px!important;box-shadow:0 12px 28px rgba(18,57,92,.07)!important}
    .v74-setup-head{display:flex;justify-content:space-between;gap:14px;margin-bottom:16px}.v74-setup-head h2{margin:4px 0 5px;font-size:1.25rem}.v74-setup-head p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.45}
    .v74-school-name{display:grid!important;grid-template-columns:1fr;gap:5px;padding:14px;border-radius:14px;background:var(--band);margin-bottom:14px}.v74-school-name>span{font-size:.6rem;font-weight:900;color:var(--muted)}.v74-school-name input{margin:0!important;background:#fff!important;font-size:.84rem!important;font-weight:750}

    .v74-orientation-list{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:9px!important}
    .v74-orientation-list .orientation{position:relative;align-items:center!important;min-height:64px;padding:12px 13px!important;border-radius:15px!important;background:#fff;transition:.16s ease;cursor:pointer}
    .v74-orientation-list .orientation:hover{border-color:#a9c6c1;box-shadow:0 7px 16px rgba(18,57,92,.05)}
    .v74-orientation-list .orientation.selected{border-color:#83ded3!important;background:#f4fcfa!important;box-shadow:0 0 0 2px rgba(131,222,211,.18)}
    .v74-orientation-list .orientation input{position:absolute;opacity:0;pointer-events:none}
    .v74-checkmark{display:grid;place-items:center;width:27px;height:27px;border:1px solid var(--line);border-radius:50%;background:#fff;color:transparent;font-size:.72rem;font-weight:900;flex:0 0 auto}
    .v74-orientation-list .orientation.selected .v74-checkmark{background:var(--mint-dark);border-color:var(--mint-dark);color:#fff}
    .v74-orientation-list .orientation strong{font-size:.72rem;line-height:1.2}.v74-orientation-list .orientation small{font-size:.54rem!important;margin-top:3px}

    .v74-section-title{display:flex;justify-content:space-between;align-items:end;gap:16px;margin:28px 0 11px}.v74-section-title h2{margin:4px 0 4px;font-size:1.3rem}.v74-section-title p{margin:0;color:var(--muted);font-size:.68rem}.v74-section-title>span{padding:6px 10px;border-radius:999px;background:var(--band);font-size:.58rem;font-weight:900;white-space:nowrap}
    .v74-pci-list{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))!important;gap:12px!important;margin-top:0!important}
    .v74-pci-card{position:relative;overflow:hidden;padding:18px!important;border-radius:20px!important;box-shadow:0 10px 26px rgba(18,57,92,.06)!important}
    .v74-pci-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--mint)}
    .v74-pci-card h3{font-size:1.02rem!important;margin:5px 0 9px!important;padding-right:8px}
    .v74-pci-card .status{display:inline-flex!important;width:auto!important;padding:5px 8px!important;border-radius:999px!important;font-size:.55rem!important;font-weight:900!important}
    .v74-pci-card .status.is-valid{background:var(--ok-soft)!important;color:var(--ok)!important}.v74-pci-card .status.is-building{background:var(--gold-soft)!important;color:#805700!important}
    .v74-open-pci{min-width:120px!important}
    .v74-course-config{margin-top:15px!important;padding-top:13px!important}.v74-course-config .v48-course-title{font-size:.58rem!important;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)!important}
    .v74-course-config .v48-course-grid{gap:7px!important}.v74-course-config .v48-course-grid label{padding:7px;border-radius:10px;background:var(--band);text-align:center}.v74-course-config .v48-course-grid input{margin-top:3px}

    .v74-management-entry{margin-top:24px!important;border-radius:22px!important;padding:20px!important;background:linear-gradient(135deg,#f3fbf9,#e9f5f3)!important;border-color:#9edfd7!important;box-shadow:0 10px 28px rgba(18,57,92,.07)!important}
    .v74-management-entry h2{font-size:1.18rem!important}.v74-management-entry p{max-width:850px!important}

    @media(max-width:760px){
      .v74-home-hero{padding:22px 16px!important;margin-left:-12px!important;margin-right:-12px!important;border-radius:0 0 24px 24px!important}
      .v74-home-stats{display:grid;grid-template-columns:1fr 1fr}.v74-home-stats span:last-child{grid-column:1/-1}
      .v74-school-setup{padding:16px!important}.v74-orientation-list{grid-template-columns:1fr!important}.v74-pci-list{grid-template-columns:1fr!important}
      .v74-section-title{align-items:flex-start;flex-direction:column}.v74-management-entry{padding:16px!important}
    }
  `;document.head.appendChild(style);
  window.PCIHomeRedesignV74={decorate,refresh};
})();