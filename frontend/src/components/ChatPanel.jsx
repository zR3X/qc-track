import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, X, ArrowDown } from "lucide-react";
import axios from "axios";
import { getSocket } from "../lib/socket";
import { fmtDateTime } from "../utils/date";

export default function ChatPanel({ sampleId, sampleCode, senderName, senderRole, onClose, onRead }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0); // mensajes llegados mientras scrolleaba arriba
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setPendingCount(0);
  }, []);

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isAtBottomRef.current) setPendingCount(0);
  }, []);

  // Cargar historial
  useEffect(() => {
    if (!sampleId) return;
    axios.get(`/api/chat/${sampleId}`)
      .then(r => {
        setMessages(r.data);
        setPendingCount(0);
        // scroll instantáneo al cargar historial
        setTimeout(() => scrollToBottom("instant"), 50);
      })
      .catch(() => {});
  }, [sampleId, scrollToBottom]);

  // Marcar como leídos al abrir
  useEffect(() => {
    if (!sampleId) return;
    if (senderRole === "analyst" || senderRole === "jefe_turno") {
      axios.put(`/api/chat/${sampleId}/read`).catch(() => {});
      onRead?.(sampleId);
    }
    if (senderRole === "operator") {
      axios.put(`/api/chat/${sampleId}/read-operator`).catch(() => {});
      onRead?.(sampleId);
    }
  }, [sampleId, senderRole]); // onRead excluido intencionalmente

  // Socket.io
  useEffect(() => {
    if (!sampleId) return;
    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessage = (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (isAtBottomRef.current) {
        setTimeout(() => scrollToBottom(), 30);
      } else {
        setPendingCount(n => n + 1);
      }
      if ((senderRole === "analyst" || senderRole === "jefe_turno") && msg.sender_role === "operator") {
        axios.put(`/api/chat/${sampleId}/read`).catch(() => {});
        onRead?.(sampleId);
      }
      if (senderRole === "operator" && (msg.sender_role === "analyst" || msg.sender_role === "jefe_turno")) {
        axios.put(`/api/chat/${sampleId}/read-operator`).catch(() => {});
        onRead?.(sampleId);
      }
    };

    socket.emit("join-room", sampleId);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-message", onMessage);
    if (socket.connected) setConnected(true);

    return () => {
      socket.emit("leave-room", sampleId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-message", onMessage);
    };
  }, [sampleId, senderRole, onRead, scrollToBottom]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    getSocket().emit("send-message", { sampleId, senderName, senderRole, body });
    setSending(false);
    inputRef.current?.focus();
    setTimeout(() => scrollToBottom(), 50);
  }, [text, sending, sampleId, senderName, senderRole, scrollToBottom]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={15} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Chat de orden</p>
            {sampleCode && (
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 leading-tight truncate">{sampleCode}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-green-400" : "bg-gray-300 dark:bg-gray-600"}`} title={connected ? "Conectado" : "Reconectando..."} />
          {onClose && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={checkAtBottom}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 relative"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageSquare size={28} className="text-gray-200 dark:text-gray-700 mb-2" />
            <p className="text-xs text-gray-400 dark:text-gray-600">Sin mensajes aún</p>
            <p className="text-xs text-gray-300 dark:text-gray-700 mt-1">Inicia la conversación</p>
          </div>
        )}
        {messages.map(msg => {
          const mine = msg.sender_role === senderRole;
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words min-w-0
                ${mine
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm"
                }`}
              >
                {msg.body}
              </div>
              <div className={`flex items-center gap-1.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                <span className="text-[10px] text-gray-400 dark:text-gray-600 font-medium">{msg.sender_name?.split(" ").slice(0, 2).join(" ")}</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-700">·</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-700">{fmtDateTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Banner mensajes nuevos mientras scrollea arriba */}
      {pendingCount > 0 && (
        <div className="flex-shrink-0 px-3 pb-1">
          <button
            onClick={() => scrollToBottom()}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all active:scale-95"
          >
            <ArrowDown size={12} />
            {pendingCount === 1 ? "1 mensaje nuevo" : `${pendingCount} mensajes nuevos`}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-400/20 transition-all">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: "96px" }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1.5 px-1">
          Enviando como <span className="font-medium text-gray-400 dark:text-gray-500">{senderName}</span>
        </p>
      </div>
    </div>
  );
}
