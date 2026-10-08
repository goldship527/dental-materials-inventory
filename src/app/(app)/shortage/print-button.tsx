"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-accent px-5 py-3 text-sm font-semibold text-panel transition hover:bg-accentDeep print:hidden"
    >
      印刷
    </button>
  );
}
