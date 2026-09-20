import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(){
  const source=await readFile(new URL('../src/v78-asistencia.js',import.meta.url),'utf8');
  const state={institutional:{}};
  const defs=[
    {key:'eco|||1|||A',course:'1.º A',orientation:'Economía y Administración'},
    {key:'eco|||1|||B',course:'1.º B',orientation:'Economía y Administración'}
  ];
  const document={
    head:{appendChild(){}},
    addEventListener(){},
    createElement(){return {classList:{add(){},remove(){}},textContent:''}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const window={
    addEventListener(){},scrollTo(){},
    PCIStudentsCommissionsV72:{commissionDefs(){return defs},studentsFor(){return[]}}
  };
  const context={console,document,Math,Date,state,window,save(){},toast(){},setTimeout(){return 0},clearTimeout(){}};
  vm.runInNewContext(source,context,{filename:'src/v78-asistencia.js'});
  return window.PCIAttendanceV78;
}

test('admin ve todas las comisiones de Asistencia',async()=>{
  const api=await harness();
  assert.deepEqual(Array.from(api.defs(),x=>x.key),['eco|||1|||A','eco|||1|||B']);
});

test('docente ve solo las comisiones autorizadas',async()=>{
  const api=await harness();
  api.setAccessScope({role:'teacher',commissionKeys:['eco|||1|||B']});
  assert.deepEqual(Array.from(api.defs(),x=>x.key),['eco|||1|||B']);
});

test('familia y estudiante no reciben comisiones de Asistencia',async()=>{
  const api=await harness();
  api.setAccessScope({role:'student'});
  assert.equal(api.defs().length,0);
  api.setAccessScope({role:'family'});
  assert.equal(api.defs().length,0);
});

test('familia no puede registrar asistencia por API',async()=>{
  const api=await harness();
  api.setAccessScope({role:'family'});
  assert.throws(()=>api.addRecord({commissionKey:'eco|||1|||A',dni:'11111111',date:'2026-09-20',type:'AUSENTE',reason:'',justified:false}),/No tenés permiso/);
});
