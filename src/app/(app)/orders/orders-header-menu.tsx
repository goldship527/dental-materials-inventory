"use client";

import { useEffect, useId, useRef, useState } from "react";

export function OrdersHeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeMenu() {
      setIsOpen(false);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        event.preventDefault();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function closeAfterSelection() {
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative sm:hidden print:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-10 items-center rounded btn-secondary px-3 text-sm font-semibold transition"
      >
        関連ページ・印刷
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-40 mt-1 w-48 max-w-[calc(100vw-24px)] overflow-hidden rounded border border-line bg-panel text-ink shadow-sheet"
        >
          <a href="/shortage" onClick={closeAfterSelection} className="flex min-h-12 items-center border-b border-line px-3 text-sm font-semibold text-accent">
            不足一覧へ
          </a>
          <a href="/orders/print" onClick={closeAfterSelection} className="flex min-h-12 items-center border-b border-line px-3 text-sm font-semibold text-accent">
            発注書下書き
          </a>
          <a href="/order-records" onClick={closeAfterSelection} className="flex min-h-12 items-center border-b border-line px-3 text-sm font-semibold text-accent">
            発注記録
          </a>
          <button
            type="button"
            onClick={() => {
              closeAfterSelection();
              window.print();
            }}
            className="flex min-h-12 w-full items-center px-3 text-left text-sm font-semibold text-accent"
          >
            印刷
          </button>
        </div>
      ) : null}
    </div>
  );
}
