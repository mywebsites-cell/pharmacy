import React, { useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (item: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (item) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [...state.toasts, { ...item, id }] }));
    return id;
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// ─── Static helpers ───────────────────────────────────────────────────────────

export const toast = {
  success: (message: string, duration = 4000) =>
    useToastStore.getState().add({ type: 'success', message, duration }),
  error: (message: string, duration = 5000) =>
    useToastStore.getState().add({ type: 'error', message, duration }),
  warning: (message: string, duration = 4500) =>
    useToastStore.getState().add({ type: 'warning', message, duration }),
  info: (message: string, duration = 4000) =>
    useToastStore.getState().add({ type: 'info', message, duration }),
};

// ─── Individual toast item ────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: ({ className }) => <CheckCircle2 className={className} size={18} />,
  error:   ({ className }) => <XCircle      className={className} size={18} />,
  warning: ({ className }) => <AlertTriangle className={className} size={18} />,
  info:    ({ className }) => <Info          className={className} size={18} />,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-900/95 border-emerald-500/40 text-emerald-100',
  error:   'bg-red-900/95     border-red-500/40     text-red-100',
  warning: 'bg-amber-900/95  border-amber-500/40   text-amber-100',
  info:    'bg-blue-900/95   border-blue-500/40    text-blue-100',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  warning: 'text-amber-400',
  info:    'text-blue-400',
};

const ToastItem: React.FC<{ toast: ToastItem }> = ({ toast: t }) => {
  const remove = useToastStore((s) => s.remove);
  const Icon = ICONS[t.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, remove]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm
        min-w-[280px] max-w-[420px] text-sm font-medium
        animate-[slideInRight_0.25s_ease-out]
        ${STYLES[t.type]}
      `}
      style={{ wordBreak: 'break-word' }}
    >
      <Icon className={`flex-shrink-0 mt-0.5 ${ICON_STYLES[t.type]}`} />
      <span className="flex-1 leading-snug">{t.message}</span>
      <button
        onClick={() => remove(t.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ─── Container ────────────────────────────────────────────────────────────────

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
};
