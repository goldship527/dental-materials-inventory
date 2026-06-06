# Codex 引き継ぎ: 一覧パフォーマンス改善 フェーズ1 の修正（レビュー指摘 3件）

作成日: 2026-06-06
作成: Claude（計画・テスト担当）/ 実装: Codex
前提: `docs/codex-handoff-list-performance.md` のフェーズ1は実装済み。本書はその静的レビューで出た
不具合3件の修正指示。AGENTS.md の方針どおり「小さく・レビューしやすく」。着手前にこの内容を確認し、
必要なら `docs/spec.md` に反映してください。

優先度: 1（高）→ 2（中）→ 3（中）。1件ずつ別コミットでよい。

---

## 修正1【高】/shortage の印刷が現在ページ（最大50件）しか出ない回帰

### 問題
`src/app/(app)/shortage/page.tsx` のテーブル `<tbody>`（217行目付近）が `pagedShortageRows`
（スライス後）を描画している。ページャは `print:hidden`（161行目付近）だが、テーブル本体が
ページングされているため、**印刷すると現在ページの50件だけ**になる。
不足在庫一覧は「発注用に全件を印刷する」のが主目的（`print:` スタイル一式・確認欄・PrintButton）
なので、これは機能低下。

### 直し方（推奨: 画面はページング、印刷は全件）
1. 行 `<tr>...</tr>` の描画を、ページ内ローカル関数に切り出す。例:
   `function renderShortageRow(row: StockRow) { return ( <tr key={row.stockItemId} ...>...</tr> ); }`
   （現在の `pagedShortageRows.map((row) => { ... return (<tr>...) })` の中身をそのまま移植。
   `pendingOrders` の算出も関数内に入れる。`ShortageOrderButton` 等の参照はそのまま。）
2. `<tbody>` を2つに分ける。
   - 画面用: `<tbody className="print:hidden">` に `pagedShortageRows.map(renderShortageRow)`。
     空表示（`pagedShortageRows.length === 0` のときの `emptyMessage` 行）は従来どおりこちらに残す。
   - 印刷用: `<tbody className="hidden print:table-row-group">` に
     `filteredShortageRows.map(renderShortageRow)`。
     `filteredShortageRows.length === 0` のときだけ印刷用にも `emptyMessage` 行を出す。
3. 件数表示（156-160行）は画面はそのままでよいが、印刷時に誤解を避けるため、
   `print:` で「不足 {shortageTotal} 件」を主に見せる形が望ましい（必須ではない）。
   少なくとも「表示 {pagedShortageRows.length} 件」が印刷の全件出力と矛盾して見えないように、
   印刷用スパンで `不足 {shortageTotal} 件` を出すなど軽く調整する。

### 代替案（より単純: /shortage はページングしない）
/shortage は元々 `getStockRows` 全件取得で、印刷用シートが主目的。ページングの実利が小さいなら、
**/shortage だけページャを外して全件表示に戻す**のも可（`page`/スライス/ページャ周りを削除）。
画面が長くなる点を許容できるなら、こちらの方が変更は小さい。チームの好みで選択。
（推奨は上の「2-tbody」。画面の長さも抑えつつ印刷も全件にできるため。）

### 受け入れ条件
- 不足が `pageSize`（50）を超える状態で印刷プレビューすると、**全件**が出力される。
- 画面表示は従来どおりページングされ、ページャで移動できる。
- 既存の `print:` 体裁（罫線・確認欄・break-inside-avoid）が崩れない。

### 検証
- 開発環境で不足を51件以上に増やし、`/shortage` の印刷プレビュー（ブラウザ）で全件出ることを目視。
- `corepack pnpm exec tsx tests/ui-smoke.test.ts` が通ること（描画クラッシュの確認）。

### 触らない
- 並び順（在庫0優先→不足数→名前）、`print:` の体裁、`ShortageOrderButton`、認証・権限。

---

## 修正2【中】ページネーションの安定タイブレーカが無い（行のスキップ/重複の可能性）

### 問題
orderBy が `(category, name)` のみで一意キーが無い。同一カテゴリ・同一商品名が複数あると、
`count` と `findMany`、およびページ間で順序が非決定的になり、ページ跨ぎで行が抜ける/重複し得る
（Postgres はタイ時の順序を保証しない）。

対象:
- `src/lib/db/stock.ts`
  - `getStockPage` の `orderBy`（186-197行付近）
  - `getStockRows` の `orderBy`（147-158行付近）
- `src/lib/db/products.ts`
  - `getProductMasterPage` の `orderBy`（616-623行付近）
  - `getProductMasterRows` の `orderBy`（532-539行付近）

### 直し方
各 `orderBy` 配列の**末尾**に一意キーを追加する。
- 在庫（StockItem ベース）: 末尾に `{ id: "asc" }`（= StockItem.id）。
- 商品（Product ベース）: 末尾に `{ id: "asc" }`（= Product.id）。

