"use client";
import { SectionHeading } from "@/components/ui/section-heading";

import { useActionState } from "react";
import {
  updateOrganizationSettingsAction,
  type OrganizationSettingsActionState,
} from "@/lib/actions/organization-settings";
import {
  maxAnomalyOutThreshold,
  minAnomalyOutThreshold,
} from "@/lib/db/organization-settings";

type OrganizationSettingsFormProps = {
  anomalyOutThreshold: number;
};

const initialState: OrganizationSettingsActionState = {};

export function OrganizationSettingsForm({ anomalyOutThreshold }: OrganizationSettingsFormProps) {
  const [state, action, isPending] = useActionState(updateOrganizationSettingsAction, initialState);

  return (
    <form action={action} className="grid gap-5 rounded border border-line bg-panel p-5 shadow-sheet">
      <div>
        <SectionHeading>異常出庫検知</SectionHeading>
        <p className="mt-1 text-sm leading-6 text-muted">
          最新24時間の出庫数が、通常時の日次平均の何倍以上なら警告するかを設定します。
        </p>
      </div>

      <label className="grid max-w-xs gap-2 text-sm font-semibold text-muted">
        しきい値
        <input
          type="number"
          name="anomalyOutThreshold"
          defaultValue={anomalyOutThreshold}
          min={minAnomalyOutThreshold}
          max={maxAnomalyOutThreshold}
          step="0.1"
          required
          className="h-11 rounded border border-line px-3 text-right text-ink    "
        />
      </label>

      <p className="text-sm leading-6 text-muted">
        既定値は3.0です。設定できる範囲は {minAnomalyOutThreshold} から {maxAnomalyOutThreshold} です。
        通常時の日次平均が0.1未満の商品は、誤検知を避けるため対象外になります。
      </p>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded border border-line border-l-4 border-l-success bg-panel px-4 py-3 text-sm font-semibold text-success"
              : "rounded border border-line border-l-4 border-l-danger bg-panel px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded btn-primary px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          {isPending ? "保存中" : "設定を保存"}
        </button>
      </div>
    </form>
  );
}
