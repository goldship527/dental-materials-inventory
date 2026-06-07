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

2026-05-27時点で、商品マスタ新規作成、商品写真1枚登録、商品マスタ一括取り込み、発注先マスタ一括取り込み、発注先連絡先管理、ログインアカウント管理、監査ログ、発注書下書き、発注記録、納品待ち・納品済み表示、簡易納品確認、スタッフ担当者バーコード、本部ダッシュボードまで実装済み。

現時点の到達点:

在庫を確認し、不足を見つけ、発注候補を作り、発注先ごとの発注書下書きを確認し、発注記録、納品待ち、納品済み、簡易納品確認まで記録できる状態。商品・発注先・バーコード情報を整備し、商品マスタと発注先マスタを一括取り込みでき、商品写真を1枚登録し、棚卸をセッションとして途中保存・確定・履歴確認できる。フェーズ4として、納品待ち発注の可視化、長期在庫、発注先リードタイム、ABC分析、推奨最低在庫、異常出庫検知、朝のダイジェスト通知も確認できる。

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
- 発注数量、状態、見送り理由・備考メモの変更
- 発注先ごとの発注書下書き印刷
- 発注記録、納品待ち、納品済み、納品確認、納品確認取り消し
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
- 発注先マスタCSV/Excel貼り付け一括取り込み
- 商品ごとの複数取扱発注先
- 発注先マスタ新規作成、連絡先管理
- ログインアカウント管理、監査ログ、ログイン試行制限
- 本部ダッシュボード `/admin/overview`

### フェーズ4: 在庫判断支援と通知

実装済み:

- 納品待ち発注の可視化と重複発注防止
- 長期在庫レポート `/inventory/dormant`
- 発注先ごとの平均納品日数表示
- 商品一覧と棚卸セッションでの使用頻度ABC分析
- 推奨最低在庫の参考表示
- 異常出庫検知 `/movements/anomalies`
- 組織別の異常出庫検知しきい値設定 `/admin/settings`
- 朝のダイジェスト通知設定 `/account/notifications`

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
- 発注先へのメール送信
- 朝のダイジェスト以外のメール通知
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

通常のローカル開発では `.env.local` はローカルDocker DB用にしておく。Supabase PostgreSQLの接続文字列は `.env.local` に直接置かず、必要な場合だけ `.env.supabase.local` に分けて保存する。

```text
.env.local
  ローカル開発用。DATABASE_URL は localhost のDocker DBを指す。

.env.supabase.local
  Supabase DBスキーマ反映用。DATABASE_URL はSupabase PostgreSQLを指す。
  DBスキーマ反映だけならStorage系の値は不要。
  Gitには含めない。
```

Prisma ClientとDBスキーマを準備する。

```powershell
corepack pnpm prisma:generate
corepack pnpm db:push
corepack pnpm db:seed
```

既存の開発DBを初期化せず、クリニック共通アカウントと管理者個人アカウントだけを整える場合は次を実行する。

```powershell
corepack pnpm db:upsert-demo-accounts
```

開発サーバーを起動する。

```powershell
corepack pnpm dev
```

## 8. 開発確認用ログイン

```text
クリニック1共通
email: test@example.com
password: password

クリニック2共通
email: clinic2@example.com
password: password

管理者個人
email: admin@example.com
password: password
```

これは開発確認用のテストアカウントである。クリニック共通アカウントは一般ユーザーとして日常業務を確認し、管理画面は管理者個人アカウントで確認する。
スタッフ配布用マニュアルには、この情報を直接書かない。

## 9. 複数クリニック運用の基本方針

5クリニック1法人のような導入では、アプリの入口URLは共通にする。

```text
https://example.vercel.app/login
```

クリニックごとにログインアカウントとパスワードを分ける。通常スタッフは、自分のクリニック用の共通アカウントでログインし、自院の在庫を扱う。クリニック共通アカウントにはADMIN権限を持たせない。

本部担当者や管理者は、個人ごとのADMINアカウントでログインし、`/admin/overview` の本部ダッシュボードで同一組織内のクリニック状況を横断確認する。

現時点の本部ダッシュボード:

