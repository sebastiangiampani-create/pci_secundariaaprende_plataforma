import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function harness(records=[]){
  const source=await readFile(new URL('../src/v79-regularidad.js',import.meta.url),'utf8');
  const state={institutional:{attendance:{records,regularity:{periodsByYear:{}}}}};
  const window={dispatchEvent(){}};
  const context={console,state,window,Date,CustomEvent:class{},save(){}};
  vm.runInNewContext(source,context,{filename:'src/v79-regularidad.js'});
  return {api:window.PCIRegularityV79,state};
}

const r=(date,value=1,overrides={})=>({
  dni:'12345678',date,value,justified:false,type:value===0.5?'TARDE':'AUSENTE',...overrides
});

test('usa los cuatro bimestres oficiales CABA 2026 como configuración predeterminada',async()=>{
  const {api}=await harness();
  assert.deepEqual(JSON.parse(JSON.stringify(api.periodsFor(2026))),[
    {key:'B1',label:'1.º bimestre',start:'2026-03-02',end:'2026-05-07'},
    {key:'B2',label:'2.º bimestre',start:'2026-05-08',end:'2026-07-17'},
    {key:'B3',label:'3.º bimestre',start:'2026-08-03',end:'2026-10-02'},
    {key:'B4',label:'4.º bimestre',start:'2026-10-05',end:'2026-12-04'}
  ]);
  assert.equal(api.periodSource(2026),'official-default');
});

test('exactamente 5 injustificadas bimestrales mantiene Regular',async()=>{
  const {api}=await harness([
    r('2026-03-02'),r('2026-03-03'),r('2026-03-04'),r('2026-03-05'),r('2026-03-06')
  ]);
  const s=api.statusForPeriod('12345678','B1',2026);
  assert.equal(s.bimester,5);
  assert.equal(s.status,'Regular');
  assert.equal(s.bimesterExceeded,false);
});

test('más de 5 injustificadas bimestrales produce No Regular',async()=>{
  const {api}=await harness([
    r('2026-03-02'),r('2026-03-03'),r('2026-03-04'),r('2026-03-05'),r('2026-03-06'),r('2026-03-09',0.5)
  ]);
  const s=api.statusForPeriod('12345678','B1',2026);
  assert.equal(s.bimester,5.5);
  assert.equal(s.status,'No Regular');
  assert.equal(s.bimesterExceeded,true);
});

test('exactamente 20 injustificadas anuales no supera el límite anual',async()=>{
  const dates=[
    '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
    '2026-05-08','2026-05-11','2026-05-12','2026-05-13','2026-05-14',
    '2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07',
    '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
  ];
  const {api}=await harness(dates.map(d=>r(d)));
  const s=api.statusForPeriod('12345678','B4',2026);
  assert.equal(s.annual,20);
  assert.equal(s.annualExceeded,false);
  assert.equal(s.bimester,5);
  assert.equal(s.status,'Regular');
});

test('más de 20 injustificadas anuales produce No Regular',async()=>{
  const dates=[
    '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
    '2026-05-08','2026-05-11','2026-05-12','2026-05-13','2026-05-14',
    '2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07',
    '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
  ];
  const records=dates.map(d=>r(d));
  records.push(r('2026-07-20',0.5));
  const {api}=await harness(records);
  const s=api.summarize('12345678',{asOf:'2026-12-04'});
  assert.equal(s.annual,20.5);
  assert.equal(s.annualExceeded,true);
  assert.equal(s.status,'No Regular');
});

test('las faltas justificadas no computan para regularidad',async()=>{
  const records=[
    r('2026-03-02'),r('2026-03-03'),r('2026-03-04'),r('2026-03-05'),r('2026-03-06'),
    r('2026-03-09',1,{justified:true})
  ];
  const {api}=await harness(records);
  const s=api.statusForPeriod('12345678','B1',2026);
  assert.equal(s.bimester,5);
  assert.equal(s.annual,5);
  assert.equal(s.status,'Regular');
});

test('respeta DNI y fecha de corte sin mezclar estudiantes ni faltas futuras',async()=>{
  const {api}=await harness([
    r('2026-03-02'),
    r('2026-03-03',1,{dni:'87654321'}),
    r('2026-05-08')
  ]);
  const s=api.summarize('12345678',{asOf:'2026-05-07'});
  assert.equal(s.annual,1);
  assert.equal(s.bimester,1);
  assert.equal(s.period.key,'B1');
});

test('permite configurar períodos sin modificar los registros de asistencia',async()=>{
  const records=[r('2026-03-15')];
  const {api,state}=await harness(records);
  api.setPeriods(2026,[
    {key:'P1',label:'Primer período',start:'2026-03-01',end:'2026-06-30'},
    {key:'P2',label:'Segundo período',start:'2026-07-01',end:'2026-12-15'}
  ]);
  assert.equal(api.periodSource(2026),'configured');
  assert.equal(api.periodForDate('2026-03-15').key,'P1');
  assert.equal(state.institutional.attendance.records.length,1);
  assert.equal(state.institutional.attendance.records[0].date,'2026-03-15');
});

test('rechaza períodos superpuestos',async()=>{
  const {api}=await harness();
  assert.throws(()=>api.setPeriods(2026,[
    {key:'A',start:'2026-03-01',end:'2026-05-10'},
    {key:'B',start:'2026-05-10',end:'2026-07-10'}
  ]),/no pueden superponerse/);
});
