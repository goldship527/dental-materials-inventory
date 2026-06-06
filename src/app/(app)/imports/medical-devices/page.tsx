import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Ean13Barcode } from "@/components/domain/ean13-barcode";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { requireActiveClinic } from "@/lib/db/clinic";
import {
  filterMedicalDeviceSampleRecords,
  getMedicalDeviceSourceFiles,
  readMedicalDeviceSampleCache,
} from "@/lib/imports/medical-device-samples";
import { ImportPreviewForm } from "./import-preview-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    sourceFile?: string;
    duplicateOnly?: string;
  }>;
};

function buildLabelsHref(q: string, sourceFile: string, duplicateOnly: boolean) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (sourceFile) {
    params.set("sourceFile", sourceFile);
  }

  if (duplicateOnly) {
    params.set("duplicateOnly", "1");
  }

  const query = params.toString();
  return `/imports/medical-devices/barcode-labels${query ? `?${query}` : ""}`;
}

export default async function MedicalDeviceImportPreviewPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/home",
  });
  const context = await requireActiveClinic();
  const cacheResult = await readMedicalDeviceSampleCache();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const sourceFile = params.sourceFile?.trim() ?? "";
  const duplicateOnly = params.duplicateOnly === "1";

  if (cacheResult.status === "missing") {
    return (
      <>
        <AppNav current="imports" />
        <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 text-ink sm:px-6 lg:px-8">
          <header className="border-b border-line pb-5">
            <h1 className="text-2xl font-semibold">医療機器データ取り込みプレビュー</h1>
          </header>
          <section className="rounded border border-line bg-white p-5 text-sm text-muted shadow-panel">
            <p className="font-semibold text-ink">ローカルキャッシュがまだありません。</p>
            <p className="mt-2">
              サンプルXLSを読み取る場合は、ローカル環境で{" "}
              <code className="rounded bg-gray-50 px-1 py-0.5">scripts/build-medical-device-sample-cache.py</code> を実行し、
              <code className="rounded bg-gray-50 px-1 py-0.5">{cacheResult.cachePath}</code> を作成してください。
            </p>
          </section>
        </main>
      </>
    );
  }

  const cache = cacheResult.cache;
  const sourceFiles = getMedicalDeviceSourceFiles(cache);
  const duplicateRecordCount = cache.records.filter((record) => record.isDuplicateJan).length;
  const { filtered, visible } = filterMedicalDeviceSampleRecords(cache, {
    q,
    sourceFile,
    duplicateOnly,
    limit: 100,
  });
  const visibleJanCodes = Array.from(new Set(visible.map((record) => record.janCode)));
  const existingProducts = visibleJanCodes.length
    ? await prisma.product.findMany({
        where: {
          organizationId: context.organizationId,
          isActive: true,
          OR: [
            {
              janCode: {
                in: visibleJanCodes,
              },
            },
            {
              barcodes: {
                some: {
                  barcode: {
                    in: visibleJanCodes,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          janCode: true,
          barcodes: {
            where: {
              barcode: {
                in: visibleJanCodes,
              },
            },
            select: {
              barcode: true,
            },
          },
        },
      })
    : [];
  const existingByJan = new Map<string, Array<{ id: string; name: string }>>();

  for (const product of existingProducts) {
    const matchedCodes = new Set(product.barcodes.map((barcode) => barcode.barcode));

    if (product.janCode && visibleJanCodes.includes(product.janCode)) {
      matchedCodes.add(product.janCode);
    }

    for (const janCode of matchedCodes) {
      existingByJan.set(janCode, [...(existingByJan.get(janCode) ?? []), { id: product.id, name: product.name }]);
    }
  }

  return (
    <>
      <AppNav current="imports" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 text-ink sm:px-6 lg:px-8">
        <header className="border-b border-line pb-5">
          <div>
            <h1 className="text-2xl font-semibold">医療機器データ取り込みプレビュー</h1>
            <p className="mt-2 text-sm text-muted">
              取込サンプルを表示しています。
            </p>
          </div>
        </header>


        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-xs font-semibold text-muted">読み取り件数</p>
            <p className="mt-1 text-2xl font-semibold">{cache.recordCount.toLocaleString()}</p>
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-xs font-semibold text-muted">表示対象</p>
            <p className="mt-1 text-2xl font-semibold">{filtered.length.toLocaleString()}</p>
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-xs font-semibold text-muted">重複JAN行</p>
            <p className="mt-1 text-2xl font-semibold">{duplicateRecordCount.toLocaleString()}</p>
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-panel">
            <p className="text-xs font-semibold text-muted">キャッシュ作成</p>
            <p className="mt-1 text-sm font-semibold">{new Date(cache.generatedAt).toLocaleString("ja-JP")}</p>
          </div>
        </section>

        <ImportPreviewForm q={q} sourceFile={sourceFile} duplicateOnly={duplicateOnly} sourceFiles={sourceFiles} />

        <div className="flex flex-col gap-3 rounded border border-line bg-white p-4 text-sm text-muted shadow-panel md:flex-row md:items-center md:justify-between">
          <p>
            最大100件を表示中。バーコード印刷画面では、同じ条件の先頭60件をテストラベルとして表示します。
          </p>
          <a
            href={buildLabelsHref(q, sourceFile, duplicateOnly)}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded bg-accent px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            バーコードテスト印刷へ
          </a>
        </div>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="px-3 py-3">JAN</th>
                  <th className="px-3 py-3">バーコード</th>
                  <th className="px-3 py-3">製品</th>
                  <th className="px-3 py-3">分類</th>
                  <th className="px-3 py-3">既存照合</th>
                  <th className="px-3 py-3">元データ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((record) => {
                  const matches = existingByJan.get(record.janCode) ?? [];

                  return (
                    <tr key={`${record.sourceFile}-${record.sourceRow}-${record.janCode}`} className="align-top">
                      <td className="px-3 py-3">
                        <p className="font-mono font-semibold">{record.janCode}</p>
                        {record.isDuplicateJan ? <p className="mt-1 text-xs font-semibold text-warning">重複JAN</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <Ean13Barcode value={record.janCode} height={42} moduleWidth={1.4} showText={false} />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{record.productName}</p>
                        <p className="mt-1 text-xs text-muted">{record.manufacturer || "メーカー未設定"}</p>
                        <p className="mt-1 text-xs text-muted">包装単位: {record.packageUnit || "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <p>{record.genericName || "-"}</p>
                        <p className="mt-1 font-mono text-xs">JMDN {record.jmdnCode || "-"}</p>
                      </td>
                      <td className="px-3 py-3">
                        {matches.length > 0 ? (
                          <div className="grid gap-1">
                            {matches.map((match) => (
                              <a key={match.id} className="font-semibold text-accent hover:underline" href={`/products/${match.id}`}>
                                {match.name}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">未登録</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        <p>{record.sourceFile}</p>
                        <p>{record.sourceSheet}</p>
                        <p>行 {record.sourceRow}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length === 0 ? <p className="p-6 text-center text-sm text-muted">条件に合うデータがありません。</p> : null}
        </section>
      </main>
    </>
  );
}
