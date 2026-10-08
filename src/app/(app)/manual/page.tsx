import { SectionHeading } from "@/components/ui/section-heading";
import { PageHeader } from "@/components/ui/page-header";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell current="manual" mainClassName="pt-3 pb-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <PageHeader title={"スタッフマニュアル"}>
            <div>

              <p className="mt-2 text-sm text-muted">日常操作の確認用マニュアルです。</p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded btn-secondary px-4 text-sm font-semibold transition"
              href="/home"
            >
              ホームへ戻る
            </a>
          </PageHeader>

          {!barcodeUiEnabled && <section className="grid gap-3 rounded border border-line bg-panel p-3 text-base">
            <SectionHeading>現在の出庫は商品カードから行います</SectionHeading>
            <p>「出庫」から商品名・規格やカテゴリで探し、商品を選んでください。担当者、出庫数、在庫と同じ単位で出すことを確認して確定します。</p>
            <p>商品の「出し方」を確認してください。箱から本などへの換算はまだ行いません。単位が不明な商品は管理者に確認してください。</p>
            <p>「納品する」は自院の納品待ち商品を発注日ごとに表示します。届いた商品を選び、数量を確認して確定すると在庫に追加されます。</p>
            <a href="/receive" className="inline-flex min-h-12 items-center justify-center rounded btn-secondary px-4 font-semibold">納品を開く</a>
            <a href="/stock-out" className="inline-flex min-h-12 items-center justify-center rounded btn-secondary px-4 font-semibold">商品カードの出庫を開く</a>
          </section>}
          {barcodeUiEnabled && <ManualViewer markdown={markdown} />}
        </div>
    </PageShell>
  );
}
