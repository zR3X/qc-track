import { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FlaskConical, Search, AlertCircle, Package, User, Calendar,
  LogIn, Sun, Moon, X, Check, Clock, Loader, SkipForward, Plus, Pin, MessageSquare,
} from "lucide-react";
import SampleStatusBadge from "../components/SampleStatusBadge";
import MiniProgress from "../components/MiniProgress";
import ChatPanel from "../components/ChatPanel";
import { useTheme } from "../context/ThemeContext";
import { useToast, ToastContainer } from "../components/Toast";
import { fmtDate } from "../utils/date";

const HIDDEN_STEPS = new Set(["Ingreso", "Toma de muestra"]);
const PAGE_SIZE = 12;

const STEP_STATUS = {
  passed:      { bg: "bg-green-500",                   icon: Check,       iconColor: "text-white" },
  failed:      { bg: "bg-red-500",                     icon: X,           iconColor: "text-white" },
  in_progress: { bg: "bg-blue-500",                    icon: Loader,      iconColor: "text-white", pulse: true },
  skipped:     { bg: "bg-yellow-400",                  icon: SkipForward, iconColor: "text-white" },
  pending:     { bg: "bg-gray-200 dark:bg-gray-700",   icon: Clock,       iconColor: "text-gray-400 dark:text-gray-500" },
};

const SAMPLE_ACCENT = {
  completed:   "border-l-green-400",
  rejected:    "border-l-red-400",
  in_progress: "border-l-blue-400",
  pending:     "border-l-gray-300 dark:border-l-gray-700",
};

