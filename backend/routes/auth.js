const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { authMiddleware, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Campos requeridos" });

    const [rows] = await db.execute(
      "SELECT * FROM usuarios WHERE usuario=? AND activo=1",
      [username]
    );
    const user = rows[0];
    if (!user || user.contrasena !== password) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // rol BD: 'admin' | 'analista' | 'jefe_turno'  →  API: 'admin' | 'analyst' | 'jefe_turno'
    const roleMap = { analista: "analyst", jefe_turno: "jefe_turno", admin: "admin" };
    const role = roleMap[user.rol] || "admin";

    const token = jwt.sign(
      { id: user.id, username: user.usuario, role, name: user.nombre },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, user: { id: user.id, username: user.usuario, role, name: user.nombre } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, usuario AS username, rol, nombre AS name, creado_en AS created_at FROM usuarios WHERE id=?",
      [req.user.id]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    const roleMap = { analista: "analyst", jefe_turno: "jefe_turno", admin: "admin" };
    res.json({ ...u, role: roleMap[u.rol] || "admin" });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
