# Codex指示書: UI見直し（配色・文字・余白）P1／P2

作成: 2026-10-08 / 立案: Claude Code / 実装: Codex / 状態: **P1 着手可**

## 0. 目的と正本

- 利用者の指摘「余白が多すぎる」「AIっぽい色使い」を解消する。
- 見た目の正本は2つある。
  - `docs/design.md` §1〜§5（2026-10-08改訂）
  - `docs/mockups/ui-revision-mockup.html` の「新案4 根拠版」
- 配色の根拠は `docs/color-rationale-2026-10-08.md` にある。
- **業務処理・データ・DB・認証・権限・Server Action・文言の意味は変えない。** 変えるのは見た目（クラス・CSS・表示の並び）だけ。
- 依存追加なし、外部通信なし、Webフォントの追加なし。

## 1. 絶対に守る制約（MUST）

1. **出庫・納品カードの寸法を変えない。**
   - 対象: `src/app/(app)/stock-out/stock-out-catalog.tsx`、`src/app/(app)/receive/` のカード、`src/components/domain/issue-instructions.tsx`。
   - padding・gap・min-height・写真80px・48pxの操作・文字サイズ（商品名16px、規格12px、現在庫24px、ラベル12px）は現行のまま。
   - 変えてよいのは色・枠の色・角丸・影（`box-shadow` の inset を含む）だけ。`border-width` の追加で高さを変えない。
2. 操作部品の高さ（40px以上、主要操作48px）を下げない。
3. 文字サイズは design.md §3 の7段だけを使う。
   - 11px以下、`text-[Npx]`、`text-3xl`〜`text-5xl` は使わない。
   - 例外は商品詳細の現在庫 `text-display`（48px）の1箇所だけ。
4. 色は design.md §2.1 のトークンだけを使う。
   - Tailwind の既定パレットのクラス（`bg-red-50`、`hover:bg-teal-800` 等）と HEX の直書きを残さない。
   - 原始値は `src/app/globals.css` の `:root` だけに置く。
5. **状態には必ず文字を付ける**（design.md §2.2-5）。色だけで状態を示さない。
6. 印刷用のスタイル（`print:` と `@media print`）を壊さない。発注書下書き・不足在庫の印刷は白地・墨で出す。

## 2. ブランチと進め方

- `master` 最新から `ui/revision-p1` を作る。
- 未追跡の `.playwright-cli/`、`docs/codex-handoff-barcode-batch-mode.md` は触らない。
- 次の4つの未コミット文書は、P1の最初のコミットに含める。
  - `docs/design.md`
  - `docs/color-rationale-2026-10-08.md`
  - `docs/mockups/ui-revision-mockup.html`
  - 本書
- **P1のPRがレビューで承認されてから**、P2 を `ui/revision-p2` で始める。

---

## 3. P1: 色・文字・影（全画面、構造は変えない）

### 3.1 トークンの土台

**`src/app/globals.css`**

- `:root` に design.md §2.1 の CSS変数（`--c-paper` 〜 `--c-focus`）を置く。
- body の青緑のグラデーションを削除し、`background: var(--c-paper)` にする。
- `color` は `var(--c-ink)` にする。
- `::selection` は `var(--c-tint)` にする。
- `@layer components` に次を定義する。
  - `.focus-ring`: design.md §2.2-6 の黄と墨の二重リング
  - 全体の `:focus-visible` にも同じ値を当てる
- 印刷時は台紙を白にする（既存の `@media print` を維持）。

**`tailwind.config.ts`**

- `colors` を design.md §2.1 の Tailwind 名で、すべて `var(--c-…)` 参照にする。
- `warning` と `caution` は削除する。
- `fontSize` は次のとおりにする。
  - `label: ['13px', '18px']` を追加
  - `xl: ['22px', '28px']` に変更
  - `display: ['48px', '52px']` を追加
- `boxShadow` は次のとおりにする。
  - `panel` を削除する
  - `raise`: `inset 0 1px 0 rgb(255 255 255 / .22), 0 3px 0 var(--c-ai-edge), 0 4px 6px rgb(0 0 0 / .18)`
  - `raise-light`: `inset 0 1px 0 #fff, 0 2px 0 var(--c-control-edge), 0 3px 4px rgb(0 0 0 / .08)`
  - `press`: `inset 0 2px 3px rgb(0 0 0 / .25)`
  - `inset-field`: `inset 0 2px 3px rgb(0 0 0 / .10)`
  - `sheet`: `0 1px 0 var(--c-rule)`
- `backgroundImage` に `raise: 'linear-gradient(var(--c-sheet), var(--c-paper-2))'` を追加する。

これで、既存の `accent`・`ink`・`danger` などのトークンクラス（約3,300箇所）は自動で新しい色に変わる。

### 3.2 置換表（既定パレットの直書き 503箇所・77ファイル）

