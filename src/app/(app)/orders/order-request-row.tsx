"use client";

import { useActionState, useState } from "react";
import {
  receiveOrderRequestWithStateAction,
  revertOrderReceiptWithStateAction,
  updateOrderRequestQuantityWithStateAction,
  updateOrderRequestSupplierWithStateAction,
  updateOrderRequestStatusWithStateAction,
  type OrderActionState,
} from "@/lib/actions/orders";
import type { OrderRequestRow } from "@/lib/db/orders";
import { orderSendMethodLabels, orderSendMethodValues } from "@/lib/orders/send-method";
import {
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
  row: OrderRequestRow;
};

type ActiveOrderPanel = "supplier" | "quantity" | "receipt" | "status" | null;

const statusOptions = orderRequestStatuses;
const statusOptionLabels: Record<OrderRequestStatusValue, string> = {
  DRAFT: "発注予定",
  CONFIRMED: "発注予定",
  ORDERED: "納品待ち",
  SKIPPED: "見送り",
};

function formatOrderRecordId(orderRecordId: string | null) {
  return orderRecordId ? orderRecordId.slice(-8) : "-";
}

function getStatusBadgeClass(row: OrderRequestRow) {
  if (row.status === "SKIPPED") {
    return "border-line bg-subtle text-muted";
  }

  if (row.status === "ORDERED" && row.receivedAt) {
    return "border-green-100 bg-green-50 text-success";
  }

  if (row.status === "ORDERED") {
    return "border-yellow-200 bg-yellow-50 text-warning";
  }

  if (row.status === "CONFIRMED") {
    return "border-teal-100 bg-teal-50 text-accent";
  }

  return "border-line bg-white text-muted";
}

