import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { ManualViewer } from "./manual-viewer";
import { barcodeUiEnabled } from "@/lib/workflow-features";

export default async function ManualPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const markdown = await readFile(path.join(process.cwd(), "docs", "user-manual.md"), "utf8");

  return (
    <>
      <AppNav current="manual" />
      <main className="min-h-screen bg-surface px-4 py-8 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
              <h1 className="mt-2 text-3xl font-semibold">スタッフマニュアル</h1>
              <p className="mt-2 text-sm text-muted">日常操作の確認用マニュアルです。</p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-accent transition hover:border-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </header>

          {!barcodeUiEnabled && <section className="grid gap-3 rounded-xl border border-line bg-panel p-5 text-base">
            <h2 className="text-lg font-semibold">現在の出庫は商品カードから行います</h2>
            <p>「出庫」から商品名・規格やカテゴリで探し、商品を選んでください。担当者、出庫数、在庫と同じ単位で出すことを確認して確定します。</p>
            <p>箱から本などへの換算はまだ行いません。単位が不明な商品は管理者に確認してください。納品は発注の納品待ち一覧から確認します。</p>
            <p className="text-sm text-muted">バーコードは一時保留中です。以下のバーコード関連の説明は、再開時の参考として残しています。</p>
            <a href="/stock-out" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-muted px-4 font-semibold focus-visible:ring-2 focus-visible:ring-accent">商品カードの出庫を開く</a>
          </section>}
          <ManualViewer markdown={markdown} />
        </div>
      </main>
    </>
  );
}
