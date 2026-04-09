import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Search, FlaskConical, Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Ban, Bell, Globe } from "lucide-react";
import { fmtDate, fmtTime } from "../utils/date";
import SampleStatusBadge from "../components/SampleStatusBadge";
import MiniProgress from "../components/MiniProgress";
import { useToast, ToastContainer } from "../components/Toast";

const STATS_CONFIG = [
  { key: "all",         label: "Total",        icon: FlaskConical, color: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50" },
  { key: "pending",     label: "Pendientes",   icon: Clock,        color: "text-gray-600 dark:text-gray-400",     bg: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50" },
  { key: "in_progress", label: "En Proceso",   icon: Loader2,      color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50" },
  { key: "completed",   label: "Completadas",  icon: CheckCircle2, color: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50" },
  { key: "rejected",    label: "Rechazadas",   icon: XCircle,      color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50" },
  { key: "cancelled",   label: "Canceladas",   icon: Ban,          color: "text-zinc-500 dark:text-zinc-400",     bg: "bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800/50" },
];

export default function Dashboard() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [newSampleIds, setNewSampleIds] = useState(new Set());
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const { user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== "all") params.status = filter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await axios.get("/api/samples", { params });
      setSamples(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter, debouncedSearch]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  // Notifications: missed (localStorage) + real-time (SSE) — analyst only
  useEffect(() => {
    if (user?.role !== "analyst") return;

    // Missed notifications: samples created since last visit, excluding team-acknowledged ones
    const lastVisit = localStorage.getItem("qc_analyst_last_visit");
    localStorage.setItem("qc_analyst_last_visit", new Date().toISOString());

    if (lastVisit) {
      Promise.all([
        axios.get("/api/samples"),
        axios.get("/api/acknowledged"),
      ]).then(([samplesRes, ackRes]) => {
        const acked = new Set(ackRes.data);
        const missed = samplesRes.data.filter(s => new Date(s.created_at) > new Date(lastVisit) && !acked.has(s.id));
        if (missed.length > 0) {
          setNotifications(missed.map(s => ({ id: s.id, code: s.code, product_name: s.product_name, created_at: s.created_at })));
          setNewSampleIds(new Set(missed.map(s => s.id)));
        }
      }).catch(() => {});
    }

    // SSE: real-time new samples + team-wide read state
    const token = localStorage.getItem("qc_token") || "";
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    es.addEventListener("new-sample", (e) => {
      const sample = JSON.parse(e.data);
      setNotifications(prev => {
        if (prev.some(n => n.id === sample.id)) return prev;
        return [{ id: sample.id, code: sample.code, product_name: sample.product_name, created_at: sample.created_at }, ...prev];
      });
      setNewSampleIds(prev => new Set([...prev, sample.id]));
    });
    es.addEventListener("sample-read", (e) => {
      const { ids } = JSON.parse(e.data);
      const readSet = new Set(ids);
      setNotifications(prev => prev.filter(n => !readSet.has(n.id)));
      setNewSampleIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    });
    return () => es.close();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const counts = useMemo(() => ({
    all:         samples.length,
    pending:     samples.filter(s => s.status === "pending").length,
    in_progress: samples.filter(s => s.status === "in_progress").length,
    completed:   samples.filter(s => s.status === "completed").length,
    rejected:    samples.filter(s => s.status === "rejected").length,
    cancelled:   samples.filter(s => s.status === "cancelled").length,
  }), [samples]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Control de muestras en proceso</p>
        </div>
        <div className="flex gap-2">
          <Link to="/"
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
            title="Ver estado público">
            <Globe size={16} />
          </Link>
          <button onClick={fetchSamples} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {user?.role === "analyst" && <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(v => !v)}
              className={`p-2 rounded-lg transition-all relative ${notifications.length > 0 ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
              <Bell size={16} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Notificaciones</span>
                  {notifications.length > 0 && (
                    <button onClick={() => { axios.post("/api/acknowledged", { ids: notifications.map(n => n.id) }); setShowNotifs(false); }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                      Marcar todas leídas
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-600 text-sm">
                    Sin notificaciones nuevas
                  </div>
                ) : (
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {notifications.map(n => (
                      <li key={n.id}>
                        <button
                          onClick={() => { axios.post("/api/acknowledged", { ids: [n.id] }); }}
                          className="w-full text-left px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{n.product_name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{n.code} · {fmtTime(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {STATS_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer
              ${filter === key ? bg + " ring-2 ring-indigo-500/30" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={13} className={color} />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</span>
            </div>
            <p className={`text-xl font-bold ${filter === key ? color : "text-gray-900 dark:text-white"}`}>{counts[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código, producto o lote..."
          className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg pl-9 pr-3 py-2 text-sm
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-400 dark:placeholder-gray-600"
        />
      </div>

      {/* Sample grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : samples.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay muestras {filter !== "all" ? "con este estado" : ""}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {samples.map(sample => (
            <Link key={sample.id} to={`/samples/${sample.id}`}
              onClick={() => {
                const ingresoStep = sample.steps?.find(s => s.step_name === "Ingreso" && s.status === "pending");
                if (ingresoStep) axios.put(`/api/samples/${sample.id}/steps/${ingresoStep.id}`, { status: "passed", notes: null });
                if (newSampleIds.has(sample.id)) axios.post("/api/acknowledged", { ids: [sample.id] });
              }}
              className={`group relative rounded-xl p-5 transition-all animate-fade-in overflow-hidden
                ${sample.status === "cancelled"
                  ? "bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-700 grayscale opacity-60 hover:opacity-80"
                  : "bg-white dark:bg-gray-900 hover:shadow-md dark:hover:bg-gray-900/80 " + (newSampleIds.has(sample.id)
                    ? "border-2 border-amber-400 dark:border-amber-500"
                    : "border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-gray-700")}`}>


              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{sample.code}</p>
                    {sample.attempt > 1 && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        #{sample.attempt}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 dark:text-white font-semibold text-sm mt-0.5 line-clamp-1">{sample.product_name}</p>
                  {sample.batch && <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">Lote: {sample.batch}</p>}
                </div>
                <SampleStatusBadge status={sample.status} />
              </div>

              {sample.assigned_name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Analista: {sample.assigned_name}</p>
              )}

              <MiniProgress steps={sample.steps} />

              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span>{fmtDate(sample.created_at)}</span>
                <span className="text-indigo-500 dark:text-indigo-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium">Ver detalle →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
