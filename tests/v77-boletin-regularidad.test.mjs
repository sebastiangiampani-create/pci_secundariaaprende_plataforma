import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(summary){
  const source=await readFile(new URL('../src/v77-boletines-cierres.js',import.meta.url),'utf8');
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
    PCIRegularityV79:{summarize(){return summary}}
  };
  const context={
    console,document,window,
    state:{institutional:{}},
    Date,setTimeout(){return 0},clearTimeout(){},
    save(){},toast(){}
  };
  vm.runInNewContext(source,context,{filename:'src/v77-boletines-cierres.js'});
  return window.PCIBulletinsV77;
}

test('boletín familiar muestra la calificación cuando el estudiante está Regular',async()=>{
  const api=await harness({regular:true,status:'Regular'});
  assert.equal(api.familyGrade('9',{regular:true}),'9');
  assert.equal(api.familyGrade('',{regular:true}),'—');
});

test('boletín familiar reemplaza visualmente la calificación por No Regular',async()=>{
  const api=await harness({regular:false,status:'No Regular'});
  assert.equal(api.familyGrade('9',{regular:false}),'No Regular');
  assert.equal(api.familyGrade('6',{regular:false}),'No Regular');
});

test('la consulta de regularidad delega en el motor V79 sin modificar notas',async()=>{
  const expected={regular:false,status:'No Regular',annual:6,bimester:6,asOf:'2026-09-20'};
  const api=await harness(expected);
  const result=api.regularityFor('12345678','2026-09-20');
  assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);
});
