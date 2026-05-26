# 公開デモ環境セットアップメモ

この文書は、一般歯科材料在庫管理システムを外出先で見せるための公開デモ手順をまとめる。

本番運用ではなく、評価、共有、画面確認用の安全な公開デモを目的にする。

## 1. 全体構成

推奨構成:

```text
GitHub
  コードを置く場所

Vercel
  Next.jsアプリを公開する場所

Supabase PostgreSQL
  デモ用データベースを置く場所
```

ローカル開発で使うDocker/PostgreSQLは、公開デモでは使わない。公開デモではVercelからSupabase PostgreSQLへ接続する。

## 2. 安全ルール

- 認証なし公開にはしない
- 実在製品データ、患者情報、実在クリニック名、実在会社名、秘密情報を入れない
- Supabaseの接続文字列、DBパスワード、`AUTH_SECRET`、`SUPABASE_SERVICE_ROLE_KEY` はチャット、Git、ドキュメントに貼らない
- `.env`、`.env.local`、`data/local/`、`data/local/uploads/` はGitに含めない
- 外部発注送信、メール送信、発注書PDF生成、納品確認は追加しない
- 商品写真はSupabase Storageのprivate bucketへ保存し、公開デモでも永続保存対象として扱う

## 3. 必要なアカウント

- GitHub
- Vercel
- Supabase

GitHubには、このプロジェクトのリポジトリを作成する。  
VercelはGitHubリポジトリをimportしてデプロイする。  
SupabaseはPostgreSQLデータベースとして使う。

## 4. Vercelに設定する環境変数

Vercelの `Project Settings -> Environment Variables` に、少なくとも次を設定する。

```text
DATABASE_URL=Supabase PostgreSQLの接続文字列
AUTH_SECRET=32文字以上のランダムな秘密文字列
AUTH_URL=https://Vercelで発行された公開URL
DEMO_LOGIN_EMAIL=デモ用ログインメール
DEMO_LOGIN_PASSWORD=デモ用ログインパスワード
DEMO_USER_NAME=デモ用ユーザー表示名
SUPABASE_URL=SupabaseプロジェクトURL
SUPABASE_SERVICE_ROLE_KEY=Supabaseサービスロールキー
SUPABASE_STORAGE_BUCKET=商品写真用private bucket名
```

補足:

- `DATABASE_URL` は `postgresql://` で始まる接続文字列を使う
- `AUTH_SECRET` は認証用の秘密値であり、Gitには書かない
- `AUTH_URL` は公開URLが決まってから設定し、Redeployする
- `DEMO_LOGIN_PASSWORD` はコード、README、チャットに平文で固定しない
- production buildの公開ログイン画面では、開発用の `test@example.com / password` を初期表示しない
- SupabaseのDBパスワードをリセットした場合は、Vercel側の `DATABASE_URL` も新しいパスワード入りURLに入れ替える
- `SUPABASE_SERVICE_ROLE_KEY` は商品写真のサーバー側保存・取得に使う秘密値で、Git、README、チャットに書かない
- `SUPABASE_STORAGE_BUCKET` はprivate bucketとして作成する。例: `product-photos`

## 5. Supabase DBの初期化

Supabaseの接続文字列はチャットに貼らず、ローカルの `.env.local` に一時的に設定する。

例:

```powershell
DATABASE_URL="Supabase PostgreSQLの接続文字列"
AUTH_SECRET="ローカル確認用のランダム文字列"
AUTH_URL="http://localhost:3000"
DEMO_LOGIN_EMAIL="デモ用メール"
DEMO_LOGIN_PASSWORD="デモ用パスワード"
DEMO_USER_NAME="デモ用ユーザー名"
```

そのうえで、ローカルPCからDB初期化を実行する。

```powershell
chcp 65001
corepack pnpm prisma:generate
corepack pnpm db:push
corepack pnpm db:seed
```

注意:

- `db:seed` はデモDBを初期seed状態に戻すため、既存データを消して入れ直す
- 実データが入った本番DBに対して不用意に `db:seed` を実行しない
- SupabaseのDBパスワードをリセットした直後は、反映まで数分かかる場合がある
- `db:push` がSupabase接続で不安定な場合は、作業ログを確認し、代替手順を慎重に検討する
- WindowsのPowerShellやCMDから日本語を含むseedを実行する場合は、先に `chcp 65001` を実行し、UTF-8として扱われる状態で `db:seed` を実行する

### 既存デモユーザー名の文字化け復旧

公開デモ上で操作者名やログイン中ユーザー名が文字化けした場合は、Supabase Studioで `users` テーブルの `name` を確認する。

壊れた値が入っている場合は、対象のデモ用メールアドレスを確認したうえで、SQL Editorから次のように表示名だけを更新する。

```sql
update users
set name = 'テストユーザー'
where email = 'デモ用ログインメール';
```

注意:

- SQL内のメールアドレスには、Vercel環境変数 `DEMO_LOGIN_EMAIL` と同じデモ用メールを入れる
- デモ用パスワード、Supabase接続文字列、`AUTH_SECRET` はSQLやドキュメントに書かない
- Vercelの `DEMO_USER_NAME` も `テストユーザー` として再設定し、文字化けした値を残さない
- 環境変数を変更した後は、Vercelの `Deployments` からRedeployする

## 6. Vercelデプロイ手順