function getRowToneClass(row: OrderRequestRow) {
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

export function OrderRequestTableRow({ row }: OrderRequestRowProps) {
  const [activePanel, setActivePanel] = useState<ActiveOrderPanel>(null);
  const [requestedQuantity, setRequestedQuantity] = useState(row.requestedQuantity);
  const [selectedStatus, setSelectedStatus] = useState<OrderRequestStatusValue>(row.status === "DRAFT" ? "CONFIRMED" : row.status);
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
  const canChangeSupplier = printableOrderRequestStatuses.includes(row.status) && row.supplierOptions.length > 0;

  function changeRequestedQuantity(nextQuantity: number) {
    const normalizedQuantity = Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(nextQuantity) ? nextQuantity : 1)));

    setRequestedQuantity(normalizedQuantity);
  }

  function togglePanel(panel: Exclude<ActiveOrderPanel, null>) {
    setActivePanel((currentPanel) => (currentPanel === panel ? null : panel));
  }

  return (
    <tr className={`align-top transition hover:bg-subtle/60 print:break-inside-avoid ${getRowToneClass(row)}`}>
      <td className="border-b border-line px-3 py-2 print:border print:border-black print:px-2 print:py-1.5">
        <a
          className="font-semibold text-accent hover:underline print:text-black print:no-underline"
          href={`/products/${row.productId}`}
        >
          {row.name}
        </a>
        <p className="mt-0.5 text-xs text-muted print:mt-0.5 print:text-[9px] print:text-black">
          {row.productCode ?? "コード未設定"} / {row.category ?? "未分類"}
        </p>
        {activeState.message ? (
          <p
            className={
              activeState.status === "success"
                ? "mt-1.5 rounded bg-green-50 px-3 py-1.5 text-xs font-semibold text-success print:hidden"
                : "mt-1.5 rounded bg-red-50 px-3 py-1.5 text-xs font-semibold text-danger print:hidden"
            }
          >
            {activeState.message}
          </p>
        ) : null}
      </td>
      <td className="border-b border-line px-3 py-2 print:border print:border-black print:px-2 print:py-1.5">
        <div className="grid w-44 grid-cols-3 gap-2 rounded border border-line bg-white px-2 py-1.5 text-center print:w-auto print:border-0 print:p-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted print:text-[9px] print:text-black">現在</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-[11px]">{row.quantity}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted print:text-[9px] print:text-black">最低</p>
            <p className="text-lg font-bold tabular-nums text-ink print:text-[11px]">{row.minStock}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted print:text-[9px] print:text-black">不足</p>
            <p className="text-lg font-bold tabular-nums text-danger print:text-[11px] print:text-black">
              {row.shortageCount}
            </p>
          </div>
        </div>
      </td>
      <td className="border-b border-line px-3 py-2 print:border print:border-black print:px-2 print:py-1.5">
        {row.supplierId && row.supplierName ? (
          <div className="grid gap-1 print:block">
            <a
              className="text-accent hover:underline print:text-black print:no-underline"
              href={`/suppliers/${row.supplierId}`}
            >
              {row.supplierName}
            </a>
            <div className="grid gap-0.5 text-xs text-muted print:text-[9px] print:text-black">
              {row.supplierProductCode ? <span>発注先品番: {row.supplierProductCode}</span> : null}
              {row.orderUnit ? <span>単位: {row.orderUnit}</span> : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-1 print:block">
            <span className="text-danger print:text-black">発注先未設定</span>
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
              className="inline-flex h-8 w-fit items-center rounded border border-line bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
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
                  className="h-9 rounded border border-line bg-white/90 px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                  className="h-8 rounded border border-line bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSupplierPending ? "変更中" : "発注先を変更"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="border-b border-line px-3 py-2 print:border print:border-black print:px-2 print:py-1.5">
        <div className="grid gap-2">
          <div className="flex w-fit items-baseline gap-1 rounded bg-teal-50 px-2.5 py-1 text-accent print:bg-white print:px-0 print:py-0 print:text-black">
            <span className="text-[10px] font-semibold">発注</span>
            <span className="text-xl font-bold tabular-nums print:text-[12px]">{row.requestedQuantity}</span>
          </div>
          <button
            type="button"
            onClick={() => togglePanel("quantity")}
            className="inline-flex h-8 w-fit items-center rounded border border-line bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent print:hidden"
          >
            {activePanel === "quantity" ? "閉じる" : "数量変更"}
          </button>
          {activePanel === "quantity" ? (
            <form action={quantityAction} className="grid gap-1.5 rounded border border-line bg-subtle/60 p-2">
              <input type="hidden" name="orderRequestId" value={row.id} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity - 1)}
                  disabled={requestedQuantity <= 1 || isQuantityPending}
                  className="h-9 w-9 rounded border border-line bg-white/75 text-base font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="h-9 w-20 rounded border border-line bg-white/90 px-3 text-right outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => changeRequestedQuantity(requestedQuantity + 1)}
                  disabled={requestedQuantity >= 9999 || isQuantityPending}
                  className="h-9 w-9 rounded border border-line bg-white/75 text-base font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="発注数量を1増やす"
                >
                  +
                </button>
                <button
                  type="submit"
                  disabled={isQuantityPending}
                  className="h-9 rounded bg-ink px-3 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              className={`inline-flex min-h-7 items-center rounded border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row)}`}
            >
              {getOrderRowStatusLabel(row)}
            </span>
            {row.status === "ORDERED" && row.orderedAt ? (
              <span className="text-xs text-muted">{dateTimeFormatter.format(row.orderedAt)}</span>
            ) : null}
            {row.status === "ORDERED" && row.receivedAt ? (
              <span className="rounded border border-teal-100 bg-teal-50 px-2 py-1 text-xs font-semibold text-accent">
                納品済み
              </span>
            ) : null}
          </div>
          {row.status === "ORDERED" ? (
            <div className="grid gap-0.5 text-xs text-muted">
              {row.orderRecordId ? <span>発注記録: {formatOrderRecordId(row.orderRecordId)}</span> : null}
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
            className="inline-flex h-8 w-fit items-center rounded border border-line bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
          >
            {activePanel === "status" ? "閉じる" : "状態・メモを編集"}
          </button>
          {row.status === "ORDERED" && row.receivedAt ? (
            <div className="grid gap-1.5 rounded border border-green-100 bg-green-50 px-3 py-2 text-xs font-semibold text-success">
              <span>
                納品済み {dateTimeFormatter.format(row.receivedAt)} / {row.receivedQuantity ?? "-"} 個
              </span>
              {row.receivedByUserName ? (
                <span className="font-normal text-muted">確認者: {row.receivedByUserName}</span>
              ) : null}
              {row.receivedMemo ? <span className="font-normal text-muted">{row.receivedMemo}</span> : null}
              <form action={receiptRevertAction}>
                <input type="hidden" name="orderRequestId" value={row.id} />
                <button
                  type="submit"
                  disabled={isReceiptRevertPending}
                  className="h-8 rounded border border-green-200 bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex h-8 w-fit items-center rounded border border-yellow-200 bg-yellow-50 px-3 text-xs font-semibold text-warning transition hover:border-warning hover:bg-white"
              >
                {activePanel === "receipt" ? "閉じる" : "納品確認"}
              </button>
              {activePanel === "receipt" ? (
                <form action={receiptAction} className="grid gap-1.5 rounded border border-yellow-200 bg-yellow-50 p-2">
                  <input type="hidden" name="orderRequestId" value={row.id} />
                  <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-xs font-semibold text-muted">
                      納品数量
                      <input
                        type="number"
                        name="receivedQuantity"
                        min={1}
                        max={row.requestedQuantity}
                        defaultValue={row.requestedQuantity}
                        className="h-9 rounded border border-line bg-white px-3 text-right text-sm outline-none focus:border-warning focus:ring-2 focus:ring-warning/20"
                      />
                    </label>
                    <label className="flex h-9 items-center gap-2 whitespace-nowrap text-xs font-semibold text-muted">
                      <input type="checkbox" name="applyToStock" defaultChecked className="h-4 w-4 accent-amber-600" />
                      在庫反映
                    </label>
                  </div>
                  <textarea
                    name="receivedMemo"
                    placeholder="納品メモ"
                    maxLength={200}
                    className="h-10 min-h-10 rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-warning focus:ring-2 focus:ring-warning/20"
                  />
                  <button
                    type="submit"
                    disabled={isReceiptPending}
                    className="h-9 rounded bg-warning px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isReceiptPending ? "確認中" : "納品を確認"}
                  </button>
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
                ? "h-9 rounded border border-line bg-subtle px-3 text-sm font-semibold text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                : selectedStatus === "ORDERED"
                  ? "h-9 rounded border border-success bg-green-50 px-3 text-sm font-semibold text-success outline-none focus:border-success focus:ring-2 focus:ring-success/20"
                  : "h-9 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusOptionLabels[status]}
              </option>
            ))}
          </select>
          {row.status === "ORDERED" ? (
            <p className="rounded border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-success">
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
          {row.status === "ORDERED" && row.orderedMemo ? (
            <p className="text-xs text-muted">送付メモ: {row.orderedMemo}</p>
          ) : null}
          {row.status === "ORDERED" && row.supplierResponseMemo ? (
            <p className="text-xs text-muted">先方対応メモ: {row.supplierResponseMemo}</p>
          ) : null}
          {selectedStatus === "ORDERED" ? (
            <>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                送付方法
                <select
                  name="orderedMethod"
                  required
                  defaultValue={row.orderedMethod ?? ""}
                  className="h-9 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                  className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <textarea
                  name="supplierResponseMemo"
                  defaultValue={row.supplierResponseMemo ?? ""}
                  placeholder="先方対応メモ（任意）"
                  maxLength={300}
                  className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            className="h-10 min-h-10 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            disabled={isStatusPending}
            className="h-9 rounded border border-line bg-white/75 px-3 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStatusPending ? "変更中" : "状態・メモを更新"}
          </button>
            </form>
          ) : null}
        </div>
      </td>
      <td
        className={
          row.status === "SKIPPED"
            ? "hidden border-b border-line px-4 py-3 text-muted print:table-cell print:border print:border-black print:px-2 print:py-1.5 print:font-semibold print:text-black"
            : row.status === "ORDERED"
              ? "hidden border-b border-line px-4 py-3 text-success print:table-cell print:border print:border-black print:px-2 print:py-1.5 print:font-semibold print:text-black"
            : "hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5 print:font-semibold"
        }
      >
        {getOrderRowStatusLabel(row)}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5">
        {row.memo ?? "-"}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5" />
    </tr>
  );
}
