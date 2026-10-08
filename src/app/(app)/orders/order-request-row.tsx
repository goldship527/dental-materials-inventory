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
  orderRequestStatuses,
  orderRequestStatusLabels,
  printableOrderRequestStatuses,
  type OrderRequestStatusValue,
} from "@/lib/orders/status";

const initialState: OrderActionState = {};
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
type OrderRequestRowProps = {
  clinicId: string;
  row: OrderRequestRow;
  staffOperators: StaffOperatorOption[];
};

type ActiveOrderPanel = "supplier" | "quantity" | "receipt" | "status" | null;

const statusOptions = orderRequestStatuses.filter((status) => status !== "SUGGESTED");
const statusOptionLabels: Record<OrderRequestStatusValue, string> = {
  SUGGESTED: "確認待ち",
  DRAFT: "発注予定",
  CONFIRMED: "発注予定",
  ORDERED: "納品待ち",
  SKIPPED: "見送り",
};

function formatOrderRecordId(orderRecordId: string | null) {
  return orderRecordId ? orderRecordId.slice(-8) : "-";
}

function getStatusBadgeClass(row: OrderRequestRow) {
  if (row.status === "SUGGESTED") {
    return "border-line bg-tint text-accent";
  }
  if (row.status === "SKIPPED") {
    return "border-line bg-subtle text-muted";
  }

  if (row.status === "ORDERED" && row.receivedAt) {
    return "border-line bg-panel text-success";
  }

  if (row.status === "ORDERED") {
    return "border-line bg-markSoft text-ink";
  }

  if (row.status === "CONFIRMED") {
    return "border-line bg-tint text-accent";
  }

  return "border-line bg-panel text-muted";
}

function getRowToneClass(row: OrderRequestRow) {
  if (row.status === "SUGGESTED") {
    return "border-l-4 border-l-blue-400";
  }
  if (row.status === "ORDERED" && row.receivedAt) {
    return "border-l-4 border-l-green-400";
  }

  if (row.status === "ORDERED") {
    return "border-l-4 border-l-yellow-400";
  }

  if (row.status === "SKIPPED") {
    return "border-l-4 border-l-gray-300";
  }

  if (printableOrderRequestStatuses.includes(row.status)) {
    return "border-l-4 border-l-teal-500";
  }

  return "";
}

function getOrderRowStatusLabel(row: OrderRequestRow) {
  if (row.status === "ORDERED") {
    return row.receivedAt ? "納品済み" : "納品待ち";
  }

  return orderRequestStatusLabels[row.status];
}

