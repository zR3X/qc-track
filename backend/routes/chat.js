const express = require("express");
const router = express.Router();
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

// GET /api/chat/:sampleId — historial de mensajes
router.get("/:sampleId", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, muestra_id, sender_name, sender_role, body, created_at
       FROM chat_messages
       WHERE muestra_id = ?
       ORDER BY created_at ASC`,
      [req.params.sampleId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al cargar mensajes" });
  }
});

// PUT /api/chat/:sampleId/read — analista marca mensajes del operador como leídos
router.put("/:sampleId/read", authMiddleware(), async (req, res) => {
  try {
    await db.execute(
      "UPDATE chat_messages SET leido=1 WHERE muestra_id=? AND sender_role='operator' AND leido=0",
      [req.params.sampleId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al marcar como leídos" });
  }
});

// PUT /api/chat/:sampleId/read-operator — operador marca mensajes del analista como leídos (público)
router.put("/:sampleId/read-operator", async (req, res) => {
  try {
    await db.execute(
      "UPDATE chat_messages SET leido_operador=1 WHERE muestra_id=? AND sender_role='analyst' AND leido_operador=0",
      [req.params.sampleId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al marcar como leídos" });
  }
});

// GET /api/chat/unread/counts — mensajes no leídos del operador (para Dashboard, requiere auth)
router.get("/unread/counts", authMiddleware(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT muestra_id, COUNT(*) AS count
       FROM chat_messages
       WHERE sender_role = 'operator' AND leido = 0
       GROUP BY muestra_id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener conteos" });
  }
});

// GET /api/chat/unread-operator/counts — mensajes no leídos del analista (para PublicStatus, público)
router.get("/unread-operator/counts", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT muestra_id, COUNT(*) AS count
       FROM chat_messages
       WHERE sender_role = 'analyst' AND leido_operador = 0
       GROUP BY muestra_id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener conteos" });
  }
});

module.exports = router;