| 現在 | 置換後 | 備考 |
|---|---|---|
| `hover:bg-teal-800`、`active:bg-teal-800` | `hover:bg-accentDeep` | 主ボタン |
| `bg-teal-50`（hover・チップ・選択面） | `bg-tint` | |
| `bg-ink … hover:bg-gray-700` の塗りボタン | その画面の主操作なら `bg-accent hover:bg-accentDeep`。主操作が他にあるなら §3.3 の枠ボタン | 塗りは1画面1つ |
| `bg-gray-50`、`bg-gray-100`、`bg-gray-200` | `bg-subtle` | |
| `border-gray-200`、`divide-gray-*` | `border-line` | |
| `text-gray-*`、`text-slate-*` | `text-muted`（本文相当なら `text-ink`） | |
| エラーの案内（`bg-red-50`＋`text-danger`＋`border-red-*`） | `bg-panel border border-line border-l-4 border-l-danger text-danger` | 文言の先頭に「エラー: 」が無ければ付ける |
| 完了の案内（`bg-emerald-50`／`bg-green-50`＋`border-emerald-*`／`border-green-*`） | `bg-panel border border-line border-l-4 border-l-success text-success` | 文言の先頭に「✓ 」 |
| 注意の案内（`bg-yellow-50`／`bg-amber-50`／`bg-orange-50`＋`border-yellow-*` 等） | `bg-markSoft border border-line border-l-4 border-l-ink text-ink` | 文言の先頭に「▲ 」。黄を文字色にしない |
| 情報の案内（`bg-blue-50`／`bg-sky-50`＋`text-blue-*`／`text-sky-*`） | `bg-tint border border-line text-ink` | |
| `text-warning`（件数・状態） | `text-ink font-semibold`。注意として目立たせる件数には §3.3 の `.mark-under` を足す | |
| `border-warning/*`、`ring-warning/*` | `border-line`（注意の枠なら `border-l-4 border-l-ink`） | |
| `text-caution`、`bg-warning` | `text-ink`、`bg-mark` | |
| `ring-*-300`（状態のリング） | 削除し、状態の文言で示す | |
| `shadow-panel`、`shadow-sm`、`shadow-md`、`hover:shadow-md` | 削除。カード・表の外枠は `shadow-sheet` | |
| `rounded-xl`、`rounded-lg`（カード・枠） | `rounded`（4px） | カードの寸法は変わらない |

- 置換で判断に迷う箇所（同じ要素に複数の状態色、グラフの色、印刷専用の色）は**推測で決めず**、一覧にしてPR本文の「確認待ち」に書く。

### 3.3 共通の見た目クラス（`globals.css` の `@layer components`）

| クラス | 中身 | 使う所 |
|---|---|---|
| `.btn-primary` | `bg-accent text-white shadow-raise hover:bg-accentDeep active:translate-y-0.5 active:shadow-press disabled:bg-subtle disabled:text-muted disabled:shadow-none` | 主操作の塗りボタン |
| `.btn-secondary` | `bg-raise border border-lineStrong text-ink shadow-raise-light active:translate-y-0.5 active:shadow-press disabled:…（同上）` | 枠ボタン、＋／− |
| `.chip-selected` | `bg-accent text-white translate-y-0.5 shadow-press` | 選択中のカテゴリー（✓ は維持） |
| `.field` | `bg-panel border border-lineStrong shadow-inset-field` | 入力欄・選択欄 |
| `.mark-under` | `background: linear-gradient(transparent 52%, var(--c-mark) 52%)` | 注意の件数の下半分 |

- 既存のボタンの高さ・padding・文字サイズのクラスは残し、色と影のクラスだけ上のクラスに置き換える。

### 3.4 状態の表示（design.md §2.3）

**出庫カード `stock-out-catalog.tsx`**（寸法を変えない）

| 状態 | 表示 |
|---|---|
| 基準未満で在庫あり | 現在庫欄を `bg-mark`、文言を「▲ 基準在庫を下回っています」（墨・太字） |
| 在庫0 | 現在庫欄は `bg-tint`。数量と「■ 在庫切れ」を朱。カードに `shadow-[inset_4px_0_0_var(--c-shu)]` 相当の左の線（`globals.css` に `.edge-stop` として定義） |
| 通常 | 現在庫欄 `bg-tint`、カードの上罫 `inset 0 2px 0 var(--c-ai)`（`.edge-top` として定義） |

- 「出し方」の項目名は `bg-accent text-white` の小札にする（`px-1.5 py-0.5 rounded-sm`）。
  - 行の高さ20pxに収まることを §5 の計測で確認する。

**ホーム「今日の注意」の件数**

- 在庫0: 朱
- 確認待ち・不足在庫: `.mark-under`
- 納品待ち・長期在庫・0件: 無彩色

**納品カード**も出庫カードと同じ規則にする（寸法不変）。

### 3.5 文字サイズ

