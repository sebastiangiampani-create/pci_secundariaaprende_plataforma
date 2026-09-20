import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLaboratoryHours,
  validateThirdYearSocials,
  validateElectivity,
  availableContentsForPlan
} from "../src/rules-v2.js";

test("un laboratorio admite hasta 9 horas cátedra", () => {
  assert.equal(validateLaboratoryHours(9).ok, true);
  assert.equal(validateLaboratoryHours(9.5).ok, false);
});

test("Sociales 3.º con FO independiente admite las cuatro juntas", () => {
  const result = validateThirdYearSocials({
    fgInFoLab: [],
    fgLabs: [["Historia", "Geografía", "FEC", "Economía"]]
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "fo_independiente");
});

test("Sociales 3.º con FO independiente admite dos pares", () => {
  const result = validateThirdYearSocials({
    fgInFoLab: [],
    fgLabs: [["Historia", "Geografía"], ["FEC", "Economía"]]
  });
  assert.equal(result.ok, true);
});

test("Sociales 3.º articulado exige una FG en FO y las tres restantes juntas", () => {
  const result = validateThirdYearSocials({
    fgInFoLab: ["Historia"],
    fgLabs: [["Geografía", "FEC", "Economía"]]
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "fo_articulado");
});

test("Sociales 3.º no permite dejar una materia FG aislada", () => {
  const result = validateThirdYearSocials({
    fgInFoLab: [],
    fgLabs: [["Historia", "Geografía", "FEC"], ["Economía"]]
  });
  assert.equal(result.ok, false);
});

test("la electividad no existe en Fase 1", () => {
  const result = validateElectivity({ phase: 1, twinComplete: true });
  assert.equal(result.ok, false);
  assert.equal(result.elective, false);
});

test("en Fase 2 el mellizo incompleto mantiene el espacio obligatorio", () => {
  const result = validateElectivity({ phase: 2, twinComplete: false });
  assert.equal(result.ok, true);
  assert.equal(result.elective, false);
});

test("en Fase 2 el mellizo completo activa electividad", () => {
  const result = validateElectivity({ phase: 2, twinComplete: true });
  assert.equal(result.elective, true);
});

test("los contenidos de profundización llegan a los planes", () => {
  const result = availableContentsForPlan({ prioritized: ["P1"], deepening: ["D1", "D2"] });
  assert.deepEqual(result, ["P1", "D1", "D2"]);
});
