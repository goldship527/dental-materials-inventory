"use client";

type InventoryFilterFormProps = {
  categories: string[];
  defaultQuery: string;
  defaultCategory: string;
  defaultShortageOnly: boolean;
};

export function InventoryFilterForm({
  categories,
  defaultQuery,
  defaultCategory,
  defaultShortageOnly,
}: InventoryFilterFormProps) {
  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_220px_auto_auto]">
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="商品名・商品コード・JANコード"
        className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <select
        name="category"
        defaultValue={defaultCategory}
        className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        <option value="">すべてのカテゴリ</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <label className="flex h-11 items-center gap-2 rounded border border-line px-3 text-sm">
        <input type="checkbox" name="shortage" value="1" defaultChecked={defaultShortageOnly} />
        不足のみ
      </label>
      <button
        type="submit"
        className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        絞り込み
      </button>
    </form>
  );
}
