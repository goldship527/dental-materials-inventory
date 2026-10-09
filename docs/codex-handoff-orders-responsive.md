# Codex指示書: 発注画面の上部の圧縮と、タブレット縦・スマホのカード表示（spec §98）

作成: 2026-10-09 Claude Code（立案層）
状態: 利用者決定済み（「指示書まで作って」）。Codexの実装待ち。

## 0. 背景と目的

- §97（PR #21）の公開後、利用者のログイン後の本番画面をClaude Codeが読み取りで確認した。行の整理は意図どおりだった。
- 一方で、タブレット縦・スマホでは開いた直後の画面に発注一覧が1件も見えず、操作の列が横スクロールの先にあった（spec §98 の表）。
- 仕様の正本は `docs/spec.md` §98、見た目は `docs/design.md` §5.5 の追記。本書は手順と確認方法だけを書く。食い違ったら仕様を優先し、止めて報告する。

## 1. 現状（コードで確認済み）

| # | 内容 | 場所 |
|---|---|---|
| A | 件数カード5枚（`counts.map`、`md:grid-cols-4`、`p-4`・`text-2xl`）。768px未満では1列で縦に5枚 | `src/app/(app)/orders/page.tsx` の `<section className="grid gap-3 md:grid-cols-4 print:hidden">` |
| B | 状態フィルタは文言だけで件数なし（Aと重複） | 同 `statusFilters.map` |
| C | 検索フォームが `md:grid-cols-[1fr_auto_auto]`。768px未満では入力・検索・クリアが3段 | 同 `<form ...>` |
| D | 表が `min-w-[960px]` で、1024pxでも横スクロール8px | 同 `OrderRequestRowsTable` |
| E | 「数量を変えて発注予定へ」が1024pxで2行に折り返す | `order-request-row.tsx` の発注量の列 |
| F | ページ本体の縦の間隔が `gap-5`（20px）。design.md §4 のセクション間は16px | `page.tsx` の最上位 `div` |

## 2. 実装指示

### 2.1 ブランチ

- ブランチ `ui/orders-responsive` は Claude Code が `master`（`8f73364`）から作成済み。作業ツリーにある文書の変更（`docs/spec.md` §98、`docs/design.md` §5.5の追記、本書、`docs/dev-log.md` の朝礼反映）を、最初のコミットに含める。
- 未追跡の `.playwright-cli/` と `docs/codex-handoff-barcode-batch-mode.md` は無関係。触らない・コミットしない。

### 2.2 `page.tsx`

1. **件数カードの削除（§98.1）**
   - 画面用の件数カードの `<section>` を削除する。不要になった `getStatusCardClass` も削除する。
   - 印刷用の `print:grid` の件数欄と「出力条件」は残す。
2. **状態フィルタに件数（§98.1）**
   - 各ボタンを「文言＋半角スペース＋件数」にする。件数は `<span>` に `tabular-nums` を付ける。
   - 「すべて」は `queryFilteredRows.length`。その他は現行の `counts` と同じ値を使う。
   - 件数が0のときは数字を `text-muted`。ただし選択中のボタンでは塗りの上で読める色にする。
   - 確認待ち・納品待ちが1以上のときは、数字を `bg-mark text-ink` の小さな面（左右4px程度の余白、角丸2px）にする。選択中でも同じ面を使う（墨/黄 12.6:1）。
   - ボタンの高さ40px以上を維持する。`aria-current` も維持する。
   - スクリーンリーダー向けに「確認待ち 1件」と読めるよう、件数の後ろに `<span className="sr-only">件</span>` を付ける。
3. **検索欄（§98.2）**
   - フォームを常に1段（`flex` で入力欄 `flex-1 min-w-0`、検索ボタン、クリア）にする。
   - 「クリア」は `text-accent underline` の文字リンクにし、`min-h-10 inline-flex items-center px-2` で押せる範囲を確保する。
   - 390pxで入力欄の幅が120px以上残ることを計測で確認する。
4. **縦の間隔**: 最上位の `gap-5` を `gap-4`（16px）にする（design.md §4）。印刷の `print:gap-3` は維持する。
5. **表（§98.3・§98.4）**
   - `OrderRequestRowsTable` の `min-w-[960px]` を外し、表に `order-rows` クラスを付ける。
   - `colgroup` の比率は、1024×768で横スクロール0px、かつ「数量を変えて発注予定へ」が1行に収まるように調整する。目安は、商品20%・在庫状況16%・発注先20%・発注量20%・記録・操作24%。
   - 外側の `overflow-x-auto` は残してよいが、計測で横スクロール0pxを確認する。

### 2.3 `order-request-row.tsx`

- `<tr>` に `order-row` を付ける。画面用の5つの `<td>` にクラスを付ける。
  - `order-cell-product`
  - `order-cell-stock`
  - `order-cell-supplier`
  - `order-cell-qty`
  - `order-cell-record`
