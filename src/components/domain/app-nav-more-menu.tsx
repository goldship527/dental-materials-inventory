"use client";

import { useRef, type ReactNode } from "react";

export function AppNavMoreMenu({ children }: { children: ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  return (
    <details
      ref={detailsRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          detailsRef.current.open = false;
          summaryRef.current?.focus();
          event.preventDefault();
        }
      }}
    >
      <summary
        ref={summaryRef}
        className="flex h-12 cursor-pointer list-none items-center rounded px-3 text-base font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden"
      >
        その他
      </summary>
      <div className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded border border-line bg-panel p-1 text-ink shadow-sheet">
        {children}
      </div>
    </details>
  );
}
