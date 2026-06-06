# Codex 引き継ぎ: 一覧画面のパフォーマンス改善（DB側フィルタ＋ページネーション）

作成日: 2026-06-06
作成: Claude（計画・テスト担当）/ 実装: Codex
対象フェーズ: 通常業務の一覧画面の表示速度改善（フェーズ1 = MVP）

このドキュメントは AGENTS.md の「Before editing files, first explain」方針に沿って、
実装前の計画として書いています。Codex は着手前にこの内容を確認し、必要なら
`docs/spec.md` に正式仕様として取り込んでください。

---

## 1. ゴールの理解

`/products`・`/inventory`・`/shortage` の一覧表示を速くする。
現状はどの画面も「クリニックの全行をDBから取得 → JavaScript で `.filter()` → 全件をHTMLに描画」
という作りで、商品が増えるほど線形に重くなる。

ゴールは **表示の体感速度を改善する** こと。具体的には次の2点。

1. 検索語・カテゴリなどの絞り込みを **DBクエリ側** に寄せる。
2. **ページネーション**（例: 50件ずつ）を入れ、1回の取得・描画件数を一定に保つ。

挙動（表示される結果の中身）は今と変えない。あくまで「同じ結果を、速く」。

---

## 2. 現状のボトルネック（根拠つき）

- `src/app/(app)/products/page.tsx`
  - `getProductMasterRows(organizationId, clinicId)` で全商品を取得し、`rows.filter(...)` で
    検索語 `q` / カテゴリ / `source` / `setup` を **JS側** で絞り込んでいる（114行目前後）。
  - テーブルは `min-w-[1440px]` で全行描画（ページングなし）。
- `src/app/(app)/inventory/page.tsx`
  - `getStockRows(clinicId)` で全在庫行を取得し、`q` / カテゴリ / `shortage` を JS側で絞り込み。
- `src/app/(app)/shortage/page.tsx`
  - 同じく `getStockRows(clinicId)` 全件取得 → `isShortage` で JS絞り込み＋ソート。
- `src/lib/db/products.ts` の `getProductMasterRows`
  - 商品全件の取得に加えて、`getPendingOrdersByProduct` / `getProductAbcRanks` /
    `getRecommendedMinStocks` を **組織・クリニック全体ぶん** 毎回計算している（248〜305行目）。
    これは重い集計で、ページングしても「表示するページ分」に絞らない限り削減できない。
- `src/lib/db/stock.ts` の `getStockRows`
  - 在庫行を1クエリで全件取得し `toStockRow` でマップ。`isShortage` は
    `quantity < (stockItem.minStock ?? product.defaultMinStock)` を **JS側** で判定している。
    → 「不足のみ」をDB側で絞るには COALESCE が必要（後述）。

---

## 3. 前提・非対象（やらないこと）

- 認証・権限・Cookie・ログアウト処理は変更しない。
- DBの破壊的変更（既存データ削除、列削除）はしない。スキーマ追加が必要なら最小限・要相談。
- 表示される結果の中身・並び順・ラベルは変えない（速くするだけ）。
- 重い集計（ABCランク・推奨最低在庫）の **キャッシュ化はフェーズ2** に回す（11節）。
- 商品マスタの列順や見た目の変更は別タスク。ここでは扱わない。

---

## 4. フェーズ計画

### フェーズ1（このタスク / MVP）
一覧の **DB側フィルタ＋ページネーション** を、挙動を変えずに導入する。
新しいデータ取得関数を追加し、既存ページをそれに載せ替える。
受け入れテスト（red）は本タスクで用意済み（8節）。

### フェーズ2（別タスク・任意）
- ABCランク・推奨最低在庫の集計結果をキャッシュ（在庫変動時に再計算、または夜間バッチ）。
- `/shortage` の「不足のみ」をDB側で完全に絞る（COALESCEのraw SQL化）。
- 必要に応じてインデックス追加（`Product(name)`, `Product(organizationId, category)` 等は既存。
  実測してから判断）。

---

## 5. フェーズ1の実装契約（このシグネチャに合わせて実装する）

テスト（8節）はこの契約に対して書いてあります。**関数名・引数・返り値の形を必ず合わせてください。**
中の実装方法（raw SQL を使うか等）は自由ですが、**返す結果は既存関数と同値**であること。

### 5.1 在庫ページ用: `getStockPage`（`src/lib/db/stock.ts` に追加）

