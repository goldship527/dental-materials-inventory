import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const productPhotoMaxSizeBytes = 2 * 1024 * 1024;
export const productPhotoLocalDirectory = path.join(process.cwd(), "data", "local", "uploads", "products");
export const productPhotoAllowedMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

type ProductPhotoStorageObject = {
  body: BodyInit;
};

function getBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || null;
}

function getStorageMode() {
  return getBucketName() ? "supabase" : "local";
}

function getSupabaseStorageClient() {
  const bucket = getBucketName();

  if (!bucket) {
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_STORAGE_BUCKETを設定する場合はSUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYも設定してください。");
  }

  return {
    bucket,
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    }),
  };
}

function toSafeObjectKey(fileName: string) {
  return fileName.split(/[\\/]/).pop() ?? fileName;
}

export function getProductPhotoExtension(mimeType: string) {
  return productPhotoAllowedMimeTypes.get(mimeType) ?? null;
}

export function getProductPhotoFileName(productId: string, extension: string) {
  return `${productId}.${extension}`;
}

function getProductPhotoVariantFileNames(productId: string) {
  return Array.from(productPhotoAllowedMimeTypes.values()).map((extension) => getProductPhotoFileName(productId, extension));
}

async function deleteLocalProductPhotoVariants(productId: string) {
  await Promise.all(
    getProductPhotoVariantFileNames(productId).map((fileName) =>
      rm(path.join(productPhotoLocalDirectory, fileName), {
        force: true,
      }),
    ),
  );
}

async function deleteSupabaseProductPhotoVariants(productId: string) {
  const storage = getSupabaseStorageClient();

  if (!storage) {
    return;
  }

  const { error } = await storage.client.storage.from(storage.bucket).remove(getProductPhotoVariantFileNames(productId));

  if (error) {
    throw new Error(`商品写真を削除できませんでした: ${error.message}`);
  }
}

export async function deleteProductPhotoObjects(productId: string) {
  if (getStorageMode() === "local") {
    await deleteLocalProductPhotoVariants(productId);
    return;
  }

  await deleteSupabaseProductPhotoVariants(productId);
}

export async function replaceProductPhotoObject(options: {
  productId: string;
  extension: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const fileName = getProductPhotoFileName(options.productId, options.extension);

  await deleteProductPhotoObjects(options.productId);

  if (getStorageMode() === "local") {
    await mkdir(productPhotoLocalDirectory, {
      recursive: true,
    });
    await writeFile(path.join(productPhotoLocalDirectory, fileName), options.bytes);
    return {
      fileName,
    };
  }

  const storage = getSupabaseStorageClient();

  if (!storage) {
    throw new Error("商品写真ストレージの設定を確認してください。");
  }

  const { error } = await storage.client.storage.from(storage.bucket).upload(fileName, options.bytes, {
    contentType: options.mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(`商品写真を保存できませんでした: ${error.message}`);
  }

  return {
    fileName,
  };
}

export async function getProductPhotoObject(fileName: string): Promise<ProductPhotoStorageObject | null> {
  const objectKey = toSafeObjectKey(fileName);

  if (getStorageMode() === "local") {
    try {
      const bytes = await readFile(path.join(productPhotoLocalDirectory, objectKey));

      return {
        body: new Uint8Array(bytes),
      };
    } catch {
      return null;
    }
  }

  const storage = getSupabaseStorageClient();

  if (!storage) {
    throw new Error("商品写真ストレージの設定を確認してください。");
  }

  const { data, error } = await storage.client.storage.from(storage.bucket).download(objectKey);

  if (error) {
    if (error.message.toLowerCase().includes("not found")) {
      return null;
    }

    throw new Error(`商品写真を取得できませんでした: ${error.message}`);
  }

  return {
    body: data.stream(),
  };
}