| 現在 | 置換後 |
|---|---|
| `text-[9px]`、`text-[10px]`、`text-[10.5px]`、`text-[11px]`、`text-[12px]` | `text-xs`。表ヘッダー・ラベルなら `text-label` |
| ページ見出し `h1` の `text-3xl` | `text-xl`（スマホは globals.css で20px） |
| 数値の `text-3xl`・`text-4xl` | `text-2xl` |
| 商品詳細の現在庫（48px相当） | `text-display` |
| `text-5xl` | `text-display`。商品詳細以外にあれば `text-2xl` |
| 見出しの `text-xl`（20px → 22pxになる） | ページ見出し以外で使っている箇所は `text-lg` へ下げる。ただしカード内は対象外（現行どおり） |

---

## 4. P2: ナビ・ページ枠・ホーム（P1 承認後）

### 4.1 共通ナビ `src/components/domain/app-nav.tsx`（design.md §4）

- 2段を1段にする。
  - 左: ナビ項目（高さ56px、16px、藍の帯、白82%の文字）
  - 現在地: 紙色のタブ＋太字。`aria-current` を維持する
  - 右: 院名（14px太字・白）、作業スタッフの選択（48px、ラベル「担当」）、「その他」
- 「その他」は `<details>` か、既存の方式に合う開閉メニューにする。中身は管理（権限がある時だけ）・マニュアル・アカウント・区切り線・ログアウトの順。
  - キーボードで開閉でき、Escで閉じてフォーカスを戻す。
- スマホ（639px以下）
  - 院名を1段目に置き、2段目に担当と「その他」を置く。
  - ナビ項目は横スクロールのまま。
- 管理モード（`isAdminMode`）も同じ構造にする。項目だけ管理用に替える。
- `WorkStaffSelector`、`ClinicSwitcher` の動作・保存は変えない。

### 4.2 ページ見出し `src/components/ui/page-header.tsx`（新規）

- `title`（必須）、`description`（任意。見出しの右に14pxで1行）、`actions`（任意。見出しの右端）を受け取る。
- 余白は design.md §4 のとおり（下の余白・下罫なし）。
- 44箇所の `<header className="… border-b … pb-5 …"><h1 className="text-3xl …">` を置き換える。
- 説明文は、その画面で操作に必要な場合だけ残す。消すものはPR本文に一覧で書く。

### 4.3 ページの外枠

- `<main className="min-h-screen bg-surface px-4 py-6 … lg:px-8">` と `flex-col gap-6` を次にそろえる。
  - `px-3 pt-3 pb-6 lg:px-6`、`gap-3`
  - セクションの間は `gap-4`
- 20箇所程度。共通の `PageShell` を作るかどうかは任せるが、作る場合も印刷の `print:` は維持する。
- カード・表の外枠の `p-5`・`p-6` は `p-3` にする。**出庫・納品カードは対象外。**

### 4.4 ホーム `src/app/(app)/home/page.tsx`（design.md §5.3、モックの「ホーム」）

- 出庫・納品
  - 2つのボタン（最小高さ88px。`tailwind.config.ts` の spacing に `22: "88px"` を追加して `min-h-22` を使う）
  - タイトル22px、件数14px、説明14px
- 「今日の注意」
  - 罫で区切った4列の表（スマホ2列）。各セルの最小高さは52px。
  - 説明文（`note`）は常時表示せず、`title` 属性とスクリーンリーダー用の文言に移す。
- 「直近の在庫更新」は表、「確認メニュー」「管理メニュー」は罫の一覧（1行48px）にする。
- 1024px以上では、「直近の在庫更新」と「確認メニュー」を左右2列に並べる。

---

## 5. 確認（P1・P2それぞれ）

### 5.1 機械検査（PR本文に数値を書く）

```bash
# 既定パレットの直書き（0件であること）
grep -rnoE '\b(bg|text|border|ring|divide|from|to|via|fill|stroke|outline)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' src | wc -l
# HEX直書き（globals.css の :root 以外で0件）
grep -rnoE '#[0-9a-fA-F]{3,6}\b' src --include=*.tsx --include=*.ts | wc -l
# 任意サイズと大きすぎるサイズ（text-display の1箇所以外0件）
grep -rnoE 'text-\[[0-9.]+px\]|text-(3xl|4xl|5xl)' src | wc -l
# 影とグラデーションの残り（0件）
grep -rnoE 'shadow-panel|shadow-md|linear-gradient\(180deg' src | wc -l
# 廃止トークン（0件）
grep -rnoE '\b(text|bg|border|ring)-(warning|caution)\b' src | wc -l
```

### 5.2 カード寸法の計測（最重要）

