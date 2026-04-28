import { useState, useEffect, useRef } from "react";
import { Search, Filter, X, Calendar, CheckCircle2, Clock, Loader2, XCircle, Ban, ChevronDown, Building2, Check } from "lucide-react";
import axios from "axios";

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_CONFIG = [
  { key: "pending",     label: "Pendiente",   icon: Clock,         color: "text-gray-500",  activeBg: "bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-500 text-gray-800 dark:text-gray-100" },
  { key: "in_progress", label: "En Proceso",  icon: Loader2,       color: "text-blue-500",  activeBg: "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300" },
  { key: "completed",   label: "Completada",  icon: CheckCircle2,  color: "text-emerald-500", activeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300" },
  { key: "rejected",    label: "Rechazada",   icon: XCircle,       color: "text-red-500",   activeBg: "bg-red-50 dark:bg-red-950/60 border-red-500 text-red-700 dark:text-red-300" },
  { key: "cancelled",   label: "Cancelada",   icon: Ban,           color: "text-zinc-400",  activeBg: "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-400 dark:border-zinc-500 text-zinc-700 dark:text-zinc-300" },
];

const DATE_PRESETS = [
  { id: "today",     label: "Hoy" },
  { id: "7d",        label: "7 días" },
  { id: "30d",       label: "30 días" },
  { id: "thisMonth", label: "Este mes" },
  { id: "prevMonth", label: "Mes anterior" },
];

function PlantaDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setSearch("");
    }
  }, [open]);

  const filtered = options.filter(p =>
    !search || p.toLowerCase().includes(search.toLowerCase())
  );

  const label = value || "Todas las plantas";
  const isFiltered = Boolean(value);

  return (
    <div className="relative flex-shrink-0 w-40 sm:w-48" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
          isFiltered
            ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      >
        <Building2 size={13} className={isFiltered ? "text-indigo-500 dark:text-indigo-400 flex-shrink-0" : "text-gray-400 dark:text-gray-600 flex-shrink-0"} />
        <span className="flex-1 text-left truncate text-xs font-medium">{label}</span>
        {isFiltered ? (
          <span className="w-3 h-3" />
        ) : (
          <ChevronDown size={12} className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {isFiltered && (
        <button
          type="button"
          aria-label="Limpiar planta seleccionada"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex-shrink-0 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
        >
          <X size={11} />
        </button>
      )}

      {open && (
        <div className="absolute top-full mt-1.5 left-0 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 z-[60] overflow-hidden animate-slide-up">
          {/* Buscador interno */}
          <div className="px-2 pt-2 pb-1">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar planta..."
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          {/* Lista */}
          <ul className="py-1 max-h-52 overflow-y-auto">
            {/* Opción "todas" */}
            <li>
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  !value
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                  !value
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}>
                  {!value && <Check size={9} className="text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1 text-left">Todas las plantas</span>
              </button>
            </li>

            {filtered.length > 0 && (
              <li className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
            )}

            {filtered.map(p => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => { onChange(p); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    value === p
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                    value === p
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {value === p && <Check size={9} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 text-left truncate">{p}</span>
                </button>
              </li>
            ))}

            {filtered.length === 0 && search && (
              <li className="px-3 py-3 text-center text-xs text-gray-400 dark:text-gray-600">
                Sin resultados para "{search}"
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function SearchBar({
  placeholder = "Buscar...",
  onFilterChange,
  showStatusFilter = true,
  showPlantaFilter = true,
  showDateFilter = true,
  persistFilters = true,
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [plantaFilter, setPlantaFilter] = useState(() => {
    if (!persistFilters) return "";
    try { return localStorage.getItem("qc_planta_filter") || ""; }
    catch { return ""; }
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState("");
  const [plantas, setPlantas] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    if (showPlantaFilter) {
      axios.get("/api/ccr/plantas").then(r => setPlantas(r.data)).catch(() => {});
    }
  }, [showPlantaFilter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (persistFilters) {
      try { localStorage.setItem("qc_planta_filter", plantaFilter); } catch { /* silent */ }
    }
  }, [plantaFilter, persistFilters]);

  useEffect(() => {
    const filters = {
      search: debouncedSearch,
      ...(showPlantaFilter && { planta: plantaFilter }),
      ...(showStatusFilter && { status: statusFilter }),
      ...(showDateFilter ? { dateFrom, dateTo } : {}),
    };
    onFilterChange?.(filters);
  }, [debouncedSearch, plantaFilter, statusFilter, dateFrom, dateTo,
      showPlantaFilter, showStatusFilter, showDateFilter, onFilterChange]);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilters(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasActiveFilters =
    (showStatusFilter && statusFilter !== "all") ||
    (showDateFilter && (Boolean(dateFrom) || Boolean(dateTo)));

  const activeFilterCount = [
    showStatusFilter && statusFilter !== "all",
    showDateFilter && (Boolean(dateFrom) || Boolean(dateTo)),
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setActivePreset("");
    if (persistFilters) {
      try { localStorage.setItem("qc_planta_filter", ""); } catch { /* silent */ }
    }
  };

  const applyDatePreset = (preset) => {
    if (activePreset === preset) {
      setDateFrom("");
      setDateTo("");
      setActivePreset("");
      return;
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (preset === "today") {
      setDateFrom(formatYMD(today));
      setDateTo(formatYMD(today));
    } else if (preset === "7d") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setDateFrom(formatYMD(start));
      setDateTo(formatYMD(today));
    } else if (preset === "30d") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setDateFrom(formatYMD(start));
      setDateTo(formatYMD(today));
    } else if (preset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(formatYMD(start));
      setDateTo(formatYMD(end));
    } else if (preset === "prevMonth") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(formatYMD(start));
      setDateTo(formatYMD(end));
    }
    setActivePreset(preset);
  };

  const handleManualDate = (field, value) => {
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
    setActivePreset("");
  };

  const dateRangeLabel = () => {
    if (!dateFrom && !dateTo) return null;
    if (dateFrom && dateTo)
      return `${formatDisplayDate(dateFrom)} → ${formatDisplayDate(dateTo)}`;
    if (dateFrom) return `Desde ${formatDisplayDate(dateFrom)}`;
    return `Hasta ${formatDisplayDate(dateTo)}`;
  };

  return (
    <div className="relative flex items-center gap-2 w-full max-w-2xl" ref={filterRef}>
      {/* Selector de planta — dropdown personalizado */}
      {showPlantaFilter && (
        <PlantaDropdown
          value={plantaFilter}
          onChange={setPlantaFilter}
          options={plantas}
        />
      )}

      {/* Input de búsqueda */}
      <div className="relative flex-1 min-w-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={13} />
          </button>
        )}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg pl-9 pr-10 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder-gray-400 dark:placeholder-gray-600"
        />
        {/* Botón filtros */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`relative p-1.5 rounded-md transition-all ${
              hasActiveFilters
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                : showFilters
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="Filtros"
          >
            <Filter size={14} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-400 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 z-50 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Filter size={12} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">
                  {activeFilterCount} activo{activeFilterCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <X size={11} />
                Limpiar
              </button>
            )}
          </div>

          <div className="px-4 pb-4 space-y-5">
            {/* FECHA */}
            {showDateFilter && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">Fecha de registro</p>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => { setDateFrom(""); setDateTo(""); setActivePreset(""); }}
                      className="text-[10px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-0.5"
                    >
                      <X size={9} /> borrar
                    </button>
                  )}
                </div>

                {/* Atajos de período */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {DATE_PRESETS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyDatePreset(id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        activePreset === id
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Rango personalizado */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar size={9} /> Desde
                      </p>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => handleManualDate("from", e.target.value)}
                        className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                      />
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar size={9} /> Hasta
                      </p>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => handleManualDate("to", e.target.value)}
                        className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                  {dateRangeLabel() && (
                    <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-300 font-medium truncate">{dateRangeLabel()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ESTADO */}
            {showStatusFilter && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2.5">Estado</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_CONFIG.map(({ key, label, icon: Icon, color, activeBg }) => {
                    const active = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(active ? "all" : key)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                          active
                            ? `${activeBg} border-current`
                            : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Icon size={12} className={active ? "" : color} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
