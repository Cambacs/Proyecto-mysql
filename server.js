// backend/server.js – API REST de Penca Mundial 2026
require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const path     = require('path');
const pool     = require('./db');
const { calcPts, BONUS_ITEMS } = require('./scoring');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 3600 * 1000 }
}));

// Sirve el frontend estático desde /frontend/public
app.use(express.static(path.join(__dirname, '.')));


// ── Guards ────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.rol !== 'A')
    return res.status(403).json({ error: 'Sin permiso' });
  next();
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { alias, password } = req.body;
  if (!alias || !password) return res.status(400).json({ error: 'Faltan campos' });
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE alias = ?', [alias.trim().toLowerCase()]);
  const u = rows[0];
  // En producción: usar bcrypt.compare(password, u.password)
  if (!u || u.password !== password)
    return res.status(401).json({ error: 'Alias o contraseña incorrectos' });
  req.session.user = { id: u.id, alias: u.alias, nombre: u.nombre, rol: u.rol };
  res.json({ id: u.id, alias: u.alias, nombre: u.nombre, rol: u.rol });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.session.user));

// ══════════════════════════════════════════════════════════════
//  FIXTURE
// ══════════════════════════════════════════════════════════════

// GET /api/fixture  (con predicción del usuario autenticado si es jugador)
app.get('/api/fixture', requireAuth, async (req, res) => {
  const uid = req.session.user.id;
  const [partidos] = await pool.query('SELECT * FROM partidos ORDER BY id');
  let predsMap = {};
  if (req.session.user.rol === 'J') {
    const [preds] = await pool.query(
      'SELECT partido_id, goles_l, goles_v FROM predicciones WHERE usuario_id = ?', [uid]);
    preds.forEach(p => { predsMap[p.partido_id] = { gl: p.goles_l, gv: p.goles_v }; });
  }
  const data = partidos.map(p => ({
    ...p,
    miPred: predsMap[p.id] || null
  }));
  res.json(data);
});

// ══════════════════════════════════════════════════════════════
//  PREDICCIONES
// ══════════════════════════════════════════════════════════════

