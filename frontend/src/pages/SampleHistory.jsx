import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Clock, PlusCircle, RotateCcw, Ban, User } from "lucide-react";
import { fmtDateTime } from "../utils/date";

const STATUS_CONFIG = {
  // español (BD)
  pendiente:   { label: "Pendiente",   color: "text-gray-500 dark:text-gray-400",     bg: "bg-gray-100 dark:bg-gray-800" },
  en_proceso:  { label: "En Proceso",  color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40" },
  aprobado:    { label: "Aprobado",    color: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-950/40" },
  fallido:     { label: "Fallido",     color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/40" },
  omitido:     { label: "Omitido",     color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40" },
  rechazada:   { label: "Rechazada",   color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/40" },
  completada:  { label: "Completada",  color: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-950/40" },
  cancelada:   { label: "Cancelada",   color: "text-zinc-500 dark:text-zinc-400",     bg: "bg-zinc-100 dark:bg-zinc-800" },
};

const ACTION_CONFIG = {
  muestra_creada:    { label: "Muestra creada",    Icon: PlusCircle, color: "text-indigo-500 dark:text-indigo-400", ring: "ring-indigo-500/30 dark:ring-indigo-400/20", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  paso_actualizado:  { label: "Paso actualizado",  Icon: Clock,      color: "text-gray-500 dark:text-gray-400",    ring: "ring-gray-300 dark:ring-gray-700",           bg: "bg-white dark:bg-gray-900" },
  reintento_iniciado:{ label: "Nuevo intento",     Icon: RotateCcw,  color: "text-amber-500 dark:text-amber-400",  ring: "ring-amber-400/30 dark:ring-amber-500/20",   bg: "bg-amber-50 dark:bg-amber-950/40" },
  muestra_cancelada: { label: "Muestra cancelada", Icon: Ban,        color: "text-zinc-500 dark:text-zinc-400",    ring: "ring-zinc-400/30 dark:ring-zinc-600/30",     bg: "bg-zinc-50 dark:bg-zinc-900/60" },
};

function StatusPill({ status }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-gray-500", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function HistoryEntry({ entry }) {
  const actionCfg = ACTION_CONFIG[entry.accion] || ACTION_CONFIG.paso_actualizado;
  const { Icon } = actionCfg;
  const dateStr = fmtDateTime(entry.realizado_en);

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ring-2 ${actionCfg.ring} ${actionCfg.bg}`}>
        <Icon size={14} className={actionCfg.color} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              {entry.accion === "muestra_creada" && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Muestra registrada en el sistema</p>
              )}
              {entry.accion === "reintento_iniciado" && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Nuevo intento iniciado — pasos reiniciados</p>
              )}
              {entry.accion === "muestra_cancelada" && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Muestra cancelada — ticket cerrado</p>
              )}
              {entry.accion === "paso_actualizado" && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {entry.nombre_paso || "Paso"}
                </p>
              )}
              {(entry.accion === "reintento_iniciado" || entry.accion === "muestra_cancelada") && (
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={entry.estado_anterior} />
                  <span className="text-gray-400 dark:text-gray-600 text-xs">→</span>
                  <StatusPill status={entry.estado_nuevo} />
                </div>
              )}
              {entry.accion === "paso_actualizado" && entry.estado_anterior !== entry.estado_nuevo && (
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={entry.estado_anterior} />
                  <span className="text-gray-400 dark:text-gray-600 text-xs">→</span>
                  <StatusPill status={entry.estado_nuevo} />
                </div>
              )}
              {entry.accion === "paso_actualizado" && entry.estado_anterior === entry.estado_nuevo && (
                <div className="flex items-center gap-1 mt-1.5">
                  <StatusPill status={entry.estado_nuevo} />
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(notas actualizadas)</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{dateStr}</span>
              {entry.performed_by_name && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  <User size={10} />
                  {entry.performed_by_name}
                </span>
              )}
            </div>
          </div>

          {entry.notas && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 italic">
              "{entry.notas}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SampleHistory() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`/api/samples/${id}/history`)
      .then(res => setData(res.data))
      .catch(() => setError("No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center text-gray-500 dark:text-gray-400">{error}</div>
  );

  const { sample, history } = data;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link to={`/samples/${id}`} className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Volver a la muestra
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-sm text-indigo-600 dark:text-indigo-400 font-bold mb-1">{sample.code}</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial de cambios</h1>
        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {history.length === 0 ? "Sin registros aún" : `${history.length} evento${history.length !== 1 ? "s" : ""} registrado${history.length !== 1 ? "s" : ""}`}
          </p>
          {sample.assigned_name && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-full">
              <User size={12} className="text-gray-400 dark:text-gray-500" />
              {sample.assigned_name}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      {history.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay eventos registrados para esta muestra.</p>
          <p className="text-xs mt-1">Los cambios futuros aparecerán aquí.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-4 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-0">
            {history.map(entry => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