```ts
export type StockPageParams = {
  q?: string;
  category?: string;
  shortageOnly?: boolean;
  page?: number;      // 1始まり。未指定や1未満は1扱い
  pageSize?: number;  // 既定 50。1未満は既定にフォールバック
};

export type StockPageResult = {
  rows: StockRow[];   // 既存の StockRow をそのまま使う
  total: number;      // 絞り込み後の総件数（ページ前）
  page: number;       // 実際に返したページ番号
  pageSize: number;
  pageCount: number;  // Math.max(1, ceil(total / pageSize))
};

export async function getStockPage(
  clinicId: string,
  params: StockPageParams,
): Promise<StockPageResult>;
```

**同値の定義（必ず守る）**: `getStockPage(clinicId, params).rows` は、
`getStockRows(clinicId)` の結果に対して現行 `inventory/page.tsx` と同じ絞り込みを掛け、
同じ並び順のまま `page`/`pageSize` でスライスしたものと**一致**すること。
現行の絞り込みは:

```ts
const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
  .filter(Boolean).join(" ").toLowerCase();
const matchesQuery = q ? searchText.includes(q.toLowerCase()) : true;
const matchesCategory = category ? row.category === category : true;
const matchesShortage = shortageOnly ? row.isShortage : true;
```

実装ヒント:
- `q`（前方一致でなく部分一致）と `category`（完全一致）は Prisma の `where` に寄せられる。
  `q` は `OR` で `name/productCode/janCode/category/manufacturer` の `contains`（`mode: "insensitive"`）。
- ページングは `skip`/`take` ＋ `prisma.stockItem.count(...)`。
- `shortageOnly` は `isShortage = quantity < COALESCE(minStock, product.defaultMinStock)` で、
  Prisma の `where` だけでは表現しづらい。MVPでは次のどちらでもよい:
  - (推奨) `prisma.$queryRaw` で `quantity < COALESCE("minStock", p."defaultMinStock")` を含めて絞る。
  - (簡易) `q`/`category` でDB絞り込み後に `shortageOnly` だけJSで判定（件数が減っていれば実害小）。
  どちらでも **結果が同値** であればテストは通る。

### 5.2 商品マスタ用: `getProductMasterPage`（`src/lib/db/products.ts` に追加）

```ts
export type ProductMasterPageParams = {
  q?: string;
  category?: string;
  source?: string;   // "purchase-history" のとき購入履歴のみ
  setup?: string;    // "1" のとき初期設定が必要なものだけ
  page?: number;
  pageSize?: number; // 既定 50
};

export type ProductMasterPageResult = {
  rows: ProductMasterRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getProductMasterPage(
  organizationId: string,
  clinicId: string,
  params: ProductMasterPageParams,
): Promise<ProductMasterPageResult>;
```

**同値の定義**: `getProductMasterPage(...).rows` は、`getProductMasterRows(organizationId, clinicId)` に
現行 `products/page.tsx` と同じ `q`/`category`/`source`/`setup` 絞り込みを掛け、同じ並び順で
ページスライスしたものと一致すること。`source` 判定は
`isPurchaseHistoryImportSource(row.importSource)`、`setup` 判定は現行 `needsInitialSetup(row)`
（`!row.hasStockItem || !row.category || row.category === "未分類" || row.minStock === 0 || !row.location`）。

**性能上の肝（重要）**: 重い集計（`getPendingOrdersByProduct` / `getProductAbcRanks` /
`getRecommendedMinStocks`）を **表示ページの商品IDだけ** に絞って計算すること。
具体的には、まず絞り込み＋ページングで商品ページ（最大 `pageSize` 件）を確定し、
その `productIds` に対してのみ集計を行う。これら3関数が `productIds?` 引数を受けられないなら、
**小さなオーバーロード（productIds 指定時はその範囲だけ集計）** を追加してよい。
集計関数を変更する場合は、既存呼び出し（`getProductMasterRows` など）の挙動を壊さないこと。
（テストは集計の中身までは検証しないが、ここを絞らないと速度改善が出ない。）

---

## 6. ページ側の変更（Codex 実装）

- `inventory/page.tsx` / `shortage/page.tsx` / `products/page.tsx` の `searchParams` に
  `page`（任意, 既定1）と必要なら `pageSize` を追加で受ける。
