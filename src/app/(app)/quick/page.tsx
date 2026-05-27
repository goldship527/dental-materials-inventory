import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { toStockRow } from "@/lib/db/stock";
import { QuickCardGrid } from "./quick-card-grid";

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function QuickPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const selectedTab = params.tab?.trim() ?? "";
  const [favoriteCards, staffOperators] = await Promise.all([
    prisma.favoriteProductCard.findMany({
    where: {
      clinicId: context.clinicId,
      product: {
        isActive: true,
      },
    },
    include: {
      product: {
        include: {
          primarySupplier: true,
          stockItems: {
            where: {
              clinicId: context.clinicId,
              isUsed: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        categoryTab: "asc",
      },
      {
        displayOrder: "asc",
      },
    ],
    }),
    getActiveStaffOperatorOptionsForClinic({
      organizationId: context.organizationId,
      clinicId: context.clinicId,
    }),
  ]);

  const cards = favoriteCards.flatMap((card) => {
    const stockItem = card.product.stockItems[0];

    if (!stockItem) {
      return [];
    }

    return [
      {
        id: card.id,
        categoryTab: card.categoryTab,
        row: toStockRow({
          ...stockItem,
          product: card.product,
        }),
      },
    ];
  });
  const categoryCounts = cards.reduce<Map<string, number>>((counts, card) => {
    const category = card.categoryTab ?? card.row.category ?? "未分類";
    counts.set(category, (counts.get(category) ?? 0) + 1);

    return counts;
  }, new Map());
  const categoryTabs = Array.from(categoryCounts.entries()).map(([category, count]) => ({
    category,
    count,
  }));
  const visibleCards = selectedTab
    ? cards.filter((card) => (card.categoryTab ?? card.row.category ?? "未分類") === selectedTab)
    : cards;

  const recentMovements = await prisma.stockMovement.findMany({
    where: {
      clinicId: context.clinicId,
      sourceType: "QUICK_CARD",
    },
    include: {
      product: true,
      performedByStaff: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
  });

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <AppNav current="quick" />

        <header className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">クイック出庫</h1>
            <p className="mt-2 text-sm text-muted">よく使う材料をワンタップで出庫・戻しできます。</p>
          </div>
          <a className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line bg-white/75 px-4 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent" href="/home">
            ホームへ戻る
          </a>
        </header>


        <section className="rounded border border-line/90 bg-panel/95 p-3 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted">カテゴリ</p>
              <p className="mt-1 text-sm text-muted">
                表示 {visibleCards.length} 件 / 全 {cards.length} 件
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/quick"
                aria-current={selectedTab === "" ? "page" : undefined}
                className={
                  selectedTab === ""
                    ? "inline-flex min-h-10 items-center rounded border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm"
                    : "inline-flex min-h-10 items-center rounded border border-line bg-white/70 px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent/50 hover:bg-subtle hover:text-ink"
                }
              >
                すべて {cards.length}
              </a>
              {categoryTabs.map((tab) => {
                const isCurrent = selectedTab === tab.category;

                return (
                  <a
                    key={tab.category}
                    href={`/quick?tab=${encodeURIComponent(tab.category)}`}
                    aria-current={isCurrent ? "page" : undefined}
                    className={
                      isCurrent
                        ? "inline-flex min-h-10 items-center rounded border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm"
                        : "inline-flex min-h-10 items-center rounded border border-line bg-white/70 px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent/50 hover:bg-subtle hover:text-ink"
                    }
                  >
                    {tab.category} {tab.count}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <QuickCardGrid cards={visibleCards} staffOperators={staffOperators} />

        <section className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
          <h2 className="text-base font-semibold">直近のクイック出庫操作</h2>
          <div className="mt-3 divide-y divide-line">
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <a className="font-semibold text-accent hover:underline" href={`/products/${movement.product.id}`}>
                    {movement.product.name}
                  </a>
                  <span className="text-muted">
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity} / {movement.beforeQuantity} → {movement.afterQuantity} /{" "}
                    {movement.performedByStaff?.displayName ?? "-"}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-muted">まだクイック出庫操作はありません。</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
