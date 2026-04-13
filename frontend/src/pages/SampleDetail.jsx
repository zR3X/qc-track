import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Package, User, Calendar, Save, X, Trash2, AlertTriangle, History, RotateCcw, Ban } from "lucide-react";
import { fmtDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import StepTracker from "../components/StepTracker";
import SampleStatusBadge from "../components/SampleStatusBadge";
import MiniProgress from "../components/MiniProgress";

const ALLOWED_TRANSITIONS = {
  pending:     ["passed", "failed"],
  in_progress: ["passed", "failed"],
  passed:      [],
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

function StepNotesModal({ step, onClose, onSave, analysts = [] }) {
  const [status, setStatus] = useState(step.status);
  const [notes, setNotes] = useState(step.notes || "");
  const [analystId, setAnalystId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(step.id, status, notes, analystId || null);
    setLoading(false);
    onClose();
  };

  const validTargets = ALLOWED_TRANSITIONS[step.originalStatus] || [];
  const STATUS_OPTS = validTargets.map(v => ({ value: v, label: STATUS_LABELS[v] }));

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
          <button onClick={handleSave} disabled={loading || (status === step.originalStatus && notes === (step.notes || "")) || (analysts.length > 0 && !analystId)}
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

  const handleUpdateStep = async (stepId, status, notes, analystId = null) => {
    await axios.put(`/api/samples/${id}/steps/${stepId}`, { status, notes });
    // Si se seleccionó analista (paso Análisis), asignar a la muestra
    if (analystId) {
      await axios.put(`/api/samples/${id}`, { assigned_to: analystId });
    }
    // Auto-complete "Toma de muestra" when "Entrega" is passed (it's hidden but blocks "Análisis")
    if (status === "passed") {
      const updatedStep = sample.steps.find(s => s.id === stepId);
      if (updatedStep?.step_name === "Entrega") {
        const tomaStep = sample.steps.find(s => s.step_name === "Toma de muestra");
        if (tomaStep && tomaStep.status !== "passed") {
          await axios.put(`/api/samples/${id}/steps/${tomaStep.id}`, { status: "passed", notes: null });
        }
      }
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Volver al dashboard
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6 shadow-sm dark:shadow-none">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              {sample.codigo_orden || sample.code}
            </p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{sample.nombre_material || sample.product_name}</h1>
            {sample.codigo_material && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Código de material: {sample.codigo_material}</p>}

            <div className="flex flex-wrap gap-2 mt-3">
              {sample.grupo_turno && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 rounded-full px-3 py-1 text-xs font-semibold">
                  Turno {sample.grupo_turno}
                </span>
              )}
              {sample.nombre_reactor && (
                <span className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                  {sample.nombre_reactor}
                </span>
              )}
              {(sample.nombre_empleado || sample.apellido_empleado) && (
                <span className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                  👤 {sample.nombre_empleado} {sample.apellido_empleado}
                </span>
              )}
            </div>

            {sample.comentarios && <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">💬 {sample.comentarios}</p>}
            {sample.description && <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 italic">{sample.description}</p>}
          </div>
          <div className="flex items-start gap-2 flex-wrap">
            <SampleStatusBadge status={sample.status} size="lg" />
            {sample.attempt > 1 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                Intento #{sample.attempt}
              </span>
            )}
            {sample.status === "rejected" && (
              <button onClick={() => setShowRetry(true)}
                className="p-2 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-all"
                title="Reintentar muestra">
                <RotateCcw size={16} />
              </button>
            )}
            {sample.status !== "completed" && sample.status !== "cancelled" && (
              <button onClick={() => setShowCancel(true)}
                className="p-2 text-gray-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-lg transition-all"
                title="Cancelar muestra">
                <Ban size={16} />
              </button>
            )}
            {user?.role === "admin" && (
              <>
                <Link to={`/samples/${id}/history`}
                  className="p-2 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-all"
                  title="Ver historial">
                  <History size={16} />
                </Link>
                {sample.status !== "completed" && sample.status !== "cancelled" && (
                  <button onClick={() => setShowDelete(true)}
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {sample.assigned_name && (
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Analista</p>
                <p className="text-gray-700 dark:text-gray-200">{sample.assigned_name}</p>
              </div>
            </div>
          )}
          {sample.created_by_name && (
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Creado por</p>
                <p className="text-gray-700 dark:text-gray-200">{sample.created_by_name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Registrada</p>
              <p className="text-gray-700 dark:text-gray-200">{fmtDateTime(sample.created_at)}</p>
            </div>
          </div>
        </div>

        {sample.steps?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <MiniProgress steps={sample.steps} />
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Pasos de Control de Calidad</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">Haz clic en un estado para actualizar</p>
        </div>
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
          readOnly={false}
        />
      </div>

      {/* Step modal */}
      {selectedStep && (
        <StepNotesModal
          step={{ ...selectedStep, status: selectedStep.newStatus || selectedStep.status, originalStatus: selectedStep.originalStatus || selectedStep.status }}
          onClose={() => setSelectedStep(null)}
          onSave={handleUpdateStep}
          analysts={selectedStep.step_name === "Análisis" ? analysts : []}
        />
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
              Se reiniciarán todos los pasos de <span className="font-mono text-gray-900 dark:text-white">{sample.code}</span> y comenzará un nuevo intento de validación.
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
              ¿Confirmas cancelar <span className="font-mono text-gray-900 dark:text-white">{sample.code}</span>? Esta acción cierra el ticket y ya no podrá reintentarse.
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">¿Estás seguro de que deseas eliminar <span className="text-gray-900 dark:text-white font-mono">{sample.code}</span>?</p>
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
