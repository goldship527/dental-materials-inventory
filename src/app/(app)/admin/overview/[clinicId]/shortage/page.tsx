import { notFound } from "next/navigation";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOverviewClinicDetail } from "@/lib/db/admin-overview";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
  searchParams?: Promise<{
    q?: string;
  }>;
};

function numberText(value: number, unit = "件") {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

export default async function AdminOverviewClinicShortagePage({ params, searchParams }: PageProps) {
  const context = await requireAdminUser();
  const { clinicId } = await params;
  const selectedParams = (await searchParams) ?? {};
  const query = selectedParams.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const detail = await getAdminOverviewClinicDetail(context.organizationId, clinicId);

  if (!detail) {
    notFound();
  }

  const shortageRows = detail.stockRows
    .filter((row) => row.isShortage)
    .sort(
      (a, b) =>
        Number(b.quantity === 0) - Number(a.quantity === 0) ||
        b.shortageCount - a.shortageCount ||
        a.name.localeCompare(b.name, "ja-JP"),
    );
  const filteredRows = shortageRows.filter((row) => {
    const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer, row.supplierName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / 不足在庫</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{detail.clinic.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。不足している商品だけを本部向けに確認します。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={`/admin/overview/${clinicId}`}
          >
            クリニック詳細へ戻る
          </a>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">不足在庫</p>
            <p className="mt-2 text-3xl font-semibold text-warning">{numberText(shortageRows.length)}</p>
            <p className="mt-2 text-sm text-muted">最低在庫を下回る商品</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">在庫0</p>
            <p className="mt-2 text-3xl font-semibold text-warning">
              {numberText(shortageRows.filter((row) => row.quantity === 0).length)}
            </p>
            <p className="mt-2 text-sm text-muted">手元在庫がない商品</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">不足数合計</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {shortageRows.reduce((total, row) => total + row.shortageCount, 0).toLocaleString("ja-JP")}
            </p>
            <p className="mt-2 text-sm text-muted">最低在庫までの差分</p>
          </div>
        </section>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" action={`/admin/overview/${clinicId}/shortage`}>
            <input
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-accent"
              defaultValue={query}
              name="q"
              placeholder="商品名、商品コード、JAN、カテゴリ、発注先"
              type="search"
            />
            <button
              className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              検索
            </button>
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={`/admin/overview/${clinicId}/shortage`}
            >
              クリア
            </a>
          </form>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4 text-sm text-muted">
            表示 {filteredRows.length} 件 / 不足 {shortageRows.length} 件
            {query ? `（検索: ${query}）` : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">カテゴリ</th>
                  <th className="border-b border-line px-4 py-3">発注先</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">不足数</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.stockItemId} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{row.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode ?? "-"} / JAN {row.janCode ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">{row.supplierName ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right font-semibold">
                      {row.quantity.toLocaleString("ja-JP")}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td className="border-b border-line px-4 py-3 text-right font-semibold text-warning">
                      {row.shortageCount}
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted">
                      条件に合う不足在庫はありません。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
