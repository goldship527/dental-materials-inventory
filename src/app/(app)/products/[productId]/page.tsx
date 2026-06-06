import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductDetail } from "@/lib/db/products";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { getStockMovementSourceLabel, getStockMovementTypeLabel } from "@/lib/db/stock-movements";
import { orderSendMethodLabels } from "@/lib/orders/send-method";
import { createEmptyOrderRequestStatusCounts, orderRequestStatusLabels, printableOrderRequestStatuses } from "@/lib/orders/status";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";
import { getStockStatus as getSharedStockStatus, stockStatusKeys } from "@/lib/stock/status";
import { ProductOrderRequestButton } from "./product-order-request-button";
import { ProductStockUsagePanel } from "./product-stock-usage-panel";
import { ProductStockItemCreateForm } from "./product-stock-item-create-form";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
  searchParams?: Promise<{
    adminDenied?: string;
  }>;
};

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatPrice(value: number | null) {
  return value === null ? "-" : yenFormatter.format(value);
}

function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

function formatLotExpiryDate(expiryDate: Date | null, expiryDateText: string | null | undefined) {
  if (expiryDate) {
    return dateFormatter.format(expiryDate);
  }

  return expiryDateText || "-";
}

function formatOrderRecordId(orderRecordId: string | null) {
  return orderRecordId ? orderRecordId.slice(-8) : "-";
}

function getProductOrderRequestStatusLabel(request: { status: string; receivedAt: Date | null }) {
  if (request.status === "ORDERED") {
    return request.receivedAt ? "納品済み" : "納品待ち";
  }

  return orderRequestStatusLabels[request.status as keyof typeof orderRequestStatusLabels];
}

function formatBarcodeLabel(barcode: { barcodeType: string; unitLabel: string | null; isPrimary: boolean }) {
  const pieces = [barcode.barcodeType, barcode.unitLabel, barcode.isPrimary ? "代表" : ""].filter(Boolean);

  return pieces.join(" / ");
}

function getAbcRankBadgeText(rank: string) {
  if (rank === "UNUSED") {
    return "過去90日出庫なし";
  }

  return `使用頻度 ${rank}`;
}

function getAbcRankBadgeClass(rank: string) {
  if (rank === "A") {
    return "border-emerald-200 bg-emerald-50 text-accent";
  }

  if (rank === "B") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (rank === "C") {
    return "border-gray-200 bg-gray-50 text-muted";
  }

  return "border-line bg-white text-muted";
}

