import { useCallback, useEffect, useRef, useState } from "react";

type ToastTone = "default" | "success" | "error";

/**
 * Tiny local toast hook.
 *   const { toast, Toast } = useToast();
 *   toast("Saved!", "success");
 *   return <>{Toast}...</>;
 */
export function useToast(duration = 3200) {
  const [state, setState] = useState<{ msg: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (msg: string, tone: ToastTone = "default") => {
      if (timer.current) clearTimeout(timer.current);
      setState({ msg, tone });
      timer.current = setTimeout(() => setState(null), duration);
    },
    [duration]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const toneClass =
    state?.tone === "success"
      ? "bg-emerald-600"
      : state?.tone === "error"
        ? "bg-rose-600"
        : "bg-text";

  const Toast = state ? (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] animate-[fadeIn_200ms_ease-out] px-4 w-full max-w-md">
      <div
        role="status"
        className={`px-5 py-3 ${toneClass} text-white text-sm font-medium rounded-xl shadow-lg text-center`}
      >
        {state.msg}
      </div>
    </div>
  ) : null;

  return { toast, Toast };
}
