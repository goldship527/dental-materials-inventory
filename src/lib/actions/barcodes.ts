"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markMatchingBarcodeScanLogsLinkedForContext } from "@/lib/actions/barcode-scan-logs";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

export type BarcodeActionState = {
  status?: "success" | "error";
  message?: string;
};

const nullableTextSchema = z
  .string()
  .trim()
  .max(100, "100文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const barcodeBaseSchema = z.object({
  productId: z.string().min(1),
  barcode: z
    .string()
    .transform((value) => normalizeBarcodeText(value))
    .pipe(
      z
        .string()
        .min(1, "バーコードを入力してください。")
        .max(100, "バーコードは100文字以内で入力してください。"),
    ),
  barcodeType: z.string().trim().min(1, "種別を入力してください。").max(40, "種別は40文字以内で入力してください。"),
  unitLabel: nullableTextSchema,
  isPrimary: z.boolean(),
});

const createBarcodeSchema = barcodeBaseSchema;
const updateBarcodeSchema = barcodeBaseSchema.extend({
  barcodeId: z.string().min(1),
});
const unlinkBarcodeSchema = z.object({
  productId: z.string().min(1),
  barcodeId: z.string().min(1),
});

function checkboxToBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function toActionError(error: unknown): BarcodeActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      status: "error",
      message: "組織内に既に同じバーコードがあります。",
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
    message: "バーコードを更新できませんでした。",
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
      janCode: true,
    },
  });

  if (!product) {
    throw new Error("対象の商品が見つかりません。");
  }

  return product;
}

async function assertBarcodeNotUsedByAnotherProduct(input: {
  barcode: string;
  productId: string;
  organizationId: string;
  currentBarcodeId?: string;
}) {
  const barcodeRecord = await prisma.productBarcode.findFirst({
    where: {
      barcode: input.barcode,
      organizationId: input.organizationId,
      id: input.currentBarcodeId
        ? {
            not: input.currentBarcodeId,
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });

  if (barcodeRecord) {
    throw new Error("同じバーコードがすでに登録されています。");
  }

  const janProduct = await prisma.product.findFirst({
    where: {
      organizationId: input.organizationId,
      janCode: input.barcode,
      id: {
        not: input.productId,
      },
    },
    select: {
      id: true,
    },
  });

  if (janProduct) {
    throw new Error("同じJANコードを持つ別の商品があります。");
  }
}

function revalidateBarcodePages(productId: string) {
  revalidatePath("/barcode");
  revalidatePath("/barcode/scans");
  revalidatePath("/barcode/scans/unresolved");
  revalidatePath("/barcode/scans/unmatched");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
}

export async function createProductBarcodeWithStateAction(
  _previousState: BarcodeActionState,
  formData: FormData,
): Promise<BarcodeActionState> {
  try {
    const context = await requireActiveClinic();
    const input = createBarcodeSchema.parse({
      productId: formData.get("productId"),
      barcode: formData.get("barcode") ?? "",
      barcodeType: formData.get("barcodeType") ?? "",
      unitLabel: formData.get("unitLabel") ?? "",
      isPrimary: checkboxToBoolean(formData.get("isPrimary")),
    });

    await assertEditableProduct(input.productId, context.organizationId, context.clinicId);
    await assertBarcodeNotUsedByAnotherProduct({
      barcode: input.barcode,
      productId: input.productId,
      organizationId: context.organizationId,
    });

    await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productBarcode.updateMany({
          where: {
            productId: input.productId,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      await tx.productBarcode.create({
        data: {
          organizationId: context.organizationId,
          productId: input.productId,
          barcode: input.barcode,
          barcodeType: input.barcodeType,
          unitLabel: input.unitLabel,
          isPrimary: input.isPrimary,
        },
      });

      await markMatchingBarcodeScanLogsLinkedForContext({
        context,
        barcode: input.barcode,
        db: tx,
      });
    });

    revalidateBarcodePages(input.productId);

    return {
      status: "success",
      message: "バーコードを追加しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProductBarcodeWithStateAction(
  _previousState: BarcodeActionState,
  formData: FormData,
): Promise<BarcodeActionState> {
  try {
    const context = await requireActiveClinic();
    const input = updateBarcodeSchema.parse({
      productId: formData.get("productId"),
      barcodeId: formData.get("barcodeId"),
      barcode: formData.get("barcode") ?? "",
      barcodeType: formData.get("barcodeType") ?? "",
      unitLabel: formData.get("unitLabel") ?? "",
      isPrimary: checkboxToBoolean(formData.get("isPrimary")),
    });

    await assertEditableProduct(input.productId, context.organizationId, context.clinicId);
    const existingBarcode = await prisma.productBarcode.findFirst({
      where: {
        id: input.barcodeId,
        productId: input.productId,
      },
      select: {
        id: true,
      },
    });

    if (!existingBarcode) {
      throw new Error("対象のバーコードが見つかりません。");
    }

    await assertBarcodeNotUsedByAnotherProduct({
      barcode: input.barcode,
      productId: input.productId,
      organizationId: context.organizationId,
      currentBarcodeId: input.barcodeId,
    });

    await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productBarcode.updateMany({
          where: {
            productId: input.productId,
            id: {
              not: input.barcodeId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      await tx.productBarcode.update({
        where: {
          id: input.barcodeId,
        },
        data: {
          barcode: input.barcode,
          barcodeType: input.barcodeType,
          unitLabel: input.unitLabel,
          isPrimary: input.isPrimary,
        },
      });
    });

    revalidateBarcodePages(input.productId);

    return {
      status: "success",
      message: "バーコードを更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function unlinkProductBarcodeWithStateAction(
  _previousState: BarcodeActionState,
  formData: FormData,
): Promise<BarcodeActionState> {
  try {
    const context = await requireActiveClinic();
    const input = unlinkBarcodeSchema.parse({
      productId: formData.get("productId"),
      barcodeId: formData.get("barcodeId"),
    });

    await assertEditableProduct(input.productId, context.organizationId, context.clinicId);
    const existingBarcode = await prisma.productBarcode.findFirst({
      where: {
        id: input.barcodeId,
        productId: input.productId,
      },
      select: {
        id: true,
      },
    });

    if (!existingBarcode) {
      throw new Error("対象のバーコードが見つかりません。");
    }

    await prisma.productBarcode.delete({
      where: {
        id: input.barcodeId,
      },
    });

    revalidateBarcodePages(input.productId);

    return {
      status: "success",
      message: "バーコードの紐づけを解除しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
