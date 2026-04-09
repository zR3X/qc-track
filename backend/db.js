require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "10.55.1.20",
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "qk-cc-muestras",
  waitForConnections: true,
  connectionLimit:    10,
  charset:            "utf8mb4",
  timezone:           "+00:00",   // forzar UTC en la sesión MySQL
});

pool.getConnection()
  .then(conn => { console.log("✓ Conectado a MySQL:", process.env.DB_HOST || "10.55.1.20"); conn.release(); })
  .catch(err => { console.error("✗ Error al conectar a MySQL:", err.message); process.exit(1); });

module.exports = pool;
