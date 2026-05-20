# 公開デモ環境セットアップメモ

この文書は、一般歯科材料在庫管理システムを外出先で見せるためのデモ公開手順をまとめる。

本番運用ではなく、評価・画面確認・説明用の公開デモを目的にする。

## 1. 方針

推奨構成:

```text
Vercel: Next.js アプリ本体
Supabase: PostgreSQL データベース
GitHub: Vercel にコードを渡すリポジトリ
```

ローカル開発で使う Docker / PostgreSQL は、公開デモでは使わない。公開デモでは、Vercel から Supabase PostgreSQL へ接続する。

## 2. 安全ルール

- 認証なし公開にはしない
- 実在製品データ、患者情報、実在クリニック名、実在会社名、秘密情報を入れない
- Supabase の接続文字列、DBパスワード、`AUTH_SECRET` はチャット、Git、ドキュメントに貼らない
- `.env`、`.env.local`、`data/local/`、`data/local/uploads/` は Git に含めない
- 外部発注送信、メール送信、発注書PDF生成、納品確認は追加しない
- 商品写真は現状ローカルファイル保存のため、公開デモでは永続保存対象として扱わない

## 3. 必要なアカウント

- GitHub
- Vercel
- Supabase

Supabase プロジェクトは作成済みで、接続文字列をコピーできている前提にする。

## 4. Vercel に設定する環境変数

Vercel の Project Settings -> Environment Variables で、少なくとも次を設定する。

```text
DATABASE_URL=Supabase の PostgreSQL 接続文字列
AUTH_SECRET=32文字以上のランダムな秘密文字列
AUTH_URL=https://Vercelで発行されたURL
DEMO_LOGIN_EMAIL=デモ用ログインメール
DEMO_LOGIN_PASSWORD=デモ用ログインパスワード
DEMO_USER_NAME=デモ用ユーザー表示名
```

補足:

- `DATABASE_URL` は `postgresql://` で始まる接続文字列を使う
- `AUTH_SECRET` は Vercel やローカルの秘密情報として扱い、Git に書かない
- Auth.js v5 では `AUTH_SECRET` が必須。Vercel ではホスト推定が効くが、公開URLが決まったら `AUTH_URL` も設定しておく
- `DEMO_LOGIN_PASSWORD` はデモ共有用であっても、コードやREADMEに平文で固定しない

## 5. Supabase DB 初期化

Supabase の接続文字列はチャットに貼らず、ローカルの `.env` または `.env.local` に一時的に設定する。

```powershell
DATABASE_URL="Supabase の接続文字列"
AUTH_SECRET="ローカル確認用のランダム文字列"
AUTH_URL="http://localhost:3000"
DEMO_LOGIN_EMAIL="デモ用メール"
DEMO_LOGIN_PASSWORD="デモ用パスワード"
DEMO_USER_NAME="デモ用ユーザー名"
```

そのうえで、次を順番に実行する。

```powershell
corepack pnpm prisma:generate
corepack pnpm db:push
corepack pnpm db:seed
```

注意:

- `db:seed` は既存データを削除して、架空の初期データを入れ直す
- デモDBはリセット可能な前提で扱う
- 実データが入ったDBに対して `db:seed` を実行しない

## 6. Vercel デプロイ手順

1. GitHub にこのプロジェクト用リポジトリを作る
2. プロジェクトを GitHub に push する
3. Vercel で New Project を選ぶ
4. GitHub リポジトリを import する
5. Framework Preset は Next.js を選ぶ
6. Environment Variables に `DATABASE_URL`、`AUTH_SECRET`、必要なデモログイン変数を設定する
7. Deploy を実行する
8. 公開URLが決まったら、Vercel の `AUTH_URL` を公開URLに合わせて設定し、再デプロイする

Vercel のインストール時には `postinstall` で `prisma generate` を実行する。DBスキーマ反映やseed投入は、Vercelビルドでは自動実行しない。

## 7. 公開後の確認

公開URLで次を確認する。

1. `/login` が表示される
2. デモ用ログインでログインできる
3. `/home` が表示される
4. `/inventory`、`/shortage`、`/orders`、`/products`、`/products/new`、`/barcode`、`/stocktake/sessions` が表示できる
5. バーコード読み取りだけでは在庫数、発注候補、在庫変更履歴が変わらない
6. 商品写真アップロードは公開デモでは永続保存を期待しない
7. 画面やエラーにDB接続文字列、DBパスワード、`AUTH_SECRET` が表示されない

## 8. 残るリスク

- Vercel のサーバーレス環境では、ローカルファイル保存の写真は永続化できない
- Supabase Free は利用制限や休止条件があるため、長期運用前にはプラン確認が必要
- デモログイン情報を広く共有すると、誰でもデモDBを書き換えられる
- 現時点では管理者向けのデモDBリセット画面はない
