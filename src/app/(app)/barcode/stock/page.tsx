import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { requireActiveClinic } from "@/lib/db/clinic";
import { BarcodeSearchForm } from "../barcode-search-form";
import { BarcodeStockForm } from "./barcode-stock-form";

type PageProps = {
  searchParams?: Promise<{
    barcode?: string;
  }>;
};

function getStockStatusLabel(quantity: number, minStock: number) {
  if (quantity === 0) {
    return {
      label: "在庫なし",
      className: "bg-red-50 text-danger",
    };
  }

  if (quantity <= minStock) {
    return {
      label: "不足中",
      className: "bg-yellow-50 text-warning",
    };
  }

  return {
    label: "在庫あり",
    className: "bg-emerald-50 text-accent",
  };
}

export default async function BarcodeStockPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const barcode = params.barcode?.trim() ?? "";
  const results = barcode ? await searchProductsByBarcode(context.clinicId, barcode) : [];
  const selectedProduct = results.length === 1 ? results[0] : null;
  const status = selectedProduct ? getStockStatusLabel(selectedProduct.quantity, selectedProduct.minStock) : null;

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">バーコード出入庫</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/barcode"
            >
              バーコード検索
            </a>
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/movements?source=BARCODE_STOCK"
            >
              履歴を見る
            </a>
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </div>
        </header>

        <AppNav current="barcode" />

        <BarcodeSearchForm defaultBarcode={barcode} actionPath="/barcode/stock" clearHref="/barcode/stock" />

        {!barcode ? (
          <section className="rounded border border-line bg-white p-5 text-sm text-muted shadow-panel">
            バーコードを読み取ってください。
          </section>
        ) : null}

        {barcode && results.length === 0 ? (
          <section className="rounded border border-warning/30 bg-yellow-50 p-5 text-sm text-warning shadow-panel">
            <p className="font-semibold">商品が見つかりませんでした。</p>
            <a className="mt-4 inline-flex h-10 items-center rounded border border-warning/30 bg-white px-4 font-semibold" href={`/barcode?barcode=${encodeURIComponent(barcode)}`}>
              商品検索へ
            </a>
          </section>
        ) : null}

        {barcode && results.length > 1 ? (
          <section className="rounded border border-warning/30 bg-yellow-50 p-5 text-sm text-warning shadow-panel">
            <p className="font-semibold">複数の商品に一致しました。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {results.map((row) => (
                <a
                  key={row.productId}
                  className="rounded border border-warning/30 bg-white p-4 font-semibold text-ink transition hover:border-warning"
                  href={`/products/${row.productId}`}
                >
                  {row.productName}
                  <p className="mt-1 text-xs font-normal text-muted">{row.productCode ?? "コード未設定"} / JAN {row.janCode ?? "-"}</p>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {selectedProduct && status ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <article className="rounded border border-line bg-white p-5 shadow-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted">読み取り結果</p>
                  <h2 className="mt-2 text-2xl font-semibold">{selectedProduct.productName}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {selectedProduct.productCode ?? "コード未設定"} / JAN {selectedProduct.janCode ?? "-"}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-3 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded border border-line px-4 py-3">
                  <dt className="text-xs font-semibold text-muted">現在庫</dt>
                  <dd className="mt-1 text-3xl font-semibold">{selectedProduct.quantity}</dd>
                </div>
                <div className="rounded border border-line px-4 py-3">
                  <dt className="text-xs font-semibold text-muted">最低在庫</dt>
                  <dd className="mt-1 text-3xl font-semibold">{selectedProduct.minStock}</dd>
                </div>
                <div className="rounded border border-line px-4 py-3">
                  <dt className="text-xs font-semibold text-muted">保管場所</dt>
                  <dd className="mt-1 text-sm">{selectedProduct.location ?? "-"}</dd>
                </div>
                <div className="rounded border border-line px-4 py-3">
                  <dt className="text-xs font-semibold text-muted">主発注先</dt>
                  <dd className="mt-1 text-sm">{selectedProduct.supplierName ?? "-"}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded bg-gray-50 px-4 py-3 text-xs text-muted">
                読み取ったバーコード: <span className="font-mono text-ink">{barcode}</span>
              </div>
              {selectedProduct.matchedBarcodes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  {selectedProduct.matchedBarcodes.map((match) => (
                    <span key={`${match.source}-${match.barcode}`} className="rounded bg-gray-50 px-2 py-1">
                      {match.barcodeType} / {match.unitLabel ?? "-"}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>

            <BarcodeStockForm
              barcode={barcode}
              productId={selectedProduct.productId}
              currentQuantity={selectedProduct.quantity}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
