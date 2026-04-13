import { useMemo, memo } from "react";
import { fmtDateTime } from "../utils/date";

const STEP_NAMES = ["Entrega", "Análisis", "Resultado"];

const DOT_COLORS = {
  pending:     "bg-gray-300 dark:bg-gray-700",
  in_progress: "bg-blue-500",
  passed:      "bg-green-500",
  failed:      "bg-red-500",
  skipped:     "bg-gray-400 dark:bg-gray-500",
};

const MiniProgress = memo(function MiniProgress({ steps }) {
  const stepData = useMemo(() => {
    const map = {};
    (steps || []).forEach(s => {
      if (s.step_name) map[s.step_name.toLowerCase()] = s;
    });
    return STEP_NAMES.map(name => {
      const s = map[name.toLowerCase()];
      return {
        name,
        status: s?.status || "pending",
        ts: s?.completed_at || s?.started_at || null,
      };
    });
  }, [steps]);

  return (
    <div className="flex gap-1.5">
      {stepData.map(({ name, status, ts }) => (
        <div key={name} className="flex-1 flex flex-col gap-1">
          <div
            title={name}
            className={`h-2.5 rounded-full transition-all ${DOT_COLORS[status] || "bg-gray-300 dark:bg-gray-700"} ${status === "in_progress" ? "animate-pulse" : ""}`}
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight truncate">
            {ts ? fmtDateTime(ts) : "—"}
          </p>
        </div>
      ))}
    </div>
  );
});

export default MiniProgress;
