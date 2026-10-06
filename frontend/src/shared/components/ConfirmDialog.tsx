import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger" | "success";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ open, title, body, confirmLabel, tone = "primary", busy, onConfirm, onClose }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const toneCls =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
        : "bg-primary hover:bg-primary-dark shadow-primary/25";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-sm bg-surface rounded-3xl shadow-2xl p-6 animate-slide-up">
        <h2 id="confirm-title" className="text-lg font-bold text-text mb-2">{title}</h2>
        <div className="text-sm text-text-secondary mb-6">{body}</div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-bg transition-colors cursor-pointer disabled:opacity-50"
          >
            Not now
          </button>
          <button
            ref={confirmRef}
            id="confirm-dialog-confirm"
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-60 ${toneCls}`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
