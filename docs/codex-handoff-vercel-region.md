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

## 7. Claude Codeレビュー・Preview計測（2026-10-11、PR #30 head `50ee3e3`）

判定: **承認**。T4のため、マージ・本番公開は利用者の明示の指示があるまで行わない。

### 7.1 差分

- アプリの変更は `vercel.json` に `"regions": ["hnd1"]` の1行だけ。既存の `crons` は不変。
- 回帰CI・型検査・ビルド・Vercel Preview成功。

### 7.2 Preview計測（利用者のログイン後、同一タブ・同じ行。データは元に戻した）

- 関数の実行地域: 同一オリジンで `GET /login`・`/orders` を送ると、`x-vercel-id` の先頭2つは `hnd1::hnd1` だった（本番は `hnd1::iad1`）。
- `/orders` のHTML全体を3回取得した。191〜212ms、HTTP 200、ログイン後の本文を含む。
- 発注画面の「メモを保存」を4回行った（追加→削除×2）。

| 項目 | 変更前（PR #29のPreview） | 変更後 | 目安（spec §102） |
|---|---:|---:|---:|
| メモ保存: サーバーの応答の先頭まで | 2.8〜4.7秒 | 0.18〜0.30秒 | 1.0秒以下 |
| メモ保存: 画面の更新まで | 5.9〜7.7秒 | 0.35〜0.48秒 | 2.0秒以下 |
| `/orders` の読み込み | 約5.8秒（DOMContentLoaded） | HTML全体0.19〜0.21秒 | 2.0秒以下 |

- 3項目とも目安を満たした。メモは最後に空へ戻した。

### 7.3 公開の条件（利用者が指示した場合）

- PR #30 のheadが次のどちらかであり、チェックがすべて成功していて、競合がないこと。それ以外なら止めて報告する。
  - `50ee3e3dd5b9ca56ca7ccb1095aae828cd1acaea`
  - その直後に、本書だけを変更したClaude Codeのコミット（件名 `docs: approve PR 30 (handoff §7)`）が1件だけ乗ったもの。`git diff 50ee3e3 <head> --stat` が本書1ファイルだけであることを確かめる。
- PR #29 が先にmasterへ入っている場合は、masterを取り込んだ後のheadで回帰CIとPreviewが成功していることを確かめる。
  - 競合の解消は文書（spec・dev-log）の末尾追記だけに限る。`vercel.json` に競合や差分の追加が出たら止めて報告する。
- このheadに限定してマージする。DB・環境変数の変更はない。
- 公開後の確認:
  - 匿名 `GET /login` が200で、`x-vercel-id` の先頭2つが `hnd1::hnd1`
  - 未ログインの `/orders` が `/login` へ307
  - 翌朝7:00（日本時間）の朝のダイジェストCronが成功したことを、Vercelの管理画面の記録で確認する（利用者またはClaude Code）
- 公開記録は別のdocs PRで、本書§7と作業記録・朝礼反映を統合する。worktree `C:\Dev\dental-materials-inventory-region-20261011` は、公開記録の統合後に利用者の了承を得てから片付ける。
