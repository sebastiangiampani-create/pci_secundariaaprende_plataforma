(() => {
  const style=document.createElement('style');
  style.textContent=`
    @media(max-width:780px){
      #v70StaffWorkbook{overflow:hidden}
      #v70StaffWorkbook .v70-workbook-actions{
        display:flex!important;
        flex-direction:column!important;
        align-items:stretch!important;
        gap:10px!important;
        width:100%!important;
        max-width:100%!important;
      }
      #v70StaffWorkbook .v70-workbook-actions>.btn,
      #v70StaffWorkbook .v70-workbook-actions>.v70-file{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        flex:0 0 auto!important;
        box-sizing:border-box!important;
        margin:0!important;
        text-align:center!important;
        white-space:normal!important;
        overflow-wrap:anywhere!important;
        line-height:1.15!important;
      }
      #v70StaffWorkbook .v70-file input{display:none!important}
    }
  `;
  document.head.appendChild(style);
})();