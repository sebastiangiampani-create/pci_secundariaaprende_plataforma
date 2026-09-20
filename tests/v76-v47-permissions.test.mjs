import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

test('Desarrollo Curricular permite a docente solo sus áreas autorizadas',async()=>{
  const source=await readFile(new URL('../src/v47-phase2-matrix.js',import.meta.url),'utf8');
  const state={active:'Economía y Administración',maps:{'Economía y Administración':{placements:{},custom:[],phase2V28:{groups:{}}}}};
  const document={
    head:{appendChild(){}},
    createElement(){return {textContent:''}},
    getElementById(){return null},
    querySelector(){return null}
  };
  const window={};
  const context={
    console,state,window,document,
    ensure(o){return state.maps[o]||(state.maps[o]={placements:{},custom:[]})},
    rowDefs(){return[]},byId(){return null},save(){},toast(){},screen(){},
    setTimeout(){return 0},fetch(){throw new Error('no fetch')}
  };
  vm.runInNewContext(source,context,{filename:'src/v47-phase2-matrix.js'});
  const api=window.PCIPhase2V28;
  api.setAccessScope({role:'teacher',teacherId:'t1',allowedAreasByOrientation:{'Economía y Administración':['Matemática']}});
  assert.equal(api.canEditArea('Matemática'),true);
  assert.equal(api.canEditArea('Ciencias Sociales'),false);
  api.setAccessScope({role:'admin'});
  assert.equal(api.canEditArea('Ciencias Sociales'),true);
});

test('Calificaciones reconoce student/family como perfiles sin contextos docentes',async()=>{
  const source=await readFile(new URL('../src/v76-calificaciones.js',import.meta.url),'utf8');
  assert.match(source,/\['admin','teacher','student','family'\]\.includes\(scope\.role\)/);
  assert.match(source,/if\(accessScope\.role==='admin'\)return all/);
  assert.match(source,/if\(accessScope\.role!=='teacher'\|\|!accessScope\.teacherId\)return \[\]/);
  assert.match(source,/No tenés permiso para acceder a Calificaciones/);
});