export function OrderRequestTableRow({ clinicId, row, staffOperators }: OrderRequestRowProps) {
  const [activePanel, setActivePanel] = useState<ActiveOrderPanel>(null);
  const [requestedQuantity, setRequestedQuantity] = useState(row.requestedQuantity);
  const [selectedStatus, setSelectedStatus] = useState<OrderRequestStatusValue>(
    row.status === "DRAFT" || row.status === "SUGGESTED" ? "CONFIRMED" : row.status,
  );
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
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });
  const hasSelectedStaffOperator = selectedStaffOperatorId.length > 0;
  const requiresStaffForStatus = selectedStatus === "ORDERED" && row.status !== "ORDERED";

  function changeRequestedQuantity(nextQuantity: number) {
    const normalizedQuantity = Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(nextQuantity) ? nextQuantity : 1)));

    setRequestedQuantity(normalizedQuantity);
  }

  function togglePanel(panel: Exclude<ActiveOrderPanel, null>) {
    setActivePanel((currentPanel) => (currentPanel === panel ? null : panel));
  }

  return (
    <tr className={`align-top transition hover:bg-subtle/60 print:break-inside-avoid ${getRowToneClass(row)}`}>
      <td className="border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
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
      <td className="border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        <div className="grid w-44 grid-cols-3 gap-2 rounded border border-line bg-panel px-2 py-1.5 text-center print:w-auto print:border-0 print:p-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">現在</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-xs">{row.quantity}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">最低</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-xs">{row.minStock}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted print:text-xs print:text-ink">不足</p>
            <p className="text-lg font-bold tabular-nums text-danger print:text-xs print:text-ink">
              {row.shortageCount}
            </p>
          </div>
        </div>
        {row.status === "SUGGESTED" ? (
          <div className="mt-2 grid gap-1 rounded border border-line bg-tint px-2 py-1.5 text-xs text-accent print:hidden">
            <span className="font-semibold">不足 {row.requestedQuantity}{row.orderUnit ? `（${row.orderUnit}）` : ""}</span>
            <span>
              基準 {row.minStock} − 現在庫 {row.quantity} − 納品待ち {row.pendingOrderedQuantity} − 発注予定 {row.plannedQuantity}
            </span>
          </div>
        ) : null}
      </td>
      <td className="border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
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
            <button
              type="button"
              onClick={() => togglePanel("supplier")}
              className="inline-flex h-8 w-fit items-center rounded btn-secondary px-3 text-xs font-semibold transition"
            >
              {activePanel === "supplier" ? "閉じる" : "発注先を変更"}
            </button>
            {activePanel === "supplier" ? (
              <form action={supplierAction} className="grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
                <input type="hidden" name="orderRequestId" value={row.id} />
                <select
                  name="supplierId"
                  value={selectedSupplierId}
                  onChange={(event) => setSelectedSupplierId(event.target.value)}
                  className="h-9 rounded border border-line bg-panel/90 px-3 text-sm    "
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
                  className="h-8 rounded btn-secondary px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
                >
                  {isSupplierPending ? "変更中" : "発注先を変更"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="border-b border-line px-3 py-2 print:border print:border-ink print:px-2 print:py-1.5">
        <div className="grid gap-2">
          <div className="flex w-fit items-baseline gap-1 rounded bg-tint px-2.5 py-1 text-accent print:bg-panel print:px-0 print:py-0 print:text-ink">
            <span className="text-xs font-semibold">発注</span>
            <span className="text-lg font-bold tabular-nums print:text-xs">{row.requestedQuantity}</span>
          </div>
          {canChangeQuantity ? (
            <button
              type="button"
              onClick={() => togglePanel("quantity")}
              className="inline-flex h-8 w-fit items-center rounded btn-secondary px-3 text-xs font-semibold transition print:hidden"
            >
              {activePanel === "quantity"
                ? "閉じる"
                : row.status === "SUGGESTED"
                  ? "数量を変えて発注予定へ"
                  : "数量変更"}
            </button>
          ) : null}
          {canChangeQuantity && activePanel === "quantity" ? (
            <form action={quantityAction} className="grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
              <input type="hidden" name="orderRequestId" value={row.id} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity - 1)}
                  disabled={requestedQuantity <= 1 || isQuantityPending}
                  className="h-9 w-9 rounded btn-secondary text-base font-semibold transition disabled:cursor-not-allowed"
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
                  className="h-9 w-20 rounded border border-line bg-panel/90 px-3 text-right    "
                />
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity + 1)}
                  disabled={requestedQuantity >= 9999 || isQuantityPending}
                  className="h-9 w-9 rounded btn-secondary text-base font-semibold transition disabled:cursor-not-allowed"
                  aria-label="発注数量を1増やす"
                >
                  +
                </button>
                <button
                  type="submit"
                  disabled={isQuantityPending}
                  className="h-9 rounded btn-primary px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
                >
                  {isQuantityPending ? "更新中" : "更新"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </td>
      <td className="border-b border-line px-3 py-2 print:hidden">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex min-h-7 items-center rounded border px-2.5 py-1 text-label font-semibold ${getStatusBadgeClass(row)}`}
            >
              {getOrderRowStatusLabel(row)}
            </span>
            {row.status === "ORDERED" && row.orderedAt ? (
              <span className="text-xs text-muted">{dateTimeFormatter.format(row.orderedAt)}</span>
            ) : null}
            {row.status === "ORDERED" && row.receivedAt ? (
              <span className="rounded border border-line bg-tint px-2 py-1 text-xs font-semibold text-accent">
                納品済み
              </span>
            ) : null}
          </div>
          {row.status === "SUGGESTED" ? (
            <div className="flex flex-wrap gap-2">
              <form action={statusAction}>
                <input type="hidden" name="orderRequestId" value={row.id} />
                <input type="hidden" name="status" value="CONFIRMED" />
                <button
                  type="submit"
                  disabled={isStatusPending}
                  className="h-8 rounded btn-primary px-3 text-xs font-semibold transition"
                >
                  確認して発注予定へ
                </button>
              </form>
              <form action={statusAction}>
                <input type="hidden" name="orderRequestId" value={row.id} />
                <input type="hidden" name="status" value="SKIPPED" />
                <button
                  type="submit"
                  disabled={isStatusPending}
                  className="h-8 rounded btn-secondary px-3 text-xs font-semibold transition"
                >
                  見送り
                </button>
              </form>
            </div>
          ) : null}
          {row.status === "ORDERED" ? (
            <div className="grid gap-0.5 text-xs text-muted">
              {row.orderRecordId ? <span>発注記録: {formatOrderRecordId(row.orderRecordId)}</span> : null}
              {row.orderedByStaffName ? <span>発注スタッフ: {row.orderedByStaffName}</span> : null}
              {row.orderedMethod ? <span>送付方法: {orderSendMethodLabels[row.orderedMethod]}</span> : null}
              {row.orderedMemo ? <span className="line-clamp-1">送付メモ: {row.orderedMemo}</span> : null}
              {row.supplierResponseMemo ? (
                <span className="line-clamp-1">先方対応メモ: {row.supplierResponseMemo}</span>
              ) : null}
            </div>
          ) : null}
          {row.memo ? <p className="line-clamp-2 text-xs text-muted">{row.memo}</p> : null}
          <button
            type="button"
            onClick={() => togglePanel("status")}
            className="inline-flex h-8 w-fit items-center rounded btn-secondary px-3 text-xs font-semibold transition"
          >
            {activePanel === "status" ? "閉じる" : "状態・メモを編集"}
          </button>
          {row.status === "ORDERED" && row.receivedAt ? (
            <div className="grid gap-1.5 rounded border border-line bg-panel px-3 py-2 text-xs font-semibold text-success">
              <span>
                納品済み {dateTimeFormatter.format(row.receivedAt)} / {row.receivedQuantity ?? "-"} 個
              </span>
              {row.receivedByStaffName ? (
                <span className="font-normal text-muted">確認スタッフ: {row.receivedByStaffName}</span>
              ) : null}
              {row.receivedMemo ? <span className="font-normal text-muted">{row.receivedMemo}</span> : null}
              <form action={receiptRevertAction}>
                <input type="hidden" name="orderRequestId" value={row.id} />
                <button
                  type="submit"
                  disabled={isReceiptRevertPending}
                  className="h-8 rounded btn-secondary btn-danger px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
                >
                  {isReceiptRevertPending ? "取り消し中" : "納品確認を取り消す"}
                </button>
              </form>
            </div>
          ) : null}
          {row.status === "ORDERED" && !row.receivedAt ? (
            <div className="grid gap-1.5">
              <button
                type="button"
                onClick={() => togglePanel("receipt")}
                className="inline-flex h-8 w-fit items-center rounded btn-secondary bg-markSoft px-3 text-xs font-semibold transition"
              >
                {activePanel === "receipt" ? "閉じる" : "納品確認"}
              </button>
              {activePanel === "receipt" ? (
                <form action={receiptAction} className="grid gap-1.5 rounded border border-line bg-markSoft p-2">
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
                  <p className="text-xs font-semibold text-muted">
                    確認スタッフ: {selectedStaffOperator ? selectedStaffOperator.displayName : "画面上部で選択してください"}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-label font-semibold text-muted">
                      納品数量
                      <input
                        type="number"
                        name="receivedQuantity"
                        min={1}
                        max={row.requestedQuantity}
                        defaultValue={row.requestedQuantity}
                        className="h-9 rounded border border-line bg-panel px-3 text-right text-sm    "
                      />
                    </label>
                    <label className="flex h-9 items-center gap-2 whitespace-nowrap text-label font-semibold text-muted">
                      <input type="checkbox" name="applyToStock" defaultChecked className="h-4 w-4 accent-accent" />
                      在庫反映
                    </label>
                  </div>
                  <textarea
                    name="receivedMemo"
                    placeholder="納品メモ"
                    maxLength={200}
                    className="h-10 min-h-10 rounded border border-line bg-panel px-3 py-2 text-sm    "
                  />
                  <button
                    type="submit"
                    disabled={isReceiptPending || !hasSelectedStaffOperator}
                    className="h-9 rounded px-3 text-xs font-semibold btn-secondary transition disabled:cursor-not-allowed"
                  >
                    {isReceiptPending ? "確認中" : "納品を確認"}
                  </button>
                  {!hasStaffOperators ? (
                    <p className="text-xs font-semibold text-danger">有効な作業スタッフがありません。</p>
                  ) : !hasSelectedStaffOperator ? (
                    <p className="text-xs font-semibold text-ink">画面上部で作業スタッフを選択してください。</p>
                  ) : null}
                </form>
              ) : null}
            </div>
          ) : null}
          {activePanel === "status" ? (
            <form action={statusAction} className="grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
          <input type="hidden" name="orderRequestId" value={row.id} />
          <select
            name="status"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as OrderRequestStatusValue)}
            className={
              selectedStatus === "SKIPPED"
                ? "h-9 rounded border border-line bg-subtle px-3 text-sm font-semibold text-muted    "
                : selectedStatus === "ORDERED"
                  ? "h-9 rounded border border-success bg-panel px-3 text-sm font-semibold text-success    "
                  : "h-9 rounded border border-line bg-panel px-3 text-sm    "
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusOptionLabels[status]}
              </option>
            ))}
          </select>
          {row.status === "ORDERED" ? (
            <p className="rounded border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-success">
              誤って発注を記録した場合は、発注予定に戻せます。
            </p>
          ) : null}
          {selectedStatus === "SKIPPED" ? (
            <p className="text-xs font-semibold text-muted">見送りにした候補は発注書下書きに含めません。</p>
          ) : null}
          {selectedStatus === "ORDERED" ? (
            <p className="text-xs font-semibold text-success">発注を記録した候補は納品待ちになり、発注書下書きには含めません。</p>
          ) : null}
          {row.status === "ORDERED" && row.orderedAt ? (
            <p className="text-xs text-muted">発注記録日時: {dateTimeFormatter.format(row.orderedAt)}</p>
          ) : null}
          {row.status === "ORDERED" && row.orderRecordId ? (
            <p className="text-xs text-muted">発注記録: {formatOrderRecordId(row.orderRecordId)}</p>
          ) : null}
          {row.status === "ORDERED" && row.orderedMethod ? (
            <p className="text-xs text-muted">送付方法: {orderSendMethodLabels[row.orderedMethod]}</p>
          ) : null}
          {row.status === "ORDERED" && row.orderedByStaffName ? (
            <p className="text-xs text-muted">発注スタッフ: {row.orderedByStaffName}</p>
          ) : null}
          {row.status === "ORDERED" && row.orderedMemo ? (
            <p className="text-xs text-muted">送付メモ: {row.orderedMemo}</p>
          ) : null}
          {row.status === "ORDERED" && row.supplierResponseMemo ? (
            <p className="text-xs text-muted">先方対応メモ: {row.supplierResponseMemo}</p>
          ) : null}
          {selectedStatus === "ORDERED" ? (
            <>
              {requiresStaffForStatus ? (
                <>
                  <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
                  <p className="text-xs font-semibold text-muted">
                    発注スタッフ: {selectedStaffOperator ? selectedStaffOperator.displayName : "画面上部で選択してください"}
                  </p>
                </>
              ) : null}
              <label className="grid gap-1 text-label font-semibold text-muted">
                送付方法
                <select
                  name="orderedMethod"
                  required
                  defaultValue={row.orderedMethod ?? ""}
                  className="h-9 rounded border border-line bg-panel px-3 text-sm    "
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {orderSendMethodValues.map((method) => (
                    <option key={method} value={method}>
                      {orderSendMethodLabels[method]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <textarea
                  name="orderedMemo"
                  defaultValue={row.orderedMemo ?? ""}
                  placeholder="送付メモ（任意）"
                  maxLength={300}
                  className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm    "
                />
                <textarea
                  name="supplierResponseMemo"
                  defaultValue={row.supplierResponseMemo ?? ""}
                  placeholder="先方対応メモ（任意）"
                  maxLength={300}
                  className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm    "
                />
              </div>
            </>
          ) : null}
          <textarea
            name="memo"
            defaultValue={row.memo ?? ""}
            placeholder={
              selectedStatus === "SKIPPED" ? "見送り理由・メモ" : selectedStatus === "ORDERED" ? "送付メモ" : "備考メモ"
            }
            maxLength={200}
            className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm    "
          />
          <button
            type="submit"
            disabled={isStatusPending || (requiresStaffForStatus && !hasSelectedStaffOperator)}
            className="h-9 rounded btn-secondary px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
          >
            {isStatusPending ? "変更中" : "状態・メモを更新"}
          </button>
          {requiresStaffForStatus && !hasStaffOperators ? (
            <p className="text-xs font-semibold text-danger">有効な作業スタッフがありません。</p>
          ) : requiresStaffForStatus && !hasSelectedStaffOperator ? (
            <p className="text-xs font-semibold text-ink">画面上部で作業スタッフを選択してください。</p>
          ) : null}
            </form>
          ) : null}
        </div>
      </td>
      <td
        className={
          row.status === "SKIPPED"
            ? "hidden border-b border-line px-4 py-3 text-muted print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold print:text-ink"
            : row.status === "ORDERED"
              ? "hidden border-b border-line px-4 py-3 text-success print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold print:text-ink"
            : "hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold"
        }
      >
        {getOrderRowStatusLabel(row)}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5">
        {row.memo ?? "-"}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-ink print:px-2 print:py-1.5" />
    </tr>
  );
}
