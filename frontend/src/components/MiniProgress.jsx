import { useMemo, memo } from "react";

const STEP_NAMES = ["Entrega", "Análisis", "Resultado"];

const DOT_COLORS = {
  pending:     "bg-gray-300 dark:bg-gray-700",
  in_progress: "bg-blue-500",
  passed:      "bg-green-500",
  failed:      "bg-red-500",
  skipped:     "bg-gray-400 dark:bg-gray-500",
};

const MiniProgress = memo(function MiniProgress({ steps }) {
  const statusByName = useMemo(() => {
    const map = {};
    (steps || []).forEach(s => {
      if (s.step_name) map[s.step_name.toLowerCase()] = s.status;
    });
    return map;
  }, [steps]);

  const stepStatuses = useMemo(() =>
    STEP_NAMES.map(name => statusByName[name.toLowerCase()] || "pending"),
  [statusByName]);

  const done = stepStatuses.filter(s => s === "passed" || s === "skipped").length;
  const pct  = Math.round((done / STEP_NAMES.length) * 100);

  return (
    <div>
      <div className="flex gap-1 mb-1.5">
        {STEP_NAMES.map((name, i) => {
          const status = stepStatuses[i];
          return (
            <div key={name} title={name}
              className={`flex-1 h-1.5 rounded-full transition-all ${DOT_COLORS[status] || "bg-gray-300 dark:bg-gray-700"} ${status === "in_progress" ? "animate-pulse" : ""}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{done}/{STEP_NAMES.length} pasos · {pct}%</p>
    </div>
  );
});

export default MiniProgress;
