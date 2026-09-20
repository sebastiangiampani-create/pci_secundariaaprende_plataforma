import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

function plan({groupId,planNumber,final='',weighted='',completedAt='',groupType='laboratorio'}){
  const orientation='Sociales',commissionKey='Sociales|||1|||A';
  return {
    key:[orientation,groupId,planNumber,commissionKey].join('|||'),
    orientation,groupId,groupName:groupId,groupType,year:1,
    commissionKey,course:'1.º A',planNumber,planName:'Plan '+planNumber,
    rows:{'12345678':{dni:'12345678',status:final?'finalizado':'en_proceso',final,weighted,completedAt}}
  };
}

async function harness(plans,closures={}){
  const source=await readFile(new URL('../src/v77-boletines-cierres.js',import.meta.url),'utf8');
  const state={school:'Escuela',institutional:{grading:{plans:{},closures,definitives:{},settings:{showCriteriaToFamilies:false}}}};
  for(const p of plans)state.institutional.grading.plans[p.key]=p;
  const document={
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {textContent:'',classList:{add(){},remove(){}}}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const window={addEventListener(){}};
  const context={console,document,window,state,Date,setTimeout(){return 0},clearTimeout(){},save(){},toast(){}};
  vm.runInNewContext(source,context,{filename:'src/v77-boletines-cierres.js'});
  return {api:window.PCIBulletinsV77,state};
}

test('los cierres usan la nota real del Plan y no el ponderado legacy',async()=>{
  const p=plan({groupId:'naturales-c1',planNumber:1,final:'9',weighted:'4.5',completedAt:'2026-05-07'});
  const {api}=await harness([p]);
  assert.equal(api.planGrade(p,'12345678'),'9');
  assert.equal(api.planDate(p,'12345678'),'2026-05-07');
});

test('C1 y C2 del mismo espacio comparten una sola calificación definitiva',async()=>{
  const plans=[
    plan({groupId:'naturales-c1',planNumber:1,final:'8'}),
    plan({groupId:'naturales-c1',planNumber:2,final:'9'}),
    plan({groupId:'naturales-c2',planNumber:1,final:'7'}),
    plan({groupId:'naturales-c2',planNumber:2,final:'8'})
  ];
  const {api}=await harness(plans);
  const [g1,g2]=api.closureGroups();
  assert.equal(api.baseGroupId(g1.groupId),'naturales');
  assert.equal(api.definitiveKey(g1),api.definitiveKey(g2));
  assert.equal(api.definitiveGroups(g1).length,2);
  const d1=api.ensureDefinitive(g1),d2=api.ensureDefinitive(g2);
  assert.equal(d1,d2);
  assert.equal(api.definitiveRowFor(d1,{dni:'12345678'}).final,'');
});

test('la definitiva cuatrimestral no se habilita hasta tener ambos cierres y no se calcula sola',async()=>{
  const plans=[
    plan({groupId:'naturales-c1',planNumber:1,final:'8'}),
    plan({groupId:'naturales-c1',planNumber:2,final:'9'}),
    plan({groupId:'naturales-c2',planNumber:1,final:'7'}),
    plan({groupId:'naturales-c2',planNumber:2,final:'8'})
  ];
  const {api,state}=await harness(plans);
  const [g1,g2]=api.closureGroups();
  assert.equal(api.definitiveReady(g1,{dni:'12345678'}),false);
  state.institutional.grading.closures[g1.key]={rows:{'12345678':{dni:'12345678',final:'8',observation:''}}};
  assert.equal(api.definitiveReady(g1,{dni:'12345678'}),false);
  state.institutional.grading.closures[g2.key]={rows:{'12345678':{dni:'12345678',final:'7',observation:''}}};
  assert.equal(api.definitiveReady(g1,{dni:'12345678'}),true);
  assert.equal(api.definitiveRowFor(api.ensureDefinitive(g1),{dni:'12345678'}).final,'');
});

test('el boletín muestra la definitiva compartida una sola vez, en el segundo cuatrimestre',async()=>{
  const plans=[
    plan({groupId:'naturales-c1',planNumber:1}),
    plan({groupId:'naturales-c1',planNumber:2}),
    plan({groupId:'naturales-c2',planNumber:1}),
    plan({groupId:'naturales-c2',planNumber:2})
  ];
  const {api}=await harness(plans);
  const [g1,g2]=api.closureGroups();
  assert.equal(api.showDefinitiveInBulletin(g1),false);
  assert.equal(api.showDefinitiveInBulletin(g2),true);
});

test('un espacio anual conserva cierre anual y definitiva como datos distintos',async()=>{
  const plans=[1,2,3,4].map(n=>plan({groupId:'matematica-n1',planNumber:n,final:String(5+n),groupType:'troncal'}));
  const {api,state}=await harness(plans);
  const [g]=api.closureGroups();
  const d=api.ensureDefinitive(g);
  const dr=api.definitiveRowFor(d,{dni:'12345678'});
  assert.equal(dr.final,'');
  assert.equal(api.definitiveReady(g,{dni:'12345678'}),false);
  state.institutional.grading.closures[g.key]={rows:{'12345678':{dni:'12345678',final:'8',observation:''}}};
  assert.equal(api.definitiveReady(g,{dni:'12345678'}),true);
  assert.equal(dr.final,'');
});
