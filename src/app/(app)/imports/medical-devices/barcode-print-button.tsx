"use client";

export function BarcodePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded btn-primary px-4 py-2 text-sm font-semibold transition print:hidden"
    >
      印刷
    </button>
  );
}
