import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function attendanceHarness(){
  const source=await readFile(new URL('../src/v78-asistencia.js',import.meta.url),'utf8');
  const state={institutional:{}};
  const head={appendChild(){}};
  const document={
    head,
    addEventListener(){},
    createElement(){return {classList:{add(){},remove(){}},textContent:''}},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
  const window={addEventListener(){},scrollTo(){}};
  const context={
    console,document,Math,Date,state,window,
    save(){},toast(){},setTimeout(){return 0},clearTimeout(){}
  };
  vm.runInNewContext(source,context,{filename:'src/v78-asistencia.js'});
  return {api:window.PCIAttendanceV78,state};
}

const entry=(type,overrides={})=>({
  commissionKey:'sociales|||1|||A',
  dni:'12345678',
  date:'2026-09-20',
  type,
  reason:'',
  justified:false,
  ...overrides
});

test('permite Tarde 0,5 más Ausente a EF 0,5 el mismo día',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('TARDE'));
  api.addRecord(entry('AUSENTE_EF'));
  assert.equal(api.total('12345678','2026-09-20'),1);
  assert.equal(api.records().length,2);
});

test('impide repetir el mismo tipo de falta el mismo día',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('TARDE'));
  assert.throws(()=>api.addRecord(entry('TARDE')),/tipo de falta ya fue registrado/);
  assert.equal(api.records().length,1);
});

test('impide combinar Ausente 1 con cualquier otra falta',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('AUSENTE'));
  assert.throws(()=>api.addRecord(entry('AUSENTE_EF')),/no puede superar 1/);
  assert.throws(()=>api.addRecord(entry('TARDE')),/no puede superar 1/);
  assert.equal(api.total('12345678','2026-09-20'),1);
});

test('impide combinar Ausente con presencia 1 con cualquier otra falta',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('AUSENTE_PRESENCIA'));
  assert.throws(()=>api.addRecord(entry('AUSENTE_EF')),/no puede superar 1/);
  assert.throws(()=>api.addRecord(entry('TARDE')),/no puede superar 1/);
  assert.equal(api.total('12345678','2026-09-20'),1);
});

test('aplica las reglas por DNI y fecha aunque cambie la comisión',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('TARDE'));
  assert.throws(()=>api.addRecord(entry('TARDE',{commissionKey:'sociales|||1|||B'})),/tipo de falta ya fue registrado/);
  api.addRecord(entry('TARDE',{date:'2026-09-21',commissionKey:'sociales|||1|||B'}));
  assert.equal(api.records().length,2);
});

test('conserva la justificación por registro y no la suma como injustificada',async()=>{
  const {api}=await attendanceHarness();
  api.addRecord(entry('AUSENTE',{justified:true}));
  api.addRecord(entry('TARDE',{date:'2026-09-21'}));
  assert.equal(api.conditionFor('12345678').annual,0.5);
  assert.deepEqual(Array.from(api.records(),record=>record.justified),[true,false]);
});

test('la pantalla independiente solo se muestra cuando está activa',async()=>{
  const source=await readFile(new URL('../src/v78-asistencia.js',import.meta.url),'utf8');
  assert.match(source,/#v78Attendance\.screen\{display:none/);
  assert.match(source,/#v78Attendance\.screen\.active\{display:grid/);
});

test('Asistencia se carga en Inicio y ya no forma parte de Gestión',async()=>{
  const [attendance,management,loader]=await Promise.all([
    readFile(new URL('../src/v78-asistencia.js',import.meta.url),'utf8'),
    readFile(new URL('../src/v73-management-home.js',import.meta.url),'utf8'),
    readFile(new URL('../app-safe.html',import.meta.url),'utf8')
  ]);
  assert.match(attendance,/document\.querySelector\('main\.wrap'\)/);
  assert.doesNotMatch(attendance,/v48InstitutionalContent/);
  assert.doesNotMatch(management,/key:'asistencia'/);
  assert.match(loader,/'src\/v78-asistencia\.js'/);
});
