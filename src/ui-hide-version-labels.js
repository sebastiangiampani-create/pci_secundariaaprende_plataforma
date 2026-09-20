(()=>{
  function cleanTextNode(node){
    if(!node||node.nodeType!==3)return;
    const before=node.nodeValue||'';
    const after=before
      .replace(/\s*[·|\-–—]?\s*V\d+[A-Za-z]?\b/gi,'')
      .replace(/\s*[·|\-–—]?\s*(?:versi[oó]n|version)\s+[A-Za-z0-9._-]+\b/gi,'')
      .replace(/\s*[·|\-–—]?\s*motor\s+[A-Za-z0-9._-]+\b/gi,'');
    if(after!==before)node.nodeValue=after;
  }
  function clean(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(cleanTextNode);
    document.querySelectorAll('#v71StableBanner,[id*="VersionBadge"],[class*="version-badge"],[data-version-badge]').forEach(el=>el.remove());
  }
  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>clean(),80)}
  document.addEventListener('DOMContentLoaded',()=>clean(),{once:true});
  window.addEventListener('pci-app-ready',()=>clean());
  const start=()=>{clean();if(document.body){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.PCIHideVersionLabels={clean};
})();