function StepDot({ step }) {
  const cfg = STEP_STATUS[step.status] || STEP_STATUS.pending;
  const Icon = cfg.icon;
  const active = step.status === "in_progress";
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className={`relative w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${active ? "animate-pulse ring-4 ring-blue-300 dark:ring-blue-700" : ""}`}>
        <Icon size={20} className={`${cfg.iconColor} ${active ? "animate-spin" : ""}`} />
      </div>
      <span className={`text-xs text-center leading-tight truncate w-full px-0.5 ${active ? "font-bold text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
        {step.step_name}
      </span>
    </div>
  );
}

const INPUT_CLS = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-400 dark:placeholder-gray-600 disabled:opacity-50";
const LABEL_CLS = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

const STEPS = [
  { label: "Turno y Empleado" },
  { label: "Material" },
  { label: "Confirmar" },
];

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

function NewSampleModal({ onClose, onCreated }) {
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

  // Sugerencias de empleado con debounce 400ms al escribir
  useEffect(() => {
    setEmpleadoBuscado(false); setEmpleadoError(""); setEmpSugerencias([]);
    setForm(f => ({ ...f, nombre_empleado: "", apellido_empleado: "" }));
    if (!form.numero_empleado) return;
    const t = setTimeout(async () => {
      setLoadingEmp(true);
      try {
        const { data } = await axios.get(`/api/ccr/empleados?q=${form.numero_empleado}`);
        setEmpSugerencias(data);
        // Si hay coincidencia exacta, seleccionar automáticamente
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
    form.grupo_turno && empleadoBuscado,                   // paso 0: turno + empleado
    form.codigo_material && form.nombre_material,          // paso 1: material
    true,                                                  // paso 2: confirmar (comentarios opcional)
  ];

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      const payload = { ...form, product_name: form.nombre_material || form.codigo_material, batch: form.codigo_material };
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

          {/* ── Paso 0: Turno + Código de Orden + Empleado ── */}
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
                    placeholder="00000000" maxLength={8} className={INPUT_CLS}
                  />
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

          {/* ── Paso 1: Reactor y Material ── */}
          {step === 1 && (
            <div className="space-y-3">
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
                <label className={LABEL_CLS}>Fases</label>
                <input value={form.fases} onChange={e => set("fases", e.target.value)}
                  placeholder="Ej: Fase 1, Fase 2..." className={INPUT_CLS}
                />
              </div>
            </div>
          )}

          {/* ── Paso 2: Resumen + Comentarios ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Turno</span><span className="font-semibold text-gray-900 dark:text-white">{form.grupo_turno}</span></div>
                {form.codigo_orden && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Código de Orden</span><span className="font-mono font-semibold text-gray-900 dark:text-white">{form.codigo_orden}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Empleado</span><span className="font-semibold text-gray-900 dark:text-white">{form.nombre_empleado} {form.apellido_empleado}</span></div>
                {form.nombre_reactor && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Reactor</span><span className="font-semibold text-gray-900 dark:text-white truncate max-w-[60%] text-right">{form.nombre_reactor}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Material</span><span className="font-semibold text-gray-900 dark:text-white truncate max-w-[60%] text-right">{form.nombre_material}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Código</span><span className="font-mono font-semibold text-gray-900 dark:text-white">{form.codigo_material}</span></div>
                {form.fases && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Fases</span><span className="font-semibold text-gray-900 dark:text-white">{form.fases}</span></div>}
              </div>
              <div>
                <label className={LABEL_CLS}>Comentarios</label>
                <textarea value={form.comentarios} onChange={e => set("comentarios", e.target.value)}
                  placeholder="Observaciones opcionales..." rows={2}
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
            </div>
          )}

        </div>

        {/* ── Navegación ── */}
        <div className="flex gap-2 mt-6">
          <button type="button"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">
            {step === 0 ? "Cancelar" : "← Atrás"}
          </button>
          {step < 2 ? (
            <button type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext[step]}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold transition-all">
              Siguiente →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Crear Muestra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SampleCard = memo(function SampleCard({ sample, isNew, pinned, onPin, onChat, unreadChat }) {
  const steps = (sample.steps || []).filter(s => !HIDDEN_STEPS.has(s.step_name));
  const accent = SAMPLE_ACCENT[sample.status] || SAMPLE_ACCENT.pending;

  return (
    <div
      className={`relative border-l-4 ${accent} rounded-2xl transition-all flex flex-col sm:flex-row ${
        sample.status === "cancelled"
          ? "bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-700 grayscale opacity-60 hover:opacity-80"
          : isNew
            ? "bg-white dark:bg-gray-900 border-2 border-green-400 dark:border-green-500 shadow-[0_0_0_4px_rgba(74,222,128,0.25)] animate-new-sample"
            : pinned
              ? "bg-white dark:bg-gray-900 border-2 border-indigo-300 dark:border-indigo-700 shadow-md dark:shadow-none"
              : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >

      {sample.status === "cancelled" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-zinc-400 dark:text-zinc-500 font-black text-xl tracking-widest uppercase select-none border-4 border-zinc-400 dark:border-zinc-500 px-4 py-1 rounded-lg opacity-70">
            Cancelada
          </span>
        </div>
      )}

      {/* Left: sample info */}
      <div className="p-4 sm:p-5 flex flex-row sm:flex-col justify-between gap-3 sm:w-48 flex-shrink-0 border-b border-gray-100 dark:border-gray-800 sm:border-b-0 sm:border-r">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className={`font-bold text-sm leading-snug ${sample.codigo_orden ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}>{sample.codigo_orden || sample.code}</h3>
            {sample.attempt > 1 && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                #{sample.attempt}
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{sample.nombre_material || sample.product_name}</h3>
          {sample.codigo_material && <p className="font-bold text-gray-400 dark:text-gray-500 text-sm leading-snug">{sample.codigo_material}</p>}
          <div className="flex flex-col gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {sample.assigned_name && <span className="flex items-center gap-1"><User size={11} />{sample.assigned_name}</span>}
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {fmtDate(sample.created_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SampleStatusBadge status={sample.status} />
          {sample.status !== "cancelled" && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Chat */}
              <button
                onClick={() => onChat(sample)}
                className={`relative p-1.5 rounded-lg transition-all ${
                  unreadChat > 0
                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
                title="Abrir chat"
              >
                <MessageSquare size={14} />
                {unreadChat > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </span>
                )}
              </button>
              {/* Pin */}
              <button
                onClick={() => onPin(sample.id)}
                className={`p-1.5 rounded-lg transition-all ${
                  pinned
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
                title={pinned ? "Quitar fijado" : "Fijar card"}
              >
                <Pin size={14} className={pinned ? "fill-current" : ""} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: progress + steps */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-0">
        {steps.length > 0 ? (
          <>
            <MiniProgress steps={steps} />
            <div className="flex gap-1.5 items-start">
              {steps.map(step => <StepDot key={step.id} step={step} />)}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 self-center">Sin pasos configurados</p>
        )}
      </div>
    </div>
  );
});

export default function PublicStatus() {
  const [samples, setSamples] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newSampleId, setNewSampleId] = useState(null);
  const [page, setPage] = useState(1);
  const [timerKey, setTimerKey] = useState(0);
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qc_pinned_ids") || "[]")); }
    catch { return new Set(); }
  });
  const [chatSample, setChatSample] = useState(null);
  const [unreadOperatorChat, setUnreadOperatorChat] = useState({});

  const markChatRead = useCallback((id) => {
    setUnreadOperatorChat(prev => ({ ...prev, [id]: 0 }));
  }, []);
  const { dark, toggle } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    axios.get("/api/samples/public")
      .then(r => setSamples(r.data))
      .finally(() => setLoadingList(false));
  }, []);

  // Persist pins
  useEffect(() => {
    localStorage.setItem("qc_pinned_ids", JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  // Auto-unpin when sample completes or cancels
  useEffect(() => {
    setPinnedIds(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const id of prev) {
        const s = samples.find(x => x.id === id);
        if (s && (s.status === "completed" || s.status === "cancelled")) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [samples]);

  const filtered = search.trim()
    ? (() => {
        const term = search.trim().toLowerCase();
        return samples.filter(s =>
          s.code.toLowerCase().includes(term) ||
          (s.product_name || "").toLowerCase().includes(term) ||
          (s.nombre_material || "").toLowerCase().includes(term) ||
          (s.codigo_material || "").toLowerCase().includes(term) ||
          (s.codigo_orden || "").toLowerCase().includes(term)
        );
      })()
    : samples;

  const pinnedSamples = filtered.filter(s => pinnedIds.has(s.id));
  const unpinned = filtered.filter(s => !pinnedIds.has(s.id));
  const totalPages = Math.ceil(unpinned.length / PAGE_SIZE);
  const paginated = unpinned.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToPage = (n) => { setPage(n); setTimerKey(k => k + 1); };

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setTimerKey(k => k + 1);
  };

  // Auto-carousel every 5s
  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setPage(p => (p >= totalPages ? 1 : p + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [timerKey, totalPages]);

  // Polling mensajes no leídos del analista (para badges en cards)
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

  // Reset page when search changes
  useEffect(() => { setPage(1); setTimerKey(k => k + 1); }, [search]);

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

          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={14} />
              </button>
            )}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar código, producto o lote..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white
                rounded-lg pl-9 pr-8 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20
                transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
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

      <div className="flex-1 w-full px-4 py-8">

        {/* Pinned section */}
        {pinnedSamples.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Pin size={13} className="text-indigo-500 fill-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fijadas</span>
              <span className="text-xs text-gray-400 dark:text-gray-600">({pinnedSamples.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {pinnedSamples.map(s => (
                <SampleCard key={s.id} sample={s} isNew={s.id === newSampleId} pinned={true} onPin={togglePin} onChat={setChatSample} unreadChat={unreadOperatorChat[s.id] || 0} />
              ))}
            </div>
            {unpinned.length > 0 && <hr className="mt-8 border-gray-200 dark:border-gray-800" />}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingList && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-gray-200 dark:border-l-gray-700 rounded-2xl p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                  <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full mb-2" />
                <div className="flex gap-2 mt-4">
                  {[1,2,3,4].map(j => <div key={j} className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loadingList && filtered.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {search ? "Sin resultados para esa búsqueda" : "No hay muestras registradas"}
            </p>
          </div>
        )}

        {/* Carousel grid */}
        {!loadingList && unpinned.length > 0 && (
          <>
            {/* Progress bar */}
            {totalPages > 1 && (
              <div className="overflow-hidden h-0.5 bg-gray-200 dark:bg-gray-800 rounded-full mb-4">
                <div
                  key={`${timerKey}-${page}`}
                  className="h-full bg-indigo-500 animate-progress-carousel"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {paginated.map(s => (
                <SampleCard key={s.id} sample={s} isNew={s.id === newSampleId} pinned={false} onPin={togglePin} onChat={setChatSample} unreadChat={unreadOperatorChat[s.id] || 0} />
              ))}
            </div>

            {/* Pagination dots */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    className={`rounded-full transition-all ${
                      n === page
                        ? "w-6 h-2.5 bg-indigo-500"
                        : "w-2.5 h-2.5 bg-gray-300 dark:bg-gray-700 hover:bg-indigo-300 dark:hover:bg-indigo-700"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="text-center text-gray-300 dark:text-gray-700 text-xs py-4 border-t border-gray-200 dark:border-gray-900">
        QC Track · Sistema de Control de Calidad
      </footer>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showModal && (
        <NewSampleModal
          onClose={() => setShowModal(false)}
          onCreated={(newSample) => {
            setShowModal(false);
            setSamples(prev => [newSample, ...prev]);
            setPage(1);
            setTimerKey(k => k + 1);
            setNewSampleId(newSample.id);
            setTimeout(() => setNewSampleId(null), 4000);
            addToast("success", `Muestra "${newSample.product_name}" creada exitosamente.`, "Muestra registrada");
          }}
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
