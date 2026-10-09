import { writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrderRequestTableRow } from "../../src/app/(app)/orders/order-request-row";
import type { OrderRequestRow } from "../../src/lib/db/orders";

const now = new Date("2026-10-09T09:00:00+09:00");
const statuses = ["SUGGESTED", "SUGGESTED", "CONFIRMED", "CONFIRMED", "ORDERED", "ORDERED", "ORDERED", "ORDERED", "SKIPPED"] as const;
const rows: OrderRequestRow[] = statuses.map((status, index) => ({
  id: `fixture-${index}`,
  productId: `product-${index}`,
  photoUpdatedAt: null,
  productCode: `P-${String(index + 1).padStart(3, "0")}`,
  name: `架空の商品 ${index + 1}`,
  category: "消耗品",
  supplierId: index < 5 ? "supplier-a" : "supplier-b",
  orderRecordId: status === "ORDERED" ? `record-${index}` : null,
  supplierName: index < 5 ? "架空発注先A" : "架空発注先B",
  supplierAddress: null,
  supplierPhone: null,
  supplierFax: null,
  supplierEmail: null,
  supplierContactPersonName: null,
  supplierContactPersonEmail: null,
  supplierProductCode: `S-${index + 1}`,
  orderUnit: "個",
  standardPrice: null,
  supplierOptions: [
    { supplierId: "supplier-a", supplierName: "架空発注先A", supplierProductCode: null, orderUnit: "個", standardPrice: null, isPrimary: true, isActive: true },
    { supplierId: "supplier-b", supplierName: "架空発注先B", supplierProductCode: null, orderUnit: "個", standardPrice: null, isPrimary: false, isActive: true },
  ],
  quantity: 2,
  minStock: 10,
  shortageCount: 8,
  pendingOrderedQuantity: 0,
  plannedQuantity: 0,
  requestedQuantity: 8,
  status,
  memo: index === 4 ? "架空の納期確認メモ" : null,
  orderedAt: status === "ORDERED" ? now : null,
  orderedMethod: status === "ORDERED" ? "FAX" : null,
  orderedMemo: index === 4 ? "架空の送付メモ" : null,
  supplierResponseMemo: null,
  orderedByStaffName: status === "ORDERED" ? "架空スタッフ" : null,
  receivedQuantity: index === 6 || index === 7 ? 8 : null,
  receivedAt: index === 6 || index === 7 ? now : null,
  receivedMemo: null,
  receivedLotNumber: null,
  receivedExpiryDateText: null,
  receivedExpiryDate: null,
  receivedByUserName: null,
  receivedByStaffName: null,
  updatedAt: now,
}));

const stylesheet = readdirSync(resolve(".next/static/chunks")).find((name) => name.endsWith(".css"));
if (!stylesheet) throw new Error("Run pnpm build first");
const cssUrl = `/.next/static/chunks/${stylesheet}`;
const labels = ["すべて", "確認待ち", "発注予定", "納品待ち", "納品済み", "見送り"];
const counts = [9, 2, 2, 2, 2, 1];
const filters = labels.map((label, index) => `<a href="#" class="inline-flex min-h-10 items-center rounded border px-4 py-2 text-sm font-semibold ${index === 0 ? "chip-selected border-accent" : "border-lineStrong bg-panel text-ink"}">${label} <span class="ml-1 tabular-nums ${index === 1 || index === 3 ? "rounded-sm bg-mark px-1 text-ink" : ""}">${counts[index]}</span></a>`).join("");
const table = (subset: OrderRequestRow[], groupIndex: number) => `<div class="overflow-x-auto"><table class="order-rows w-full border-collapse text-left text-sm print:text-xs"><colgroup class="print:hidden"><col style="width:20%"><col style="width:16%"><col style="width:20%"><col style="width:20%"><col style="width:24%"></colgroup><thead class="bg-tint text-label text-accent print:bg-panel print:text-label print:text-ink"><tr>${["商品", "在庫状況", "発注先", "発注量", "記録・操作"].map((value, index) => `<th class="border-b border-accent px-4 py-3 ${index === 4 ? "print:hidden" : "print:border print:border-ink print:px-2 print:py-1.5"}">${value}</th>`).join("")}${["状態", "備考", "確認"].map((value) => `<th class="hidden border border-ink px-2 py-1.5 print:table-cell">${value}</th>`).join("")}</tr></thead><tbody data-fixture-group="${groupIndex}">${subset.map((row) => renderToString(<OrderRequestTableRow clinicId="fixture" row={row} staffOperators={[]} />)).join("")}</tbody></table></div>`;
const groups = [rows.slice(0, 5), rows.slice(5)];
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${cssUrl}"><title>発注画面の架空データ計測</title></head><body><main class="mx-auto w-full max-w-7xl px-6 pt-3 pb-6 max-sm:px-3"><div class="mx-auto flex w-full max-w-7xl flex-col gap-4 print:max-w-none print:gap-3"><header class="border-b border-line pb-3"><h1 class="text-xl font-bold">発注</h1><p class="mt-2 text-sm text-muted">発行日時: 2026/10/09 09:00</p><div class="flex gap-2"><a class="min-h-10 rounded btn-secondary px-3 py-2" href="#">不足一覧へ</a><a class="min-h-10 rounded btn-secondary px-3 py-2" href="#">発注書下書き</a><a class="min-h-10 rounded btn-secondary px-3 py-2" href="#">発注記録</a></div></header><section class="hidden grid-cols-4 gap-2 text-xs print:grid"><div>印刷対象: 9 件</div><div>検索後: 9 件</div><div>発注予定: 2 件</div><div>納品待ち: 2 件</div></section><section class="hidden border border-ink px-2 py-1.5 text-xs print:block">出力条件: すべて</section><form class="flex items-center gap-2 rounded border border-line/90 bg-panel/95 p-3 shadow-sheet print:hidden"><input type="search" placeholder="商品名・商品コード・カテゴリ・発注先・メモ" class="h-10 min-w-0 flex-1 rounded border border-line bg-panel/90 px-3 text-sm"><button class="h-10 rounded btn-primary px-4 text-sm font-semibold" type="submit">検索</button><a class="inline-flex min-h-10 shrink-0 items-center px-2 text-sm font-semibold text-accent underline" href="#">クリア</a></form><section class="flex flex-wrap gap-2 print:hidden">${filters}</section><section class="hidden grid-cols-2 gap-3 text-xs print:grid"><div>発注前確認</div><div>印刷備考</div></section><section class="flex flex-col gap-3"><div class="rounded border border-line/90 bg-panel/95 px-4 py-2 text-sm text-muted shadow-sheet">表示 9 件 / 検索後 9 件 / 全 9 件</div>${groups.map((group, index) => `<section><h2 class="supplier-heading border-b border-line p-3 text-lg font-bold">架空発注先${index ? "B" : "A"}</h2>${table(group, index)}</section>`).join("")}</section></div></main><script id="fixture-data" type="application/json">${JSON.stringify(rows)}</script><script src="/output/playwright/orders-responsive-client.js"></script></body></html>`;
writeFileSync(resolve("output/playwright/orders-responsive-fixture.html"), html);
console.log("Fixture written");
