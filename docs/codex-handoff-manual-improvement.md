# 引き継ぎ指示書: マニュアル改善（Codex向け）

最終更新: 2026-05-31
対象リポジトリ: goldship527/dental-materials-inventory
作業ブランチ: `manual-content-update`（push 済み）

この文書だけで作業を再開できるように書いています。まず最初に「現状」と「絶対ルール」を読んでください。

---

## 現状サマリー

マニュアル改善を3フェーズで進めています。

| フェーズ | 内容 | 状態 |
|---|---|---|
| ① 内容の最新化 | 約50ルートの実態と本文を突き合わせ修正・新章追加 | 完了・コミット済み・push済み（PR未作成） |
| ② レイアウト改善 | アコーディオン・目次・検索・囲み・タブレット最適化・画像対応 | 設計合意済み・未実装 |
| ③ 画面キャプチャ | デモデータでアプリ起動→各画面撮影→マニュアルへ埋め込み | 未着手 |

- 第1フェーズのコミット: `docs(manual): 内容を現行アプリの実態に合わせて最新化（第1フェーズ）`
- 設計書: `docs/superpowers/specs/2026-05-31-manual-content-update-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-31-manual-content-update.md`
- 監査メモ: `docs/dev-log.md`（各タスクの修正点を記録済み）

---

## 絶対ルール（全フェーズ共通）

- マニュアル本文は `docs/user-manual.md`。アプリ内 `/manual`（`src/app/(app)/manual/page.tsx`）で表示。
- 本文の対応記法は「見出し `#/##/###`・箇条書き `- `・番号付き `1. `・インラインコード `` `code` ``」のみ。第2フェーズで画像 `![alt](src)` を新たに対応させる（後述）。
- 患者名・個人情報・秘密情報・実在クリニック名・実在会社名・DBパスワード等を書かない。
- 文体は「どの画面で何をするか」中心の平易な日本語（非エンジニアのスタッフ向け）。
- 記述はコード上の根拠に対応させる（憶測で書かない）。
- 章番号は現在 1〜29 の連番（飛び・重複なし）。

---

## タスクA: 第1フェーズのPRを作成する（最優先）

ブランチ `manual-content-update` は push 済み。`gh` CLI が未インストールのため自動作成できていない。次のいずれかで作成する。

- 方法1: `gh` をインストール（`winget install GitHub.cli`）してから:
  ```
  gh pr create --base master --head manual-content-update \
    --title "docs(manual): マニュアル内容を現行アプリの実態に合わせて最新化（第1フェーズ）" \
    --body-file <本文ファイル>
  ```
- 方法2: ブラウザで https://github.com/goldship527/dental-materials-inventory/pull/new/manual-content-update を開いて作成。

PR本文の雛形（そのまま使える）:

```markdown
## 概要
スタッフ向けアプリ内マニュアル（docs/user-manual.md、/manual で表示）を、現行アプリ（約50ルート）の実態に合わせて最新化（第1フェーズ）。ルート単位でページ・サーバーアクション・主要コンポーネントを読み、記述をコードの挙動と突き合わせて修正（監査メモは docs/dev-log.md）。

## 主な変更
### 実害のある訂正
- バーコード出入庫の操作順序が逆だった（正：担当者バーコードを先に固定 → 商品バーコード）
- 在庫修正フローの抜け（編集ボタン → 作業スタッフ必須 → 理由メモ必須 → 更新）
- 発注のボタン名・「在庫反映」チェック・納品確認の取り消し条件 などの不正確さ
### 新規章（数値もコードで検証）
- 9. 在庫ロット・使用期限 / 23. 異常出庫検知 / 24. 自分の設定（通知・パスワード） / 25. 管理者向け（旧「本部ダッシュボード」章を統合）
### 全体整備
- 章番号を 1〜29 の連番へ振り直し、早見表・FAQ の古い記述を整合
## 規模
- docs/user-manual.md: 910→1713行（+1168/−211）、docs/dev-log.md +153行
## 注意
- 本文は簡易レンダラー表示。対応記法のみ使用（太字・表・画像なし）。アプリのコード（src/）は未変更。
```

