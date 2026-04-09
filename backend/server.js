require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "qc-track-secret-key-change-in-production-2026";

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// SSE clients registry
const sseClients = new Set();

// Acknowledged sample IDs (estado de lectura compartido)
const acknowledgedIds = new Set();

app.get("/api/events", (req, res) => {
  const token = req.query.token;
  if (token) {
    try { jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).end(); }
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(":\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

app.get("/api/acknowledged", (req, res) => {
  res.json([...acknowledgedIds]);
});

app.post("/api/acknowledged", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser un arreglo" });
  ids.forEach(id => acknowledgedIds.add(id));
  broadcast("sample-read", { ids });
  res.json({ ok: true });
});

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(payload);
}

// Endpoint público: crear muestra (sin auth)
app.post("/api/new-sample", async (req, res) => {
  console.log("POST /api/new-sample reached");
  const { product_name, batch, description } = req.body;
  if (!product_name) return res.status(400).json({ error: "Nombre de producto requerido" });

  try {
    const year = new Date().getFullYear();
    const [result] = await db.execute(
      "INSERT INTO muestras (codigo, nombre_producto, lote, descripcion, asignado_a, creado_por) VALUES (?,?,?,?,?,?)",
      [`MCA-${year}-000`, product_name, batch || null, description || null, null, null]
    );
    const sampleId = result.insertId;
    const code = `MCA-${year}-${String(sampleId).padStart(3, "0")}`;
    await db.execute("UPDATE muestras SET codigo=? WHERE id=?", [code, sampleId]);

    const [stepTypes] = await db.execute(
      "SELECT id FROM tipos_paso WHERE activo=1 ORDER BY orden"
    );
    if (stepTypes.length) {
      const values = stepTypes.map(st => [sampleId, st.id]);
      await db.query("INSERT INTO pasos_muestra (muestra_id, tipo_paso_id) VALUES ?", [values]);
    }

    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?)",
      [sampleId, "muestra_creada", "pendiente", null, new Date().toISOString().slice(0, 19).replace("T", " ")]
    );

    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [sampleId]);

    const STATUS_PASO = { pendiente: "pending", en_proceso: "in_progress", aprobado: "passed", fallido: "failed", omitido: "skipped" };
    const [stepsRaw] = await db.execute(`
      SELECT pm.id, pm.muestra_id, pm.estado, pm.notas,
             tp.nombre as step_name, tp.orden as order_index, tp.color
      FROM pasos_muestra pm
      JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
      WHERE pm.muestra_id = ?
      ORDER BY tp.orden
    `, [sampleId]);

    const steps = stepsRaw.map(r => ({
      id:          r.id,
      sample_id:   r.muestra_id,
      status:      STATUS_PASO[r.estado] || r.estado,
      step_name:   r.step_name,
      order_index: r.order_index,
      color:       r.color,
      notes:       r.notas || null,
    }));

    const fullSample = {
      id:           sample.id,
      code:         sample.codigo,
      product_name: sample.nombre_producto,
      batch:        sample.lote,
      description:  sample.descripcion,
      status:       "pending",
      attempt:      sample.intento,
      assigned_to:  sample.asignado_a,
      created_by:   sample.creado_por,
      created_at:   sample.creado_en,
      updated_at:   sample.actualizado_en,
      steps,
    };

    broadcast("new-sample", { id: fullSample.id, code: fullSample.code, product_name: fullSample.product_name, created_at: fullSample.created_at });

    res.status(201).json(fullSample);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al crear muestra" });
  }
});

app.use("/api/auth",    require("./routes/auth"));
app.use("/api/samples", require("./routes/samples"));
app.use("/api/users",   require("./routes/users"));
app.use("/api/steps",   require("./routes/steps"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`QC Backend corriendo en http://localhost:${PORT}`));
