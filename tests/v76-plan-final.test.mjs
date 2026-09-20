import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('Calificaciones deja de usar ponderación automática legacy',async()=>{
  const source=await readFile(new URL('../src/v76-calificaciones.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/calcWeighted/);
  assert.doesNotMatch(source,/Ponderación %/);
  assert.doesNotMatch(source,/Calificación ponderada/);
});

test('cada Plan finalizado conserva fecha de finalización',async()=>{
  const source=await readFile(new URL('../src/v76-calificaciones.js',import.meta.url),'utf8');
  assert.match(source,/completedAt/);
  assert.match(source,/Fecha de finalización/);
  assert.match(source,/type="date" data-v76-field="completedAt"/);
});

test('la exportación e importación Excel conservan la fecha de finalización',async()=>{
  const source=await readFile(new URL('../src/v76-calificaciones.js',import.meta.url),'utf8');
  assert.match(source,/o\['Fecha de finalización'\]=r\.completedAt\|\|''/);
  assert.match(source,/raw\['Fecha de finalización'\]/);
});