注意: 作業ツリーに無関係な未追跡ファイル `docs/customer-proposal.pdf` / `.pptx` がある。これらは今回の作業と無関係なのでコミットに含めない。

---

## タスクB: 第2フェーズ レイアウト改善（設計は合意済み・未実装）

### 合意済みの方針（ユーザー確認済み）

- 主端末はタブレット。読みやすさ＋操作性を優先。
- 自前レンダラーを拡張（外部Markdownライブラリは入れない）。
- 本文 `docs/user-manual.md` は変更しない。
- アコーディオン初期状態は「全章クローズ」＋「すべて開く/閉じる」操作あり。
- マニュアル内検索を入れる（部分一致で章を絞り込み＋自動展開＋一致語ハイライト）。
- 画像表示対応 `![alt](src)` を入れる（第3フェーズの土台）。
- 囲みは「注意ボックス」と「FAQ強調」まで（手順は控えめ装飾）。

### ファイル構成（責務分離）

現状 `page.tsx` はサーバー処理＋描画が一体。アコーディオン・検索はクライアント操作が必要なので分離する。

- `src/app/(app)/manual/page.tsx`（Server Component・改修）: 認証 `auth()`・`requireActiveClinic()`・Markdown読込（`docs/user-manual.md`）・`AppNav`・ヘッダー描画 → 本文文字列を `<ManualViewer>` に渡す。
- `src/app/(app)/manual/parse-manual.ts`（純粋関数・新規）: Markdown → 構造化モデル `ManualDoc` に変換（JSX を含まない）。
- `src/app/(app)/manual/manual-viewer.tsx`（Client Component `"use client"`・新規）: 検索状態・開閉状態を管理して描画。

### パースモデル

```
ManualDoc = { preamble: Block[]; sections: Section[] }
Section = { id: string; title: string; blocks: Block[]; text: string }  // text=検索用に章内全テキストを小文字連結
Block =
  | { type: "h3"; text }
  | { type: "paragraph"; spans: Span[] }
  | { type: "ul"; items: Span[][] }
  | { type: "ol"; items: Span[][] }
  | { type: "callout"; variant: "warning"; label; items: Span[][] }  // 「注意:」直後のリスト
  | { type: "image"; alt; src }
Span = { type:"text"; value } | { type:"code"; value }
```

パース規則:

- `## ` で章分割。最初の `## ` より前は preamble（H1タイトル＋導入文）。
- `### ` → h3。`- ` 連続 → ul。`^\d+\. ` 連続 → ol。`![alt](src)` 単独行 → image。それ以外の非空行 → paragraph。空行は段落区切り。
- インラインは `` `code` `` のみ。
- callout: 直前段落が「注意:」（全角/半角コロン）だった直後の ul を warning ボックス化し、「注意:」ラベルは callout.label に吸収（二重表示しない）。
- FAQ の `### Q. …` は h3 のまま。描画側で質問カード風に強調（モデルは変えない）。

### 描画（manual-viewer.tsx）

- 状態: `query: string`、`openIds: Set<string>`（初期 空＝全クローズ）。
- 目次: section タイトル一覧ボタン。タップでその章を openIds に追加し `scrollIntoView`。検索中は一致章のみ表示。
- 「すべて開く / すべて閉じる」ボタンを目次付近に。
- 検索: 上部に検索ボックス＋クリア。query があれば `section.text.includes(query.toLowerCase())` で絞り込み＋自動展開、本文描画時に一致語を `<mark>` でハイライト。query が空なら全章表示・openIds に従う。
- アコーディオン: 章見出しは全幅 `<button>`・最低高 44px・`▸`(閉)/`▾`(開)・トグルで openIds 更新。
- タイポグラフィ: 本文 `text-base`〜やや大・行間 `leading-7`〜`leading-8`・章間余白・最大幅 `max-w-5xl`。既存テーマ色（ink/surface/accent/line/muted/panel）流用。注意ボックスは Tailwind amber 系（例 `border-amber-400 bg-amber-50`）。
- 画像: `image` ブロックを `<img className="max-w-full h-auto rounded border border-line" alt=...>`。本文にはまだ画像を入れない。

