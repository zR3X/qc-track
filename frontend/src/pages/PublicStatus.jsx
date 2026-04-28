import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FlaskConical, AlertCircle,
  LogIn, Sun, Moon, X, Plus, Pin, MessageSquare,
  Check, Clock, Loader, SkipForward, ShieldCheck, User, Calendar,
} from "lucide-react";
import SearchBar from "../components/SearchBar";
import { SampleGridCard, HIDDEN_STEPS } from "../components/SampleGridCard";
import ChatPanel from "../components/ChatPanel";
import SampleStatusBadge from "../components/SampleStatusBadge";
import { useTheme } from "../context/ThemeContext";
import { useToast, ToastContainer } from "../components/Toast";
import { fmtDate, fmtTime } from "../utils/date";

const PAGE_SIZE = 20;

const INPUT_CLS = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-400 dark:placeholder-gray-600 disabled:opacity-50";
const LABEL_CLS = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

const STEPS = [
  { label: "Turno y Empleado" },
  { label: "Material" },
];

const STEP_DOT = {
  passed:      "bg-green-500",
  failed:      "bg-red-500",
  in_progress: "bg-blue-500",
  skipped:     "bg-yellow-400",
  pending:     "bg-gray-200 dark:bg-gray-700",
};

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < current ? "bg-indigo-600 text-white" :
              i === current ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/40" :
              "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap ${i === current ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-600"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${i < current ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function NewSampleModal({ onClose, onCreated, samples = [], onViewSample }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    product_name: "", batch: "", description: "",
    grupo_turno: "", codigo_orden: "",
    numero_empleado: "", nombre_empleado: "", apellido_empleado: "",
    planta: "", codigo_reactor: "", nombre_reactor: "",
    codigo_material: "", nombre_material: "",
    fases: "", comentarios: "",
  });
  const [plantas, setPlantas] = useState([]);
  const [reactores, setReactores] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [matSugerencias, setMatSugerencias] = useState([]);
  const [empSugerencias, setEmpSugerencias] = useState([]);
  const [empleadoBuscado, setEmpleadoBuscado] = useState(false);
  const [empleadoError, setEmpleadoError] = useState("");
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const ordenDuplicada = useMemo(() => {
    if (!form.codigo_orden || form.codigo_orden.length < 3) return null;
    const matches = samples.filter(s => s.codigo_orden && String(s.codigo_orden) === String(form.codigo_orden));
    if (!matches.length) return null;
    // Devolver la de mayor attempt (fase más reciente)
    return matches.reduce((a, b) => ((a.attempt || 1) >= (b.attempt || 1) ? a : b));
  }, [form.codigo_orden, samples]);

  // Nueva fase: la orden más reciente está completada (independiente del número de intento/retry)
  const esNuevaFase = ordenDuplicada?.status === "completed";

  // Auto-rellenar campos desde la muestra completada al detectar nueva fase
  useEffect(() => {
    if (!esNuevaFase || !ordenDuplicada) return;
    setForm(f => ({
      ...f,
      planta:          ordenDuplicada.planta          || f.planta,
      codigo_reactor:  ordenDuplicada.codigo_reactor  || f.codigo_reactor,
      nombre_reactor:  ordenDuplicada.nombre_reactor  || f.nombre_reactor,
      codigo_material: ordenDuplicada.codigo_material || f.codigo_material,
      nombre_material: ordenDuplicada.nombre_material || f.nombre_material,
      comentarios:     "",
    }));
  }, [esNuevaFase, ordenDuplicada?.id]);

  useEffect(() => {
    axios.get("/api/ccr/plantas").then(r => setPlantas(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setReactores([]);
    setMateriales([]);
    setMatSugerencias([]);
    setForm(f => ({ ...f, codigo_reactor: "", nombre_reactor: "", codigo_material: "", nombre_material: "" }));
    if (!form.planta) return;
    axios.get(`/api/ccr/reactores?planta=${encodeURIComponent(form.planta)}`)
      .then(r => setReactores(r.data)).catch(() => {});
  }, [form.planta]);

  useEffect(() => {
    setMateriales([]);
    setMatSugerencias([]);
    setForm(f => ({ ...f, codigo_material: "", nombre_material: "" }));
    if (!form.codigo_reactor) return;
    axios.get(`/api/ccr/materiales?reactor=${encodeURIComponent(form.codigo_reactor)}`)
      .then(r => setMateriales(r.data)).catch(() => {});
  }, [form.codigo_reactor]);

  useEffect(() => {
    setEmpleadoBuscado(false); setEmpleadoError(""); setEmpSugerencias([]);
    setForm(f => ({ ...f, nombre_empleado: "", apellido_empleado: "" }));
    if (!form.numero_empleado) return;
    const t = setTimeout(async () => {
      setLoadingEmp(true);
      try {
        const { data } = await axios.get(`/api/ccr/empleados?q=${form.numero_empleado}`);
        setEmpSugerencias(data);
        const exacto = data.find(e => String(e.numero) === form.numero_empleado);
        if (exacto) {
          setForm(f => ({ ...f, nombre_empleado: exacto.nombre, apellido_empleado: exacto.apellido }));
          setEmpleadoBuscado(true);
          setEmpSugerencias([]);
        }
      } catch {
        setEmpSugerencias([]);
      } finally { setLoadingEmp(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [form.numero_empleado]);

  const seleccionarEmpleado = (emp) => {
    setForm(f => ({ ...f, numero_empleado: String(emp.numero), nombre_empleado: emp.nombre, apellido_empleado: emp.apellido }));
    setEmpleadoBuscado(true);
    setEmpSugerencias([]);
  };

  const confirmarEmpleado = () => {};

  const handleReactorChange = (e) => {
    const val = e.target.value.trim();
    const selected = reactores.find(r => String(r.codigo).trim() === val);
    setForm(f => ({ ...f, codigo_reactor: selected?.codigo || "", nombre_reactor: selected?.nombre || "", codigo_material: "", nombre_material: "" }));
  };

  const handleCodigoMaterialChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
    setForm(f => ({ ...f, codigo_material: val, nombre_material: "" }));
    if (val.length === 0) { setMatSugerencias([]); return; }
    const filtradas = materiales.filter(m => String(m.codigo).trim().startsWith(val));
    setMatSugerencias(filtradas.slice(0, 8));
    if (filtradas.length === 1 && String(filtradas[0].codigo).trim() === val) {
      setForm(f => ({ ...f, codigo_material: filtradas[0].codigo, nombre_material: filtradas[0].nombre }));
      setMatSugerencias([]);
    }
  };

  const seleccionarMaterial = (m) => {
    setForm(f => ({ ...f, codigo_material: m.codigo, nombre_material: m.nombre }));
    setMatSugerencias([]);
  };

  const canNext = [
    form.grupo_turno && empleadoBuscado,
    form.codigo_material && form.nombre_material,
    true,
  ];

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      const base = esNuevaFase ? {
        ...form,
        planta:          ordenDuplicada.planta,
        codigo_reactor:  ordenDuplicada.codigo_reactor,
        nombre_reactor:  ordenDuplicada.nombre_reactor,
        codigo_material: ordenDuplicada.codigo_material,
        nombre_material: ordenDuplicada.nombre_material,
      } : form;
      const payload = { ...base, product_name: base.nombre_material || base.codigo_material, batch: base.codigo_material };
      const data = await axios.post("/api/new-sample", payload).then(r => r.data);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Error al crear muestra");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Muestra</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <StepIndicator current={step} />

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

        <div className="min-h-[180px]">

          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Turno *</label>
                  <div className="flex gap-1.5">
                    {["A", "B", "C", "D"].map(t => (
                      <button key={t} type="button" onClick={() => set("grupo_turno", t)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-all ${
                          form.grupo_turno === t
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400"
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Código de Orden</label>
                  <input value={form.codigo_orden}
                    onChange={e => set("codigo_orden", e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="00000000" maxLength={8}
                    className={`${INPUT_CLS} ${ordenDuplicada ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20" : ""}`}
                  />
                  {ordenDuplicada && (
                    esNuevaFase ? (
                      <div className="mt-1.5 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2.5 bg-blue-50 dark:bg-blue-950/40">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Nueva fase de control de calidad</p>
                        </div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] text-blue-500 dark:text-blue-400">Fase actual:</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                            Fase {ordenDuplicada.fase || 1} — completada
                          </span>
                          <span className="text-blue-400 dark:text-blue-600">→</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                            Fase {(ordenDuplicada.fase || 1) + 1} — nueva
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed mb-1.5">
                          <span className="font-semibold">{ordenDuplicada.nombre_material || ordenDuplicada.product_name}</span>. En el siguiente paso describe qué aspecto debe revisarse en esta nueva fase.
                        </p>
                        <button
                          type="button"
                          onClick={() => onViewSample(ordenDuplicada)}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Ver fase {ordenDuplicada.fase || 1} →
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Ya se está trabajando en esta orden</p>
                          <p className="text-[11px] truncate text-amber-600 dark:text-amber-500">{ordenDuplicada.nombre_material || ordenDuplicada.product_name}</p>
                          <button type="button" onClick={() => onViewSample(ordenDuplicada)} className="mt-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                            Ver muestra →
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Número de Empleado *</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input value={form.numero_empleado}
                      onChange={e => set("numero_empleado", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Ej: 1234" maxLength={4} autoComplete="off" className={INPUT_CLS}
                    />
                    {loadingEmp && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    )}
                    {empSugerencias.length > 0 && (
                      <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
                        {empSugerencias.map((emp, i) => (
                          <li key={`${emp.numero}-${i}`}>
                            <button type="button" onClick={() => seleccionarEmpleado(emp)}
                              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{emp.numero}</span>
                              <span className="ml-2 text-xs text-gray-700 dark:text-gray-300">{emp.nombre} {emp.apellido}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button type="button" onClick={confirmarEmpleado} disabled={!empleadoBuscado}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all flex-shrink-0">
                    OK
                  </button>
                </div>
                {empleadoError && <p className="mt-1 text-xs text-red-500">{empleadoError}</p>}
                {empleadoBuscado && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-semibold">
                    ✓ {form.nombre_empleado} {form.apellido_empleado}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {esNuevaFase ? (
                <>
                  {/* Campos auto-rellenados: solo lectura */}
                  <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Datos de la orden anterior (autocompletado)</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {[
                        { label: "Planta",        value: ordenDuplicada.planta },
                        { label: "Reactor",       value: ordenDuplicada.nombre_reactor || ordenDuplicada.codigo_reactor },
                        { label: "Cód. Material", value: ordenDuplicada.codigo_material },
                        { label: "Material",      value: ordenDuplicada.nombre_material },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Aviso nueva fase */}
                  <div className="border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      Indica qué fase o aspecto debe revisarse en esta nueva muestra. Este campo es <strong>obligatorio</strong>.
                    </p>
                  </div>
                  {/* Comentario obligatorio */}
                  <div>
                    <label className={LABEL_CLS}>
                      Descripción de la fase a revisar <span className="text-red-500">*</span>
                    </label>
                    <textarea value={form.comentarios} onChange={e => set("comentarios", e.target.value)}
                      placeholder="Ej: Segunda revisión de viscosidad, lote observado en línea 3..."
                      rows={3} autoFocus
                      className={`${INPUT_CLS} resize-none ${!form.comentarios.trim() ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/20" : "border-green-400 dark:border-green-600"}`}
                    />
                    {!form.comentarios.trim() && (
                      <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">Requerido para registrar la nueva fase</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Planta</label>
                      <select value={form.planta} onChange={e => set("planta", e.target.value)} className={INPUT_CLS}>
                        <option value="">— Seleccionar —</option>
                        {plantas.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Reactor</label>
                      <select value={form.codigo_reactor} onChange={handleReactorChange} disabled={!form.planta} className={INPUT_CLS}>
                        <option value="">— Seleccionar —</option>
                        {reactores.map(r => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className={LABEL_CLS}>Código Material *</label>
                      <input value={form.codigo_material} onChange={handleCodigoMaterialChange}
                        placeholder="00000000" maxLength={8} disabled={!form.codigo_reactor} className={INPUT_CLS}
                      />
                      {matSugerencias.length > 0 && (
                        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto text-sm">
                          {matSugerencias.map((m, i) => (
                            <li key={`${m.codigo}-${i}`}>
                              <button type="button" onClick={() => seleccionarMaterial(m)}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-800 dark:text-gray-200 transition-colors">
                                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{m.codigo}</span>
                                <span className="ml-2 truncate text-xs text-gray-500 dark:text-gray-400">{m.nombre}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Nombre Material</label>
                      <input value={form.nombre_material} readOnly placeholder="Auto"
                        className={`${INPUT_CLS} bg-gray-100 dark:bg-gray-700 cursor-default`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Comentarios</label>
                    <textarea value={form.comentarios} onChange={e => set("comentarios", e.target.value)}
                      placeholder="Observaciones opcionales..." rows={2}
                      className={`${INPUT_CLS} resize-none`}
                    />
                  </div>
                </>
              )}
            </div>
          )}


        </div>

        <div className="flex gap-2 mt-6">
          <button type="button"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">
            {step === 0 ? "Cancelar" : "← Atrás"}
          </button>
          {step < 1 ? (
            <button type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext[step]}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold transition-all">
              Siguiente →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading || (esNuevaFase && !form.comentarios.trim())}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {esNuevaFase ? "Registrar nueva fase" : "Crear Muestra"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const STEP_DOT_CFG = {
  passed:      { bg: "bg-green-500",                   icon: Check,       iconColor: "text-white",                          label: "Aprobado",   pulse: false },
  failed:      { bg: "bg-red-500",                     icon: X,           iconColor: "text-white",                          label: "Fallido",    pulse: false },
  in_progress: { bg: "bg-blue-500",                    icon: Loader,      iconColor: "text-white",                          label: "En proceso", pulse: true  },
  skipped:     { bg: "bg-yellow-400",                  icon: SkipForward, iconColor: "text-white",                          label: "Omitido",    pulse: false },
  pending:     { bg: "bg-gray-200 dark:bg-gray-700",   icon: Clock,       iconColor: "text-gray-400 dark:text-gray-500",    label: "Pendiente",  pulse: false },
};

/* ── Individual step cell ── */
function StepCell({ steps, stepName }) {
  const s = (steps || []).find(x => x.step_name === stepName);
  const status = s?.status || "pending";
  const cfg = STEP_DOT_CFG[status] || STEP_DOT_CFG.pending;
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.pulse ? "animate-pulse" : ""}`}>
        <Icon size={14} className={`${cfg.iconColor} ${cfg.pulse ? "animate-spin" : ""}`} />
      </div>
      <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">{cfg.label}</span>
    </div>
  );
}

/* ── Row detail modal ── */
const STEP_NAMES_MODAL = ["Entrega", "Análisis", "Resultado"];
const BAR_COLORS_MODAL = {
  pending:     "bg-gray-200 dark:bg-gray-700",
  in_progress: "bg-blue-500",
  passed:      "bg-green-500",
  failed:      "bg-red-500",
  skipped:     "bg-gray-400",
};

function SampleRowModal({ sample, onClose, onPin, unreadChat, pinned, onReadChat }) {
  const stepMap = useMemo(() => {
    const m = {};
    (sample.steps || []).forEach(s => { if (s.step_name) m[s.step_name.toLowerCase()] = s; });
    return m;
  }, [sample.steps]);

  const senderName = [sample.nombre_empleado?.split(" ")[0], sample.apellido_empleado?.split(" ")[0]].filter(Boolean).join(" ") || "Operador";

  const operador = [sample.nombre_empleado, sample.apellido_empleado].filter(Boolean).join(" ") || null;

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex items-stretch gap-3 w-full max-w-4xl" onClick={e => e.stopPropagation()}>

        {/* ── Detail panel ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl flex-1 shadow-2xl flex flex-col max-h-[90vh] min-w-0">

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400 font-mono leading-none">
                    {sample.codigo_orden || sample.code}
                  </span>
                  {sample.attempt > 1 && (
                    <span className="text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                      #{sample.attempt}
                    </span>
                  )}
                  {sample.approval_pending && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded border border-amber-400/60">
                      <ShieldCheck size={10} /> Pendiente turno
                    </span>
                  )}
                </div>
                <p className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                  {sample.nombre_material || sample.product_name}
                </p>
                {sample.codigo_material && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{sample.codigo_material}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SampleStatusBadge status={sample.status} size="lg" />
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Steps bar inside header */}
            <div className="flex gap-3 mt-1">
              {STEP_NAMES_MODAL.map(name => {
                const s = stepMap[name.toLowerCase()];
                const status = s?.status || "pending";
                const ts = s?.completed_at || s?.started_at || null;
                const cfg = STEP_DOT_CFG[status] || STEP_DOT_CFG.pending;
                const Icon = cfg.icon;
                return (
                  <div key={name} className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{name}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.pulse ? "animate-pulse" : ""}`}>
                        <Icon size={11} className={`${cfg.iconColor} ${cfg.pulse ? "animate-spin" : ""}`} />
                      </div>
                    </div>
                    <div className={`h-1.5 rounded-full ${BAR_COLORS_MODAL[status]}`} />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tabular-nums">
                      {ts ? fmtTime(ts) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Sección: Orden */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Orden</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: null,     label: "Código orden", value: sample.codigo_orden },
                  { icon: Calendar, label: "Fecha",        value: sample.created_at ? `${fmtDate(sample.created_at)} · ${fmtTime(sample.created_at)}` : null },
                  { icon: null,     label: "Planta",       value: sample.planta },
                  { icon: null,     label: "Reactor",      value: sample.nombre_reactor || sample.codigo_reactor },
                ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {Icon && <Icon size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección: Personal */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Personal</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: null, label: "Turno",       value: sample.grupo_turno },
                  { icon: null, label: "Nº Empleado", value: sample.numero_empleado ? `#${sample.numero_empleado}` : null },
                  { icon: User, label: "Operador",    value: operador },
                  { icon: User, label: "Analista",    value: sample.assigned_name },
                ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {Icon && <Icon size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comentarios */}
            {sample.comentarios && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Comentarios del operador</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{sample.comentarios}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {sample.status !== "cancelled" && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onPin(sample.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pinned
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                <Pin size={14} className={pinned ? "fill-current" : ""} />
                {pinned ? "Quitar pin" : "Fijar card"}
              </button>
            </div>
          )}
        </div>

        {/* ── Chat panel (inline, always visible) ── */}
        <div className="w-80 flex-shrink-0 flex flex-col max-h-[90vh]">
          <ChatPanel
            sampleId={sample.id}
            sampleCode={sample.codigo_orden || sample.code}
            senderName={senderName}
            senderRole="operator"
            onClose={onClose}
            onRead={onReadChat}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Table row ── */
function SampleTableRow({ sample, isNew, onPin, onChat, unreadChat, stepNames, onRowClick, rowIndex }) {
  const stepMap = useMemo(() => {
    const m = {};
    (sample.steps || []).forEach(s => { if (s.step_name) m[s.step_name] = s; });
    return m;
  }, [sample.steps]);

  return (
    <tr
      className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${onRowClick ? "cursor-pointer" : ""}
        ${sample.status === "cancelled" ? "opacity-50 grayscale" : ""}
        ${isNew ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-900/60"}
      `}
      onClick={onRowClick ? (e) => { if (e.target.closest("button")) return; onRowClick(sample); } : undefined}
    >

      {/* # */}
      <td className="px-3 py-2.5 whitespace-nowrap text-center">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tabular-nums">{rowIndex}</span>
      </td>

      {/* Orden / Código */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`font-mono font-semibold text-sm ${sample.codigo_orden ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>
            {sample.codigo_orden || sample.code}
          </span>
          {sample.approval_pending && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 px-1 py-0.5 rounded border border-amber-400/60 dark:border-amber-700" title="Pendiente de confirmación del jefe de turno">
              <ShieldCheck size={9} />
            </span>
          )}
        </div>
      </td>

      {/* Material */}
      <td className="px-3 py-2.5 max-w-[180px]">
        <div className="font-medium text-xs text-gray-900 dark:text-white truncate" title={sample.nombre_material || sample.product_name}>
          {sample.nombre_material || sample.product_name}
        </div>
        {sample.codigo_material && (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono font-medium">{sample.codigo_material}</div>
        )}
      </td>

      {/* Turno */}
      <td className="px-3 py-2.5 whitespace-nowrap text-center">
        {sample.grupo_turno ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
            {sample.grupo_turno}
          </span>
        ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
      </td>

      {/* Operador */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {(sample.nombre_empleado || sample.apellido_empleado) ? (
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate block max-w-[120px]">
            {[sample.nombre_empleado, sample.apellido_empleado].filter(Boolean).join(" ")}
          </span>
        ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
        {sample.numero_empleado && (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono font-medium">#{sample.numero_empleado}</div>
        )}
      </td>

      {/* Analista */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {sample.assigned_name ? (
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate block max-w-[100px]">{sample.assigned_name}</span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
        )}
      </td>

      {/* Estado */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <SampleStatusBadge status={sample.status} />
      </td>

      {/* Fase */}
      <td className="px-3 py-2.5 whitespace-nowrap text-center">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            (sample.fase || 1) > 1
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
              : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700"
          }`}>
            Fase {sample.fase || 1}
          </span>
          {sample.comentarios && (sample.fase || 1) > 1 && (
            <span className="text-[9px] text-blue-600 dark:text-blue-400 max-w-[90px] truncate" title={sample.comentarios}>
              {sample.comentarios}
            </span>
          )}
        </div>
      </td>

      {/* Paso columns (dynamic) */}
      {stepNames.map(name => (
        <td key={name} className="px-3 py-2.5 whitespace-nowrap text-center">
          <StepCell steps={sample.steps} stepName={name} />
        </td>
      ))}

      {/* Fecha */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-xs text-gray-600 dark:text-gray-400">{fmtDate(sample.created_at)}</span>
      </td>

      {/* Hora */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">{fmtTime(sample.created_at)}</span>
      </td>

      {/* Acciones */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {sample.status !== "cancelled" && (
            <>
              <button
                type="button"
                onClick={() => onChat(sample)}
                className={`relative p-1.5 rounded-lg transition-all ${
                  unreadChat > 0
                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    : "text-gray-400 dark:text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
                title="Abrir chat"
              >
                <MessageSquare size={13} />
                {unreadChat > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onPin(sample.id)}
                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                title="Fijar como card"
              >
                <Pin size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PublicStatus() {
  const [samples, setSamples] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [plantaFilter, setPlantaFilter] = useState(() => {
    try { return localStorage.getItem("qc_planta_filter") || ""; }
    catch { return ""; }
  });
  const [apiSearch, setApiSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newSampleId, setNewSampleId] = useState(null);
  const [page, setPage] = useState(1);
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("qc_pinned_ids") || "[]").map(Number); }
    catch { return []; }
  });
  const [chatSample, setChatSample] = useState(null);
  const [detailSample, setDetailSample] = useState(null);
  const [unreadOperatorChat, setUnreadOperatorChat] = useState({});

  const markChatRead = useCallback((id) => {
    setUnreadOperatorChat(prev => ({ ...prev, [id]: 0 }));
  }, []);
  const { dark, toggle } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  const handleFilterChange = useCallback((filters) => {
    setStatusFilter(filters.status || "all");
    setPlantaFilter(filters.planta || "");
    setApiSearch(typeof filters.search === "string" ? filters.search : "");
    if (Object.prototype.hasOwnProperty.call(filters, "dateFrom")) {
      setDateFrom(typeof filters.dateFrom === "string" ? filters.dateFrom : "");
    }
    if (Object.prototype.hasOwnProperty.call(filters, "dateTo")) {
      setDateTo(typeof filters.dateTo === "string" ? filters.dateTo : "");
    }
  }, []);

  const loadSamples = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = {};
      if (apiSearch) params.search = apiSearch;
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (plantaFilter?.trim()) params.planta = plantaFilter.trim();
      const df = typeof dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom.trim()) ? dateFrom.trim() : "";
      const dt = typeof dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim()) ? dateTo.trim() : "";
      if (df) params.date_from = df;
      if (dt) params.date_to = dt;
      const r = await axios.get("/api/samples/public", { params });
      setSamples(r.data);
    } catch {
      setSamples([]);
    } finally {
      setLoadingList(false);
    }
  }, [apiSearch, statusFilter, plantaFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Persist pins
  useEffect(() => {
    localStorage.setItem("qc_pinned_ids", JSON.stringify(pinnedIds));
  }, [pinnedIds]);


  const sorted = useMemo(() =>
    [...samples].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [samples]
  );
  const pinnedSamples = sorted.filter(s => pinnedIds.includes(Number(s.id)));
  const unpinned = sorted.filter(s => !pinnedIds.includes(Number(s.id)));
  const totalPages = Math.ceil(unpinned.length / PAGE_SIZE);
  const paginated = unpinned.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Derive ordered step names from samples (excluding hidden steps)
  const stepNames = useMemo(() => {
    const seen = new Map(); // name -> order_index
    for (const s of samples) {
      for (const step of (s.steps || [])) {
        if (!HIDDEN_STEPS.has(step.step_name) && !seen.has(step.step_name)) {
          seen.set(step.step_name, step.order_index ?? 999);
        }
      }
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [samples]);

  const togglePin = useCallback((id) => {
    const numId = Number(id);
    setPinnedIds(prev =>
      prev.includes(numId) ? prev.filter(x => x !== numId) : [...prev, numId]
    );
  }, []);

  // Polling mensajes no leídos
  useEffect(() => {
    const load = () =>
      axios.get("/api/chat/unread-operator/counts")
        .then(r => {
          const map = {};
          r.data.forEach(row => { map[row.muestra_id] = row.count; });
          setUnreadOperatorChat(map);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const hasActiveListFilters =
    Boolean(apiSearch) ||
    (statusFilter && statusFilter !== "all") ||
    Boolean(plantaFilter?.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  useEffect(() => { setPage(1); }, [apiSearch, statusFilter, plantaFilter, dateFrom, dateTo]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm dark:shadow-none">
        <div className="w-full px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">QC Track</span>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-all text-sm">
              <Plus size={14} /> Nueva Muestra
            </button>
          </div>

          <div className="flex-1 min-w-0 flex justify-center px-2">
            <div className="w-full max-w-2xl">
              <SearchBar
                placeholder="Buscar código, producto o lote..."
                onFilterChange={handleFilterChange}
                showStatusFilter
                showPlantaFilter
                persistFilters={true}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggle}
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              {dark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-500" />}
            </button>
            <Link to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Acceso analistas">
              <LogIn size={14} />
              <span className="hidden sm:inline">Acceso analistas</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full px-4 py-6">

        {/* Pinned cards */}
        {pinnedSamples.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Pin size={13} className="text-indigo-500 fill-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fijadas</span>
              <span className="text-xs text-gray-400 dark:text-gray-600">({pinnedSamples.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {pinnedSamples.map(s => (
                <SampleGridCard
                  key={s.id}
                  sample={s}
                  isNew={s.id === newSampleId}
                  pinned={true}
                  onPin={togglePin}
                  onChat={setChatSample}
                  unreadChat={unreadOperatorChat[s.id] || 0}
                  onCardClick={() => setDetailSample(s)}
                />
              ))}
            </div>
            {unpinned.length > 0 && <hr className="mt-8 border-gray-200 dark:border-gray-800" />}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingList && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden animate-pulse">
            <div className="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
                <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
                <div className="flex gap-1">
                  {[1,2,3].map(j => <div key={j} className="w-2.5 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full" />)}
                </div>
                <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-6 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loadingList && samples.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {hasActiveListFilters ? "Sin resultados con los filtros o la búsqueda actuales" : "No hay muestras registradas"}
            </p>
          </div>
        )}

        {/* Table */}
        {!loadingList && unpinned.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">#</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Orden</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Material</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">Turno</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Operador</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Analista</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Fase</th>
                    {stepNames.map(name => (
                      <th key={name} className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap text-center">{name}</th>
                    ))}
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Hora</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s, idx) => (
                    <SampleTableRow
                      key={s.id}
                      sample={s}
                      rowIndex={unpinned.length - ((page - 1) * PAGE_SIZE + idx)}
                      isNew={s.id === newSampleId}
                      onPin={togglePin}
                      onChat={setChatSample}
                      unreadChat={unreadOperatorChat[s.id] || 0}
                      stepNames={stepNames}
                      onRowClick={setDetailSample}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400 dark:text-gray-600">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, unpinned.length)} de {unpinned.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    ←
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 text-xs rounded-lg transition-all ${
                        n === page
                          ? "bg-indigo-600 text-white font-semibold"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="text-center text-gray-300 dark:text-gray-700 text-xs py-4 border-t border-gray-200 dark:border-gray-900">
        QC Track · Sistema de Control de Calidad
      </footer>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showModal && (
        <NewSampleModal
          onClose={() => setShowModal(false)}
          samples={samples}
          onViewSample={(s) => { setShowModal(false); setDetailSample(s); }}
          onCreated={(newSample) => {
            setShowModal(false);
            setSamples(prev => [newSample, ...prev]);
            setPage(1);
            setNewSampleId(newSample.id);
            setTimeout(() => setNewSampleId(null), 4000);
            addToast("success", `Muestra "${newSample.product_name}" creada exitosamente.`, "Muestra registrada");
          }}
        />
      )}

      {/* Row detail modal */}
      {detailSample && (
        <SampleRowModal
          sample={detailSample}
          onClose={() => setDetailSample(null)}
          onPin={togglePin}
          unreadChat={unreadOperatorChat[detailSample.id] || 0}
          pinned={pinnedIds.includes(Number(detailSample.id))}
          onReadChat={markChatRead}
        />
      )}

      {/* Chat drawer */}
      {chatSample && (
        <>
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/50 z-40"
            onClick={() => setChatSample(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 p-4 flex flex-col">
            <ChatPanel
              sampleId={chatSample.id}
              sampleCode={chatSample.codigo_orden || chatSample.code}
              senderName={[chatSample.nombre_empleado?.split(" ")[0], chatSample.apellido_empleado?.split(" ")[0]].filter(Boolean).join(" ") || "Operador"}
              senderRole="operator"
              onClose={() => setChatSample(null)}
              onRead={markChatRead}
            />
          </div>
        </>
      )}
    </div>
  );
}
