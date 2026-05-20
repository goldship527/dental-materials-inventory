"use client";

import { useEffect, useRef } from "react";

type BarcodeSearchFormProps = {
  defaultBarcode: string;
};

export function BarcodeSearchForm({ defaultBarcode }: BarcodeSearchFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [defaultBarcode]);

  return (
    <form
      method="get"
      action="/barcode"
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
            placeholder="スキャナーで読み取り、またはJAN/GTINを入力"
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
            href="/barcode"
          >
            クリア
          </a>
        </div>
      </label>
      <p className="mt-3 text-xs text-muted">
        多くのバーコードスキャナーはキーボード入力として動きます。JANの後ろに読み取り日時が付く場合も、JANと日時を分けて扱います。
      </p>
    </form>
  );
}
