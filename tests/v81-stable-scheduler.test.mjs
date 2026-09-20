import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(rows){
  const source=await readFile(new URL('../src/v81-stable-scheduler.js',import.meta.url),'utf8');
  const state={institutional:{
    teachers:{t1:{id:'t1',name:'Ada'},t2:{id:'t2',name:'Beto'}},
    assignments:{i1:'t1',i2:'t1'},
    areaTeams:{},
    annualScheduleVersions:[],
    activeAnnualScheduleId:'',
    scheduleConfig:{version:2,activeDays:{mon:true,tue:true},slots:[{period:1,start:'08:00',end:'08:40'},{period:2,start:'08:40',end:'09:20'}]},
    availability:{},availabilityPreferences:{},outsideWork:{}
  }};
  const baseReport={ok:true,issues:[],warnings:[],rows,teams:[],outside:[]};
  const elements=new Map();
  const document={
    body:{},
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {textContent:'',innerHTML:'',firstElementChild:null,classList:{add(){},remove(){},toggle(){}},querySelector(){return null}}},
    getElementById(id){return elements.get(id)||null},
    querySelector(){return null}
  };
  let lastToast='';
  const window={
    addEventListener(){},
    PCIAnnualSchedulerV65:{preflight(){return JSON.parse(JSON.stringify(baseReport))},render(){}},
    PCIAutoAreaCoincidenceV54:{deriveTeams(){}},
    PCIAvailabilityPreferencesV60:{available(){return true},penalty(){return 0}},
    PCIScheduleConfigV51:{
      days(){return[['mon','Lunes'],['tue','Martes']]},
      periodCount(){return 2},
      snapshot(){return{version:2,days:[{id:'mon',label:'Lunes'},{id:'tue',label:'Martes'}],slots:state.institutional.scheduleConfig.slots}}
    },
    PCIAnnualOfferV65:{syntheticOutsideRows(){return[]}},
    PCIInstitutionalV48:{allImplementationRows(){return rows}}
  };
  const context={console,window,document,state,MutationObserver:class{observe(){}},setTimeout(){return 0},clearTimeout(){},save(){},toast(m){lastToast=m},Math,Date};
  vm.runInNewContext(source,context,{filename:'src/v81-stable-scheduler.js'});
  return{api:window.PCIScheduleStableV81,state,getToast:()=>lastToast};
}

test('preflight estricto rechaza carga docente distinta entre cuatrimestres',async()=>{
  const rows=[
    {instanceId:'i1',teacherId:'t1',teacherName:'Ada',orientation:'Eco',course:'1.º A',subjectId:'m1',name:'Matemática',hours:2,locations:['C1'],semesters:[1]},
    {instanceId:'i2',teacherId:'t1',teacherName:'Ada',orientation:'Eco',course:'1.º A',subjectId:'m2',name:'Matemática II',hours:1,locations:['C2'],semesters:[2]}
  ];
  const {api}=await harness(rows);
  const r=api.preflight();
  assert.equal(r.ok,false);
  assert.match(r.issues.join('\n'),/carga frente a curso difiere/);
});

test('continuidad detecta posiciones personales diferentes',async()=>{
  const {api}=await harness([]);
  const r=api.continuity([{type:'classpair',day:'mon',period:1,s1:{teacherId:'t1'},s2:{teacherId:'t2'}}]);
  assert.equal(r.ok,false);
  assert.equal(r.total,2);
});

test('continuidad acepta intercambio cruzado en la misma posición anual',async()=>{
  const {api}=await harness([]);
  const entries=[
    {type:'classpair',day:'mon',period:1,s1:{teacherId:'t1'},s2:{teacherId:'t2'}},
    {type:'classpair',day:'mon',period:1,s1:{teacherId:'t2'},s2:{teacherId:'t1'}}
  ];
  assert.equal(api.continuity(entries).ok,true);
});

test('firma de origen cambia cuando cambia una asignación',async()=>{
  const rows=[
    {instanceId:'i1',teacherId:'t1',teacherName:'Ada',orientation:'Eco',course:'1.º A',subjectId:'m1',name:'Matemática',hours:1,locations:['C1','C2'],semesters:[1,2]}
  ];
  const {api,state}=await harness(rows);
  const a=api.sourceSignature();
  state.institutional.assignments.i1='t2';
  const b=api.sourceSignature();
  assert.notEqual(a,b);
});

test('un horario vigente queda desactualizado si cambia Gestión',async()=>{
  const rows=[
    {instanceId:'i1',teacherId:'t1',teacherName:'Ada',orientation:'Eco',course:'1.º A',subjectId:'m1',name:'Matemática',hours:1,locations:['C1','C2'],semesters:[1,2]}
  ];
  const {api,state}=await harness(rows);
  const signature=api.sourceSignature();
  state.institutional.annualScheduleVersions.push({id:'s1',engine:'v81-annual-stable',status:'active',sourceSignature:signature,entries:[]});
  state.institutional.activeAnnualScheduleId='s1';
  assert.equal(api.isStale(),false);
  state.institutional.availabilityPreferences.t1={'mon:1':'unavailable'};
  assert.equal(api.isStale(),true);
  assert.equal(api.status().state,'stale');
});
