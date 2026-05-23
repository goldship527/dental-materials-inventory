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

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const summary = await getDashboardSummary(context.clinicId);
  const latestMovementAt = summary.latestMovement ? movementDateFormatter.format(summary.latestMovement.createdAt) : null;
  const summaryItems = [
    {
      label: "在庫登録",
      value: `${summary.stockItemCount} 件`,
      note: `総在庫数 ${summary.totalQuantity}`,
    },
    {
      label: "不足",
      value: `${summary.shortageCount} 件`,
      note: `在庫0 ${summary.zeroStockCount} 件 / ぎりぎり ${summary.atMinStockCount} 件`,
    },
    {
      label: "クイック出庫",
      value: `${summary.favoriteCardCount} 件`,
      note: "ワンタップで出庫・戻し",
    },
    {
      label: "発注候補",
      value: `未確認 ${summary.draftOrderRequestCount} 件`,
      note: `確認済み ${summary.orderRequestStatusCounts.CONFIRMED} / 発注済み ${summary.orderRequestStatusCounts.ORDERED}`,
    },
  ];
  const primaryActionItems = [
    {
      title: "クイック出庫",
      description: "よく使う材料をすぐに -1 できます",
      href: "/quick",
      badge: `${summary.favoriteCardCount} 件`,
      tone: "primary",
    },
    {
      title: "不足在庫を見る",
      description: "最低在庫を下回った材料を確認します",
      href: "/shortage",
      badge: `${summary.shortageCount} 件`,
      tone: summary.shortageCount > 0 ? "warning" : "normal",
    },
    {
      title: "発注候補を見る",
      description: "未確認の発注候補を発注先ごとに確認します",
      href: "/orders",
      badge: `未確認 ${summary.draftOrderRequestCount} 件`,
      tone: summary.draftOrderRequestCount > 0 ? "warning" : "normal",
    },
    {
      title: "バーコード出入庫",
      description: "読み取り後に数量と理由を確認して記録します",
      href: "/barcode/stock",
      badge: "読取",
      tone: "normal",
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
      title: "発注候補 未確認",
      href: "/orders",
      value: `${summary.draftOrderRequestCount} 件`,
      note: "不足在庫から作成された候補",
      isWarning: summary.draftOrderRequestCount > 0,
    },
    {
      title: "期限ロット",
      href: "/stock-lots",
      value: `${summary.attentionStockLotCount} 件`,
      note: "期限切れまたは30日以内のロット別在庫",
      isWarning: summary.attentionStockLotCount > 0,
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
      title: "入出庫履歴",
      description: "在庫変更の記録",
      href: "/movements",
      badge: "直近100件",
    },
    {
      title: "期限ロット一覧",
      description: "ロット番号と有効期限",
      href: "/stock-lots",
      badge: `${summary.attentionStockLotCount} 件`,
      isWarning: summary.attentionStockLotCount > 0,
    },
    {
      title: "棚卸",
      description: "実在庫の入力と確定",
      href: "/stocktake/sessions",
      badge: "入力",
    },
    {
      title: "初期設定チェック",
      description: "商品、発注先、バーコード、最低在庫",
      href: "/setup",
      badge: "導入",
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
          <a
            className="rounded border border-accent/30 bg-teal-50 px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent print:hidden"
            href="/quick"
          >
            クイック出庫へ
          </a>
        </header>

        <section className="grid gap-3 print:hidden sm:grid-cols-2 lg:grid-cols-4">
          {primaryActionItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={
                item.tone === "primary"
                  ? "min-h-36 rounded border border-accent/30 bg-teal-50 p-5 shadow-panel transition hover:border-accent hover:bg-white hover:shadow-md"
                  : item.tone === "warning"
                    ? "min-h-36 rounded border border-warning/30 bg-yellow-50 p-5 shadow-panel transition hover:border-warning hover:bg-white hover:shadow-md"
                    : "min-h-36 rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-semibold">{item.title}</p>
                <span
                  className={
                    item.tone === "warning"
                      ? "shrink-0 rounded bg-white/80 px-3 py-1 text-xs font-semibold text-warning"
                      : "shrink-0 rounded bg-white/80 px-3 py-1 text-xs font-semibold text-accent"
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
          <h2 className="text-lg font-semibold">今日の状況</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded border border-line bg-white p-5 shadow-panel">
                <p className="text-sm font-semibold text-muted">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                <p className="mt-2 text-sm text-muted">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <a
            className="rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
            href="/shortage"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted">不足の傾向</p>
                <p className="mt-2 text-3xl font-semibold">{summary.shortageCount} 件</p>
              </div>
              <span className="shrink-0 rounded bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning">目安</span>
            </div>
            <Sparkline className="mt-4 text-accent" data={summary.shortageTrend} />
            <p className="mt-3 text-sm text-muted">
              不足在庫を確認する
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

        <section className="grid gap-3 print:hidden">
          <h2 className="text-lg font-semibold">管理・確認メニュー</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="min-h-32 rounded border border-line bg-white p-5 shadow-panel transition hover:border-accent hover:shadow-md"
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
          </div>
        </section>
      </div>
    </main>
  );
}
