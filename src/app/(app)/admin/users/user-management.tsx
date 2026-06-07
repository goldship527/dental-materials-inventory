"use client";

import { useActionState } from "react";
import {
  createAdminUserAction,
  deactivateAdminUserAction,
  resetAdminUserPasswordAction,
  type AdminUserActionState,
} from "@/lib/actions/admin-users";
import { normalizeUserRole, userRoles } from "@/lib/auth/roles";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type UserManagementProps = {
  users: AdminUserRow[];
  currentUserId: string;
};

const initialState: AdminUserActionState = {};
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function roleLabel(role: string) {
  return normalizeUserRole(role) === userRoles.admin ? "管理者" : "スタッフ";
}

function StatusMessage({ state }: { state: AdminUserActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
          : "rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
      }
    >
      {state.message}
    </p>
  );
}

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const [createState, createAction, isCreating] = useActionState(createAdminUserAction, initialState);
  const [deactivateState, deactivateAction, isDeactivating] = useActionState(deactivateAdminUserAction, initialState);
  const [resetState, resetAction, isResetting] = useActionState(resetAdminUserPasswordAction, initialState);

  return (
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0 rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">ユーザー追加</h2>
        <form action={createAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            表示名
            <input
              className="h-11 rounded border border-line px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              maxLength={100}
              name="name"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-muted">
            メールアドレス
            <input
              className="h-11 rounded border border-line px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              maxLength={255}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-muted">
            初期パスワード
            <input
              autoComplete="new-password"
              className="h-11 rounded border border-line px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              minLength={8}
              name="password"
              pattern="[\x21-\x7E]+"
              required
              type="password"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-muted">
            権限
            <select
              className="h-11 rounded border border-line px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              defaultValue={userRoles.staff}
              name="role"
            >
              <option value={userRoles.staff}>スタッフ</option>
              <option value={userRoles.admin}>管理者</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "追加中" : "ユーザーを追加"}
            </button>
          </div>
        </form>
        <div className="mt-4">
          <StatusMessage state={createState} />
        </div>
      </section>

      <section className="min-w-0 rounded border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-2 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">ユーザー一覧</h2>
            <p className="mt-1 text-sm text-muted">有効なユーザーだけがログインできます。</p>
          </div>
          <p className="text-sm font-semibold text-muted">合計 {users.length} 件</p>
        </div>

        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="min-w-[760px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line px-3 py-2 font-semibold">ユーザー</th>
                <th className="border-b border-line px-3 py-2 font-semibold">権限</th>
                <th className="border-b border-line px-3 py-2 font-semibold">状態</th>
                <th className="border-b border-line px-3 py-2 font-semibold">更新日</th>
                <th className="border-b border-line px-3 py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;

                return (
                  <tr key={user.id}>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <p className="font-semibold">{user.name}</p>
                      <p className="mt-1 text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top">{roleLabel(user.role)}</td>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <span
                        className={
                          user.isActive
                            ? "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-accent"
                            : "rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-muted"
                        }
                      >
                        {user.isActive ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top text-muted">
                      {dateTimeFormatter.format(user.updatedAt)}
                    </td>
                    <td className="border-b border-line px-3 py-3 align-top">
                      <div className="grid min-w-64 gap-3">
                        <form action={resetAction} className="flex flex-wrap gap-2">
                          <input name="userId" type="hidden" value={user.id} />
                          <input
                            aria-label={`${user.name} の新しいパスワード`}
                            autoComplete="new-password"
                            className="h-11 min-w-44 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                            disabled={!user.isActive}
                            minLength={8}
                            name="password"
                            pattern="[\x21-\x7E]+"
                            placeholder="新パスワード"
                            required
                            type="password"
                          />
                          <button
                            className="h-11 rounded border border-line bg-white px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!user.isActive || isResetting}
                            type="submit"
                          >
                            {isResetting ? "リセット中" : "リセット"}
                          </button>
                        </form>
                        {user.isActive ? (
                          <form
                            action={deactivateAction}
                            onSubmit={(event) => {
                              if (!window.confirm(`${user.name} を無効化しますか？`)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input name="userId" type="hidden" value={user.id} />
                            <button
                              className="h-11 rounded border border-line bg-white px-3 text-sm font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isSelf || isDeactivating}
                              type="submit"
                            >
                              {isSelf ? "自分は無効化不可" : isDeactivating ? "無効化中" : "無効化"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3">
          <StatusMessage state={deactivateState} />
          <StatusMessage state={resetState} />
        </div>
      </section>
    </div>
  );
}
