"use client";

import { useState } from "react";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { InventoryAdjustForm } from "./inventory-adjust-form";

type InventoryAdjustCellProps = {
  stockItemId: string;
  quantity: number;
  stockUpdatedAt: number;
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

export function InventoryAdjustCell({ stockItemId, quantity, stockUpdatedAt, clinicId, staffOperators }: InventoryAdjustCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded btn-secondary px-4 text-xs font-semibold transition"
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
        clinicId={clinicId}
        staffOperators={staffOperators}
      />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="inline-flex min-h-11 items-center justify-self-start rounded btn-secondary text-xs font-semibold transition"
      >
        閉じる
      </button>
    </div>
  );
}
