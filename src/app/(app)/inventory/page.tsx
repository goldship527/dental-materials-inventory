import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { getCategories, getStockRows } from "@/lib/db/stock";
import { InventoryAdjustCell } from "./inventory-adjust-cell";
import { InventoryFilterForm } from "./inventory-filter-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    shortage?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const shortageOnly = params.shortage === "1";
  const [rows, categories, staffOperators] = await Promise.all([
    getStockRows(context.clinicId),
    getCategories(context.clinicId),
    getActiveStaffOperatorOptionsForClinic({
      organizationId: context.organizationId,
      clinicId: context.clinicId,
    }),
  ]);

  const filteredRows = rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = query ? searchText.includes(query.toLowerCase()) : true;
    const matchesCategory = category ? row.category === category : true;
    const matchesShortage = shortageOnly ? row.isShortage : true;

    return matchesQuery && matchesCategory && matchesShortage;
  });

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="inventory" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">在庫一覧</h1>
          </div>
          <a className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent" href="/home">
            ホームへ戻る
          </a>
        </header>


        <InventoryFilterForm
          categories={categories}
          defaultQuery={query}
          defaultCategory={category}
          defaultShortageOnly={shortageOnly}
        />

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            表示 {filteredRows.length} 件 / 全 {rows.length} 件
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">カテゴリ</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3">ステータス</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                  <th className="border-b border-line px-4 py-3">数量編集</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.stockItemId} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
                        {row.name}
                      </a>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode} / JAN {row.janCode ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">
                      {row.quantity}
                      {row.stockUsageMode === "IN_USE" ? (
                        <span className="mt-1 block text-xs font-semibold text-muted">
                          使用中 {row.inUseQuantity} / 総数 {row.totalQuantity} / 廃棄済み累計 {row.discardedQuantity}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td className="border-b border-line px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${row.stockStatusClassName}`}>
                        {row.stockStatusLabel}
                      </span>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">
                      <InventoryAdjustCell
                        stockItemId={row.stockItemId}
                        quantity={row.quantity}
                        stockUpdatedAt={row.stockUpdatedAt}
                        staffOperators={staffOperators}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