- 読み取り専用
- 同一組織内の有効クリニックだけを集計
- クリニック別の商品数、不足在庫数、在庫0件数、発注候補数、期限ロット要確認数、最終入出庫日時を表示
- クリニック名から、クリニック別の在庫詳細へ移動
- クリニック別詳細では、商品ごとの現在庫、最低在庫、不足数、発注先、保管場所、期限ロット要確認を表示
- クリニック別詳細から、不足在庫、発注候補、入出庫履歴の読み取り専用確認へ移動
- 期間指定で、法人合計とクリニック別の商品ごとの使用個数CSVを出力
- 在庫編集、発注候補編集、履歴取り消し、棚卸確定は行わない

今後の予定:

- クリニック別詳細に、直近棚卸、期限ロット、発注済み後の納品状況などをさらに足すか検討する
- 横断画面から直接編集する場合は、対象クリニック名を明確に表示し、誤操作防止を追加してから扱う

この段階では、複数クリニック切替UIを全画面に広げず、本部ダッシュボードを横断確認の入口として扱う。

## 10. よく使う確認コマンド

```powershell
corepack pnpm typecheck
corepack pnpm build
```

開発DBを初期seed状態に戻す場合:

```powershell
corepack pnpm db:seed
```

## 11. DBと開発環境の注意

- 開発DBは検証操作によりseed直後から変化していることがある
- 初期状態に戻す場合は `corepack pnpm db:seed` を使う
- Prisma Client生成時に、Next.js開発サーバーがPrisma DLLを掴んでEPERMになることがある
- EPERMが出た場合は、このプロジェクトのNext.js関連Nodeプロセスだけを停止してから `corepack pnpm prisma:generate` を再実行する
- Codex本体や `node_repl` のNodeプロセスは停止しない
- 確認用に `corepack pnpm dev` を起動した場合は、確認後に停止する
- 棚卸セッション関連のDBスキーマ反映には `corepack pnpm db:push` が必要
- Docker DesktopやPostgreSQLが停止している場合、`db:push` とブラウザでの棚卸セッション確認はできない
- Supabase DBへスキーマだけ反映する場合は `.env.local` を書き換えず、`scripts/push-supabase-schema.ps1` を使う
- Supabase DBに対して `corepack pnpm db:seed` は不用意に実行しない。既存データを初期化する可能性がある

## 12. セキュリティとデータの注意

- APIキー、パスワード、トークンをコードに保存しない
- 実在の患者情報を入れない
- 実在クリニック名を入れない
- 実在会社名や秘密情報をテストデータとして入れない
- 備考欄、理由メモ、発注候補メモにも個人情報を書かない
- バーコードは商品識別子として扱い、患者情報や秘密情報を入れない
- 公開デモや本番候補環境でも、実在製品データ、実在クリニック名、患者情報、秘密情報をseedやテスト固定値に入れない
- Vercel、Supabase、GitHubの管理画面スクリーンショットを共有する場合は、接続文字列、パスワード、トークン、メール認証情報を隠す
- 商品写真は `SUPABASE_STORAGE_BUCKET` 設定時にSupabase Storageへ保存し、未設定のローカル開発では `data/local/uploads/products/` へ保存する