- 隔離DBに架空データの商品8件以上を用意する。名前の長さ、規格あり・なし、基準未満、在庫0、単位未確認を混ぜる。
- 変更前（`master`）と変更後の `/stock-out` を、1024×768・768×1024・390×844 で開く。
- **全カード行の高さ（行ごとの最大高さ）と、各カードの「出し方」「現在庫」「数量」の開始位置**を Playwright で取得する。
- 前後で完全に一致すること（差0px）。`/receive` も同じ手順で確認する。
- 不一致なら原因を直してから進む。直せない場合は止めて報告する。

### 5.3 表示と操作

- 主要画面に横のはみ出しが無いこと、コンソールエラーが0件であること。
  - 主要画面: ホーム、出庫、納品、在庫、発注、履歴、棚卸、商品詳細、管理の本部ダッシュボード
- キーボードの Tab で、すべての操作部品に黄と墨のフォーカスが出ること。
- 「その他」が開閉でき、ログアウトが区切り線の下にあること（P2）。
- タブレット横で、本体の開始位置が110px前後であること（P2。現行202〜275px）。
- 印刷プレビュー（発注書下書き、不足在庫）が白地・墨で崩れないこと。
- 既存の型チェック、全テスト、本番ビルド、隔離CIが成功すること。

### 5.4 コントラスト

- design.md §2.1 の組み合わせを再計算し、文字4.5:1以上、操作部品の枠とフォーカス3:1以上であることを PR 本文に書く。
- 文字と非テキスト（枠・フォーカス）は別々に検査する。

## 6. 完了条件と禁止事項

- §5 がすべて成功し、PRのCIと Vercel Preview が成功したところで止める。
- PRのマージ、本番公開、公開DBへの接続は行わない（ユーザー承認後）。
- `docs/dev-log.md` に作業記録と朝礼反映のブロックを追記する。
- `docs/spec.md` に「§96 UI見直し（見た目のみ・業務処理は不変）」を短く追加し、design.md を参照させる。
- `docs/user-manual.md` の画面説明で、色や位置に触れている箇所（「右上のログアウト」等）を更新する。
- 判断に迷った箇所は推測で決めず、PR本文の「確認待ち」に書く。

---

## 7. P1 レビュー結果（2026-10-08・Claude Code）: 差し戻し

対象: PR #15（`ui/revision-p1`、`d175687`）。

### 7.1 確認できたこと（合格）

- §5.1 の機械検査5項目は、レビュー側でも全部0件を再現した。
- 出庫・納品カードの差分は、色・角丸・影・状態の文言の変更だけだった。寸法に関わるクラス（padding、gap、min-h、写真80px、h-12）は変わっていない。数量欄の20pxも `.card-control-size` で維持されている。
- 基準未満は黄の面＋「▲ 」、在庫0は朱＋「■ 」で、design.md §2.3 どおり。
- 案内枠の「エラー: 」24箇所、「✓ 」27箇所を確認した。

### 7.2 修正してほしいこと（このPRで直す）

| # | 問題 | 修正 | 根拠 |
|---|---|---|---|
| R1 | **立体のボタンの適用漏れ。** `btn-primary` は3箇所、`btn-secondary` は4箇所だけ。`bg-accent` の塗りボタン85箇所と、`border-accent … text-accent` の枠ボタン107箇所が平らなまま | ボタン（`<button>`、ボタンの見た目の `<a>`、`SubmitButton`）の色・影・hover・disabled のクラスを `btn-primary`／`btn-secondary` に置き換える。高さ・padding・文字サイズのクラスは残す。ナビの項目と、表の中の文字リンクは対象外 | 指示書 §3.3、design.md §5.1 |
| R2 | **無効状態が不透明度だけ。** `disabled:opacity-40/50/60/70` が61箇所 | R1 の置き換えで `btn-*` の disabled（`bg-subtle text-muted`）に寄せ、`disabled:opacity-*` を0件にする。ボタン以外（入力欄等）は `disabled:bg-subtle disabled:text-muted` | design.md §2.3「低い不透明度だけで済ませない」 |
| R3 | **表ヘッダーが本文より2段小さい。** `<thead>`・`<th>` の34箇所が `text-xs`（12px）、セルは `text-sm`（14px）。`text-label` の使用が0件 | 表ヘッダーを `text-label`（13px）にする。フォームのラベル・状態表示で12pxにしたものも、design.md §3 の用途に合わせて `text-label` へ | 共通UI設計ガイド §1.3、design.md §3、指示書 §3.5 |
| R4 | **在庫0のカードで上罫が消える。** `edge-stop` と `edge-top` が択一で、どちらも `box-shadow` | `.edge-stop` を `box-shadow: inset 0 2px 0 var(--c-ai), inset 4px 0 0 var(--c-shu);` にする | design.md §5.4・モック |

### 7.3 確認待ちへの回答

