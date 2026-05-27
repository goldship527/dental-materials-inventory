import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getRecentAuditLogs } from "@/lib/db/audit-logs";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDetails(details: unknown) {
  if (!details || typeof details !== "object") {
    return "-";
  }

  const entries = Object.entries(details as Record<string, unknown>).slice(0, 6);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

export default async function AdminAuditLogsPage() {
  const context = await requireAdminUser();
  const logs = await getRecentAuditLogs(context.organizationId, 100);

  return (
    <>
      <AppNav current="auditLogs" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">監査ログ</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            ユーザー管理、商品マスタ、発注先、棚卸確定、履歴取り消しなどの重要操作を直近100件まで表示します。
          </p>
        </header>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">日時</th>
                  <th className="border-b border-line px-4 py-3">操作</th>
                  <th className="border-b border-line px-4 py-3">対象</th>
                  <th className="border-b border-line px-4 py-3">対象ID</th>
                  <th className="border-b border-line px-4 py-3">実行者</th>
                  <th className="border-b border-line px-4 py-3">詳細</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">{dateFormatter.format(log.createdAt)}</td>
                      <td className="border-b border-line px-4 py-3 font-semibold">{log.action}</td>
                      <td className="border-b border-line px-4 py-3">{log.targetType}</td>
                      <td className="border-b border-line px-4 py-3 font-mono text-xs">{log.targetId ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{log.actorUserName ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-xs text-muted">{formatDetails(log.detailsJson)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={6}>
                      まだ監査ログはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
