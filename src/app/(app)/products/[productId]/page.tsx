import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductDetail } from "@/lib/db/products";
import { getStockMovementSourceLabel, getStockMovementTypeLabel } from "@/lib/db/stock-movements";
import { createEmptyOrderRequestStatusCounts, orderRequestStatusLabels } from "@/lib/orders/status";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
};

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPrice(value: number | null) {
  return value === null ? "-" : yenFormatter.format(value);
}

function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

function formatBarcodeLabel(barcode: { barcodeType: string; unitLabel: string | null; isPrimary: boolean }) {
  const pieces = [barcode.barcodeType, barcode.unitLabel, barcode.isPrimary ? "代表" : ""].filter(Boolean);

  return pieces.join(" / ");
}

function getStockStatus(currentQuantity: number, minStock: number, hasStockItem: boolean) {
  if (!hasStockItem) {
    return {
      label: "在庫行なし",
      description: "在庫一覧の対象外",
      badgeClass: "bg-gray-100 text-muted",
      panelClass: "border-line bg-white",
    };
  }

  if (currentQuantity === 0) {
    return {
      label: "在庫なし",
      description: "補充が必要",
      badgeClass: "bg-red-50 text-danger",
      panelClass: "border-danger/40 bg-red-50/40",
    };
  }

  if (currentQuantity < minStock) {
    return {
      label: "不足中",
      description: "最低在庫を下回っています",
      badgeClass: "bg-yellow-50 text-warning",
      panelClass: "border-warning/40 bg-yellow-50/50",
    };
  }

  if (currentQuantity === minStock) {
    return {
      label: "最低在庫ちょうど",
      description: "補充判断が必要",
      badgeClass: "bg-yellow-50 text-warning",
      panelClass: "border-warning/40 bg-yellow-50/50",
    };
  }

  return {
    label: "在庫あり",
    description: "最低在庫を上回っています",
    badgeClass: "bg-emerald-50 text-accent",
    panelClass: "border-line bg-white",
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const { productId } = await params;
  const product = await getProductDetail(productId, context.organizationId, context.clinicId);

  if (!product) {
    notFound();
  }

  const shortageCount = product.hasStockItem ? Math.max(0, product.minStock - product.currentQuantity) : 0;
  const stockStatus = getStockStatus(product.currentQuantity, product.minStock, product.hasStockItem);
  const orderRequestCounts = product.orderRequests.reduce(
    (counts, request) => {
      counts[request.status] += 1;
      return counts;
    },
    createEmptyOrderRequestStatusCounts(),
  );
  const productQuery = encodeURIComponent(product.name);
  const inventoryHref = `/inventory?q=${productQuery}`;
  const movementsHref = `/movements?q=${productQuery}`;
  const shortageHref = `/shortage?q=${productQuery}`;
  const ordersHref = `/orders?q=${productQuery}`;
  const photoUrl = buildProductPhotoUrl(product);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <a className="text-accent hover:underline" href={`/products/${product.id}/edit`}>
              編集する
            </a>
            <a className="text-accent hover:underline" href="/products">
              商品マスタへ戻る
            </a>
          </div>
        </header>


        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
            {photoUrl ? (
              <img
                alt={`${product.name}の商品写真`}
                className="aspect-square w-full max-w-48 rounded border border-line object-cover"
                src={photoUrl}
              />
            ) : (
              <div className="grid aspect-square w-full max-w-48 place-items-center rounded border border-dashed border-line bg-gray-50 text-sm font-semibold text-muted">
                写真なし
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-muted">商品写真</p>
              <a className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline" href={`/products/${product.id}/edit`}>
                写真を編集する
              </a>
            </div>
          </div>
        </section>

        <section className={`rounded border p-5 shadow-panel ${stockStatus.panelClass}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-3 py-1 text-xs font-semibold ${stockStatus.badgeClass}`}>
                  {stockStatus.label}
                </span>
                {product.orderRequests.length > 0 ? (
                  <span className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-muted">
                    発注候補 {product.orderRequests.length} 件
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted">
                {stockStatus.description}。現在庫 {product.currentQuantity} / 最低在庫 {product.minStock}
                {shortageCount > 0 ? ` / 不足 ${shortageCount}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                href={inventoryHref}
              >
                在庫一覧で確認
              </a>
              <a
                className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                href={movementsHref}
              >
                履歴で確認
              </a>
              {shortageCount > 0 ? (
                <a
                  className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                  href={shortageHref}
                >
                  不足一覧へ
                </a>
              ) : null}
              {product.orderRequests.length > 0 ? (
                <a
                  className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                  href={ordersHref}
                >
                  発注候補へ
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">現在庫</p>
            <p className="mt-2 text-3xl font-semibold">{product.currentQuantity}</p>
            <p className="mt-2 text-sm text-muted">保管場所 {product.location ?? "-"}</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">最低在庫</p>
            <p className="mt-2 text-3xl font-semibold">{product.minStock}</p>
            <p className="mt-2 text-sm text-muted">標準最低 {product.defaultMinStock}</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">不足数</p>
            <p className={shortageCount > 0 ? "mt-2 text-3xl font-semibold text-danger" : "mt-2 text-3xl font-semibold"}>
              {shortageCount}
            </p>
            <p className="mt-2 text-sm text-muted">{stockStatus.label}</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">発注候補</p>
            <p className="mt-2 text-3xl font-semibold">{product.orderRequests.length}</p>
            <p className="mt-2 text-sm text-muted">
              未確認 {orderRequestCounts.DRAFT} / 確認済み {orderRequestCounts.CONFIRMED} /{" "}
              発注済み {orderRequestCounts.ORDERED} /{" "}
              <span className="font-semibold text-danger">取り消し {orderRequestCounts.SKIPPED}</span>
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">基本情報</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-muted">商品コード</dt>
                <dd className="mt-1">{product.productCode ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">JAN</dt>
                <dd className="mt-1">{product.janCode ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">内部コード</dt>
                <dd className="mt-1">{product.internalCode ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">カテゴリ</dt>
                <dd className="mt-1">{product.category ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">メーカー</dt>
                <dd className="mt-1">{product.manufacturer ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">規格</dt>
                <dd className="mt-1">{product.specification ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">発注単位</dt>
                <dd className="mt-1">{product.orderUnit ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">標準価格</dt>
                <dd className="mt-1">{formatPrice(product.standardPrice)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">主発注先</dt>
                <dd className="mt-1">
                  {product.primarySupplierId && product.supplierName ? (
                    <a className="font-semibold text-accent hover:underline" href={`/suppliers/${product.primarySupplierId}`}>
                      {product.supplierName}
                    </a>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">発注先品番</dt>
                <dd className="mt-1">{product.supplierProductCode ?? "-"}</dd>
              </div>
            </dl>
            {product.notes ? <p className="mt-4 text-sm text-muted">{product.notes}</p> : null}
          </div>

          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">バーコード</h2>
            <div className="mt-4 grid gap-3">
              {product.barcodes.length > 0 ? (
                product.barcodes.map((barcode) => (
                  <div key={barcode.barcode} className="rounded border border-line px-3 py-2">
                    <p className="font-mono text-sm">{barcode.barcode}</p>
                    <p className="mt-1 text-xs text-muted">{formatBarcodeLabel(barcode)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">バーコードは登録されていません。</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">直近の在庫変更</h2>
            <div className="mt-4 divide-y divide-line">
              {product.recentMovements.length > 0 ? (
                product.recentMovements.map((movement) => (
                  <div key={movement.id} className="grid gap-1 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">
                        {getStockMovementTypeLabel(movement.movementType)} {formatSignedQuantity(movement.quantity)}
                      </span>
                      <span className="text-muted">{dateTimeFormatter.format(movement.createdAt)}</span>
                    </div>
                    <p className="text-muted">
                      {movement.beforeQuantity} → {movement.afterQuantity} /{" "}
                      {getStockMovementSourceLabel(movement.sourceType)} / {movement.userName}
                    </p>
                    {movement.reason ? <p className="text-muted">{movement.reason}</p> : null}
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-muted">まだ在庫変更履歴はありません。</p>
              )}
            </div>
          </div>

          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">発注候補</h2>
            <div className="mt-4 divide-y divide-line">
              {product.orderRequests.length > 0 ? (
                product.orderRequests.map((request) => (
                  <div key={request.id} className="grid gap-1 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          request.status === "SKIPPED"
                            ? "font-semibold text-danger"
                            : request.status === "ORDERED"
                              ? "font-semibold text-accent"
                              : "font-semibold"
                        }
                      >
                        {orderRequestStatusLabels[request.status]}
                      </span>
                      <span className="text-muted">発注数量 {request.requestedQuantity}</span>
                    </div>
                    <p className="text-muted">
                      {request.supplierId && (request.supplierName ?? product.supplierName) ? (
                        <a className="font-semibold text-accent hover:underline" href={`/suppliers/${request.supplierId}`}>
                          {request.supplierName ?? product.supplierName}
                        </a>
                      ) : (
                        "-"
                      )}{" "}
                      / {dateTimeFormatter.format(request.updatedAt)}
                    </p>
                    {request.memo ? <p className="text-muted">{request.memo}</p> : null}
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-muted">この商品の発注候補はありません。</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
