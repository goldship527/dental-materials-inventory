"use client";

export function OrdersPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded btn-primary px-3 text-xs font-semibold transition print:hidden"
    >
      印刷
    </button>
  );
}
