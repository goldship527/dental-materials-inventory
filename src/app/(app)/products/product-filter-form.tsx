"use client";

type ProductFilterFormProps = {
  categories: string[];
  defaultQuery: string;
  defaultCategory: string;
  attachBarcode?: string;
};

export function ProductFilterForm({ categories, defaultQuery, defaultCategory, attachBarcode = "" }: ProductFilterFormProps) {
  const clearHref = attachBarcode ? `/products?attachBarcode=${encodeURIComponent(attachBarcode)}` : "/products";

  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_220px_auto_auto]">
      {attachBarcode ? <input type="hidden" name="attachBarcode" value={attachBarcode} /> : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="商品名・商品コード・JAN・バーコード・発注先"
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
      <button
        type="submit"
        className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        絞り込み
      </button>
      <a
        className="flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        href={clearHref}
      >
        クリア
      </a>
    </form>
  );
}
