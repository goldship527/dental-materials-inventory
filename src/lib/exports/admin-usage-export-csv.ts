import type { AdminUsageExportDateRange, AdminUsageExportRow } from "@/lib/db/admin-usage-export";

const csvDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number | null | undefined, options?: { trustedNumber?: boolean }) {
  const rawValue = value == null ? "" : String(value);
  const safeValue = options?.trustedNumber ? rawValue : protectSpreadsheetFormula(rawValue);

  return `"${safeValue.replaceAll('"', '""')}"`;
}

function formatDateTime(date: Date | null) {
  return date ? csvDateTimeFormatter.format(date) : "";
}

export function buildAdminUsageExportCsv(options: {
  rows: AdminUsageExportRow[];
  dateRange: Pick<AdminUsageExportDateRange, "startDateText" | "endDateText">;
}) {
  const headers = [
    "集計区分",
    "対象期間開始",
    "対象期間終了",
    "クリニック名",
    "商品名",
    "商品コード",
    "JAN",
    "カテゴリ",
    "メーカー",
    "出庫数合計",
    "出庫回数",
    "最終出庫日時",
  ];
  const lines = [
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...options.rows.map((row) =>
      [
        row.scopeLabel,
        options.dateRange.startDateText,
        options.dateRange.endDateText,
        row.clinicName,
        row.productName,
        row.productCode,
        row.janCode,
        row.category,
        row.manufacturer,
        row.totalOutQuantity,
        row.movementCount,
        formatDateTime(row.lastOutAt),
      ]
        .map((value, index) => escapeCsvCell(value, { trustedNumber: index === 9 || index === 10 }))
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
