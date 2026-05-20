import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStockRows } from "@/lib/db/stock";
import { StocktakeForm } from "./stocktake-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function StocktakePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const rows = await getStockRows(context.clinicId);
  const filteredRows = rows.filter((row) => {
    if (!query) {
      return true;
    }

    return [row.name, row.productCode, row.janCode, row.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">棚卸</h1>
            <p className="mt-2 text-sm text-muted">
              実在庫を入力し、差異を確認してから在庫数を確定します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/home">
            ホームへ戻る
          </a>
        </header>

        <AppNav current="stocktake" />

        <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel sm:grid-cols-[1fr_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・JANコード"
            className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            検索
          </button>
        </form>

        <StocktakeForm rows={filteredRows} />
      </div>
    </main>
  );
}
