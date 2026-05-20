# dental-materials-inventory

正式表示名: 一般歯科材料在庫管理システム

一般歯科材料・消耗品・備品の在庫確認、補充判断、発注候補確認を支援するためのWebアプリです。

フェーズ1では在庫の見える化、フェーズ2では不足在庫から発注候補を作る流れ、フェーズ3ではマスタ最小編集、バーコード活用、棚卸セッションまでを実装しています。

## 想定する利用者

- 歯科クリニックの在庫管理担当者
- 日常的に材料を使用・補充するスタッフ
- 将来的に複数クリニックを管理する本部担当者

## 現在の実装状況

2026-05-19時点で、フェーズ3-Kまで実装済みです。

### フェーズ1: 在庫見える化

- ログイン、ログアウト
- ホーム画面
- 共通アプリナビ
- 在庫一覧
- 在庫数の理由メモ付き直接編集
- よく使う商品カード
- 不足在庫一覧
- 不足在庫一覧のA4縦想定ブラウザ印刷
- 棚卸の実在庫入力、差異表示、確定
- 在庫変更履歴 `stock_movements` の記録

### フェーズ2: 発注候補と関連情報確認

- 不足在庫から発注候補へ追加
- 発注候補一覧 `/orders`
- 発注候補の検索、状態フィルタ、発注先ごとのグルーピング
- 発注数量、状態、見送り理由・備考メモの変更
- 発注候補一覧のA4縦想定ブラウザ印刷
- 入出庫履歴一覧 `/movements`
- 商品マスタ閲覧 `/products`
- 商品詳細閲覧 `/products/[productId]`
- 発注先マスタ閲覧 `/suppliers`
- 発注先詳細閲覧 `/suppliers/[supplierId]`
- 商品、発注先、在庫、履歴、発注候補の関連導線
- 複数バーコードを検索・閲覧するための `ProductBarcode` 土台

### フェーズ3: マスタ最小編集とバーコード活用

- 商品マスタ最小編集 `/products/[productId]/edit`
- 発注先マスタ最小編集 `/suppliers/[supplierId]/edit`
- バーコード検索画面 `/barcode`
- `products.janCode` と `product_barcodes.barcode` の検索
- 商品編集画面でのバーコード追加、編集、代表指定、紐づけ解除
- 未登録バーコードから既存商品へ紐づける導線
  - `/barcode?barcode=...`
  - `/products?attachBarcode=...`
  - `/products/[productId]/edit?newBarcode=...`
- GS1形式や日時付き読み取り値からの商品コード抽出
- 取込サンプル確認とテスト用JANバーコード表示
- 取込サンプルからローカル検証用商品を1件ずつ追加する導線
- バーコード読取履歴の手動保存と一覧表示 `/barcode/scans`
- 未対応バーコード整理 `/barcode/scans/unresolved`
- 棚卸セッション一覧 `/stocktake/sessions`
- 棚卸セッション開始 `/stocktake/sessions/new`
- 棚卸セッション進行中編集 `/stocktake/sessions/[sessionId]`
- 棚卸セッション履歴詳細 `/stocktake/sessions/[sessionId]/history`
- 棚卸セッション確定時の `StockMovement.sourceType = STOCKTAKE_SESSION` 記録

## まだ作らないもの

以下は、業務ルールや運用上の安全性を確認してから扱います。

- 外部発注送信
- メール送信
- 発注書PDF生成
- 納品確認
- 発注書単位の親子構造
- 商品マスタの新規作成、削除
- 発注先マスタの新規作成、削除
- バーコード読み取りによる在庫の自動入出庫
- バーコード読み取りによる棚卸自動確定
- CSVインポート、CSVエクスポート
- 複数クリニック切替UI
- 詳細な権限管理
- PWA

## 技術方針

- TypeScript
- Next.js App Router
- Prisma 6系
- PostgreSQL
- NextAuth.js Credentials Provider
- Tailwind CSS
- Zod
- pnpm

補足:

- `pnpm` は `corepack pnpm` 経由で使います。
- Prisma は6系固定です。
- shadcn/ui は未導入です。UIはTailwind CSSで実装しています。
- `docs/spec.md` を仕様の正として扱います。
- 重要な変更は `docs/dev-log.md` に追記します。

## ローカル開発手順

依存関係を準備します。

```powershell
corepack enable
corepack prepare pnpm@10.0.0 --activate
corepack pnpm install
```

ローカルDBを起動します。

```powershell
docker compose up -d
```

環境変数ファイルを作成します。

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example .env
```

Prisma ClientとDBスキーマを準備します。

```powershell
corepack pnpm prisma:generate
corepack pnpm db:push
corepack pnpm db:seed
```

開発サーバーを起動します。

```powershell
corepack pnpm dev
```

## 開発用ログイン

```text
email: test@example.com
password: password
```

これは開発用のテストアカウントです。実在の患者情報、実在クリニック名、実在会社名、秘密情報は入れないでください。

公開デモ環境では、ログインメールとパスワードを環境変数 `DEMO_LOGIN_EMAIL`、`DEMO_LOGIN_PASSWORD` で設定します。公開デモ用のパスワードやDB接続文字列は、README、Git、チャットには書かないでください。

## よく使う確認コマンド

```powershell
corepack pnpm typecheck
corepack pnpm build
```

開発DBを初期seed状態に戻す場合:

```powershell
corepack pnpm db:seed
```

## 関連ドキュメント

- 仕様書: `docs/spec.md`
- 開発ログ: `docs/dev-log.md`
- 公開デモ手順: `docs/demo-deploy.md`
- スタッフマニュアル: `docs/user-manual.md`
- 開発・管理用使用書: `docs/project-manual.md`

## 注意点

- 開発DBは検証操作によりseed直後から変化していることがあります。
- 棚卸セッション関連のDBスキーマ反映には `corepack pnpm db:push` が必要です。
- Docker DesktopやPostgreSQLが停止している場合、`db:push` とブラウザでの棚卸セッション確認はできません。
- Prisma Client生成時に、Next.js開発サーバーがPrisma DLLを掴んでEPERMになることがあります。
- その場合は、このプロジェクトのNext.js関連Nodeプロセスだけを停止してから `corepack pnpm prisma:generate` を再実行します。
- Codex本体や `node_repl` のNodeプロセスは停止しないでください。
- 確認用に `corepack pnpm dev` を起動した場合は、確認後に停止します。
- 外出先で見せる公開デモでは、ローカルDockerではなくVercelとSupabase PostgreSQLを使います。
- 商品写真は現状ローカルファイル保存のため、公開デモでは永続保存を期待しないでください。

## 次に進めやすい候補

1. DB起動後の棚卸セッション通し確認
2. バーコードスキャナー到着後の実機確認
3. 発注候補を発注書単位にまとめるワークフロー
4. 商品マスタ・発注先マスタの作成機能

外部送信、メール、PDF生成、納品確認は、業務ルールが固まってから実装します。