function formatLeadTime(leadTime: { avgDays: number; medianDays: number; sampleCount: number; isSampleSufficient: boolean } | null) {
  if (!leadTime) {
    return "平均納品日数: データ不足";
  }

  if (!leadTime.isSampleSufficient) {
    return `平均納品日数: データ不足（直近180日、${leadTime.sampleCount}件）`;
  }

  return `平均納品日数: ${leadTime.avgDays.toFixed(1)}日（中央値 ${leadTime.medianDays.toFixed(1)}日、直近180日、${leadTime.sampleCount}件）`;
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

  const stockStatus = getSharedStockStatus(currentQuantity, minStock);

  if (stockStatus.key === stockStatusKeys.out) {
    return {
      label: stockStatus.label,
      description: "補充が必要",
      badgeClass: stockStatus.badgeClassName,
      panelClass: "border-danger/40 bg-red-50/40",
    };
  }

  if (stockStatus.key === stockStatusKeys.shortage) {
    return {
      label: stockStatus.label,
      description: "最低在庫を下回っています",
      badgeClass: stockStatus.badgeClassName,
      panelClass: "border-warning/40 bg-yellow-50/50",
    };
  }

  if (stockStatus.key === stockStatusKeys.atMin) {
    return {
      label: stockStatus.label,
      description: "補充判断が必要",
      badgeClass: stockStatus.badgeClassName,
      panelClass: "border-warning/40 bg-yellow-50/50",
    };
  }

  return {
    label: stockStatus.label,
    description: "最低在庫を上回っています",
    badgeClass: stockStatus.badgeClassName,
    panelClass: "border-line bg-white",
  };
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const paramsValue = (await searchParams) ?? {};
  const canManageProducts = isAdminRole(session.user.role);
  const { productId } = await params;
  const [product, staffOperators] = await Promise.all([
    getProductDetail(productId, context.organizationId, context.clinicId),
    getActiveStaffOperatorOptionsForClinic({
      organizationId: context.organizationId,
      clinicId: context.clinicId,
    }),
  ]);

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
  const plannedOrderRequestCount = orderRequestCounts.DRAFT + orderRequestCounts.CONFIRMED;
  const awaitingReceiptCount = product.orderRequests.filter((request) => request.status === "ORDERED" && !request.receivedAt).length;
  const receivedOrderRequestCount = product.orderRequests.filter((request) => request.status === "ORDERED" && request.receivedAt).length;
  const hasActiveOrderRequest = product.orderRequests.some((request) => printableOrderRequestStatuses.includes(request.status));
  const hasPendingOrder = product.pendingOrders.totalQuantity > 0;
  const productQuery = encodeURIComponent(product.name);
  const inventoryHref = `/inventory?q=${productQuery}`;
  const movementsHref = `/movements?q=${productQuery}`;
  const shortageHref = `/shortage?q=${productQuery}`;
  const ordersHref = `/orders?q=${productQuery}`;
  const photoUrl = buildProductPhotoUrl(product);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <AppNav current="products" />

        <header className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {canManageProducts ? (
              <a className="text-accent hover:underline" href={`/products/${product.id}/edit`}>
                編集する
              </a>
            ) : null}
            <a className="text-accent hover:underline" href="/products">
              商品マスタへ戻る
            </a>
          </div>
        </header>

        {paramsValue.adminDenied ? (
          <section className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-warning shadow-panel">
            商品マスタの編集は管理者専用です。必要な場合は管理者に依頼してください。
          </section>
        ) : null}

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <div className="grid gap-4 md:grid-cols-[128px_1fr] md:items-center">
            {photoUrl ? (
              <img
                alt={`${product.name}の商品写真`}
                className="aspect-square w-full max-w-32 rounded border border-line object-cover"
                src={photoUrl}
              />
            ) : (
              <div className="grid aspect-square w-full max-w-32 place-items-center rounded border border-dashed border-line bg-gray-50 text-sm font-semibold text-muted">
                写真なし
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-muted">商品写真</p>
              {canManageProducts ? (
                <a className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline" href={`/products/${product.id}/edit`}>
                  写真を編集する
                </a>
              ) : null}
            </div>
          </div>
          {canManageProducts && !product.hasStockItem ? (
            <ProductStockItemCreateForm productId={product.id} defaultMinStock={product.defaultMinStock} />
          ) : null}
        </section>

        <section className={`rounded border p-4 shadow-panel ${stockStatus.panelClass}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                {product.pendingOrders.totalQuantity > 0 ? (
                  <span className="rounded bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning">
                    納品待ち {product.pendingOrders.totalQuantity}個
                  </span>
                ) : null}
                <span className={`rounded border px-3 py-1 text-xs font-semibold ${getAbcRankBadgeClass(product.abcRank.rank)}`}>
                  {getAbcRankBadgeText(product.abcRank.rank)}
                </span>
                {product.abcRank.rank !== "UNUSED" ? (
                  <span className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-muted">
                    90日出庫 {product.abcRank.totalQuantity}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted">
                {stockStatus.description}。{product.stockUsageMode === "IN_USE" ? "使用可能" : "現在庫"} {product.currentQuantity} / 最低在庫 {product.minStock}
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
              {product.stockItemId ? (
                <ProductOrderRequestButton
                  stockItemId={product.stockItemId}
                  isAlreadyAdded={hasActiveOrderRequest}
                  hasPendingOrder={hasPendingOrder}
                />
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

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">{product.stockUsageMode === "IN_USE" ? "使用可能" : "現在庫"}</p>
            <p className="mt-1 text-3xl font-semibold">{product.currentQuantity}</p>
            <p className="mt-1 text-sm text-muted">保管場所 {product.location ?? "-"}</p>
            {product.stockUsageMode === "IN_USE" ? (
              <p className="mt-2 text-sm font-semibold text-muted">
                使用中 {product.inUseQuantity} / 総数 {product.totalQuantity} / 廃棄済み累計 {product.discardedQuantity}
              </p>
            ) : null}
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">最低在庫</p>
            <p className="mt-1 text-3xl font-semibold">{product.minStock}</p>
            <p className="mt-1 text-sm text-muted">標準最低 {product.defaultMinStock}</p>
            {product.recommendedMinStock.recommended !== null ? (
              <p className="mt-2 text-sm font-semibold text-accent">推奨 {product.recommendedMinStock.recommended}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">推奨: データ不足</p>
            )}
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">不足数</p>
            <p className={shortageCount > 0 ? "mt-1 text-3xl font-semibold text-danger" : "mt-1 text-3xl font-semibold"}>
              {shortageCount}
            </p>
            <p className="mt-1 text-sm text-muted">{stockStatus.label}</p>
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">発注候補</p>
            <p className="mt-1 text-3xl font-semibold">{product.orderRequests.length}</p>
            <p className="mt-1 text-sm text-muted">
              発注予定 {plannedOrderRequestCount} / 納品待ち {awaitingReceiptCount} / 納品済み {receivedOrderRequestCount} / 見送り{" "}
              {orderRequestCounts.SKIPPED}
            </p>
          </div>
        </section>

        {product.stockUsageMode === "IN_USE" && product.stockItemId ? (
          <ProductStockUsagePanel
            stockItemId={product.stockItemId}
            availableQuantity={product.currentQuantity}
            inUseQuantity={product.inUseQuantity}
            discardedQuantity={product.discardedQuantity}
            staffOperators={staffOperators}
          />
        ) : null}

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">推奨最低在庫</h2>
              <p className="mt-1 text-sm text-muted">
                過去90日の出庫実績、発注先リードタイム、安全在庫係数から計算した参考値です。自動では更新されません。
              </p>
            </div>
            {canManageProducts ? (
              <a
                className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                href={`/products/${product.id}/edit`}
              >
                商品編集で確認
              </a>
            ) : null}
          </div>
          {product.recommendedMinStock.recommended !== null ? (
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-5">
              <div className="rounded bg-gray-50 p-3">
                <dt className="text-muted">推奨値</dt>
                <dd className="mt-1 text-xl font-semibold text-accent">{product.recommendedMinStock.recommended}</dd>
              </div>
              <div className="rounded bg-gray-50 p-3">
                <dt className="text-muted">90日出庫</dt>
                <dd className="mt-1 font-semibold">{product.recommendedMinStock.totalOut90d}</dd>
              </div>
              <div className="rounded bg-gray-50 p-3">
                <dt className="text-muted">月間平均</dt>
                <dd className="mt-1 font-semibold">{product.recommendedMinStock.monthlyUsage}</dd>
              </div>
              <div className="rounded bg-gray-50 p-3">
                <dt className="text-muted">リードタイム</dt>
                <dd className="mt-1 font-semibold">
                  {product.recommendedMinStock.leadDays}日
                  {product.recommendedMinStock.usesFallbackLeadTime ? "（仮）" : ""}
                </dd>
              </div>
              <div className="rounded bg-gray-50 p-3">
                <dt className="text-muted">安全係数</dt>
                <dd className="mt-1 font-semibold">{product.recommendedMinStock.safetyFactor}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 rounded bg-gray-50 px-3 py-2 text-sm text-muted">
              過去90日の出庫実績がないため、推奨最低在庫は表示しません。
            </p>
          )}
        </section>

        {product.pendingOrders.totalQuantity > 0 ? (
          <section className="rounded border border-warning/30 bg-yellow-50 p-4 shadow-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-warning">未納の発注があります</h2>
                <p className="mt-1 text-sm text-muted">
                  発注済 {product.pendingOrders.count}件 / 合計 {product.pendingOrders.totalQuantity}個
                  {product.pendingOrders.latestOrderedAt
                    ? ` / 最終発注 ${dateFormatter.format(product.pendingOrders.latestOrderedAt)}`
                    : ""}
                </p>
              </div>
              <a
                className="inline-flex min-h-10 items-center justify-center rounded border border-warning/40 bg-white px-4 py-2 text-sm font-semibold text-warning transition hover:border-warning"
                href={ordersHref}
              >
                発注候補で確認
              </a>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {product.pendingOrderSuppliers.map((supplier) => (
                <div key={supplier.supplierId ?? "none"} className="rounded border border-warning/20 bg-white px-3 py-2 text-sm">
                  <p className="font-semibold">{supplier.supplierName ?? "発注先未設定"}</p>
                  <p className="mt-1 text-muted">
                    {supplier.count}件 / {supplier.totalQuantity}個
                    {supplier.latestOrderedAt ? ` / 最終 ${dateFormatter.format(supplier.latestOrderedAt)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">ロット別在庫</h2>
              <p className="mt-1 text-sm text-muted">バーコード入出庫や納品確認で記録したロット番号と有効期限を表示します。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a className="text-sm font-semibold text-accent hover:underline" href={`/stock-lots?q=${encodeURIComponent(product.name)}`}>
                期限ロット一覧で確認
              </a>
              <span className="text-sm font-semibold text-muted">表示 {product.stockLots.length} 件</span>
            </div>
          </div>
          {product.stockLots.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs text-muted">
                  <tr>
                    <th className="border-b border-line px-3 py-2">ロット番号</th>
                    <th className="border-b border-line px-3 py-2">有効期限</th>
                    <th className="border-b border-line px-3 py-2 text-right">数量</th>
                    <th className="border-b border-line px-3 py-2">更新日時</th>
                  </tr>
                </thead>
                <tbody>
                  {product.stockLots.map((lot) => (
                    <tr key={lot.id}>
                      <td className="border-b border-line px-3 py-2 font-mono">{lot.lotNumber || "-"}</td>
                      <td className="border-b border-line px-3 py-2">{formatLotExpiryDate(lot.expiryDate, lot.expiryDateText)}</td>
                      <td className="border-b border-line px-3 py-2 text-right font-semibold">{lot.quantity}</td>
                      <td className="border-b border-line px-3 py-2 text-muted">{dateTimeFormatter.format(lot.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded border border-dashed border-line px-4 py-3 text-sm text-muted">
              ロット番号・有効期限つきの在庫はまだ記録されていません。
            </p>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <h2 className="text-lg font-semibold">基本情報</h2>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
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
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-danger">未設定</span>
                      {canManageProducts ? (
                        <a className="font-semibold text-accent hover:underline" href={`/products/${product.id}/edit`}>
                          主発注先を設定
                        </a>
                      ) : null}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">発注先品番</dt>
                <dd className="mt-1">{product.supplierProductCode ?? "-"}</dd>
              </div>
            </dl>
            {product.notes ? <p className="mt-3 text-sm text-muted">{product.notes}</p> : null}
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">取扱発注先</h3>
                {canManageProducts ? (
                  <a className="text-xs font-semibold text-accent hover:underline" href={`/products/${product.id}/edit`}>
                    編集
                  </a>
                ) : null}
              </div>
              <div className="mt-2 grid gap-2">
                {product.productSuppliers.length > 0 ? (
                  product.productSuppliers.map((productSupplier) => (
                    <div key={`${productSupplier.supplierId}-${productSupplier.isPrimary}`} className="rounded border border-line px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a className="font-semibold text-accent hover:underline" href={`/suppliers/${productSupplier.supplierId}`}>
                          {productSupplier.supplierName}
                        </a>
                        <span
                          className={
                            productSupplier.isPrimary
                              ? "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-accent"
                              : "rounded bg-gray-50 px-2 py-1 text-xs font-semibold text-muted"
                          }
                        >
                          {productSupplier.isPrimary ? "主発注先" : "代替"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        品番 {productSupplier.supplierProductCode ?? "-"} / 単位 {productSupplier.orderUnit ?? "-"} / 価格{" "}
                        {formatPrice(productSupplier.standardPrice)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">{formatLeadTime(productSupplier.leadTime)}</p>
                      {productSupplier.notes ? <p className="mt-1 text-xs text-muted">{productSupplier.notes}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded border border-dashed border-line px-3 py-2 text-sm text-muted">
                    取扱発注先はまだ登録されていません。
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <h2 className="text-lg font-semibold">バーコード</h2>
            <div className="mt-3 grid gap-2">
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

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <h2 className="text-lg font-semibold">直近の在庫変更</h2>
            <div className="mt-3 divide-y divide-line">
              {product.recentMovements.length > 0 ? (
                product.recentMovements.map((movement) => (
                  <div key={movement.id} className="grid gap-1 py-2.5 text-sm">
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
                    {movement.lotNumber || movement.expiryDateText || movement.expiryDate ? (
                      <p className="text-muted">
                        ロット {movement.lotNumber || "-"} / 有効期限{" "}
                        {formatLotExpiryDate(movement.expiryDate, movement.expiryDateText)}
                      </p>
                    ) : null}
                    {movement.reason ? <p className="text-muted">{movement.reason}</p> : null}
                    {movement.memo ? <p className="text-muted">{movement.memo}</p> : null}
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-muted">まだ在庫変更履歴はありません。</p>
              )}
            </div>
          </div>

          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <h2 className="text-lg font-semibold">発注候補</h2>
            <div className="mt-3 divide-y divide-line">
              {product.orderRequests.length > 0 ? (
                product.orderRequests.map((request) => (
                  <div key={request.id} className="grid gap-1 py-2.5 text-sm">
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
                        {getProductOrderRequestStatusLabel(request)}
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
                    {request.status === "ORDERED" && request.orderedAt ? (
                      <p className="text-muted">発注記録日時: {dateTimeFormatter.format(request.orderedAt)}</p>
                    ) : null}
                    {request.status === "ORDERED" && request.orderRecordId ? (
                      <p className="text-muted">発注記録: {formatOrderRecordId(request.orderRecordId)}</p>
                    ) : null}
                    {request.status === "ORDERED" && request.orderedMethod ? (
                      <p className="text-muted">送付方法: {orderSendMethodLabels[request.orderedMethod]}</p>
                    ) : null}
                    {request.status === "ORDERED" && request.orderedMemo ? (
                      <p className="text-muted">送付メモ: {request.orderedMemo}</p>
                    ) : null}
                    {request.status === "ORDERED" && request.supplierResponseMemo ? (
                      <p className="text-muted">先方対応メモ: {request.supplierResponseMemo}</p>
                    ) : null}
                    {request.receivedAt ? (
                      <p className="font-semibold text-blue-800">
                        納品確認済み {dateTimeFormatter.format(request.receivedAt)} / 数量 {request.receivedQuantity ?? "-"}
                      </p>
                    ) : null}
                    {request.receivedLotNumber || request.receivedExpiryDateText || request.receivedExpiryDate ? (
                      <p className="text-muted">
                        ロット {request.receivedLotNumber || "-"} / 有効期限{" "}
                        {formatLotExpiryDate(request.receivedExpiryDate, request.receivedExpiryDateText)}
                      </p>
                    ) : null}
                    {request.receivedMemo ? <p className="text-muted">{request.receivedMemo}</p> : null}
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
