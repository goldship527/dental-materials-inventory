"use client";

import { useState } from "react";
import { InventoryAdjustForm } from "./inventory-adjust-form";

type InventoryAdjustCellProps = {
  stockItemId: string;
  quantity: number;
  stockUpdatedAt: number;
};

export function InventoryAdjustCell({ stockItemId, quantity, stockUpdatedAt }: InventoryAdjustCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded border border-line bg-white px-4 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
      >
        編集
      </button>
    );
  }

  return (
    <div className="grid gap-2">
      <InventoryAdjustForm stockItemId={stockItemId} quantity={quantity} stockUpdatedAt={stockUpdatedAt} />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="justify-self-start text-xs font-semibold text-muted transition hover:text-ink"
      >
        閉じる
      </button>
    </div>
  );
}
