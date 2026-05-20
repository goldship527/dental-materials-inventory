import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { Sparkline } from "@/components/domain/sparkline";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getDashboardSummary } from "@/lib/db/dashboard";

const movementDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const stocktakeDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const summary = await getDashboardSummary(context.clinicId);
  const latestMovementAt = summary.latestMovement ? movementDateFormatter.format(summary.latestMovement.createdAt) : null;
  const latestStocktakeAt = summary.latestStocktakeSession?.committedAt
    ? stocktakeDateFormatter.format(summary.latestStocktakeSession.committedAt)
    : null;
  const summaryItems = [
    {
      label: "在庫登録",
      value: `${summary.stockItemCount} 件`,
      note: `総在庫数 ${summary.totalQuantity}`,
    },
    {
      label: "不足",
      value: `${summary.shortageCount} 件`,
      note: `うち在庫0が ${summary.zeroStockCount} 件`,
    },
    {
      label: "よく使うカード",
      value: `${summary.favoriteCardCount} 件`,
      note: "カード操作で+1/-1",
    },
    {
      label: "発注候補",
      value: `未確認 ${summary.draftOrderRequestCount} 件`,
      note: `確認済み ${summary.orderRequestStatusCounts.CONFIRMED} / 見送り ${summary.orderRequestStatusCounts.SKIPPED}`,
    },
  ];
  const attentionItems = [
    {
      title: "未対応バーコード",
      href: "/barcode/scans/unresolved",
      value: `${summary.unresolvedBarcodeScanCount} 件`,
      note: "商品候補が未整理の読み取り履歴",
      isWarning: summary.unresolvedBarcodeScanCount > 0,
    },
    {
      title: "期限が近い読み取り履歴",
      href: "/barcode/scans",
      value: `${summary.expiringBarcodeScanCount} 件`,
      note: "有効期限が近い保存済み読み取り",
      isWarning: summary.expiringBarcodeScanCount > 0,
    },
    {
      title: "直近の棚卸",
      href: "/stocktake/sessions",
      value: latestStocktakeAt ?? "未確定",
      note: summary.latestStocktakeSession
        ? `差異あり ${summary.latestStocktakeSession.diffCount} 件 / 対象 ${summary.latestStocktakeSession.itemCount} 件`
        : "確定済みセッションはまだありません",
      isWarning: Boolean(summary.latestStocktakeSession && summary.latestStocktakeSession.diffCount > 0),
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
      title: "バーコード検索",
      description: "JAN、GTIN、登録済みバーコード",
      href: "/barcode",
      badge: "読み取り",
    },
    {
      title: "発注先マスタ",
      description: "取扱商品と発注候補",
      href: "/suppliers",
      badge: "一覧",
    },
    {
      title: "よく使う商品カード",
      description: "よく使う商品の入出庫",
      href: "/quick",
      badge: `${summary.favoriteCardCount} 件`,
    },
    {
      title: "不足在庫一覧",
      description: "最低在庫以下の商品",
      href: "/shortage",
      badge: `${summary.shortageCount} 件`,
      isWarning: summary.shortageCount > 0,
    },
    {
      title: "発注候補",
      description: "不足在庫から作成した候補",
      href: "/orders",
      badge: `未確認 ${summary.draftOrderRequestCount} 件`,
      isWarning: summary.draftOrderRequestCount > 0,
    },
    {
      title: "入出庫履歴",
      description: "在庫変更の記録",
      href: "/movements",
      badge: "直近100件",
    },
    {
      title: "棚卸",
      description: "実在庫の入力と確定",
      href: "/stocktake/sessions",
      badge: "入力",
    },
  ];

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink print:bg-white print:px-0 print:py-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-line pb-5 print:border-none md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">ホーム</h1>
            <p className="mt-2 text-sm text-muted">{session.user.name} としてログイン中</p>
          </div>
          <a
            className="rounded border border-warning/30 bg-yellow-50 px-4 py-3 text-sm font-semibold text-warning transition hover:border-warning print:hidden"
            href="/shortage"
          >
            不足 {summary.shortageCount} 件
          </a>
        </header>

        <div className="print:hidden">
          <AppNav current="home" />
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded border border-line bg-white p-5 shadow-panel">
              <p className="text-sm font-semibold text-muted">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              <p className="mt-2 text-sm text-muted">{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <a
            className="rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
            href="/shortage"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted">不足在庫の14日推移</p>
                <p className="mt-2 text-3xl font-semibold">{summary.shortageCount} 件</p>
              </div>
              <span className="shrink-0 rounded bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning">簡易表示</span>
            </div>
            <Sparkline className="mt-4 text-accent" data={summary.shortageTrend} />
            <p className="mt-3 text-sm text-muted">
              不足在庫一覧へ
            </p>
          </a>

          <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {attentionItems.map((item) => (
              <a
                key={item.href}
                className="rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
                href={item.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-muted">{item.title}</p>
                  <span
                    className={
                      item.isWarning
                        ? "shrink-0 rounded bg-yellow-50 px-2 py-1 text-xs font-semibold text-warning"
                        : "shrink-0 rounded bg-gray-50 px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    確認
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.href === "/barcode/scans" ? "有効期限が30日以内の読み取り履歴" : item.note}
                </p>
              </a>
            ))}
          </section>
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

        <section className="grid gap-4 sm:grid-cols-2 print:hidden">
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-36 rounded border border-line bg-white p-6 shadow-panel transition hover:border-accent hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-xl font-semibold">{item.title}</p>
                <span
                  className={
                    item.isWarning
                      ? "shrink-0 rounded bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning"
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
      </div>
    </main>
  );
}