例（getStockPage / getStockRows）:
```ts
orderBy: [
  { product: { category: "asc" } },
  { product: { name: "asc" } },
  { id: "asc" }, // ← 追加（安定化）
]
```
例（getProductMasterPage / getProductMasterRows）:
```ts
orderBy: [
  { category: "asc" },
  { name: "asc" },
  { id: "asc" }, // ← 追加（安定化）
]
```

### 重要: ページ関数とベース関数の両方を必ず合わせる
既存テスト（`tests/stock-page.test.ts` / `tests/product-master-page.test.ts`）は
`getStockPage` と `getStockRows`（および商品側）を**同じ並び順**である前提で同値比較している。
4箇所すべてに同じタイブレーカを入れること。片方だけだとテストが割れる。

### 受け入れ条件 / 検証
- 既存2テストが引き続き green。
- 追加テスト `tests/list-pagination-stability.test.ts`（本書と一緒に用意）が green。
  - 同名・同カテゴリの行を複数用意し、`pageSize=1` で全ページを連結すると、
    全行が**重複なく欠落なく**1回ずつ現れることを検証する。
  - 実行: `corepack pnpm exec tsx tests/list-pagination-stability.test.ts`

### 触らない
- 並び順の意味（カテゴリ→名前）。タイブレーカは最後に足すだけ。

---

## 修正3【中】範囲外ページの表示が不自然（「999 / 3」＋空テーブル）

### 問題
`getStockPage` / `getProductMasterPage` は要求 `page` を上限クランプせずに返す
（`normalizePageInput` 等は下限1のみ）。3ページしか無いのに `?page=999` で「999 / 3」と表示され、
表は空、「前へ」は998へ飛ぶ。`/inventory`・`/products`・`/shortage` 共通。

### 重要: データ層の挙動は変えない
`getStockPage` / `getProductMasterPage` の「範囲外ページは空配列を返す（total/pageCount は維持）」
という挙動は既存テストで固定されている。**データ層はそのまま**にし、画面側（page.tsx）で対処する。

### 直し方（画面側でリダイレクト）
各ページコンポーネントで、取得結果の `pageCount` を見て、要求ページが範囲外なら最終ページへ
`redirect` する。`redirect` は3ファイルとも既に import 済み。`build*PageHref` で検索条件を維持する。

- `src/app/(app)/inventory/page.tsx`（`getStockPage` 取得直後）:
```ts
if (page > stockPage.pageCount) {
  redirect(buildInventoryPageHref({ q: query, category, shortageOnly }, stockPage.pageCount));
}
```
- `src/app/(app)/products/page.tsx`（`getProductMasterPage` 取得直後）:
```ts
if (page > productPage.pageCount) {
  redirect(buildProductsPageHref({ q: query, category, source, setup, attachBarcode }, productPage.pageCount));
}
```
- `src/app/(app)/shortage/page.tsx`（`shortagePageCount` 確定後、描画前）:
```ts
if (page > shortagePageCount) {
  redirect(buildShortagePageHref({ q: query }, shortagePageCount));
}
```

補足:
- `pageCount` は最小1なので、`page === 1` のときは決して redirect しない（空一覧でもOK）。
- これにより範囲外アクセスは自然に最終ページへ落ちる。データ層の「空配列」挙動とテストは不変。

### 受け入れ条件 / 検証
- `?page=999` などで最終ページにリダイレクトされ、「N / N」と整合した表示になる。
- ページ1で結果0件のときはリダイレクトせず、従来の空表示のまま。
- 既存2テスト（データ層の範囲外=空配列）が引き続き green。
- 手動: 各一覧で範囲外 page を直接URL指定して挙動確認。

### 触らない
- `getStockPage` / `getProductMasterPage` の戻り値仕様（範囲外=空配列）。

---

## 全体の完了条件
1. 修正1〜3を実装。
2. 次がすべて green:
   - `corepack pnpm exec tsx tests/stock-page.test.ts`
   - `corepack pnpm exec tsx tests/product-master-page.test.ts`
   - `corepack pnpm exec tsx tests/list-pagination-stability.test.ts`（本書同梱）
   - `corepack pnpm exec tsx tests/ui-smoke.test.ts`
3. `corepack pnpm typecheck` / `corepack pnpm build` が通る。
4. `docs/dev-log.md` に変更概要（What changed / Files / How to test / Risks / Next）を追記。

## 注意（共通）
- 認証・権限・Cookie・ログアウト・DB破壊的変更には触れない。
- 既存関数のシグネチャ・戻り値仕様（特にページ関数の範囲外=空配列）を変えない。
- DBテストは並列実行すると同一テストスキーマの reset が衝突する。**1ファイルずつ直列**で実行する。
