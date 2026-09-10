export type ReceiptCard = {
  id: string; productId: string; photoUpdatedAt: number | null;
  name: string; category: string | null; supplierName: string | null;
  requestedQuantity: number; orderUnit: string | null; orderedAt: string | null;
};
const dayFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
export function groupReceiptsByOrderDate(rows: ReceiptCard[]) {
  const groups = new Map<string, ReceiptCard[]>();
  for (const row of rows) {
    const day = row.orderedAt ? dayFormatter.format(new Date(row.orderedAt)) : "日付未登録";
    groups.set(day, [...(groups.get(day) ?? []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
