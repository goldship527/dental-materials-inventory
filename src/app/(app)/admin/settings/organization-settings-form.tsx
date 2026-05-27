"use client";

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
    <form action={action} className="grid gap-5 rounded border border-line bg-white p-5 shadow-panel">
      <div>
        <h2 className="text-lg font-semibold text-ink">異常出庫検知</h2>
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
          className="h-11 rounded border border-line px-3 text-right text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
              : "rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "保存中" : "設定を保存"}
        </button>
      </div>
    </form>
  );
}
