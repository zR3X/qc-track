import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import PublicStatus from "./pages/PublicStatus";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Analytics from "./pages/Analytics";
import SampleDetail from "./pages/SampleDetail";
import SampleHistory from "./pages/SampleHistory";
import ConfirmacionesJT from "./pages/ConfirmacionesJT";
import Layout from "./components/Layout";

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<PublicStatus />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/dashboard/:analystId" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/samples/:id" element={<PrivateRoute roles={["admin","analyst","jefe_turno"]}><Layout><SampleDetail /></Layout></PrivateRoute>} />
      <Route path="/samples/:id/history" element={<PrivateRoute roles={["admin"]}><Layout><SampleHistory /></Layout></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute roles={["admin"]}><Layout><AdminPanel /></Layout></PrivateRoute>} />
      <Route path="/confirmaciones-jt" element={<PrivateRoute roles={["jefe_turno"]}><Layout><ConfirmacionesJT /></Layout></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute roles={["admin"]}><Layout><Analytics /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
