"use client";

type ProductFilterFormProps = {
  categories: string[];
  defaultQuery: string;
  defaultCategory: string;
  attachBarcode?: string;
  source?: string;
  setup?: string;
};

export function ProductFilterForm({
  categories,
  defaultQuery,
  defaultCategory,
  attachBarcode = "",
  source = "",
  setup = "",
}: ProductFilterFormProps) {
  const clearParams = new URLSearchParams();

  if (attachBarcode) {
    clearParams.set("attachBarcode", attachBarcode);
  }

  if (source) {
    clearParams.set("source", source);
  }

  if (setup) {
    clearParams.set("setup", setup);
  }

  const clearHref = clearParams.size > 0 ? `/products?${clearParams.toString()}` : "/products";

  function buildCategoryHref(category: string) {
    const params = new URLSearchParams();

    if (defaultQuery) {
      params.set("q", defaultQuery);
    }

    if (category) {
      params.set("category", category);
    }

    if (attachBarcode) {
      params.set("attachBarcode", attachBarcode);
    }

    if (source) {
      params.set("source", source);
    }

    if (setup) {
      params.set("setup", setup);
    }

    const queryString = params.toString();

    return queryString ? `/products?${queryString}` : "/products";
  }

  return (
    <section className="grid gap-3 rounded border border-line bg-panel p-4 shadow-sheet">
      <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        {attachBarcode ? <input type="hidden" name="attachBarcode" value={attachBarcode} /> : null}
        {source ? <input type="hidden" name="source" value={source} /> : null}
        {setup ? <input type="hidden" name="setup" value={setup} /> : null}
        {defaultCategory ? <input type="hidden" name="category" value={defaultCategory} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="商品名・商品コード・JAN・バーコード・発注先"
          className="h-11 rounded border border-line px-3 text-sm    "
        />
        <button
          type="submit"
          className="h-11 rounded btn-primary px-5 text-sm font-semibold transition"
        >
          絞り込み
        </button>
        <a
          className="flex h-11 items-center justify-center rounded btn-secondary px-5 text-sm font-semibold transition"
          href={clearHref}
        >
          クリア
        </a>
      </form>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <a
          href={buildCategoryHref("")}
          aria-current={defaultCategory === "" ? "page" : undefined}
          className={
            defaultCategory === ""
              ? "inline-flex min-h-9 items-center rounded border chip-selected px-3 py-1.5 text-sm font-semibold"
              : "inline-flex min-h-9 items-center rounded btn-secondary px-3 py-1.5 text-sm font-semibold transition"
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
                  ? "inline-flex min-h-9 items-center rounded border chip-selected px-3 py-1.5 text-sm font-semibold"
                  : "inline-flex min-h-9 items-center rounded btn-secondary px-3 py-1.5 text-sm font-semibold transition"
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
