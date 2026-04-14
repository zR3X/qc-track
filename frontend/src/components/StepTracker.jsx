import { memo } from "react";
import { Check, X, Clock, Loader, Lock, SkipForward } from "lucide-react";
import { fmtDateTime } from "../utils/date";

const STATUS_CONFIG = {
  pending:     { icon: Clock,        bg: "bg-gray-50 dark:bg-gray-800",      border: "border-gray-300 dark:border-gray-700",   text: "text-gray-500 dark:text-gray-400",    label: "Pendiente",  iconBg: "bg-gray-200 dark:bg-gray-700"   },
  in_progress: { icon: Loader,       bg: "bg-blue-50 dark:bg-blue-950",      border: "border-blue-400 dark:border-blue-500",   text: "text-blue-600 dark:text-blue-400",    label: "En Proceso", iconBg: "bg-blue-600",    pulse: true },
  passed:      { icon: Check,        bg: "bg-green-50 dark:bg-green-950",    border: "border-green-400 dark:border-green-500", text: "text-green-600 dark:text-green-400",   label: "Aprobado",   iconBg: "bg-green-500"                   },
  failed:      { icon: X,            bg: "bg-red-50 dark:bg-red-950",        border: "border-red-400 dark:border-red-500",     text: "text-red-600 dark:text-red-400",      label: "Fallido",    iconBg: "bg-red-500"                     },
  skipped:     { icon: SkipForward,  bg: "bg-yellow-50 dark:bg-yellow-950",  border: "border-yellow-400 dark:border-yellow-600", text: "text-yellow-600 dark:text-yellow-400", label: "Omitido",    iconBg: "bg-yellow-500"                  },
};

const CONNECTOR_COLORS = {
  pending:     "bg-gray-200 dark:bg-gray-700",
  in_progress: "bg-blue-400 dark:bg-blue-500",
  passed:      "bg-green-400 dark:bg-green-500",
  failed:      "bg-red-400 dark:bg-red-500",
  skipped:     "bg-yellow-400 dark:bg-yellow-500",
};

function getLockedMap(steps) {
  const locked = {};
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    locked[steps[i].id] = prev.status !== "passed" && prev.status !== "skipped";
  }
  return locked;
}

function getActiveIndex(steps, lockedMap) {
  for (let i = 0; i < steps.length; i++) {
    if (!lockedMap[steps[i].id] && (steps[i].status === "pending" || steps[i].status === "in_progress")) {
      return i;
    }
  }
  return -1;
}

const ALLOWED_TRANSITIONS = {
  pending:     ["passed", "failed"],
  in_progress: ["passed", "failed"],
  passed:      [],
  failed:      ["pending"],
  skipped:     ["pending"],
};

const TRANSITION_LABELS = {
  pending:     { label: "Restablecer",  style: "bg-yellow-50 dark:bg-yellow-950 border-yellow-400 dark:border-yellow-600 text-yellow-600 dark:text-yellow-400" },
  in_progress: { label: "Iniciar",      style: "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400" },
  passed:      { label: "Aprobar",      style: "bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-500 text-green-600 dark:text-green-400" },
  failed:      { label: "Marcar Fallo", style: "bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-500 text-red-600 dark:text-red-400" },
};

function StepTracker({ steps, onUpdateStep, readOnly = false }) {
  if (!steps || steps.length === 0) return null;

  const lockedMap  = getLockedMap(steps);
  const activeIdx  = getActiveIndex(steps, lockedMap);
  const failedIdx  = steps.findIndex(s => s.status === "failed");
  const N          = steps.length;

  return (
    <div className="relative select-none">
      {/* Horizontal connector segments — one per adjacent step pair */}
      <div className="absolute inset-x-0 z-0 pointer-events-none" style={{ top: "19px", height: "2px" }}>
        {steps.slice(0, -1).map((step, i) => (
          <div
            key={`conn-${i}`}
            className={`absolute top-0 h-full transition-colors duration-500 ${CONNECTOR_COLORS[step.status] ?? "bg-gray-200 dark:bg-gray-700"}`}
            style={{
              left:  `${((2 * i + 1) / (2 * N)) * 100}%`,
              width: `${(1 / N) * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Step columns */}
      <div className="grid relative z-10" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: "0.75rem" }}>
        {steps.map((step, idx) => {
          const locked        = !!lockedMap[step.id];
          const isActive      = idx === activeIdx;
          const cfg           = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
          const Icon          = locked ? Lock : cfg.icon;
          const isSpinning    = step.status === "in_progress";
          const blockedByFail = locked && failedIdx !== -1 && idx > failedIdx;
          const transitions   = ALLOWED_TRANSITIONS[step.status] ?? [];

          return (
            <div key={step.id} className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={[
                  "relative w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  locked
                    ? "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                    : `${cfg.border} ${cfg.iconBg}`,
                  isActive && !locked ? "ring-4 ring-indigo-400/30 dark:ring-indigo-500/20" : "",
                ].join(" ")}
              >
                <Icon
                  size={locked ? 11 : 15}
                  className={
                    locked
                      ? "text-gray-400 dark:text-gray-600"
                      : ["passed", "failed", "in_progress", "skipped"].includes(step.status)
                        ? `text-white ${isSpinning ? "animate-spin" : ""}`
                        : cfg.text
                  }
                />
                {isSpinning && !locked && (
                  <span className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping" />
                )}
              </div>

              {/* Card */}
              <div
                className={[
                  "w-full mt-3 rounded-xl border transition-all duration-300",
                  locked
                    ? "bg-gray-50/60 dark:bg-gray-900/30 border-dashed border-gray-200 dark:border-gray-800/60 opacity-50"
                    : `${cfg.bg} ${cfg.border}`,
                  isActive && !locked ? "shadow-sm" : "",
                ].join(" ")}
              >
                {/* Top section: name + badge */}
                <div className="px-3.5 pt-3 pb-2.5 text-center">
                  <p className={`font-semibold text-sm leading-snug ${locked ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}`}>
                    {step.step_name}
                  </p>

                  <div className="mt-1.5 flex justify-center">
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-600">
                        <Lock size={9} />
                        {blockedByFail ? "Bloqueado" : "En espera"}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body: notes + metadata + actions — single section, no extra border */}
                {!locked && (step.notes || (step.updated_by_name && step.status !== "pending") || (!readOnly && onUpdateStep && transitions.length > 0)) && (
                  <div className="px-3.5 pb-2.5 space-y-2 border-t border-gray-100 dark:border-gray-700/60 pt-2.5">
                    {step.notes && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 italic leading-relaxed">
                        "{step.notes}"
                      </p>
                    )}

                    {step.updated_by_name && step.status !== "pending" && (
                      <div className="text-center space-y-0.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{step.updated_by_name}</p>
                        {step.completed_at && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDateTime(step.completed_at)}</p>
                        )}
                      </div>
                    )}

                    {!readOnly && onUpdateStep && transitions.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {transitions.map(targetStatus => {
                          const t = TRANSITION_LABELS[targetStatus];
                          return (
                            <button
                              key={targetStatus}
                              onClick={() => onUpdateStep(step.id, targetStatus)}
                              className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all hover:opacity-80 active:scale-95 ${t.style}`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(StepTracker);
export { STATUS_CONFIG };
