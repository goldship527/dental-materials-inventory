"use client";

export function BarcodePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 print:hidden"
    >
      印刷
    </button>
  );
}
