import { PageHeader } from "@/components/ui/page-header";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductDetail, getProductSupplierOptions } from "@/lib/db/products";
import { BarcodeManagement } from "./barcode-management";
import { PhotoManagement } from "./photo-management";
import { ProductEditForm } from "./product-edit-form";
import { barcodeUiEnabled } from "@/lib/workflow-features";

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

  const { productId } = await params;
  await requireAdminUser({
    unauthorizedRedirectTo: `/products/${productId}`,
  });
  const context = await requireActiveClinic();
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
    <PageShell current="products" mainClassName="px-3 pt-3 pb-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <PageHeader title={"商品マスタ編集"}>
            <a className="text-sm font-semibold text-accent hover:underline" href={`/products/${product.id}`}>
              商品詳細へ戻る
            </a>
          </PageHeader>

          <ProductEditForm product={product} suppliers={suppliers} />
          <PhotoManagement
            productId={product.id}
            productName={product.name}
            photoUpdatedAt={product.photoUpdatedAt?.getTime() ?? null}
          />
          {barcodeUiEnabled && <BarcodeManagement
            productId={product.id}
            janCode={product.janCode}
            barcodes={product.barcodes}
            defaultNewBarcode={newBarcode}
          />}
        </div>
    </PageShell>
  );
}
