"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  count: number;
  className: string;
  headerClassName: string;
  step?: 2 | 3;
  nextAction?: string;
  foldInitially: boolean;
  action?: ReactNode;
  children: ReactNode;
};

export function OrderStatusBlock({
  title, description, count, className, headerClassName, step, nextAction, foldInitially, action, children,
}: Props) {
  const [open, setOpen] = useState(!foldInitially);

  useEffect(() => setOpen(!foldInitially), [foldInitially]);
  const isOpen = !foldInitially || open;

  return (
    <section className={`overflow-hidden rounded border bg-panel print:break-inside-avoid print:rounded-none print:border-ink ${className}`}>
      <div className={`flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between print:border-ink print:bg-panel print:px-2 print:py-1.5 print:text-xs ${headerClassName}`}>
        <div className="flex min-w-0 items-start gap-3">
          {step ? (
            <span aria-hidden="true" className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold print:hidden ${step === 2 ? "bg-accent text-panel" : "border-2 border-ink bg-panel text-ink"}`}>
              {step}
            </span>
          ) : null}
          <div className="min-w-0">
            {foldInitially ? (
              <>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen((value) => !value)}
                  className="min-h-10 text-left text-base font-semibold text-accent print:hidden">
                  {title} {count}件（{isOpen ? "閉じる" : "開く"}）
                </button>
                <h3 className="hidden font-semibold print:block">{title} <span>{count} 件</span></h3>
              </>
            ) : (
              <h3 className={`flex flex-wrap items-center gap-2 font-bold print:text-xs ${step ? "text-lg text-ink" : "text-base text-muted"}`}>
                {title}
                <span className="rounded border border-line bg-panel/80 px-2 py-0.5 text-label font-semibold text-muted print:border-ink print:text-ink">{count} 件</span>
              </h3>
            )}
            {nextAction ? <p className="mt-0.5 text-sm text-ink print:hidden">{nextAction}</p> : null}
            <p className="hidden print:block print:text-ink">{description}</p>
          </div>
        </div>
        {!foldInitially ? (
          <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto sm:justify-end">
            {action}
          </div>
        ) : null}
      </div>
      <div className={isOpen ? "block" : "hidden print:block"}>{children}</div>
    </section>
  );
}
