"use client";

type SupplierFilterFormProps = {
  defaultQuery: string;
  shortageOnly: boolean;
  hasOrderRequestOnly: boolean;
};

export function SupplierFilterForm({
  defaultQuery,
  shortageOnly,
  hasOrderRequestOnly,
}: SupplierFilterFormProps) {
  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_auto_auto_auto_auto]">
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="発注先名・カテゴリ・商品名"
        className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <label className="flex h-11 items-center gap-2 rounded border border-line px-3 text-sm">
        <input type="checkbox" name="shortage" value="1" defaultChecked={shortageOnly} />
        不足あり
      </label>
      <label className="flex h-11 items-center gap-2 rounded border border-line px-3 text-sm">
        <input type="checkbox" name="orders" value="1" defaultChecked={hasOrderRequestOnly} />
        候補あり
      </label>
      <button
        type="submit"
        className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        絞り込み
      </button>
      <a
        className="flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        href="/suppliers"
      >
        クリア
      </a>
    </form>
  );
}
