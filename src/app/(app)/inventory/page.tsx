import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getCategories, getStockRows } from "@/lib/db/stock";
import { InventoryAdjustForm } from "./inventory-adjust-form";
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
  const [rows, categories] = await Promise.all([
    getStockRows(context.clinicId),
    getCategories(context.clinicId),
  ]);

  const filteredRows = rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = query ? searchText.includes(query.toLowerCase()) : true;
    const matchesCategory = category ? row.category === category : true;
    const matchesShortage = shortageOnly ? row.quantity <= row.minStock : true;

    return matchesQuery && matchesCategory && matchesShortage;
  });

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">在庫一覧</h1>
            <p className="mt-2 text-sm text-muted">
              全商品の現在庫を確認し、理由メモ付きで数量を直接編集できます。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/home">
            ホームへ戻る
          </a>
        </header>

        <AppNav current="inventory" />

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
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td className="border-b border-line px-4 py-3">
                      {row.quantity <= row.minStock ? (
                        <span className="rounded bg-yellow-50 px-2 py-1 text-xs font-semibold text-warning">
                          不足
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-accent">
                          十分
                        </span>
                      )}
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">
                      <InventoryAdjustForm stockItemId={row.stockItemId} quantity={row.quantity} />
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
