const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/ccr/plantas — unión de plantas en muestras (Registo_ccr) y catálogo (materiales)
// para que el desplegable coincida con lo que filtra el listado de muestras.
router.get("/plantas", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT x.planta AS planta
      FROM (
        SELECT DISTINCT TRIM(rc.planta) AS planta
        FROM Registo_ccr rc
        WHERE rc.planta IS NOT NULL AND TRIM(rc.planta) <> ''
        UNION
        SELECT DISTINCT TRIM(\`PLANTA\`) AS planta
        FROM mfg.materiales
        WHERE \`PLANTA\` IS NOT NULL AND TRIM(\`PLANTA\`) <> ''
      ) AS x
      ORDER BY x.planta
    `);
    res.json(rows.map(r => r.planta).filter(Boolean));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener plantas" });
  }
});

// GET /api/ccr/reactores?planta=X
router.get("/reactores", async (req, res) => {
  try {
    const { planta } = req.query;
    let query = `
      SELECT DISTINCT
        \`CODIGO RECURSO\`    AS codigo,
        \`DESCRIPCION REACTOR\` AS nombre,
        \`PLANTA\`            AS planta
      FROM mfg.materiales
      WHERE \`CODIGO RECURSO\` IS NOT NULL AND \`CODIGO RECURSO\` != ''
    `;
    const params = [];
    if (planta) {
      query += " AND `PLANTA` = ?";
      params.push(planta);
    }
    query += " ORDER BY `CODIGO RECURSO`";
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener reactores" });
  }
});

// GET /api/ccr/materiales?reactor=X
router.get("/materiales", async (req, res) => {
  try {
    const { reactor } = req.query;
    if (!reactor) return res.status(400).json({ error: "Reactor requerido" });
    const [rows] = await db.execute(`
      SELECT
        \`CODIGO\`              AS codigo,
        MIN(\`DESCRIPCION\`)    AS nombre,
        MIN(\`PLANTA\`)         AS planta,
        \`CODIGO RECURSO\`      AS codigo_reactor,
        MIN(\`DESCRIPCION REACTOR\`) AS nombre_reactor
      FROM mfg.materiales
      WHERE \`CODIGO RECURSO\` = ?
        AND LENGTH(\`CODIGO\`) = 8
        AND \`CODIGO\` REGEXP '^[0-9]{8}$'
      GROUP BY \`CODIGO\`, \`CODIGO RECURSO\`
      ORDER BY \`CODIGO\`
    `, [reactor]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener materiales" });
  }
});

// GET /api/ccr/empleados?q=123  — búsqueda parcial por número
router.get("/empleados", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !/^\d{1,4}$/.test(q)) return res.json([]);
    const [rows] = await db.execute(`
      SELECT
        \`NUMERO DE EMPLEADO\` AS numero,
        \`NOMBRE\`             AS nombre,
        \`APELLIDO\`           AS apellido
      FROM descripciones_1.master
      WHERE \`NUMERO DE EMPLEADO\` LIKE ?
      ORDER BY \`NUMERO DE EMPLEADO\`
      LIMIT 8
    `, [`${q}%`]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al buscar empleados" });
  }
});

// GET /api/ccr/empleado/:numero — búsqueda exacta
router.get("/empleado/:numero", async (req, res) => {
  try {
    const { numero } = req.params;
    if (!/^\d{1,4}$/.test(numero)) {
      return res.status(400).json({ error: "Número de empleado inválido" });
    }
    const [rows] = await db.execute(`
      SELECT
        \`NUMERO DE EMPLEADO\` AS numero,
        \`NOMBRE\`             AS nombre,
        \`APELLIDO\`           AS apellido
      FROM descripciones_1.master
      WHERE \`NUMERO DE EMPLEADO\` = ?
      LIMIT 1
    `, [numero]);
    if (!rows.length) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al buscar empleado" });
  }
});

// GET /api/ccr/notificaciones — muestras no leídas (noti=1)
router.get("/notificaciones", authMiddleware(["analyst", "admin"]), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT m.id, m.codigo AS code, m.nombre_producto AS product_name,
             m.creado_en AS created_at,
             rc.nombre_material, rc.codigo_orden
      FROM Registo_ccr rc
      JOIN muestras m ON m.id = rc.muestra_id
      WHERE rc.noti = 1
      ORDER BY m.creado_en DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
});

// PUT /api/ccr/notificaciones/leer — marcar como leídas (noti=0)
router.put("/notificaciones/leer", authMiddleware(["analyst", "admin"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids requeridos" });
    const placeholders = ids.map(() => "?").join(",");
    await db.execute(
      `UPDATE Registo_ccr SET noti = 0 WHERE muestra_id IN (${placeholders})`,
      ids
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al marcar leídas" });
  }
});

module.exports = router;
