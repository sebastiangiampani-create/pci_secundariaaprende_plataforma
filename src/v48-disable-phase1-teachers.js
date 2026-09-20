(() => {
  const removeLegacy=()=>{
    document.querySelectorAll('#offer .teacher-control').forEach(x=>x.remove());
    document.querySelectorAll('[data-teacher-hours]').forEach(x=>x.remove());
    document.querySelectorAll('#offer .teacher-note').forEach(x=>{if(/Docentes:/i.test(x.textContent||''))x.remove()});
  };
  const wrap=name=>{
    const previous=window[name];if(typeof previous!=='function'||previous.__v48NoTeachers)return;
    const next=function(...args){const out=previous.apply(this,args);removeLegacy();queueMicrotask(removeLegacy);return out};
    next.__v48NoTeachers=true;window[name]=next;
  };
  ['renderBag','renderMatrix','renderOffer','renderPanel'].forEach(wrap);
  window.addEventListener('pci-app-ready',()=>{removeLegacy();setTimeout(removeLegacy,50)});
})();
