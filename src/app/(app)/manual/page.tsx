import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { ManualViewer } from "./manual-viewer";

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

          <ManualViewer markdown={markdown} />
        </div>
      </main>
    </>
  );
}
