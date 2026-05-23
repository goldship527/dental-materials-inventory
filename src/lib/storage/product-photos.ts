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

type ProductPhotoStorageEnv = Record<string, string | undefined>;

type DiagnosticStatus = "ok" | "warning" | "error";

export type ProductPhotoStorageDiagnosticItem = {
  label: string;
  status: DiagnosticStatus;
  message: string;
};

export type ProductPhotoStorageDiagnostics = {
  mode: "local" | "supabase";
  runtime: "vercel" | "local";
  items: ProductPhotoStorageDiagnosticItem[];
};

function getEnvValue(env: ProductPhotoStorageEnv, key: keyof ProductPhotoStorageEnv) {
  return env[key]?.trim() || null;
}

function getBucketName(env: ProductPhotoStorageEnv = process.env) {
  return getEnvValue(env, "SUPABASE_STORAGE_BUCKET");
}

function isVercelRuntime(env: ProductPhotoStorageEnv = process.env) {
  return getEnvValue(env, "VERCEL") === "1";
}

function validateSupabaseUrl(supabaseUrl: string | null): ProductPhotoStorageDiagnosticItem {
  if (!supabaseUrl) {
    return {
      label: "SUPABASE_URL",
      status: "error",
      message: "未設定です。SupabaseのProject URLを設定してください。",
    };
  }

  if (supabaseUrl.startsWith("postgresql://") || supabaseUrl.startsWith("postgres://")) {
    return {
      label: "SUPABASE_URL",
      status: "error",
      message: "Database URLではなく、https://...supabase.co 形式のProject URLを設定してください。",
    };
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const hasStoragePath = parsedUrl.pathname !== "/" && parsedUrl.pathname !== "";

    if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co") || hasStoragePath) {
      return {
        label: "SUPABASE_URL",
        status: "error",
        message: "https://...supabase.co 形式で設定してください。/storage/v1 などのパスは付けません。",
      };
    }
  } catch {
    return {
      label: "SUPABASE_URL",
      status: "error",
      message: "URLとして読み取れません。https://...supabase.co 形式で設定してください。",
    };
  }

  return {
    label: "SUPABASE_URL",
    status: "ok",
    message: "設定されています。形式も問題ありません。",
  };
}

function validateServiceRoleKey(serviceRoleKey: string | null): ProductPhotoStorageDiagnosticItem {
  if (!serviceRoleKey) {
    return {
      label: "SUPABASE_SERVICE_ROLE_KEY",
      status: "error",
      message: "未設定です。Supabaseのservice_role secret keyを設定してください。",
    };
  }

  return {
    label: "SUPABASE_SERVICE_ROLE_KEY",
    status: "ok",
    message: "設定されています。値そのものは安全のため表示しません。",
  };
}

function validateBucketName(bucket: string | null, env: ProductPhotoStorageEnv = process.env): ProductPhotoStorageDiagnosticItem {
  if (!bucket) {
    return {
      label: "SUPABASE_STORAGE_BUCKET",
      status: isVercelRuntime(env) ? "error" : "warning",
      message: isVercelRuntime(env)
        ? "Vercel公開環境では必須です。Supabase Storageのbucket名だけを設定してください。"
        : "未設定です。ローカル開発ではローカル保存に切り替わります。",
    };
  }

  if (
    bucket.startsWith("http://") ||
    bucket.startsWith("https://") ||
    bucket.includes("/") ||
    bucket.includes("\\") ||
    bucket.includes('"') ||
    bucket.includes("'") ||
    /\s/.test(bucket)
  ) {
    return {
      label: "SUPABASE_STORAGE_BUCKET",
      status: "error",
      message: "bucket名だけを設定してください。URL、引用符、スラッシュ、空白は入れません。",
    };
  }

  return {
    label: "SUPABASE_STORAGE_BUCKET",
    status: "ok",
    message: "設定されています。bucket名として使える形です。",
  };
}

function getStorageMode() {
  if (!getBucketName() && isVercelRuntime()) {
    throw new Error("商品写真ストレージが未設定です。管理者にVercel環境変数 SUPABASE_STORAGE_BUCKET の設定を確認してください。");
  }

  return getBucketName() ? "supabase" : "local";
}

function getSupabaseStorageClient() {
  const bucket = getBucketName();

  if (!bucket) {
    return null;
  }

  const supabaseUrl = getEnvValue(process.env, "SUPABASE_URL");
  const serviceRoleKey = getEnvValue(process.env, "SUPABASE_SERVICE_ROLE_KEY");
  const bucketValidation = validateBucketName(bucket);

  if (bucketValidation.status === "error") {
    throw new Error(bucketValidation.message);
  }

  const urlValidation = validateSupabaseUrl(supabaseUrl);
  const keyValidation = validateServiceRoleKey(serviceRoleKey);

  if (urlValidation.status === "error") {
    throw new Error(urlValidation.message);
  }

  if (keyValidation.status === "error") {
    throw new Error(keyValidation.message);
  }

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

export async function getProductPhotoStorageDiagnostics(options?: {
  checkBucketConnection?: boolean;
  env?: ProductPhotoStorageEnv;
}): Promise<ProductPhotoStorageDiagnostics> {
  const env = options?.env ?? process.env;
  const checkBucketConnection = options?.checkBucketConnection ?? true;
  const bucket = getBucketName(env);
  const supabaseUrl = getEnvValue(env, "SUPABASE_URL");
  const serviceRoleKey = getEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  const runtime = isVercelRuntime(env) ? "vercel" : "local";
  const urlDiagnostic = validateSupabaseUrl(supabaseUrl);
  const keyDiagnostic = validateServiceRoleKey(serviceRoleKey);
  const bucketDiagnostic = validateBucketName(bucket, env);
  const items = [
    {
      label: "実行環境",
      status: runtime === "vercel" ? "ok" : "warning",
      message: runtime === "vercel" ? "Vercel上で動いています。" : "ローカル環境として動いています。",
    } satisfies ProductPhotoStorageDiagnosticItem,
    urlDiagnostic,
    keyDiagnostic,
    bucketDiagnostic,
  ];

  if (!bucket) {
    items.push({
      label: "Storage bucket接続",
      status: runtime === "vercel" ? "error" : "warning",
      message: runtime === "vercel" ? "bucket名が未設定のため確認できません。" : "ローカル保存を使うため確認を省略しました。",
    });

    return {
      mode: "local",
      runtime,
      items,
    };
  }

  if (urlDiagnostic.status === "error" || keyDiagnostic.status === "error" || bucketDiagnostic.status === "error") {
    items.push({
      label: "Storage bucket接続",
      status: "error",
      message: "環境変数の形式に問題があるため、接続確認を実行していません。",
    });

    return {
      mode: "supabase",
      runtime,
      items,
    };
  }

  if (!checkBucketConnection || !supabaseUrl || !serviceRoleKey) {
    items.push({
      label: "Storage bucket接続",
      status: "warning",
      message: "接続確認は省略しました。",
    });

    return {
      mode: "supabase",
      runtime,
      items,
    };
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
  const { data, error } = await client.storage.getBucket(bucket);

  if (error) {
    items.push({
      label: "Storage bucket接続",
      status: "error",
      message: `bucketを確認できませんでした: ${error.message}`,
    });
  } else {
    items.push({
      label: "Storage bucket接続",
      status: "ok",
      message: data.public ? "bucketを確認できました。公開bucketとして設定されています。" : "bucketを確認できました。private bucketです。",
    });
  }

  return {
    mode: "supabase",
    runtime,
    items,
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
