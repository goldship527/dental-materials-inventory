import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import {
  getProductPhotoFileName,
  productPhotoAllowedMimeTypes,
  productPhotoLocalDirectory,
} from "../src/lib/storage/product-photos";
import { resetTestDatabase } from "./helpers/db";

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Test Clinic",
    },
  });
  const otherClinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Other Test Clinic",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Test User",
      email: `photo-${Date.now()}@example.test`,
      passwordHash: "test-password-hash",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });

  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "Photo Test Product",
      productCode: "PHOTO-TEST",
      defaultMinStock: 1,
    },
  });
  const otherClinicProduct = await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "Other Clinic Photo Product",
      productCode: "PHOTO-OTHER",
      defaultMinStock: 1,
    },
  });

  await prisma.stockItem.create({
    data: {
      clinicId: clinic.id,
      productId: product.id,
      quantity: 1,
      minStock: 1,
      location: "Test shelf",
    },
  });
  await prisma.stockItem.create({
    data: {
      clinicId: otherClinic.id,
      productId: otherClinicProduct.id,
      quantity: 1,
      minStock: 1,
      location: "Other shelf",
    },
  });

  const context = {
    userId: user.id,
    userName: user.name,
    organizationId: organization.id,
    clinicId: clinic.id,
    clinicName: clinic.name,
  };

  return {
    organization,
    clinic,
    otherClinic,
    user,
    product,
    otherClinicProduct,
    context,
  };
}

function makeFile(bytes: Uint8Array, type: string, name: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return new File([buffer], name, {
    type,
  });
}

async function main() {
  process.env.SUPABASE_STORAGE_BUCKET = "";
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { deleteProductPhotoForContext, uploadProductPhotoForContext } = await import("../src/lib/actions/product-photos");
  let seededData: Awaited<ReturnType<typeof seedBase>> | null = null;

  try {
    const data = await seedBase(prisma);
    seededData = data;
    const pngFile = makeFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), "image/png", "test.png");
    const jpegFile = makeFile(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]), "image/jpeg", "test.jpg");
    const webpFile = makeFile(
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      "image/webp",
      "test.webp",
    );
    const gifFile = makeFile(new Uint8Array([0x47, 0x49, 0x46, 0x38]), "image/gif", "test.gif");
    const oversizedFile = makeFile(new Uint8Array(2 * 1024 * 1024 + 1), "image/png", "too-large.png");

    await assert.rejects(() =>
      uploadProductPhotoForContext({
        context: data.context,
        productId: data.product.id,
        photo: oversizedFile,
        revalidate: false,
      }),
    );
    await assert.rejects(() =>
      uploadProductPhotoForContext({
        context: data.context,
        productId: data.product.id,
        photo: gifFile,
        revalidate: false,
      }),
    );

    const pngResult = await uploadProductPhotoForContext({
      context: data.context,
      productId: data.product.id,
      photo: pngFile,
      revalidate: false,
    });
    const productWithPng = await prisma.product.findUniqueOrThrow({
      where: {
        id: data.product.id,
      },
    });
    const pngPath = path.join(productPhotoLocalDirectory, pngResult.fileName);

    assert.equal(pngResult.fileName, `${data.product.id}.png`);
    assert.equal(productWithPng.photoFileName, pngResult.fileName);
    assert.equal(productWithPng.photoMimeType, "image/png");
    assert.notEqual(productWithPng.photoUpdatedAt, null);
    assert.equal(await fileExists(pngPath), true);

    const jpegResult = await uploadProductPhotoForContext({
      context: data.context,
      productId: data.product.id,
      photo: jpegFile,
      revalidate: false,
    });
    const productWithJpeg = await prisma.product.findUniqueOrThrow({
      where: {
        id: data.product.id,
      },
    });
    const jpegPath = path.join(productPhotoLocalDirectory, jpegResult.fileName);

    assert.equal(jpegResult.fileName, `${data.product.id}.jpg`);
    assert.equal(productWithJpeg.photoFileName, jpegResult.fileName);
    assert.equal(productWithJpeg.photoMimeType, "image/jpeg");
    assert.equal(await fileExists(pngPath), false);
    assert.equal(await fileExists(jpegPath), true);

    const webpResult = await uploadProductPhotoForContext({
      context: data.context,
      productId: data.product.id,
      photo: webpFile,
      revalidate: false,
    });
    const productWithWebp = await prisma.product.findUniqueOrThrow({
      where: {
        id: data.product.id,
      },
    });
    const webpPath = path.join(productPhotoLocalDirectory, webpResult.fileName);

    assert.equal(webpResult.fileName, `${data.product.id}.webp`);
    assert.equal(productWithWebp.photoFileName, webpResult.fileName);
    assert.equal(productWithWebp.photoMimeType, "image/webp");
    assert.equal(await fileExists(jpegPath), false);
    assert.equal(await fileExists(webpPath), true);

    await deleteProductPhotoForContext({
      context: data.context,
      productId: data.product.id,
      revalidate: false,
    });

    const productAfterDelete = await prisma.product.findUniqueOrThrow({
      where: {
        id: data.product.id,
      },
    });

    assert.equal(productAfterDelete.photoFileName, null);
    assert.equal(productAfterDelete.photoMimeType, null);
    assert.equal(productAfterDelete.photoUpdatedAt, null);
    assert.equal(await fileExists(webpPath), false);

    await assert.rejects(() =>
      uploadProductPhotoForContext({
        context: data.context,
        productId: data.otherClinicProduct.id,
        photo: pngFile,
        revalidate: false,
      }),
    );
  } finally {
    const productIds = [seededData?.product.id, seededData?.otherClinicProduct.id].filter(
      (productId): productId is string => typeof productId === "string",
    );

    for (const productId of productIds) {
      await Promise.all(
        Array.from(productPhotoAllowedMimeTypes.values()).map((extension) =>
          rm(path.join(productPhotoLocalDirectory, getProductPhotoFileName(productId, extension)), {
            force: true,
          }),
        ),
      );
    }
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
