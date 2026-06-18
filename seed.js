// backend/seed.js – Carga el fixture completo del Mundial 2026 en MySQL
// Ejecutar UNA sola vez: node seed.js
require('dotenv').config();
const pool = require('./db');

const GR = {
  A: { n: ['Mexico','Sudafrica','Corea del Sur','Rep. Checa'],        c: ['mx','za','kr','cz'] },
  B: { n: ['Canada','Bosnia','Qatar','Suiza'],                        c: ['ca','ba','qa','ch'] },
  C: { n: ['Brasil','Marruecos','Haiti','Escocia'],                   c: ['br','ma','ht','gb-sct'] },
  D: { n: ['Estados Unidos','Paraguay','Australia','Turquia'],        c: ['us','py','au','tr'] },
  E: { n: ['Alemania','Curazao','C. de Marfil','Ecuador'],            c: ['de','cw','ci','ec'] },
  F: { n: ['Paises Bajos','Japon','Suecia','Tunez'],                  c: ['nl','jp','se','tn'] },
  G: { n: ['Belgica','Egipto','Iran','N. Zelanda'],                   c: ['be','eg','ir','nz'] },
  H: { n: ['Espana','Cabo Verde','Arabia Saudita','Uruguay'],         c: ['es','cv','sa','uy'] },
  I: { n: ['Francia','Senegal','Noruega','Irak'],                     c: ['fr','sn','no','iq'] },
  J: { n: ['Argentina','Argelia','Austria','Jordania'],               c: ['ar','dz','at','jo'] },
  K: { n: ['Portugal','Colombia','Uzbekistan','RD Congo'],            c: ['pt','co','uz','cd'] },
  L: { n: ['Inglaterra','Croacia','Ghana','Panama'],                  c: ['gb-eng','hr','gh','pa'] }
};

const SEDES = [
  'MetLife Stadium, NJ','AT&T Stadium, Dallas','SoFi Stadium, LA','NRG Stadium, Houston',
  'Mercedes-Benz Stadium, Atlanta','Lumen Field, Seattle','Gillette Stadium, Boston',
  'Hard Rock Stadium, Miami','BC Place, Vancouver','BMO Field, Toronto',
  'Estadio Azteca, CDMX','Estadio Akron, Guadalajara','Estadio BBVA, Monterrey',
  'Arrowhead Stadium, Kansas City',"Levi's Stadium, San Francisco",'Lincoln Financial, Philadelphia'
];

function pad(n) { return n < 10 ? '0' + n : '' + n; }

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Limpia fixture anterior
    await conn.query('DELETE FROM predicciones');
    await conn.query('DELETE FROM partidos');
    await conn.query('ALTER TABLE partidos AUTO_INCREMENT = 1');

    const rows = [];
    const combos = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    let fid = 1;

    // ── Fase de Grupos ────────────────────────────────────────
    for (const letra of Object.keys(GR)) {
      const g = GR[letra];
      for (const [a, b] of combos) {
        const d = new Date(Date.UTC(2026, 5, 11 + Math.floor((fid-1)/8), 13 + ((fid-1)%4)*3));
        rows.push([letra, 'Grupos', g.n[a], g.c[a], g.n[b], g.c[b],
          d.toISOString().slice(0,19).replace('T',' '),
          null,
          fid === 1 ? 'FINALIZADO' : 'PENDIENTE',
          fid === 1 ? 2 : null,
          fid === 1 ? 0 : null
        ]);
        fid++;
      }
    }

    // ── Eliminatorias ─────────────────────────────────────────
    const elimFases = [
      { fase: 'Ronda de 32', n: 16, base: new Date(Date.UTC(2026,5,28)) },
      { fase: 'Octavos',     n: 8,  base: new Date(Date.UTC(2026,6,5))  },
      { fase: 'Cuartos',     n: 4,  base: new Date(Date.UTC(2026,6,11)) },
      { fase: 'Semifinales', n: 2,  base: new Date(Date.UTC(2026,6,14)) },
      { fase: 'Final',       n: 1,  base: new Date(Date.UTC(2026,6,19)) }
    ];
    let si = 0;
    for (const ef of elimFases) {
      for (let i = 0; i < ef.n; i++) {
        const d = new Date(ef.base.getTime() + Math.floor(i/2)*86400000);
        d.setUTCHours(18);
        rows.push([null, ef.fase, 'A definir','un','A definir','un',
          d.toISOString().slice(0,19).replace('T',' '),
          SEDES[si % SEDES.length],
          'PENDIENTE', null, null
        ]);
        fid++; si++;
      }
    }

    await conn.query(
      `INSERT INTO partidos (grupo,fase,local,flag_l,visita,flag_v,fecha,sede,estado,real_l,real_v) VALUES ?`,
      [rows]
    );

    await conn.commit();
    console.log(`✅ Fixture cargado: ${rows.length} partidos`);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error en seed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
