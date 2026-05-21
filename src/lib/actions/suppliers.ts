"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { isAdminRole } from "@/lib/auth/roles";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const nullableTextSchema = z
  .string()
  .trim()
  .max(100, "100文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableAddressSchema = z
  .string()
  .trim()
  .max(300, "住所は300文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const nullableEmailSchema = z
  .string()
  .trim()
  .max(254, "メールアドレスは254文字以内で入力してください。")
  .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "メールアドレスの形式を確認してください。",
  })
  .transform((value) => (value.length > 0 ? value : null));

const nullableLongTextSchema = z
  .string()
  .trim()
  .max(1000, "備考は1000文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

const supplierIdSchema = z.string().min(1);
const supplierMasterSchema = z.object({
  name: z.string().trim().min(1, "発注先名を入力してください。").max(100, "発注先名は100文字以内で入力してください。"),
  address: nullableAddressSchema,
  phone: nullableTextSchema,
  fax: nullableTextSchema,
  email: nullableEmailSchema,
  contactPersonName: nullableTextSchema,
  contactPersonEmail: nullableEmailSchema,
  notes: nullableLongTextSchema,
});

export type SupplierMasterInput = z.infer<typeof supplierMasterSchema>;
export type SupplierMasterFieldName = keyof SupplierMasterInput;

export type SupplierMasterActionState = {
  status?: "success" | "error";
  message?: string;
  supplierId?: string;
  fieldErrors?: Partial<Record<SupplierMasterFieldName, string>>;
};

const supplierAdminOnlyMessage = "発注先マスタの作成・編集は管理者のみ可能です。";

async function assertSupplierAdminContext(context: ActiveClinicContext) {
  const user = await prisma.user.findFirst({
    where: {
      id: context.userId,
      organizationId: context.organizationId,
      isActive: true,
    },
    select: {
      role: true,
    },
  });

  if (!isAdminRole(user?.role)) {
    throw new Error(supplierAdminOnlyMessage);
  }
}

function toFieldErrors(error: z.ZodError): Partial<Record<SupplierMasterFieldName, string>> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors: Partial<Record<SupplierMasterFieldName, string>> = {};

  for (const [fieldName, messages] of Object.entries(flattened)) {
    const firstMessage = messages?.[0];

    if (firstMessage) {
      fieldErrors[fieldName as SupplierMasterFieldName] = firstMessage;
    }
  }

  return fieldErrors;
}

function toActionError(error: unknown): SupplierMasterActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
      fieldErrors: toFieldErrors(error),
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
    message: "発注先マスタを保存できませんでした。",
  };
}

function parseSupplierMasterInput(formData: FormData): SupplierMasterInput {
  return supplierMasterSchema.parse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    fax: formData.get("fax") ?? "",
    email: formData.get("email") ?? "",
    contactPersonName: formData.get("contactPersonName") ?? "",
    contactPersonEmail: formData.get("contactPersonEmail") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

function revalidateSupplierPages(supplierId?: string) {
  revalidatePath("/home");
  revalidatePath("/products");
  revalidatePath("/shortage");
  revalidatePath("/orders");
  revalidatePath("/suppliers");

  if (supplierId) {
    revalidatePath(`/suppliers/${supplierId}`);
    revalidatePath(`/suppliers/${supplierId}/edit`);
  }
}

export async function createSupplierForContext(context: ActiveClinicContext, input: SupplierMasterInput) {
  await assertSupplierAdminContext(context);

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: context.organizationId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      fax: input.fax,
      email: input.email,
      contactPersonName: input.contactPersonName,
      contactPersonEmail: input.contactPersonEmail,
      notes: input.notes,
    },
    select: {
      id: true,
    },
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: auditActions.supplierCreate,
    targetType: "Supplier",
    targetId: supplier.id,
  });

  return supplier;
}

export async function updateSupplierForContext(context: ActiveClinicContext, supplierId: string, input: SupplierMasterInput) {
  await assertSupplierAdminContext(context);

  const parsedSupplierId = supplierIdSchema.parse(supplierId);
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: parsedSupplierId,
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
      id: parsedSupplierId,
    },
    data: {
      name: input.name,
      address: input.address,
      phone: input.phone,
      fax: input.fax,
      email: input.email,
      contactPersonName: input.contactPersonName,
      contactPersonEmail: input.contactPersonEmail,
      notes: input.notes,
    },
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: auditActions.supplierUpdate,
    targetType: "Supplier",
    targetId: parsedSupplierId,
  });

  return {
    id: parsedSupplierId,
  };
}

export async function createSupplierAction(
  _previousState: SupplierMasterActionState,
  formData: FormData,
): Promise<SupplierMasterActionState> {
  try {
    const context = await requireActiveClinic();
    const supplier = await createSupplierForContext(context, parseSupplierMasterInput(formData));

    revalidateSupplierPages(supplier.id);

    return {
      status: "success",
      message: "発注先マスタを作成しました。",
      supplierId: supplier.id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateSupplierMasterWithStateAction(
  _previousState: SupplierMasterActionState,
  formData: FormData,
): Promise<SupplierMasterActionState> {
  try {
    const context = await requireActiveClinic();
    const supplierId = supplierIdSchema.parse(formData.get("supplierId"));
    const supplier = await updateSupplierForContext(context, supplierId, parseSupplierMasterInput(formData));

    revalidateSupplierPages(supplier.id);

    return {
      status: "success",
      message: "発注先マスタを更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
