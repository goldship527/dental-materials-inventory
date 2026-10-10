"use client";

import { useActionState, useState } from "react";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import {
  receiveOrderRequestWithStateAction,
  revertOrderReceiptWithStateAction,
  updateOrderRequestQuantityWithStateAction,
  updateOrderRequestSupplierWithStateAction,
  updateOrderRequestStatusWithStateAction,
  type OrderActionState,
} from "@/lib/actions/orders";
import type { OrderRequestRow } from "@/lib/db/orders";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { orderSendMethodLabels, orderSendMethodValues } from "@/lib/orders/send-method";
import {
  canChangeOrderRequestQuantity,
  orderRequestStatusLabels,
  printableOrderRequestStatuses,
} from "@/lib/orders/status";

const initialState: OrderActionState = {};
type OrderRequestRowProps = {
  clinicId: string;
  row: OrderRequestRow;
  staffOperators: StaffOperatorOption[];
};

type ActiveOrderPanel = "supplier" | "quantity" | "receipt" | "more" | null;
type MoreForm = "skip" | "order" | "edit-record" | "memo" | null;
const shortDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
});

function formatOrderRecordId(orderRecordId: string | null) {
  return orderRecordId ? orderRecordId.slice(-8) : "-";
}

function getOrderRowStatusLabel(row: OrderRequestRow) {
  if (row.status === "ORDERED") {
    return row.receivedAt ? "納品済み" : "納品待ち";
  }

  return orderRequestStatusLabels[row.status];
}

