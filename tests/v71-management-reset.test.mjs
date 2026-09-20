import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function resetHarness(){
  const source=await readFile(new URL('../src/v71-management-nav-reset.js',import.meta.url),'utf8');
  const document={
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {classList:{add(){},remove(){}},textContent:'',appendChild(){},querySelector(){return null}}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const window={addEventListener(){},confirm(){return true}};
  const context={
    console,document,window,
    state:{institutional:{}},
    location:{reload(){}},
    sessionStorage:{setItem(){}},
    save(){},toast(){},
    setTimeout(){return 0},clearTimeout(){},
    MutationObserver:class{observe(){} disconnect(){}}
  };
  vm.runInNewContext(source,context,{filename:'src/v71-management-nav-reset.js'});
  return window.PCIManagementNavResetV71;
}

test('Reiniciar Gestión conserva Calificaciones/Cierres y Asistencia',async()=>{
  const api=await resetHarness();
  const current={
    teachers:{t1:{name:'Docente'}},
    assignments:{a1:'t1'},
    students:{123:{dni:'123'}},
    commissions:{c1:{students:['123']}},
    grading:{
      plans:{p1:{rows:{123:{final:'8'}}}},
      closures:{c1:{status:'publicado'}},
      settings:{showCriteriaToFamilies:false}
    },
    attendance:{records:[{dni:'123',date:'2026-09-20',type:'AUSENTE',value:1,justified:false}]},
    availabilityPreferences:{t1:{lunes:'Disponible'}},
    annualScheduleVersions:[{id:'h1'}]
  };
  const next=api.resetPayload(current);
  assert.deepEqual(JSON.parse(JSON.stringify(next)),{
    grading:current.grading,
    attendance:current.attendance
  });
});

test('Reiniciar Gestión elimina datos propios de Gestión',async()=>{
  const api=await resetHarness();
  const next=api.resetPayload({
    teachers:{t1:{}},
    assignments:{a1:'t1'},
    students:{123:{}},
    commissions:{c1:{}},
    areaTeams:{e1:{}},
    availabilityPreferences:{t1:{}},
    annualScheduleVersions:[{id:'h1'}],
    grading:{plans:{}},
    attendance:{records:[]}
  });
  for(const key of ['teachers','assignments','students','commissions','areaTeams','availabilityPreferences','annualScheduleVersions']){
    assert.equal(Object.prototype.hasOwnProperty.call(next,key),false,key+' no debe sobrevivir al reset');
  }
  assert.equal(Object.prototype.hasOwnProperty.call(next,'grading'),true);
  assert.equal(Object.prototype.hasOwnProperty.call(next,'attendance'),true);
});