1. GitHubにこのプロジェクト用リポジトリを作る
2. プロジェクトをGitHubへpushする
3. Vercelで `New Project` を選ぶ
4. GitHubリポジトリをimportする
5. Framework Presetは `Next.js` を選ぶ
6. Environment Variablesに必要な値を設定する
7. `Deploy` を実行する
8. 公開URLが決まったら、Vercelの `AUTH_URL` を公開URLに合わせる
9. `AUTH_URL` や `DATABASE_URL` を変更した場合は、必ずRedeployする

Vercelのインストール時には `postinstall` で `prisma generate` を実行する。DBスキーマ反映やseed投入は、Vercelビルドでは自動実行しない。

### 最新コミットを公開デモへ反映する手順

公開デモで新しい画面が404になる場合は、ローカル実装がVercelへ反映されていない可能性がある。次の順に確認する。

1. ローカルで `git status` を確認し、必要な変更がコミット済みか確認する
2. `git log -1 --oneline` で最新コミットを確認する
3. GitHubのmainブランチに同じコミットがpush済みか確認する
4. Vercelの対象プロジェクトで、GitHub mainブランチへのpush時に自動デプロイされる設定になっているか確認する
5. Vercelの `Deployments` で最新デプロイのコミットIDと日時を確認する
6. 最新コミットが反映されていなければ、GitHubへpushしたうえでVercelの再デプロイを実行する
7. DBスキーマやseedが変わっている場合は、Supabase DBに対して `corepack pnpm db:push` と `corepack pnpm db:seed` を実行する
8. 再デプロイ後、公開URLで `/barcode/stock` が404ではなく表示されることを確認する

`/barcode/stock` はバーコード出入庫画面であり、公開デモの主要確認対象に含める。

## 7. 商品写真のSupabase Storage有効化手順

商品写真はVercelのローカルディスクではなく、Supabase Storageのprivate bucketへ保存する。秘密値そのものはGit、README、チャット、dev-logに書かない。

1. SupabaseダッシュボードでStorageを開く
2. 商品写真用のprivate bucketを作成する。例: `product-photos`
3. bucketをpublicにしない。anon keyから直接ダウンロードできない設定にする
4. Vercelの `Project Settings -> Environment Variables` に次を設定する
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
5. `SUPABASE_STORAGE_BUCKET` には作成したprivate bucket名を入れる。例: `product-photos`
6. 環境変数設定後、Vercelの `Deployments` からRedeployする
7. 公開URLでログインし、商品編集画面から写真をアップロードする
8. 商品詳細とよく使う商品カードで写真が表示されることを確認する
9. 同じ商品で別の写真に上書きし、新しい写真が表示されることを確認する
10. 写真を削除し、「写真なし」表示に戻ることを確認する
11. 未ログイン状態で `/api/product-photos/[productId]` にアクセスし、401または403で拒否されることを確認する
12. 再デプロイ後も同じ商品の写真が表示されることを確認する

ローカル開発では、`SUPABASE_STORAGE_BUCKET` を未設定にすると従来通り `data/local/uploads/products/` へ保存する。Supabase実バケット検証をローカルで行う場合は、`.env.local` に上記3変数を設定してから `corepack pnpm dev` を起動する。

## 8. 公開後の確認

公開URLで次を確認する。

1. `/login` が表示される
2. ログイン画面に開発用の `test@example.com / password` が初期表示されていない
3. デモ用ログインでログインできる
4. `/home` が表示される
5. `/inventory`、`/shortage`、`/orders`、`/products`、`/products/new`、`/barcode`、`/barcode/stock`、`/stocktake/sessions` が表示できる
6. バーコード読み取りだけでは在庫数、発注候補、在庫変更履歴が変わらない
7. 商品写真アップロード、上書き、削除が公開デモで動作し、再デプロイ後も写真が表示される
8. 画面やエラーにDB接続文字列、DBパスワード、`AUTH_SECRET` が表示されない

## 9. よくある詰まりポイント

### Vercelで環境変数を変えたのに反映されない

環境変数を変更しても、既存デプロイには自動反映されない。`Deployments` からRedeployする。

### Supabaseに接続できない

次を確認する。

- `DATABASE_URL` の `[YOUR-PASSWORD]` が実際のDBパスワードに置き換わっているか
- パスワードの角括弧 `[` `]` を残していないか
- SupabaseのDBパスワードリセット直後ではないか
- Vercel側の `DATABASE_URL` も新しいパスワード入りURLに入れ替えたか

### ログイン後にエラーになる

次を確認する。

- Supabase DBにスキーマが作成されているか
- `corepack pnpm db:seed` が成功しているか
- Vercelの `DATABASE_URL` が正しいか
- `AUTH_URL` が公開URLと一致しているか

## 10. 残るリスク

- 商品写真の永続化はSupabase Storageのprivate bucket設定とVercel環境変数に依存する
- Supabase Freeには利用制限や停止条件があるため、長期運用前にはプラン確認が必要
- デモログイン情報を広く共有すると、誰でもデモDBを操作できる
- 現時点では管理者向けのデモDBリセット画面はない
- 本番運用では、バックアップ、監視、障害対応、権限管理、契約条件を別途設計する

## 11. 本番化時の考え方

公開デモは、本番導入そのものではない。本番導入では、少なくとも次を検討する。

- Vercel Pro以上
- Supabase Pro以上
- 独自ドメイン
- 本番DBと検証DBの分離
- バックアップと復旧手順
- スタッフごとのアカウントと権限
- 商品写真ストレージの容量、バックアップ、運用監視
- 実在データ投入時の確認手順
- サポート範囲、料金、契約条件