| 項目 | 判断 |
|---|---|
| 数量欄の20px（`.card-control-size`） | **`text-xl`（22px／行高28px）に置き換え、`.card-control-size` を削除する。** ＋／−と入力欄は `h-12`（48px）固定で行高も28pxのまま変わらないため、カードの高さは変わらない。これで8段目のサイズがなくなる。置き換え後、§5.2 の計測をやり直し、差0pxを確認する |
| 納品カードに在庫状態が無い | **今のままでよい。** 納品は「届いた物を受け取る」画面で、基準未満・在庫0の判定は必要ない。状態データの追加は行わない |
| 印刷の白地・墨 | 今のままでよい。印刷プレビューは利用者がVercel Previewで確認する（§7.5） |
| 拡張機能によるコンソール警告 | 拡張機能なしのブラウザー（新しいプロファイルか、Playwrightの素のChromium）で再計測し、アプリ由来のエラーが0件であることをPR本文に書く |

### 7.4 再提出の条件

- R1〜R4 と §7.3 の数量欄を直し、§5.1 の機械検査に次の3つを追加して、すべて0件にする。
  ```bash
  grep -rnoE 'disabled:opacity-[0-9]+' src | wc -l
  grep -rnoE 'card-control-size' src | wc -l
  grep -rnoE '<(thead|th)[^>]*\btext-xs\b' src | wc -l
  ```
- 次の2つの件数をPR本文に書く。
  - `bg-accent` を含み `btn-primary`・`chip-selected` を含まないクラス文字列の件数（ナビの現在地・小札など、ボタン以外の残りは理由つきで列挙）
  - 枠ボタンの `btn-secondary` 適用件数
- §5.2 のカード寸法の計測をやり直し、差0pxを再確認する。
- マージはしない。

### 7.5 利用者に確認してほしいこと（Codexでは不可）

- Vercel Preview にログインして、ホーム・出庫・納品・在庫・発注・商品詳細を見る。
- 発注書下書きと不足在庫の印刷プレビューを見る。
- できれば実機タブレットで、明るい場所での黄の面と藍の網掛けの見分けやすさを見る。

### 7.6 P2 への追加（このPRでは行わない）

- 表の見出し行を design.md §5.2 の形にする（`tint` の面、藍の文字、下に藍の罫）。P1の指示書に書いていなかったため、P2で行う。
- 注意の案内枠（`bg-markSoft` 49箇所）に、左の4pxの墨の線（`border-l-4 border-l-ink`）を付ける。

---

## 8. P1 再レビュー結果（2026-10-08・Claude Code）: 承認（マージは利用者の画面確認後）

対象: PR #15（`408fac5`）。

### 8.1 レビュー側での再現

- 機械検査8項目（§5.1 の5項目と §7.4 の3項目）は、すべて0件だった。
- `btn-primary` 91件、`btn-secondary` 180件、表の見出し（`<thead>`）は `text-label`。
- `bg-accent` の残り7件は、ボタンではないもの（理由つき）:
  - モーダルの背景2件
  - ファイル選択ボタン4件
  - 「出し方」の小札1件
- 枠に `border-accent` が残る10件は、ボタンではないもの:
  - 案内枠
  - スピナー
  - 「出し方」の枠
  - 選択欄の読み込み中の状態
- R4: `.edge-stop` は上罫と左の朱線の両方を持つ。
- 数量欄: ＋／−と入力欄は `text-xl`（22px）で `h-12`（48px）固定。`.card-control-size` は削除済み。
- CI（receipt-regression）、Vercel、Vercel Preview Comments はすべて成功。

### 8.2 判断

- R1〜R4 と数量欄の修正を確認し、**P1を承認する**。
- マージと本番公開は、利用者が §7.5 の画面確認と印刷プレビュー確認を終えてから行う。

### 8.3 P2 へ持ち越す小さな項目

- モーダルの背景 `bg-accent/30`（2件）を `bg-ink/40` にする。押せる物を示す藍を、操作でない面に使わないため。
- `favicon.ico` の404。既存の問題か今回の変更によるものかを確認し、既存の問題なら別の小さな修正として扱う。
- §7.6 の2件（表の見出し行の網掛けと藍の罫、注意の案内枠の左の線）。

---

## 9. P1 の本番公開と記録（2026-10-08・利用者の指示）

利用者の指示:
- 「本番公開までして」
- 「まだ誰も使ってないので問題ない」
- 「コミットもすべてして」
- 「マージはコーデックスにやらせて」

ログイン後の画面と印刷プレビューは、利用者が未確認のまま公開することを了承している。

### 9.1 マージと本番公開

1. 次を実行する。`--match-head-commit` は、レビューしたコミットから変わっていないことの確認なので外さない。
   ```bash
   gh pr ready 15
   gh pr merge 15 --merge --match-head-commit 408fac5554bfe603bb9850264bbacce8180fafcf
   ```
   - head が `408fac5` から変わっていたら、マージせずに止めて報告する。
2. マージコミットの Vercel Production デプロイが Ready になるのを確認する。
3. 本番を、ログインせずに読み取りだけで確認する。
   - `/login` が 200 で、新しい配色になっていること（紙色の背景、藍の主ボタン）
   - 未ログインで `/stock-out`・`/receive` を開くと `/login` へ転送されること
