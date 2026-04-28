const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function toApiStep(r) {
  return {
    id:          r.id,
    name:        r.nombre,
    description: r.descripcion,
    order_index: r.orden,
    color:       r.color,
    active:      r.activo,
  };
}

router.get("/", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM tipos_paso WHERE activo=1 ORDER BY orden"
    );
    res.json(rows.map(toApiStep));
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: "Nombre requerido" });
    const [[{ max }]] = await db.execute("SELECT MAX(orden) as max FROM tipos_paso");
    const maxOrder = max || 0;
    const [result] = await db.execute(
      "INSERT INTO tipos_paso (nombre, descripcion, orden, color) VALUES (?,?,?,?)",
      [name, description || null, maxOrder + 1, color || "#3B82F6"]
    );
    const [rows] = await db.execute("SELECT * FROM tipos_paso WHERE id=?", [result.insertId]);
    res.status(201).json(toApiStep(rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.put("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { name, description, color, order_index } = req.body;
    await db.execute(
      "UPDATE tipos_paso SET nombre=COALESCE(?,nombre), descripcion=COALESCE(?,descripcion), color=COALESCE(?,color), orden=COALESCE(?,orden) WHERE id=?",
      [name ?? null, description ?? null, color ?? null, order_index ?? null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.delete("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    await db.execute("UPDATE tipos_paso SET activo=0 WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
