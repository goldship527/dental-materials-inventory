import { PageHeader } from "@/components/ui/page-header";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell current="overview" mainClassName="mx-auto grid w-full max-w-7xl gap-3 pt-3 pb-6">
        <PageHeader title={detail.clinic.name}>
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / 不足在庫</p>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。不足している商品だけを本部向けに確認します。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded btn-secondary px-4 text-sm font-semibold transition"
            href={`/admin/overview/${clinicId}`}
          >
            クリニック詳細へ戻る
          </a>
        </PageHeader>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-line bg-panel p-3 shadow-sheet">
            <p className="text-sm font-semibold text-muted">不足在庫</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{numberText(shortageRows.length)}</p>
            <p className="mt-2 text-sm text-muted">最低在庫を下回る商品</p>
          </div>
          <div className="rounded border border-line bg-panel p-3 shadow-sheet">
            <p className="text-sm font-semibold text-muted">在庫0</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {numberText(shortageRows.filter((row) => row.quantity === 0).length)}
            </p>
            <p className="mt-2 text-sm text-muted">手元在庫がない商品</p>
          </div>
          <div className="rounded border border-line bg-panel p-3 shadow-sheet">
            <p className="text-sm font-semibold text-muted">不足数合計</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {shortageRows.reduce((total, row) => total + row.shortageCount, 0).toLocaleString("ja-JP")}
            </p>
            <p className="mt-2 text-sm text-muted">最低在庫までの差分</p>
          </div>
        </section>

        <section className="rounded border border-line bg-panel p-4 shadow-sheet">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" action={`/admin/overview/${clinicId}/shortage`}>
            <input
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition placeholder:text-muted "
              defaultValue={query}
              name="q"
              placeholder="商品名、商品コード、カテゴリ、発注先"
              type="search"
            />
            <button
              className="h-11 rounded btn-primary px-5 text-sm font-semibold transition"
              type="submit"
            >
              検索
            </button>
            <a
              className="inline-flex h-11 items-center justify-center rounded btn-secondary px-5 text-sm font-semibold transition"
              href={`/admin/overview/${clinicId}/shortage`}
            >
              クリア
            </a>
          </form>
        </section>

        <section className="overflow-hidden rounded border border-line bg-panel shadow-sheet">
          <div className="border-b border-line px-5 py-4 text-sm text-muted">
            表示 {filteredRows.length} 件 / 不足 {shortageRows.length} 件
            {query ? `（検索: ${query}）` : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-tint text-label text-accent">
                <tr>
                  <th className="border-b border-accent px-4 py-3">商品</th>
                  <th className="border-b border-accent px-4 py-3">カテゴリ</th>
                  <th className="border-b border-accent px-4 py-3">発注先</th>
                  <th className="border-b border-accent px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-accent px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-accent px-4 py-3 text-right">不足数</th>
                  <th className="border-b border-accent px-4 py-3">保管場所</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.stockItemId} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{row.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">{row.supplierName ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right font-semibold">
                      {row.quantity.toLocaleString("ja-JP")}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td className="border-b border-line px-4 py-3 text-right font-semibold text-ink">
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
    </PageShell>
  );
}
