"use client";

type InventoryFilterFormProps = {
  categories: string[];
  defaultQuery: string;
  defaultCategory: string;
  defaultShortageOnly: boolean;
};

function buildCategoryHref(category: string, query: string, shortageOnly: boolean) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (category) {
    params.set("category", category);
  }

  if (shortageOnly) {
    params.set("shortage", "1");
  }

  const queryString = params.toString();
  return queryString ? `/inventory?${queryString}` : "/inventory";
}

function categoryButtonClass(isCurrent: boolean) {
  return isCurrent
    ? "inline-flex min-h-10 items-center rounded border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm"
    : "inline-flex min-h-10 items-center rounded border border-line bg-white px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent/50 hover:bg-subtle hover:text-ink";
}

export function InventoryFilterForm({
  categories,
  defaultQuery,
  defaultCategory,
  defaultShortageOnly,
}: InventoryFilterFormProps) {
  return (
    <section className="rounded border border-line bg-white p-4 shadow-panel">
      <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="商品名・商品コード・JANコード"
          className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {defaultCategory ? <input type="hidden" name="category" value={defaultCategory} /> : null}
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

      <div className="mt-3 flex flex-wrap gap-2" aria-label="カテゴリ">
        <a
          href={buildCategoryHref("", defaultQuery, defaultShortageOnly)}
          aria-current={defaultCategory === "" ? "page" : undefined}
          className={categoryButtonClass(defaultCategory === "")}
        >
          すべて
        </a>
        {categories.map((category) => (
          <a
            key={category}
            href={buildCategoryHref(category, defaultQuery, defaultShortageOnly)}
            aria-current={defaultCategory === category ? "page" : undefined}
            className={categoryButtonClass(defaultCategory === category)}
          >
            {category}
          </a>
        ))}
      </div>
    </section>
  );
}
