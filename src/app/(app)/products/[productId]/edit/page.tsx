import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductDetail, getProductSupplierOptions } from "@/lib/db/products";
import { BarcodeManagement } from "./barcode-management";
import { PhotoManagement } from "./photo-management";
import { ProductEditForm } from "./product-edit-form";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
  searchParams?: Promise<{
    newBarcode?: string;
  }>;
};

export default async function ProductEditPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const { productId } = await params;
  const search = (await searchParams) ?? {};
  const newBarcode = search.newBarcode?.trim() ?? "";
  const [product, suppliers] = await Promise.all([
    getProductDetail(productId, context.organizationId, context.clinicId),
    getProductSupplierOptions(context.organizationId),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">商品マスタ編集</h1>
            <p className="mt-2 text-sm text-muted">
              商品名、JANコード、発注先など、在庫判断に使う基本情報だけを編集します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href={`/products/${product.id}`}>
            商品詳細へ戻る
          </a>
        </header>

        <AppNav current="products" />

        <ProductEditForm product={product} suppliers={suppliers} />
        <PhotoManagement
          productId={product.id}
          productName={product.name}
          photoUpdatedAt={product.photoUpdatedAt?.getTime() ?? null}
        />
        <BarcodeManagement
          productId={product.id}
          janCode={product.janCode}
          barcodes={product.barcodes}
          defaultNewBarcode={newBarcode}
        />
      </div>
    </main>
  );
}
