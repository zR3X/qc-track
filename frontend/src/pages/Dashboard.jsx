import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavActions } from "../context/NavActionsContext";
import { FlaskConical, Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Ban, Bell, Globe, Target, Timer, RotateCcw, TrendingUp, MessageSquare, ShieldCheck, Pin, AlertCircle, X, LayoutGrid, List, Check, Loader, SkipForward, Columns3 } from "lucide-react";
import { fmtTime, fmtDate } from "../utils/date";
import MiniProgress from "../components/MiniProgress";
import { useToast, ToastContainer } from "../components/Toast";
import { SampleGridCard, HIDDEN_STEPS } from "../components/SampleGridCard";
import SampleStatusBadge from "../components/SampleStatusBadge";
import ChatPanel from "../components/ChatPanel";
import SearchBar from "../components/SearchBar";

const STEP_NAMES_TABLE = ["Entrega", "Análisis", "Resultado"];
const STEP_DOT_CFG = {
  passed:      { bg: "bg-green-500",                 icon: Check,       iconColor: "text-white",                        label: "Aprobado",   pulse: false },
  failed:      { bg: "bg-red-500",                   icon: X,           iconColor: "text-white",                        label: "Fallido",    pulse: false },
  in_progress: { bg: "bg-blue-500",                  icon: Loader,      iconColor: "text-white",                        label: "En proceso", pulse: true  },
  skipped:     { bg: "bg-yellow-400",                icon: SkipForward, iconColor: "text-white",                        label: "Omitido",    pulse: false },
  pending:     { bg: "bg-gray-200 dark:bg-gray-700", icon: Clock,       iconColor: "text-gray-400 dark:text-gray-500",  label: "Pendiente",  pulse: false },
};

