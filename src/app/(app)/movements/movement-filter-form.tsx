"use client";

type MovementFilterFormProps = {
  defaultQuery: string;
  defaultType: string;
  defaultSource: string;
  defaultStartDate: string;
  defaultEndDate: string;
  exportHref: string;
};

const typeOptions = [
  { value: "", label: "すべての区分" },
  { value: "IN", label: "入庫" },
  { value: "OUT", label: "出庫" },
  { value: "ADJUST", label: "調整" },
];

const sourceOptions = [
  { value: "", label: "すべての操作元" },
  { value: "ORDER_RECEIPT", label: "納品確認" },
  { value: "ORDER_RECEIPT_REVERT", label: "納品確認取り消し" },
  { value: "MANUAL", label: "在庫一覧" },
  { value: "QUICK_CARD", label: "クイック出庫" },
  { value: "BARCODE_STOCK", label: "バーコード出入庫" },
  { value: "STOCKTAKE", label: "棚卸" },
  { value: "STOCKTAKE_SESSION", label: "棚卸セッション" },
  { value: "REVERT", label: "履歴取り消し" },
];

export function MovementFilterForm({
  defaultQuery,
  defaultType,
  defaultSource,
  defaultStartDate,
  defaultEndDate,
  exportHref,
}: MovementFilterFormProps) {
  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel lg:grid-cols-[1fr_140px_170px_145px_145px_auto_auto_auto]">
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="商品名・コード・カテゴリ・理由メモ・操作者"
        className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <select
        name="type"
        defaultValue={defaultType}
        className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        name="source"
        defaultValue={defaultSource}
        className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        {sourceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="startDate"
        defaultValue={defaultStartDate}
        aria-label="開始日"
        title="開始日"
        className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <input
        type="date"
        name="endDate"
        defaultValue={defaultEndDate}
        aria-label="終了日"
        title="終了日"
        className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="submit"
        className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        絞り込み
      </button>
      <a
        className="flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        href="/movements"
      >
        クリア
      </a>
      <a
        className="flex h-11 items-center justify-center rounded border border-accent/30 bg-teal-50 px-5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-white"
        href={exportHref}
      >
        CSV出力
      </a>
    </form>
  );
}
