import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getSupplierMasterRows } from "@/lib/db/suppliers";
import { SupplierFilterForm } from "./supplier-filter-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    shortage?: string;
    orders?: string;
  }>;
};

export default async function SuppliersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const canManageSuppliers = isAdminRole(session.user.role);
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const shortageOnly = params.shortage === "1";
  const hasOrderRequestOnly = params.orders === "1";
  const rows = await getSupplierMasterRows(context.organizationId, context.clinicId);
  const normalizedQuery = query.toLowerCase();
  const filteredRows = rows.filter((row) => {
    const orderRequestTotal =
      row.orderRequestCounts.DRAFT +
      row.orderRequestCounts.CONFIRMED +
      row.orderRequestCounts.ORDERED +
      row.orderRequestCounts.SKIPPED;
    const searchText = [row.name, ...row.categories, ...row.sampleProductNames].join(" ").toLowerCase();
    const matchesQuery = normalizedQuery ? searchText.includes(normalizedQuery) : true;
    const matchesShortage = shortageOnly ? row.shortageProductCount > 0 : true;
    const matchesOrderRequest = hasOrderRequestOnly ? orderRequestTotal > 0 : true;

    return matchesQuery && matchesShortage && matchesOrderRequest;
  });
  const filterLabel = [
    query ? `検索: ${query}` : "",
    shortageOnly ? "不足あり" : "",
    hasOrderRequestOnly ? "候補あり" : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="suppliers" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">発注先マスタ</h1>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
            {canManageSuppliers ? (
              <>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                  href="/suppliers/new"
                >
                  発注先を新規作成
                </a>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  href="/suppliers/import"
                >
                  発注先を一括取り込み
                </a>
              </>
            ) : null}
            <a className="inline-flex min-h-11 items-center justify-center rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent" href="/home">
              ホームへ戻る
            </a>
          </div>
        </header>


        <SupplierFilterForm
          defaultQuery={query}
          shortageOnly={shortageOnly}
          hasOrderRequestOnly={hasOrderRequestOnly}
        />

        <section className="rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel">
          表示 {filteredRows.length} 件 / 全 {rows.length} 件
          {filterLabel ? `（${filterLabel}）` : ""}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {filteredRows.length > 0 ? (
            filteredRows.map((row) => {
              const orderRequestTotal =
                row.orderRequestCounts.DRAFT +
                row.orderRequestCounts.CONFIRMED +
                row.orderRequestCounts.ORDERED +
                row.orderRequestCounts.SKIPPED;
              const plannedOrderRequestCount = row.orderRequestCounts.DRAFT + row.orderRequestCounts.CONFIRMED;

              return (
                <article key={row.id} className="rounded border border-line bg-white p-5 shadow-panel">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <a className="text-xl font-semibold text-accent hover:underline" href={`/suppliers/${row.id}`}>
                        {row.name}
                      </a>
                      <p className="mt-2 text-sm text-muted">
                        取扱商品 {row.productCount} 件 / 不足あり {row.shortageProductCount} 件
                      </p>
                    </div>
                    <div className="rounded bg-gray-50 px-3 py-2 text-sm text-muted">
                      発注候補 {orderRequestTotal} 件
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded border border-line px-3 py-2">
                      <p className="text-xs font-semibold text-muted">発注予定</p>
                      <p className="mt-1 text-2xl font-semibold">{plannedOrderRequestCount}</p>
                    </div>
                    <div className="rounded border border-line px-3 py-2">
                      <p className="text-xs font-semibold text-accent">発注記録あり</p>
                      <p className="mt-1 text-2xl font-semibold text-accent">{row.orderRequestCounts.ORDERED}</p>
                    </div>
                    <div className="rounded border border-line px-3 py-2">
                      <p className="text-xs font-semibold text-muted">見送り</p>
                      <p className="mt-1 text-2xl font-semibold text-muted">{row.orderRequestCounts.SKIPPED}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold text-muted">連絡先</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      電話 {row.phone ?? "-"} / FAX {row.fax ?? "-"} / メール {row.email ?? "-"}
                    </p>
                    {row.contactPersonName ? (
                      <p className="mt-1 text-sm text-muted">担当: {row.contactPersonName}</p>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold text-muted">主なカテゴリ</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.categories.length > 0 ? (
                        row.categories.map((category) => (
                          <span key={category} className="rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted">
                            {category}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted">カテゴリ未設定</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold text-muted">主な商品</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {row.sampleProductNames.length > 0 ? row.sampleProductNames.join("、") : "商品はありません。"}
                    </p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-muted shadow-panel lg:col-span-2">
              条件に一致する発注先はありません。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
