import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getSupplierDetail } from "@/lib/db/suppliers";
import { orderSendMethodLabels } from "@/lib/orders/send-method";
import { orderRequestStatusLabels } from "@/lib/orders/status";

type PageProps = {
  params: Promise<{
    supplierId: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatReceiptExpiryDate(expiryDate: Date | null, expiryDateText: string | null) {
  if (expiryDate) {
    return dateFormatter.format(expiryDate);
  }

  return expiryDateText || "-";
}

function formatOrderRecordId(orderRecordId: string | null) {
  return orderRecordId ? orderRecordId.slice(-8) : "-";
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const canManageSuppliers = isAdminRole(session.user.role);
  const { supplierId } = await params;
  const supplier = await getSupplierDetail(supplierId, context.organizationId, context.clinicId);

  if (!supplier) {
    notFound();
  }

  const orderRequestTotal =
    supplier.orderRequestCounts.DRAFT +
    supplier.orderRequestCounts.CONFIRMED +
    supplier.orderRequestCounts.ORDERED +
    supplier.orderRequestCounts.SKIPPED;
  const shortageProducts = supplier.products.filter((product) => product.shortageCount > 0);
  const supplierQuery = encodeURIComponent(supplier.name);
  const productsHref = `/products?q=${supplierQuery}`;
  const shortageHref = `/shortage?q=${supplierQuery}`;
  const ordersHref = `/orders?q=${supplierQuery}`;

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="suppliers" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">{supplier.name}</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {canManageSuppliers ? (
              <a className="text-accent hover:underline" href={`/suppliers/${supplier.id}/edit`}>
                編集する
              </a>
            ) : null}
            <a className="text-accent hover:underline" href="/suppliers">
              発注先マスタへ戻る
            </a>
          </div>
        </header>


        <section className="flex flex-wrap gap-2">
          <a
            className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={productsHref}
          >
            商品マスタで確認
          </a>
          {supplier.shortageProductCount > 0 ? (
            <a
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
              href={shortageHref}
            >
              不足一覧で確認
            </a>
          ) : null}
          {orderRequestTotal > 0 ? (
            <a
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
              href={ordersHref}
            >
              発注候補で確認
            </a>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">取扱商品</p>
            <p className="mt-2 text-3xl font-semibold">{supplier.productCount}</p>
            <p className="mt-2 text-sm text-muted">使用中の商品</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">不足あり</p>
            <p className={supplier.shortageProductCount > 0 ? "mt-2 text-3xl font-semibold text-danger" : "mt-2 text-3xl font-semibold"}>
              {supplier.shortageProductCount}
            </p>
            <p className="mt-2 text-sm text-muted">最低在庫未満</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">発注候補</p>
            <p className="mt-2 text-3xl font-semibold">{orderRequestTotal}</p>
            <p className="mt-2 text-sm text-muted">この発注先の候補</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">確認待ち</p>
            <p className="mt-2 text-3xl font-semibold">{supplier.orderRequestCounts.DRAFT}</p>
            <p className="mt-2 text-sm text-muted">確認待ち</p>
          </div>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">主なカテゴリ</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {supplier.categories.length > 0 ? (
              supplier.categories.map((category) => (
                <span key={category} className="rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted">
                  {category}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted">カテゴリ未設定</span>
            )}
          </div>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">連絡先</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="font-semibold text-muted">住所</p>
              <p className="mt-1 whitespace-pre-wrap">{supplier.address ?? "-"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted">電話 / FAX</p>
              <p className="mt-1">
                {supplier.phone ?? "-"} / {supplier.fax ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-muted">メール</p>
              <p className="mt-1">{supplier.email ?? "-"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted">担当者</p>
              <p className="mt-1">
                {supplier.contactPersonName ?? "-"} / {supplier.contactPersonEmail ?? "-"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold text-muted">備考</p>
              <p className="mt-1 whitespace-pre-wrap">{supplier.notes ?? "-"}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded border border-line bg-white shadow-panel">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-lg font-semibold">取扱商品</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs text-muted">
                  <tr>
                    <th className="border-b border-line px-4 py-3">商品</th>
                    <th className="border-b border-line px-4 py-3">カテゴリ</th>
                    <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                    <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                    <th className="border-b border-line px-4 py-3 text-right">不足数</th>
                    <th className="border-b border-line px-4 py-3">保管場所</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.products.map((product) => (
                    <tr key={product.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${product.id}`}>
                          {product.name}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {product.productCode ?? "コード未設定"} / {product.supplierProductCode ?? "発注先品番未設定"}
                        </p>
                      </td>
                      <td className="border-b border-line px-4 py-3">{product.category ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right font-semibold">{product.quantity}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{product.minStock}</td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        {product.shortageCount > 0 ? (
                          <span className="font-semibold text-danger">{product.shortageCount}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3">{product.location ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded border border-line bg-white p-5 shadow-panel">
              <h2 className="text-lg font-semibold">不足商品</h2>
              <div className="mt-4 divide-y divide-line">
                {shortageProducts.length > 0 ? (
                  shortageProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <a className="font-semibold text-accent hover:underline" href={`/products/${product.id}`}>
                          {product.name}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {product.quantity} / 最低 {product.minStock}
                        </p>
                      </div>
                      <span className="font-semibold text-danger">不足 {product.shortageCount}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-sm text-muted">不足商品はありません。</p>
                )}
              </div>
            </section>

            <section className="rounded border border-line bg-white p-5 shadow-panel">
              <h2 className="text-lg font-semibold">発注候補</h2>
              <div className="mt-4 divide-y divide-line">
                {supplier.orderRequests.length > 0 ? (
                  supplier.orderRequests.map((request) => (
                    <div key={request.id} className="grid gap-1 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${request.productId}`}>
                          {request.productName}
                        </a>
                        <span className="text-muted">発注数量 {request.requestedQuantity}</span>
                      </div>
                      <p
                        className={
                          request.status === "SKIPPED"
                            ? "font-semibold text-danger"
                            : request.status === "ORDERED"
                              ? "font-semibold text-accent"
                              : "text-muted"
                        }
                      >
                        {orderRequestStatusLabels[request.status]} / {dateTimeFormatter.format(request.updatedAt)}
                      </p>
                      {request.status === "ORDERED" && request.orderedAt ? (
                        <p className="text-muted">発注済み日時: {dateTimeFormatter.format(request.orderedAt)}</p>
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
                          {formatReceiptExpiryDate(request.receivedExpiryDate, request.receivedExpiryDateText)}
                        </p>
                      ) : null}
                      {request.receivedMemo ? <p className="text-muted">{request.receivedMemo}</p> : null}
                      {request.memo ? <p className="text-muted">{request.memo}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-sm text-muted">この発注先の発注候補はありません。</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