- 印刷専用の3つの `<td>`（状態・備考・確認）には `order-cell-print` を付ける。
- 発注先の列の先頭に、カード表示のときだけ見える「発注先: 」のラベルを付ける。この見え方の切り替えは 2.4 のCSSで行う。
- 納品済み・見送りの行の在庫状況の「—」は、カード表示では段ごと隠す（2.4）。行の在庫状況の `<td>` に `data-empty="true"` を付けるなどして判定する。
- 「数量を変えて発注予定へ」に `whitespace-nowrap` を付ける。1024px以上で収まらない場合は列幅で調整し、文言は変えない。
- 結果の案内文・ボタン・フォームの中身と動作は変えない。

### 2.4 `src/app/globals.css`

- `@media screen and (max-width: 1023.98px)` の中にカード表示を書く。**`@media print` には何も足さない。** `max-lg:` などのTailwindの幅指定は印刷時の幅でも効くので、カード表示には使わない。
- 必要な指定（値は design.md のトークンを使う）:
  - `.order-rows thead`: `display: none`
  - `.order-rows, .order-rows tbody`: `display: block`
  - `.order-row`: `display: grid`
    - `grid-template-columns: 1fr auto`
    - `grid-template-areas: "product product" "stock qty" "supplier supplier" "record record"`
    - `gap: 8px 12px`、`padding: 12px`、`border-bottom: 1px solid var(--c-rule)`
  - `.order-row > td`: `display: block; padding: 0; border: 0`（Tailwindの `border-b px-3 py-2` を打ち消す）
  - `.order-row > td.order-cell-print`: `display: none !important`
    - 理由: `.order-row > td` の指定は `.hidden` より強く、印刷専用の列が画面に出てしまうため。必ず入れる。
  - 各セルの `grid-area`: product / stock / qty / supplier / record
  - `.order-cell-stock[data-empty="true"]`: `display: none`
  - `.order-cell-qty`: 右寄せ。「計算の内訳」と数量フォームは、開いたときにカード全幅を使えるよう、必要なら `grid-column: 1 / -1` で段を分ける。
  - `.order-cell-record` の中のボタン群: 横並び・折り返し（`display: flex; flex-wrap: wrap; gap: 8px`）。開いたフォーム（その他の操作・納品確認）は全幅にする。
  - 「発注先: 」ラベル: 1024px以上では `display: none`。
- 1024px以上の表の見た目は、§97公開時と変えない（2.2-5の列幅の調整を除く）。

## 3. テスト・確認

### 3.1 自動・機械検査

- `corepack pnpm typecheck`、`corepack pnpm build`、`.github/workflows/receipt-regression.yml` の既存テストがすべて成功する（サーバーの変更はない）。
- `src/app/(app)/orders/` と `globals.css` の追加部分について次がすべて0件:
  - Tailwind既定パレットのクラス
  - HEXの直書き
  - `text-[` の任意サイズ
  - 高さ40px未満の行内ボタン

### 3.2 画面の計測（架空データ）

- 前回と同じ方法で計測する。隔離DBが使えなければ前回の隔離fixtureを使う。公開DB・本番には接続しない。
- データ: 2つの発注先に、確認待ち2・発注予定2・納品待ち2（メモあり・なし）・納品済み2・見送り1。
- 幅1024×768・768×1024・390×844で測り、変更前（`master` の `8f73364`）との表を dev-log に残す。

| 項目 | 合格の目安 |
|---|---|
| 最初の発注先の見出しの開始位置 | 1024: 320px以下、768: 360px以下、390: 480px以下 |
| ページの横スクロール | 3幅とも0px |
| 表（`.overflow-x-auto`）の横スクロール | 3幅とも0px |
| 「その他の操作」「納品確認」の右端 | 3幅とも画面内（`getBoundingClientRect().right <= innerWidth`） |
| 印刷専用の列（状態・備考・確認） | 画面では3幅とも非表示 |
| 「数量を変えて発注予定へ」 | 1024で1行（高さ40〜44px） |
| 各状態のカード・行の高さ | 記録のみ（目安なし。報告する） |

- 目安を満たせない項目があれば、無理に詰めずに数値と理由を報告する。
- 操作の確認（3幅）:
  1. 「その他の操作」「納品確認」「計算の内訳」「記録の詳細」「数量変更」「発注先を変更」が開閉でき、開いたフォームがカード内で全幅に出る。
  2. 状態フィルタの件数が表示件数と一致し、選択中のボタンで件数が読める。
  3. 検索・クリアが動く。
  4. キーボードだけで状態フィルタ→検索→各操作へ移動でき、フォーカスが黄と墨の二重リングで見える。
- 印刷プレビュー（ブラウザの印刷、A4縦）を1024・390幅の両方から開き、カードではなく表で、状態・備考・確認の列があることを確認する。折りたたんだ納品済み・見送りも出ること（§97.4）。

## 4. 完了条件