- 各ページは `getStockRows`/`getProductMasterRows` の直接呼び出しをやめ、
  `getStockPage`/`getProductMasterPage` を呼ぶ。
- 件数表示（「表示 N 件 / 全 M 件」）は `total` を使う。
- 一覧の下（または上）に **前へ / 次へ** のページャを置く。リンクは既存の検索条件
  （`q`・`category`・`shortage`・`source`・`setup`）を維持したまま `page` だけ差し替える。
  - 既存のヘッダー/ナビには手を入れず、ページャは一覧セクション内に閉じる小さな追加にとどめる。
- `/shortage` は並び替え（在庫0優先→不足数）を維持すること。ページングはソート後に行う。

---

## 7. セキュリティ・正しさのチェック

- クリニック境界: 新関数も必ず `clinicId`（と `organizationId`）で絞る。
  `getStockPage` は `clinicId`、`getProductMasterPage` は `organizationId` ＋ `clinicId` 前提。
- 絞り込み意味の保持: `q` は大文字小文字を無視した部分一致。`category` は完全一致。
  既存と同じ結果になること（テストで担保）。
- ページ範囲外（`page > pageCount`）は **空配列** を返し、`total`/`pageCount` は正しい値を返す。
- `pageSize` に巨大値・負値が来ても安全に（上限を設ける。例: 1〜200にクランプ）。

---

## 8. 用意済みテスト（red）と実行方法

このタスク用に、契約に対する **失敗する（red）テスト** を追加済みです。実装後に green になります。

- `tests/stock-page.test.ts`
  - `getStockPage` が `getStockRows` ＋現行フィルタのオラクルと**同値**であることを検証
    （`q` / `category` / `shortageOnly`、`minStock` が null の在庫の不足判定、ページスライス、
    範囲外ページ、`total`/`pageCount`）。
- `tests/product-master-page.test.ts`
  - `getProductMasterPage` が `getProductMasterRows` ＋現行フィルタのオラクルと**同値**であることを検証
    （`q` / `category` / `source=purchase-history` / ページスライス / `total`・`pageCount`）。
  - 注: `setup="1"` の同値はテスト未収載。実装側では現行 `needsInitialSetup` と同じ判定を保つこと。

実行（ローカルの Postgres が必要。`docker compose up -d` で起動できる）:

```bash
corepack pnpm exec tsx tests/stock-page.test.ts
corepack pnpm exec tsx tests/product-master-page.test.ts
```

テストは `tests/helpers/db.ts` の `resetTestDatabase()` で専用スキーマを作り直してから走ります。
`.env` の `DATABASE_URL`（または環境変数）を読みます。秘密情報はコミットしないこと。

> 補足: 既存の安全修正（発注候補/納品確認のロック、スキャン履歴の管理者ガード）は実装済みで、
> `tests/order-receipt.test.ts` 等に並列テストがあります。本タスクはそれらに触れません。

---

## 9. 完了条件（Definition of Done）

1. `getStockPage` / `getProductMasterPage` を契約どおり実装。
2. 上記2テストが green。
3. `/inventory`・`/shortage`・`/products` が新関数経由になり、件数表示とページャが動く。
4. 既存テスト（`corepack pnpm exec tsx tests/*.test.ts`）が壊れていない。少なくとも
   `stock-status` / `order-receipt` / `dormant-stock` など在庫系は回す。
5. `tsc --noEmit`（`corepack pnpm typecheck`）が通る。
6. `docs/dev-log.md` に変更概要（What changed / Files / How to test / Risks / Next）を追記。

---

## 10. 触ってはいけない / 注意

- 認証・権限・Cookie・ログアウト処理。
- 既存の集計関数の **結果の意味** を変えること（productIds 絞り込みの追加は可、値の定義変更は不可）。
- 並び順・ラベル・色の変更。
- 大きなリファクタ。AGENTS.md の方針どおり「小さく・レビューしやすく」。

---

## 11. フェーズ2メモ（今はやらない、将来の効きどころ）

- ABCランク・推奨最低在庫の集計キャッシュ（在庫変動時に再計算 or 夜間バッチ）。
  詳細画面に「自動では更新されません」とある通り、常時リアルタイム性は低く、キャッシュ向き。
- `/shortage` の不足判定を完全DB側化（COALESCE の raw SQL）。
- 実測（重い画面の処理時間ログ、Prisma クエリログ）で N+1・全件取得を可視化してから
  追加インデックスを判断。
