# Codex指示書: 納品確定トランザクション期限切れ修正の回帰確認

作成: 2026-10-07（立案: Claude Code / 実装: Codex）

## 0. 位置づけと範囲

- 2026-10-07 に本番の納品確定（3個発注・2個納品）で、Prisma の対話型トランザクションが既定5秒で期限切れになった。
- 原因と修正は `docs/dev-log.md` の「2026-10-07 納品確定時のトランザクション期限切れを修正」を参照。修正はローカル未コミットで、次の2ファイルだけ。
  - `src/lib/actions/orders.ts`（`resolveActiveStaffOperatorForContext` に `db` 引数を追加し、`applyOrderReceiptLine` から `tx` を渡す）
  - `src/lib/db/staff-operators.ts`（`findActiveStaffOperatorByIdForClinic` に `db` 引数を追加）
- 本指示書の目的は、**この修正が本番と同じ接続数1の条件で正しく動くことを、隔離テストDBで証明する**こと。
- 段階: T3（既存プロジェクトのバグ修正とテスト）。本番DB・公開環境には触れない。

### 今回やること

1. 作業ブランチの用意（下記 §1）
2. テストDB接続先の安全確認（§2）
3. 接続数1を固定した回帰テストの追加（§3）
4. 既存テスト・型チェック・ビルドの実行（§4）
5. 結果の dev-log 記録（§6）

### 今回やらないこと

- 修正ロジックそのものの変更（レビュー済み。テストで問題が出た場合だけ、原因を報告して止まる）
- エラー文言の日本語置換（`toActionError` の汎用化）。別判断のため含めない
- 部分納品取り消し時の繰越残り、発注数量変更の状態制約（次工程②で扱う）
- 一括納品のタイムアウト明示（バーコード画面再開時に判断）
- DBスキーマ変更、`db:push`（テスト用スキーマの初期化を除く）、本番DB操作、Vercel操作
- `git commit` / `git push` / PR 作成（ユーザーの明示承認後に行う）

## 1. 作業ブランチ

- 現在の修正は `docs/standup-status-20260921` ブランチ上の未コミット変更である。
- 次のファイルはユーザーの作業として保持し、変更・削除・ステージしない: `.playwright-cli/`、`docs/codex-handoff-barcode-batch-mode.md`
- 未コミット変更を保持したまま、`master` を起点とする作業ブランチ `fix/receipt-tx-timeout` へ移る。
  - 移る前に `git status` と `git log -1 master` を確認し、`docs/standup-status-20260921` に `master` 未反映のコミットがある場合は、その扱いをユーザーに確認してから進む。
  - `git stash` / `git reset` / `git checkout --` で変更を失う操作はしない。不明な場合は止まって報告する。

## 2. テストDB接続先の安全確認（必須・テスト実行前）

`tests/helpers/db.ts` は `process.env.DATABASE_URL`（なければ `.env`）の接続先で、`schema=barcode_scan_logs_test` を `prisma db push --force-reset` により作り直す。接続先サーバーが公開DBの場合、そのサーバー上のスキーマを初期化してしまう。

1. Docker Desktop と `docker compose` のPostgreSQLが起動していることを確認する。
2. 接続文字列の値を表示せずに、ローカルかどうかだけを確認する（プロジェクトルートで実行）。

```powershell
node -e "const t=require('fs').readFileSync('.env','utf8');const m=t.match(/^DATABASE_URL=(.+)$/m);const h=new URL(m[1].trim().replace(/^\"|\"$/g,'')).hostname;console.log('local:',['localhost','127.0.0.1'].includes(h),'env上書き:',!!process.env.DATABASE_URL)"
```

3. **`local: true` かつ `env上書き: false` の場合だけ** §3 以降へ進む。それ以外は実行せず、結果を報告して止まる。
4. 接続文字列・パスワードをログ、dev-log、チャットへ出力しない。

## 3. 回帰テストの追加

### 3.1 背景（なぜ既存テストで再現しないか）

- `src/lib/db/prisma.ts` は `NODE_ENV=production` のときだけ `connection_limit=1` を付ける。
- テストは `NODE_ENV=test` のため接続プールが複数になり、修正前のコードでも既存テストは通ってしまう。
- そこで、テスト内で `DATABASE_URL` に `connection_limit=1` を明示してから Prisma Client を読み込む。

### 3.2 新規ファイル

`tests/order-receipt-single-connection.test.ts`

- 既存テスト（`tests/order-receipt.test.ts`、`tests/barcode-batch-order-receive.test.ts`）と同じ書き方にする: `resetTestDatabase()` → 動的 `import` → `main()` → 失敗時 `process.exit(1)`。
- `resetTestDatabase()` の**後**、`../src/lib/db/prisma` を import する**前**に、次で接続数を1に固定する。

