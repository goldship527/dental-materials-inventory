import { prisma } from "@/lib/db/prisma";

type AuditDetails = Record<string, string | number | boolean | null | undefined>;

export const auditActions = {
  adminUserCreate: "ADMIN_USER_CREATE",
  adminUserDeactivate: "ADMIN_USER_DEACTIVATE",
  adminUserPasswordReset: "ADMIN_USER_PASSWORD_RESET",
  staffOperatorCreate: "STAFF_OPERATOR_CREATE",
  staffOperatorUpdate: "STAFF_OPERATOR_UPDATE",
  staffOperatorDeactivate: "STAFF_OPERATOR_DEACTIVATE",
  productCreate: "PRODUCT_CREATE",
  productUpdate: "PRODUCT_UPDATE",
  productImport: "PRODUCT_IMPORT",
  supplierCreate: "SUPPLIER_CREATE",
  supplierUpdate: "SUPPLIER_UPDATE",
  supplierImport: "SUPPLIER_IMPORT",
  stockMovementRevert: "STOCK_MOVEMENT_REVERT",
  stocktakeSessionDiscard: "STOCKTAKE_SESSION_DISCARD",
  stocktakeSessionCommit: "STOCKTAKE_SESSION_COMMIT",
} as const;

export async function writeAuditLog(options: {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: AuditDetails;
}) {
  const details = options.details
    ? Object.fromEntries(Object.entries(options.details).filter(([, value]) => value !== undefined))
    : undefined;

  await prisma.auditLog.create({
    data: {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId ?? null,
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetId ?? null,
      detailsJson: details,
    },
  });
}