4. ログインはしない。出庫・納品・保存などの書き込み操作、公開DBへの接続はしない。

### 9.2 公開記録のコミット（`docs/ui-revision-p1-release`）

1. 最新の `master` から `docs/ui-revision-p1-release` を作る。
2. `docs/codex-handoff-ui-revision.md` を、`C:\Dev\dental-materials-inventory\docs\codex-handoff-ui-revision.md`（本書。§7〜§9 を含む最新版）の内容で置き換える。
3. `docs/dev-log.md` の末尾に、P1公開の作業記録と「朝礼反映」のブロックを追記する。
   - 前回ブロックの「次のアクション」のうち、片付いたものを「済:」で書く。
     - P1の実装
     - Claude Codeのレビュー
   - 次のアクションには次を書く。
     - P2（`docs/codex-handoff-ui-revision.md` §4・§7.6・§8.3）
     - 利用者による本番画面・印刷・実機タブレットの確認
   - 前回の次のアクションのうち未完了のものは再掲する。
4. コミットし、PRを作り、CIの成功を確認してからマージする。
5. 本番デプロイが Ready であることを確認する。文書だけの変更なので、画面の確認は不要。

### 9.3 作業コピー `C:\Dev\dental-materials-inventory` の同期

このフォルダには、PRに入った文書の未コミット版が残っている。そのため `git pull` が止まる。

1. 次の各ファイルについて、`master`（9.2のマージ後）の内容と比べる。
   - `docs/design.md`
   - `docs/dev-log.md`
   - `docs/codex-handoff-ui-revision.md`
   - `docs/color-rationale-2026-10-08.md`
   - `docs/mockups/ui-revision-mockup.html`
2. 内容が master に含まれているもの（改行コードだけの違いを含む）は、手元の版を master の版に合わせてよい。利用者の承認済み。
   - `dev-log.md` は、手元の 2026-10-08 のブロックが master 側にも入っていることを確認してから合わせる。
3. **master に無い内容が手元にあるファイルは、変更せずに止めて報告する。**
4. `.playwright-cli/` と `docs/codex-handoff-barcode-batch-mode.md` は触らない（別件）。
5. `git pull --ff-only` で `master` を最新にする。`git status` で、上の2つ以外の差分が無いことを確認する。

### 9.4 報告

次をまとめて報告する。
- マージコミット（P1と公開記録の2つ）
- Production デプロイの状態
- 9.1-3 の確認結果
- 9.3 の比較結果（どのファイルを合わせたか）
- 最後の `git status`

---

## 10. P2 着手指示（2026-10-08・利用者の指示「P2もCodexに進めさせて」）

### 10.1 範囲

| 出典 | 内容 |
|---|---|
| §4.1 | 共通ナビを1段にし、「その他」メニューを作る |
| §4.2 | `PageHeader` を新規に作り、44箇所の見出しを置き換える |
| §4.3 | ページの外枠の余白を詰める |
| §4.4 | ホームを作り直す |
| §7.6 | 表の見出し行（`tint` の面・藍の文字・藍の下罫）と、注意の案内枠の左の線 |
| §8.3 | モーダルの背景 `bg-accent/30` を `bg-ink/40` へ。`favicon.ico` の404の原因確認（既存の問題なら直さず報告だけ） |

- 業務処理・データ・DB・認証・権限・Server Action・文言の意味は変えない。依存追加なし。
- §1 の制約（出庫・納品カードの寸法不変、7段の文字、トークンだけ、状態の文言、印刷）は P2 でも守る。

### 10.2 ブランチ

- 最新の `master` から `ui/revision-p2` を作る。
- 本書の未コミット変更（§10）は最初のコミットに含める。
- `.playwright-cli/` と `docs/codex-handoff-barcode-batch-mode.md` は触らない。

### 10.3 確認（PR本文に数値で書く）

1. §5.1 と §7.4 の機械検査8項目がすべて0件のまま。
2. §5.2 のカード寸法: `/stock-out`・`/receive` の全カード行の高さと開始位置が、P1（`master`）と差0px。
   - 外枠の余白が変わるため、カードの**絶対位置**は変わってよい。比べるのはカード内の相対位置と行の高さ。
3. 本体の開始位置（ページ上端から最初の本体要素まで）。
   - 対象: 1024×768・768×1024・390×844 のホーム、出庫、在庫、発注
   - P1との比較を表にする。
   - 目標はタブレット横で110px前後。
4. ナビの確認
   - 3つの幅で横のはみ出しが0
   - 「その他」がキーボードで開閉でき、Escで閉じてフォーカスが戻る
   - ログアウトが区切り線の下にある
   - 管理モードでも同じ構造
   - 作業スタッフの選択と院の切り替えの動作が変わらない
