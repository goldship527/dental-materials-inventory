import { prisma } from "@/lib/db/prisma";

export type AuditLogRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detailsJson: unknown;
  actorUserName: string | null;
  createdAt: Date;
};

export async function getRecentAuditLogs(organizationId: string, take = 100): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
    },
    include: {
      actorUser: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    detailsJson: row.detailsJson,
    actorUserName: row.actorUser?.name ?? null,
    createdAt: row.createdAt,
  }));
}
