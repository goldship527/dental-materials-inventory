import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getDashboardSummary } from "@/lib/db/dashboard";

const movementDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const summary = await getDashboardSummary(context.clinicId, context.organizationId);
  const latestMovementAt = summary.latestMovement ? movementDateFormatter.format(summary.latestMovement.createdAt) : null;
  const plannedOrderRequestCount = summary.orderRequestStatusCounts.DRAFT + summary.orderRequestStatusCounts.CONFIRMED;
  const primaryActionItems = [
    {
      title: "クイック出庫",
      description: "よく使う材料の出庫を素早く記録します",
      href: "/quick",
      badge: `${summary.favoriteCardCount} 件`,
      tone: "primary",
    },
    {
      title: "不足在庫",
      description: "最低在庫を下回った材料を確認します",
      href: "/shortage",
      badge: `${summary.shortageCount} 件`,
      tone: summary.shortageCount > 0 ? "warning" : "normal",
    },
    {
      title: "発注候補",
      description: "発注予定の候補を発注先ごとに確認します",
      href: "/orders",
      badge: `発注予定 ${plannedOrderRequestCount} 件`,
      tone: plannedOrderRequestCount > 0 ? "warning" : "normal",
    },
  ];
  const attentionItems = [
    {
      title: "在庫0",
      href: "/shortage",
      value: `${summary.zeroStockCount} 件`,
      note: "今日の使用前に優先確認したい材料",
      isWarning: summary.zeroStockCount > 0,
    },
    {
      title: "不足在庫",
      href: "/shortage",
      value: `${summary.shortageCount} 件`,
      note: "最低在庫を下回っている材料",
      isWarning: summary.shortageCount > 0,
    },
    {
      title: "発注候補 発注予定",
      href: "/orders",
      value: `${plannedOrderRequestCount} 件`,
      note: "これから発注する候補",
      isWarning: plannedOrderRequestCount > 0,
    },
    {
      title: "期限ロット",
      href: "/stock-lots",
      value: `${summary.attentionStockLotCount} 件`,
      note: "期限切れまたは30日以内",
      isWarning: summary.attentionStockLotCount > 0,
    },
    {
      title: "長期在庫",
      href: "/inventory/dormant",
      value: `${summary.dormantStockCount} 件`,
      note: "過去90日以内に出庫がない在庫",
      isWarning: summary.dormantStockCount > 0,
    },
    {
      title: "異常出庫検知",
      href: "/movements/anomalies",
      value: `${summary.stockAnomalyCount} 件`,
      note: "通常より出庫数が多い商品",
      isWarning: summary.stockAnomalyCount > 0,
    },
  ];
  const menuItems = [
    {
      title: "在庫一覧",
      description: "現在庫と最低在庫",
      href: "/inventory",
      badge: `${summary.stockItemCount} 件`,
    },
    {
      title: "商品マスタ",
      description: "商品コード、規格、発注単位",
      href: "/products",
      badge: `${summary.stockItemCount} 件`,
    },
    {
      title: "バーコード管理",
      description: "検索、未登録整理、読取履歴",
      href: "/barcode",
    },
    {
      title: "発注先マスタ",
      description: "取扱商品と発注候補",
      href: "/suppliers",
    },
    {
      title: "入出庫履歴",
      description: "在庫変更の記録",
      href: "/movements",
    },
    {
      title: "棚卸",
      description: "実在庫の入力と確定",
      href: "/stocktake/sessions",
    },
    {
      title: "初期設定",
      description: "商品、発注先、バーコード、最低在庫",
      href: "/setup",
    },
    {
      title: "未対応バーコード",
      description: "商品候補が未整理の読み取り履歴",
      href: "/barcode/scans/unresolved",
      badge: `${summary.unresolvedBarcodeScanCount} 件`,
      isWarning: summary.unresolvedBarcodeScanCount > 0,
    },
  ];

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink print:bg-white print:px-0 print:py-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="print:hidden">
          <AppNav current="home" />
        </div>

        <header className="flex flex-col gap-4 border-b border-line pb-5 print:border-none md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">ホーム</h1>
            <p className="mt-2 text-sm text-muted">{session.user.name} としてログイン中</p>
          </div>
        </header>

        <section className="grid gap-3 print:hidden sm:grid-cols-2 lg:grid-cols-3">
          {primaryActionItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative min-h-36 overflow-hidden rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-semibold">{item.title}</p>
                <span
                  className={
                    item.tone === "warning"
                      ? "shrink-0 rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-accent"
                      : "shrink-0 rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted"
                  }
                >
                  {item.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
            </a>
          ))}
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">今日の注意</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attentionItems.map((item) => (
              <a
                key={item.title}
                className="rounded border border-line bg-white p-4 shadow-panel transition hover:border-accent hover:shadow-md"
                href={item.href}
              >
                <p className="text-sm font-semibold text-muted">{item.title}</p>
                <p className={item.isWarning ? "mt-2 text-2xl font-semibold text-accent" : "mt-2 text-2xl font-semibold text-ink"}>
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.note}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted">直近の在庫更新</p>
              {summary.latestMovement ? (
                <p className="mt-2 text-base">
                  {summary.latestMovement.productName}{" "}
                  <span className="text-muted">
                    {summary.latestMovement.beforeQuantity} → {summary.latestMovement.afterQuantity}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-base text-muted">まだ在庫更新はありません。</p>
              )}
            </div>
            {summary.latestMovement ? (
              <div className="rounded bg-gray-50 px-4 py-3 text-sm text-muted">
                {summary.latestMovement.movementType} / {latestMovementAt}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 print:hidden">
          <h2 className="text-lg font-semibold">その他の確認・設定</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="min-h-32 rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xl font-semibold">{item.title}</p>
                  {item.badge ? (
                    <span
                      className={
                        item.isWarning
                          ? "shrink-0 rounded bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning"
                          : "shrink-0 rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted"
                      }
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
