import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastVariant = "loading" | "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => number;
  update: (id: number, patch: Partial<Omit<ToastItem, "id">>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", duration?: number) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      if (duration && variant !== "loading") {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback((id: number, patch: Partial<Omit<ToastItem, "id">>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (patch.duration && patch.variant !== "loading") {
      setTimeout(() => dismiss(id), patch.duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show, update, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const palette: Record<ToastVariant, { ring: string; icon: React.ReactNode }> = {
    loading: {
      ring: "ring-1 ring-[#373737]",
      icon: <Loader2 className="w-4 h-4 text-[#c9f352] animate-spin" />,
    },
    success: {
      ring: "ring-1 ring-[#00a888]/40",
      icon: <CheckCircle2 className="w-4 h-4 text-[#00a888]" />,
    },
    error: {
      ring: "ring-1 ring-[#e40000]/40",
      icon: <AlertCircle className="w-4 h-4 text-[#e40000]" />,
    },
    info: {
      ring: "ring-1 ring-[#373737]",
      icon: <CheckCircle2 className="w-4 h-4 text-[#cacaca]" />,
    },
  };

  const p = palette[toast.variant];

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-[380px] px-4 py-3 rounded-[10px] backdrop-blur-[37.65px] bg-[rgba(14,11,20,0.92)] ${p.ring} shadow-lg transform transition-all duration-200 ${
        enter ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="shrink-0">{p.icon}</div>
      <p className="flex-1 text-[13px] text-white leading-snug">{toast.message}</p>
      {toast.variant !== "loading" && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-[#9898a8] hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
