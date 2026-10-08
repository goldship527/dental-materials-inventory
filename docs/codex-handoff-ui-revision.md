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
