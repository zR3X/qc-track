const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Todas las rutas solo para admin
router.use(authMiddleware(["admin"]));

// ── Distribución por estado ───────────────────────────────────────────────
router.get("/status-distribution", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT estado, COUNT(*) AS count
      FROM muestras
      GROUP BY estado
    `);
    const map = { pendiente: "Pendientes", en_proceso: "En proceso", completada: "Completadas", rechazada: "Rechazadas", cancelada: "Canceladas" };
    res.json(rows.map(r => ({ name: map[r.estado] || r.estado, value: Number(r.count), estado: r.estado })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Muestras en el tiempo ─────────────────────────────────────────────────
router.get("/samples-over-time", async (req, res) => {
  try {
    const range = parseInt(req.query.range) || 30;
    const [rows] = await db.execute(`
      SELECT DATE(creado_en) AS date, COUNT(*) AS count
      FROM muestras
      WHERE creado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(creado_en)
      ORDER BY date ASC
    `, [range]);
    res.json(rows.map(r => ({ date: r.date, count: Number(r.count) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Top materiales por nº de muestras ────────────────────────────────────
router.get("/top-materials", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const [rows] = await db.execute(`
      SELECT rc.nombre_material AS material,
             COUNT(*)                                          AS total,
             SUM(m.estado = 'completada')                     AS completadas,
             SUM(m.estado = 'rechazada')                      AS rechazadas,
             SUM(m.estado = 'en_proceso')                     AS en_proceso,
             SUM(m.estado = 'pendiente')                      AS pendientes
      FROM muestras m
      JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE rc.nombre_material IS NOT NULL AND rc.nombre_material != ''
      GROUP BY rc.nombre_material
      ORDER BY total DESC
      LIMIT ?
    `, [limit]);
    res.json(rows.map(r => ({
      material: r.material,
      total:       Number(r.total),
      completadas: Number(r.completadas),
      rechazadas:  Number(r.rechazadas),
      en_proceso:  Number(r.en_proceso),
      pendientes:  Number(r.pendientes),
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Top materiales con más fallos ─────────────────────────────────────────
router.get("/material-failures", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const [rows] = await db.execute(`
      SELECT rc.nombre_material AS material,
             COUNT(*)           AS rechazadas,
             SUM(m.estado = 'completada') AS completadas
      FROM muestras m
      JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE m.estado = 'rechazada'
        AND rc.nombre_material IS NOT NULL AND rc.nombre_material != ''
      GROUP BY rc.nombre_material
      ORDER BY rechazadas DESC
      LIMIT ?
    `, [limit]);
    res.json(rows.map(r => ({
      material:    r.material,
      rechazadas:  Number(r.rechazadas),
      completadas: Number(r.completadas),
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Pasos con más fallos ──────────────────────────────────────────────────
router.get("/step-failures", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT tp.nombre AS step, COUNT(*) AS fallos
      FROM pasos_muestra pm
      JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
      WHERE pm.estado = 'fallido'
      GROUP BY tp.nombre
      ORDER BY fallos DESC
    `);
    res.json(rows.map(r => ({ step: r.step, fallos: Number(r.fallos) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Rendimiento por analista ──────────────────────────────────────────────
router.get("/analyst-performance", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.nombre AS analista,
             COUNT(*)                          AS total,
             SUM(m.estado = 'completada')      AS completadas,
             SUM(m.estado = 'rechazada')       AS rechazadas,
             SUM(m.estado = 'en_proceso')      AS en_proceso
      FROM muestras m
      JOIN usuarios u ON m.asignado_a = u.id
      WHERE u.rol = 'analista'
      GROUP BY u.id, u.nombre
      ORDER BY total DESC
    `);
    res.json(rows.map(r => ({
      analista:    r.analista,
      total:       Number(r.total),
      completadas: Number(r.completadas),
      rechazadas:  Number(r.rechazadas),
      en_proceso:  Number(r.en_proceso),
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Distribución por turno ────────────────────────────────────────────────
router.get("/turno-distribution", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT rc.grupo_turno AS turno, COUNT(*) AS count
      FROM muestras m
      JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE rc.grupo_turno IS NOT NULL AND rc.grupo_turno != ''
      GROUP BY rc.grupo_turno
      ORDER BY count DESC
    `);
    res.json(rows.map(r => ({ turno: r.turno, count: Number(r.count) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