### 受け入れ基準

- `/manual` がタブレット幅で、初期は全章クローズ・目次・検索ボックス表示で開く。
- 章見出しタップで開閉、「すべて開く/閉じる」動作、目次タップで該当章が開いて移動。
- 検索語入力で一致章のみ表示＋自動展開＋ハイライト、クリアで復帰。
- 「注意:」が注意ボックス、FAQ が質問カード風。
- `![alt](src)` が画像描画できる（一時的に1枚入れて確認、確認後は外す）。
- 本文 `docs/user-manual.md` 未変更。認証・クリニック取得・`AppNav` の挙動は不変。

### やらないこと

- 本文の文章変更、ページ分割、外部ライブラリ、高度な曖昧検索。

### 進め方の推奨

- 別ブランチ（例 `manual-layout`）を切って実装。`corepack pnpm dev` → ログイン → `/manual` で目視確認（`/manual` は認証＋アクティブクリニックが必要）。
- `corepack pnpm typecheck` を通す。

---

## タスクC: 第3フェーズ 画面キャプチャ（未着手）

合意済み: ローカル起動して撮影する方針。

### 手順の骨子

1. ローカルDB用意（`docker-compose.yml` の Postgres）→ `.env.local` 設定（`DATABASE_URL`/`AUTH_SECRET`/`AUTH_URL`/`DEMO_LOGIN_*` 等。`docs/demo-deploy.md` 参照。秘密値はGit/チャット/docsに書かない）。
2. `corepack pnpm prisma:generate` → `corepack pnpm db:push` → `corepack pnpm db:seed`（デモデータ投入。実データには実行しない）。
3. `corepack pnpm dev` 起動 → Playwright で各画面に遷移しスクリーンショット取得。撮影対象は `docs/user-manual.md` の各章に対応する画面（home/inventory/quick/shortage/dormant/stock-lots/orders/products/suppliers/barcode/barcode-stock/stocktake/movements/anomalies/account/admin系 等）。
4. 画像を `public/manual/` 等に保存し、第2フェーズで対応した `![alt](パス)` 記法で `docs/user-manual.md` の該当章に差し込む。
5. 撮影画像に患者名・実在の固有情報が写り込まないこと（seedはデモデータなので原則OKだが要確認）。

### 注意

- 画像が入ると本文が変わるので、第1フェーズと同様にdev-logへ記録。
- キャプチャの枚数・解像度・1章あたり何枚かはユーザーと相談して決めると良い。

---

## 参考: アプリのルートと根拠ファイルの対応（第1フェーズ監査時のメモ）

- 在庫: `src/app/(app)/inventory/`、`src/lib/actions/stock.ts`、`src/lib/stock/status.ts`
- クイック出庫: `src/app/(app)/quick/`、理由文字列は `stock.ts`（"クイック出庫 +1/-1"）
- 不足/発注: `src/app/(app)/shortage/`・`orders/`・`order-records/`、`src/lib/actions/orders.ts`、`src/lib/orders/`
- 商品/発注先: `src/app/(app)/products/`・`suppliers/`、`src/lib/actions/products.ts`・`suppliers.ts`・各 import
- バーコード: `src/app/(app)/barcode/`、`src/lib/actions/barcodes.ts`・`barcode-stock.ts`、正規化は `src/lib/barcode/normalize.ts`（NFKC）
- ロット/期限: `src/app/(app)/stock-lots/`、`src/lib/db/stock-lots.ts`
- 異常出庫: `src/app/(app)/movements/anomalies/`、`src/lib/db/stock-anomalies.ts`（24h/30日平均/0.1未満除外）、しきい値は `src/lib/db/organization-settings.ts`（既定3.0・範囲1.5〜10.0）
- 通知/パスワード: `src/app/(app)/account/`、`src/lib/notifications/`、`src/lib/auth/password-schema.ts`（8文字以上・`[\x21-\x7E]`）
- 管理者: `src/app/(app)/admin/`、`setup/`、ナビは `src/components/domain/app-nav.tsx`（adminNavItems）
