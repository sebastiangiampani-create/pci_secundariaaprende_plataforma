(() => {
  const STYLE_ID='v59-phase2-annual-matrix-style';
  let observer=null;
  let scheduled=false;

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #proposal #v28matrix .v59-term-pair{
        grid-column:span 2;
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        gap:5px;
        min-width:0;
      }
      #proposal #v28matrix .v59-annual-cell{
        grid-column:1/-1;
        min-height:64px;
        padding:5px;
        border:1px solid var(--l);
        border-radius:8px;
        background:#fff;
      }
      #proposal #v28matrix .v59-annual-cell .v28-chip{
        min-height:48px;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }
      #proposal #v28matrix .v59-annual-chip:after{
        content:attr(data-v59-range);
        display:block;
        margin-top:3px;
        color:var(--m);
        font-size:.52rem;
        font-weight:800;
      }
      #proposal #v28matrix .v59-term-pair>.v28-cell{
        min-width:0;
      }
    `;
    document.head.appendChild(style);
  }

  function directChips(cell){
    return [...cell.children].filter(el=>el.matches?.('[data-mg]'));
  }

  function rangeLabel(id,pairIndex){
    const g=window.PCIPhase2V28?.gb?.(id);
    const term=String(g?.term||'');
    if(term.includes('-')){
      const [a,b]=term.split('-');
      return `C${a}–C${b} · anual`;
    }
    const a=pairIndex+1,b=pairIndex+2;
    return `C${a}–C${b} · anual`;
  }

  function mergePair(row,left,right,pairIndex){
    const leftChips=directChips(left);
    const rightMap=new Map(directChips(right).map(chip=>[chip.dataset.mg,chip]));
    const shared=leftChips.filter(chip=>chip.dataset.mg&&rightMap.has(chip.dataset.mg));
    if(!shared.length)return false;

    const wrapper=document.createElement('div');
    wrapper.className='v59-term-pair';
    const annual=document.createElement('div');
    annual.className='v59-annual-cell';

    row.insertBefore(wrapper,left);
    for(const chip of shared){
      const duplicate=rightMap.get(chip.dataset.mg);
      duplicate?.remove();
      chip.classList.add('v59-annual-chip');
      chip.dataset.v59Range=rangeLabel(chip.dataset.mg,pairIndex);
      annual.appendChild(chip);
    }
    wrapper.appendChild(annual);

    const leftHas=directChips(left).length>0;
    const rightHas=directChips(right).length>0;
    if(leftHas||rightHas){
      wrapper.classList.add('v59-mixed-pair');
      wrapper.appendChild(left);
      wrapper.appendChild(right);
    }else{
      left.remove();
      right.remove();
    }
    return true;
  }

  function mergeRow(row){
    if(row.dataset.v59AnnualMatrix==='1')return;
    const cells=[...row.children].filter(el=>el.classList.contains('v28-cell'));
    if(cells.length!==10)return;
    row.dataset.v59AnnualMatrix='1';
    for(let i=0;i<10;i+=2)mergePair(row,cells[i],cells[i+1],i);
  }

  function transformMatrix(){
    installStyles();
    const matrix=document.querySelector('#v28matrix .v28-matrix');
    if(!matrix)return;
    const rows=[...matrix.querySelectorAll(':scope > .v28-mrow')];
    rows.slice(1).forEach(mergeRow);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      transformMatrix();
    });
  }

  function start(){
    installStyles();
    const proposal=document.getElementById('proposal');
    if(proposal&&!observer){
      observer=new MutationObserver(schedule);
      observer.observe(proposal,{childList:true,subtree:true});
    }
    schedule();
  }

  window.addEventListener('pci-app-ready',()=>setTimeout(start,80));
  document.addEventListener('click',e=>{
    if(e.target.closest('#v28full,#v28mat'))setTimeout(schedule,0);
  },true);

  window.PCIPhase2AnnualMatrixV59={transformMatrix};
})();
