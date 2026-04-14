import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FlaskConical, LayoutDashboard, Settings, LogOut, Sun, Moon, User, ChevronRight } from "lucide-react";
import axios from "axios";

function getPageTitle(pathname, analysts) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/admin") return "Administración";
  if (pathname.startsWith("/dashboard/")) {
    const analystId = pathname.split("/")[2];
    const analyst = analysts.find(a => String(a.id) === analystId);
    return analyst ? analyst.name : "Dashboard";
  }
  if (pathname.startsWith("/samples/") && pathname.endsWith("/history")) return "Historial";
  if (pathname.startsWith("/samples/")) return "Detalle de muestra";
  return "QC Track";
}

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

  const pageTitle = getPageTitle(location.pathname, analysts);
  const isAnalystPage = location.pathname.startsWith("/dashboard/") && location.pathname.split("/").length === 3;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-60 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm dark:shadow-none">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical size={18} className="text-white" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">QC Track</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Control de Calidad</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="h-14 flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-5 shadow-sm dark:shadow-none">
          {/* Page title / breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            {isAnalystPage && (
              <>
                <span className="text-sm text-gray-400 dark:text-gray-500 hidden sm:block">Dashboard</span>
                <ChevronRight size={14} className="text-gray-300 dark:text-gray-700 flex-shrink-0 hidden sm:block" />
              </>
            )}
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{pageTitle}</h1>
          </div>

          {/* Right: theme + user + logout */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Theme toggle */}
            <button onClick={toggle}
              className="p-2 rounded-lg transition-all text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
              title={dark ? "Modo claro" : "Modo oscuro"}
            >
              {dark
                ? <Sun size={16} className="text-amber-400" />
                : <Moon size={16} className="text-indigo-500" />
              }
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

            {/* User info */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>

            {/* Logout */}
            <button onClick={handleLogout}
              className="p-2 rounded-lg transition-all text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