5. ホームの確認
   - 「今日の注意」は停止＝朱、注意＝黄マーカー、情報と0件は無彩色
   - 説明文は `title` 属性とスクリーンリーダー用の文言へ移す
6. 拡張機能なしのブラウザーで、アプリ由来のコンソールエラーが0件。
7. 型チェック、テスト、本番ビルド、隔離CI、Vercel Preview が成功。
8. 印刷用のスタイル（`print:`）を削っていないことを差分で確認する。印刷プレビューの目視は利用者が行う。

### 10.4 止める所

- **ドラフトPRを作り、§10.3 の結果をPR本文に書いたところで止める。** マージと本番公開はしない。
  - Claude Code のレビューのあと、利用者の指示で行う。
- 判断に迷う箇所は推測で決めず、PR本文の「確認待ち」に書く。特に次の2つ。
  - 削除するページの説明文の一覧
  - 「その他」の実装方式
- `docs/dev-log.md` に作業記録と朝礼反映のブロックを追記する。
- `docs/spec.md` §96 に P2 の内容を追記する。
- `docs/user-manual.md` の、ナビ・ログアウトの位置の説明を更新する。

---

## 11. P2 レビュー結果（2026-10-08・Claude Code）: 差し戻し

対象: PR #17（`ui/revision-p2`、`97f2887`）。

### 11.1 確認できたこと（合格）

- 機械検査8項目は、レビュー側でも全部0件を再現した。
- `bg-accent/30` 0件、`PageHeader` 44箇所、`main` の `py-6` 0件。
- `PageHeader` は 22px の `h1`、説明は1行。印刷時は `print:text-2xl` で、印刷用の指定は維持されている。
- 「その他」は `<details>`。Esc で閉じてフォーカスが戻る。ログアウトは区切り線の下。
- CI（receipt-regression）、Vercel、Vercel Preview Comments は成功。

### 11.2 修正してほしいこと（このPRで直す）

| # | 問題 | 修正 |
|---|---|---|
| Q1 | **1024px以上で、ナビの帯が左右に12pxずつはみ出し、横スクロールが出る。** ナビは `-mx-3 lg:-mx-6` で外枠の余白を打ち消す作りだが、次の15ページの `<main>` は `lg:px-6` が無く `px-3` のまま。出庫・納品は、タブレット横で一番使う画面。隔離計測はホームの外枠で行ったため検出できていない。対象: `stock-out`、`receive`、`products/new`、`products/[productId]/edit`、`suppliers/new`、`suppliers/[supplierId]`、`suppliers/[supplierId]/edit`、`stocktake/sessions/new`、`stocktake/sessions/[sessionId]`、`stocktake/sessions/[sessionId]/history`、`barcode/scans`、`barcode/scans/unresolved`、`orders/print`、`imports/medical-devices/barcode-labels`、`admin/staff-operators/labels` | **外枠の余白に依存しない作りへ直す。** 推奨はページ外枠の共通部品（`PageShell` 等）を作り、ナビを `max-w-7xl` の外に置いて全幅の帯にすること。中身だけ `mx-auto max-w-7xl` で揃える。これで1280px超の画面でも、帯が途中で切れない。最低限の修正なら、上の15ページの `<main>` に `lg:px-6` を足す。ただし、今後の追加ページで同じ問題を繰り返すので推奨しない |
| Q2 | **「ログアウト」が朱の文字（`text-danger`）。** 朱は「停止＝在庫0・エラー」専用（design.md §2.2-3） | `text-ink` にする。区切り線の下という位置で区別する |
| Q3 | **「その他」のフォーカスを白い輪郭で上書きしている。** design.md §2.2-6「フォーカスは黄と墨の二重リングだけ。色を変えない」に反する | `focus-visible:outline*` の上書きを外し、共通の `:focus-visible` に任せる。藍の帯の上でも黄の輪（藍に対して6.05:1）で見える |
| Q4 | **「その他」が外側をタップしても閉じない。** `<details>` の初期の動きのまま。タブレットで開いたまま本体を触ると、メニューが残る | `pointerdown` を document で受けて、メニューの外なら閉じる。開いたときだけ登録し、閉じたら解除する |

### 11.3 確認待ちへの回答

| 項目 | 判断 |
|---|---|
| 見出しの院名の補助行（32画面） | **画面では削除する**（院名はナビの帯に常時出ている）。ただし、印刷物には院名が必要。`orders/print` と `imports/medical-devices/barcode-labels` は、画面では隠して印刷では出す（`hidden print:block`）。他の30画面は削除する |
| 「その他」を `<details>` にすること | **採用する。** Q4 の外側タップで閉じる処理を足すこと |
| 院の切り替えを「その他」の中に置くこと | **このままでよい。** 選択中の院名はナビの帯に常に出ている |
| ログイン後の実ページの確認 | Docker が使えないので、利用者が Vercel Preview で確認する（§11.5） |

