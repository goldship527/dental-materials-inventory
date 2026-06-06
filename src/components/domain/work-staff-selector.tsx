"use client";

import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { useWorkStaffSelection } from "./work-staff-selection";

type WorkStaffSelectorProps = {
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

export function WorkStaffSelector({ clinicId, staffOperators }: WorkStaffSelectorProps) {
  const { hasStaffOperators, selectedStaffOperatorId, selectStaffOperator } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });

  return (
    <label className="flex min-w-[12rem] shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold text-muted">
      作業スタッフ
      <select
        value={selectedStaffOperatorId}
        onChange={(event) => selectStaffOperator(event.target.value)}
        disabled={!hasStaffOperators}
        className="h-11 w-44 rounded border border-line bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-muted sm:h-9"
      >
        <option value="">{hasStaffOperators ? "選択" : "未登録"}</option>
        {staffOperators.map((staffOperator) => (
          <option key={staffOperator.id} value={staffOperator.id}>
            {staffOperator.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
