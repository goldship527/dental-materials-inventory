# Codex指示書: 発注画面の小修正 — 保存後の案内・発注先1社・納品確認の取り消し（spec §101）

作成: 2026-10-11 Claude Code（立案層）
状態: 利用者決定済み（「3点直したい」）。Codexの実装待ち。

## 0. 背景と目的

- 2026-10-10にClaude CodeがPreviewで実操作テストを行い、3点の改善候補を見つけた（`docs/codex-handoff-orders-steps.md` §7.4）。利用者が3点とも直すと決めた。
- 正本:
  - 仕様: `docs/spec.md` §101
  - 見た目のルール: `docs/design.md` §5.5（2026-10-11の追記）
- 画面だけの変更。サーバー側の処理・DB・状態の遷移は変えない。食い違ったら仕様を優先し、止めて報告する。

## 1. 現状（コードで確認済み、`master` の `195631d`）

| # | 内容 | 場所 |
|---|---|---|
| A | 行の `key` に数量・メモ・発注記録・受領の値を含めている。保存すると行が作り直され、`useActionState` の成功の案内文が消える。状態が変わる操作では、行が別の枠へ移る | `src/app/(app)/orders/page.tsx` の `OrderRequestTableRow` の `key`、`order-request-row.tsx` の `activeState.message` |
| B | `canChangeSupplier` は `supplierOptions.length > 0` で判定している。選択肢が1社だけでも「発注先を変更」が出る | `order-request-row.tsx` |
| C | 「納品確認を取り消す」は押すとすぐ `revertOrderReceiptWithStateAction` を送信する | `order-request-row.tsx` の `receiptRevertAction` のフォーム |

## 2. 実装指示

### 2.1 ブランチ

- ブランチ `ui/orders-feedback` は Claude Code が `master`（`195631d`）から作成済み。作業ツリーにある文書の変更（`docs/spec.md` §101、`docs/design.md`、本書、`docs/dev-log.md` の朝礼反映）を、最初のコミットに含める。
- 未追跡の `.playwright-cli/`、`docs/codex-handoff-barcode-batch-mode.md`、`output/` は無関係。コミットしない。

### 2.2 操作の結果の表示（§101.1）

1. 新しいクライアント部品 `src/app/(app)/orders/order-notice.tsx` を作る。
   - `OrderNoticeProvider`（子要素を包む）と `useOrderNotice()`（`show(message: string)` を返す）を持つ。
   - 表示は spec §101.1 のとおり。
     - `position: fixed`、下から16px、中央、幅 `min(480px, calc(100vw - 32px))`
     - 白、`border-line`、左に `success` の4pxの線、墨14px、頭に「✓ 」
     - 「閉じる」（下線付きの文字、40px）
     - 6秒で消える。次の `show` で置き換え、タイマーを掛け直す。
     - `role="status"`・`aria-live="polite"`、`print:hidden`。影は付けない。
   - 色はトークンだけ。新しい色を足さない。
2. `page.tsx` で、発注一覧（`groupedRows` の描画部分）を `OrderNoticeProvider` で包む。サーバー部品のままでよい（Providerだけがクライアント部品）。
3. `order-request-row.tsx` の各 `useActionState` に渡すアクションを、クライアント側の小さな関数で包む。
   - 包む関数は、元のServer Actionを呼んで結果を受け取り、`status === "success"` で `message` があれば `show(message)` を呼んでから、結果をそのまま返す。
   - 対象は数量・発注先・状態・納品確認・納品確認の取り消しの5つ。
   - 理由: 行は保存の直後に作り直される（または別の枠へ移る）ため、行の中の `useEffect` では案内を出せない。包む関数なら、行が消える前に行の外のProviderへ渡せる。
4. 行の中の案内文（`activeState.message` の表示）は、失敗（`status !== "success"`）のときだけ出す。成功は下端の表示だけにする。
5. 行の `key` は変えない（保存後にフォームの初期値を新しい値へ戻すため）。

### 2.3 発注先が1社だけのとき（§101.2）