function StepCell({ steps, stepName }) {
  const s = (steps || []).find(x => x.step_name === stepName);
  const status = s?.status || "pending";
  const cfg = STEP_DOT_CFG[status] || STEP_DOT_CFG.pending;
  const Icon = cfg.icon;
  const ts = s?.completed_at || s?.started_at || null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.pulse ? "animate-pulse" : ""}`}>
        <Icon size={13} className={`${cfg.iconColor} ${cfg.pulse ? "animate-spin" : ""}`} />
      </div>
      {ts
        ? <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono tabular-nums leading-none">{fmtTime(ts)}</span>
        : <span className="text-[9px] text-gray-300 dark:text-gray-600 leading-none">{cfg.label}</span>
      }
    </div>
  );
}

const ALL_COLUMNS = [
  { key: "num",          label: "#" },
  { key: "orden",        label: "Orden" },
  { key: "material",     label: "Material" },
  { key: "turno",        label: "Turno" },
  { key: "operador",     label: "Operador" },
  { key: "analista",     label: "Analista" },
  { key: "estado",       label: "Estado" },
  { key: "intentos",     label: "Intentos" },
  { key: "entrega",      label: "Entrega" },
  { key: "analisis",     label: "Análisis" },
  { key: "resultado",    label: "Resultado" },
  { key: "confirmacion", label: "Confirmación JT" },
  { key: "fecha",        label: "Fecha" },
  { key: "hora",         label: "Hora" },
];
const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.map(c => c.key));

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
  const [plantaFilter, setPlantaFilter] = useState(() => {
    try { return localStorage.getItem("qc_planta_filter") || ""; }
    catch { return ""; }
  });
  /** Texto de búsqueda (debounced) que envía `SearchBar` vía `onFilterChange`. */
  const [apiSearch, setApiSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [newSampleIds, setNewSampleIds] = useState(new Set());
  const [showNotifs, setShowNotifs] = useState(false);
  const [analystName, setAnalystName] = useState("");
  const [analystStats, setAnalystStats] = useState(null);
  const [unreadChat, setUnreadChat] = useState({});
  const [pendingApproval, setPendingApproval] = useState([]);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const notifRef = useRef(null);
  /** IDs pendientes ya vistos para detectar nuevas finalizaciones del analista. */
  const knownPendingApprovalIds = useRef(new Set());
  /** IDs cuyo modal fue cerrado manualmente por el jefe sin confirmar. */
  const dismissedPendingApprovalIds = useRef(new Set());
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setNavActions, setNavCenter } = useNavActions();
  const { toasts, addToast, removeToast } = useToast();
  const [chatSample, setChatSample] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("qc_dash_view") || "cards");
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("qc_dash_cols") || "null");
      return saved ? new Set(saved) : new Set(DEFAULT_VISIBLE);
    } catch { return new Set(DEFAULT_VISIBLE); }
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qc_pinned_ids") || "[]")); }
    catch { return new Set(); }
  });

  const markChatRead = useCallback((id) => {
    setUnreadChat(prev => ({ ...prev, [id]: 0 }));
  }, []);

  const getSampleId = useCallback((sample) => String(sample?.id ?? ""), []);

  useEffect(() => {
    localStorage.setItem("qc_pinned_ids", JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  useEffect(() => {
    localStorage.setItem("qc_dash_view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("qc_dash_cols", JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  useEffect(() => {
    if (!showColMenu) return;
    const handler = (e) => { if (!e.target.closest("[data-col-menu]")) setShowColMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColMenu]);

  const togglePin = useCallback((id) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const { pinnedSamples, unpinnedSamples } = useMemo(() => {
    const base = (filter === "all" ? samples : samples.filter(s => s.status === filter))
      .filter(s => !(s.approval_result && !s.approval_pending));
    const sorted = [...base].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return {
      pinnedSamples:   sorted.filter(s => pinnedIds.has(s.id)),
      unpinnedSamples: sorted.filter(s => !pinnedIds.has(s.id)),
    };
  }, [samples, filter, pinnedIds]);

  // Cargar nombre y stats del analista cuando hay analystId
  useEffect(() => {
    if (!analystId) { setAnalystName(""); setAnalystStats(null); return; }
    if (!["admin", "analyst"].includes(user?.role)) { setAnalystName(""); setAnalystStats(null); return; }
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
      // No enviar status al API — filtramos en cliente para tener conteos correctos
      if (analystId) params.assigned_to = analystId;
      if (plantaFilter?.trim()) params.planta = plantaFilter.trim();
      if (apiSearch) params.search = apiSearch;
      const df = typeof dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom.trim()) ? dateFrom.trim() : "";
      const dt = typeof dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim()) ? dateTo.trim() : "";
      if (df) params.date_from = df;
      if (dt) params.date_to = dt;
      const res = await axios.get("/api/samples", { params });
      setSamples(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [analystId, plantaFilter, apiSearch, dateFrom, dateTo]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  // Persistir filtro de planta
  useEffect(() => {
    try { localStorage.setItem("qc_planta_filter", plantaFilter); } catch { /* silent */ }
  }, [plantaFilter]);

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

  /** El analista cerró con al menos un paso en fallido (no conformidad). */
  const sampleShowsAnalystRejection = (s) => (s?.steps || []).some(st => st.status === "failed");

  // ── Jefe de turno: confirma en sistema el resultado que dejó el analista ──
  const handleConfirmarResultadoTurno = async (sampleId) => {
    setLoadingApproval(true);
    try {
      await axios.post(`/api/samples/${sampleId}/confirmar-resultado-turno`);
      setPendingApproval(prev => prev.filter(s => getSampleId(s) !== String(sampleId)));
      dismissedPendingApprovalIds.current.delete(String(sampleId));
      knownPendingApprovalIds.current.delete(String(sampleId));
      setSelectedApproval(null);
      setFilter("all");
      addToastRef.current("success", "Resultado confirmado", "Quedó registrada la decisión del turno");
      fetchSamplesRef.current();
    } catch (e) {
      const msg = e.response?.data?.error || "No se pudo confirmar";
      addToastRef.current("error", "Error al confirmar", msg);
    } finally {
      setLoadingApproval(false);
    }
  };

  // ── Jefe de turno: el analista cerró en conformidad, pero el turno marca no conforme ──
  const handleVetoRechazarMuestra = async (sampleId) => {
    setLoadingApproval(true);
    try {
      await axios.post(`/api/samples/${sampleId}/reject`);
      setPendingApproval(prev => prev.filter(s => getSampleId(s) !== String(sampleId)));
      dismissedPendingApprovalIds.current.delete(String(sampleId));
      knownPendingApprovalIds.current.delete(String(sampleId));
      setSelectedApproval(null);
      setFilter("all");
      addToastRef.current("warning", "Muestra no conforme", "Se registró el rechazo del turno frente al cierre favorable del analista");
      fetchSamplesRef.current();
    } catch (e) {
      const msg = e.response?.data?.error || "No se pudo registrar el rechazo";
      addToastRef.current("error", "Error", msg);
    } finally {
      setLoadingApproval(false);
    }
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

  // ── Cargar muestras pendientes de aprobación ─────────────────────────────
  const loadPendingApproval = useCallback(async () => {
    if (user?.role !== "jefe_turno") return;
    try {
      const res = await axios.get("/api/samples/pending-approval");
      setPendingApproval(res.data);
    } catch { /* silent */ }
  }, [user]);

  // Cargar al montar y cada vez que cambie el usuario
  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => { loadPendingApproval(); }, [loadPendingApproval]);

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

  // Polling muestras pendientes de aprobación (cada 5s) para jefe de turno
  useEffect(() => {
    if (user?.role !== "jefe_turno") return;
    const interval = setInterval(loadPendingApproval, 5000);
    return () => clearInterval(interval);
  }, [user, loadPendingApproval]);

  const handleCloseApprovalModal = useCallback(() => {
    setSelectedApproval(prev => {
      if (prev?.id != null) dismissedPendingApprovalIds.current.add(String(prev.id));
      return null;
    });
  }, []);

  // Jefe de turno: abrir modal al entrar y ante nuevas muestras terminadas por analista
  useEffect(() => {
    if (user?.role !== "jefe_turno") return;

    const currentIds = new Set(pendingApproval.map(getSampleId));

    // Limpia rastreadores de IDs que ya no existen en la cola pendiente.
    knownPendingApprovalIds.current = new Set(
      [...knownPendingApprovalIds.current].filter(id => currentIds.has(id))
    );
    dismissedPendingApprovalIds.current = new Set(
      [...dismissedPendingApprovalIds.current].filter(id => currentIds.has(id))
    );

    // Si el modal abierto ya no existe en pendientes, cerrarlo.
    if (selectedApproval && !currentIds.has(getSampleId(selectedApproval))) {
      setSelectedApproval(null);
      return;
    }

    if (pendingApproval.length === 0) return;

    // Siempre garantiza pop-up al entrar al dashboard (si no hay uno abierto).
    if (!selectedApproval) {
      const firstUndismissed = pendingApproval.find(s => !dismissedPendingApprovalIds.current.has(getSampleId(s)));
      if (firstUndismissed) {
        setSelectedApproval(firstUndismissed);
      }
    }

    if (selectedApproval) return;

    const newPending = pendingApproval.filter(s => !knownPendingApprovalIds.current.has(getSampleId(s)));
    if (newPending.length > 0) {
      newPending.forEach(s => knownPendingApprovalIds.current.add(getSampleId(s)));
      const newest = newPending[newPending.length - 1];
      dismissedPendingApprovalIds.current.delete(getSampleId(newest));
      setSelectedApproval(newest);
      return;
    }
  }, [user?.role, pendingApproval, selectedApproval, getSampleId]);

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

  // Handle filter changes from SearchBar
  const handleFilterChange = useCallback((filters) => {
    setFilter(filters.status || "all");
    setPlantaFilter(filters.planta || "");
    setApiSearch(typeof filters.search === "string" ? filters.search : "");
    if (Object.prototype.hasOwnProperty.call(filters, "dateFrom")) {
      setDateFrom(typeof filters.dateFrom === "string" ? filters.dateFrom : "");
    }
    if (Object.prototype.hasOwnProperty.call(filters, "dateTo")) {
      setDateTo(typeof filters.dateTo === "string" ? filters.dateTo : "");
    }
  }, []);

  // Barra de búsqueda centrada en la navbar (cleanup solo al salir de la página)
  useEffect(() => {
    return () => setNavCenter(null);
  }, [setNavCenter]);

  useEffect(() => {
    setNavCenter(
      <SearchBar
        placeholder="Buscar código, producto o lote..."
        onFilterChange={handleFilterChange}
        showStatusFilter={true}
        showPlantaFilter={true}
        persistFilters={true}
      />
    );
  }, [setNavCenter, handleFilterChange]);

  // Inyectar acciones en el navbar
  useEffect(() => {
    setNavActions(
      <>
        <Link to="/"
          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
          title="Ver estado público">
          <Globe size={16} />
        </Link>
        <button onClick={fetchSamples} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
        {user?.role === "analyst" && (
          <div className="relative" ref={notifRef}>
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
          </div>
        )}
      </>
    );
    return () => setNavActions(null);
  }, [loading, notifications, showNotifs, user, fetchSamples, setNavActions]);

  const counts = useMemo(() => {
    const active = samples.filter(s => !(s.approval_result && !s.approval_pending));
    return {
      all:         active.length,
      pending:     active.filter(s => s.status === "pending").length,
      in_progress: active.filter(s => s.status === "in_progress").length,
      completed:   active.filter(s => s.status === "completed").length,
      rejected:    active.filter(s => s.status === "rejected").length,
      cancelled:   active.filter(s => s.status === "cancelled").length,
    };
  }, [samples]);

  const displaySamples = useMemo(() => {
    const base = (filter === "all" ? samples : samples.filter(s => s.status === filter))
      .filter(s => !(s.approval_result && !s.approval_pending));
    return [...base].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [samples, filter]);



  return (
    <div className="p-4 lg:p-5">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {user?.role === "jefe_turno" && pendingApproval.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-amber-900 dark:text-amber-100" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-950 dark:text-amber-100">Confirmación del turno requerida</p>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-0.5">
                  Hay {pendingApproval.length} muestra{pendingApproval.length === 1 ? "" : "s"} pendiente{pendingApproval.length === 1 ? "" : "s"} de su confirmación (conformidad o no conformidad). Use el listado o espere la ventana emergente.
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-amber-200/80 dark:divide-amber-900/40 max-h-72 overflow-y-auto bg-white/60 dark:bg-gray-900/40">
            {pendingApproval.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-amber-950 dark:text-amber-50">{s.codigo_orden || s.code}</p>
                  <p className="text-xs text-amber-800 dark:text-amber-200/90 truncate">{s.nombre_material || s.product_name}</p>
                  {s.assigned_name && <p className="text-xs text-amber-700 dark:text-amber-300/80">Analista: {s.assigned_name}</p>}
                </div>
                <button type="button" onClick={() => setSelectedApproval(s)}
                  className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-all">
                  Revisar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Panel de muestras</h1>
          {analystId && analystName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vista analista: <span className="font-medium text-gray-700 dark:text-gray-300">{analystName}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle vista */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "cards" ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
              title="Vista cards"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
              title="Vista tabla"
            >
              <List size={15} />
            </button>
          </div>

          {/* Selector de columnas — solo en tabla */}
          {viewMode === "table" && (
            <div className="relative" data-col-menu>
              <button
                type="button"
                onClick={() => setShowColMenu(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  showColMenu
                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                title="Mostrar/ocultar columnas"
              >
                <Columns3 size={13} />
                Columnas
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 min-w-[160px]">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Columnas visibles</p>
                  <div className="flex flex-col gap-1">
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={visibleCols.has(col.key)}
                          onChange={() => setVisibleCols(prev => {
                            const next = new Set(prev);
                            if (next.has(col.key)) next.delete(col.key); else next.add(col.key);
                            return next;
                          })}
                          className="w-3.5 h-3.5 accent-indigo-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {col.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))}
                    className="mt-3 w-full text-[10px] text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-center"
                  >
                    Restablecer todo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {STATS_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
              filter === key ? `${bg} ring-2 ring-indigo-500/40` : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            <Icon size={15} className={filter === key ? color : "text-gray-400 dark:text-gray-500"} />
            <span className={filter === key ? "text-gray-900 dark:text-white" : ""}>{label}</span>
            <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-md ${filter === key ? "bg-white/60 dark:bg-black/20" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
              {counts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Métricas de analista — solo admin en /dashboard/:analystId */}
      {analystId && user?.role === "admin" && analystStats && (
        <div className="mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
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

      {/* ── Skeleton ── */}
      {loading && viewMode === "cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-gray-200 dark:border-l-gray-700 rounded-2xl p-5 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
                <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full mb-4" />
              <div className="flex gap-2">
                {[1, 2, 3].map(j => <div key={j} className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 rounded-full" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && displaySamples.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <AlertCircle className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={36} />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No hay muestras con los filtros actuales</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Prueba otro estado o limpia la búsqueda</p>
        </div>
      )}

      {/* ── Vista Cards ── */}
      {!loading && viewMode === "cards" && (
        <>
          {pinnedSamples.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Pin size={14} className="text-indigo-500 fill-indigo-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fijadas</span>
                <span className="text-xs text-gray-400 dark:text-gray-600">({pinnedSamples.length})</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {pinnedSamples.map(s => (
                  <SampleGridCard
                    key={s.id}
                    sample={s}
                    isNew={newSampleIds.has(s.id)}
                    pinned
                    onPin={togglePin}
                    onChat={setChatSample}
                    unreadChat={unreadChat[s.id] || 0}
                    onCardClick={() => navigate(`/samples/${s.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
          {unpinnedSamples.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {unpinnedSamples.map(s => (
                <SampleGridCard
                  key={s.id}
                  sample={s}
                  isNew={newSampleIds.has(s.id)}
                  pinned={false}
                  onPin={togglePin}
                  onChat={setChatSample}
                  unreadChat={unreadChat[s.id] || 0}
                  onCardClick={() => navigate(`/samples/${s.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Vista Tabla ── */}
      {!loading && viewMode === "table" && displaySamples.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  {visibleCols.has("num")      && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">#</th>}
                  {visibleCols.has("orden")    && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Orden</th>}
                  {visibleCols.has("material") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Material</th>}
                  {visibleCols.has("turno")    && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Turno</th>}
                  {visibleCols.has("operador") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Operador</th>}
                  {visibleCols.has("analista") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Analista</th>}
                  {visibleCols.has("estado")   && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>}
                  {visibleCols.has("intentos") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Fase</th>}
                  {visibleCols.has("entrega")  && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Entrega</th>}
                  {visibleCols.has("analisis") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Análisis</th>}
                  {visibleCols.has("resultado")    && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Resultado</th>}
                  {visibleCols.has("confirmacion") && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Confirmación JT</th>}
                  {visibleCols.has("fecha")        && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Fecha</th>}
                  {visibleCols.has("hora")     && <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Hora</th>}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {displaySamples.map((s, idx) => {
                  const isPinned = pinnedIds.has(s.id);
                  const isNew = newSampleIds.has(s.id);
                  const rowNum = displaySamples.length - idx;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-gray-100 dark:border-gray-800 transition-colors cursor-pointer ${
                        s.status === "cancelled" ? "opacity-50 grayscale" : ""
                      } ${isNew ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-900/60"}`}
                      onClick={(e) => { if (e.target.closest("button")) return; navigate(`/samples/${s.id}`); }}
                    >
                      {visibleCols.has("num") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tabular-nums">{rowNum}</span>
                        </td>
                      )}
                      {visibleCols.has("orden") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`font-mono font-semibold text-sm ${s.codigo_orden ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>
                              {s.codigo_orden || s.code}
                            </span>
                            {s.approval_pending && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 px-1 py-0.5 rounded border border-amber-400/60" title="Pendiente de confirmación">
                                <ShieldCheck size={9} />
                              </span>
                            )}
                            {isPinned && <Pin size={10} className="text-indigo-400 fill-indigo-400 flex-shrink-0" />}
                          </div>
                        </td>
                      )}
                      {visibleCols.has("material") && (
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <div className="font-medium text-xs text-gray-900 dark:text-white truncate" title={s.nombre_material || s.product_name}>
                            {s.nombre_material || s.product_name}
                          </div>
                          {s.codigo_material && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono font-medium">{s.codigo_material}</div>
                          )}
                        </td>
                      )}
                      {visibleCols.has("turno") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          {s.grupo_turno ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                              {s.grupo_turno}
                            </span>
                          ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                      )}
                      {visibleCols.has("operador") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {(s.nombre_empleado || s.apellido_empleado) ? (
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block max-w-[120px]">
                              {[s.nombre_empleado, s.apellido_empleado].filter(Boolean).join(" ")}
                            </span>
                          ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                          {s.numero_empleado && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono font-medium">#{s.numero_empleado}</div>
                          )}
                        </td>
                      )}
                      {visibleCols.has("analista") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {s.assigned_name
                            ? <span className="text-xs text-gray-600 dark:text-gray-400 truncate block max-w-[100px]">{s.assigned_name}</span>
                            : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                      )}
                      {visibleCols.has("estado") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <SampleStatusBadge status={s.status} />
                        </td>
                      )}
                      {visibleCols.has("intentos") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              (s.fase || 1) > 1
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700"
                            }`}>
                              Fase {s.fase || 1}
                            </span>
                            {s.comentarios && (s.fase || 1) > 1 && (
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 max-w-[90px] truncate" title={s.comentarios}>
                                {s.comentarios}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.has("entrega") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <StepCell steps={s.steps} stepName="Entrega" />
                        </td>
                      )}
                      {visibleCols.has("analisis") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <StepCell steps={s.steps} stepName="Análisis" />
                        </td>
                      )}
                      {visibleCols.has("resultado") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <StepCell steps={s.steps} stepName="Resultado" />
                        </td>
                      )}
                      {visibleCols.has("confirmacion") && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          {s.approval_pending ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <ShieldCheck size={9} />
                                Pendiente
                              </span>
                              {user?.role === "jefe_turno" && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSelectedApproval(s); }}
                                  className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                                >
                                  Revisar →
                                </button>
                              )}
                            </div>
                          ) : s.approval_result ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.approval_result.toLowerCase().includes("no")
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                                : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                            }`}>
                              {s.approval_result.toLowerCase().includes("no") ? "No conforme" : "Conforme"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                          )}
                        </td>
                      )}
                      {visibleCols.has("fecha") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-600 dark:text-gray-400">{fmtDate(s.created_at)}</span>
                        </td>
                      )}
                      {visibleCols.has("hora") && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">{fmtTime(s.created_at)}</span>
                        </td>
                      )}

                      {/* Acciones */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {s.status !== "cancelled" && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setChatSample(s); }}
                                className={`relative p-1.5 rounded-lg transition-all ${
                                  (unreadChat[s.id] || 0) > 0
                                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                                    : "text-gray-400 dark:text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                                }`}
                              >
                                <MessageSquare size={13} />
                                {(unreadChat[s.id] || 0) > 0 && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                                    {unreadChat[s.id] > 9 ? "9+" : unreadChat[s.id]}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); togglePin(s.id); }}
                                className={`p-1.5 rounded-lg transition-all ${
                                  isPinned
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-gray-400 dark:text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                                }`}
                              >
                                <Pin size={13} className={isPinned ? "fill-current" : ""} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ventana de confirmación de resultado (jefe de turno) — misma lógica que en detalle de muestra */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950 rounded-full flex items-center justify-center">
                <ShieldCheck size={18} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Confirmar resultado del analista</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{selectedApproval.codigo_orden || selectedApproval.code}</p>
              </div>
              <button type="button" onClick={handleCloseApprovalModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className={`rounded-xl border px-4 py-3 mb-4 text-sm leading-relaxed ${
              sampleShowsAnalystRejection(selectedApproval)
                ? "bg-red-50 dark:bg-red-950/25 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-100"
                : "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100"
            }`}>
              {sampleShowsAnalystRejection(selectedApproval) ? (
                <>El analista registró <strong>no conformidad</strong> en el cierre. Confirme para cerrar la muestra como <strong>rechazada</strong>.</>
              ) : (
                <>El analista registró <strong>conformidad</strong> en los pasos. Confirme para cerrar como <strong>completada</strong>, o indique no conforme si no está de acuerdo.</>
              )}
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Producto</p>
                  <p className="font-semibold text-gray-900 dark:text-white leading-snug">{selectedApproval.nombre_material || selectedApproval.product_name}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Lote</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedApproval.batch || "—"}</p>
                </div>
              </div>
              {selectedApproval.assigned_name && (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Analista</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedApproval.assigned_name}</p>
                </div>
              )}
              {selectedApproval.grupo_turno && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Turno</p>
                    <p className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedApproval.grupo_turno}</p>
                  </div>
                  {selectedApproval.nombre_reactor && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Reactor</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedApproval.nombre_reactor}</p>
                    </div>
                  )}
                </div>
              )}
              {selectedApproval.comentarios && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-0.5">Comentarios</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">{selectedApproval.comentarios}</p>
                </div>
              )}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/30 rounded-lg px-3 py-2">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-1">Pasos completados</p>
                <MiniProgress steps={selectedApproval.steps} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => handleConfirmarResultadoTurno(selectedApproval.id)} disabled={loadingApproval}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  sampleShowsAnalystRejection(selectedApproval)
                    ? "bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                }`}>
                {loadingApproval ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={15} />}
                {sampleShowsAnalystRejection(selectedApproval)
                  ? "Confirmar no conformidad y cerrar"
                  : "Confirmar conformidad y cerrar muestra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {chatSample && (
        <>
          <div className="fixed inset-0 bg-black/20 dark:bg-black/50 z-40" onClick={() => setChatSample(null)} aria-hidden />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 p-4 flex flex-col pointer-events-none">
            <div className="pointer-events-auto flex-1 min-h-0">
              <ChatPanel
                sampleId={chatSample.id}
                sampleCode={chatSample.codigo_orden || chatSample.code}
                senderName={[chatSample.nombre_empleado?.split(" ")[0], chatSample.apellido_empleado?.split(" ")[0]].filter(Boolean).join(" ") || "Operador"}
                senderRole="operator"
                onClose={() => setChatSample(null)}
                onRead={markChatRead}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
