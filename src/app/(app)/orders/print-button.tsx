"use client";

export function OrdersPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accentDeep print:hidden"
    >
      印刷
    </button>
  );
}
