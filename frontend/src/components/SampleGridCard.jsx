import { memo, useMemo } from "react";
import { User, Calendar, MessageSquare, Pin, ShieldCheck, StickyNote, Expand } from "lucide-react";
import SampleStatusBadge from "./SampleStatusBadge";
import { fmtDate, fmtTime } from "../utils/date";

export const HIDDEN_STEPS = new Set(["Ingreso", "Toma de muestra"]);

const SAMPLE_ACCENT = {
  completed:   "border-l-green-400",
  rejected:    "border-l-red-400",
  in_progress: "border-l-blue-400",
  pending:     "border-l-gray-300 dark:border-l-gray-700",
};

const STEP_NAMES = ["Entrega", "Análisis", "Resultado"];
const BAR_COLORS = {
  pending:     "bg-gray-300 dark:bg-gray-700",
  in_progress: "bg-blue-500",
  passed:      "bg-green-500",
  failed:      "bg-red-500",
  skipped:     "bg-gray-400 dark:bg-gray-500",
};

function StepsPanel({ steps }) {
  const stepData = useMemo(() => {
    const map = {};
    (steps || []).forEach(s => { if (s.step_name) map[s.step_name.toLowerCase()] = s; });
    return STEP_NAMES.map(name => {
      const s = map[name.toLowerCase()];
      return { name, status: s?.status || "pending", ts: s?.completed_at || s?.started_at || null };
    });
  }, [steps]);

  return (
    <div className="flex gap-3 w-full">
      {stepData.map(({ name, status, ts }) => (
        <div key={name} className="flex-1 flex flex-col gap-1.5 min-w-0">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 text-center truncate">{name}</p>
          <div className={`h-2 rounded-full transition-all ${BAR_COLORS[status] || BAR_COLORS.pending} ${status === "in_progress" ? "animate-pulse" : ""}`} />
          <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium tabular-nums">
            {ts ? fmtTime(ts) : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

function SampleComment({ text, fase }) {
  const isFase = (fase || 1) > 1;
  return (
    <div className="flex items-start gap-1.5 min-w-0 border-t border-gray-100 dark:border-gray-800 pt-2.5 min-h-[2rem]">
      {text ? (
        <>
          <StickyNote size={10} className={`flex-shrink-0 mt-0.5 ${isFase ? "text-blue-400" : "text-amber-400"}`} />
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed min-w-0 break-words">
            {isFase && <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">Fase {fase}:</span>}
            {text}
          </p>
        </>
      ) : null}
    </div>
  );
}

export const SampleGridCard = memo(function SampleGridCard({
  sample, isNew, pinned, onPin, onChat, unreadChat, onCardClick,
}) {
  const steps = (sample.steps || []).filter(s => !HIDDEN_STEPS.has(s.step_name));
  const accent = SAMPLE_ACCENT[sample.status] || SAMPLE_ACCENT.pending;

  return (
    <div
      role={onCardClick ? "link" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={onCardClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCardClick(); }
      } : undefined}
      onClick={onCardClick ? (e) => {
        if (e.target.closest("button")) return;
        onCardClick();
      } : undefined}
      className={`group relative border-l-4 ${accent} rounded-xl transition-all flex flex-col ${
        onCardClick ? "cursor-pointer" : ""
      } ${
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

      {/* Icono ver detalles — aparece al hacer hover */}
      {onCardClick && (
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-indigo-600 text-white rounded-md p-1">
            <Expand size={11} />
          </div>
        </div>
      )}

      {/* ── Contenido principal ── */}
      <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">

        {/* Fila superior: identificadores + pasos */}
        <div className="flex items-start gap-4 min-w-0">
          {/* Identificadores */}
          <div className="min-w-0 flex-shrink-0 space-y-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`font-bold text-xs leading-tight ${sample.codigo_orden ? "text-indigo-600 dark:text-indigo-400" : "text-gray-800 dark:text-gray-200"}`}>
                {sample.codigo_orden || sample.code}
              </span>
              {sample.approval_pending && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 px-1 py-0.5 rounded border border-amber-400/60 flex-shrink-0" title="Pendiente de confirmación del jefe de turno">
                  <ShieldCheck size={9} />
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-900 dark:text-white text-xs leading-tight truncate max-w-[10rem]" title={sample.nombre_material || sample.product_name}>
              {sample.nombre_material || sample.product_name}
            </p>
            {sample.codigo_material && (
              <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{sample.codigo_material}</p>
            )}
          </div>

          {/* Pasos — arriba a la derecha */}
          <div className="flex-1 min-w-0">
            {steps.length > 0 ? (
              <StepsPanel steps={steps} />
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">Sin pasos configurados</p>
            )}
          </div>
        </div>

        {/* Comentario del operador */}
        <SampleComment text={sample.comentarios} fase={sample.fase} />

        {/* Fila inferior: analista + fecha + estado + acciones */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2.5">
          <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 min-w-0">
            {sample.assigned_name && (
              <span className="flex items-center gap-1 truncate">
                <User size={10} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />
                {sample.assigned_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar size={10} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />
              {fmtDate(sample.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <SampleStatusBadge status={sample.status} />
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 border ${
              (sample.fase || 1) > 1
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700"
            }`}>
              Fase {sample.fase || 1}
            </span>
            {sample.status !== "cancelled" && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChat(sample); }}
                  className={`relative p-1.5 rounded-lg transition-all ${
                    unreadChat > 0
                      ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
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
                  onClick={(e) => { e.stopPropagation(); onPin(sample.id); }}
                  className={`p-1.5 rounded-lg transition-all ${
                    pinned
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                  }`}
                  title={pinned ? "Quitar pin" : "Fijar como card"}
                >
                  <Pin size={13} className={pinned ? "fill-current" : ""} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
