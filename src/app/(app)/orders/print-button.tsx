"use client";

export function OrdersPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentDeep print:hidden"
    >
      印刷
    </button>
  );
}
