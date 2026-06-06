"use client";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import type { StockRow } from "@/lib/db/stock";
import { QuickCard } from "./quick-card";

type QuickCardGridProps = {
  cards: {
    id: string;
    categoryTab: string | null;
    row: StockRow;
  }[];
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

export function QuickCardGrid({ cards, clinicId, staffOperators }: QuickCardGridProps) {
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });

  return (
    <>
      <section className="rounded border border-line/90 bg-panel/95 p-3 shadow-panel">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,360px)_1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold text-muted">作業スタッフ</p>
            <p className="mt-1 text-sm text-ink">
              {selectedStaffOperator ? selectedStaffOperator.displayName : "未選択"}
            </p>
          </div>
          {hasStaffOperators ? (
            <p className="text-sm text-muted">画面上部で作業スタッフを選ぶまで、各カードの +1 / -1 は押せません。</p>
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