- `canChangeSupplier` を次の式にする。
  - `(row.status === "SUGGESTED" || printableOrderRequestStatuses.includes(row.status)) && (row.supplierOptions.length >= 2 || (!row.supplierId && row.supplierOptions.length >= 1))`

### 2.4 納品確認の取り消しに確認を挟む（§101.3）

- 「その他」の「納品確認を取り消す」は、送信ボタンではなく、確認を開くボタン（`type="button"`）にする。
- 押すと、同じパネル内に次を出す。
  - 文「納品確認を取り消します。在庫へ反映していた場合は、在庫数も元に戻ります。」（`text-sm text-ink`）
  - 「取り消す」: 現行の `receiptRevertAction` のフォームの送信ボタン。`btn-secondary btn-danger`、40px。送信中は「取り消し中」。
  - 「やめる」: 下線付きの文字、40px。確認を閉じ、「納品確認を取り消す」へフォーカスを戻す。
- 確認を開いたら、「取り消す」にフォーカスを移さない（誤って Enter で実行しないため）。最初のフォーカスは「やめる」に置く。

### 2.5 変えないもの

- Server Action・DB・状態の遷移・文言（成功・失敗の文言はサーバーが返すものをそのまま使う）
- 確認待ちの一括確認の案内（枠の見出しの中）
- 表・カード・印刷の並びと寸法（下端の表示は印刷に出さない）

## 3. テスト・確認

### 3.1 自動・機械検査

- `corepack pnpm typecheck`、`corepack pnpm build`、`.github/workflows/receipt-regression.yml` の既存テストが成功する。
- 変更・追加したファイルについて、次がすべて0件:
  - Tailwind既定パレットのクラス
  - HEXの直書き
  - `text-[` の任意サイズ
  - 高さ40px未満のボタン
  - `shadow-` の追加
- 計測用の生成物は `output/` に置き、コミットしない。

### 3.2 画面の確認（架空データ。公開DBには接続しない）

- 幅1024×768と390×844で、次を確認する。
  1. 数量を変える→更新: 下端に「✓ …」が出て6秒で消える。「閉じる」でも消える。
  2. メモを編集→保存、見送り、発注予定に戻す、この行だけ発注を記録: いずれも下端に成功の案内が出る（行が別の枠へ移っても出る）。
  3. 失敗の例（例: 担当者未選択で発注を記録できない状態の送信、または状態の競合）: 行の中に朱の案内が出て、下端には出ない。
  4. 発注先の選択肢が1社の行では「その他」に「発注先を変更」が無い。2社以上の行と、未設定で1社以上の行には有る。
  5. 納品済みの「その他」→「納品確認を取り消す」:
     - 確認の文と「取り消す」「やめる」が出て、すぐには実行されない。
     - 「やめる」で閉じ、フォーカスが戻る。
     - 「取り消す」で取り消され、下端に成功の案内が出る。
  6. 下端の表示がボタン（行の操作・ページ下部）を常に隠していないこと。6秒で消えること、または「閉じる」で消せることを確かめる。390pxで横はみ出し0px。
  7. 印刷プレビューに下端の表示が出ない。
- 結果を dev-log に残す。

## 4. 完了条件

- 3.1・3.2の結果が `docs/dev-log.md` にある。
- PRをドラフトで作成し、回帰CIとVercel Previewが成功している。**マージ・本番公開はしない。**
- 公開DBを使う実操作の確認は、利用者のログイン後に Claude Code が Preview で行う（元に戻せる操作に限る）。
- dev-log の末尾に朝礼反映ブロックを追記している（前回の次のアクションの引き継ぎ規則を守り、前回までの項目を落とさない）。

## 5. 実装後にClaude Codeがレビューする点

- 成功の案内が、行の作り直し・枠の移動のあとでも必ず出るか（包む関数の位置）
- 失敗の案内が行の中に残るか
- 発注先の条件式と、取り消しの2段階（最初のフォーカスが「やめる」）
- 下端の表示が操作の邪魔にならないか（スマホ幅でカードの操作ボタンに重なる時間）
