import React, { useCallback } from 'react';
import { create } from 'zustand';
import { AlertTriangle, Trash2, X } from 'lucide-react';

// ─── Store ────────────────────────────────────────────────────────────────────

interface ConfirmState {
  open: boolean;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: ((confirmed: boolean) => void) | null;
  show: (opts: { message: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>;
  close: (confirmed: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  message: '',
  confirmLabel: 'Confirm',
  destructive: false,
  resolve: null,
  show: ({ message, confirmLabel = 'Confirm', destructive = false }) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, message, confirmLabel, destructive, resolve });
    }),
  close: (confirmed) => {
    get().resolve?.(confirmed);
    set({ open: false, resolve: null });
  },
}));

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a `confirm(opts)` function that shows a styled confirm modal.
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ message: 'Delete this item?', destructive: true });
 */
export const useConfirm = () => {
  const show = useConfirmStore((s) => s.show);
  return useCallback(
    (opts: { message: string; confirmLabel?: string; destructive?: boolean }) => show(opts),
    [show]
  );
};

// ─── Global modal component (mount once at root) ───────────────────────────────

export const ConfirmModal: React.FC = () => {
  const { open, message, confirmLabel, destructive, close } = useConfirmStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => close(false)}
      />

      {/* Dialog */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[scaleIn_0.15s_ease-out]">
        {/* Close button */}
        <button
          onClick={() => close(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          destructive ? 'bg-red-500/20' : 'bg-amber-500/20'
        }`}>
          {destructive
            ? <Trash2 size={22} className="text-red-400" />
            : <AlertTriangle size={22} className="text-amber-400" />
          }
        </div>

        {/* Message */}
        <p className="text-white font-medium leading-relaxed mb-6 pr-4">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => close(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
