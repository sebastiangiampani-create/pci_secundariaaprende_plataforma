(()=>{
  const LICENSE_URL='https://creativecommons.org/licenses/by-nc-nd/4.0/';
  const BADGE_URL='https://licensebuttons.net/l/by-nc-nd/4.0/88x31.png';
  function ensure(){
    if(document.getElementById('ccLicenseFooter'))return;
    const footer=document.createElement('div');
    footer.id='ccLicenseFooter';
    footer.innerHTML=`<a href="${LICENSE_URL}" target="_blank" rel="license noopener noreferrer" aria-label="Licencia Creative Commons BY-NC-ND 4.0"><img src="${BADGE_URL}" alt="Creative Commons BY-NC-ND 4.0"></a><div><strong>© 2026 Sebastián Giampani</strong><span>Creative Commons BY-NC-ND 4.0 · Atribución · No Comercial · Sin Derivadas</span></div>`;
    document.body.appendChild(footer);
  }
  const style=document.createElement('style');
  style.textContent=`#ccLicenseFooter{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:14px 16px;margin-top:24px;border-top:1px solid rgba(18,57,92,.14);background:#f8fafb;color:#12395c;font:600 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}#ccLicenseFooter a{display:inline-flex;align-items:center}#ccLicenseFooter img{display:block;width:88px;height:31px;border:0}#ccLicenseFooter strong,#ccLicenseFooter span{display:block}#ccLicenseFooter span{margin-top:2px;font-weight:500;opacity:.78}@media(max-width:640px){#ccLicenseFooter{justify-content:flex-start;padding:12px}#ccLicenseFooter div{flex:1 1 210px}}`;
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
  window.addEventListener('pci-app-ready',()=>setTimeout(ensure,80));
})();