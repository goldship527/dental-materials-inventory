"use client";

import { useActionState } from "react";
import {
  createProductBarcodeWithStateAction,
  unlinkProductBarcodeWithStateAction,
  updateProductBarcodeWithStateAction,
  type BarcodeActionState,
} from "@/lib/actions/barcodes";
import type { ProductBarcodeSummary } from "@/lib/db/products";

type BarcodeManagementProps = {
  productId: string;
  janCode: string | null;
  barcodes: ProductBarcodeSummary[];
  defaultNewBarcode?: string;
};

type BarcodeRowProps = {
  productId: string;
  barcode: ProductBarcodeSummary;
};

const initialState: BarcodeActionState = {};

function valueOrEmpty(value: string | null) {
  return value ?? "";
}

function BarcodeMessage({ state }: { state: BarcodeActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "rounded border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-accent"
          : "rounded border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-danger"
      }
    >
      {state.message}
    </p>
  );
}

function BarcodeRow({ productId, barcode }: BarcodeRowProps) {
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateProductBarcodeWithStateAction,
    initialState,
  );
  const [unlinkState, unlinkAction, isUnlinkPending] = useActionState(
    unlinkProductBarcodeWithStateAction,
    initialState,
  );

  if (!barcode.id) {
    return (
      <article className="rounded border border-line bg-gray-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold">{barcode.barcode}</p>
            <p className="mt-1 text-xs text-muted">
              {barcode.barcodeType} / {barcode.unitLabel ?? "単位未設定"} / 代表JAN
            </p>
          </div>
          <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-muted">商品基本情報から表示</span>
        </div>
        <p className="mt-3 text-xs text-muted">
          この行は商品マスタの代表JANから表示しています。複数バーコードとして管理する場合は、下の追加フォームから登録します。
        </p>
      </article>
    );
  }

  return (
    <article className="rounded border border-line bg-white p-4">
      <form action={updateAction} className="grid gap-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="barcodeId" value={barcode.id} />
        <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_auto] md:items-end">
          <label className="grid gap-1 text-xs font-semibold text-muted">
            バーコード
            <input
              name="barcode"
              defaultValue={barcode.barcode}
              required
              maxLength={100}
              className="h-10 rounded border border-line px-3 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            種別
            <input
              name="barcodeType"
              defaultValue={barcode.barcodeType}
              required
              maxLength={40}
              className="h-10 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            単位ラベル
            <input
              name="unitLabel"
              defaultValue={valueOrEmpty(barcode.unitLabel)}
              maxLength={100}
              className="h-10 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-xs font-semibold text-muted">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={barcode.isPrimary}
              className="h-4 w-4 rounded border-line text-accent"
            />
            代表
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isUpdatePending}
            className="rounded bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUpdatePending ? "更新中" : "更新"}
          </button>
          <BarcodeMessage state={updateState} />
        </div>
      </form>

      <form action={unlinkAction} className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="barcodeId" value={barcode.id} />
        <button
          type="submit"
          disabled={isUnlinkPending}
          className="rounded border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUnlinkPending ? "解除中" : "紐づけ解除"}
        </button>
        <BarcodeMessage state={unlinkState} />
      </form>
    </article>
  );
}

export function BarcodeManagement({ productId, janCode, barcodes, defaultNewBarcode = "" }: BarcodeManagementProps) {
  const [createState, createAction, isCreatePending] = useActionState(
    createProductBarcodeWithStateAction,
    initialState,
  );

  return (
    <section className="rounded border border-line bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">バーコード管理</h2>
          <p className="mt-2 text-sm text-muted">
            スキャナーや手入力で使うJANコード・包装単位ごとのバーコードを商品に紐づけます。
          </p>
        </div>
        <span className="rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted">
          登録 {barcodes.filter((barcode) => barcode.id).length} 件
        </span>
      </div>

      {janCode ? (
        <p className="mt-4 rounded bg-gray-50 px-3 py-2 text-xs text-muted">
          商品基本情報の代表JAN: <span className="font-mono text-ink">{janCode}</span>
        </p>
      ) : null}

      {defaultNewBarcode ? (
        <p className="mt-4 rounded border border-warning/30 bg-yellow-50 px-3 py-2 text-xs text-warning">
          未登録バーコード <span className="font-mono text-ink">{defaultNewBarcode}</span>{" "}
          をこの商品に追加する準備をしています。内容を確認して「追加」を押してください。
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        {barcodes.length > 0 ? (
          barcodes.map((barcode) => (
            <BarcodeRow key={`${barcode.id ?? "jan"}-${barcode.barcode}`} productId={productId} barcode={barcode} />
          ))
        ) : (
          <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            複数バーコードはまだ登録されていません。
          </p>
        )}
      </div>

      <form action={createAction} className="mt-5 grid gap-3 rounded border border-line bg-gray-50 p-4">
        <input type="hidden" name="productId" value={productId} />
        <h3 className="text-sm font-semibold">バーコードを追加</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_auto] md:items-end">
          <label className="grid gap-1 text-xs font-semibold text-muted">
            バーコード
            <input
              name="barcode"
              defaultValue={defaultNewBarcode}
              required
              maxLength={100}
              autoComplete="off"
              className="h-10 rounded border border-line px-3 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            種別
            <input
              name="barcodeType"
              defaultValue="JAN"
              required
              maxLength={40}
              className="h-10 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            単位ラベル
            <input
              name="unitLabel"
              placeholder="箱、袋、1本など"
              maxLength={100}
              className="h-10 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-xs font-semibold text-muted">
            <input type="checkbox" name="isPrimary" className="h-4 w-4 rounded border-line text-accent" />
            代表
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isCreatePending}
            className="rounded bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreatePending ? "追加中" : "追加"}
          </button>
          <BarcodeMessage state={createState} />
        </div>
        <p className="text-xs text-muted">
          患者情報や秘密情報は入力しないでください。代表にしたバーコードは、同じ商品の他バーコードより優先して表示されます。
        </p>
      </form>
    </section>
  );
}
