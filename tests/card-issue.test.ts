// Isolated contract tests: no environment loading, database connection, or reset helper.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { cardIssueSchema, cardStockUnit, cardIssueBlockReason, filterStockOutCards, issueFromCard, type StockOutCard } from "../src/lib/stock/card-issue";
import { getCardStockRows } from "../src/lib/db/card-stock";
import { barcodeUiEnabled, isWorkflowLinkVisible, receivePath, stockOutPath } from "../src/lib/workflow-features";

const context = {clinicId: "test-clinic", organizationId: "test-org", userId: "test-user"};
const input = {stockItemId: "test-stock", quantity: 2, expectedQuantity: 10, expectedUpdatedAt: 1000,
  expectedUnit: "箱", unitConfirmed: "yes" as const, staffOperatorId: "test-staff"};
const card: StockOutCard = {stockItemId: "test-stock", productId: "test-product", name: "テスト ガーゼ",
  specification: "ＡＢＣ Ｍサイズ", category: "消耗品", orderUnit: "箱", quantity: 10, minStock: 5,
  stockUpdatedAt: 1000, stockUsageMode: "NONE", photoUpdatedAt: null, issueHint: "一箱"};

function fakeTransaction(options: {staffMissing?: boolean; stockMissing?: boolean; unit?: string | null;
  mode?: string; quantity?: number; timestamp?: number; concurrentChange?: boolean; historyFailure?: boolean} = {}) {
  const state = {quantity: options.quantity ?? 10, timestamp: options.timestamp ?? 1000, movements: [] as Record<string, unknown>[]};
  const calls: Record<string, any>[] = [];
  const tx = {
    staffOperator: {async findFirst(query: any) {
      calls.push({staff: query});
      assert.deepEqual(query.where, {id: input.staffOperatorId, organizationId: context.organizationId, isActive: true,
        clinicAssignments: {some: {clinicId: context.clinicId, clinic: {isActive: true}}}});
      return options.staffMissing ? null : {id: input.staffOperatorId};
    }},
    stockItem: {
      async findFirst(query: any) {
        calls.push({read: query});
        assert.deepEqual(query.where, {id: input.stockItemId, clinicId: context.clinicId, isUsed: true,
          product: {organizationId: context.organizationId, isActive: true}});
        return options.stockMissing ? null : {id: input.stockItemId, productId: card.productId, quantity: state.quantity,
          updatedAt: new Date(state.timestamp), product: {name: card.name, orderUnit: options.unit === undefined ? "箱" : options.unit,
            stockUsageMode: options.mode ?? "NONE"}};
      },
      async updateMany(query: any) {
        calls.push({update: query});
        assert.deepEqual(query.where, {id: input.stockItemId, clinicId: context.clinicId, isUsed: true,
          quantity: input.expectedQuantity, updatedAt: new Date(input.expectedUpdatedAt),
          product: {organizationId: context.organizationId, isActive: true, orderUnit: "箱", stockUsageMode: "NONE"}});
        if (options.concurrentChange || state.quantity !== query.where.quantity || state.timestamp !== query.where.updatedAt.getTime()) return {count: 0};
        state.quantity -= query.data.quantity.decrement;
        state.timestamp += 1;
        return {count: 1};
      },
    },
    stockMovement: {async create(query: any) {
      if (options.historyFailure) throw new Error("fictional history failure");
      state.movements.push(query.data);
      return query.data;
    }},
  } as unknown as Prisma.TransactionClient;
  return {state, calls, tx};
}

test("barcode UI is paused without deleting the legacy workflow", () => {
  assert.equal(barcodeUiEnabled, false);
  assert.equal(stockOutPath, "/stock-out");
  assert.equal(receivePath, "/orders?status=ORDERED");
  for (const path of ["/barcode", "/barcode/out", "/barcode/receive", "/quick", "/imports/medical-devices"]) assert.equal(isWorkflowLinkVisible(path), false);
  assert.equal(isWorkflowLinkVisible("/stock-out"), true);
});

test("search supports kana, full-width text, combined terms, and categories", () => {
  const cards = [card, {...card, productId: "other", name: "別の商品", category: null}];
  assert.equal(filterStockOutCards(cards, "がーぜ abc", null).length, 1);
  assert.equal(filterStockOutCards(cards, "がーぜ abc", "滅菌").length, 0);
  assert.equal(filterStockOutCards(cards, "", "未分類").length, 1);
  assert.equal(filterStockOutCards(cards, "不存在", null).length, 0);
});

