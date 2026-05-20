"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const nullableTextSchema = z
  .string()
  .trim()
  .max(100, "100文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableLongTextSchema = z
  .string()
  .trim()
  .max(500, "備考は500文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const productMasterSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, "商品名を入力してください。").max(100, "商品名は100文字以内で入力してください。"),
  productCode: nullableTextSchema,
  janCode: nullableTextSchema,
  category: nullableTextSchema,
  manufacturer: nullableTextSchema,
  specification: nullableTextSchema,
  orderUnit: nullableTextSchema,
  primarySupplierId: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
  supplierProductCode: nullableTextSchema,
  standardPrice: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? Number(value) : null))
    .pipe(z.number().nonnegative("標準価格は0以上で入力してください。").max(9999999).nullable()),
  defaultMinStock: z.coerce.number().int("最低在庫は整数で入力してください。").min(0, "最低在庫は0以上で入力してください。").max(9999),
  notes: nullableLongTextSchema,
});

const nullableShortTextSchema = z
  .string()
  .trim()
  .max(64, "64文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableCreateTextSchema = z
  .string()
  .trim()
  .max(100, "100文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableCreateLongTextSchema = z
  .string()
  .trim()
  .max(1000, "備考は1000文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableJanCodeSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || /^\d{13}$/.test(value), {
    message: "JANコードは13桁の数字で入力してください。",
  })
  .transform((value) => (value.length > 0 ? value : null));

const nullablePriceSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? null : value),
  z.coerce.number().nonnegative("標準価格は0以上で入力してください。").max(9999999).nullable(),
);

const createProductSchema = z.object({
  name: z.string().trim().min(1, "商品名を入力してください。").max(100, "商品名は100文字以内で入力してください。"),
  productCode: nullableShortTextSchema,
  janCode: nullableJanCodeSchema,
  internalCode: nullableShortTextSchema,
  category: nullableCreateTextSchema,
  manufacturer: nullableCreateTextSchema,
  specification: nullableCreateTextSchema,
  orderUnit: nullableCreateTextSchema,
  primarySupplierId: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
  supplierProductCode: nullableShortTextSchema,
  standardPrice: nullablePriceSchema,
  defaultMinStock: z.coerce
    .number()
    .int("最低在庫は整数で入力してください。")
    .min(0, "最低在庫は0以上で入力してください。")
    .max(9999, "最低在庫は9999以下で入力してください。"),
  notes: nullableCreateLongTextSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type ProductMasterActionState = {
  status?: "success" | "error";
  message?: string;
  productId?: string;
  fieldErrors?: Partial<Record<keyof CreateProductInput, string>>;
};

function toFieldErrors<FieldName extends string>(error: z.ZodError): Partial<Record<FieldName, string>> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors: Partial<Record<FieldName, string>> = {};

  for (const [fieldName, messages] of Object.entries(flattened)) {
    const firstMessage = messages?.[0];

    if (firstMessage) {
      fieldErrors[fieldName as FieldName] = firstMessage;
    }
  }

  return fieldErrors;
}

function toActionError(error: unknown): ProductMasterActionState {
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
    message: "商品マスタを更新できませんでした。",
  };
}

function isJanUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("janCode");
  }

  return typeof target === "string" ? target.includes("janCode") : true;
}

export async function updateProductMasterWithStateAction(
  _previousState: ProductMasterActionState,
  formData: FormData,
): Promise<ProductMasterActionState> {
  try {
    const context = await requireActiveClinic();
    const input = productMasterSchema.parse({
      productId: formData.get("productId"),
      name: formData.get("name") ?? "",
      productCode: formData.get("productCode") ?? "",
      janCode: formData.get("janCode") ?? "",
      category: formData.get("category") ?? "",
      manufacturer: formData.get("manufacturer") ?? "",
      specification: formData.get("specification") ?? "",
      orderUnit: formData.get("orderUnit") ?? "",
      primarySupplierId: formData.get("primarySupplierId") ?? "",
      supplierProductCode: formData.get("supplierProductCode") ?? "",
      standardPrice: formData.get("standardPrice") ?? "",
      defaultMinStock: formData.get("defaultMinStock") ?? "",
      notes: formData.get("notes") ?? "",
    });

    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        organizationId: context.organizationId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new Error("対象の商品が見つかりません。");
    }

    if (input.primarySupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: input.primarySupplierId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!supplier) {
        throw new Error("選択した発注先が見つかりません。");
      }
    }

    await prisma.product.update({
      where: {
        id: input.productId,
      },
      data: {
        name: input.name,
        productCode: input.productCode,
        janCode: input.janCode,
        category: input.category,
        manufacturer: input.manufacturer,
        specification: input.specification,
        orderUnit: input.orderUnit,
        primarySupplierId: input.primarySupplierId,
        supplierProductCode: input.supplierProductCode,
        standardPrice: input.standardPrice,
        defaultMinStock: input.defaultMinStock,
        notes: input.notes,
      },
    });

    revalidatePath("/home");
    revalidatePath("/inventory");
    revalidatePath("/shortage");
    revalidatePath("/orders");
    revalidatePath("/products");
    revalidatePath(`/products/${input.productId}`);
    revalidatePath(`/products/${input.productId}/edit`);
    revalidatePath("/suppliers");

    return {
      status: "success",
      message: "商品マスタを更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createProductAction(
  _previousState: ProductMasterActionState,
  formData: FormData,
): Promise<ProductMasterActionState> {
  try {
    const context = await requireActiveClinic();
    const input = createProductSchema.parse({
      name: formData.get("name") ?? "",
      productCode: formData.get("productCode") ?? "",
      janCode: formData.get("janCode") ?? "",
      internalCode: formData.get("internalCode") ?? "",
      category: formData.get("category") ?? "",
      manufacturer: formData.get("manufacturer") ?? "",
      specification: formData.get("specification") ?? "",
      orderUnit: formData.get("orderUnit") ?? "",
      primarySupplierId: formData.get("primarySupplierId") ?? "",
      supplierProductCode: formData.get("supplierProductCode") ?? "",
      standardPrice: formData.get("standardPrice") ?? "",
      defaultMinStock: formData.get("defaultMinStock") ?? "0",
      notes: formData.get("notes") ?? "",
    });

    if (input.primarySupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: input.primarySupplierId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!supplier) {
        throw new Error("選択した発注先が見つかりません。");
      }
    }

    const product = await prisma.product.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
        productCode: input.productCode,
        janCode: input.janCode,
        internalCode: input.internalCode,
        category: input.category,
        manufacturer: input.manufacturer,
        specification: input.specification,
        orderUnit: input.orderUnit,
        primarySupplierId: input.primarySupplierId,
        supplierProductCode: input.supplierProductCode,
        standardPrice: input.standardPrice,
        defaultMinStock: input.defaultMinStock,
        notes: input.notes,
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/home");
    revalidatePath("/products");
    revalidatePath(`/products/${product.id}`);

    return {
      status: "success",
      message: "商品マスタを作成しました。",
      productId: product.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "error",
        message: error.issues[0]?.message ?? "入力内容を確認してください。",
        fieldErrors: toFieldErrors<keyof CreateProductInput & string>(error),
      };
    }

    if (isJanUniqueConflict(error)) {
      return {
        status: "error",
        message: "同じ組織で同じJANコードの商品が既にあります。",
        fieldErrors: {
          janCode: "同じ組織で同じJANコードの商品が既にあります。",
        },
      };
    }

    return toActionError(error);
  }
}
