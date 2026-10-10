"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type OrderNoticeContextValue = { show: (message: string) => void };

const OrderNoticeContext = createContext<OrderNoticeContextValue | null>(null);

export function OrderNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setMessage("");
  }, []);

  const show = useCallback((nextMessage: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(nextMessage);
    timeoutRef.current = setTimeout(() => {
      setMessage("");
      timeoutRef.current = null;
    }, 6000);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <OrderNoticeContext.Provider value={{ show }}>
      {children}
      <div role="status" aria-live="polite" className="print:hidden">
        {message ? (
          <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 items-center justify-between gap-3 rounded border border-line border-l-4 border-l-success bg-panel px-3 py-2 text-sm text-ink">
            <span>✓ {message}</span>
            <button type="button" onClick={dismiss} className="min-h-10 shrink-0 px-2 text-sm text-accent underline">
              閉じる
            </button>
          </div>
        ) : null}
      </div>
    </OrderNoticeContext.Provider>
  );
}

export function useOrderNotice() {
  const context = useContext(OrderNoticeContext);
  if (!context) throw new Error("OrderNoticeProvider is required");
  return context;
}
