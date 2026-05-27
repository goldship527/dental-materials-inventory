import { prisma } from "@/lib/db/prisma";

export const defaultAnomalyOutThreshold = 3.0;
export const minAnomalyOutThreshold = 1.5;
export const maxAnomalyOutThreshold = 10.0;

export type OrganizationSettings = {
  organizationId: string;
  anomalyOutThreshold: number;
};

export function clampAnomalyOutThreshold(value: number) {
  return Math.min(maxAnomalyOutThreshold, Math.max(minAnomalyOutThreshold, value));
}

export function parseAnomalyOutThreshold(value: unknown) {
  const threshold = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(threshold)) {
    throw new Error("閾値は数値で入力してください。");
  }

  if (threshold < minAnomalyOutThreshold || threshold > maxAnomalyOutThreshold) {
    throw new Error(`閾値は${minAnomalyOutThreshold}から${maxAnomalyOutThreshold}の範囲で入力してください。`);
  }

  return threshold;
}

export async function getOrganizationSettings(organizationId: string): Promise<OrganizationSettings> {
  const setting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId,
    },
    select: {
      organizationId: true,
      anomalyOutThreshold: true,
    },
  });

  return {
    organizationId,
    anomalyOutThreshold: setting?.anomalyOutThreshold ?? defaultAnomalyOutThreshold,
  };
}
