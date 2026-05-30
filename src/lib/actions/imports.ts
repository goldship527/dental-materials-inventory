"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import {
  findMedicalDeviceSampleRecord,
  type MedicalDeviceSampleRecord,
} from "@/lib/imports/medical-device-samples";

const createTestProductSchema = z.object({
  janCode: z.string().trim().regex(/^\d{13}$/, "JANコードが不正です。"),
  sourceFile: z.string().trim().min(1),
  sourceRow: z.coerce.number().int().positive(),
});

function buildProductCode(janCode: string) {
  return `TEST-${janCode.slice(-8)}`;
}

function buildSampleProductNotes(sample: MedicalDeviceSampleRecord) {
  return [
    "取込サンプルから作成したローカル検証用商品です。",
    `元ファイル: ${sample.sourceFile}`,
    `元シート: ${sample.sourceSheet}`,
    `元行: ${sample.sourceRow}`,
    sample.jmdnCode ? `JMDN: ${sample.jmdnCode}` : "",
    sample.approvalNumber ? `承認・認証番号等: ${sample.approvalNumber}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createOrFindTestProductFromSampleForContext(input: {
  organizationId: string;
  clinicId: string;
  sample: MedicalDeviceSampleRecord;
}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lockKey = `${input.organizationId}:${input.sample.janCode}`;

          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
          `;

          const existingProduct = await tx.product.findFirst({
            where: {
              organizationId: input.organizationId,
              isActive: true,
              OR: [
                {
                  janCode: input.sample.janCode,
                },
                {
                  barcodes: {
                    some: {
                      barcode: input.sample.janCode,
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
            },
          });

          let productId: string;

          if (existingProduct) {
            productId = existingProduct.id;
          } else {
            const product = await tx.product.create({
              data: {
                organizationId: input.organizationId,
                productCode: buildProductCode(input.sample.janCode),
                janCode: input.sample.janCode,
                name: input.sample.productName,
                nameKana: input.sample.productNameKana || null,
                category: input.sample.genericName || "取込サンプル",
                manufacturer: input.sample.manufacturer || null,
                specification: [input.sample.productNumber, input.sample.classCategory].filter(Boolean).join(" / ") || null,
                orderUnit: input.sample.packageUnit || null,
                defaultMinStock: 1,
                notes: buildSampleProductNotes(input.sample),
              },
              select: {
                id: true,
              },
            });

            productId = product.id;

            await tx.productBarcode.create({
              data: {
                organizationId: input.organizationId,
                productId,
                barcode: input.sample.janCode,
                barcodeType: "JAN",
                unitLabel: input.sample.packageUnit || null,
                isPrimary: true,
              },
            });
          }

          await tx.stockItem.createMany({
            data: {
              clinicId: input.clinicId,
              productId,
              quantity: 0,
              minStock: 1,
              location: "検証用",
              isUsed: true,
            },
            skipDuplicates: true,
          });

          return productId;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        attempt < maxAttempts &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("取込サンプルから検証用商品を作成できませんでした。");
}

export async function createTestProductFromSampleAction(formData: FormData) {
  await requireAdminUser({
    unauthorizedRedirectTo: "/barcode",
  });
  const context = await requireActiveClinic();
  const input = createTestProductSchema.parse({
    janCode: formData.get("janCode"),
    sourceFile: formData.get("sourceFile"),
    sourceRow: formData.get("sourceRow"),
  });
  const sample = await findMedicalDeviceSampleRecord(input);

  if (!sample) {
    throw new Error("取込サンプルが見つかりません。");
  }

  const productId = await createOrFindTestProductFromSampleForContext({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    sample,
  });

  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/shortage");
  revalidatePath("/products");
  revalidatePath("/barcode");
  revalidatePath("/imports/medical-devices");

  redirect(`/products/${productId}`);
}
