import { auth } from "@/auth";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStockMovementRows, normalizeStockMovementFilters } from "@/lib/db/stock-movements";
import { buildStockMovementsCsv } from "@/lib/exports/stock-movements-csv";

const exportLimit = 5000;

function getTimestampForFileName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}`;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const context = await requireActiveClinic({ sessionUser: session.user });
  const searchParams = new URL(request.url).searchParams;
  const filters = normalizeStockMovementFilters({
    query: searchParams.get("q") ?? "",
    movementType: searchParams.get("type") ?? "",
    sourceType: searchParams.get("source") ?? "",
    sourceId: searchParams.get("sourceId") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
  });
  const rows = await getStockMovementRows(context.clinicId, filters, exportLimit);
  const csv = buildStockMovementsCsv(rows);
  const fileName = `stock-movements-${getTimestampForFileName(new Date())}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Export-Limit": String(exportLimit),
    },
  });
}
