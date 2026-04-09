import { useState, useEffect } from "react";
import axios from "axios";
import { Users, ListChecks, Plus, Trash2, X, Eye, EyeOff, AlertCircle } from "lucide-react";

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border
        ${active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-700"}`}>
      <Icon size={14} />
      {label}
    </button>
  );
}

// --- USERS TAB ---
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "analyst", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const fetch = async () => {
    const res = await axios.get("/api/users");
    setUsers(res.data);
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await axios.post("/api/users", form);
      setForm({ username: "", password: "", role: "analyst", name: "" });
      setShowForm(false);
      fetch();
    } catch (err) { setError(err.response?.data?.error || "Error"); }
    finally { setLoading(false); }
  };

  const handleToggle = async (user) => {
    await axios.put(`/api/users/${user.id}`, { active: user.active ? 0 : 1 });
    fetch();
  };

  const ROLE_COLORS = {
    admin:   "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-800",
    analyst: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800"
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{users.filter(u => u.active).length} usuarios activos</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-sm transition-all">
          <Plus size={14} /> Nuevo Usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 animate-slide-up">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nuevo Usuario</h4>
          {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded px-3 py-1.5">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Nombre completo *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Usuario *</label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Contraseña *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Rol *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="analyst">Analista</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-1.5 rounded-lg text-sm font-medium transition-all">Cancelar</button>
            <button type="submit" disabled={loading || !form.name || !form.username || !form.password}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null} Crear
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all
            ${u.active
              ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
              : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 opacity-50"}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {u.name[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{u.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[u.role] || "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}>
                    {u.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">@{u.username}</p>
              </div>
            </div>
            <button onClick={() => handleToggle(u)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-medium
                ${u.active
                  ? "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-950/40"
                  : "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-950/40"}`}>
              {u.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STEPS TAB ---
function StepsTab() {
  const [steps, setSteps] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#3B82F6" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PRESET_COLORS = ["#6366F1", "#8B5CF6", "#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#F97316", "#06B6D4"];

  const fetch = async () => {
    const res = await axios.get("/api/steps");
    setSteps(res.data);
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await axios.post("/api/steps", form);
      setForm({ name: "", description: "", color: "#3B82F6" });
      setShowForm(false);
      fetch();
    } catch (err) { setError(err.response?.data?.error || "Error"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/steps/${id}`);
    fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{steps.length} pasos configurados</p>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-xl mb-4">
        <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          Los pasos de control de calidad están definidos: Ingreso, Entrega, Toma de muestra, Análisis, Resultado
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <span className="text-xs text-gray-400 dark:text-gray-600 w-5 text-center font-mono">{idx + 1}</span>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: step.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{step.name}</p>
              {step.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{step.description}</p>}
            </div>
            <button onClick={() => handleDelete(step.id)}
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-amber-50 dark:bg-yellow-950/20 border border-amber-200 dark:border-yellow-800/30 rounded-xl">
        <p className="text-xs text-amber-700 dark:text-yellow-600 flex items-start gap-2">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          Los pasos se asignan automáticamente a las nuevas muestras. Eliminar un paso lo oculta pero no afecta muestras existentes.
        </p>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("users");

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administración</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Gestión de usuarios y configuración del sistema</p>
      </div>

      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="Usuarios" />
        <TabButton active={tab === "steps"} onClick={() => setTab("steps")} icon={ListChecks} label="Pasos QC" />
      </div>

      <div className="animate-fade-in">
        {tab === "users" ? <UsersTab /> : <StepsTab />}
      </div>
    </div>
  );
}