## 13. 公開デモ環境

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
DEMO_CLINIC2_LOGIN_EMAIL
DEMO_CLINIC2_LOGIN_PASSWORD
DEMO_CLINIC2_USER_NAME
DEMO_ADMIN_EMAIL
DEMO_ADMIN_PASSWORD
DEMO_ADMIN_USER_NAME
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
/products/import/purchase-history
/products/import/purchase-history/setup
/suppliers
/suppliers/new
/suppliers/import
/barcode
/stocktake/sessions
/account/password
/admin/overview
/admin/users
/admin/audit-logs
```

商品写真は `SUPABASE_STORAGE_BUCKET` 設定時にSupabase Storageへ保存する。公開デモでも、サービスロールキーとprivate bucketを使うため、秘密値はGitやチャットに書かない。

### Supabase DBスキーマ反映

コード変更でPrisma schemaが変わった場合、公開デモまたは本番候補のSupabase DBにもスキーマ反映が必要になる。

`.env.local` はローカル開発用のまま維持し、Supabase用の接続文字列は `.env.supabase.local` に保存する。

`.env.supabase.local` には、スキーマ反映用の `DATABASE_URL` だけを置けばよい。

```text
DATABASE_URL="Supabase PostgreSQLの接続文字列"
```

```powershell
cd C:\Dev\dental-materials-inventory
.\scripts\push-supabase-schema.ps1
```

このスクリプトは `.env.supabase.local` の `DATABASE_URL` を一時的に現在のPowerShellプロセスへ読み込み、`corepack pnpm db:push` だけを実行する。実行後はPowerShellプロセスの `DATABASE_URL` を元に戻す。

実行結果に次の表示が出た場合は、Supabase DBの形は現在のPrisma schemaと一致している。

```text
The database is already in sync with the Prisma schema.
```

ローカルでは表示できるのに公開環境で `/products/import` などが `This page couldn’t load` になる場合、Supabase DBに新しいカラムが未反映のことがある。今回の購入履歴インポート関連では、特に `ProductImportHistory.clinicId`、`ProductImportHistory.dealerNames`、`Product.importSource` が必要になる。

スキーマ反映後に確認する画面:

```text
/products/import
/products/import/purchase-history
/products/import/purchase-history/setup
```

過去の暫定実装で、商品備考に旧マーカー `[purchase-history-import]` だけが残っている公開DBの場合は、スキーマ反映後にバックフィル対象を確認する。

```powershell
corepack pnpm exec tsx scripts/backfill-purchase-history-import-source.ts --dry-run
```

`Dry run: 0 product(s) would be marked as PURCHASE_HISTORY.` と出た場合、バックフィル本実行は不要。対象件数が出た場合だけ、接続先DBが正しいことを確認してから本実行する。

注意:

- `.env.supabase.local` は秘密値を含むためGitに入れない
- `db:push` はテーブルやカラムなどDBの形を反映する
- `db:seed` は初期データ投入・リセット用なので、公開デモや本番候補DBには不用意に実行しない
- Vercelの環境変数を変更した場合はRedeployが必要
- GitHubへpushした後、Vercelが最新コミットでデプロイ済みか確認する
- 写真アップロード用の `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` はアプリ実行時の設定。Vercel上のアップロード確認だけでよい場合、ローカルの `.env.local` に入れる必要はない

### 朝のダイジェスト通知

朝のダイジェスト通知を有効にする場合は、Vercelの環境変数に次を設定する。

```text
NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=ResendのAPIキー
NOTIFICATION_EMAIL_FROM=送信元メールアドレス
CRON_SECRET=Cronエンドポイント保護用のランダム文字列
APP_BASE_URL=https://公開URL
```

ローカル開発では `NOTIFICATIONS_ENABLED=false` のままにし、実メール送信を抑止する。

公開デモのVercel Hobby環境では、Vercel Cron は `vercel.json` で `/api/notifications/daily-digest` をUTC 22:00、日本時間7:00に1日1回呼び出す。Vercel Pro以上へ移行した場合は、30分ごとに呼び出し、ユーザーの通知設定にあるJSTの配信時刻と曜日が一致した場合だけ送信する構成に戻せる。

通知本文には、不足在庫、期限ロット、納品待ち、長期在庫、異常出庫検知の件数とリンクだけを含める。金額、患者情報、個人情報、APIキーは含めない。

## 14. 本番導入を考える場合

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

## 15. 次に進めやすい候補

1. 公開デモURLで主要画面を一通り確認する
2. 本番導入時の料金・契約・サポート範囲を整理する
3. クリニック別詳細に、棚卸状況や納品状況を追加するか検討する
4. 初期導入用の在庫行追加フローを整理する
5. 発注予定、納品待ち、納品済みのフローを実運用に近いデータで確認する
6. 不足していない在庫を、まとめ買い・予備補充などで発注候補へ追加する導線を検討する
7. 在庫変更履歴や画面表示の時刻が日本時間で揃っているか確認する
8. クリック操作やボタン操作で在庫変更する時に、スタッフ担当者を選べる導線を検討する
9. 発注候補や発注書下書きをディーラー別に印刷しやすくする導線を検討する
10. バーコードスキャナー到着後の実機確認
11. 発注候補を発注書単位にまとめるワークフロー
12. 発注先CSVエクスポートや取り込み履歴を検討する

外部発注送信、発注先へのメール送信、アプリ内PDF生成、発注書親テーブル、分納管理は、業務ルールが固まってから扱う。朝のダイジェスト通知に限り、Resend APIを使うメール送信基盤を用意している。
