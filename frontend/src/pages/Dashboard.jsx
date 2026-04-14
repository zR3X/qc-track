import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Search, FlaskConical, Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Ban, Bell, Globe, User, Target, Timer, RotateCcw, TrendingUp, Sparkles, MessageSquare } from "lucide-react";
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
  const { analystId } = useParams();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [newSampleIds, setNewSampleIds] = useState(new Set());
  const [showNotifs, setShowNotifs] = useState(false);
  const [analystName, setAnalystName] = useState("");
  const [analystStats, setAnalystStats] = useState(null);
  const [unreadChat, setUnreadChat] = useState({});
  const notifRef = useRef(null);
  const { user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cargar nombre y stats del analista cuando hay analystId
  useEffect(() => {
    if (!analystId) { setAnalystName(""); setAnalystStats(null); return; }
    axios.get("/api/users/analysts").then(r => {
      const found = r.data.find(a => String(a.id) === String(analystId));
      setAnalystName(found?.name || "");
    }).catch(() => {});
    if (user?.role === "admin") {
      axios.get(`/api/samples/analyst-stats/${analystId}`)
        .then(r => setAnalystStats(r.data))
        .catch(() => {});
    }
  }, [analystId, user]);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== "all") params.status = filter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (analystId) params.assigned_to = analystId;
      const res = await axios.get("/api/samples", { params });
      setSamples(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter, debouncedSearch, analystId]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  // Ref para acceder a fetchSamples y addToast sin recrear intervalos
  const fetchSamplesRef = useRef(fetchSamples);
  const addToastRef = useRef(addToast);
  useEffect(() => { fetchSamplesRef.current = fetchSamples; }, [fetchSamples]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  // ── Helper: marcar IDs como leídas en la BD ──────────────────────────────
  const markRead = async (ids) => {
    if (!ids.length) return;
    try { await axios.put("/api/ccr/notificaciones/leer", { ids }); } catch { /* silent */ }
  };

  // ── Cargar notificaciones no leídas desde la BD ───────────────────────────
  const loadNotifications = useCallback(async () => {
    if (user?.role !== "analyst") return;
    try {
      const res = await axios.get("/api/ccr/notificaciones");
      const unread = res.data;
      setNotifications(unread.map(s => ({
        id: s.id,
        code: s.code,
        product_name: s.nombre_material || s.product_name,
        created_at: s.created_at,
      })));
      setNewSampleIds(new Set(unread.map(s => s.id)));
    } catch { /* silent */ }
  }, [user]);

  // Cargar al montar y cada vez que cambie el usuario
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Polling cada 5s: detectar nuevas notificaciones en la BD
  useEffect(() => {
    if (user?.role !== "analyst") return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get("/api/ccr/notificaciones");
        const unread = res.data;
        setNotifications(prev => {
          const prevIds = new Set(prev.map(n => n.id));
          const newOnes = unread.filter(s => !prevIds.has(s.id));
          if (newOnes.length > 0) {
            newOnes.forEach(s =>
              addToastRef.current("info", `Nueva muestra: ${s.nombre_material || s.product_name}`, "Nueva muestra recibida")
            );
            fetchSamplesRef.current();
          }
          return unread.map(s => ({ id: s.id, code: s.code, product_name: s.nombre_material || s.product_name, created_at: s.created_at }));
        });
        setNewSampleIds(new Set(unread.map(s => s.id)));
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Polling mensajes no leídos de chat (cada 10s)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("/api/chat/unread/counts");
        const map = {};
        res.data.forEach(r => { map[r.muestra_id] = r.count; });
        setUnreadChat(map);
      } catch { /* silent */ }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {analystId && <User size={20} className="text-indigo-500" />}
            {analystId ? (analystName || "Analista") : "Dashboard"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {analystId ? "Muestras asignadas a este analista" : "Control de muestras en proceso"}
          </p>
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
              className={`p-2 rounded-lg transition-all relative ${notifications.length > 0 ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
              <Bell size={16} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Notificaciones</span>
                  {notifications.length > 0 && (
                    <button onClick={() => {
                      const ids = notifications.map(n => n.id);
                      markRead(ids);
                      setNotifications([]);
                      setNewSampleIds(new Set());
                      setShowNotifs(false);
                    }}
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
                          onClick={() => {
                            markRead([n.id]);
                            setNotifications(prev => prev.filter(x => x.id !== n.id));
                            setNewSampleIds(prev => { const s = new Set(prev); s.delete(n.id); return s; });
                          }}
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

      {/* Métricas de analista — solo admin en /dashboard/:analystId */}
      {analystId && user?.role === "admin" && analystStats && (
        <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Rendimiento</p>

          {/* Fila principal de métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><FlaskConical size={11} /> Total asignadas</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{analystStats.total}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><CheckCircle2 size={11} className="text-green-500" /> Completadas</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{analystStats.completed}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><XCircle size={11} className="text-red-500" /> Rechazadas</span>
              <span className="text-2xl font-bold text-red-500 dark:text-red-400">{analystStats.rejected}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><Target size={11} className="text-indigo-500" /> Tasa aprobación</span>
              <span className={`text-2xl font-bold ${analystStats.approval_rate === null ? "text-gray-400" : analystStats.approval_rate >= 80 ? "text-green-600 dark:text-green-400" : analystStats.approval_rate >= 60 ? "text-amber-500" : "text-red-500"}`}>
                {analystStats.approval_rate !== null ? `${analystStats.approval_rate}%` : "—"}
              </span>
            </div>
          </div>

          {/* Fila secundaria */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <Timer size={12} />
              Tiempo promedio: <span className="font-semibold text-gray-700 dark:text-gray-300">
                {analystStats.avg_minutes != null
                  ? analystStats.avg_minutes < 60
                    ? `${analystStats.avg_minutes} min`
                    : `${Math.round(analystStats.avg_minutes / 60 * 10) / 10} h`
                  : "—"}
              </span>
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <RotateCcw size={12} />
              Reintentos: <span className="font-semibold text-amber-600 dark:text-amber-400">{analystStats.retried}</span>
            </span>
            {analystStats.by_turno.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 flex-wrap">
                <TrendingUp size={12} />
                Por turno:
                {analystStats.by_turno.map(t => (
                  <span key={t.turno} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {t.turno}: {t.count}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}

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
            <div key={sample.id}
              className={`group relative rounded-xl transition-all animate-fade-in overflow-hidden flex flex-col
                ${sample.status === "cancelled"
                  ? "bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-700 grayscale opacity-60 hover:opacity-80"
                  : "bg-white dark:bg-gray-900 hover:shadow-md " + (
                      !sample.assigned_to
                        ? "border-2 border-yellow-400 dark:border-yellow-500"
                        : "border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-gray-700")}`}>

              {/* Badge "Nuevo" */}
              {newSampleIds.has(sample.id) && (
                <div className="absolute top-0 left-0 z-10 flex items-center gap-1 bg-red-500 text-white pl-1.5 pr-2 py-0.5 rounded-tl-xl rounded-br-lg shadow-md shadow-red-300 dark:shadow-red-900/60">
                  <Sparkles size={9} className="animate-pulse flex-shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Nuevo</span>
                </div>
              )}

              {/* Área clickeable → detalle */}
              <Link to={`/samples/${sample.id}`}
                onClick={() => {
                  const ingresoStep = sample.steps?.find(s => s.step_name === "Ingreso" && s.status === "pending");
                  if (ingresoStep) axios.put(`/api/samples/${sample.id}/steps/${ingresoStep.id}`, { status: "passed", notes: null });
                  if (newSampleIds.has(sample.id)) {
                    markRead([sample.id]);
                    setNotifications(prev => prev.filter(n => n.id !== sample.id));
                    setNewSampleIds(prev => { const s = new Set(prev); s.delete(sample.id); return s; });
                  }
                }}
                className="flex-1 p-5 flex flex-col">

                {/* Cuerpo principal — crece para igualar altura */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className={`font-semibold text-sm leading-snug ${sample.codigo_orden ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}>{sample.codigo_orden || sample.code}</p>
                        {sample.attempt > 1 && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                            #{sample.attempt}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm leading-snug line-clamp-1">{sample.nombre_material || sample.product_name}</p>
                      {sample.codigo_material && <p className="font-bold text-gray-400 dark:text-gray-500 text-sm leading-snug">{sample.codigo_material}</p>}
                      {sample.grupo_turno && <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">Turno {sample.grupo_turno}{sample.nombre_reactor ? ` · ${sample.nombre_reactor}` : ""}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="relative">
                        <MessageSquare
                          size={15}
                          className={unreadChat[sample.id] > 0 ? "text-red-500 dark:text-red-400" : "text-gray-300 dark:text-gray-600"}
                        />
                        {unreadChat[sample.id] > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center leading-none">
                            {unreadChat[sample.id] > 9 ? "9+" : unreadChat[sample.id]}
                          </span>
                        )}
                      </div>
                      <SampleStatusBadge status={sample.status} />
                    </div>
                  </div>

                  {sample.assigned_name && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Analista: {sample.assigned_name}</p>
                  )}
                  {sample.comentarios && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-2 py-1 mb-2 line-clamp-2">
                      💬 {sample.comentarios}
                    </p>
                  )}
                </div>

                {/* Footer siempre anclado al fondo */}
                <div className="mt-3">
                  <MiniProgress steps={sample.steps} />
                  <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(sample.created_at)}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
