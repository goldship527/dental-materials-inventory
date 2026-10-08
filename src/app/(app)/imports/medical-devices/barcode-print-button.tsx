"use client";

export function BarcodePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-accent px-4 py-2 text-sm font-semibold text-panel transition hover:bg-accentDeep print:hidden"
    >
      印刷
    </button>
  );
}
