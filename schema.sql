-- ============================================================
--  Penca Mundial 2026 – Schema MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS penca2026 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE penca2026;

-- ── USUARIOS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  alias      VARCHAR(30)  NOT NULL UNIQUE,
  nombre     VARCHAR(80)  NOT NULL,
  password   VARCHAR(255) NOT NULL,   -- bcrypt hash en producción
  rol        ENUM('J','A') NOT NULL DEFAULT 'J',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── FIXTURE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partidos (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  grupo    CHAR(1)      NULL,
  fase     VARCHAR(20)  NOT NULL,
  local    VARCHAR(50)  NOT NULL DEFAULT 'A definir',
  flag_l   VARCHAR(20)  NOT NULL DEFAULT 'un',
  visita   VARCHAR(50)  NOT NULL DEFAULT 'A definir',
  flag_v   VARCHAR(20)  NOT NULL DEFAULT 'un',
  fecha    DATETIME     NOT NULL,
  sede     VARCHAR(80)  NULL,
  estado   ENUM('PENDIENTE','FINALIZADO') NOT NULL DEFAULT 'PENDIENTE',
  real_l   TINYINT UNSIGNED NULL,
  real_v   TINYINT UNSIGNED NULL
);

-- ── PREDICCIONES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predicciones (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  partido_id INT NOT NULL,
  goles_l    TINYINT UNSIGNED NOT NULL,
  goles_v    TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pred (usuario_id, partido_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (partido_id) REFERENCES partidos(id) ON DELETE CASCADE
);

-- ── BONUS: RESPUESTAS DE LOS JUGADORES ───────────────────────
CREATE TABLE IF NOT EXISTS bonus_respuestas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT         NOT NULL,
  tipo       ENUM('campeon','sub','goleador','arquero') NOT NULL,
  valor      VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_bonus (usuario_id, tipo),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ── BONUS: RESULTADOS REALES (admin los carga) ───────────────
CREATE TABLE IF NOT EXISTS bonus_resultados (
  tipo  ENUM('campeon','sub','goleador','arquero') PRIMARY KEY,
  valor VARCHAR(80) NOT NULL DEFAULT ''
);

-- ── DATOS INICIALES ───────────────────────────────────────────

-- Usuarios demo (contraseñas en texto plano; usar bcrypt en producción)
INSERT IGNORE INTO usuarios (alias, nombre, password, rol) VALUES
  ('carlitos', 'Carlos Garcia', '1234',      'J'),
  ('mari23',   'Maria Lopez',   '1234',      'J'),
  ('juanpe',   'Juan Perez',    '1234',      'J'),
  ('admin',    'Administrador', 'admin2026', 'A');

-- Bonus resultados vacíos
INSERT IGNORE INTO bonus_resultados (tipo, valor) VALUES
  ('campeon',  ''),
  ('sub',      ''),
  ('goleador', ''),
  ('arquero',  '');