### 11.4 再提出の条件

- Q1〜Q4 と、§11.3 の院名の補助行を直す。
- 機械検査8項目に、次の2つを足して0件にする。
  ```bash
  # Q1: 外枠に依存する負のマージン
  grep -rnoE '\-m[xt]-[0-9]+' src/components/domain/app-nav.tsx | wc -l
  # Q2
  grep -rnoE 'text-danger' src/components/domain/app-nav.tsx | wc -l
  ```
- 隔離計測を、ホームと**出庫（`stock-out/page.tsx` の実際の外枠）**の両方で、1024・1280・1440・768・390px で行う。
  - 確認すること: `document.documentElement.scrollWidth === innerWidth`（横のはみ出し0）
  - 確認すること: ナビの帯の左右が画面の端に接していること
  - 結果をPR本文に書く。
- §5.2 のカード寸法の比較を、P1（`master`）と差0pxで再確認する。
- ドラフトのまま止める。マージしない。

### 11.5 利用者に確認してほしいこと（再提出のあと）

- Vercel Preview にログインし、出庫・納品・ホームを、タブレット横とスマホの幅で見る。
- 担当スタッフの選択、院の切り替え（複数院の管理者だけ）、「その他」の開閉、ログアウトを実際に操作する。

---

## 12. P2 再レビュー結果（2026-10-08・Claude Code）: 差し戻し（Q1の直し方だけ）

対象: PR #17（`26f0f60`）。

### 12.1 確認できたこと（合格）

- 機械検査10項目（§11.4の2項目を含む）は、レビュー側でも全部0件。
- Q2: ログアウトは墨。
- Q3: 「その他」のフォーカスの上書きは削除済み。
- Q4: 開いている間だけ `pointerdown` を登録し、外側で閉じる。閉じたら解除する。実装は適切。
- §11.3 の院名の補助行の対応、CI・Vercel Preview の成功を確認。

### 12.2 Q1 の直し方に問題がある

現在の実装は `ml-[calc((100%-100vw)/2)] w-screen`（幅 100vw）。

**`100vw` は縦スクロールバーの幅を含む。** そのため、スクロールバーが幅を取るブラウザー（Windows のパソコンの Chrome・Edge 等）では、ページに横スクロールが出る。

- レビュー側で、同じ指定の最小ページを実ブラウザー（1280×800、縦スクロールバー15px）で計測した。
  - `scrollWidth` 1273px に対し `clientWidth` 1265px で、**8px はみ出す**。ナビの左端は -7.5px。
- タブレット・スマホはスクロールバーが幅を取らないため起きない。隔離計測で検出できなかったのはこのため。
- ナビは `<main>` の内側（上の余白 `pt-3` の下）にある。そのため、帯の上に**紙色の12pxのすき間**が残る。

### 12.3 修正（§11.2 Q1 で推奨した形にする）

1. **ページ外枠の共通部品 `src/components/ui/page-shell.tsx` を作る。**
   ```tsx
   // 例
   <div className="min-h-screen bg-surface text-ink">
     <AppNav current={current} />          // 全幅の帯。<main> の外、画面の最上部
     <main className="mx-auto w-full max-w-7xl px-3 pt-3 pb-6 lg:px-6 {className}">
       {children}
     </main>
   </div>
   ```
   - `AppNav` は `w-screen`・`100vw`・負のマージンを使わない。親の幅いっぱい（`w-full`）にして、中身だけ `mx-auto max-w-7xl` で揃える。
   - 印刷用の `print:` 指定（背景を白、余白0 等）は、各ページで指定していた値を `className` 等で渡せるようにし、**消さない**。
2. `AppNav` を使う53ページを `PageShell` に置き換える。
   - `max-w-5xl` など、中身の幅が違うページは引数で渡す。
   - 置き換えは見た目の枠だけにする。ページの中身・処理は変えない。
3. 機械検査に次を足して0件にする。
   ```bash
   grep -rnoE 'w-screen|100vw' src | wc -l
   grep -rlE '<AppNav' src/app | wc -l   # PageShell 以外から直接使っていないこと（0件）
   ```
4. 計測をやり直す（PR本文に書く）。
   - **縦スクロールバーが幅を取る設定**で行う。Chromium なら `--hide-scrollbars` を付けない。ヘッドレスで幅0になる場合は、`::-webkit-scrollbar { width: 15px }` を当てて再現する。
   - 対象: ホーム・出庫・納品・在庫・発注。幅は 1024・1280・1440・768・390px。
   - 確認すること:
     - `document.documentElement.scrollWidth === document.documentElement.clientWidth`
     - ナビの帯の左右が表示領域の端に一致する
     - 帯の上端が0px（すき間なし）
   - 本体の開始位置と §5.2 のカード寸法（P1との差0px）を再確認する。
5. ドラフトのまま止める。マージしない。
