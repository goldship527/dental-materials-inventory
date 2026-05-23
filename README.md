# dental-materials-inventory

正式表示名: 一般歯科材料在庫管理システム

一般歯科材料・消耗品・備品の在庫確認、補充判断、発注候補確認を支援するためのWebアプリです。

フェーズ1では在庫の見える化、フェーズ2では不足在庫から発注候補を作る流れ、フェーズ3ではマスタ最小編集、バーコード活用、棚卸セッション、管理機能、簡易的な発注済み・納品確認までを実装しています。

## 想定する利用者

- 歯科クリニックの在庫管理担当者
- 日常的に材料を使用・補充するスタッフ
- 将来的に複数クリニックを管理する本部担当者

## 現在の実装状況

2026-05-23時点で、商品写真ストレージ、管理者ユーザー管理、商品マスタ一括取り込み、発注先連絡先管理、発注書下書き、発注済み記録、発注記録、送付方法・送付メモ・先方対応メモ、簡易納品確認、バーコード入出庫と納品確認でのロット番号・有効期限保存、期限ロット一覧、入出庫履歴CSV出力まで実装済みです。

### フェーズ1: 在庫見える化

- ログイン、ログアウト
- ホーム画面
- 共通アプリナビ
- 在庫一覧
- 在庫数の理由メモ付き直接編集
- クイック出庫
- 不足在庫一覧
- 不足在庫一覧のA4縦想定ブラウザ印刷
- 棚卸の実在庫入力、差異表示、確定
- 在庫変更履歴 `stock_movements` の記録

### フェーズ2: 発注候補と関連情報確認

- 不足在庫から発注候補へ追加
- 発注候補一覧 `/orders`
- 発注候補の検索、状態フィルタ、発注先ごとのグルーピング
- 発注数量、状態、取り消し理由・備考メモの変更
- 商品ごとの複数取扱発注先と、発注候補ごとの発注先切り替え
- 発注先ごとの発注書下書き印刷 `/orders/print`
- 発注済みステータス、発注記録、発注済み日時、送付方法・送付メモ・先方対応メモ、簡易納品確認、納品確認取り消し
- 納品確認時のロット番号・有効期限入力と、在庫反映時のロット別在庫保存
- 入出庫履歴一覧 `/movements`
- 入出庫履歴の期間指定CSV出力 `/movements/export`
- 期限切れ・期限間近ロット一覧 `/stock-lots`
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
- GS1バーコード由来のロット番号・有効期限をバーコード入出庫時に在庫側へ保存
- 棚卸セッション一覧 `/stocktake/sessions`
- 棚卸セッション開始 `/stocktake/sessions/new`
- 棚卸セッション進行中編集 `/stocktake/sessions/[sessionId]`
- 棚卸セッション履歴詳細 `/stocktake/sessions/[sessionId]/history`
- 棚卸セッション確定時の `StockMovement.sourceType = STOCKTAKE_SESSION` 記録
- 商品マスタ新規作成 `/products/new`
- 商品マスタCSV/Excel貼り付け一括取り込み `/products/import`
- 初期設定チェック `/setup`
- 商品写真のSupabase Storage保存
- 管理者向けユーザー管理 `/admin/users`
- 管理者向け監査ログ `/admin/audit-logs`
- 発注先マスタ新規作成 `/suppliers/new`
- 発注先連絡先管理

## まだ作らないもの

以下は、業務ルールや運用上の安全性を確認してから扱います。

- 外部発注送信
- メール送信
- アプリ内での発注書PDFバイナリ生成
- 発注書単位の正式な詳細画面
- 分納、未納、欠品、納品書照合
- 商品マスタの削除
- 発注先マスタの削除
- バーコード読み取りによる在庫の自動入出庫
- バーコード読み取りによる棚卸自動確定
- 入出庫履歴以外のCSVエクスポート
- 複数クリニック切替UI
- 複数拠点を前提にした詳細な権限管理
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

## 公開デモで必要なVercel環境変数

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
DEMO_LOGIN_EMAIL
DEMO_LOGIN_PASSWORD
DEMO_USER_NAME
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

`SUPABASE_STORAGE_BUCKET` は商品写真用のprivate bucket名を設定します。未設定のローカル開発環境では、従来通り `data/local/uploads/products/` に保存します。`SUPABASE_SERVICE_ROLE_KEY` は秘密値なので、README、Git、チャットには書かないでください。

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
- 商品写真は `SUPABASE_STORAGE_BUCKET` 設定時にSupabase Storageへ保存し、未設定のローカル開発では `data/local/uploads/products/` へ保存します。

## 次に進めやすい候補

1. 公開環境で発注済み・納品確認フローを通し確認
2. バーコードスキャナー到着後の実機確認
3. 発注候補を発注書単位にまとめるワークフロー
4. ロット別在庫の棚卸・廃棄フロー

外部送信、メール、アプリ内PDF生成、発注書親テーブル、分納管理は、業務ルールが固まってから実装します。
