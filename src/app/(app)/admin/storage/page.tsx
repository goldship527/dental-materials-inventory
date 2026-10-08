import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getProductPhotoStorageDiagnostics, type ProductPhotoStorageDiagnosticItem } from "@/lib/storage/product-photos";

function statusClassName(status: ProductPhotoStorageDiagnosticItem["status"]) {
  if (status === "ok") {
    return "border-line bg-panel text-success";
  }

  if (status === "warning") {
    return "border-line border-l-4 border-l-ink bg-markSoft text-ink";
  }

  return "border-line bg-panel text-danger";
}

function statusLabel(status: ProductPhotoStorageDiagnosticItem["status"]) {
  if (status === "ok") {
    return "OK";
  }

  if (status === "warning") {
    return "確認";
  }

  return "NG";
}

export default async function AdminStoragePage() {
  await requireAdminUser();
  const diagnostics = await getProductPhotoStorageDiagnostics();
  const hasError = diagnostics.items.some((item) => item.status === "error");

  return (
    <>
      <AppNav current="storage" />
      <main className="mx-auto grid w-full max-w-7xl gap-3 px-3 pt-3 pb-6 lg:px-6">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-xl font-bold tracking-tight text-ink">ストレージ診断</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            商品写真の保存に使うSupabase Storage設定を確認します。秘密値そのものは表示しません。
          </p>
        </header>

        <section className="grid gap-4 rounded border border-line bg-panel p-3 shadow-sheet">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">商品写真ストレージ</h2>
              <p className="text-sm text-muted">
                現在の保存先: {diagnostics.mode === "supabase" ? "Supabase Storage" : "ローカル保存"}
              </p>
            </div>
            <span
              className={
                hasError
                  ? "inline-flex w-fit items-center rounded border border-line bg-panel px-3 py-1 text-sm font-semibold text-danger"
                  : "inline-flex w-fit items-center rounded border border-line bg-panel px-3 py-1 text-sm font-semibold text-success"
              }
            >
              {hasError ? "設定確認が必要" : "利用可能"}
            </span>
          </div>

          <div className="grid gap-3">
            {diagnostics.items.map((item) => (
              <div key={item.label} className="grid gap-2 rounded border border-line p-4 sm:grid-cols-[180px_96px_1fr] sm:items-start">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <span
                  className={`inline-flex w-fit items-center rounded border px-2.5 py-1 text-label font-semibold ${statusClassName(
                    item.status,
                  )}`}
                >
                  {statusLabel(item.status)}
                </span>
                <p className="text-sm leading-6 text-muted">{item.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded border border-line bg-panel p-3 shadow-sheet">
          <h2 className="text-lg font-semibold text-ink">Vercelで確認する値</h2>
          <p className="text-sm leading-6 text-muted">
            Production環境に、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、SUPABASE_STORAGE_BUCKET
            が設定されているか確認してください。値を変更した後は、ProductionをRedeployしてください。
          </p>
          <p className="text-sm leading-6 text-muted">
            SUPABASE_STORAGE_BUCKETにはURLではなくbucket名だけを入れます。例としては product-photos のような形です。
          </p>
        </section>
      </main>
    </>
  );
}
