"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  count: number;
  className: string;
  headerClassName: string;
  foldInitially: boolean;
  action?: ReactNode;
  children: ReactNode;
};

export function OrderStatusBlock({
  title, description, count, className, headerClassName, foldInitially, action, children,
}: Props) {
  const [open, setOpen] = useState(!foldInitially);

  useEffect(() => setOpen(!foldInitially), [foldInitially]);
  const isOpen = !foldInitially || open;

  return (
    <section className={`overflow-hidden rounded border bg-panel print:break-inside-avoid print:rounded-none print:border-ink ${className}`}>
      <div className={`flex flex-col gap-2 border-b border-line px-3 py-2 text-sm lg:flex-row lg:items-start lg:justify-between print:border-ink print:bg-panel print:px-2 print:py-1.5 print:text-xs ${headerClassName}`}>
        <div>
          {foldInitially ? (
            <>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((value) => !value)}
                className="min-h-10 text-left text-sm font-semibold text-accent print:hidden">
                {title} {count}件（{isOpen ? "閉じる" : "開く"}）
              </button>
              <h3 className="hidden font-semibold print:block">{title} <span>{count} 件</span></h3>
            </>
          ) : <h3 className="font-semibold">{title}</h3>}
          <p className={isOpen ? "mt-0.5 text-xs text-muted print:text-ink" : "hidden print:block print:text-ink"}>{description}</p>
        </div>
        {!foldInitially ? (
          <div className="flex flex-wrap items-start justify-end gap-2">
            <span className="rounded border border-line bg-panel/80 px-2 py-1 text-xs font-semibold text-muted print:border-ink print:text-ink">
              {count} 件
            </span>
            {action}
          </div>
        ) : null}
      </div>
      <div className={isOpen ? "block" : "hidden print:block"}>{children}</div>
    </section>
  );
}
