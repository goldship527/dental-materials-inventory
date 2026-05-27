"use client";

import { useActionState } from "react";
import {
  updateNotificationPreferenceAction,
  type NotificationPreferenceActionState,
} from "@/lib/actions/notification-preferences";
import {
  dailyDigestItemKeys,
  dailyDigestItemLabels,
  weekdayOptions,
  type NotificationPreferenceView,
} from "@/lib/notifications/preferences";

type NotificationPreferenceFormProps = {
  preference: NotificationPreferenceView;
};

const initialState: NotificationPreferenceActionState = {};

export function NotificationPreferenceForm({ preference }: NotificationPreferenceFormProps) {
  const [state, action, isPending] = useActionState(updateNotificationPreferenceAction, initialState);
  const selectedWeekdays = new Set(preference.dailyDigestWeekdays);

  return (
    <form action={action} className="grid gap-6 rounded border border-line bg-white p-5 shadow-panel">
      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="isEnabled"
          defaultChecked={preference.isEnabled}
          className="h-5 w-5 rounded border-line text-accent focus:ring-accent"
        />
        朝のダイジェストメールを受け取る
      </label>

      <label className="grid max-w-xs gap-2 text-sm font-semibold text-muted">
        配信時刻
        <input
          type="time"
          name="dailyDigestTime"
          defaultValue={preference.dailyDigestTime}
          step={1800}
          required
          className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">配信曜日</legend>
        <div className="flex flex-wrap gap-2">
          {weekdayOptions.map((option) => (
            <label
              key={option.value}
              className="inline-flex h-10 items-center gap-2 rounded border border-line px-3 text-sm font-semibold text-ink"
            >
              <input
                type="checkbox"
                name="dailyDigestWeekdays"
                value={option.value}
                defaultChecked={selectedWeekdays.has(option.value)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">含める項目</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {dailyDigestItemKeys.map((key) => (
            <label
              key={key}
              className="inline-flex min-h-11 items-center gap-3 rounded border border-line px-3 text-sm font-semibold text-ink"
            >
              <input
                type="checkbox"
                name={`item:${key}`}
                defaultChecked={preference.items[key]}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              {dailyDigestItemLabels[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm leading-6 text-muted">
        通知先はログインユーザーの登録メールアドレスです。通知本文に金額、患者情報、個人情報は含めません。
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
          {isPending ? "保存中" : "通知設定を保存"}
        </button>
      </div>
    </form>
  );
}
