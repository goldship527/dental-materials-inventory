"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

export type SupplierMasterActionState = {
  status?: "success" | "error";
  message?: string;
};

const supplierMasterSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().trim().min(1, "発注先名を入力してください。").max(100, "発注先名は100文字以内で入力してください。"),
});

function toActionError(error: unknown): SupplierMasterActionState {
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
    message: "発注先マスタを更新できませんでした。",
  };
}

export async function updateSupplierMasterWithStateAction(
  _previousState: SupplierMasterActionState,
  formData: FormData,
): Promise<SupplierMasterActionState> {
  try {
    const context = await requireActiveClinic();
    const input = supplierMasterSchema.parse({
      supplierId: formData.get("supplierId"),
      name: formData.get("name") ?? "",
    });

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: input.supplierId,
        organizationId: context.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!supplier) {
      throw new Error("対象の発注先が見つかりません。");
    }

    await prisma.supplier.update({
      where: {
        id: input.supplierId,
      },
      data: {
        name: input.name,
      },
    });

    revalidatePath("/home");
    revalidatePath("/products");
    revalidatePath("/shortage");
    revalidatePath("/orders");
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${input.supplierId}`);
    revalidatePath(`/suppliers/${input.supplierId}/edit`);

    return {
      status: "success",
      message: "発注先マスタを更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
