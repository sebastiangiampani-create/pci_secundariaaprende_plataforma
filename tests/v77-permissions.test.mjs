import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(){
  const source=await readFile(new URL('../src/v77-boletines-cierres.js',import.meta.url),'utf8');
  const plans={
    p1:{key:'p1',orientation:'Economía y Administración',groupId:'matematica-n1',groupName:'Matemática',groupType:'troncal',year:1,commissionKey:'eco|||1|||A',course:'1.º A',planNumber:1,planName:'Plan 1',rows:{'11111111':{final:'8',completedAt:'2026-05-07'}}},
    p2:{key:'p2',orientation:'Economía y Administración',groupId:'socialA-c1',groupName:'Sociales',groupType:'laboratorio',year:1,commissionKey:'eco|||1|||A',course:'1.º A',planNumber:1,planName:'Plan 1',rows:{'11111111':{final:'9',completedAt:'2026-05-07'}}}
  };
  const state={
    school:'Escuela',
    institutional:{
      teachers:{t1:{id:'t1',name:'Ada'},t2:{id:'t2',name:'Beto'}},
      assignments:{i1:'t1',i2:'t2'},
      students:{'11111111':{dni:'11111111',firstName:'Ana',lastName:'Alumno'}},
      commissions:{'eco|||1|||A':{key:'eco|||1|||A',orientation:'Economía y Administración',course:'1.º A',students:['11111111']}},
      grading:{
        plans,
        closures:{
          'Economía y Administración|||matematica-n1|||eco|||1|||A':{key:'Economía y Administración|||matematica-n1|||eco|||1|||A',type:'Cierre cuatrimestral',status:'publicado',rows:{'11111111':{dni:'11111111',final:'8',observation:''}}},
          'Economía y Administración|||socialA-c1|||eco|||1|||A':{key:'Economía y Administración|||socialA-c1|||eco|||1|||A',type:'Cierre cuatrimestral',status:'revision',rows:{'11111111':{dni:'11111111',final:'9',observation:''}}}
        },
        definitives:{},
        settings:{showCriteriaToFamilies:false}
      }
    }
  };
  const contexts=[
    {orientation:'Economía y Administración',group:{id:'matematica-n1',subjectIds:['m1']},commission:{key:'eco|||1|||A'}},
    {orientation:'Economía y Administración',group:{id:'socialA-c1',subjectIds:['h1']},commission:{key:'eco|||1|||A'}}
  ];
  const document={
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {textContent:'',classList:{add(){},remove(){}}}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const window={
    addEventListener(){},
    PCIGradingV76:{allContexts(){return contexts}},
    PCIInstitutionalV48:{implementationRows(){return[
      {instanceId:'i1',course:'1.º A',subjectId:'m1'},
      {instanceId:'i2',course:'1.º A',subjectId:'h1'}
    ]}}
  };
  const context={console,document,window,state,Date,setTimeout(){return 0},clearTimeout(){},save(){},toast(){}};
  vm.runInNewContext(source,context,{filename:'src/v77-boletines-cierres.js'});
  return {api:window.PCIBulletinsV77,state};
}

test('docente ve cierres solo de los espacios asignados en Gestión',async()=>{
  const {api}=await harness();
  api.setAccessScope({role:'teacher',teacherId:'t1'});
  assert.deepEqual(Array.from(api.visibleClosureGroups(),g=>g.groupId),['matematica-n1']);
});

test('familia no accede al backoffice de cierres',async()=>{
  const {api}=await harness();
  api.setAccessScope({role:'family',studentDnis:['11111111']});
  assert.equal(api.visibleClosureGroups().length,0);
});

test('familia recibe únicamente cierres publicados del estudiante vinculado',async()=>{
  const {api}=await harness();
  const rows=api.publishedGroupsForStudent('11111111');
  assert.deepEqual(Array.from(rows,g=>g.groupId),['matematica-n1']);
});

test('leer un boletín publicado no crea ni modifica filas internas',async()=>{
  const {api,state}=await harness();
  const group=api.publishedGroupsForStudent('11111111')[0];
  const student=state.institutional.students['11111111'];
  const before=JSON.stringify(state.institutional.grading);
  const rows=api.studentBulletinRows(group,student,true);
  const after=JSON.stringify(state.institutional.grading);
  assert.equal(rows.length,1);
  assert.equal(rows[0].final,'8');
  assert.equal(before,after);
});
