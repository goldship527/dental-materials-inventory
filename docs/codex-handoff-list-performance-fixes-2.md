# Codex 引き継ぎ: 一覧パフォーマンス フェーズ1 低優先の後始末（レビュー指摘の残り）

作成日: 2026-06-06
作成: Claude（計画・指示担当）/ 実装: Codex
前提: `docs/codex-handoff-list-performance-fixes.md` の修正1〜3は実装・テスト green 済み。
本書はその実装レビューで出た「低優先・情報レベル」の指摘の後始末。すべて小さく安全な変更。
AGENTS.md の方針どおり「小さく・レビューしやすく」。着手前にこの内容を確認すること。

対応する: A（低）、B（低）。
**見送り（変更しない）**: C（情報）、D（trivial）。理由は各項に記載。Codex はC・Dを“改善”しないこと。

---

## A【低】/shortage 印刷用 tbody で ShortageOrderButton を生成しない

### 問題
`src/app/(app)/shortage/page.tsx` は印刷用 `<tbody className="hidden print:table-row-group">`（298行付近）に
`filteredShortageRows` 全件を描画する。`renderShortageRow`（108行付近）は常に「発注候補」セル内に
`ShortageOrderButton`（クライアントコンポーネント, 158-164行付近）を含むため、**画面では非表示の印刷用行ぶんも
ShortageOrderButton が生成・ハイドレーションされる**。不足点数が非常に多い組織でコストが無駄に増える。
（発注候補列はそもそも `print:hidden` なので印刷には出ない。）

### 直し方
`renderShortageRow` に「操作ボタンを出すか」のフラグを足し、印刷用 tbody では出さない。
**列構造（`<td>` の数と className）は画面用と完全に一致させる**こと（崩れ防止）。発注候補セルは残し、中身だけ空にする。

1. シグネチャを変更:
   ```ts
   const renderShortageRow = (row: StockRow, options: { interactive: boolean } = { interactive: true }) => {
   ```
2. 発注候補セル（現 158-164行）を分岐:
   ```tsx
   <td className="border-b border-line px-4 py-3 print:hidden">
     {options.interactive ? (
       <ShortageOrderButton
         stockItemId={row.stockItemId}
         isAlreadyAdded={activeOrderProductIds.has(row.productId) || hasPendingOrders}
         pendingQuantity={pendingOrders?.totalQuantity ?? 0}
       />
     ) : null}
   </td>
   ```
   - `<td className="... print:hidden">` はそのまま残す（列数を8のまま維持）。中身だけ条件分岐。
3. 呼び出しを変更:
   - 画面用 tbody（295-297行付近）: `pagedShortageRows.map((row) => renderShortageRow(row, { interactive: true }))`
   - 印刷用 tbody（298-300行付近）: `filteredShortageRows.map((row) => renderShortageRow(row, { interactive: false }))`
   - `renderEmptyRow` はそのまま。

### 受け入れ条件
- 画面表示・操作（発注候補追加ボタン）は従来どおり、現在ページの行で動く。
- 印刷出力は従来どおり全件出る（A の変更で見た目・列は変わらない）。
- 画面用・印刷用の tbody で `<td>` 数（=8）と各列の `print:` クラスが一致している。

### 検証
- `corepack pnpm exec tsx tests/ui-smoke.test.ts` が通る（描画クラッシュなし）。
- 開発環境で不足を51件以上にし、`/shortage` の画面操作と印刷プレビューを目視（任意）。

### 触らない
- 列構成・並び順・`print:` 体裁、`ShortageOrderButton` の props 仕様、認証・権限。

---

## B【低】getPurchaseHistorySetupProductRows の orderBy にタイブレーカを追加

### 問題
`src/lib/db/products.ts` の `getPurchaseHistorySetupProductRows`（orderBy は 426行付近）が
`category` → `name` のみで、一意キーが無い。`take: 200` の一覧なので実害は小さいが、修正2で他の一覧に
揃えた「順序安定化」と一貫させておくと将来の取りこぼしを防げる。

### 直し方
当該 `orderBy` の末尾に `{ id: "asc" }`（= Product.id）を追加するだけ。
```ts
orderBy: [
  { category: "asc" },
  { name: "asc" },
  { id: "asc" }, // ← 追加
],
```

### 受け入れ条件 / 検証
- 既存テストが引き続き green（`corepack pnpm exec tsx tests/purchase-history-setup.test.ts` があれば実行）。
- `corepack pnpm typecheck` / `corepack pnpm build` が通る。

### 触らない
- フィルタ条件（購入履歴・未設定の抽出）、`take` 値、戻り値の型。

---

## C【情報・見送り】範囲外ページの「無駄クエリ→redirect→再クエリ」

`/inventory`・`/products` は範囲外 `page` のとき、fetch 後に `page > pageCount` を判定して redirect するため、
巨大 skip の `findMany` を一度走らせてから再リクエストになる。

**見送り理由**: 完全回避するには「count を先に取り pageCount を確定 → page を clamp → 本取得」と取得順を
組み替える必要があり、データ層の構造変更とテスト追従が発生する。発生は範囲外URL直打ちなど稀なケースに限られ、
現状の redirect 方式は正しく安全。**コスト対効果が低いため、今回は変更しない**。
将来フェーズ2でデータ層を見直す際に併せて検討する。

Codex はこの項目を“最適化”しないこと（不要な構造変更を避ける）。

---

## D【trivial・見送り】空表示の colSpan=8

不足が0件のときの `renderEmptyRow` は `colSpan={8}`。画面・印刷とも「見える列は7・隠れ列は1」で、
隠れ列（display:none）は幅を持たないため、`colSpan=8` でも全幅をまたいで中央に表示され**実際の崩れは無い**。

**見送り理由**: 現状で正しく表示される。`colSpan` を媒体ごとに変えるとかえって複雑化・崩れの原因になる。
**変更しない**。

---

## 全体の完了条件
1. A・B を実装（C・D は変更しない）。
2. 次がすべて green:
   - `corepack pnpm exec tsx tests/stock-page.test.ts`
   - `corepack pnpm exec tsx tests/product-master-page.test.ts`
   - `corepack pnpm exec tsx tests/list-pagination-stability.test.ts`
   - `corepack pnpm exec tsx tests/ui-smoke.test.ts`
3. `corepack pnpm typecheck` / `corepack pnpm build` が通る。
4. `docs/dev-log.md` に変更概要（What changed / Files / How to test / Risks / Next）を追記。

## 注意（共通）
- 認証・権限・Cookie・ログアウト・DB破壊的変更には触れない。
- ページ関数の戻り値仕様（範囲外=空配列、total/pageCount 維持）を変えない。
- DBテストは並列実行するとテストスキーマの reset が衝突するため、**1ファイルずつ直列**で実行する。
