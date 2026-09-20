(() => {
  const STYLE_ID='v42-homologacion';
  const LOGO='https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/em-logo-header.svg';
  const FOOTER_LOGO='https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/em-logo-footer.svg';
  const MINISTERIO='https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/ministerio-footer.svg';
  const FG_FILES=['db1.txt','db2.txt','db3.txt','db4.txt','rest1.txt','rest2.txt','rest3.txt','rest4.txt','rest5.txt'];
  const ORI_FILE={
    'Ciencias Naturales':'ciencias_naturales','Matemática y Física':'matematica_fisica','Energía y Sustentabilidad':'energia_sustentabilidad',
    'Economía y Administración':'economia_administracion','Educación Física':'educacion_fisica','Comunicación':'comunicacion',
    'Literatura':'literatura','Turismo':'turismo','Lenguas':'lenguas','Informática':'informatica','Educación':'educacion',
    'Ciencias Sociales y Humanidades':'ciencias_sociales_humanidades','Arte - Artes Visuales':'arte','Arte - Música':'arte','Arte - Teatro':'arte','Agro y Ambiente':'agro_ambiente'
  };

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      :root{color-scheme:light;--ink:#12395c;--ink-soft:#3a5d7e;--muted:#5f7382;--paper:#fff;--canvas:#fff;--band:#edf3f8;--band-deco:#d9dee4;--blue:#2c5da6;--deep:#0d3550;--line:#d8e1e8;--mint:#83ded3;--mint-soft:#e7f8f5;--mint-dark:#126e65;--sky:#dff0fa;--gold:#f6c85f;--gold-soft:#fff5dc;--danger:#b3314d;--danger-soft:#ffe9ee;--shadow:0 16px 38px rgba(21,55,74,.09)}
      html{scroll-behavior:smooth}body{min-width:320px;overflow-x:hidden;color:var(--ink);background:var(--canvas);font-family:Archivo,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .top.site-top{position:sticky;inset:0 0 auto;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;height:77px;padding:0 clamp(18px,5vw,77px);background:var(--paper);border-bottom:0;box-shadow:none}
      .top.site-top .brand{display:inline-flex;align-items:center;min-width:0}.top.site-top .brand img{display:block;height:42px;width:auto;max-width:min(313px,55vw)}
      .top.site-top .row{gap:12px}.top.site-top .btn{display:inline-flex;align-items:center;min-height:45px;padding:0 22px;border:1.5px solid var(--ink);border-radius:999px;background:#fff;color:var(--ink);font-weight:700;line-height:1;white-space:nowrap}.top.site-top .btn:hover{background:var(--ink);color:#fff}
      .wrap{width:min(1500px,100%);max-width:none;margin:0 auto;padding:clamp(18px,3vw,36px) clamp(16px,4vw,56px) 90px}
      .hero,#proposal .v28-hero{position:relative;margin:calc(-1 * clamp(18px,3vw,36px)) calc(50% - 50vw) 26px;padding:clamp(24px,3.5vw,44px) calc(50vw - 50%) clamp(26px,3.5vw,46px);background:var(--band);border:0;border-radius:0;box-shadow:none;overflow:hidden}
      .hero:after,#proposal .v28-hero:after{content:"";position:absolute;top:0;bottom:0;right:calc(50% - 50vw);width:min(28vw,500px);background:var(--band-deco);border-bottom-left-radius:64px;pointer-events:none;opacity:1}
      .hero>* ,#proposal .v28-hero>*{position:relative;z-index:1}.hero h1,#proposal .v28-hero h1{margin:4px 0 8px;font-size:clamp(2rem,4vw,3.35rem);letter-spacing:-.035em;line-height:1.02}.hero p,#proposal .v28-hero p{max-width:780px;color:var(--muted);line-height:1.55}
      .eyebrow,#proposal .v28-eye{margin-bottom:6px;color:var(--mint-dark);font-size:.74rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .card,#proposal .v28-card,.v38-card,.v38-section,.v39-card,.v39-section,.v39-option{border:1px solid var(--line)!important;border-radius:20px!important;background:var(--paper)!important;box-shadow:var(--shadow)!important}
      .btn,#proposal .v28-btn,.v38-actions button,.v39-btn{min-height:42px;padding:10px 18px;border-radius:999px;font-weight:750;line-height:1.1;transition:transform .12s ease,background .12s ease,color .12s ease}.btn:hover,#proposal .v28-btn:hover,.v38-actions button:hover,.v39-btn:hover{transform:translateY(-1px)}
      #proposal .v28-btn.primary,.v39-btn.primary{color:#fff!important;background:var(--ink)!important;border-color:var(--ink)!important}#proposal .v28-btn.secondary,.v39-btn{border:1.5px solid var(--ink)!important;background:#fff!important;color:var(--ink)!important}#proposal .v28-btn.accent,.v39-btn.accent{border-color:transparent!important;background:var(--mint)!important;color:var(--ink)!important}
      #proposal .v28-section{margin:32px 0 14px}.v28-section h2{font-size:clamp(1.35rem,2vw,2rem)}
      #proposal .v28-area-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}#proposal .v28-area{min-height:190px;padding:20px;border-radius:20px!important;box-shadow:var(--shadow)!important}#proposal .v28-area:after{right:-36px;bottom:-56px;width:150px;height:150px;opacity:.68}
      #proposal .v28-coverage{padding:18px 20px;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:var(--shadow)}
      #proposal .v28-work{grid-template-columns:minmax(310px,390px) minmax(0,1fr);gap:16px}#proposal .v28-bag{top:92px;padding:18px;max-height:calc(100vh - 108px)}
      #proposal .v28-tabs{gap:6px;margin:14px 0 12px}#proposal .v28-tabs button{min-height:34px;padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:.7rem;font-weight:800}#proposal .v28-tabs button.on{background:var(--ink);border-color:var(--ink);color:#fff}
      #proposal .v28-filters input,#proposal .v28-filters select,#proposal .v28-group input,#proposal .v28-group textarea{padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);outline:none}#proposal .v28-filters input:focus,#proposal .v28-filters select:focus,#proposal .v28-group input:focus,#proposal .v28-group textarea:focus{border-color:var(--mint-dark);box-shadow:0 0 0 3px rgba(131,222,211,.22)}
      #proposal .v28-list{gap:7px}#proposal .v28-content{padding:11px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:none}#proposal .v28-content:hover{border-color:#aebec7;background:#fbfcfd}#proposal .v28-content.sel{outline:3px solid rgba(131,222,211,.55)}#proposal .v28-content.used{background:#f2faf7}
      #proposal .v28-groups{grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:16px}#proposal .v28-group{padding:20px!important;border:1px solid var(--line)!important;box-shadow:var(--shadow)!important}#proposal .v28-group.chosen{border:2px solid var(--mint-dark)!important;box-shadow:0 16px 38px rgba(18,110,101,.14)!important}
      #proposal .v28-head input{font-size:1.05rem;font-weight:900;border:0;background:transparent;padding:4px 0;border-radius:0}#proposal .v28-head input:focus{box-shadow:none;border-bottom:2px solid var(--mint-dark)}
      #proposal .v28-subjects{gap:6px;margin:10px 0 14px}#proposal .v28-sub{padding:5px 8px;border-radius:999px;background:var(--gold-soft);font-size:.68rem}#proposal .v28-sub.fo{background:var(--mint-soft);color:var(--mint-dark)}
      #proposal .v28-assigned-wrap{margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}#proposal .v28-assigned{padding:10px 34px 10px 11px;border:1px solid #e5ebee;border-radius:11px;background:#f8fafb}
      .v38-own{margin-top:14px!important;padding:14px!important;border:1px solid var(--line)!important;border-radius:14px!important;background:#fbfcfd!important}.v38-own-add{min-height:34px!important;padding:7px 12px!important;border:1.5px solid var(--mint-dark)!important;border-radius:999px!important;background:#fff!important;color:var(--mint-dark)!important}.v38-own-item{border:1px solid #e1e8eb!important;border-left:4px solid var(--mint-dark)!important;border-radius:11px!important}
      .v38-actions{gap:8px!important;margin-top:14px!important;padding-top:13px!important;border-top:1px solid var(--line)!important}.v38-actions .main{background:var(--mint)!important;color:var(--ink)!important;border:0!important}.v38-actions .secondary{border:1.5px solid var(--ink)!important;background:#fff!important;color:var(--ink)!important}
      .v38-modal,.v39-modal{background:rgba(18,57,92,.42)!important;backdrop-filter:blur(2px)}.v38-shell,.v39-shell{border:1px solid var(--line)!important;border-radius:20px!important;background:#fff!important;box-shadow:0 24px 70px rgba(21,55,74,.22)!important}.v38-top,.v39-top{padding:18px 20px!important;border-bottom:1px solid var(--line)!important;background:#fff!important}.v38-body,.v39-body{padding:20px!important}
      .v39-note{border:1px solid #f0daa2!important;border-radius:14px!important;background:var(--gold-soft)!important;color:#6f5418!important}.v39-shared{border:1px solid #bce8e2!important;border-radius:14px!important;background:var(--mint-soft)!important}.v39-option{padding:16px!important;box-shadow:none!important}.v39-chip{padding:5px 9px!important;background:var(--mint-soft)!important;color:var(--mint-dark)!important}.v39-stage{border:1px solid var(--line)!important;border-radius:12px!important}.v39-stage summary{padding:12px 14px!important;background:var(--band)!important;color:var(--ink)!important}
      .v42-site-footer{display:flex;align-items:center;justify-content:space-between;gap:28px;min-height:122px;padding:26px clamp(20px,5vw,76px);background:var(--deep)}.v42-site-footer img:first-child{height:43px;width:auto;max-width:45vw}.v42-site-footer img:last-child{height:48px;width:auto;max-width:45vw}
      @media(max-width:900px){.top.site-top{height:68px;padding:0 16px}.top.site-top .brand img{height:34px}.top.site-top .btn{min-height:38px;padding:0 13px;font-size:.75rem}.wrap{padding:18px 12px 70px}.hero,#proposal .v28-hero{margin:-18px calc(50% - 50vw) 20px;padding:24px calc(50vw - 50%) 28px}.hero:after,#proposal .v28-hero:after{width:34vw}.v42-site-footer{flex-direction:column;align-items:flex-start}.v42-site-footer img{max-width:75vw!important}#proposal .v28-work{grid-template-columns:1fr}#proposal .v28-bag{position:static;max-height:none}.v38-body,.v39-body,.v38-top,.v39-top{padding:14px!important}}
    `;
    document.head.appendChild(style);
  }

  function homologateHeader(){
    const header=document.querySelector('header.top');
    if(!header)return;
    header.classList.add('site-top');
    const brand=header.querySelector('.brand');
    if(brand && !brand.querySelector('img')) brand.innerHTML=`<img src="${LOGO}" alt="Escuela de Maestros">`;
    const rules=document.getElementById('rulesBtn');
    if(rules){rules.hidden=true;rules.style.display='none';rules.setAttribute('aria-hidden','true')}
    const print=document.getElementById('printBtn');
    if(print){print.classList.remove('soft');print.textContent='Impresión de PCI'}
  }

  function homologateFooter(){
    if(document.querySelector('.v42-site-footer'))return;
    const footer=document.createElement('footer');
    footer.className='v42-site-footer';
    footer.innerHTML=`<img src="${FOOTER_LOGO}" alt="Escuela de Maestros"><img src="${MINISTERIO}" alt="Ministerio de Educación · Buenos Aires Ciudad">`;
    document.body.appendChild(footer);
  }

  function prewarmCurriculum(){
    if(navigator.connection?.saveData)return;
    const run=()=>{
      const urls=FG_FILES.map(name=>`data/formacion_general/${name}?v=20260911-42`);
      const active=typeof state!=='undefined'?state.active:null;
      const ori=ORI_FILE[active];
      if(ori) urls.push(`data/orientaciones/${ori}.txt?v=20260911-42`);
      Promise.allSettled(urls.map(url=>fetch(url,{cache:'force-cache'}))).catch(()=>{});
    };
    if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1500});else setTimeout(run,250);
  }

  function start(){installStyles();homologateHeader();homologateFooter()}
  window.addEventListener('pci-app-ready',prewarmCurriculum,{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();