export const SOCIALS_3_SUBJECTS = Object.freeze(["Historia", "Geografía", "FEC", "Economía"]);
export const MAX_LAB_HOURS = 9;

function normalizeSubjects(subjects = []) {
  return subjects.map(String);
}

function multisetEquals(a, b) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

export function validateLaboratoryHours(hours) {
  const total = Number(hours);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, code: "LAB_HOURS_INVALID", message: "La carga horaria del laboratorio debe ser un número válido." };
  }
  if (total > MAX_LAB_HOURS) {
    return { ok: false, code: "LAB_HOURS_OVER_LIMIT", message: `El laboratorio supera el máximo de ${MAX_LAB_HOURS} horas cátedra.` };
  }
  return { ok: true, code: "OK" };
}

/**
 * Valida únicamente la regla especial acordada para Ciencias Sociales de 3.º.
 *
 * @param {object} input
 * @param {string[]} input.fgInFoLab Materias FG colocadas dentro del laboratorio FO obligatorio.
 * @param {string[][]} input.fgLabs Agrupamientos de materias FG que quedan como laboratorios FG.
 */
export function validateThirdYearSocials({ fgInFoLab = [], fgLabs = [] } = {}) {
  const articulated = normalizeSubjects(fgInFoLab);
  const groups = fgLabs.map(normalizeSubjects);
  const allFg = [...articulated, ...groups.flat()];

  if (!multisetEquals(allFg, SOCIALS_3_SUBJECTS)) {
    return {
      ok: false,
      code: "SOCIALS_3_COVERAGE",
      message: "Historia, Geografía, FEC y Economía deben quedar cubiertas exactamente una vez en la composición de 3.º."
    };
  }

  if (articulated.length === 0) {
    const sizes = groups.map(group => group.length).sort((a, b) => a - b);
    const oneGroup = sizes.length === 1 && sizes[0] === 4;
    const twoPairs = sizes.length === 2 && sizes[0] === 2 && sizes[1] === 2;
    if (!oneGroup && !twoPairs) {
      return {
        ok: false,
        code: "SOCIALS_3_FO_INDEPENDENT_GROUPING",
        message: "Con el laboratorio FO independiente, Sociales de 3.º debe agruparse 4 juntas o en dos grupos de 2 y 2."
      };
    }
    return { ok: true, code: "OK", mode: "fo_independiente" };
  }

  if (articulated.length === 1) {
    if (groups.length !== 1 || groups[0].length !== 3) {
      return {
        ok: false,
        code: "SOCIALS_3_FO_ARTICULATED_GROUPING",
        message: "Si una materia FG articula con el laboratorio FO, las otras tres deben quedar juntas en un único laboratorio FG."
      };
    }
    return { ok: true, code: "OK", mode: "fo_articulado" };
  }

  return {
    ok: false,
    code: "SOCIALS_3_TOO_MANY_FG_IN_FO",
    message: "La regla vigente solo admite una materia FG de Sociales articulada con el laboratorio FO de 3.º."
  };
}

export function validateElectivity({ phase, twinComplete }) {
  if (Number(phase) !== 2) {
    return {
      ok: false,
      elective: false,
      code: "ELECTIVITY_ONLY_PHASE_2",
      message: "La electividad se configura únicamente en Fase 2."
    };
  }
  return twinComplete
    ? { ok: true, elective: true, code: "OK" }
    : {
        ok: true,
        elective: false,
        code: "TWIN_INCOMPLETE",
        message: "Mientras el mellizo no esté completo, el espacio se mantiene obligatorio."
      };
}

export function availableContentsForPlan({ prioritized = [], deepening = [] } = {}) {
  return [...prioritized, ...deepening];
}
