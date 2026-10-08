"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function AppNavMoreMenu({ children }: { children: ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  return (
    <details
      ref={detailsRef}
      className="relative shrink-0"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
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
        className="flex h-12 cursor-pointer list-none items-center rounded px-3 text-base font-semibold text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden"
      >
        その他
      </summary>
      <div className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded border border-line bg-panel p-1 text-ink shadow-sheet">
        {children}
      </div>
    </details>
  );
}
