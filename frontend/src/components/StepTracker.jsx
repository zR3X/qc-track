import { memo } from "react";
import { Check, X, Clock, Loader, Lock, AlertOctagon, SkipForward } from "lucide-react";
import { fmtDateTime } from "../utils/date";

const STATUS_CONFIG = {
  pending:     { icon: Clock,        bg: "bg-gray-50 dark:bg-gray-800",      border: "border-gray-300 dark:border-gray-700",   text: "text-gray-500 dark:text-gray-400",    label: "Pendiente",  iconBg: "bg-gray-200 dark:bg-gray-800"   },
  in_progress: { icon: Loader,       bg: "bg-blue-50 dark:bg-blue-950",      border: "border-blue-400 dark:border-blue-500",   text: "text-blue-600 dark:text-blue-400",    label: "En Proceso", iconBg: "bg-blue-600",    pulse: true },
  passed:      { icon: Check,        bg: "bg-green-50 dark:bg-green-950",    border: "border-green-400 dark:border-green-500", text: "text-green-600 dark:text-green-400",   label: "Aprobado",   iconBg: "bg-green-500"                   },
  failed:      { icon: X,            bg: "bg-red-50 dark:bg-red-950",        border: "border-red-400 dark:border-red-500",     text: "text-red-600 dark:text-red-400",      label: "Fallido",    iconBg: "bg-red-500"                     },
  skipped:     { icon: SkipForward,  bg: "bg-yellow-50 dark:bg-yellow-950",  border: "border-yellow-400 dark:border-yellow-600", text: "text-yellow-600 dark:text-yellow-400", label: "Omitido",    iconBg: "bg-yellow-500"                  },
};

// Determines which steps are locked (sequential rule)
function getLockedMap(steps) {
  const locked = {};
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    locked[steps[i].id] = prev.status !== "passed" && prev.status !== "skipped";
  }
  return locked;
}

// Returns the index of the first step that is available but not yet completed
function getActiveIndex(steps, lockedMap) {
  for (let i = 0; i < steps.length; i++) {
    if (!lockedMap[steps[i].id] && (steps[i].status === "pending" || steps[i].status === "in_progress")) {
      return i;
    }
  }
  return -1;
}

// Transitions allowed per status (state machine)
const ALLOWED_TRANSITIONS = {
  pending:     ["passed", "failed"],
  in_progress: ["passed", "failed"],
  passed:      [],
  failed:      ["pending"],
  skipped:     ["pending"],
};

const TRANSITION_LABELS = {
  pending:     { label: "Restablecer",  style: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400" },
  in_progress: { label: "Iniciar",      style: "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400" },
  passed:      { label: "Aprobar",      style: "bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-500 text-green-600 dark:text-green-400" },
  failed:      { label: "Marcar Fallo", style: "bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-500 text-red-600 dark:text-red-400" },
};

function StepTracker({ steps, onUpdateStep, readOnly = false }) {
  if (!steps || steps.length === 0) return null;

  const lockedMap = getLockedMap(steps);
  const activeIdx = getActiveIndex(steps, lockedMap);
  const failedIdx = steps.findIndex(s => s.status === "failed");

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200 dark:bg-gray-800 z-0" />

      <div className="space-y-2.5 relative z-10">
        {steps.map((step, idx) => {
          const locked = !!lockedMap[step.id];
          const isActive = idx === activeIdx;
          const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const Icon = locked ? Lock : cfg.icon;
          const isSpinning = step.status === "in_progress";
          const blockedByFail = locked && failedIdx !== -1 && idx > failedIdx;

          return (
            <div key={step.id}>
              <div
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300
                  ${locked
                    ? "bg-gray-50/60 dark:bg-gray-900/30 border-dashed border-gray-200 dark:border-gray-800/60 opacity-50"
                    : `${cfg.bg} ${cfg.border}`}
                  ${isActive && !locked ? "ring-2 ring-indigo-400/40 dark:ring-indigo-500/30 shadow-sm" : ""}
                `}
              >
                {/* Circle icon */}
                <div className={`relative flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center
                  ${locked
                    ? "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                    : `${cfg.border} ${cfg.iconBg}`}`}
                >
                  <Icon
                    size={locked ? 11 : 14}
                    className={
                      locked
                        ? "text-gray-400 dark:text-gray-600"
                        : ["passed", "failed", "in_progress", "skipped"].includes(step.status)
                          ? `text-white ${isSpinning ? "animate-spin" : ""}`
                          : cfg.text
                    }
                  />
                  {isSpinning && !locked && (
                    <span className="absolute inset-0 rounded-full bg-blue-500 opacity-25 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className={`font-semibold text-sm ${locked ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}`}>
                        {step.step_name}
                      </p>
                      {step.step_description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{step.step_description}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    {locked ? (
                      <span className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1">
                        <Lock size={10} />
                        {blockedByFail ? "Bloqueado" : "En espera"}
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {!locked && step.notes && (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 italic">
                      "{step.notes}"
                    </p>
                  )}

                  {/* Metadata */}
                  {!locked && step.updated_by_name && step.status !== "pending" && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {step.updated_by_name}
                      {step.completed_at && ` · ${fmtDateTime(step.completed_at)}`}
                    </p>
                  )}

                  {/* Action buttons — only for unlocked, non-readonly steps */}
                  {!readOnly && !locked && onUpdateStep && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(ALLOWED_TRANSITIONS[step.status] || []).map(targetStatus => {
                        const t = TRANSITION_LABELS[targetStatus];
                        return (
                          <button
                            key={targetStatus}
                            onClick={() => onUpdateStep(step.id, targetStatus)}
                            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all hover:opacity-80 active:scale-95 ${t.style}`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Failure blocker message between failed step and next */}
              {step.status === "failed" && idx < steps.length - 1 && (
                <div className="flex items-center gap-2 ml-10 my-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg">
                  <AlertOctagon size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Proceso detenido — corrija el fallo para continuar
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(StepTracker);
export { STATUS_CONFIG };
