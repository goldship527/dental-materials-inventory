"use client";

type MovementFilterFormProps = {
  defaultQuery: string;
  defaultType: string;
  defaultSource: string;
};

const typeOptions = [
  { value: "", label: "すべての区分" },
  { value: "IN", label: "入庫" },
  { value: "OUT", label: "出庫" },
  { value: "ADJUST", label: "調整" },
];

const sourceOptions = [
  { value: "", label: "すべての操作元" },
  { value: "MANUAL", label: "在庫一覧" },
  { value: "QUICK_CARD", label: "よく使うカード" },
  { value: "STOCKTAKE", label: "棚卸" },
  { value: "STOCKTAKE_SESSION", label: "棚卸セッション" },
  { value: "REVERT", label: "履歴取り消し" },
];

export function MovementFilterForm({ defaultQuery, defaultType, defaultSource }: MovementFilterFormProps) {
  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel lg:grid-cols-[1fr_180px_200px_auto_auto]">
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
    </form>
  );
}
