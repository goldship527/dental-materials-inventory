# Codex指示書: アプリの実行地域を東京（hnd1）へ移す（spec §102）

作成: 2026-10-11 Claude Code（立案層）
段階: **T4**（本番の配信設定の変更）。利用者が対策Aを承認済み（「Aを進めて、指示書まで作って」）。
状態: Codexの実装待ち。

## 0. 背景と目的

- 利用者の指摘は「ボタンを押してから反応が遅い」。
- 原因:
  - アプリの関数は米国東部（`iad1`）で実行され、DBは東京（Supabase `ap-northeast-1`）にある。
  - そのため、DBへの問い合わせのたびに太平洋を往復している。1往復あたり約0.2秒で、メモの保存1回で14往復前後ある。
  - 計測値と根拠は spec §102。
- 目的: 関数の実行地域を `hnd1`（東京）へ固定し、DBとの往復を短くする。
- 正本: `docs/spec.md` §102。食い違ったら仕様を優先し、止めて報告する。

## 1. 作業場所とブランチ

- 作業フォルダ: `C:\Dev\dental-materials-inventory-region-20261011`（git worktree）
  - 元のフォルダ `C:\Dev\dental-materials-inventory` には、別PR（#29）の承認記録が未コミットで残っている。そちらは触らない。
- ブランチ: `perf/vercel-region-hnd1`（`origin/master` の `195631d` から作成済み）
- 文書（`docs/spec.md` §102、本書、`docs/dev-log.md` の朝礼反映）は、このブランチの最初のコミットに入っていて、GitHubへpush済み。このブランチで続けて実装する。
- PR #29（`ui/orders-feedback`、spec §101）が先にmasterへ入った場合は、masterを取り込む。spec・dev-logは末尾への追記どうしなので、両方の節を残して競合を解消する。§101と§102の順序を保つ。

## 2. 変更内容

1. `vercel.json` に `"regions": ["hnd1"]` を追加する。既存の `crons` はそのまま残す。

   ```json
   {
     "regions": ["hnd1"],
     "crons": [
       {
         "path": "/api/notifications/daily-digest",
         "schedule": "0 22 * * *"
       }
     ]
   }
   ```

2. 変更はこの1ファイルだけ。アプリのコード・環境変数・DB・認証・Vercelの管理画面の設定は変更しない。
3. Vercelのプランの制限で `regions` が受け付けられない場合（ビルドやデプロイの失敗、警告）は、**回避策を試さずに止めて報告する**。管理画面での変更やプランの変更は利用者の判断になる。

## 3. 確認

### 3.1 自動

- `corepack pnpm typecheck`、`corepack pnpm build`、回帰CI（`.github/workflows/receipt-regression.yml`）が成功する。

### 3.2 Preview（Codexが行う。ログイン不要の範囲だけ）

- PRのVercel Previewのデプロイが成功する。
- PreviewのURLに匿名で `GET /login` を送り、HTTP 200と、応答ヘッダー `x-vercel-id` の2番目の地域が `hnd1` であることを確認する（例 `hnd1::hnd1::…`）。
- 未ログインの `/orders` が `/login` へ307で転送されることを確認する。
- Preview以外（本番）には何もしない。

### 3.3 ログイン後の計測（Claude Codeが行う）

- 利用者がPreviewにログインした後、Claude Codeが spec §102 の目安3項目を計測する。発注画面のメモを保存して消し、元に戻す。
- Codexは計測しない。fixtureの値で「目安達成」と書かない。

## 4. 完了条件

- 3.1・3.2の結果（`x-vercel-id` の値を含む）が `docs/dev-log.md` とPR本文にある。
- PRをドラフトで作成している。**マージ・本番公開はしない。** 本番への反映はT4のため、Claude Codeのレビューと計測、利用者の明示の公開指示を待つ。
- dev-log の末尾に朝礼反映ブロックを追記している（前回までの次のアクション・承認待ちを落とさない）。

## 5. 公開後に必要な確認（公開を指示されたときの手順の予告）

- 本番の匿名 `GET /login` が200で、`x-vercel-id` の2番目が `hnd1`。
- 翌朝7:00（日本時間）の朝のダイジェストCronが動いたことを、Vercelの管理画面のCronの記録で確認する。通知送信が無効の環境では、処理の成功だけを見る。
- 戻し方（spec §102）: `regions` を外したコミットを公開する。急ぐ場合は、Vercelの管理画面で直前のProductionへInstant Rollbackする（利用者の操作）。

## 6. 実装後にClaude Codeがレビューする点

- 差分が `vercel.json` の1行（と文書）だけか
- Previewの `x-vercel-id` が `hnd1` を示すか
- ログイン後の計測が spec §102 の目安を満たすか