- 3.1・3.2の結果（計測表とスクリーンショットの保存先）が `docs/dev-log.md` にある。
- PRをドラフトで作成し、回帰CIとVercel Previewが成功している。**マージ・本番公開はしない**（Claude Codeのレビューと利用者の指示を待つ）。
- dev-log の末尾に朝礼反映ブロックを追記している（前回の次のアクションの引き継ぎ規則を守る）。

## 5. 実装後にClaude Codeがレビューする点

- 印刷がカードに崩れていないか（`@media screen` 限定、`order-cell-print` の非表示）
- 3幅で操作が横スクロールなしに見えるか。開始位置の目安を満たしているか
- 件数の数字の色と意味（黄＝注意だけ、0は無彩色）
- 1024px以上の表が、§97公開時と列幅以外で変わっていないか

## 6. Claude Codeレビュー結果（2026-10-09、PR #23 head `39f0f0a`）

判定: **差し戻し（修正1件・小）**。画面の実装は承認できる内容。修正後に再レビューする。マージ・公開はまだしない。

### 6.1 確認した点（問題なし）

- カード表示は `@media screen and (max-width: 1023.98px)` に限定されている。印刷用の指定には手を入れていない。印刷専用の列は `order-cell-print` で `display: none !important`。
- 件数カードを削除し、状態フィルタに件数を入れた。件数は検索後の行（`queryFilteredRows`）から数えている。黄のマーカーは確認待ち・納品待ちの1件以上だけで、0件は `muted`。
- 検索欄は1段。「クリア」は下線付きの文字リンクで、高さ40px。本体の間隔は16px。
- 1024px以上の表は `min-w-[960px]` を外し、列幅の調整だけ。数量ボタンは `whitespace-nowrap`。
- 数量ボタンは、表とカードで別の要素にして表示を切り替えている。同じパネルを開くので動作は同じ。
- 型検査・ビルド・回帰CI・Vercel Preview成功。サーバーの変更なし。

### 6.2 修正（必須）: 計測用の生成物をリポジトリから外す

- `output/playwright/` の15ファイル（PNG 4枚・PDF 2本・fixtureとスクリプト）がコミットされている。`master` にはこのフォルダが1つも無い。生成物・検証用の一時ファイルはGit管理に含めない（AGENTS.md「Generated Files」）。
- 直し方:
  1. `git rm -r --cached output/playwright` でPRから外す。ローカルのファイルは消さない。
  2. `.gitignore` に `/output/` を追加する。
  3. dev-log・PR本文の画像の保存先は、ローカルのパスとして残してよい（「リポジトリには含めない」と一言添える）。

### 6.3 注意（修正不要・記録だけ）

- 開始位置312/312/455pxは、本物のページではなく、ナビと見出しを模したfixture（`orders-responsive-shell.mjs`）での値。本物との差は、利用者のログイン後にClaude Codeが本番またはPreviewで読み取り計測して確認する。
- カード表示は CSS の `:has()` を使う。対応はiPadOSのSafari 15.4以降・Chrome 105以降。院内タブレットのOS・ブラウザがこれより古い場合だけ、行の並びが崩れる可能性がある（実機確認の項目に含める）。

### 6.4 再提出の条件

- 6.2の修正後、PRの変更ファイルに `output/` が無い。CI（回帰・Vercel Preview）が成功している。
- dev-log に修正を追記し、朝礼反映の「承認・確認待ち」を「Claude Codeの再レビュー」にしている。

## 7. Claude Code再レビュー（2026-10-09、PR #23 head `2a5f62a`）

判定: **承認**。マージ・本番公開は、利用者の明示の指示があるまで行わない。

### 7.1 確認した点

- 6.2: `output/playwright/` の11ファイル（§6.2で「15ファイル」と書いたのはClaude Codeの数え違い）がPRから外れ、`.gitignore` に `/output/` が入った。PRの変更ファイルは8件で、`output/` を含まない。
- `39f0f0a` からの差分にアプリのコード（`src/`）の変更はない。§6.1で確認した内容はそのまま有効。
- 回帰CI・Vercel Preview成功。競合なし。

### 7.2 公開の条件（利用者が指示した場合）

- PR #23 のheadが次のどちらかであり、チェックがすべて成功していて、競合がないこと。それ以外なら止めて報告する。
  - `2a5f62aeb01d073ffb3631d2dccaa6029698c805`
  - その直後に、本書だけを変更したClaude Codeのコミット（件名 `docs: approve PR 23 (handoff §7)`）が1件だけ乗ったもの。`git diff 2a5f62a <head> --stat` が本書1ファイルだけであることを確かめる。
- このheadに限定してマージする。DBの変更はない。
- 公開後は匿名HTTPで `/login` 200、未ログインの `/orders` が `/login` へ転送されることを確認する。公開記録は別のdocs PRで、本書§7と作業記録・朝礼反映を統合する。
- 公開後、利用者のログインを受けて、Claude Codeが本番 `/orders` を1024・768・390px幅で読み取り計測する（§6.3: fixtureとの差の確認）。院内タブレットのOS・ブラウザで `:has()` が使えるかは実機で確認する。
