// backend/db.js – pool de conexiones MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'penca2026',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00'
});

// Verifica conexión al arrancar
pool.getConnection()
  .then(conn => { console.log('✅ MySQL conectado'); conn.release(); })
  .catch(err => { console.error('❌ Error MySQL:', err.message); process.exit(1); });

module.exports = pool;
