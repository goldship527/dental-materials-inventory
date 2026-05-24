import {
  getStockMovementSourceLabel,
  getStockMovementTypeLabel,
  type StockMovementRow,
} from "@/lib/db/stock-movements";

const csvDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const csvDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDateTime(date: Date) {
  return csvDateTimeFormatter.format(date);
}

function formatDate(date: Date | null, fallback: string | null) {
  if (date) {
    return csvDateFormatter.format(date);
  }

  return fallback ?? "";
}

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number | null | undefined, options?: { trustedNumber?: boolean }) {
  const rawValue = value == null ? "" : String(value);
  const safeValue = options?.trustedNumber ? rawValue : protectSpreadsheetFormula(rawValue);

  return `"${safeValue.replaceAll('"', '""')}"`;
}

function getSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

export function buildStockMovementsCsv(rows: StockMovementRow[]) {
  const headers = [
    "日時",
    "商品名",
    "商品コード",
    "カテゴリ",
    "区分",
    "増減数",
    "変更前数量",
    "変更後数量",
    "操作元",
    "理由メモ",
    "操作者",
    "実作業者",
    "ロット番号",
    "有効期限",
  ];
  const lines = [
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...rows.map((row) =>
      [
        formatDateTime(row.createdAt),
        row.productName,
        row.productCode,
        row.category,
        getStockMovementTypeLabel(row.movementType),
        getSignedQuantity(row.quantity),
        row.beforeQuantity,
        row.afterQuantity,
        getStockMovementSourceLabel(row.sourceType),
        row.reason,
        row.userName,
        row.performedByStaffName,
        row.lotNumber,
        formatDate(row.expiryDate, row.expiryDateText),
      ]
        .map((value, index) => escapeCsvCell(value, { trustedNumber: index === 5 || index === 6 || index === 7 }))
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
