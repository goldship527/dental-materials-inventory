import { promises as fs } from "node:fs";
import path from "node:path";

export type MedicalDeviceSampleRecord = {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  janCode: string;
  productName: string;
  productNameKana: string;
  manufacturer: string;
  packageUnit: string;
  jmdnCode: string;
  genericName: string;
  approvalNumber: string;
  productNumber: string;
  classCategory: string;
  note: string;
  isDuplicateJan: boolean;
};

export type MedicalDeviceSampleCache = {
  generatedAt: string;
  sourceFiles: string[];
  recordCount: number;
  records: MedicalDeviceSampleRecord[];
};

export type MedicalDeviceSampleCacheResult =
  | {
      status: "ok";
      cachePath: string;
      cache: MedicalDeviceSampleCache;
    }
  | {
      status: "missing";
      cachePath: string;
      cache: null;
    };

export type MedicalDeviceSampleFilters = {
  q?: string;
  sourceFile?: string;
  duplicateOnly?: boolean;
  limit?: number;
};

export function getMedicalDeviceSampleCachePath() {
  return path.join(process.cwd(), "data", "local", "medical-device-samples.json");
}

export async function readMedicalDeviceSampleCache(): Promise<MedicalDeviceSampleCacheResult> {
  const cachePath = getMedicalDeviceSampleCachePath();

  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    return {
      status: "ok",
      cachePath,
      cache: JSON.parse(raw) as MedicalDeviceSampleCache,
    };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;

    if (code === "ENOENT") {
      return {
        status: "missing",
        cachePath,
        cache: null,
      };
    }

    throw error;
  }
}

export function getMedicalDeviceSourceFiles(cache: MedicalDeviceSampleCache) {
  return Array.from(new Set(cache.records.map((record) => record.sourceFile))).sort((a, b) => a.localeCompare(b, "ja"));
}

export function filterMedicalDeviceSampleRecords(cache: MedicalDeviceSampleCache, filters: MedicalDeviceSampleFilters) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  const limit = filters.limit ?? 100;

  const filtered = cache.records.filter((record) => {
    if (filters.sourceFile && record.sourceFile !== filters.sourceFile) {
      return false;
    }

    if (filters.duplicateOnly && !record.isDuplicateJan) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      record.janCode,
      record.productName,
      record.productNameKana,
      record.manufacturer,
      record.genericName,
      record.jmdnCode,
      record.productNumber,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return {
    filtered,
    visible: filtered.slice(0, limit),
  };
}

export async function findMedicalDeviceSampleRecordsByJan(janCode: string, limit = 5) {
  if (!/^\d{13}$/.test(janCode)) {
    return [];
  }

  const cacheResult = await readMedicalDeviceSampleCache();

  if (cacheResult.status !== "ok") {
    return [];
  }

  return cacheResult.cache.records.filter((record) => record.janCode === janCode).slice(0, limit);
}

export async function findMedicalDeviceSampleRecord(input: { janCode: string; sourceFile: string; sourceRow: number }) {
  const records = await findMedicalDeviceSampleRecordsByJan(input.janCode, 50);

  return (
    records.find((record) => record.sourceFile === input.sourceFile && record.sourceRow === input.sourceRow) ??
    records[0] ??
    null
  );
}