```ts
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set("connection_limit", "1");
process.env.DATABASE_URL = url.toString();
```

- データは架空のみ（組織・クリニック・商品・スタッフ名は `Single Connection ...` 等）。実在の名称を使わない。

### 3.3 テストケース

| # | 内容 | 期待結果 |
|---|---|---|
| T0 | 対照確認: `prisma.$transaction(async () => { await prisma.staffOperator.findFirst(); }, { timeout: 1500, maxWait: 1500 })`（トランザクション内で共有クライアントを使う） | **失敗する**（エラー種別は問わない）。この環境で接続数1の制約が実際に効いていることの証明。成功してしまう場合はテスト環境が前提を満たしていないので、以降を信用せず報告する |
| T1 | 通常納品: 発注3個（`ORDERED`・未受領）、在庫行あり、有効スタッフで `receiveOrderRequestForContext`（`receivedQuantity: 2`、`applyToStock: true`） | 成功。在庫 +2。元発注は `receivedQuantity=2`・`receivedAt` あり・`receivedByStaffId` 一致。不足分の新規 `OrderRequest` が1件（`ORDERED`・未受領・`requestedQuantity=1`・同じ発注先）。`ORDER_RECEIPT` の入庫履歴が1件（`quantity=2`、`performedByStaffId` 一致） |
| T2 | 二重確定: T1 と同じ発注IDで再度 `receiveOrderRequestForContext` | 「すでに納品確認済み」で拒否。在庫・履歴件数・不足分発注件数が T1 後から変わらない |
| T3 | 無効スタッフ: 別クリニックのみに所属するスタッフ、または `isActive=false` のスタッフで納品 | 「このクリニックで有効な作業スタッフ」のエラーで拒否。在庫・発注・履歴に変化なし（tx経由でもスタッフ検証が効くこと） |
| T4 | 一括納品: 納品待ち2件（例: 3個→2個受領、2個→2個受領）を `batchOrderReceiveForContext` で1回確定 | 成功。`processedCount=2`。在庫が合計 +4。不足分の新規発注は1件（1個）だけ。入庫履歴2件 |
| T5 | 所要時間: T1・T4 の各呼び出し時間を計測してログ出力 | いずれも 5,000ms 未満。値を dev-log に記録する |

- T4 の `context`・`lines`（`barcode` 等の必須項目）の組み立ては、`tests/barcode-batch-order-receive.test.ts` の既存の書き方に合わせる。
- T1〜T5 では `$transaction` の `timeout` を変更しない（本番と同じ既定5秒で確認する）。
- 既存の関数シグネチャは変更しない。テストのための本番コード変更は不可。

### 3.4 実行

```powershell
corepack pnpm exec tsx tests/order-receipt-single-connection.test.ts
```

## 4. 既存確認

すべて §2 の安全確認を通過した同じシェルで実行する。

```powershell
corepack pnpm exec tsx tests/order-receipt.test.ts
corepack pnpm exec tsx tests/barcode-batch-order-receive.test.ts
node --import tsx --test tests/card-issue.test.ts
corepack pnpm typecheck
corepack pnpm build
git diff --check
```

- 失敗した場合は修正せずに、失敗したテスト名と出力（秘密値を除く）を報告して止まる。

## 5. 完了条件

- §2 の確認結果が `local: true` / `env上書き: false` である。
- T0 が「失敗する」、T1〜T5 がすべて期待どおり。
- §4 がすべて成功。
- 変更ファイルは、既存の修正2ファイル、新規テスト1ファイル、`docs/dev-log.md` だけ（`git status` で確認）。

## 6. 記録

`docs/dev-log.md` 末尾に作業記録と「朝礼反映」ブロックを追記する（既存ブロックは書き換えない）。

- 完了欄: 本指示書の項目を `済:` で、確認方法（実行コマンドと件数、T5 の所要時間）付きで書く。
- 次のアクション: 「ユーザー承認後、`fix/receipt-tx-timeout` をコミット・push し、PR と Vercel Preview を確認する（Preview では納品確定を行わない）」「本番反映後、該当の納品待ち発注（3個）を1回だけ確定し、在庫+2・元発注の受領2・不足分1件の納品待ち・入庫履歴1件を確認する」。
- 承認・確認待ち: コミット・公開の承認、エラー文言の日本語置換を同じPRに含めるか。

## 7. 本番での事後確認（参考・Codexは実行しない）

公開前に、本番の該当発注が次の状態であること（エラー時に書き込みが発生していないこと）を利用者が画面で確認する。

1. `/receive` に対象カードが発注数3で1枚だけあり、不足分1のカードがない。
2. 商品詳細の現在庫がエラー前と同じ。
3. `/movements` にその商品の「納品」履歴がない。
4. `/orders` の納品待ちに同商品が3個で1行だけある。
