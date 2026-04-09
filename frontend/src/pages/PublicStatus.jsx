import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FlaskConical, Search, AlertCircle, Package, User, Calendar,
  LogIn, Sun, Moon, X, Check, Clock, Loader, SkipForward, Plus, Pin,
} from "lucide-react";
import SampleStatusBadge from "../components/SampleStatusBadge";
import MiniProgress from "../components/MiniProgress";
import { useTheme } from "../context/ThemeContext";
import { useToast, ToastContainer } from "../components/Toast";
import { fmtDate } from "../utils/date";

const HIDDEN_STEPS = new Set(["Ingreso", "Toma de muestra"]);
const PAGE_SIZE = 10;

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
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.pulse ? "animate-pulse" : ""}`}>
        <Icon size={14} className={`${cfg.iconColor} ${step.status === "in_progress" ? "animate-spin" : ""}`} />
      </div>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight truncate w-full px-0.5">
        {step.step_name}
      </span>
    </div>
  );
}

function NewSampleModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ product_name: "", batch: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await axios.post("/api/new-sample", form).then(r => r.data);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Error al crear muestra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Muestra</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"><X size={18} /></button>
        </div>
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Producto *</label>
            <input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
              placeholder="Nombre del producto"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lote</label>
            <input value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
              placeholder="LOT-001"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descripción opcional..." rows={2}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-400 dark:placeholder-gray-600 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !form.product_name}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Crear Muestra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const SampleCard = memo(function SampleCard({ sample, isNew, pinned, onPin }) {
  const steps = (sample.steps || []).filter(s => !HIDDEN_STEPS.has(s.step_name));
  const accent = SAMPLE_ACCENT[sample.status] || SAMPLE_ACCENT.pending;

  return (
    <div
      className={`relative border-l-4 ${accent} rounded-2xl transition-all flex ${
        sample.status === "cancelled"
          ? "bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-700 grayscale opacity-60 hover:opacity-80"
          : isNew
            ? "bg-white dark:bg-gray-900 border-2 border-green-400 dark:border-green-500 shadow-[0_0_0_4px_rgba(74,222,128,0.25)] animate-new-sample"
            : pinned
              ? "bg-white dark:bg-gray-900 border-2 border-indigo-300 dark:border-indigo-700 shadow-md dark:shadow-none"
              : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      {/* Pin button */}
      {sample.status !== "cancelled" && (
        <button
          onClick={() => onPin(sample.id)}
          className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg transition-all ${
            pinned
              ? "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
              : "text-gray-300 dark:text-gray-700 hover:text-indigo-400 dark:hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          title={pinned ? "Quitar fijado" : "Fijar card"}
        >
          <Pin size={13} className={pinned ? "fill-current" : ""} />
        </button>
      )}

      {sample.status === "cancelled" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-zinc-400 dark:text-zinc-500 font-black text-xl tracking-widest uppercase select-none border-4 border-zinc-400 dark:border-zinc-500 px-4 py-1 rounded-lg opacity-70">
            Cancelada
          </span>
        </div>
      )}

      {/* Left: sample info */}
      <div className="p-5 flex flex-col justify-between gap-3 w-52 flex-shrink-0 border-r border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{sample.code}</span>
            {sample.attempt > 1 && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                #{sample.attempt}
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{sample.product_name}</h3>
          <div className="flex flex-col gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {sample.batch && <span className="flex items-center gap-1"><Package size={11} />{sample.batch}</span>}
            {sample.assigned_name && <span className="flex items-center gap-1"><User size={11} />{sample.assigned_name}</span>}
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {fmtDate(sample.created_at)}
            </span>
          </div>
        </div>
        <SampleStatusBadge status={sample.status} />
      </div>

      {/* Right: progress + steps */}
      <div className="flex-1 p-5 flex flex-col justify-between gap-3 min-w-0">
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
    ? samples.filter(s =>
        s.code.includes(search.trim().toUpperCase()) ||
        s.product_name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (s.batch || "").toLowerCase().includes(search.trim().toLowerCase())
      )
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

  // Reset page when search changes
  useEffect(() => { setPage(1); setTimerKey(k => k + 1); }, [search]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm dark:shadow-none">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
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
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <LogIn size={14} /> Acceso analistas
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">

        {/* Pinned section */}
        {pinnedSamples.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Pin size={13} className="text-indigo-500 fill-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fijadas</span>
              <span className="text-xs text-gray-400 dark:text-gray-600">({pinnedSamples.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pinnedSamples.map(s => (
                <SampleCard key={s.id} sample={s} isNew={s.id === newSampleId} pinned={true} onPin={togglePin} />
              ))}
            </div>
            {unpinned.length > 0 && <hr className="mt-8 border-gray-200 dark:border-gray-800" />}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingList && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginated.map(s => (
                <SampleCard key={s.id} sample={s} isNew={s.id === newSampleId} pinned={false} onPin={togglePin} />
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
    </div>
  );
}
