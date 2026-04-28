import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, User, Calendar, Save, X, Trash2, AlertTriangle, History, RotateCcw, Ban, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { fmtDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import StepTracker from "../components/StepTracker";
import SampleStatusBadge from "../components/SampleStatusBadge";
import MiniProgress from "../components/MiniProgress";
import ChatPanel from "../components/ChatPanel";

const ALLOWED_TRANSITIONS = {
  pending:     ["passed", "failed"],
  in_progress: ["passed", "failed"],
  passed:      ["pending"],
  failed:      ["pending"],
  skipped:     ["pending"],
};

const STATUS_LABELS = {
  pending:     "Pendiente",
  in_progress: "En Proceso",
  passed:      "Aprobado",
  failed:      "Fallido",
  skipped:     "Omitido",
};

const STATUS_STYLES = {
  pending:     "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300",
  in_progress: "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400",
  passed:      "bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-500 text-green-600 dark:text-green-400",
  failed:      "bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-500 text-red-600 dark:text-red-400",
  skipped:     "bg-yellow-50 dark:bg-yellow-950 border-yellow-400 dark:border-yellow-500 text-yellow-600 dark:text-yellow-400",
};

const STATUS_BORDER = {
  pending:     "border-l-gray-300 dark:border-l-gray-600",
  in_progress: "border-l-blue-500",
  completed:   "border-l-green-500",
  rejected:    "border-l-red-500",
  cancelled:   "border-l-zinc-400",
};

const PERCENTAGE_STEPS = new Set(["analisis", "resultado"]);

function normalizeStepName(name = "") {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function StepNotesModal({ step, onClose, onSave, analysts = [], userRole }) {
  const [status, setStatus] = useState(step.status);
  const [notes, setNotes] = useState(step.notes || "");
  const [resultadoPorcentaje, setResultadoPorcentaje] = useState(step.resultado_porcentaje ?? "");
  const [analystId, setAnalystId] = useState("");
  const [loading, setLoading] = useState(false);
  const canCapturePercentage = userRole === "analyst" && PERCENTAGE_STEPS.has(normalizeStepName(step.step_name));

  const initialPercentage = step.resultado_porcentaje == null ? "" : String(step.resultado_porcentaje);
  const currentPercentage = resultadoPorcentaje == null ? "" : String(resultadoPorcentaje);
  const hasChanges =
    status !== step.originalStatus ||
    notes !== (step.notes || "") ||
    (canCapturePercentage && currentPercentage !== initialPercentage);

  const handleSave = async () => {
    setLoading(true);
    await onSave(step.id, status, notes, analystId || null, canCapturePercentage ? resultadoPorcentaje : null);
    setLoading(false);
    onClose();
  };

  const validTargets = ALLOWED_TRANSITIONS[step.originalStatus] || [];
  const STATUS_OPTS = validTargets.map(v => ({ value: v, label: STATUS_LABELS[v] }));

  const handlePorcentajeChange = (e) => {
    const value = e.target.value;
    if (value === "" || (/^\d+(\.\d{0,2})?$/.test(value) && Number(value) >= 0 && Number(value) <= 100)) {
      setResultadoPorcentaje(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{step.step_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            <span>Estado actual:</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full border text-xs ${STATUS_STYLES[step.originalStatus]}`}>
              {STATUS_LABELS[step.originalStatus]}
            </span>
          </div>
          {STATUS_OPTS.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Cambiar a</label>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUS_OPTS.map(o => (
                  <button key={o.value} onClick={() => setStatus(o.value)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all border
                      ${status === o.value
                        ? `${STATUS_STYLES[o.value]} ring-2 ring-offset-1 ring-current`
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {canCapturePercentage && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Resultado (%)</label>
              <input type="text" value={resultadoPorcentaje} onChange={handlePorcentajeChange}
                placeholder="0 - 100"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400 dark:placeholder-gray-600"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Ingrese un valor entre 0 y 100</p>
            </div>
          )}
          {analysts.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Analista asignado *</label>
              <select value={analystId} onChange={e => setAnalystId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                <option value="">— Seleccionar analista —</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones del paso..." rows={3}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400 dark:placeholder-gray-600"
            />
          </div>
          <button onClick={handleSave} disabled={loading || !hasChanges || (analysts.length > 0 && !analystId)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SampleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sample, setSample] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [analysts, setAnalysts] = useState([]);
  const [showApprovalPending, setShowApprovalPending] = useState(false);
  const [showJefeConfirmModal, setShowJefeConfirmModal] = useState(false);
  const [jefeConfirmLoading, setJefeConfirmLoading] = useState(false);

  useEffect(() => {
    axios.get("/api/users/analysts").then(r => setAnalysts(r.data)).catch(() => {});
  }, []);

  const fetchSample = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/samples/${id}`);
      setSample(res.data);
    } catch { navigate("/dashboard"); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchSample(); }, [fetchSample]);

  // Jefe de turno: abrir ventana de confirmación al entrar a una muestra pendiente de cierre
  useEffect(() => {
    if (!sample || user?.role !== "jefe_turno" || !sample.approval_pending) return;
    const t = setTimeout(() => setShowJefeConfirmModal(true), 500);
    return () => clearTimeout(t);
  }, [sample?.id, sample?.approval_pending, user?.role]);

  const analystRejectionPending = useMemo(
    () => (sample?.steps || []).some(st => st.status === "failed"),
    [sample]
  );

  const handleConfirmarResultadoTurno = async () => {
    setJefeConfirmLoading(true);
    try {
      await axios.post(`/api/samples/${id}/confirmar-resultado-turno`);
      setShowJefeConfirmModal(false);
      await fetchSample();
    } catch (e) {
      window.alert(e.response?.data?.error || "No se pudo confirmar el resultado");
    } finally {
      setJefeConfirmLoading(false);
    }
  };

  const handleVetoRechazarMuestra = async () => {
    setJefeConfirmLoading(true);
    try {
      await axios.post(`/api/samples/${id}/reject`);
      setShowJefeConfirmModal(false);
      await fetchSample();
    } catch (e) {
      window.alert(e.response?.data?.error || "No se pudo registrar el rechazo");
    } finally {
      setJefeConfirmLoading(false);
    }
  };

  const handleUpdateStep = async (stepId, status, notes, analystId = null, resultadoPorcentaje = null) => {
    const updatedStep = sample.steps.find(s => s.id === stepId);
    if (status === "passed" && updatedStep?.step_name === "Entrega") {
      const tomaStep = sample.steps.find(s => s.step_name === "Toma de muestra");
      if (tomaStep && tomaStep.status !== "passed") {
        await axios.put(`/api/samples/${id}/steps/${tomaStep.id}`, { status: "passed", notes: null });
      }
    }
    const res = await axios.put(`/api/samples/${id}/steps/${stepId}`, { status, notes, resultado_porcentaje: resultadoPorcentaje });
    if (analystId) {
      await axios.put(`/api/samples/${id}`, { assigned_to: analystId });
    }
    if (res.data?.approvalPending) {
      setShowApprovalPending(true);
    }
    await fetchSample();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await axios.delete(`/api/samples/${id}`);
    navigate("/dashboard");
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await axios.post(`/api/samples/${id}/retry`);
      await fetchSample();
      setShowRetry(false);
    } finally { setRetrying(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.post(`/api/samples/${id}/cancel`);
      await fetchSample();
      setShowCancel(false);
    } finally { setCancelling(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (!sample) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-5 lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      {/* ── Left column ── */}
      <div className="flex-1 min-w-0 space-y-6 lg:overflow-y-auto lg:pr-1">

      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-700 shadow-sm transition-all group">
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
        Volver al dashboard
      </Link>

      {user?.role === "jefe_turno" && sample.approval_pending && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-amber-800 dark:text-amber-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-950 dark:text-amber-100">Confirmación del turno requerida</p>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-0.5">
                El analista cerró esta muestra. Debe confirmar en sistema el resultado (conformidad o no conformidad) para finalizarla.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setShowJefeConfirmModal(true)}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-sm transition-all">
            Abrir confirmación
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 ${STATUS_BORDER[sample.status] || "border-l-gray-300"} rounded-2xl shadow-sm dark:shadow-none overflow-hidden`}>
        <div className="p-4 sm:p-6">
          {/* Top row: code + status + attempt */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400 leading-none mb-1">
                {sample.codigo_orden || sample.code}
              </p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                {sample.nombre_material || sample.product_name}
              </h1>
              {sample.codigo_material && (
                <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                  {sample.codigo_material}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              <SampleStatusBadge status={sample.status} size="lg" />
              {sample.attempt > 1 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                  #{sample.attempt}
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          {(sample.grupo_turno || sample.nombre_reactor || sample.nombre_empleado || sample.apellido_empleado) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {sample.grupo_turno && (
                <span className="inline-flex items-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  Turno {sample.grupo_turno}
                </span>
              )}
              {sample.nombre_reactor && (
                <span className="inline-flex items-center bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {sample.nombre_reactor}
                </span>
              )}
              {(sample.nombre_empleado || sample.apellido_empleado) && (
                <span className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  <User size={10} className="flex-shrink-0" />
                  {[sample.nombre_empleado, sample.apellido_empleado].filter(Boolean).join(" ")}
                </span>
              )}
            </div>
          )}

          {/* Comments */}
          {sample.comentarios && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2 mt-3">
              💬 {sample.comentarios}
            </p>
          )}
          {sample.description && (
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 italic">{sample.description}</p>
          )}
        </div>

        {/* Footer bar: metadata + actions */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
              <Calendar size={13} />
              <span>{fmtDateTime(sample.created_at)}</span>
            </div>
            {sample.assigned_name && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <User size={12} />
                <span>{sample.assigned_name}</span>
              </div>
            )}
            {sample.created_by_name && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <User size={12} />
                <span className="text-gray-300 dark:text-gray-600">por</span>
                <span>{sample.created_by_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {sample.status === "rejected" && (
              <button onClick={() => setShowRetry(true)} title="Reintentar"
                className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-all">
                <RotateCcw size={14} />
              </button>
            )}
            {sample.status !== "completed" && sample.status !== "cancelled" && (
              <button onClick={() => setShowCancel(true)} title="Cancelar muestra"
                className="p-1.5 text-gray-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-lg transition-all">
                <Ban size={14} />
              </button>
            )}
            {user?.role === "admin" && (
              <>
                <Link to={`/samples/${id}/history`} title="Historial"
                  className="p-1.5 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-all">
                  <History size={14} />
                </Link>
                {sample.status !== "completed" && sample.status !== "cancelled" && (
                  <button onClick={() => setShowDelete(true)} title="Eliminar"
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Pasos de Control de Calidad</h2>
          <span className="text-xs text-gray-400 dark:text-gray-600">
            {sample.steps.filter(s => s.step_name !== "Toma de muestra" && s.status === "passed").length}
            /{sample.steps.filter(s => s.step_name !== "Toma de muestra").length} completados
          </span>
        </div>
        <div className="p-6">
          <StepTracker
            steps={sample.steps.filter(s => s.step_name !== "Toma de muestra")}
            onUpdateStep={(stepId, status) => {
              const step = sample.steps.find(s => s.id === stepId);
              if (step.status === "failed" && status === "pending") {
                setShowRetry(true);
                return;
              }
              setSelectedStep({ ...step, originalStatus: step.status, newStatus: status });
            }}
            readOnly={user?.role === "jefe_turno" || (!!sample.approval_pending && user?.role !== "admin")}
          />
        </div>
      </div>

      </div>{/* end left column */}

      {/* ── Right column: Chat ── */}
      <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col h-[55vh] lg:h-full overflow-hidden">
        <ChatPanel
          sampleId={id}
          sampleCode={sample.codigo_orden || sample.code}
          senderName={user?.name?.split(" ").slice(0, 2).join(" ")}
          senderRole={user?.role}
        />
      </div>

      {/* Step modal */}
      {selectedStep && (
        <StepNotesModal
          step={{ ...selectedStep, status: selectedStep.newStatus || selectedStep.status, originalStatus: selectedStep.originalStatus || selectedStep.status }}
          onClose={() => setSelectedStep(null)}
          onSave={handleUpdateStep}
          analysts={selectedStep.step_name === "Análisis" ? analysts : []}
          userRole={user?.role}
        />
      )}

      {/* Jefe de turno: confirmar cierre registrado por el analista */}
      {showJefeConfirmModal && user?.role === "jefe_turno" && sample.approval_pending && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950 rounded-full flex items-center justify-center">
                <ShieldCheck size={18} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Confirmar resultado del analista</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{sample.codigo_orden || sample.code}</p>
              </div>
              <button type="button" onClick={() => setShowJefeConfirmModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className={`rounded-xl border px-4 py-3 mb-4 text-sm leading-relaxed ${
              analystRejectionPending
                ? "bg-red-50 dark:bg-red-950/25 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-100"
                : "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100"
            }`}>
              {analystRejectionPending ? (
                <>El analista registró <strong>no conformidad</strong> en el cierre. Confirme para cerrar la muestra como <strong>rechazada</strong>.</>
              ) : (
                <>El analista registró <strong>conformidad</strong> en los pasos. Confirme para cerrar como <strong>completada</strong>, o indique no conforme si no está de acuerdo.</>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleConfirmarResultadoTurno} disabled={jefeConfirmLoading}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  analystRejectionPending ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}>
                {jefeConfirmLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={15} />}
                {analystRejectionPending ? "Confirmar no conformidad y cerrar" : "Confirmar conformidad y cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval pending confirmation */}
      {showApprovalPending && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950 rounded-full flex items-center justify-center">
                <CheckCircle2 size={18} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Pendiente de aprobación</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Esperando visto bueno</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              La muestra <span className="font-semibold text-gray-900 dark:text-white">{sample.codigo_orden || sample.code}</span> quedó a la espera del <strong className="text-gray-800 dark:text-gray-200">Jefe de Turno</strong>, que debe <strong className="text-gray-800 dark:text-gray-200">confirmar en sistema</strong> el resultado registrado (conformidad o no conformidad en el cierre). Hasta entonces el caso sigue abierto para revisión del turno.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setShowApprovalPending(false); navigate("/dashboard"); }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold transition-all">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry confirm */}
      {showRetry && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRetry(false)}>
          <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950 rounded-full flex items-center justify-center">
                <RotateCcw size={18} className="text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Reintentar muestra</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Intento #{(sample.attempt || 1) + 1}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Se reiniciarán todos los pasos de <span className="font-mono text-gray-900 dark:text-white">{sample.codigo_orden || sample.code}</span> y comenzará un nuevo intento de validación.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowRetry(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">Cancelar</button>
              <button onClick={handleRetry} disabled={retrying}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {retrying ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw size={14} />}
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCancel(false)}>
          <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                <Ban size={18} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Cancelar muestra</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">El ticket quedará cerrado permanentemente</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              ¿Confirmas cancelar <span className="font-mono text-gray-900 dark:text-white">{sample.codigo_orden || sample.code}</span>? Esta acción cierra el ticket y ya no podrá reintentarse.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancel(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">Volver</button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {cancelling ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Ban size={14} />}
                Cancelar muestra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800/50 rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Eliminar muestra</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">¿Estás seguro de que deseas eliminar <span className="text-gray-900 dark:text-white font-mono">{sample.codigo_orden || sample.code}</span>?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {deleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
