"use client";

import { useState } from "react";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { InventoryAdjustForm } from "./inventory-adjust-form";

type InventoryAdjustCellProps = {
  stockItemId: string;
  quantity: number;
  stockUpdatedAt: number;
  staffOperators: StaffOperatorOption[];
};

export function InventoryAdjustCell({ stockItemId, quantity, stockUpdatedAt, staffOperators }: InventoryAdjustCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded border border-line bg-white px-4 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
      >
        編集
      </button>
    );
  }

  return (
    <div className="grid gap-2">
      <InventoryAdjustForm
        stockItemId={stockItemId}
        quantity={quantity}
        stockUpdatedAt={stockUpdatedAt}
        staffOperators={staffOperators}
      />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="inline-flex min-h-11 items-center justify-self-start text-xs font-semibold text-muted transition hover:text-ink"
      >
        閉じる
      </button>
    </div>
  );
}
