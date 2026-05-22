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
| `docs/project-manual.md` | 開発・管理のために、現状、起動手順、公開デモ、本番化の考え方、注意点をまとめる使用書 |
| `docs/demo-deploy.md` | Vercel + Supabaseで外出先から見せる公開デモを作るための手順書 |
| `docs/next-chat-handoff.md` | 次チャットへ短く引き継ぐための要約 |
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

2026-05-22時点で、商品マスタ新規作成、商品写真1枚登録、商品マスタ一括取り込み、発注先連絡先管理、管理者ユーザー管理、監査ログ、発注書下書き、発注済み記録、簡易納品確認まで実装済み。

現時点の到達点:

在庫を確認し、不足を見つけ、発注候補を作り、発注先ごとの発注書下書きを確認し、発注済みと簡易納品確認まで記録できる状態。商品・発注先・バーコード情報を整備し、商品写真を1枚登録し、棚卸をセッションとして途中保存・確定・履歴確認できる。

外出先で画面を見せるための公開デモは、GitHub、Vercel、Supabase PostgreSQL、Supabase Storageの構成で作成済み。公開デモDBには架空商品50件、不足商品10件、デモログインユーザーを投入済み。

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
- 発注数量、状態、取り消し理由・備考メモの変更
- 発注先ごとの発注書下書き印刷
- 発注済みステータス、発注済み日時、納品確認、納品確認取り消し
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
- ホーム画面の不足在庫簡易推移、未対応バーコード件数、期限が近い読取履歴件数、直近棚卸セッション概要
- 商品写真1枚登録、表示、よく使う商品カードでのサムネイル表示
- 商品マスタ新規作成 `/products/new`
- 商品マスタ新規作成フォームのフィールド別エラー表示
- 商品マスタCSV/Excel貼り付け一括取り込み
- 商品ごとの複数取扱発注先
- 発注先マスタ新規作成、連絡先管理
- 管理者ユーザー管理、監査ログ、ログイン試行制限

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
- アプリ内での発注書PDFバイナリ生成
- 発注書単位の正式な親子構造
- 分納、未納、欠品、納品書照合
- バーコード読み取りによる在庫の自動入出庫
- バーコード読み取りによる棚卸自動確定
- 商品マスタの削除
- 発注先マスタの削除
- CSVエクスポート
- 複数クリニック切替UI
- 複数拠点を前提にした詳細な権限管理
- PWA
- 本番運用向けの監視、バックアップ、障害対応の自動化

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
- 公開デモや本番候補環境でも、実在製品データ、実在クリニック名、患者情報、秘密情報をseedやテスト固定値に入れない
- Vercel、Supabase、GitHubの管理画面スクリーンショットを共有する場合は、接続文字列、パスワード、トークン、メール認証情報を隠す
- 商品写真は `SUPABASE_STORAGE_BUCKET` 設定時にSupabase Storageへ保存し、未設定のローカル開発では `data/local/uploads/products/` へ保存する

## 12. 公開デモ環境

外出先で第三者に画面を見せる公開デモは、次の役割分担で動かす。

```text
GitHub
  コードを置く場所

Vercel
  Next.jsアプリを公開する場所

Supabase PostgreSQL
  デモ用データベースを置く場所
```

Dockerはローカル開発用であり、公開デモでは使わない。PC上のDockerが止まっていても、VercelとSupabaseが動いていれば公開デモは見られる。

公開デモで必要なVercel環境変数:

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

注意:

- `DATABASE_URL` はSupabase PostgreSQLの接続文字列を入れる
- Supabaseのデータベースパスワードをリセットした場合は、Vercel側の `DATABASE_URL` も入れ替える
- Vercel環境変数を変更した後は、既存デプロイには自動反映されないため、Redeployが必要
- `AUTH_URL` はVercelの公開URLに合わせる
- デモログインパスワードはGit、README、チャットに書かない
- `SUPABASE_URL` はSupabaseプロジェクトURLを入れる
- `SUPABASE_SERVICE_ROLE_KEY` は商品写真のサーバー側保存・取得に使う秘密値で、Git、README、チャットに書かない
- `SUPABASE_STORAGE_BUCKET` は商品写真用のprivate bucket名を入れる。例: `product-photos`

公開デモDBの初期化状況:

- Supabase PostgreSQLにDBスキーマ適用済み
- `corepack pnpm db:seed` により架空データ投入済み
- 架空商品50件、不足商品10件、デモログインユーザー作成済み
- パスワードリセット直後はSupabase側の反映待ちで認証エラーが続く場合がある

公開デモで見せやすい画面:

```text
/login
/home
/inventory
/shortage
/orders
/orders/print
/products
/products/new
/products/import
/barcode
/stocktake/sessions
/account/password
/admin/users
/admin/audit-logs
```

商品写真は `SUPABASE_STORAGE_BUCKET` 設定時にSupabase Storageへ保存する。公開デモでも、サービスロールキーとprivate bucketを使うため、秘密値はGitやチャットに書かない。

## 13. 本番導入を考える場合

本番導入では、公開デモと同じVercel + Supabase構成を土台にできる。ただし公開デモは評価・説明用であり、本番ではバックアップ、監視、権限、運用手順、障害対応を追加で設計する。

想定構成:

```text
Vercel Pro以上
Supabase Pro以上
GitHub private repository
独自ドメイン
本番用DB
検証用またはステージング環境
```

2026-05-22時点の概算:

```text
Vercel Pro      約 $20/月 から
Supabase Pro   約 $25/月 から
合計目安        約 $45/月 から + 使用量 + 税 + 追加機能
```

これはインフラ原価に近い金額であり、客先への提供価格には、導入支援、初期設定、データ投入、操作説明、保守、問い合わせ対応、バックアップ確認、軽微な修正を含めて考える。

5クリニックを1法人で扱う場合の料金イメージ:

```text
初期導入費: 20万〜30万円程度
月額利用料: 3万〜5万円程度
対象: 1法人・5クリニック程度まで
```

別案:

```text
法人基本料: 月 20,000円
クリニック追加: 1拠点あたり月 5,000円
5クリニックの場合: 月45,000円
```

この価格は正式見積ではなく、事業設計のたたき台。実際には、データ移行量、写真保存、権限管理、帳票、サポート範囲、SLA、契約条件で調整する。

本番化前に確認したいこと:

- 1法人内で何クリニックを扱うか
- 各クリニックの在庫を分けて見る必要があるか
- 本部が全クリニックを横断して見たいか
- 実在製品データをどう初期投入するか
- 商品写真を本番で使うか
- バックアップと復旧の責任範囲
- スタッフごとの権限が必要か
- サポート対応時間と費用
- 患者情報を絶対に入れない運用をどう徹底するか

## 14. 次に進めやすい候補

1. 公開デモURLで主要画面を一通り確認する
2. 本番導入時の料金・契約・サポート範囲を整理する
3. 5クリニック1法人で必要な複数拠点UIを検討する
4. 発注済み・納品確認フローを実運用に近いデータで確認する
5. バーコードスキャナー到着後の実機確認
6. 発注候補を発注書単位にまとめるワークフロー
7. ロット番号・有効期限の在庫側保存
8. 在庫行追加フローの整理

外部発注送信、メール送信、アプリ内PDF生成、発注書親テーブル、分納管理は、業務ルールが固まってから扱う。