test("all 420 scoped products are available, without favorites or a hidden query limit", async () => {
  const db = {stockItem: {async findMany(query: any) {
    assert.deepEqual(query.where, {clinicId: context.clinicId, isUsed: true, product: {organizationId: context.organizationId, isActive: true}});
    assert.equal(query.take, undefined);
    return Array.from({length: 420}, (_, index) => ({id: `stock-${index}`, productId: `product-${index}`,
      quantity: 10, minStock: index === 0 ? 0 : null, updatedAt: new Date(1000), product: {
        name: `架空商品${index}`, specification: null, category: "テスト", orderUnit: "箱", defaultMinStock: 5,
        stockUsageMode: "NONE", photoUpdatedAt: null, notes: "非公開の備考\n元表の出し方: 一箱\n別の備考"}}));
  }}} as unknown as Pick<PrismaClient, "stockItem">;
  const rows = await getCardStockRows(db, context);
  assert.equal(rows.length, 420);
  assert.equal(rows[0].minStock, 0);
  assert.equal(rows[1].minStock, 5);
  assert.equal(rows[0].issueHint, "一箱");
  assert.equal("notes" in rows[0], false);
  assert.equal(filterStockOutCards(rows, "架空商品419", null).length, 1);
});

test("ambiguous units, zero stock, and managed-use products cannot use card issue", () => {
  for (const unit of [null, "", "  ", "つ", "未設定", "不明", "？", "-"]) assert.equal(cardStockUnit(unit), null);
  assert.equal(cardStockUnit(" 箱 "), "箱");
  assert.equal(cardIssueBlockReason(card), null);
  assert.match(cardIssueBlockReason({...card, orderUnit: null})!, /単位/);
  assert.match(cardIssueBlockReason({...card, quantity: 0})!, /在庫/);
  assert.match(cardIssueBlockReason({...card, stockUsageMode: "OPEN_PACK"})!, /使用中/);
});

test("positive integer quantity, explicit unit confirmation, and staff are mandatory", () => {
  for (const quantity of [0, -1, 1.2, NaN, Infinity, 10000]) assert.equal(cardIssueSchema.safeParse({...input, quantity}).success, false);
  assert.equal(cardIssueSchema.safeParse({...input, unitConfirmed: undefined}).success, false);
  assert.equal(cardIssueSchema.safeParse({...input, staffOperatorId: " "}).success, false);
});

test("issue decrements the selected unit only and records staff and before/after values", async () => {
  const {tx, state} = fakeTransaction();
  const result = await issueFromCard(tx, context, input);
  assert.equal(state.quantity, 8);
  assert.equal(result.afterQuantity, 8);
  assert.deepEqual(state.movements[0], {clinicId: context.clinicId, productId: card.productId, movementType: "OUT",
    quantity: -2, beforeQuantity: 10, afterQuantity: 8, reason: "カード出庫: 2箱（在庫と同じ単位・換算なし）",
    sourceType: "QUICK_CARD", userId: context.userId, performedByStaffId: input.staffOperatorId});
  await assert.rejects(issueFromCard(tx, context, input), /変更/);
  assert.equal(state.movements.length, 1);
  assert.equal(state.quantity, 8);
});

test("overstock, stale snapshot, changed unit, invalid staff and out-of-scope stock fail before writes", async () => {
  const variants = [{staffMissing: true}, {stockMissing: true}, {unit: null}, {unit: "つ"},
    {unit: "本"}, {mode: "OPEN_PACK"}, {quantity: 9}, {timestamp: 1001}];
  for (const options of variants) {
    const fixture = fakeTransaction(options);
    await assert.rejects(issueFromCard(fixture.tx, context, input));
    assert.equal(fixture.calls.some(call => "update" in call), false);
    assert.equal(fixture.state.movements.length, 0);
  }
  const fixture = fakeTransaction();
  await assert.rejects(issueFromCard(fixture.tx, context, {...input, quantity: 11}), /多く出庫/);
  assert.equal(fixture.state.quantity, 10);
});

test("a concurrent change between read and update does not create an issue history", async () => {
  const {tx, state} = fakeTransaction({concurrentChange: true});
  await assert.rejects(issueFromCard(tx, context, input), /変更/);
  assert.equal(state.quantity, 10);
  assert.equal(state.movements.length, 0);
});

test("history failure propagates to the transaction owner (must not report success)", async () => {
  const fixture = fakeTransaction({historyFailure: true});
  // Simulated transaction owner checks propagation; this does not test PostgreSQL rollback itself.
  const before = structuredClone(fixture.state);
  await assert.rejects((async () => {
    try { await issueFromCard(fixture.tx, context, input); }
    catch (error) { Object.assign(fixture.state, before); throw error; }
  })(), /fictional history failure/);
  assert.equal(fixture.state.quantity, 10);
  assert.equal(fixture.state.movements.length, 0);
});