export function OrderRequestTableRow({ clinicId, row, staffOperators }: OrderRequestRowProps) {
  const [activePanel, setActivePanel] = useState<ActiveOrderPanel>(null);
  const [moreForm, setMoreForm] = useState<MoreForm>(null);
  const [requestedQuantity, setRequestedQuantity] = useState(row.requestedQuantity);
  const [selectedSupplierId, setSelectedSupplierId] = useState(row.supplierId ?? "");
  const [quantityState, quantityAction, isQuantityPending] = useActionState(
    updateOrderRequestQuantityWithStateAction,
    initialState,
  );
  const [supplierState, supplierAction, isSupplierPending] = useActionState(
    updateOrderRequestSupplierWithStateAction,
    initialState,
  );
  const [statusState, statusAction, isStatusPending] = useActionState(
    updateOrderRequestStatusWithStateAction,
    initialState,
  );
  const [receiptState, receiptAction, isReceiptPending] = useActionState(
    receiveOrderRequestWithStateAction,
    initialState,
  );
  const [receiptRevertState, receiptRevertAction, isReceiptRevertPending] = useActionState(
    revertOrderReceiptWithStateAction,
    initialState,
  );
  const activeState = receiptRevertState.message
    ? receiptRevertState
    : receiptState.message
    ? receiptState
    : statusState.message
      ? statusState
      : supplierState.message
        ? supplierState
        : quantityState;
  const canChangeQuantity = canChangeOrderRequestQuantity(row.status, row.receivedAt);
  const canChangeSupplier =
    (row.status === "SUGGESTED" || printableOrderRequestStatuses.includes(row.status)) && row.supplierOptions.length > 0;
  const isReceived = row.status === "ORDERED" && Boolean(row.receivedAt);
  const isAwaitingReceipt = row.status === "ORDERED" && !row.receivedAt;
  const isPlanned = printableOrderRequestStatuses.includes(row.status);
  const awaitingReceiptSummary = [
    row.orderedMethod ? orderSendMethodLabels[row.orderedMethod] : null,
    row.orderedAt ? shortDateFormatter.format(row.orderedAt) : null,
    row.orderedByStaffName,
  ].filter(Boolean).join("・");
  const showMemoInDetails = Boolean(row.memo && (row.status === "ORDERED" || row.memo.length > 50));
  const hasRecordDetails = Boolean(
    row.orderRecordId || row.orderedMemo || row.supplierResponseMemo || row.receivedMemo || showMemoInDetails,
  );
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });
  const hasSelectedStaffOperator = selectedStaffOperatorId.length > 0;

  function changeRequestedQuantity(nextQuantity: number) {
    const normalizedQuantity = Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(nextQuantity) ? nextQuantity : 1)));

    setRequestedQuantity(normalizedQuantity);
  }

  function togglePanel(panel: Exclude<ActiveOrderPanel, null>) {
    setActivePanel((currentPanel) => (currentPanel === panel ? null : panel));
    setMoreForm(null);
  }

  return (
    <tr className="order-row align-top transition hover:bg-subtle/60 print:break-inside-avoid">
      <td className="order-cell-product border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        <a
          className="font-semibold text-accent hover:underline print:text-ink print:no-underline"
          href={`/products/${row.productId}`}
        >
          {row.name}
        </a>
        <p className="mt-0.5 text-xs text-muted print:mt-0.5 print:text-xs print:text-ink">
          {row.productCode ?? "コード未設定"} / {row.category ?? "未分類"}
        </p>
        {activeState.message ? (
          <p
            className={
              activeState.status === "success"
                ? "mt-1.5 rounded bg-panel px-3 py-1.5 text-xs font-semibold text-success print:hidden"
                : "mt-1.5 rounded bg-panel px-3 py-1.5 text-xs font-semibold text-danger print:hidden"
            }
          >
            {activeState.message}
          </p>
        ) : null}
      </td>
      <td data-empty={row.status === "SKIPPED" || (row.status === "ORDERED" && Boolean(row.receivedAt)) ? "true" : undefined} className="order-cell-stock border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        {row.status === "SKIPPED" || (row.status === "ORDERED" && row.receivedAt) ? (
          <span className="text-sm text-muted print:hidden">—</span>
        ) : null}
        <div className={`${row.status === "SKIPPED" || (row.status === "ORDERED" && row.receivedAt) ? "hidden print:grid" : "grid"} w-36 grid-cols-2 gap-2 rounded border border-line bg-panel px-2 py-1.5 text-center print:w-auto print:grid-cols-3 print:border-0 print:p-0`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">現在</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-xs">{row.quantity}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">
              <span className="print:hidden">基準</span><span className="hidden print:inline">最低</span>
            </p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-xs">{row.minStock}</p>
          </div>
          <div className="hidden min-w-0 print:block">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">不足</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-xs">
              {row.shortageCount}
            </p>
          </div>
        </div>
      </td>
      <td className="order-cell-supplier border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        <span className="order-supplier-label">発注先: </span>
        {row.supplierId && row.supplierName ? (
          <div className="grid gap-1 print:block">
            <a
              className="text-accent hover:underline print:text-ink print:no-underline"
              href={`/suppliers/${row.supplierId}`}
            >
              {row.supplierName}
            </a>
            <div className="grid gap-0.5 text-xs text-muted print:text-xs print:text-ink">
              {row.supplierProductCode ? <span>発注先品番: {row.supplierProductCode}</span> : null}
              {row.orderUnit ? <span>単位: {row.orderUnit}</span> : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-1 print:block">
            <span className="text-danger print:text-ink">発注先未設定</span>
            <a className="text-xs font-semibold text-accent hover:underline print:hidden" href={`/products/${row.productId}/edit`}>
              主発注先を設定
            </a>
          </div>
        )}
        {canChangeSupplier ? (
          <div className="mt-2 grid gap-1.5 print:hidden">
            {activePanel === "supplier" ? (
              <form action={supplierAction} className="grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
                <input type="hidden" name="orderRequestId" value={row.id} />
                <select
                  name="supplierId"
                  value={selectedSupplierId}
                  onChange={(event) => setSelectedSupplierId(event.target.value)}
                  className="h-10 min-w-0 rounded border border-line bg-panel/90 px-3 text-sm"
                >
                  {row.supplierId ? null : (
                    <option value="" disabled>
                      発注先を選択
                    </option>
                  )}
                  {row.supplierOptions.map((supplierOption) => (
                    <option key={supplierOption.supplierId} value={supplierOption.supplierId}>
                      {supplierOption.supplierName}
                      {supplierOption.isPrimary ? "（主）" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSupplierPending || !selectedSupplierId || selectedSupplierId === (row.supplierId ?? "")}
                  className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {isSupplierPending ? "変更中" : "発注先を変更"}
                </button>
                <button type="button" onClick={() => setActivePanel(null)}
                  className="min-h-10 w-fit px-2 text-sm font-semibold text-accent underline">
                  閉じる
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </td>
      <td data-empty={row.status === "SKIPPED" || isReceived ? "true" : undefined} className="order-cell-qty border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        <div className="order-qty-content grid gap-2">
          <div className="order-qty-badge flex w-fit items-baseline gap-1 rounded bg-tint px-2.5 py-1 text-accent print:bg-panel print:px-0 print:py-0 print:text-ink">
            <span className="text-xs font-semibold">発注</span>
            <span className="text-lg font-bold tabular-nums print:text-xs">{row.requestedQuantity}</span>
            {row.status === "SUGGESTED" && row.orderUnit ? <span className="text-sm print:hidden">（{row.orderUnit}）</span> : null}
          </div>
          {row.status === "SUGGESTED" ? (
            <details className="order-qty-details text-sm text-muted print:hidden">
              <summary className="min-h-10 cursor-pointer py-2 text-accent">計算の内訳</summary>
              <p>基準 {row.minStock} − 現在庫 {row.quantity} − 納品待ち {row.pendingOrderedQuantity} − 発注予定 {row.plannedQuantity}</p>
            </details>
          ) : null}
          {canChangeQuantity && activePanel === "quantity" ? (
            <form action={quantityAction} className="order-qty-form grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
              <input type="hidden" name="orderRequestId" value={row.id} />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity - 1)}
                  disabled={requestedQuantity <= 1 || isQuantityPending}
                  className="h-10 w-10 rounded btn-secondary text-base font-semibold transition disabled:cursor-not-allowed"
                  aria-label="発注数量を1減らす"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="requestedQuantity"
                  value={requestedQuantity}
                  onChange={(event) => changeRequestedQuantity(Number(event.target.value))}
                  className="h-10 w-20 rounded border border-line bg-panel/90 px-3 text-right text-sm"
                />
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity + 1)}
                  disabled={requestedQuantity >= 9999 || isQuantityPending}
                  className="h-10 w-10 rounded btn-secondary text-base font-semibold transition disabled:cursor-not-allowed"
                  aria-label="発注数量を1増やす"
                >
                  +
                </button>
                <button
                  type="submit"
                  disabled={isQuantityPending}
                  className="min-h-10 w-full rounded btn-secondary px-3 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {isQuantityPending ? "更新中" : row.status === "SUGGESTED" ? "この数量で発注予定へ" : "更新"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </td>
      <td className="order-cell-record border-b border-line px-3 py-2 print:hidden">
        <div className="order-record-content grid gap-2">
          {((isAwaitingReceipt && (awaitingReceiptSummary || hasRecordDetails)) || isReceived || ((isPlanned || row.status === "SKIPPED") && row.memo)) ? (
            <div className="order-record-summary min-w-0">
              {isAwaitingReceipt ? (
                awaitingReceiptSummary ? <p className="line-clamp-1 text-sm text-muted">{awaitingReceiptSummary}</p> : null
              ) : isReceived ? (
                <p className="line-clamp-1 text-sm font-semibold text-success">
                  ✓ {row.receivedAt ? shortDateFormatter.format(row.receivedAt) : ""} 受領 {row.receivedQuantity ?? "—"}個
                  {row.receivedByStaffName ? "・" + row.receivedByStaffName : ""}
                </p>
              ) : (
                <p className="line-clamp-1 text-sm text-muted">{row.memo}</p>
              )}
              {hasRecordDetails ? (
                <details className="text-sm text-muted print:hidden">
                  <summary className="min-h-10 cursor-pointer py-2 text-accent">記録の詳細</summary>
                  <div className="grid gap-1 border-l-2 border-line pl-2">
                    {row.orderRecordId ? <p>発注記録ID: {formatOrderRecordId(row.orderRecordId)}</p> : null}
                    {row.orderedMemo ? <p>送付メモ: {row.orderedMemo}</p> : null}
                    {row.supplierResponseMemo ? <p>先方対応メモ: {row.supplierResponseMemo}</p> : null}
                    {row.receivedMemo ? <p>納品メモ: {row.receivedMemo}</p> : null}
                    {showMemoInDetails ? <p>備考メモ: {row.memo}</p> : null}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
          <div className="order-record-actions flex flex-wrap gap-2">
            {canChangeQuantity && !isAwaitingReceipt ? (
              <button type="button" onClick={() => togglePanel("quantity")}
                aria-expanded={activePanel === "quantity"}
                className="inline-flex min-h-10 items-center whitespace-nowrap rounded btn-secondary px-3 text-sm font-semibold transition">
                {activePanel === "quantity" ? "閉じる" : "数量を変える"}
              </button>
            ) : null}
            {isAwaitingReceipt ? (
              <button
                type="button"
                onClick={() => togglePanel("receipt")}
                aria-expanded={activePanel === "receipt"}
                className="inline-flex min-h-10 items-center whitespace-nowrap rounded btn-secondary px-3 text-sm font-semibold transition"
              >
                {activePanel === "receipt" ? "閉じる" : "納品確認"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => togglePanel("more")}
              aria-expanded={activePanel === "more"}
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded btn-secondary px-3 text-sm font-semibold transition"
            >
              {activePanel === "more" ? "閉じる" : "その他"}
            </button>
          </div>
          {activePanel === "receipt" && isAwaitingReceipt ? (
            <form action={receiptAction} className="order-receipt-form grid gap-2 rounded border border-line border-l-4 border-l-ink bg-markSoft p-2">
              <input type="hidden" name="orderRequestId" value={row.id} />
              <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
              <p className="text-sm font-semibold text-muted">
                確認スタッフ: {selectedStaffOperator ? selectedStaffOperator.displayName : "画面上部で選択してください"}
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  納品数量
                  <input type="number" name="receivedQuantity" min={1} max={row.requestedQuantity}
                    defaultValue={row.requestedQuantity}
                    className="h-10 rounded border border-line bg-panel px-3 text-right text-sm" />
                </label>
                <label className="flex min-h-10 items-center gap-2 whitespace-nowrap text-sm font-semibold text-muted">
                  <input type="checkbox" name="applyToStock" defaultChecked className="h-4 w-4 accent-accent" />
                  在庫反映
                </label>
              </div>
              <textarea name="receivedMemo" placeholder="納品メモ" aria-label="納品メモ" maxLength={200}
                className="min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm" />
              <button type="submit" disabled={isReceiptPending || !hasSelectedStaffOperator}
                className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold transition disabled:cursor-not-allowed">
                {isReceiptPending ? "確認中" : "納品を確認"}
              </button>
              {!hasStaffOperators ? <p className="text-sm text-danger">有効な作業スタッフがありません。</p>
                : !hasSelectedStaffOperator ? <p className="text-sm text-ink">画面上部で作業スタッフを選択してください。</p> : null}
            </form>
          ) : null}
          {activePanel === "more" ? (
            <div className="order-more-panel grid gap-2 rounded border border-line bg-subtle/60 p-2">
              {isAwaitingReceipt && canChangeQuantity ? (
                <button type="button" onClick={() => togglePanel("quantity")}
                  className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                  数量を変える
                </button>
              ) : null}
              {row.status === "SUGGESTED" ? (
                <form action={statusAction}>
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="status" value="CONFIRMED" />
                  <button type="submit" disabled={isStatusPending}
                    className="min-h-10 w-full rounded btn-secondary px-3 text-left text-sm font-semibold">
                    この行だけ発注予定へ
                  </button>
                </form>
              ) : null}
              {canChangeSupplier ? (
                <button type="button" onClick={() => togglePanel("supplier")}
                  className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                  発注先を変更
                </button>
              ) : null}
              {row.status === "SUGGESTED" || isPlanned ? (
                <button type="button" onClick={() => setMoreForm(moreForm === "skip" ? null : "skip")}
                  aria-expanded={moreForm === "skip"}
                  className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                  見送り
                </button>
              ) : null}
              {isPlanned ? (
                <button type="button" onClick={() => setMoreForm(moreForm === "order" ? null : "order")}
                  aria-expanded={moreForm === "order"}
                  className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                  この行だけ発注を記録
                </button>
              ) : null}
              {isAwaitingReceipt ? (
                <>
                  <button type="button" onClick={() => setMoreForm(moreForm === "edit-record" ? null : "edit-record")}
                    aria-expanded={moreForm === "edit-record"}
                    className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                    発注記録を修正
                  </button>
                  <form action={statusAction}>
                    <input type="hidden" name="orderRequestId" value={row.id} />
                    <input type="hidden" name="status" value="CONFIRMED" />
                    <button type="submit" disabled={isStatusPending}
                      className="min-h-10 w-full rounded btn-secondary px-3 text-left text-sm font-semibold">
                      発注予定に戻す
                    </button>
                    <p className="text-sm text-muted">誤って発注を記録した場合に使います。</p>
                  </form>
                  <form action={statusAction}>
                    <input type="hidden" name="orderRequestId" value={row.id} />
                    <input type="hidden" name="status" value="SKIPPED" />
                    <button type="submit" disabled={isStatusPending}
                      className="min-h-10 w-full rounded btn-secondary px-3 text-left text-sm font-semibold">
                      納品待ちを打ち切る（見送り）
                    </button>
                    <p className="text-sm text-muted">入荷しない分を待たない時に使います。納品待ちの合計から外れます。</p>
                  </form>
                </>
              ) : null}
              {row.status === "SKIPPED" ? (
                <form action={statusAction}>
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="status" value="CONFIRMED" />
                  <button type="submit" disabled={isStatusPending}
                    className="min-h-10 w-full rounded btn-secondary px-3 text-left text-sm font-semibold">
                    発注予定に戻す
                  </button>
                </form>
              ) : null}
              {(isPlanned || isAwaitingReceipt || row.status === "SKIPPED") ? (
                <button type="button" onClick={() => setMoreForm(moreForm === "memo" ? null : "memo")}
                  aria-expanded={moreForm === "memo"}
                  className="min-h-10 rounded btn-secondary px-3 text-left text-sm font-semibold">
                  メモを編集
                </button>
              ) : null}
              {isReceived ? (
                <form action={receiptRevertAction}>
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <button type="submit" disabled={isReceiptRevertPending}
                    className="min-h-10 w-full rounded btn-secondary btn-danger px-3 text-left text-sm font-semibold">
                    {isReceiptRevertPending ? "取り消し中" : "納品確認を取り消す"}
                  </button>
                </form>
              ) : null}
              {moreForm === "skip" && (row.status === "SUGGESTED" || isPlanned) ? (
                <form action={statusAction} className="grid gap-2 border-t border-line pt-2">
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="status" value="SKIPPED" />
                  <textarea name="memo" defaultValue={row.memo ?? ""} maxLength={200}
                    placeholder="見送り理由・メモ（任意）" aria-label="見送り理由・メモ"
                    className="min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm" />
                  <button type="submit" disabled={isStatusPending}
                    className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold">見送りを確定</button>
                </form>
              ) : null}
              {(moreForm === "order" && isPlanned) || (moreForm === "edit-record" && isAwaitingReceipt) ? (
                <form action={statusAction} className="grid gap-2 border-t border-line pt-2">
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="status" value="ORDERED" />
                  {moreForm === "order" ? (
                    <>
                      <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
                      <p className="text-sm text-muted">
                        発注スタッフ: {selectedStaffOperator ? selectedStaffOperator.displayName : "画面上部で選択してください"}
                      </p>
                    </>
                  ) : null}
                  <label className="grid gap-1 text-sm font-semibold text-muted">
                    送付方法
                    <select name="orderedMethod" required defaultValue={row.orderedMethod ?? ""}
                      className="h-10 rounded border border-line bg-panel px-3 text-sm">
                      <option value="" disabled>選択してください</option>
                      {orderSendMethodValues.map((method) => (
                        <option key={method} value={method}>{orderSendMethodLabels[method]}</option>
                      ))}
                    </select>
                  </label>
                  <textarea name="orderedMemo" defaultValue={row.orderedMemo ?? ""}
                    placeholder="送付メモ（任意）" aria-label="送付メモ" maxLength={300}
                    className="min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm" />
                  <textarea name="supplierResponseMemo" defaultValue={row.supplierResponseMemo ?? ""}
                    placeholder="先方対応メモ（任意）" aria-label="先方対応メモ" maxLength={300}
                    className="min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm" />
                  <button type="submit" disabled={isStatusPending || (moreForm === "order" && !hasSelectedStaffOperator)}
                    className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold disabled:cursor-not-allowed">
                    {moreForm === "order" ? "発注を記録" : "発注記録を更新"}
                  </button>
                  {moreForm === "order" && !hasStaffOperators ? <p className="text-sm text-danger">有効な作業スタッフがありません。</p>
                    : moreForm === "order" && !hasSelectedStaffOperator ? <p className="text-sm text-ink">画面上部で作業スタッフを選択してください。</p> : null}
                </form>
              ) : null}
              {moreForm === "memo" && (isPlanned || isAwaitingReceipt || row.status === "SKIPPED") ? (
                <form action={statusAction} className="grid gap-2 border-t border-line pt-2">
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="status" value={row.status} />
                  <input type="hidden" name="memoOnly" value="on" />
                  <textarea name="memo" defaultValue={row.memo ?? ""} maxLength={200}
                    placeholder="備考メモ" aria-label="備考メモ"
                    className="min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm" />
                  <button type="submit" disabled={isStatusPending}
                    className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold">メモを保存</button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>
      <td
        className={
          row.status === "SKIPPED"
            ? "order-cell-print hidden border-b border-line px-4 py-3 text-muted print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold print:text-ink"
            : row.status === "ORDERED"
              ? "order-cell-print hidden border-b border-line px-4 py-3 text-success print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold print:text-ink"
            : "order-cell-print hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold"
        }
      >
        {getOrderRowStatusLabel(row)}
      </td>
      <td className="order-cell-print hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5">
        {row.memo ?? "-"}
      </td>
      <td className="order-cell-print hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5" />
    </tr>
  );
}
