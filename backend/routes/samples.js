const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const nowUTC = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function normalizePlantaQuery(planta) {
  if (planta == null) return "";
  const s = Array.isArray(planta) ? planta[0] : planta;
  return String(s).trim();
}

/** Acepta solo YYYY-MM-DD (query string). */
function normalizeDateQuery(d) {
  if (d == null) return "";
  const s = String(Array.isArray(d) ? d[0] : d).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

// ── Mapeo de estados (frontend ↔ BD) ──────────────────────────────────────
const ESTADO_MUESTRA = {
  pending: "pendiente", in_progress: "en_proceso",
  completed: "completada", rejected: "rechazada", cancelled: "cancelada",
};
const STATUS_MUESTRA = {
  pendiente: "pending", en_proceso: "in_progress",
  completada: "completed", rechazada: "rejected", cancelada: "cancelled",
};
const ESTADO_PASO = {
  pending: "pendiente", in_progress: "en_proceso",
  passed: "aprobado", failed: "fallido", skipped: "omitido",
};
const STATUS_PASO = {
  pendiente: "pending", en_proceso: "in_progress",
  aprobado: "passed", fallido: "failed", omitido: "skipped",
};

function toApiSample(r) {
  return {
    id:              r.id,
    code:            r.codigo,
    product_name:    r.nombre_producto,
    batch:           r.lote,
    description:     r.descripcion,
    status:          STATUS_MUESTRA[r.estado] || r.estado,
    attempt:         r.intento,
    fase:            r.fase || 1,
    assigned_to:     r.asignado_a,
    created_by:      r.creado_por,
    created_at:      r.creado_en,
    updated_at:      r.actualizado_en,
    assigned_name:   r.assigned_name   || null,
    created_by_name: r.created_by_name || null,
    approval_pending: r.aprobacion_pendiente ? true : false,
    approval_result: r.aprobacion_resultado || null,
    approved_by:    r.aprobado_por     || null,
    approved_at:     r.aprobado_en     || null,
    // Campos de Registo_ccr
    codigo_orden:    r.codigo_orden    || null,
    grupo_turno:     r.grupo_turno     || null,
    numero_empleado: r.numero_empleado || null,
    nombre_empleado: r.nombre_empleado || null,
    apellido_empleado: r.apellido_empleado || null,
    planta:          r.planta          || null,
    codigo_reactor:  r.codigo_reactor  || null,
    nombre_reactor:  r.nombre_reactor  || null,
    codigo_material: r.codigo_material || null,
    nombre_material: r.nombre_material || null,
    fases:           r.fases           || null,
    comentarios:     r.comentarios     || null,
  };
}

function toApiStep(r) {
  return {
    id:               r.id,
    sample_id:        r.muestra_id,
    status:           STATUS_PASO[r.estado] || r.estado,
    step_name:        r.step_name,
    step_description: r.step_description || null,
    order_index:      r.order_index,
    color:            r.color,
    notes:            r.notas || null,
    resultado_porcentaje: r.resultado_porcentaje ?? null,
    updated_by:       r.actualizado_por || null,
    started_at:       r.iniciado_en     || null,
    completed_at:     r.completado_en   || null,
    created_at:       r.creado_en       || null,
    updated_by_name:  r.updated_by_name || null,
  };
}

async function getSteps(sampleId, full = false) {
  const [rows] = await db.execute(`
    SELECT pm.id, pm.muestra_id, pm.estado, pm.notas, pm.resultado_porcentaje, pm.actualizado_por,
           pm.iniciado_en, pm.completado_en, pm.creado_en,
           tp.nombre as step_name,
           ${full ? "tp.descripcion as step_description," : ""}
           tp.orden as order_index, tp.color
           ${full ? ", u.nombre as updated_by_name" : ""}
    FROM pasos_muestra pm
    JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
    ${full ? "LEFT JOIN usuarios u ON pm.actualizado_por = u.id" : ""}
    WHERE pm.muestra_id = ?
    ORDER BY tp.orden
  `, [sampleId]);
  return rows.map(toApiStep);
}

async function getStepsForSamples(sampleIds) {
  if (!sampleIds.length) return {};
  const placeholders = sampleIds.map(() => "?").join(",");
  const [rows] = await db.execute(`
    SELECT pm.id, pm.muestra_id, pm.estado, pm.notas, pm.resultado_porcentaje, pm.actualizado_por,
           pm.iniciado_en, pm.completado_en, pm.creado_en,
           tp.nombre as step_name, tp.orden as order_index, tp.color
    FROM pasos_muestra pm
    JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
    WHERE pm.muestra_id IN (${placeholders})
    ORDER BY pm.muestra_id, tp.orden
  `, sampleIds);
  const map = {};
  for (const row of rows) {
    if (!map[row.muestra_id]) map[row.muestra_id] = [];
    map[row.muestra_id].push(toApiStep(row));
  }
  return map;
}

async function listPendingApproval(req, res) {
  try {
    const [samples] = await db.execute(`
      SELECT m.*, u.nombre as assigned_name, c.nombre as created_by_name,
             rc.codigo_orden, rc.grupo_turno, rc.numero_empleado,
             rc.nombre_empleado, rc.apellido_empleado,
             rc.planta, rc.codigo_reactor, rc.nombre_reactor,
             rc.codigo_material, rc.nombre_material, rc.fases, rc.comentarios
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      LEFT JOIN usuarios c ON m.creado_por = c.id
      LEFT JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE m.aprobacion_pendiente = 1
      ORDER BY m.creado_en DESC
    `);
    const stepsMap = await getStepsForSamples(samples.map(s => s.id));
    const result = samples.map(s => ({ ...toApiSample(s), steps: stepsMap[s.id] || [] }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// ── STATS por analista (solo admin) ───────────────────────────────────────
router.get("/analyst-stats/:analystId", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { analystId } = req.params;

    const [[counts]] = await db.execute(`
      SELECT
        COUNT(*)                                                          AS total,
        SUM(m.estado = 'completada')                                      AS completed,
        SUM(m.estado = 'rechazada')                                       AS rejected,
        SUM(m.estado = 'en_proceso')                                      AS in_progress,
        SUM(m.estado = 'pendiente')                                       AS pending,
        SUM(m.estado = 'cancelada')                                       AS cancelled,
        SUM(m.intento > 1)                                                AS retried,
        ROUND(AVG(CASE WHEN m.estado = 'completada'
          THEN TIMESTAMPDIFF(MINUTE, m.creado_en, m.actualizado_en) END)) AS avg_minutes
      FROM muestras m
      WHERE m.asignado_a = ?
    `, [analystId]);

    const [byTurno] = await db.execute(`
      SELECT rc.grupo_turno AS turno, COUNT(*) AS count
      FROM muestras m
      JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE m.asignado_a = ? AND rc.grupo_turno IS NOT NULL
      GROUP BY rc.grupo_turno
      ORDER BY count DESC
    `, [analystId]);

    const completed = Number(counts.completed) || 0;
    const rejected  = Number(counts.rejected)  || 0;
    const approval_rate = (completed + rejected) > 0
      ? Math.round((completed / (completed + rejected)) * 100)
      : null;

    res.json({
      total:       Number(counts.total)       || 0,
      completed,
      rejected,
      in_progress: Number(counts.in_progress) || 0,
      pending:     Number(counts.pending)     || 0,
      cancelled:   Number(counts.cancelled)   || 0,
      retried:     Number(counts.retried)     || 0,
      approval_rate,
      avg_minutes: counts.avg_minutes != null ? Number(counts.avg_minutes) : null,
      by_turno:    byTurno,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── CREAR muestra (público, sin auth) ──────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { product_name, batch, description, assigned_to } = req.body;
    if (!product_name) return res.status(400).json({ error: "Nombre de producto requerido" });

    const year = new Date().getFullYear();
    const [result] = await db.execute(
      "INSERT INTO muestras (codigo, nombre_producto, lote, descripcion, asignado_a, creado_por, creado_en) VALUES (?,?,?,?,?,?,?)",
      [`MCA-${year}-000`, product_name, batch || null, description || null, assigned_to || null, null, nowUTC()]
    );
    const sampleId = result.insertId;
    const code = `MCA-${year}-${String(sampleId).padStart(3, "0")}`;
    await db.execute("UPDATE muestras SET codigo=? WHERE id=?", [code, sampleId]);

    const [stepTypes] = await db.execute("SELECT id FROM tipos_paso WHERE activo=1 ORDER BY orden");
    if (stepTypes.length) {
      const values = stepTypes.map(st => [sampleId, st.id]);
      await db.query("INSERT INTO pasos_muestra (muestra_id, tipo_paso_id) VALUES ?", [values]);
    }

    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?)",
      [sampleId, "muestra_creada", "pendiente", null, nowUTC()]
    );

    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [sampleId]);
    const steps = await getSteps(sampleId);

    res.status(201).json({ ...toApiSample(sample), steps });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al crear muestra" });
  }
});

// ── PÚBLICO: listar muestras ───────────────────────────────────────────────
router.get("/public", async (req, res) => {
  try {
    const { search, status, planta: plantaRaw, date_from: dateFromRaw, date_to: dateToRaw } = req.query;
    const planta = normalizePlantaQuery(plantaRaw);
    const dateFrom = normalizeDateQuery(dateFromRaw);
    const dateTo = normalizeDateQuery(dateToRaw);
    let query = `
      SELECT m.*, u.nombre as assigned_name,
             rc.codigo_orden, rc.grupo_turno, rc.numero_empleado,
             rc.nombre_empleado, rc.apellido_empleado,
             rc.planta, rc.codigo_reactor, rc.nombre_reactor,
             rc.codigo_material, rc.nombre_material, rc.fases, rc.comentarios
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      LEFT JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE 1=1
    `;
const params = [];
    if (status && status !== "all") {
      query += " AND m.estado = ?";
      params.push(ESTADO_MUESTRA[status] || status);
    }
    if (planta) {
      query += " AND UPPER(TRIM(rc.planta)) = UPPER(?)";
      params.push(planta);
    }
    if (dateFrom) {
      query += " AND DATE(m.creado_en) >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      query += " AND DATE(m.creado_en) <= ?";
      params.push(dateTo);
    }
    if (search) {
      query += " AND MATCH(m.nombre_producto, m.lote, m.codigo) AGAINST(? IN BOOLEAN MODE)";
      params.push(`${search}*`);
    }
    query += " ORDER BY m.creado_en DESC";

    const [samples] = await db.execute(query, params);
    const stepsMap = await getStepsForSamples(samples.map(s => s.id));
    const result = samples.map(s => ({ ...toApiSample(s), steps: stepsMap[s.id] || [] }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── AUTENTICADO: listar todas las muestras ────────────────────────────────
router.get("/", authMiddleware(["admin", "analyst", "jefe_turno"]), async (req, res) => {
  try {
    const { status, search, assigned_to, planta: plantaRaw, date_from: dateFromRaw, date_to: dateToRaw } = req.query;
    const planta = normalizePlantaQuery(plantaRaw);
    const dateFrom = normalizeDateQuery(dateFromRaw);
    const dateTo = normalizeDateQuery(dateToRaw);
    let query = `
      SELECT m.*, u.nombre as assigned_name, c.nombre as created_by_name,
             jt.nombre as jt_name,
             rc.codigo_orden, rc.grupo_turno, rc.numero_empleado,
             rc.nombre_empleado, rc.apellido_empleado,
             rc.planta, rc.codigo_reactor, rc.nombre_reactor,
             rc.codigo_material, rc.nombre_material, rc.fases, rc.comentarios
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      LEFT JOIN usuarios c ON m.creado_por = c.id
      LEFT JOIN usuarios jt ON m.aprobado_por = jt.id
      LEFT JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== "all") {
      query += " AND m.estado = ?";
      params.push(ESTADO_MUESTRA[status] || status);
    }
    if (assigned_to) {
      query += " AND m.asignado_a = ?";
      params.push(assigned_to);
    }
    if (planta) {
      query += " AND UPPER(TRIM(rc.planta)) = UPPER(?)";
      params.push(planta);
    }
    if (dateFrom) {
      query += " AND DATE(m.creado_en) >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      query += " AND DATE(m.creado_en) <= ?";
      params.push(dateTo);
    }
    if (search) {
      const like = `%${search}%`;
      query += ` AND (m.nombre_producto LIKE ? OR m.codigo LIKE ? OR rc.codigo_orden LIKE ? OR rc.nombre_material LIKE ? OR rc.codigo_material LIKE ?)`;
      params.push(like, like, like, like, like);
    }
    query += " ORDER BY m.creado_en DESC";

    const [samples] = await db.execute(query, params);
    const stepsMap = await getStepsForSamples(samples.map(s => s.id));
    const result = samples.map(s => ({ ...toApiSample(s), approved_by_name: s.jt_name || null, steps: stepsMap[s.id] || [] }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── PÚBLICO: obtener muestra por código ───────────────────────────────────
router.get("/public/:code", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT m.*, u.nombre as assigned_name
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      WHERE m.codigo = ?
    `, [req.params.code.toUpperCase()]);

    if (!rows.length) return res.status(404).json({ error: "Muestra no encontrada" });
    const steps = await getSteps(rows[0].id, true);
    res.json({ ...toApiSample(rows[0]), steps });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── AUTENTICADO: listar todas las muestras ────────────────────────────────
router.get("/", authMiddleware(["admin", "analyst", "jefe_turno"]), async (req, res) => {
  try {
    const { status, search, assigned_to, planta: plantaRaw, date_from: dateFromRaw, date_to: dateToRaw } = req.query;
    const planta = normalizePlantaQuery(plantaRaw);
    const dateFrom = normalizeDateQuery(dateFromRaw);
    const dateTo = normalizeDateQuery(dateToRaw);
    let query = `
      SELECT m.*, u.nombre as assigned_name, c.nombre as created_by_name,
             jt.nombre as jt_name,
             rc.codigo_orden, rc.grupo_turno, rc.numero_empleado,
             rc.nombre_empleado, rc.apellido_empleado,
             rc.planta, rc.codigo_reactor, rc.nombre_reactor,
             rc.codigo_material, rc.nombre_material, rc.fases, rc.comentarios
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      LEFT JOIN usuarios c ON m.creado_por = c.id
      LEFT JOIN usuarios jt ON m.aprobado_por = jt.id
      LEFT JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== "all") {
      query += " AND m.estado = ?";
      params.push(ESTADO_MUESTRA[status] || status);
    }
    if (assigned_to) {
      query += " AND m.asignado_a = ?";
      params.push(assigned_to);
    }
    if (planta) {
      query += " AND UPPER(TRIM(rc.planta)) = UPPER(?)";
      params.push(planta);
    }
    if (dateFrom) {
      query += " AND DATE(m.creado_en) >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      query += " AND DATE(m.creado_en) <= ?";
      params.push(dateTo);
    }
    if (search) {
      query += " AND MATCH(m.nombre_producto, m.lote, m.codigo) AGAINST(? IN BOOLEAN MODE)";
      params.push(`${search}*`);
    }
    query += " ORDER BY m.creado_en DESC";

    const [samples] = await db.execute(query, params);
    const stepsMap = await getStepsForSamples(samples.map(s => s.id));
    const result = samples.map(s => ({ ...toApiSample(s), approved_by_name: s.jt_name || null, steps: stepsMap[s.id] || [] }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── LISTAR muestras pendientes de aprobación (jefe de turno) ───────────────
// Debe ir antes de "/:id" para evitar colisión de rutas.
router.get("/pending-approval", authMiddleware(["jefe_turno"]), listPendingApproval);

// ── AUTENTICADO: obtener muestra por ID ───────────────────────────────────
router.get("/:id", authMiddleware(["admin", "analyst", "jefe_turno"]), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT m.*, u.nombre as assigned_name, c.nombre as created_by_name,
             rc.codigo_orden, rc.grupo_turno, rc.numero_empleado,
             rc.nombre_empleado, rc.apellido_empleado,
             rc.planta, rc.codigo_reactor, rc.nombre_reactor,
             rc.codigo_material, rc.nombre_material, rc.fases, rc.comentarios
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      LEFT JOIN usuarios c ON m.creado_por = c.id
      LEFT JOIN Registo_ccr rc ON rc.muestra_id = m.id
      WHERE m.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: "Muestra no encontrada" });
    const steps = await getSteps(rows[0].id, true);
    res.json({ ...toApiSample(rows[0]), steps });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── ACTUALIZAR datos de la muestra ────────────────────────────────────────
router.put("/:id", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const { product_name, batch, description, assigned_to, status } = req.body;
    const estadoDB = status ? (ESTADO_MUESTRA[status] || status) : null;
    await db.execute(`
      UPDATE muestras
      SET nombre_producto=COALESCE(?,nombre_producto), lote=COALESCE(?,lote),
          descripcion=COALESCE(?,descripcion), asignado_a=COALESCE(?,asignado_a),
          estado=COALESCE(?,estado), actualizado_en=CURRENT_TIMESTAMP
      WHERE id=?
    `, [product_name ?? null, batch ?? null, description ?? null, assigned_to ?? null, estadoDB, req.params.id]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── ACTUALIZAR estado de un paso ──────────────────────────────────────────
router.put("/:id/steps/:stepId", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const resultado_porcentaje = (req.body.resultado_porcentaje !== null && req.body.resultado_porcentaje !== undefined && req.body.resultado_porcentaje !== "")
      ? req.body.resultado_porcentaje
      : null;
    const validStatuses = ["pending", "in_progress", "passed", "failed"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Estado inválido" });

    if (resultado_porcentaje !== null) {
      const pct = Number(resultado_porcentaje);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: "El porcentaje debe ser un número entre 0 y 100" });
      }
    }

    const estadoDB = ESTADO_PASO[status];

    // Obtener paso actual con su orden
    const [stepRows] = await db.execute(`
      SELECT pm.id, tp.orden as order_index FROM pasos_muestra pm
      JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
      WHERE pm.id = ? AND pm.muestra_id = ?
    `, [req.params.stepId, req.params.id]);
    if (!stepRows.length) return res.status(404).json({ error: "Paso no encontrado" });
    const currentStep = stepRows[0];

    // Obtener estado anterior para historial
    const [prevRows] = await db.execute(`
      SELECT pm.estado, pm.notas, tp.nombre as step_name FROM pasos_muestra pm
      JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
      WHERE pm.id = ?
    `, [req.params.stepId]);
    const prevStepData = prevRows[0];

    // Validar que el paso anterior esté aprobado
    if (currentStep.order_index > 1 && status !== "pending") {
      const [prevStep] = await db.execute(`
        SELECT pm.estado FROM pasos_muestra pm
        JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
        WHERE pm.muestra_id = ? AND tp.orden = ?
      `, [req.params.id, currentStep.order_index - 1]);

      if (prevStep.length && prevStep[0].estado !== "aprobado" && prevStep[0].estado !== "omitido") {
        return res.status(400).json({ error: "El paso anterior debe estar aprobado para continuar" });
      }
    }

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const iniciado_en  = ["en_proceso", "aprobado", "fallido"].includes(estadoDB) ? now : null;
    const completado_en = ["aprobado", "fallido"].includes(estadoDB) ? now : null;

    await db.execute(`
      UPDATE pasos_muestra
      SET estado=?, notas=?, resultado_porcentaje=?, actualizado_por=?,
          iniciado_en=COALESCE(iniciado_en, ?),
          completado_en=?
      WHERE id=? AND muestra_id=?
    `, [estadoDB, notes || null, resultado_porcentaje ?? null, req.user.id, iniciado_en, completado_en, req.params.stepId, req.params.id]);

    // Resetear pasos posteriores si regresa a pendiente o falla
    if (status === "pending" || status === "failed") {
      await db.execute(`
        UPDATE pasos_muestra pm
        JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id
        SET pm.estado='pendiente', pm.notas=NULL, pm.actualizado_por=NULL, pm.iniciado_en=NULL, pm.completado_en=NULL
        WHERE pm.muestra_id = ? AND tp.orden > ?
      `, [req.params.id, currentStep.order_index]);
    }

    // Recalcular estado general de la muestra
    const [[maxOrden]] = await db.execute(
      "SELECT MAX(tp.orden) as max_orden FROM pasos_muestra pm JOIN tipos_paso tp ON pm.tipo_paso_id = tp.id WHERE pm.muestra_id = ?",
      [req.params.id]
    );
    const isLastStep = currentStep.order_index === Number(maxOrden.max_orden);

    const [allSteps] = await db.execute(
      "SELECT estado FROM pasos_muestra WHERE muestra_id=?",
      [req.params.id]
    );
    const estados = allSteps.map(s => s.estado);
    const hasFailed = estados.some(s => s === "fallido");
    const allDone = estados.every(s => s === "aprobado" || s === "omitido");

    let estadoMuestra = "pendiente";
    let approvalPending = false;

    if (isLastStep && status === "failed" && hasFailed) {
      // Fallo en el último paso: el jefe de turno debe confirmar el rechazo
      estadoMuestra = "en_proceso";
      approvalPending = true;
      await db.execute(
        `UPDATE muestras SET estado=?, aprobacion_pendiente=1, aprobacion_resultado=NULL,
         aprobado_por=NULL, aprobado_en=NULL, actualizado_en=CURRENT_TIMESTAMP WHERE id=?`,
        [estadoMuestra, req.params.id]
      );
    } else if (hasFailed) {
      // Fallo en un paso intermedio: rechazo inmediato (sin cola de jefe)
      estadoMuestra = "rechazada";
      await db.execute(
        "UPDATE muestras SET estado=?, aprobacion_pendiente=0, actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
        [estadoMuestra, req.params.id]
      );
    } else if (allDone) {
      if (isLastStep && status === "passed") {
        estadoMuestra = "en_proceso";
        approvalPending = true;
        await db.execute(
          `UPDATE muestras SET estado=?, aprobacion_pendiente=1, aprobacion_resultado=NULL,
           aprobado_por=NULL, aprobado_en=NULL, actualizado_en=CURRENT_TIMESTAMP WHERE id=?`,
          [estadoMuestra, req.params.id]
        );
      } else {
        estadoMuestra = "completada";
        await db.execute(
          "UPDATE muestras SET estado=?, aprobacion_pendiente=0, actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
          [estadoMuestra, req.params.id]
        );
      }
    } else if (estados.some(s => s !== "pendiente")) {
      estadoMuestra = "en_proceso";
      await db.execute(
        "UPDATE muestras SET estado=?, aprobacion_pendiente=0, actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
        [estadoMuestra, req.params.id]
      );
    } else {
      await db.execute(
        "UPDATE muestras SET estado=?, aprobacion_pendiente=0, actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
        [estadoMuestra, req.params.id]
      );
    }

    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, nombre_paso, accion, estado_anterior, estado_nuevo, notas, realizado_por, realizado_en) VALUES (?,?,?,?,?,?,?,?)",
      [req.params.id, prevStepData?.step_name || null, "paso_actualizado",
       prevStepData?.estado || null, estadoDB, notes || null, req.user.id, nowUTC()]
    );

    res.json({
      success: true,
      sampleStatus: STATUS_MUESTRA[estadoMuestra] || estadoMuestra,
      approvalPending,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── REINTENTAR muestra rechazada ──────────────────────────────────────────
router.post("/:id/retry", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });
    if (sample.estado === "completada") return res.status(400).json({ error: "No se puede reintentar una muestra ya completada" });
    if (sample.estado === "cancelada")  return res.status(400).json({ error: "No se puede reintentar una muestra cancelada" });
    if (sample.estado !== "rechazada") return res.status(400).json({ error: "Solo se pueden reintentar muestras rechazadas" });

    const newAttempt = (sample.intento || 1) + 1;

    await db.execute(
      "UPDATE pasos_muestra SET estado='pendiente', notas=NULL, actualizado_por=NULL, iniciado_en=NULL, completado_en=NULL WHERE muestra_id=?",
      [req.params.id]
    );
    await db.execute(
      "UPDATE muestras SET estado='pendiente', intento=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
      [newAttempt, req.params.id]
    );
    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_anterior, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?,?)",
      [req.params.id, "reintento_iniciado", "rechazada", "pendiente", req.user.id, nowUTC()]
    );

    res.json({ success: true, attempt: newAttempt });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── CANCELAR muestra ──────────────────────────────────────────────────────
router.post("/:id/cancel", authMiddleware(["admin", "analyst"]), async (req, res) => {
  try {
    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });
    if (sample.estado === "completada") return res.status(400).json({ error: "No se puede cancelar una muestra ya completada" });
    if (sample.estado === "cancelada")  return res.status(400).json({ error: "La muestra ya está cancelada" });

    await db.execute(
      "UPDATE muestras SET estado='cancelada', actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
      [req.params.id]
    );
    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_anterior, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?,?)",
      [req.params.id, "muestra_cancelada", sample.estado, "cancelada", req.user.id, nowUTC()]
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── HISTORIAL de muestra (solo admin) ────────────────────────────────────
router.get("/:id/history", authMiddleware(["admin"]), async (req, res) => {
  try {
    const [[sample]] = await db.execute(`
      SELECT m.id, m.codigo as code, u.nombre as assigned_name
      FROM muestras m
      LEFT JOIN usuarios u ON m.asignado_a = u.id
      WHERE m.id = ?
    `, [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });

    const [history] = await db.execute(`
      SELECT hm.*, u.nombre as performed_by_name
      FROM historial_muestras hm
      LEFT JOIN usuarios u ON hm.realizado_por = u.id
      WHERE hm.muestra_id = ?
      ORDER BY hm.realizado_en DESC
    `, [req.params.id]);

    res.json({ sample, history });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── ELIMINAR muestra (solo admin) ─────────────────────────────────────────
router.delete("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    await db.execute("DELETE FROM muestras WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Confirmar resultado del analista (conformidad o no conformidad en cierre) ──
async function handleConfirmarResultadoTurno(req, res) {
  try {
    const id = req.params.id;
    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });
    if (!sample.aprobacion_pendiente) return res.status(400).json({ error: "No hay aprobación pendiente para esta muestra" });

    const steps = await getSteps(id);
    const hasFailed = steps.some(s => s.status === "failed");
    const estadoNuevo = hasFailed ? "rechazada" : "completada";
    const resultado = hasFailed ? "rechazado" : "aprobado";
    const accionHist = hasFailed ? "turno_confirmo_rechazo_analista" : "turno_confirmo_aprobacion_analista";

    const now = nowUTC();
    await db.execute(`
      UPDATE muestras
      SET estado=?, aprobacion_pendiente=0, aprobacion_resultado=?,
          aprobado_por=?, aprobado_en=?, actualizado_en=?
      WHERE id=?
    `, [estadoNuevo, resultado, req.user.id, now, now, id]);

    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_anterior, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?,?)",
      [id, accionHist, sample.estado, estadoNuevo, req.user.id, nowUTC()]
    );

    res.json({ success: true, sampleStatus: estadoNuevo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
}

router.post("/:id/confirmar-resultado-turno", authMiddleware(["jefe_turno"]), handleConfirmarResultadoTurno);

// ── APROBAR muestra por jefe de turno (alias cuando el analista cerró en conformidad) ──
router.post("/:id/approve", authMiddleware(["jefe_turno"]), async (req, res) => {
  try {
    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });
    if (!sample.aprobacion_pendiente) return res.status(400).json({ error: "No hay aprobación pendiente para esta muestra" });
    const steps = await getSteps(req.params.id);
    if (steps.some(s => s.status === "failed")) {
      return res.status(400).json({
        error: "El analista registró no conformidad. Use «Confirmar resultado del turno» para cerrar la muestra.",
      });
    }
    return handleConfirmarResultadoTurno(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── RECHAZAR decisión del analista (solo si cerró en conformidad) ─────────
router.post("/:id/reject", authMiddleware(["jefe_turno"]), async (req, res) => {
  try {
    const [[sample]] = await db.execute("SELECT * FROM muestras WHERE id=?", [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Muestra no encontrada" });
    if (!sample.aprobacion_pendiente) return res.status(400).json({ error: "No hay aprobación pendiente para esta muestra" });

    const steps = await getSteps(req.params.id);
    if (steps.some(s => s.status === "failed")) {
      return res.status(400).json({
        error: "Para registrar el rechazo del analista use «Confirmar resultado del turno». Esta acción solo aplica si el analista cerró en conformidad.",
      });
    }

    const now = nowUTC();
    await db.execute(`
      UPDATE muestras
      SET estado='rechazada', aprobacion_pendiente=0, aprobacion_resultado='rechazado',
          aprobado_por=?, aprobado_en=?, actualizado_en=?
      WHERE id=?
    `, [req.user.id, now, now, req.params.id]);

    await db.execute(
      "INSERT INTO historial_muestras (muestra_id, accion, estado_anterior, estado_nuevo, realizado_por, realizado_en) VALUES (?,?,?,?,?,?)",
      [req.params.id, "aprobacion_rechazada", sample.estado, "rechazada", req.user.id, nowUTC()]
    );

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
