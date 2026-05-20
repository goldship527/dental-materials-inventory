"use client";

import { useActionState } from "react";
import {
  deleteProductPhotoAction,
  uploadProductPhotoAction,
  type ProductPhotoActionState,
} from "@/lib/actions/product-photos";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";

type PhotoManagementProps = {
  productId: string;
  productName: string;
  photoUpdatedAt: number | null;
};

const initialState: ProductPhotoActionState = {};

export function PhotoManagement({ productId, productName, photoUpdatedAt }: PhotoManagementProps) {
  const [uploadState, uploadAction, isUploading] = useActionState(uploadProductPhotoAction, initialState);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteProductPhotoAction, initialState);
  const photoUrl = buildProductPhotoUrl({
    id: productId,
    photoUpdatedAt,
  });
  const hasPhoto = photoUrl !== null;

  return (
    <section className="rounded border border-line bg-white p-5 shadow-panel">
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div>
          {hasPhoto ? (
            <img
              alt={`${productName}の商品写真`}
              className="aspect-square w-full rounded border border-line object-cover"
              src={photoUrl}
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded border border-dashed border-line bg-gray-50 text-sm font-semibold text-muted">
              写真なし
            </div>
          )}
        </div>
        <div className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">商品写真</h2>
            <p className="mt-2 text-sm text-muted">PNG / JPEG / WebP、2MB以内</p>
          </div>

          <form action={uploadAction} className="grid gap-3">
            <input type="hidden" name="productId" value={productId} />
            <input
              accept="image/png,image/jpeg,image/webp"
              className="block w-full rounded border border-line px-3 py-2 text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              name="photo"
              type="file"
            />
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
                type="submit"
              >
                {isUploading ? "アップロード中" : hasPhoto ? "写真を上書き" : "写真をアップロード"}
              </button>
            </div>
          </form>

          {hasPhoto ? (
            <form
              action={deleteAction}
              className="flex flex-wrap items-center gap-3"
              onSubmit={(event) => {
                if (!window.confirm("この商品写真を削除しますか？")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="productId" value={productId} />
              <button
                className="rounded border border-line bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isDeleting}
                type="submit"
              >
                {isDeleting ? "削除中" : "写真を削除"}
              </button>
            </form>
          ) : null}

          {[uploadState, deleteState].map((state, index) =>
            state.message ? (
              <p
                className={
                  state.status === "success"
                    ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
                    : "rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
                }
                key={`${state.status}-${index}`}
              >
                {state.message}
              </p>
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
