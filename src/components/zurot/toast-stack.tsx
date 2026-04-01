"use client";

export type ToastItem = {
  id: string;
  message: string;
};

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] max-w-[90vw] flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
