"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "info" | "error";

export interface ToastInput {
  variant?: ToastVariant;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastInput, "title">> {
  id: string;
  variant: ToastVariant;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function toastStyles(variant: ToastVariant): { border: string; iconBg: string; iconFg: string } {
  switch (variant) {
    case "success":
      return {
        border: "border-emerald-200 dark:border-emerald-900/40",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/25",
        iconFg: "text-emerald-600 dark:text-emerald-300",
      };
    case "error":
      return {
        border: "border-red-200 dark:border-red-900/40",
        iconBg: "bg-red-50 dark:bg-red-900/25",
        iconFg: "text-red-600 dark:text-red-300",
      };
    default:
      return {
        border: "border-blue-200 dark:border-blue-900/40",
        iconBg: "bg-blue-50 dark:bg-blue-900/25",
        iconFg: "text-blue-600 dark:text-blue-300",
      };
  }
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const styles = toastStyles(variant);
  return (
    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", styles.iconBg)}>
      {variant === "success" ? (
        <svg className={cn("h-5 w-5", styles.iconFg)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 5.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      ) : variant === "error" ? (
        <svg className={cn("h-5 w-5", styles.iconFg)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.53-10.47a.75.75 0 00-1.06-1.06L10 7.94 8.53 6.47a.75.75 0 00-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 101.06 1.06L10 10.06l1.47 1.47a.75.75 0 101.06-1.06L11.06 9l1.47-1.47z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className={cn("h-5 w-5", styles.iconFg)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-4a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 6zm0 3a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 9z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const styles = toastStyles(toast.variant);
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3",
        "transition-all",
        styles.border
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <ToastIcon variant={toast.variant} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{toast.title}</div>
          {toast.description ? (
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{toast.description}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeouts = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const toast: ToastItem = {
        id,
        variant: input.variant ?? "info",
        title: input.title,
        description: input.description,
        durationMs: input.durationMs ?? 3500,
      };
      setToasts((prev) => [toast, ...prev].slice(0, 3));
      const handle = window.setTimeout(() => dismiss(id), toast.durationMs);
      timeouts.current.set(id, handle);
    },
    [dismiss]
  );

  const api: ToastContextValue = useMemo(
    () => ({
      push,
      success: (title, description) => push({ variant: "success", title, description }),
      info: (title, description) => push({ variant: "info", title, description }),
      error: (title, description) => push({ variant: "error", title, description }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-[min(380px,calc(100vw-2rem))] space-y-3">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

