"use client";

export function OrdersPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 print:hidden"
    >
      印刷
    </button>
  );
}
