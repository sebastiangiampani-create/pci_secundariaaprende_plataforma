import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(){
  const source=await readFile(new URL('../src/v80-access-control.js',import.meta.url),'utf8');
  const state={
    active:'Economía y Administración',
    selected:['Economía y Administración','Ciencias Sociales y Humanidades'],
    institutional:{
      teachers:{
        t1:{id:'t1',name:'Ada',email:'ada@escuela.edu'},
        t2:{id:'t2',name:'Beto',email:'beto@escuela.edu'}
      },
      teacherProfiles:{},
      assignments:{
        i1:'t1',
        i2:'t2',
        i3:'t1'
      },
      areaTeams:{},
      students:{
        '11111111':{dni:'11111111',email:'alumno@escuela.edu'},
        '22222222':{dni:'22222222',email:'otro@escuela.edu'}
      },
      commissions:{}
    }
  };
  const rows=[
    {instanceId:'i1',orientation:'Economía y Administración',course:'1.º A',subjectId:'m1'},
    {instanceId:'i2',orientation:'Economía y Administración',course:'1.º B',subjectId:'h1'},
    {instanceId:'i3',orientation:'Ciencias Sociales y Humanidades',course:'2.º A',subjectId:'h2'}
  ];
  const commissionDefs=[
    {key:'eco|||1|||A',orientation:'Economía y Administración',course:'1.º A'},
    {key:'eco|||1|||B',orientation:'Economía y Administración',course:'1.º B'},
    {key:'soc|||2|||A',orientation:'Ciencias Sociales y Humanidades',course:'2.º A'}
  ];
  const groupsByOrientation={
    'Economía y Administración':[
      {id:'matematica-n1',area:'Matemática',subjectIds:['m1']},
      {id:'socialA-c1',area:'Ciencias Sociales',subjectIds:['h1']}
    ],
    'Ciencias Sociales y Humanidades':[
      {id:'socialA-c3',area:'Ciencias Sociales',subjectIds:['h2']}
    ]
  };
  const window={
    addEventListener(){},
    PCIInstitutionalV48:{
      allImplementationRows(){return rows},
      implementationRows(o){return rows.filter(r=>r.orientation===o)}
    },
    PCIStudentsCommissionsV72:{commissionDefs(){return commissionDefs}},
    PCIPhase2V28:{groups(){return groupsByOrientation[state.active]||[]}},
    screen(){},
  };
  const document={
    body:{dataset:{},appendChild(){}},
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {textContent:'',classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []}}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const context={
    console,state,window,document,CustomEvent:class{},
    MutationObserver:class{observe(){} disconnect(){}},
    setTimeout(){return 0},clearTimeout(){},toast(){}
  };
  vm.runInNewContext(source,context,{filename:'src/v80-access-control.js'});
  return {api:window.PCIAppAccessV80,state};
}

test('admin conserva acceso total por defecto',async()=>{
  const {api}=await harness();
  const access=api.derivedAccess();
  assert.equal(access.role,'admin');
  assert.equal(api.canOpen('institutional',access),true);
  assert.equal(api.canOpen('grading',access),true);
  assert.equal(api.canOpen('proposal',access),true);
});

test('docente obtiene solo las comisiones asignadas en Gestión',async()=>{
  const {api}=await harness();
  assert.deepEqual(Array.from(api.teacherCommissionKeys('t1')),['eco|||1|||A','soc|||2|||A']);
  assert.deepEqual(Array.from(api.teacherCommissionKeys('t2')),['eco|||1|||B']);
});

test('docente obtiene Desarrollo Curricular solo de las áreas de sus asignaciones',async()=>{
  const {api}=await harness();
  const areas=api.teacherAreasByOrientation('t1');
  assert.deepEqual(Array.from(areas['Economía y Administración']),['Matemática']);
  assert.deepEqual(Array.from(areas['Ciencias Sociales y Humanidades']),['Ciencias Sociales']);
});

test('docente puede entrar a calificaciones pero no a Gestión institucional',async()=>{
  const {api,state}=await harness();
  const access={role:'teacher',teacherId:'t1',allowedAreasByOrientation:{'Economía y Administración':['Matemática']},commissionKeys:['eco|||1|||A'],studentDnis:[]};
  state.active='Economía y Administración';
  assert.equal(api.canOpen('grading',access),true);
  assert.equal(api.canOpen('v78Attendance',access),true);
  assert.equal(api.canOpen('institutional',access),false);
  assert.equal(api.canOpen('offer',access),true);
  state.active='Ciencias Naturales';
  assert.equal(api.canOpen('offer',access),false);
});

test('estudiante y familia solo pueden abrir Inicio y Boletines',async()=>{
  const {api}=await harness();
  for(const role of ['student','family']){
    const access={role,teacherId:'',studentDnis:['11111111'],allowedAreasByOrientation:{},commissionKeys:[]};
    assert.equal(api.canOpen('home',access),true);
    assert.equal(api.canOpen('bulletins',access),true);
    assert.equal(api.canOpen('grading',access),false);
    assert.equal(api.canOpen('offer',access),false);
    assert.equal(api.canOpen('institutional',access),false);
    assert.equal(api.canOpen('v78Attendance',access),false);
  }
});

test('puede resolver docente y estudiante por email para una sesión futura',async()=>{
  const {api}=await harness();
  assert.equal(api.teacherByEmail('ADA@ESCUELA.EDU').id,'t1');
  assert.deepEqual(Array.from(api.studentDnisByEmail('alumno@escuela.edu')),['11111111']);
});
