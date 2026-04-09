const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function toApiUser(u) {
  return {
    id:         u.id,
    username:   u.usuario,
    role:       u.rol === "analista" ? "analyst" : "admin",
    name:       u.nombre,
    active:     u.activo,
    created_at: u.creado_en,
  };
}

// Lista pública de analistas (para asignar en pasos)
router.get("/analysts", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, nombre AS name FROM usuarios WHERE rol='analista' AND activo=1 ORDER BY nombre"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/", authMiddleware(["admin"]), async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, usuario, rol, nombre, activo, creado_en FROM usuarios ORDER BY creado_en DESC"
    );
    res.json(rows.map(toApiUser));
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    if (!username || !password || !role || !name)
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    if (!["admin", "analyst"].includes(role))
      return res.status(400).json({ error: "Rol inválido" });

    const [existing] = await db.execute("SELECT id FROM usuarios WHERE usuario=?", [username]);
    if (existing.length > 0) return res.status(409).json({ error: "El usuario ya existe" });

    const rolDB = role === "analyst" ? "analista" : "admin";
    const [result] = await db.execute(
      "INSERT INTO usuarios (usuario, contrasena, rol, nombre) VALUES (?,?,?,?)",
      [username, password, rolDB, name]
    );
    const [rows] = await db.execute(
      "SELECT id, usuario, rol, nombre, activo, creado_en FROM usuarios WHERE id=?",
      [result.insertId]
    );
    res.status(201).json(toApiUser(rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.put("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { name, role, active, password } = req.body;
    if (password) {
      await db.execute("UPDATE usuarios SET contrasena=? WHERE id=?", [password, req.params.id]);
    }
    const rolDB = role === "analyst" ? "analista" : role === "admin" ? "admin" : null;
    await db.execute(
      "UPDATE usuarios SET nombre=COALESCE(?,nombre), rol=COALESCE(?,rol), activo=COALESCE(?,activo) WHERE id=?",
      [name ?? null, rolDB ?? null, active ?? null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.delete("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    if (req.user.id == req.params.id)
      return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    await db.execute("UPDATE usuarios SET activo=0 WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
