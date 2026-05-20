"use server";

import { rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

export type ProductPhotoActionState = {
  status?: "success" | "error";
  message?: string;
};

const maxPhotoSizeBytes = 2 * 1024 * 1024;
const uploadDirectory = path.join(process.cwd(), "data", "local", "uploads", "products");
const allowedMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const productPhotoSchema = z.object({
  productId: z.string().trim().min(1),
});

function toActionError(error: unknown): ProductPhotoActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "写真を更新できませんでした。",
  };
}

async function assertEditableProduct(productId: string, organizationId: string, clinicId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
      isActive: true,
      stockItems: {
        some: {
          clinicId,
          isUsed: true,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("対象の商品が見つかりません。");
  }

  return product;
}

function getPhotoFileName(productId: string, extension: string) {
  return `${productId}.${extension}`;
}

async function removeExistingPhotoFiles(productId: string) {
  await Promise.all(
    Array.from(allowedMimeTypes.values()).map((extension) =>
      rm(path.join(uploadDirectory, getPhotoFileName(productId, extension)), {
        force: true,
      }),
    ),
  );
}

function revalidateProductPhotoPaths(productId: string) {
  revalidatePath("/home");
  revalidatePath("/quick");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
}

export async function uploadProductPhotoForContext(options: {
  context: ActiveClinicContext;
  productId: string;
  photo: File;
  revalidate?: boolean;
}) {
  if (options.photo.size === 0) {
    throw new Error("アップロードする写真を選択してください。");
  }

  if (options.photo.size > maxPhotoSizeBytes) {
    throw new Error("写真は2MB以内にしてください。");
  }

  const extension = allowedMimeTypes.get(options.photo.type);

  if (!extension) {
    throw new Error("写真はPNG、JPEG、WebPのいずれかを選択してください。");
  }

  await assertEditableProduct(options.productId, options.context.organizationId, options.context.clinicId);
  await mkdir(uploadDirectory, {
    recursive: true,
  });
  await removeExistingPhotoFiles(options.productId);

  const fileName = getPhotoFileName(options.productId, extension);
  const bytes = new Uint8Array(await options.photo.arrayBuffer());

  await writeFile(path.join(uploadDirectory, fileName), bytes);
  await prisma.product.update({
    where: {
      id: options.productId,
    },
    data: {
      photoFileName: fileName,
      photoMimeType: options.photo.type,
      photoUpdatedAt: new Date(),
    },
  });

  if (options.revalidate ?? true) {
    revalidateProductPhotoPaths(options.productId);
  }

  return {
    fileName,
  };
}

export async function deleteProductPhotoForContext(options: {
  context: ActiveClinicContext;
  productId: string;
  revalidate?: boolean;
}) {
  await assertEditableProduct(options.productId, options.context.organizationId, options.context.clinicId);
  await removeExistingPhotoFiles(options.productId);
  await prisma.product.update({
    where: {
      id: options.productId,
    },
    data: {
      photoFileName: null,
      photoMimeType: null,
      photoUpdatedAt: null,
    },
  });

  if (options.revalidate ?? true) {
    revalidateProductPhotoPaths(options.productId);
  }
}

export async function uploadProductPhotoAction(
  _previousState: ProductPhotoActionState,
  formData: FormData,
): Promise<ProductPhotoActionState> {
  try {
    const context = await requireActiveClinic();
    const input = productPhotoSchema.parse({
      productId: formData.get("productId"),
    });
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      throw new Error("アップロードする写真を選択してください。");
    }

    await uploadProductPhotoForContext({
      context,
      productId: input.productId,
      photo,
    });

    return {
      status: "success",
      message: "商品写真を更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductPhotoAction(
  _previousState: ProductPhotoActionState,
  formData: FormData,
): Promise<ProductPhotoActionState> {
  try {
    const context = await requireActiveClinic();
    const input = productPhotoSchema.parse({
      productId: formData.get("productId"),
    });

    await deleteProductPhotoForContext({
      context,
      productId: input.productId,
    });

    return {
      status: "success",
      message: "商品写真を削除しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
