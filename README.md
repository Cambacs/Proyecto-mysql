# Penca Mundial 2026 – Full Stack

Frontend HTML/JS + Backend Node.js/Express + Base de datos MySQL

---

## Estructura del proyecto

```
penca2026/
├── schema.sql                  ← Schema + datos iniciales MySQL
├── frontend/
│   └── public/
│       └── index.html          ← App completa (servida por Express)
└── backend/
    ├── server.js               ← API REST (Express)
    ├── db.js                   ← Pool de conexiones MySQL
    ├── scoring.js              ← Lógica de puntaje
    ├── seed.js                 ← Carga el fixture completo
    ├── package.json
    └── .env.example            ← Variables de entorno (copiar a .env)
```

---

## Requisitos

- Node.js 18+
- MySQL 8+ (o MariaDB 10.6+)

---

## Setup paso a paso

### 1. Crear la base de datos

```bash
mysql -u root -p < schema.sql
```

Esto crea la base `penca2026`, las tablas, y los 4 usuarios demo:

| Alias    | Contraseña | Rol    |
|----------|------------|--------|
| carlitos | 1234       | Jugador|
| mari23   | 1234       | Jugador|
| juanpe   | 1234       | Jugador|
| admin    | admin2026  | Admin  |

### 2. Configurar el backend

```bash
cd backend
cp .env.example .env
```

Editar `.env` con tus credenciales de MySQL:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=penca2026
SESSION_SECRET=cualquier_string_largo
PORT=3000
```

### 3. Instalar dependencias

```bash
cd backend
npm install
```

### 4. Cargar el fixture

```bash
node seed.js
```

Carga los 103 partidos del Mundial 2026 (72 de grupos + 31 eliminatorias).

### 5. Arrancar el servidor

```bash
npm start
# o en desarrollo:
npm run dev
```

Abrir en el navegador: **http://localhost:3000**

---

## API REST

Todas las rutas requieren sesión activa (cookie de sesión).

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | `{ alias, password }` |
| POST | `/api/auth/logout` | — |
| GET  | `/api/auth/me` | Usuario de la sesión actual |

### Jugador
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/fixture` | Todos los partidos + mi predicción |
| POST | `/api/predicciones` | `{ partido_id, goles_l, goles_v }` |
| GET  | `/api/ranking` | Tabla de posiciones |
| GET  | `/api/historial/:uid` | Historial de partidos finalizados |
| GET  | `/api/bonus` | Mis predicciones bonus + resultados |
| POST | `/api/bonus` | `{ tipo, valor }` |

### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| PUT    | `/api/admin/partidos/:id` | Cargar resultado `{ real_l, real_v }` |
| PUT    | `/api/admin/partidos/:id/equipos` | Asignar equipos eliminatorias |
| PUT    | `/api/admin/bonus` | Cargar respuesta correcta de bonus |
| GET    | `/api/admin/usuarios` | Listar participantes |
| POST   | `/api/admin/usuarios` | Crear jugador `{ alias, nombre, password }` |
| DELETE | `/api/admin/usuarios/:id` | Eliminar jugador |
| GET    | `/api/admin/stats` | Estadísticas generales |

---

## Sistema de puntaje

| Fase        | Resultado exacto | Ganador correcto |
|-------------|:----------------:|:----------------:|
| Grupos      | 3 pts            | 1 pt             |
| Ronda de 32 | 6 pts            | 2 pts            |
| Octavos     | 9 pts            | 3 pts            |
| Cuartos     | 12 pts           | 4 pts            |
| Semifinales | 15 pts           | 5 pts            |
| Final       | 18 pts           | 6 pts            |

**Bonus:**
- Campeón del mundo: 15 pts
- Subcampeón: 8 pts
- Goleador del torneo: 8 pts
- Mejor arquero: 5 pts

---

## Notas de seguridad (para producción)

- Las contraseñas están en texto plano en esta versión. Reemplazar con `bcrypt`:
  ```bash
  npm install bcrypt
  ```
  Y en `server.js` usar `bcrypt.hash()` al crear usuarios y `bcrypt.compare()` al hacer login.

- Cambiar `SESSION_SECRET` por un string aleatorio largo.
- Usar HTTPS en producción.
- Restringir el origen en la configuración de CORS.
