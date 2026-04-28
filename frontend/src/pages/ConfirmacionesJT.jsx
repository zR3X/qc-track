import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useNavActions } from "../context/NavActionsContext";
import { fmtDate, fmtTime } from "../utils/date";
import { CheckCircle2, XCircle, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import SampleStatusBadge from "../components/SampleStatusBadge";
import { ToastContainer, useToast } from "../components/Toast";
import SearchBar from "../components/SearchBar";

export default function ConfirmacionesJT() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [plantaFilter, setPlantaFilter] = useState("");
  const navigate = useNavigate();
  const { setNavActions, setNavCenter } = useNavActions();
  const { toasts, addToast, removeToast } = useToast();

  const handleFilterChange = useCallback((filters) => {
    setSearch(typeof filters.search === "string" ? filters.search : "");
    setPlantaFilter(filters.planta || "");
  }, []);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/samples");
      setSamples(res.data);
    } catch {
      addToast("error", "Error al cargar", "No se pudieron obtener las muestras");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  useEffect(() => {
    setNavActions(
      <button
        onClick={fetchSamples}
        className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      </button>
    );
    return () => setNavActions(null);
  }, [loading, fetchSamples, setNavActions]);

  useEffect(() => {
    setNavCenter(
      <SearchBar
        placeholder="Buscar código, producto o lote..."
        onFilterChange={handleFilterChange}
        showStatusFilter={false}
        showPlantaFilter={true}
      />
    );
    return () => setNavCenter(null);
  }, [setNavCenter, handleFilterChange]);

  const confirmed = useMemo(() => {
    const q = search.toLowerCase().trim();
    const planta = plantaFilter.trim().toUpperCase();
    return [...samples]
      .filter(s => s.approval_result && !s.approval_pending)
      .filter(s => {
        if (planta && (s.planta || "").toUpperCase() !== planta) return false;
        if (q) {
          const haystack = [s.codigo_orden, s.code, s.nombre_material, s.product_name, s.codigo_material]
            .filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.approved_at || b.created_at) - new Date(a.approved_at || a.created_at));
  }, [samples, search, plantaFilter]);

  return (
    <div className="p-4 lg:p-5">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShieldCheck size={18} className="text-indigo-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Historial de confirmaciones JT</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Muestras revisadas y confirmadas por el jefe de turno</p>
        </div>
        <span className="text-sm px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/50 tabular-nums">
          {confirmed.length} confirmadas
        </span>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
              <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
              <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : confirmed.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <AlertCircle className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={36} />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Aún no hay confirmaciones registradas</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Aparecerán aquí cuando el jefe de turno confirme muestras</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Orden</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Material</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Turno</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Analista</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">Decisión JT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Confirmado por</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Fecha confirmación</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map(s => {
                  const isConforme = !s.approval_result?.toLowerCase().includes("no") && s.approval_result !== "rechazado";
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/samples/${s.id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                          {s.codigo_orden || s.code}
                        </span>
                        {s.attempt > 1 && (
                          <span className="ml-1.5 text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded-full font-bold">
                            #{s.attempt}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate" title={s.nombre_material || s.product_name}>
                          {s.nombre_material || s.product_name}
                        </div>
                        {s.codigo_material && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{s.codigo_material}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {s.grupo_turno ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                            {s.grupo_turno}
                          </span>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.assigned_name
                          ? <span className="text-sm text-gray-700 dark:text-gray-300">{s.assigned_name}</span>
                          : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SampleStatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isConforme
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                            : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                        }`}>
                          {isConforme ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {isConforme ? "Conforme" : "No conforme"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.approved_by_name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.approved_at ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{fmtDate(s.approved_at)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{fmtTime(s.approved_at)}</span>
                          </div>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
