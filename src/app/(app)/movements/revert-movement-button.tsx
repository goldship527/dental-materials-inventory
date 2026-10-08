"use client";

import { useActionState, useState } from "react";
import { revertStockMovementAction, type StockMovementActionState } from "@/lib/actions/stock-movements";

type RevertMovementButtonProps = {
  movementId: string;
  productName: string;
  beforeQuantity: number;
  afterQuantity: number;
};

const initialState: StockMovementActionState = {};

export function RevertMovementButton({
  movementId,
  productName,
  beforeQuantity,
  afterQuantity,
}: RevertMovementButtonProps) {
  const [state, formAction, isPending] = useActionState(revertStockMovementAction, initialState);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isPending}
        className="h-9 rounded btn-secondary btn-danger px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
      >
        取り消す
      </button>

      {state.message ? (
        <p className={state.status === "success" ? "text-xs text-success" : "text-xs text-danger"}>{state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}</p>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <section className="w-full max-w-md rounded border border-line bg-panel p-5 shadow-sheet">
            <h2 className="text-lg font-semibold">この操作を取り消しますか？</h2>
            <div className="mt-4 rounded bg-subtle p-4 text-sm">
              <p className="font-semibold text-ink">{productName}</p>
              <p className="mt-2 text-muted">
                在庫数を {afterQuantity} から {beforeQuantity} に戻し、逆向きの履歴を追加します。
              </p>
              <p className="mt-2 text-danger">
                この履歴の後に同じ商品の在庫が変わっている場合、取り消しは実行されません。
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-10 rounded btn-secondary px-4 text-sm font-semibold transition"
              >
                やめる
              </button>
              <form
                action={(formData) => {
                  formAction(formData);
                  setIsModalOpen(false);
                }}
              >
                <input type="hidden" name="movementId" value={movementId} />
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded btn-primary px-4 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {isPending ? "取り消し中" : "取り消す"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
