"use client";

import { useState } from "react";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import type { StockRow } from "@/lib/db/stock";
import { QuickCard } from "./quick-card";

type QuickCardGridProps = {
  cards: {
    id: string;
    categoryTab: string | null;
    row: StockRow;
  }[];
  staffOperators: StaffOperatorOption[];
};

export function QuickCardGrid({ cards, staffOperators }: QuickCardGridProps) {
  const [selectedStaffOperatorId, setSelectedStaffOperatorId] = useState("");
  const hasStaffOperators = staffOperators.length > 0;

  return (
    <>
      <section className="rounded border border-line/90 bg-panel/95 p-3 shadow-panel">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,360px)_1fr] md:items-center">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            作業スタッフ
            <select
              value={selectedStaffOperatorId}
              onChange={(event) => setSelectedStaffOperatorId(event.target.value)}
              disabled={!hasStaffOperators}
              className="h-11 rounded border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-muted"
            >
              <option value="">スタッフを選択</option>
              {staffOperators.map((staffOperator) => (
                <option key={staffOperator.id} value={staffOperator.id}>
                  {staffOperator.displayName}
                </option>
              ))}
            </select>
          </label>
          {hasStaffOperators ? (
            <p className="text-sm text-muted">スタッフを選ぶまで、各カードの +1 / -1 は押せません。</p>
          ) : (
            <p className="text-sm text-danger">
              有効なスタッフがありません。管理者にスタッフ登録を依頼してください。
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ id, categoryTab, row }) => (
          <QuickCard
            key={id}
            categoryLabel={categoryTab ?? row.category ?? "未分類"}
            row={row}
            selectedStaffOperatorId={selectedStaffOperatorId}
          />
        ))}
      </section>
    </>
  );
}
