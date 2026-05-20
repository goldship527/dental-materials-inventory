"use client";

import { useEffect, useRef } from "react";

type BarcodeSearchFormProps = {
  defaultBarcode: string;
  actionPath?: string;
  clearHref?: string;
};

export function BarcodeSearchForm({ defaultBarcode, actionPath = "/barcode", clearHref = "/barcode" }: BarcodeSearchFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [defaultBarcode]);

  return (
    <form
      method="get"
      action={actionPath}
      className="rounded border border-line bg-white p-5 shadow-panel"
    >
      <label className="grid gap-2 text-sm font-semibold text-muted">
        バーコード
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            ref={inputRef}
            type="search"
            name="barcode"
            defaultValue={defaultBarcode}
            placeholder="JAN / GTIN / バーコード"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-12 rounded border border-line px-4 font-mono text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="h-12 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            検索
          </button>
          <a
            className="flex h-12 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={clearHref}
          >
            クリア
          </a>
        </div>
      </label>
    </form>
  );
}
