"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded btn-primary px-5 py-3 text-sm font-semibold transition print:hidden"
    >
      印刷
    </button>
  );
}
