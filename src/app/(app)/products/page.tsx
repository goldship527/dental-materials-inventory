import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductCategories, getProductMasterRows } from "@/lib/db/products";
import { ProductFilterForm } from "./product-filter-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    attachBarcode?: string;
  }>;
};

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatPrice(value: number | null) {
  return value === null ? "-" : yenFormatter.format(value);
}

function formatBarcodeLabel(barcode: { barcodeType: string; unitLabel: string | null; isPrimary: boolean }) {
  const pieces = [barcode.barcodeType, barcode.unitLabel, barcode.isPrimary ? "代表" : ""].filter(Boolean);

  return pieces.join(" / ");
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const attachBarcode = params.attachBarcode?.trim() ?? "";
  const [rows, categories] = await Promise.all([
    getProductMasterRows(context.organizationId, context.clinicId),
    getProductCategories(context.organizationId),
  ]);
  const normalizedQuery = query.toLowerCase();
  const filteredRows = rows.filter((row) => {
    const searchText = [
      row.name,
      row.nameKana,
      row.productCode,
      row.janCode,
      row.internalCode,
      row.category,
      row.manufacturer,
      row.specification,
      row.orderUnit,
      row.supplierName,
      row.supplierProductCode,
      ...row.barcodes.map((barcode) => barcode.barcode),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery ? searchText.includes(normalizedQuery) : true;
    const matchesCategory = category ? row.category === category : true;

    return matchesQuery && matchesCategory;
  });
  const filterLabel = [query ? `検索: ${query}` : "", category ? `カテゴリ: ${category}` : ""].filter(Boolean).join(" / ");

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">商品マスタ</h1>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
            {!attachBarcode ? (
              <>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                  href="/products/new"
                >
                  商品を新規作成
                </a>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  href="/products/import"
                >
                  一括取り込み
                </a>
              </>
            ) : null}
            <a
              className="inline-flex min-h-11 items-center justify-center rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </div>
        </header>


        <ProductFilterForm
          categories={categories}
          defaultQuery={query}
          defaultCategory={category}
          attachBarcode={attachBarcode}
        />

        {attachBarcode ? (
          <section className="rounded border border-warning/30 bg-yellow-50 p-4 text-sm text-warning shadow-panel">
            <p className="font-semibold">紐づける商品を選択中</p>
            <p className="mt-2">
              読み取ったバーコード <span className="font-mono text-ink">{attachBarcode}</span>{" "}
              を紐づけます。
            </p>
          </section>
        ) : null}

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            表示 {filteredRows.length} 件 / 全 {rows.length} 件
            {filterLabel ? `（${filterLabel}）` : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">カテゴリ</th>
                  <th className="border-b border-line px-4 py-3">バーコード</th>
                  <th className="border-b border-line px-4 py-3">メーカー</th>
                  <th className="border-b border-line px-4 py-3">規格</th>
                  <th className="border-b border-line px-4 py-3">発注単位</th>
                  <th className="border-b border-line px-4 py-3">主発注先</th>
                  <th className="border-b border-line px-4 py-3 text-right">標準価格</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                  {attachBarcode ? <th className="border-b border-line px-4 py-3">紐づけ</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${row.id}`}>
                          {row.name}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {row.productCode ?? "コード未設定"} / JAN {row.janCode ?? "-"}
                        </p>
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {row.barcodes.length > 0 ? (
                          <div className="grid gap-1">
                            {row.barcodes.slice(0, 2).map((barcode) => (
                              <div key={`${row.id}-${barcode.barcode}`}>
                                <p className="font-mono text-xs">{barcode.barcode}</p>
                                <p className="text-xs text-muted">{formatBarcodeLabel(barcode)}</p>
                              </div>
                            ))}
                            {row.barcodes.length > 2 ? (
                              <p className="text-xs text-muted">ほか {row.barcodes.length - 2} 件</p>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.manufacturer ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{row.specification ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{row.orderUnit ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {row.supplierId && row.supplierName ? (
                          <a className="font-semibold text-accent hover:underline" href={`/suppliers/${row.supplierId}`}>
                            {row.supplierName}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                        {row.supplierProductCode ? (
                          <p className="mt-1 text-xs text-muted">{row.supplierProductCode}</p>
                        ) : null}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">{formatPrice(row.standardPrice)}</td>
                      <td className="border-b border-line px-4 py-3 text-right font-semibold">
                        {row.currentQuantity}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                      {attachBarcode ? (
                        <td className="border-b border-line px-4 py-3">
                          <a
                            className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                            href={`/products/${row.id}/edit?newBarcode=${encodeURIComponent(attachBarcode)}`}
                          >
                            この商品に紐づける
                          </a>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={attachBarcode ? 12 : 11}>
                      条件に一致する商品はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
