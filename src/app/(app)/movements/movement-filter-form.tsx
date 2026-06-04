"use client";

type MovementFilterFormProps = {
  categories: string[];
  defaultQuery: string;
  defaultType: string;
  defaultSource: string;
  defaultCategory: string;
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

typeOptions.push(
  { value: "START_USE", label: "使用開始" },
  { value: "END_USE", label: "使用終了" },
  { value: "DISCARD", label: "廃棄" },
);

sourceOptions.push({ value: "STOCK_USAGE", label: "使用中管理" });

export function MovementFilterForm({
  categories,
  defaultQuery,
  defaultType,
  defaultSource,
  defaultCategory,
  defaultStartDate,
  defaultEndDate,
  exportHref,
}: MovementFilterFormProps) {
  function buildCategoryHref(category: string) {
    const params = new URLSearchParams();

    if (defaultQuery) {
      params.set("q", defaultQuery);
    }

    if (defaultType) {
      params.set("type", defaultType);
    }

    if (defaultSource) {
      params.set("source", defaultSource);
    }

    if (defaultStartDate) {
      params.set("startDate", defaultStartDate);
    }

    if (defaultEndDate) {
      params.set("endDate", defaultEndDate);
    }

    if (category) {
      params.set("category", category);
    }

    const queryString = params.toString();

    return queryString ? `/movements?${queryString}` : "/movements";
  }

  return (
    <section className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel">
      <form className="grid gap-3 lg:grid-cols-[1fr_140px_170px_145px_145px_auto_auto_auto]">
        {defaultCategory ? <input type="hidden" name="category" value={defaultCategory} /> : null}
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
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <a
          href={buildCategoryHref("")}
          aria-current={defaultCategory === "" ? "page" : undefined}
          className={
            defaultCategory === ""
              ? "inline-flex min-h-9 items-center rounded border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-white"
              : "inline-flex min-h-9 items-center rounded border border-line bg-white/75 px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          }
        >
          すべて
        </a>
        {categories.map((category) => {
          const isCurrent = defaultCategory === category;

          return (
            <a
              key={category}
              href={buildCategoryHref(category)}
              aria-current={isCurrent ? "page" : undefined}
              className={
                isCurrent
                  ? "inline-flex min-h-9 items-center rounded border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-white"
                  : "inline-flex min-h-9 items-center rounded border border-line bg-white/75 px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              }
            >
              {category}
            </a>
          );
        })}
      </div>
    </section>
  );
}
