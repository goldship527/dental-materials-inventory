import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRequestRows } from "@/lib/db/orders";
import { getOrderPrintGroups, type OrderPrintGroup } from "@/lib/orders/print";
import { orderRequestStatusLabels } from "@/lib/orders/status";
import { OrdersPrintButton } from "../print-button";

type PageProps = {
  searchParams?: Promise<{
    supplierId?: string;
  }>;
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "未設定";
}

function formatPrice(value: number | null | undefined) {
  return value == null
    ? "-"
    : new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
      }).format(value);
}

function buildPrintHref(supplierId?: string) {
  return supplierId ? `/orders/print?supplierId=${encodeURIComponent(supplierId)}` : "/orders/print";
}

function getMissingSupplierLabels(group: OrderPrintGroup) {
  return [
    group.supplierAddress ? "" : "住所",
    group.supplierPhone ? "" : "電話",
    group.supplierFax ? "" : "FAX",
    group.supplierEmail ? "" : "メール",
  ].filter(Boolean);
}

export default async function OrdersPrintPage({ searchParams }: PageProps) {
  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const rows = await getOrderRequestRows(context.clinicId);
  const allGroups = getOrderPrintGroups(rows);
  const requestedSupplierId = params.supplierId;
  const selectedSupplierId = allGroups.some((group) => group.supplierKey === requestedSupplierId)
    ? requestedSupplierId
    : undefined;
  const groups = getOrderPrintGroups(rows, { supplierId: selectedSupplierId });
  const selectedGroup = selectedSupplierId
    ? allGroups.find((group) => group.supplierKey === selectedSupplierId)
    : undefined;
  const scopeLabel = selectedGroup ? `発注先指定: ${selectedGroup.supplierName}` : "全発注先";
  const missingContactGroups = groups.filter((group) => getMissingSupplierLabels(group).length > 0);
  const issuedAt = new Date();
  const issuedAtLabel = formatDateTime(issuedAt);

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink print:bg-white print:p-0">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 print:max-w-none print:gap-4">
        <div className="print:hidden">
          <AppNav current="orders" />
        </div>

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between print:border-black print:pb-3">
          <div>
            <p className="text-sm font-semibold text-accent print:text-black">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold print:text-2xl">発注書下書き</h1>
            <p className="mt-2 text-sm text-muted print:text-xs print:text-black">
              発行日時: {issuedAtLabel} / 外部送信済みではありません
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <a className="rounded border border-line px-5 py-3 text-sm font-semibold hover:border-accent" href="/orders">
              発注候補へ戻る
            </a>
            <OrdersPrintButton />
          </div>
        </header>

        <section className="rounded border border-line bg-white p-4 text-sm shadow-panel print:hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">出力範囲</h2>
              <p className="mt-1 text-muted">{scopeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildPrintHref()}
                aria-current={!selectedSupplierId ? "page" : undefined}
                className={
                  !selectedSupplierId
                    ? "rounded bg-accent px-4 py-2 text-sm font-semibold text-white"
                    : "rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                }
              >
                全件
              </a>
              {allGroups.map((group) => (
                <a
                  key={group.supplierKey}
                  href={buildPrintHref(group.supplierKey)}
                  aria-current={selectedSupplierId === group.supplierKey ? "page" : undefined}
                  className={
                    selectedSupplierId === group.supplierKey
                      ? "rounded bg-accent px-4 py-2 text-sm font-semibold text-white"
                      : "rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  }
                >
                  {group.supplierName}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded border border-line bg-white p-4 text-sm shadow-panel md:grid-cols-2 print:hidden">
          <div>
            <h2 className="text-base font-semibold print:text-sm">発注元</h2>
            <dl className="mt-3 grid gap-2">
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="text-muted print:text-black">名称</dt>
                <dd className="font-semibold">{context.clinicName}</dd>
              </div>
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="text-muted print:text-black">住所</dt>
                <dd>{displayValue(context.clinicAddress)}</dd>
              </div>
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="text-muted print:text-black">電話</dt>
                <dd>{displayValue(context.clinicPhone)}</dd>
              </div>
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="text-muted print:text-black">担当者</dt>
                <dd>{displayValue(context.userName ?? context.userEmail)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-base font-semibold print:text-sm">発注内容</h2>
            <dl className="mt-3 grid gap-2">
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">発注先数</dt>
                <dd>{groups.length} 件</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">商品行数</dt>
                <dd>{groups.reduce((total, group) => total + group.rows.length, 0)} 行</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">対象状態</dt>
                <dd>未確認・確認済み</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">出力範囲</dt>
                <dd>{scopeLabel}</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">連絡先確認</dt>
                <dd>
                  {missingContactGroups.length > 0
                    ? `${missingContactGroups.length} 件の発注先に未設定項目があります`
                    : "主要連絡先は入力済みです"}
                </dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted print:text-black">注意</dt>
                <dd>この画面は発注前確認用の下書きです。送信・FAX・メール送付は行いません。</dd>
              </div>
            </dl>
          </div>
        </section>

        {groups.length > 0 ? (
          <section className="flex flex-col gap-5 print:gap-4">
            {groups.map((group) => (
              <article
                key={group.supplierKey}
                className="order-print-sheet break-inside-avoid rounded border border-line bg-white shadow-panel print:rounded-none print:border-black print:shadow-none"
              >
                <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[1.2fr_1fr] print:grid-cols-[1.1fr_1fr_1fr] print:border-black print:p-2 print:text-[10px]">
                  <div>
                    <p className="text-xs font-semibold text-muted print:text-black">発注先</p>
                    <h2 className="mt-1 text-xl font-semibold print:text-base">{group.supplierName}</h2>
                    {getMissingSupplierLabels(group).length > 0 ? (
                      <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 print:border print:border-black print:bg-white print:px-2 print:py-1 print:text-black">
                        未設定: {getMissingSupplierLabels(group).join("、")}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm print:text-xs">
                      住所: {displayValue(group.supplierAddress)}
                    </p>
                  </div>
                  <dl className="grid gap-1 text-sm print:text-[10px]">
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">電話</dt>
                      <dd>{displayValue(group.supplierPhone)}</dd>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">FAX</dt>
                      <dd>{displayValue(group.supplierFax)}</dd>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">メール</dt>
                      <dd>{displayValue(group.supplierEmail)}</dd>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">担当者</dt>
                      <dd>{displayValue(group.supplierContactPersonName)}</dd>
                    </div>
                  </dl>
                  <dl className="grid gap-1 border-t border-line pt-3 text-sm md:col-span-2 print:col-span-1 print:border-l print:border-t-0 print:border-black print:pl-2 print:pt-0 print:text-[10px]">
                    <div className="font-semibold print:text-black">発注元</div>
                    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">名称</dt>
                      <dd className="font-semibold">{context.clinicName}</dd>
                    </div>
                    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">電話</dt>
                      <dd>{displayValue(context.clinicPhone)}</dd>
                    </div>
                    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">担当者</dt>
                      <dd>{displayValue(context.userName ?? context.userEmail)}</dd>
                    </div>
                    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                      <dt className="text-muted print:text-black">発行</dt>
                      <dd>{issuedAtLabel}</dd>
                    </div>
                  </dl>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-left text-sm print:min-w-0 print:text-[10.5px]">
                    <thead className="bg-gray-50 text-xs text-muted print:bg-white print:text-[10px] print:text-black">
                      <tr>
                        <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                          商品
                        </th>
                        <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                          商品コード
                        </th>
                        <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                          カテゴリ
                        </th>
                        <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                          現在庫
                        </th>
                        <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                          最低在庫
                        </th>
                        <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                          発注数
                        </th>
                        <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                          状態・備考
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id} className="align-top">
                          <td className="border-b border-line px-4 py-3 font-semibold print:border print:border-black print:px-2 print:py-1.5">
                            {row.name}
                          </td>
                          <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                            {row.productCode ?? "-"}
                            {row.supplierProductCode ? (
                              <span className="block text-xs text-muted print:text-black">発注先品番: {row.supplierProductCode}</span>
                            ) : null}
                          </td>
                          <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                            {row.category ?? "-"}
                          </td>
                          <td className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                            {row.quantity}
                          </td>
                          <td className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                            {row.minStock}
                          </td>
                          <td className="border-b border-line px-4 py-3 text-right font-semibold print:border print:border-black print:px-2 print:py-1.5">
                            {row.requestedQuantity}
                            {row.orderUnit ? <span className="block text-xs font-normal text-muted print:text-black">{row.orderUnit}</span> : null}
                          </td>
                          <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                            {orderRequestStatusLabels[row.status]}
                            {row.standardPrice != null ? (
                              <span className="block text-muted print:text-black">標準価格: {formatPrice(row.standardPrice)}</span>
                            ) : null}
                            {row.memo ? <span className="block text-muted print:text-black">{row.memo}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right font-semibold print:border print:border-black print:px-2 print:py-1.5">
                          小計
                        </td>
                        <td className="px-4 py-3 text-right font-semibold print:border print:border-black print:px-2 print:py-1.5">
                          {group.totalRequestedQuantity}
                        </td>
                        <td className="px-4 py-3 print:border print:border-black print:px-2 print:py-1.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid gap-3 border-t border-line p-4 text-sm md:grid-cols-3 print:border-black print:p-3 print:text-xs">
                  <div className="min-h-14 border border-line px-3 py-2 print:border-black">確認者</div>
                  <div className="min-h-14 border border-line px-3 py-2 print:border-black">発注日</div>
                  <div className="min-h-14 border border-line px-3 py-2 print:border-black">送信・連絡方法</div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-muted shadow-panel print:rounded-none print:border-black print:text-black print:shadow-none">
            印刷対象の発注候補はありません。未確認または確認済みの発注候補を追加してください。
          </section>
        )}
      </div>
    </main>
  );
}