// POST /api/predicciones  { partido_id, goles_l, goles_v }
app.post('/api/predicciones', requireAuth, async (req, res) => {
  if (req.session.user.rol !== 'J') return res.status(403).json({ error: 'Solo jugadores' });
  const { partido_id, goles_l, goles_v } = req.body;
  if (partido_id === undefined || goles_l === undefined || goles_v === undefined)
    return res.status(400).json({ error: 'Faltan datos' });

  const [rows] = await pool.query('SELECT estado FROM partidos WHERE id = ?', [partido_id]);
  if (!rows[0]) return res.status(404).json({ error: 'Partido no encontrado' });
  if (rows[0].estado === 'FINALIZADO')
    return res.status(400).json({ error: 'El partido ya finalizó' });

  await pool.query(
    `INSERT INTO predicciones (usuario_id, partido_id, goles_l, goles_v) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE goles_l=VALUES(goles_l), goles_v=VALUES(goles_v)`,
    [req.session.user.id, partido_id, goles_l, goles_v]
  );
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
//  RANKING
// ══════════════════════════════════════════════════════════════

// GET /api/ranking
app.get('/api/ranking', requireAuth, async (req, res) => {
  const [jugadores] = await pool.query("SELECT * FROM usuarios WHERE rol='J'");
  const [partidos]  = await pool.query("SELECT * FROM partidos");
  const [todasPreds] = await pool.query("SELECT * FROM predicciones");
  const [bonusResp]  = await pool.query("SELECT * FROM bonus_respuestas");
  const [bonusRes]   = await pool.query("SELECT * FROM bonus_resultados");

  const bonusResMap = {};
  bonusRes.forEach(r => { bonusResMap[r.tipo] = r.valor.toLowerCase(); });

  const ranking = jugadores.map(u => {
    const misPreds = {};
    todasPreds.filter(p => p.usuario_id === u.id).forEach(p => {
      misPreds[p.partido_id] = { gl: p.goles_l, gv: p.goles_v };
    });

    let pts = 0, exactos = 0;
    partidos.filter(p => p.estado === 'FINALIZADO').forEach(p => {
      const pr = misPreds[p.id];
      const v  = calcPts(pr?.gl, pr?.gv, p.real_l, p.real_v, p.fase);
      if (v) {
        pts += v;
        if (pr && parseInt(pr.gl) === p.real_l && parseInt(pr.gv) === p.real_v) exactos++;
      }
    });

    // Bonus
    let bonusPts = 0;
    const miBonus = {};
    bonusResp.filter(b => b.usuario_id === u.id).forEach(b => { miBonus[b.tipo] = b.valor.toLowerCase(); });
    BONUS_ITEMS.forEach(item => {
      if (miBonus[item.k] && bonusResMap[item.k] && miBonus[item.k] === bonusResMap[item.k])
        bonusPts += item.pts;
    });

    const pendientes = partidos.filter(p => p.estado === 'PENDIENTE').length;
    const cargadas   = Object.keys(misPreds).length;

    return {
      id: u.id, alias: u.alias, nombre: u.nombre,
      pts: pts + bonusPts, pts_pred: pts, pts_bonus: bonusPts,
      exactos,
      participacion: pendientes > 0 ? Math.round(cargadas / Math.max(pendientes,1) * 100) : 0
    };
  }).sort((a,b) => b.pts - a.pts || b.exactos - a.exactos);

  res.json(ranking);
});

// GET /api/historial/:uid  (jugador ve el propio, admin ve cualquiera)
app.get('/api/historial/:uid', requireAuth, async (req, res) => {
  const uid = parseInt(req.params.uid);
  if (req.session.user.rol === 'J' && req.session.user.id !== uid)
    return res.status(403).json({ error: 'Sin permiso' });

  const [partidos] = await pool.query(
    `SELECT p.*, pr.goles_l AS pred_l, pr.goles_v AS pred_v
     FROM partidos p
     LEFT JOIN predicciones pr ON pr.partido_id = p.id AND pr.usuario_id = ?
     WHERE p.estado = 'FINALIZADO'
     ORDER BY p.id`, [uid]);

  const result = partidos.map(p => ({
    ...p,
    pts: calcPts(p.pred_l, p.pred_v, p.real_l, p.real_v, p.fase)
  }));
  res.json(result);
});

// ══════════════════════════════════════════════════════════════
//  BONUS
// ══════════════════════════════════════════════════════════════

// GET /api/bonus  – las predicciones de bonus del usuario + resultados reales
app.get('/api/bonus', requireAuth, async (req, res) => {
  const uid = req.session.user.id;
  const [resp] = await pool.query('SELECT tipo, valor FROM bonus_respuestas WHERE usuario_id = ?', [uid]);
  const [res2]  = await pool.query('SELECT tipo, valor FROM bonus_resultados');
  const miBonus = {};
  resp.forEach(r => { miBonus[r.tipo] = r.valor; });
  const resultados = {};
  res2.forEach(r => { resultados[r.tipo] = r.valor; });
  res.json({ respuestas: miBonus, resultados });
});

// POST /api/bonus  { tipo, valor }
app.post('/api/bonus', requireAuth, async (req, res) => {
  if (req.session.user.rol !== 'J') return res.status(403).json({ error: 'Solo jugadores' });
  const { tipo, valor } = req.body;
  const tipos = ['campeon','sub','goleador','arquero'];
  if (!tipos.includes(tipo) || !valor)
    return res.status(400).json({ error: 'Datos inválidos' });
  await pool.query(
    `INSERT INTO bonus_respuestas (usuario_id, tipo, valor) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE valor=VALUES(valor)`,
    [req.session.user.id, tipo, valor.trim()]
  );
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
//  ADMIN – RESULTADOS
// ══════════════════════════════════════════════════════════════

// PUT /api/admin/partidos/:id  { real_l, real_v }
app.put('/api/admin/partidos/:id', requireAdmin, async (req, res) => {
  const { real_l, real_v } = req.body;
  if (real_l === undefined || real_v === undefined)
    return res.status(400).json({ error: 'Faltan goles' });
  await pool.query(
    "UPDATE partidos SET real_l=?, real_v=?, estado='FINALIZADO' WHERE id=?",
    [real_l, real_v, req.params.id]
  );
  res.json({ ok: true });
});

// PUT /api/admin/partidos/:id/equipos  { local, flag_l, visita, flag_v }  (para eliminatorias)
app.put('/api/admin/partidos/:id/equipos', requireAdmin, async (req, res) => {
  const { local, flag_l, visita, flag_v } = req.body;
  await pool.query(
    'UPDATE partidos SET local=?, flag_l=?, visita=?, flag_v=? WHERE id=?',
    [local, flag_l, visita, flag_v, req.params.id]
  );
  res.json({ ok: true });
});

// PUT /api/admin/bonus  { tipo, valor }
app.put('/api/admin/bonus', requireAdmin, async (req, res) => {
  const { tipo, valor } = req.body;
  const tipos = ['campeon','sub','goleador','arquero'];
  if (!tipos.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  await pool.query('UPDATE bonus_resultados SET valor=? WHERE tipo=?', [valor.trim(), tipo]);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
//  ADMIN – USUARIOS
// ══════════════════════════════════════════════════════════════

// GET /api/admin/usuarios
app.get('/api/admin/usuarios', requireAdmin, async (req, res) => {
  const [rows] = await pool.query("SELECT id,alias,nombre,rol,created_at FROM usuarios ORDER BY id");
  res.json(rows);
});

// POST /api/admin/usuarios  { alias, nombre, password }
app.post('/api/admin/usuarios', requireAdmin, async (req, res) => {
  const { alias, nombre, password } = req.body;
  if (!alias || !nombre || !password)
    return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(
      "INSERT INTO usuarios (alias,nombre,password,rol) VALUES (?,?,?,'J')",
      [alias.trim().toLowerCase(), nombre.trim(), password]
    );
    res.json({ id: r.insertId, alias, nombre, rol: 'J' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El alias ya existe' });
    throw e;
  }
});

// DELETE /api/admin/usuarios/:id
app.delete('/api/admin/usuarios/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.session.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  await pool.query('DELETE FROM usuarios WHERE id=?', [id]);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
//  ADMIN – ESTADO GENERAL
// ══════════════════════════════════════════════════════════════

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [[{ jugados }]]   = await pool.query("SELECT COUNT(*) AS jugados  FROM partidos WHERE estado='FINALIZADO'");
  const [[{ pendientes }]]= await pool.query("SELECT COUNT(*) AS pendientes FROM partidos WHERE estado='PENDIENTE'");
  const [[{ jugadores }]] = await pool.query("SELECT COUNT(*) AS jugadores FROM usuarios WHERE rol='J'");
  const [[{ totalPreds }]]= await pool.query(
    "SELECT COUNT(*) AS totalPreds FROM predicciones pr JOIN partidos p ON p.id=pr.partido_id WHERE p.estado='PENDIENTE'");

  const [faseStats] = await pool.query(
    `SELECT fase,
       COUNT(*) AS total,
       SUM(estado='FINALIZADO') AS jugados
     FROM partidos GROUP BY fase`);

  res.json({ jugados, pendientes, jugadores, totalPreds, faseStats });
});

// ── 404 fallback → SPA ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));

});

// ── Arranque ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
