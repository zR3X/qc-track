import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FlaskConical, LayoutDashboard, Settings, LogOut, Sun, Moon, User } from "lucide-react";
import axios from "axios";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [analysts, setAnalysts] = useState([]);

  useEffect(() => {
    axios.get("/api/users/analysts").then(r => setAnalysts(r.data)).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-60 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm dark:shadow-none">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical size={18} className="text-white" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">QC Track</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Control de Calidad</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
          {/* Dashboard general */}
          <Link to="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${location.pathname === "/dashboard"
                ? "bg-indigo-600 text-white"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"}`}
          >
            <LayoutDashboard size={18} className="flex-shrink-0" />
            <span className="hidden lg:block text-sm font-medium">Dashboard</span>
          </Link>

          {/* Botones dinámicos por analista */}
          {analysts.map(a => {
            const to = `/dashboard/${a.id}`;
            const active = location.pathname === to;
            return (
              <Link key={a.id} to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                  ${active
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"}`}
              >
                <User size={15} className="flex-shrink-0 ml-1" />
                <span className="hidden lg:block text-xs font-medium truncate">{a.name}</span>
              </Link>
            );
          })}

          {/* Admin */}
          {user?.role === "admin" && (
            <Link to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mt-2
                ${location.pathname === "/admin"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"}`}
            >
              <Settings size={18} className="flex-shrink-0" />
              <span className="hidden lg:block text-sm font-medium">Administración</span>
            </Link>
          )}
        </nav>

        {/* Theme toggle + User */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
          {/* Theme toggle */}
          <button onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all
              text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          >
            {dark
              ? <Sun size={16} className="flex-shrink-0 text-amber-400" />
              : <Moon size={16} className="flex-shrink-0 text-indigo-500" />
            }
            <span className="hidden lg:block text-sm font-medium">
              {dark ? "Modo claro" : "Modo oscuro"}
            </span>
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all
              text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
            <LogOut size={16} className="flex-shrink-0" />
            <span className="hidden lg:block text-sm">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
