// backend/scoring.js – lógica de puntaje (idéntica a la del frontend)

const FASES_CONFIG = {
  'Grupos':      { ex: 3,  gan: 1 },
  'Ronda de 32': { ex: 6,  gan: 2 },
  'Octavos':     { ex: 9,  gan: 3 },
  'Cuartos':     { ex: 12, gan: 4 },
  'Semifinales': { ex: 15, gan: 5 },
  'Final':       { ex: 18, gan: 6 }
};

const BONUS_ITEMS = [
  { k: 'campeon',  t: 'Campeon del mundo',             pts: 15 },
  { k: 'sub',      t: 'Subcampeon',                    pts: 8  },
  { k: 'goleador', t: 'Goleador del torneo',           pts: 8  },
  { k: 'arquero',  t: 'Mejor arquero (Guante de Oro)', pts: 5  }
];

/**
 * Calcula puntos de una predicción individual.
 * @returns {number|null} null si el partido no tiene resultado aún, 0..ex en caso contrario
 */
function calcPts(predL, predV, realL, realV, fase) {
  if (realL === null || realL === undefined) return null;
  if (predL === null || predL === undefined) return 0;
  const f = FASES_CONFIG[fase] || FASES_CONFIG['Grupos'];
  const gl = parseInt(predL), gv = parseInt(predV);
  if (gl === realL && gv === realV) return f.ex;
  if ((gl > gv && realL > realV) || (gl < gv && realL < realV) || (gl === gv && realL === realV)) return f.gan;
  return 0;
}

module.exports = { calcPts, FASES_CONFIG, BONUS_ITEMS };
