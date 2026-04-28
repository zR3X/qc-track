import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, X, Info } from "lucide-react";

const TOAST_TYPES = {
  success: { icon: CheckCircle, bg: "bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-800", text: "text-green-700 dark:text-green-400", iconColor: "text-green-500" },
  error:   { icon: XCircle,   bg: "bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-800", text: "text-red-700 dark:text-red-400", iconColor: "text-red-500" },
  warning: { icon: AlertCircle, bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", iconColor: "text-amber-500" },
  info:    { icon: Info,      bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", iconColor: "text-blue-500" },
};

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const cfg = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
  const Icon = cfg.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in ${cfg.bg} ${isExiting ? "animate-fade-out" : ""}`}>
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`font-semibold text-sm ${cfg.text}`}>{toast.title}</p>
        )}
        <p className={`text-sm ${cfg.text} ${toast.title ? "mt-1" : ""}`}>
          {toast.message}
        </p>
      </div>
      <button onClick={() => { setIsExiting(true); setTimeout(() => onRemove(toast.id), 300); }}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message, title = null, duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message, title, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast, success: (msg, title) => addToast("success", msg, title), error: (msg, title) => addToast("error", msg, title), info: (msg, title) => addToast("info", msg, title), warning: (msg, title) => addToast("warning", msg, title) };
}