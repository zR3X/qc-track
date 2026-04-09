const STATUS = {
  pending:     { label: "Pendiente",   classes: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300" },
  in_progress: { label: "En Proceso",  classes: "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-300" },
  completed:   { label: "Completado",  classes: "bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-500 text-green-600 dark:text-green-300" },
  rejected:    { label: "Rechazado",   classes: "bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-500 text-red-600 dark:text-red-300" },
  cancelled:   { label: "Cancelado",   classes: "bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400" },
};

export default function SampleStatusBadge({ status, size = "sm" }) {
  const cfg = STATUS[status] || STATUS.pending;
  const padding = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${cfg.classes} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "in_progress" ? "bg-blue-500 animate-pulse" : "bg-current"}`} />
      {cfg.label}
    </span>
  );
}
