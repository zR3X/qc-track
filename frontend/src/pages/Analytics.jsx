import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { FlaskConical, CheckCircle2, XCircle, Loader2, TrendingUp, Clock } from "lucide-react";

const COLORS = {
  completadas: "#10b981",
  rechazadas:  "#ef4444",
  en_proceso:  "#3b82f6",
  pendientes:  "#6b7280",
  canceladas:  "#71717a",
};

const PIE_COLORS = {
  Completadas: "#10b981",
  Rechazadas:  "#ef4444",
  "En proceso": "#3b82f6",
  Pendientes:  "#6b7280",
  Canceladas:  "#71717a",
};

const RANGE_OPTIONS = [
  { label: "7d",  value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-none ${className}`}>
      {title && <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">{title}</p>}
      {children}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm dark:shadow-none flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value ?? "—"}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1 truncate max-w-[200px]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
          <span className="font-semibold text-gray-800 dark:text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 dark:text-white">{name}: {value}</p>
    </div>
  );
};

export default function Analytics() {
  const [status, setStatus]       = useState([]);
  const [timeline, setTimeline]   = useState([]);
  const [topMat, setTopMat]       = useState([]);
  const [matFail, setMatFail]     = useState([]);
  const [stepFail, setStepFail]   = useState([]);
  const [analysts, setAnalysts]   = useState([]);
  const [turnos, setTurnos]       = useState([]);
  const [range, setRange]         = useState(30);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/analytics/status-distribution"),
      axios.get("/api/analytics/samples-over-time", { params: { range } }),
      axios.get("/api/analytics/top-materials"),
      axios.get("/api/analytics/material-failures"),
      axios.get("/api/analytics/step-failures"),
      axios.get("/api/analytics/analyst-performance"),
      axios.get("/api/analytics/turno-distribution"),
    ]).then(([s, t, tm, mf, sf, ap, tu]) => {
      setStatus(s.data);
      setTimeline(t.data);
      setTopMat(tm.data);
      setMatFail(mf.data);
      setStepFail(sf.data);
      setAnalysts(ap.data);
      setTurnos(tu.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [range]);

  const total       = status.reduce((s, r) => s + r.value, 0);
  const completadas = status.find(r => r.estado === "completada")?.value  ?? 0;
  const rechazadas  = status.find(r => r.estado === "rechazada")?.value   ?? 0;
  const en_proceso  = status.find(r => r.estado === "en_proceso")?.value  ?? 0;
  const approval    = (completadas + rechazadas) > 0 ? Math.round(completadas / (completadas + rechazadas) * 100) : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 lg:p-5 space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={FlaskConical}  label="Total muestras"    value={total}       color="bg-indigo-500" />
        <KpiCard icon={CheckCircle2}  label="Completadas"        value={completadas}  color="bg-green-500"  />
        <KpiCard icon={XCircle}       label="Rechazadas"         value={rechazadas}   color="bg-red-500"    />
        <KpiCard icon={TrendingUp}    label="Tasa aprobación"    value={approval !== null ? `${approval}%` : "—"} color="bg-blue-500" />
      </div>

      {/* Timeline + Status pie */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card title="Muestras creadas" className="xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            {RANGE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setRange(o.value)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${range === o.value ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                {o.label}
              </button>
            ))}
          </div>
          {timeline.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos en este rango</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Muestras" stroke="#6366f1" strokeWidth={2} fill="url(#colorCount)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Distribución por estado">
          {status.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={status} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {status.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[entry.name] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                {status.map(r => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[r.name] || "#6b7280" }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{r.name}: <b className="text-gray-800 dark:text-white">{r.value}</b></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Top materials by count */}
      <Card title="Top materiales — nº de muestras">
        {topMat.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, topMat.length * 36)}>
            <BarChart data={topMat} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="material" width={120} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="completadas" name="Completadas" stackId="a" fill={COLORS.completadas} radius={[0, 0, 0, 0]} />
              <Bar dataKey="rechazadas"  name="Rechazadas"  stackId="a" fill={COLORS.rechazadas}  radius={[0, 0, 0, 0]} />
              <Bar dataKey="en_proceso"  name="En proceso"  stackId="a" fill={COLORS.en_proceso}  radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendientes"  name="Pendientes"  stackId="a" fill={COLORS.pendientes}  radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Failures + Step failures */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Materiales con más rechazos">
          {matFail.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, matFail.length * 36)}>
              <BarChart data={matFail} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="material" width={120} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rechazadas" name="Rechazadas" fill={COLORS.rechazadas} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Pasos con más fallos">
          {stepFail.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos de fallos</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, stepFail.length * 44)}>
              <BarChart data={stepFail} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="step" width={120} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="fallos" name="Fallos" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Analyst performance + Turnos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Rendimiento por analista">
          {analysts.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, analysts.length * 48)}>
              <BarChart data={analysts} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="analista" width={100} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completadas" name="Completadas" fill={COLORS.completadas} radius={[0, 0, 0, 0]} />
                <Bar dataKey="rechazadas"  name="Rechazadas"  fill={COLORS.rechazadas}  radius={[0, 0, 0, 0]} />
                <Bar dataKey="en_proceso"  name="En proceso"  fill={COLORS.en_proceso}  radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Muestras por turno">
          {turnos.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Sin datos de turno</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, turnos.length * 48)}>
              <BarChart data={turnos} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="turno" width={80} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Muestras" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

    </div>
  );
}
