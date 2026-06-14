import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getDashboardSummary } from "@/lib/db/dashboard";

const movementDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type PageProps = {
  searchParams?: Promise<{
    adminDenied?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const canUseAdminMode = isAdminRole(session.user.role);
  const summary = await getDashboardSummary(context.clinicId, context.organizationId);
  const plannedOrderRequestCount = summary.orderRequestStatusCounts.DRAFT + summary.orderRequestStatusCounts.CONFIRMED;
  const pendingReceiveCount = summary.orderRequestStatusCounts.ORDERED;
  const operationItems = [
    {
      title: "出庫する",
      description: "使った材料をバーコードで連続読み取りし、出庫リストからまとめて確定します。",
      href: "/barcode/out",
      badge: "出庫",
      tone: "out",
    },
    {
      title: "納品する",
      description: "届いた材料をバーコードで連続読み取りし、納品待ちに一致したものをまとめて受領します。",
      href: "/barcode/receive",
      badge: "納品",
      tone: "receive",
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
      title: "納品待ち",
      href: "/orders?status=ORDERED",
      value: `${pendingReceiveCount} 件`,
      note: "受領確認を待っている発注",
      isWarning: pendingReceiveCount > 0,
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
      title: "発注",
      description: "発注予定、納品待ち、納品済み",
      href: "/orders",
      badge: `予定 ${plannedOrderRequestCount} 件`,
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
      title: "商品マスタ",
      description: "商品コード、規格、発注単位",
      href: "/products",
      badge: `${summary.stockItemCount} 件`,
    },
    {
      title: "バーコード検索",
      description: "読み取り検索と出入庫",
      href: "/barcode",
    },
    {
      title: "発注先マスタ",
      description: "取扱商品と発注候補",
      href: "/suppliers",
    },
    {
      title: "クイック出庫",
      description: "バーコードなしの予備導線",
      href: "/quick",
      badge: `${summary.favoriteCardCount} 件`,
    },
    {
      title: "不足在庫",
      description: "最低在庫を下回った材料",
      href: "/shortage",
      badge: `${summary.shortageCount} 件`,
    },
  ];
  const adminMenuItems = [
    {
      title: "初期設定",
      description: "商品、発注先、バーコード、最低在庫",
      href: "/setup",
    },
    {
      title: "取込確認",
      description: "医療機器データとテストラベル",
      href: "/imports/medical-devices",
    },
    {
      title: "未対応バーコード",
      description: "商品候補が未整理の読み取り履歴",
      href: "/barcode/scans/unresolved",
      badge: `${summary.unresolvedBarcodeScanCount} 件`,
      isWarning: summary.unresolvedBarcodeScanCount > 0,
    },
    {
      title: "担当者管理",
      description: "クイック出庫用のスタッフ登録",
      href: "/admin/staff-operators",
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
            <h1 className="text-3xl font-semibold tracking-normal">ホーム</h1>
            <p className="mt-2 text-sm leading-6 text-muted">今日の作業を選んでください。</p>
          </div>
        </header>

        {params.adminDenied ? (
          <section className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-warning shadow-panel">
            管理者専用の画面です。必要な場合は管理者に依頼してください。
          </section>
        ) : null}

        <section className="grid gap-4 print:hidden md:grid-cols-2">
          {operationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={
                item.tone === "out"
                  ? "min-h-40 rounded border-2 border-blue-600 bg-blue-50 p-6 shadow-panel transition hover:shadow-md"
                  : "min-h-40 rounded border-2 border-emerald-700 bg-emerald-50 p-6 shadow-panel transition hover:shadow-md"
              }
            >
              <div className="flex items-start justify-between gap-4">
                <p
                  className={
                    item.tone === "out"
                      ? "text-3xl font-semibold text-blue-700"
                      : "text-3xl font-semibold text-emerald-800"
                  }
                >
                  {item.title}
                </p>
                <span
                  className={
                    item.tone === "out"
                      ? "shrink-0 rounded bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700"
                      : "shrink-0 rounded bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800"
                  }
                >
                  {item.badge}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">{item.description}</p>
            </a>
          ))}
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">今日の注意</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attentionItems.map((item) => (
              <a
                key={item.title}
                className="rounded border border-line bg-white px-4 py-3 shadow-panel transition hover:border-accent hover:shadow-md"
                href={item.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-muted">{item.title}</p>
                  <p
                    className={
                      item.isWarning
                        ? "rounded bg-red-50 px-2.5 py-1 text-sm font-semibold text-danger"
                        : "rounded bg-gray-50 px-2.5 py-1 text-sm font-semibold text-muted"
                    }
                  >
                    {item.value}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{item.note}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">直近の在庫更新</p>
            <a className="text-sm font-semibold text-accent hover:underline" href="/movements">
              履歴を見る
            </a>
          </div>
          {summary.latestMovements.length > 0 ? (
            <div className="mt-3 divide-y divide-line">
              {summary.latestMovements.map((movement) => (
                <div key={movement.id} className="grid gap-2 py-2.5 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="font-semibold text-ink">
                    {movement.productName}{" "}
                    <span className="font-normal text-muted">
                      {movement.beforeQuantity} → {movement.afterQuantity}
                    </span>
                  </p>
                  <p className="text-muted">
                    {movement.movementType} / {movementDateFormatter.format(movement.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-base text-muted">まだ在庫更新はありません。</p>
          )}
        </section>

        <section className="grid gap-3 print:hidden">
          <h2 className="text-lg font-semibold">確認メニュー</h2>
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
                        "isWarning" in item && item.isWarning
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

        {canUseAdminMode ? (
          <section className="grid gap-3 print:hidden">
            <h2 className="text-lg font-semibold">管理メニュー</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {adminMenuItems.map((item) => (
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
                          "isWarning" in item && item.isWarning
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
        ) : null}
      </div>
    </main>
  );
}
