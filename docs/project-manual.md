# 一般歯科材料在庫管理システム 開発・管理用使用書

この文書は、開発者・管理者向けの使用書です。

スタッフが日常操作だけを確認する場合は、`docs/user-manual.md` を使います。  
業務要素や仕様判断を確認する場合は、`docs/spec.md` を使います。  
開発作業の履歴を確認する場合は、`docs/dev-log.md` を使います。

## 1. 文書の役割

このプロジェクトでは、文書の役割を次のように分ける。

| 文書 | 役割 |
|---|---|
| `docs/user-manual.md` | スタッフが日常操作を確認するためのマニュアル |
| `docs/spec.md` | 業務上の要素、判断、対象範囲、作るもの・作らないものを整理する仕様書 |
| `docs/dev-log.md` | 開発作業、判断、検証結果を時系列で残す開発ログ |
| `docs/project-manual.md` | 開発・管理のために、現状、起動手順、注意点をまとめる使用書 |
| `README.md` | プロジェクト全体の入口 |

## 2. プロジェクト概要

プロジェクト名: `dental-materials-inventory`

正式表示名: 一般歯科材料在庫管理システム

目的:

- 一般歯科材料・消耗品・備品の在庫を確認する
- 在庫不足を見つける
- 補充や発注の判断をしやすくする
- 商品、発注先、バーコード情報を整理する

## 3. 現在の到達点

2026-05-19時点で、フェーズ3-Kの棚卸セッションまで実装済み。

現時点の到達点:

在庫を確認し、不足を見つけ、発注候補を作り、商品・発注先・バーコード情報を最低限整備し、棚卸をセッションとして途中保存・確定・履歴確認できる状態。

## 4. フェーズ別の進捗

### フェーズ1: 在庫見える化

実装済み:

- ログイン
- ログアウト
- ホーム画面
- 共通アプリナビ
- 在庫一覧
- 在庫数の理由メモ付き直接編集
- よく使う商品カード
- 不足在庫一覧
- 不足在庫一覧のA4縦想定ブラウザ印刷
- 棚卸
- 在庫変更履歴 `stock_movements`

### フェーズ2: 発注候補と関連情報確認

実装済み:

- 不足在庫から発注候補へ追加
- 発注候補一覧
- 発注候補の検索、状態フィルタ、発注先ごとのグルーピング
- 発注数量、状態、見送り理由・備考メモの変更
- 発注候補一覧のA4縦想定ブラウザ印刷
- 入出庫履歴一覧
- 商品マスタ閲覧
- 商品詳細閲覧
- 発注先マスタ閲覧
- 発注先詳細閲覧
- 商品、発注先、在庫、履歴、発注候補の関連導線
- 複数バーコードを扱うための `ProductBarcode` 土台

### フェーズ3: マスタ最小編集とバーコード活用

実装済み:

- 商品マスタ最小編集
- 発注先マスタ最小編集
- バーコード検索画面
- 商品編集画面でのバーコード追加、編集、代表指定、紐づけ解除
- 未登録バーコードから既存商品へ紐づける導線
- バーコード読取履歴の保存と一覧表示
- 未対応バーコード整理
- 棚卸セッションの開始、途中保存、破棄、確定
- 棚卸セッション履歴詳細

棚卸セッション:

- 入口は `/stocktake/sessions`
- 新規開始は `/stocktake/sessions/new`
- 進行中編集は `/stocktake/sessions/[sessionId]`
- 履歴詳細は `/stocktake/sessions/[sessionId]/history`
- 確定時の在庫履歴は `StockMovement.sourceType = STOCKTAKE_SESSION` として残る
- 旧 `/stocktake` の単発棚卸は当面残す

## 5. まだ作らないもの

次の機能は、業務ルールや運用上の安全性を確認してから扱う。

- 外部発注送信
- メール送信
- 発注書PDF生成
- 納品確認
- 発注書単位の親子構造
- バーコード読み取りによる在庫の自動入出庫
- バーコード読み取りによる棚卸自動確定
- 商品マスタの削除
- 発注先マスタの削除
- CSVインポート、CSVエクスポート
- 複数クリニック切替UI
- 詳細な権限管理
- PWA

## 6. 技術方針

- TypeScript
- Next.js App Router
- Prisma 6系
- PostgreSQL
- NextAuth.js Credentials Provider
- Tailwind CSS
- Zod
- pnpm

注意:

- `pnpm` は `corepack pnpm` 経由で使う
- Prisma は6系固定
- shadcn/ui は未導入
- UIはTailwind CSSで実装中

## 7. ローカル開発手順

依存関係を準備する。

```powershell
corepack enable
corepack prepare pnpm@10.0.0 --activate
corepack pnpm install
```

ローカルDBを起動する。

```powershell
docker compose up -d
```

環境変数ファイルを作成する。

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example .env
```

Prisma ClientとDBスキーマを準備する。

```powershell
corepack pnpm prisma:generate
corepack pnpm db:push
corepack pnpm db:seed
```

開発サーバーを起動する。

```powershell
corepack pnpm dev
```

## 8. 開発確認用ログイン

```text
email: test@example.com
password: password
```

これは開発確認用のテストアカウントである。  
スタッフ配布用マニュアルには、この情報を直接書かない。

## 9. よく使う確認コマンド

```powershell
corepack pnpm typecheck
corepack pnpm build
```

開発DBを初期seed状態に戻す場合:

```powershell
corepack pnpm db:seed
```

## 10. DBと開発環境の注意

- 開発DBは検証操作によりseed直後から変化していることがある
- 初期状態に戻す場合は `corepack pnpm db:seed` を使う
- Prisma Client生成時に、Next.js開発サーバーがPrisma DLLを掴んでEPERMになることがある
- EPERMが出た場合は、このプロジェクトのNext.js関連Nodeプロセスだけを停止してから `corepack pnpm prisma:generate` を再実行する
- Codex本体や `node_repl` のNodeプロセスは停止しない
- 確認用に `corepack pnpm dev` を起動した場合は、確認後に停止する
- 棚卸セッション関連のDBスキーマ反映には `corepack pnpm db:push` が必要
- Docker DesktopやPostgreSQLが停止している場合、`db:push` とブラウザでの棚卸セッション確認はできない

## 11. セキュリティとデータの注意

- APIキー、パスワード、トークンをコードに保存しない
- 実在の患者情報を入れない
- 実在クリニック名を入れない
- 実在会社名や秘密情報をテストデータとして入れない
- 備考欄、理由メモ、発注候補メモにも個人情報を書かない
- バーコードは商品識別子として扱い、患者情報や秘密情報を入れない

## 12. 次に進めやすい候補

1. DB起動後の棚卸セッション通し確認
2. スタッフマニュアルの印刷用整形
3. バーコードスキャナー到着後の実機確認
4. 発注候補を発注書単位にまとめるワークフロー
5. 商品写真の表示枠・任意登録の検討

外部発注送信、メール送信、発注書PDF生成、納品確認は、業務ルールが固まってから扱う。
