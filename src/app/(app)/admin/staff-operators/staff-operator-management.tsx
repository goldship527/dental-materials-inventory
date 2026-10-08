"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { barcodeUiEnabled } from "@/lib/workflow-features";
import {
  createStaffOperatorAction,
  deactivateStaffOperatorAction,
  type StaffOperatorActionState,
  updateStaffOperatorAction,
} from "@/lib/actions/staff-operators";
import type { StaffOperatorClinicOption, StaffOperatorRow } from "@/lib/db/staff-operators";

type StaffOperatorManagementProps = {
  operators: StaffOperatorRow[];
  clinics: StaffOperatorClinicOption[];
};

const initialState: StaffOperatorActionState = {};
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function StatusMessage({ state }: { state: StaffOperatorActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "rounded border border-line border-l-4 border-l-success bg-panel px-4 py-3 text-sm font-semibold text-success"
          : "rounded border border-line border-l-4 border-l-danger bg-panel px-4 py-3 text-sm font-semibold text-danger"
      }
    >
      {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
    </p>
  );
}

function RowSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit" aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function StaffOperatorManagement({ operators, clinics }: StaffOperatorManagementProps) {
  const [createState, createAction, isCreating] = useActionState(createStaffOperatorAction, initialState);
  const [updateState, updateAction] = useActionState(updateStaffOperatorAction, initialState);
  const [deactivateState, deactivateAction] = useActionState(deactivateStaffOperatorAction, initialState);

  return (
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0 rounded border border-line bg-panel p-5 shadow-sheet">
        <h2 className="text-lg font-semibold">担当者を追加</h2>
        <form action={createAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            担当者名
            <input
              className="h-11 rounded border border-line px-3 text-base text-ink    "
              maxLength={100}
              name="displayName"
              placeholder="例: 山田"
              required
            />
          </label>
          <fieldset className="grid gap-2 rounded border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-muted">利用できるクリニック</legend>
            <div className="grid gap-2">
              {clinics.map((clinic, index) => (
                <label key={clinic.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    className="h-4 w-4 rounded border-line text-accent "
                    defaultChecked={index === 0}
                    name="clinicIds"
                    type="checkbox"
                    value={clinic.id}
                  />
                  {clinic.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded btn-primary px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "追加中" : "担当者を追加"}
            </button>
          </div>
        </form>
        <div className="mt-4">
          <StatusMessage state={createState} />
        </div>
      </section>

      <section className="min-w-0 rounded border border-line bg-panel p-5 shadow-sheet">
        <div className="flex flex-col gap-2 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">担当者一覧</h2>
            <p className="mt-1 text-sm text-muted">無効化した担当者は新しい入出庫では選択できません。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-muted">合計 {operators.length} 件</p>
            {barcodeUiEnabled && <a
              className="rounded btn-secondary px-4 py-2 text-sm font-semibold transition"
              href="/admin/staff-operators/labels"
            >
              バーコード印刷
            </a>}
          </div>
        </div>

        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line px-3 py-2 font-semibold">担当者</th>
                <th className="border-b border-line px-3 py-2 font-semibold">クリニック</th>
                <th className="border-b border-line px-3 py-2 font-semibold">状態</th>
                <th className="border-b border-line px-3 py-2 font-semibold">更新日</th>
                <th className="border-b border-line px-3 py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => {
                const updateFormId = `staff-operator-update-${operator.id}`;
                const assignedClinicIds = new Set(operator.assignedClinics.map((clinic) => clinic.id));

                return (
                  <tr key={operator.id}>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <input
                        className="h-10 w-full min-w-36 rounded border border-line px-3 text-sm font-semibold text-ink    "
                        form={updateFormId}
                        maxLength={100}
                        name="displayName"
                        required
                        type="text"
                        defaultValue={operator.displayName}
                      />
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top text-muted">
                      <div className="grid min-w-48 gap-2">
                        {clinics.map((clinic) => (
                          <label key={clinic.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <input
                              className="h-4 w-4 rounded border-line text-accent "
                              defaultChecked={assignedClinicIds.has(clinic.id)}
                              form={updateFormId}
                              name="clinicIds"
                              type="checkbox"
                              value={clinic.id}
                            />
                            {clinic.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <span
                        className={
                          operator.isActive
                            ? "rounded bg-panel px-2 py-1 text-xs font-semibold text-accent"
                            : "rounded bg-subtle px-2 py-1 text-xs font-semibold text-muted"
                        }
                      >
                        {operator.isActive ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top text-muted">
                      {dateTimeFormatter.format(operator.updatedAt)}
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <form action={updateAction} id={updateFormId}>
                          <input name="staffOperatorId" type="hidden" value={operator.id} />
                          <RowSubmitButton
                            className="h-11 rounded btn-primary px-3 text-sm font-semibold transition disabled:cursor-not-allowed"
                            pendingLabel="保存中"
                          >
                            保存
                          </RowSubmitButton>
                        </form>
                        {operator.isActive ? (
                          <form
                            action={deactivateAction}
                            onSubmit={(event) => {
                              if (!window.confirm(`${operator.displayName} を無効化しますか？`)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input name="staffOperatorId" type="hidden" value={operator.id} />
                            <RowSubmitButton
                              className="h-11 rounded btn-secondary btn-danger px-3 text-sm font-semibold transition disabled:cursor-not-allowed"
                              pendingLabel="無効化中"
                            >
                              無効化
                            </RowSubmitButton>
                          </form>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <StatusMessage state={updateState} />
        </div>
        <div className="mt-4">
          <StatusMessage state={deactivateState} />
        </div>
      </section>
    </div>
  );
}
