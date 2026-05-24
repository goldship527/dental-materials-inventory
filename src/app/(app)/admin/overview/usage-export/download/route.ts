import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import {
  getAdminUsageExportRows,
  parseAdminUsageExportDateRange,
} from "@/lib/db/admin-usage-export";
import { prisma } from "@/lib/db/prisma";
import { buildAdminUsageExportCsv } from "@/lib/exports/admin-usage-export-csv";

function getTimestampForFileName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}`;
}

async function getAdminContextForRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: new Response("Unauthorized", { status: 401 }),
      context: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive || !isAdminRole(user.role)) {
    return {
      error: new Response("Forbidden", { status: 403 }),
      context: null,
    };
  }

  return {
    error: null,
    context: {
      userId: user.id,
      organizationId: user.organizationId,
    },
  };
}

export async function GET(request: Request) {
  const admin = await getAdminContextForRoute();

  if (!admin.context) {
    return admin.error;
  }

  const searchParams = new URL(request.url).searchParams;
  let dateRange;

  try {
    dateRange = parseAdminUsageExportDateRange({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "日付条件を確認してください。", {
      status: 400,
    });
  }

  try {
    const rows = await getAdminUsageExportRows({
      organizationId: admin.context.organizationId,
      dateRange,
    });
    const csv = buildAdminUsageExportCsv({
      rows,
      dateRange,
    });
    const fileName = `admin-usage-${dateRange.startDateText}-${dateRange.endDateText}-${getTimestampForFileName(
      new Date(),
    )}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Usage-Export-Start": dateRange.startDateText,
        "X-Usage-Export-End": dateRange.endDateText,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "CSV出力に失敗しました。", {
      status: 400,
    });
  }
}
