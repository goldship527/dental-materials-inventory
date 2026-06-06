import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { buildOnboardingSteps, getOnboardingSummary } from "@/lib/db/onboarding";

function getStatusClassName(status: "done" | "todo" | "attention") {
  if (status === "done") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "attention") {
    return "bg-yellow-50 text-warning";
  }

  return "bg-gray-50 text-muted";
}

function getStatusLabel(status: "done" | "todo" | "attention") {
  if (status === "done") {
    return "完了";
  }

  if (status === "attention") {
    return "要確認";
  }

  return "未着手";
}

export default async function SetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/home",
  });
  const context = await requireActiveClinic();
  const summary = await getOnboardingSummary(context.organizationId, context.clinicId);
  const steps = buildOnboardingSteps(summary);
  const completionPercent =
    summary.totalStepCount === 0 ? 0 : Math.round((summary.completedStepCount / summary.totalStepCount) * 100);
  const summaryCards = [
    {
      label: "商品マスタ",
      value: `${summary.productCount} 件`,
      note:
        summary.productImportHistoryCount > 0
          ? `一括取り込み履歴 ${summary.productImportHistoryCount} 件`
          : "手入力または一括取り込み",
    },
    {
      label: "発注先",
      value: `${summary.supplierCount} 件`,
      note: `商品側の未設定 ${summary.missingSupplierCount} 件`,
    },
    {
      label: "バーコード",
      value: `未登録 ${summary.missingBarcodeCount} 件`,
      note: `未対応読み取り ${summary.unresolvedBarcodeScanCount} 件`,
    },
    {
      label: "最低在庫",
      value: `未設定 ${summary.missingMinStockCount} 件`,
      note: `在庫行未設定 ${summary.missingStockItemCount} 件`,
    },
  ];

  return (
    <>
      <AppNav current="setup" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 text-ink sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">初期設定チェック</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              商品、発注先、バーコード、最低在庫の登録状況をまとめて確認できます。
            </p>
          </div>
          <div className="rounded border border-line bg-white px-5 py-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">進捗</p>
            <p className="mt-2 text-3xl font-semibold">{completionPercent}%</p>
            <p className="mt-1 text-sm text-muted">
              {summary.completedStepCount} / {summary.totalStepCount} 項目
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded border border-line bg-white p-5 shadow-panel">
              <p className="text-sm font-semibold text-muted">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-xl font-semibold">導入チェックリスト</h2>
          </div>
          <div className="divide-y divide-line">
            {steps.map((step, index) => (
              <article key={step.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className={`rounded px-3 py-1 text-xs font-semibold ${getStatusClassName(step.status)}`}>
                    {getStatusLabel(step.status)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
                  <p className="mt-2 text-sm font-semibold text-muted">{step.metric}</p>
                </div>
                <a
                  className="inline-flex h-11 items-center justify-center rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  href={step.href}
                >
                  {step.actionLabel}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-xl font-semibold">おすすめの進め方</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted md:grid-cols-3">
            <p>まず商品マスタを一括取り込みし、商品名とカテゴリの土台を作ります。</p>
            <p>次に発注先、バーコード、最低在庫を整えると、不足一覧と発注候補が使いやすくなります。</p>
            <p>未対応バーコードは、実際に読み取った後で既存商品へ紐づけると現場に合わせて整理できます。</p>
          </div>
        </section>
      </main>
    </>
  );
}
