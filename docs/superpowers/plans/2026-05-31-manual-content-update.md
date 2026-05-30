# マニュアル内容の最新化 実装計画（第1フェーズ）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（推奨）または superpowers:executing-plans を使ってタスク単位で実行する。各ステップは `- [ ]` チェックボックスで進捗管理する。

**Goal:** `docs/user-manual.md` を現行アプリ（約50ルート）の実態に合わせて検証・修正・追記し、新規章（ロット・期限／異常出庫検知／自分の設定／管理者向け）を追加する。

**Architecture:** ルート単位で `page.tsx`・サーバーアクション・主要コンポーネントを読んで「実態メモ」を作り、対応するマニュアル章と突き合わせて修正する。本文（Markdown）のみ編集し、レンダラー（`page.tsx`）・レイアウト・画像は変更しない。

**Tech Stack:** Next.js App Router（Server Components + Server Actions）、Prisma、TypeScript。マニュアルは既存記法のみ（`#`/`##`/`###`、`-`、`1.`、`` `code` ``）。

**設計書:** `docs/superpowers/specs/2026-05-31-manual-content-update-design.md`

---

## 共通ルール（全タスク適用）

- 編集対象は `docs/user-manual.md` のみ。`src/app/(app)/manual/page.tsx` は触らない。
- 既存記法のみ使用（太字 `**` や表 `|` は使わない。レンダラー未対応のため）。
- 患者名・個人情報・秘密情報・実在クリニック名・実在会社名を書かない。
- 文体は「どの画面で何をするか」中心の平易な日本語を維持。
- 各タスクの最後に、何を直したかを `docs/dev-log.md` に追記する。
- git コミットはユーザー依頼時にまとめて行う（このプロジェクトの方針）。各タスクでは強制しない。
- 各タスクの検証ステップでは「修正後の各文がコード上の根拠（ルート/アクション）に対応しているか」を必ず確認する。憶測で書かない。

### 監査メモの書式（各タスク Step A で作る）

```
[ルート] 例: /inventory
- 画面表示項目: ...
- できる操作: ...
- 前提条件/権限: ...
- 制約・注意（在庫が変わる/変わらない 等）: ...
- 根拠ファイル: src/app/(app)/inventory/page.tsx, src/lib/actions/stock.ts
```

---

## Task 1: ホーム・在庫一覧・長期在庫レポート

**現行マニュアル章:** 「4. ホーム画面」「5. 在庫一覧」「8. 長期在庫レポート」

**Files:**
- Read: `src/app/(app)/home/page.tsx`
- Read: `src/app/(app)/inventory/page.tsx`, `src/app/(app)/inventory/inventory-adjust-cell.tsx`, `src/app/(app)/inventory/inventory-adjust-form.tsx`, `src/app/(app)/inventory/inventory-filter-form.tsx`
- Read: `src/app/(app)/inventory/dormant/page.tsx`
- Read: `src/lib/actions/stock.ts`, `src/lib/stock/status.ts`
- Read: `src/components/domain/app-nav.tsx`（メニュー項目の実体確認）
- Modify: `docs/user-manual.md`（該当章）

- [ ] **Step A: 実態メモ作成**
  上記ファイルを読み、ホーム表示カード、在庫一覧の表示列・検索/絞り込み・在庫数直接修正フロー（新数量・理由メモ・更新）、長期在庫レポートの表示列・期間切替（90/180/365日）を監査メモ書式で書き出す。
  併せて `app-nav.tsx` の実際のメニュー項目を控える（章4のメニュー一覧の検証用）。

- [ ] **Step B: 突き合わせ**
  現行マニュアル章4・5・8の各文と実態メモを照合し、ズレ（表示項目の過不足、操作手順の相違、用語の不一致）を箇条書きにする。

- [ ] **Step C: 修正**
  ズレた箇所のみ `docs/user-manual.md` を編集する。メニュー一覧（章4）が実体と異なる場合は実体に合わせる。

- [ ] **Step D: 再照合**
  修正後の章4・5・8を読み返し、各文が Step A の根拠に対応していることを確認する。記法が既存範囲内であることも確認する。

- [ ] **Step E: dev-log 追記**
  `docs/dev-log.md` に「マニュアル最新化 Task1: ホーム/在庫一覧/長期在庫 — 直した点」を3〜8行で追記する。

---

## Task 2: クイック出庫・不足一覧

**現行マニュアル章:** 「6. クイック出庫」「7. 不足一覧」

**Files:**
- Read: `src/app/(app)/quick/page.tsx`, `src/app/(app)/quick/quick-card-grid.tsx`, `src/app/(app)/quick/quick-card.tsx`
- Read: `src/app/(app)/shortage/page.tsx`, `src/app/(app)/shortage/print-button.tsx`, `src/app/(app)/shortage/shortage-order-button.tsx`
- Read: `src/lib/actions/stock.ts`（クイック出庫の記録）, `src/lib/actions/orders.ts`（不足→発注候補追加）
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  クイック出庫の `+1`/`-1` 挙動・履歴記録・理由の自動付与、不足一覧の表示列・印刷・「発注候補へ追加」導線を監査メモ書式で書き出す。

- [ ] **Step B: 突き合わせ**
  章6・7と照合し、ズレを箇条書きにする（特に「印刷しても自動発注されない」等の注意書きが実態と一致するか）。

- [ ] **Step C: 修正**
  ズレた箇所のみ編集する。

- [ ] **Step D: 再照合**
  修正後の章6・7の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task2 の修正点を `docs/dev-log.md` に追記する。

---

## Task 3: 棚卸・履歴

**現行マニュアル章:** 「20. 棚卸」「21. 履歴」

**Files:**
- Read: `src/app/(app)/stocktake/page.tsx`, `src/app/(app)/stocktake/stocktake-form.tsx`, `src/app/(app)/stocktake/sessions/page.tsx`
- Read: `src/app/(app)/stocktake/sessions/[sessionId]/page.tsx`, `src/app/(app)/stocktake/sessions/[sessionId]/history/page.tsx`, `src/app/(app)/stocktake/sessions/new/page.tsx`（存在するもの）
- Read: `src/lib/actions/stocktake-sessions.ts`
- Read: `src/app/(app)/movements/page.tsx`, `src/app/(app)/movements/movement-filter-form.tsx`, `src/app/(app)/movements/revert-movement-button.tsx`, `src/app/(app)/movements/export/route.ts`
- Read: `src/lib/actions/stock-movements.ts`
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  棚卸セッション（新規開始・部分保存・未入力のみタブ・確定で在庫更新・確定後編集不可）、バーコードスキャナー入力、セッション履歴の差異表示を監査メモにする。
  履歴の表示列・絞り込み（区分/操作元/期間/検索）・CSV出力（上限5000件）・取り消し可否（棚卸由来/納品確認由来は不可）を監査メモにする。

- [ ] **Step B: 突き合わせ**
  章20・21と照合しズレを箇条書きにする。

- [ ] **Step C: 修正**
  ズレた箇所のみ編集する。

- [ ] **Step D: 再照合**
  修正後の章20・21の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task3 の修正点を追記する。

---

## Task 4: バーコード（探索・出入庫・スキャン）

**現行マニュアル章:** 「16. バーコードで商品を探す」「17. 未登録バーコードを紐づける」「18. バーコードを直す」「19. バーコードで入庫・出庫」

**Files:**
- Read: `src/app/(app)/barcode/page.tsx`, `src/app/(app)/barcode/barcode-search-form.tsx`
- Read: `src/app/(app)/barcode/stock/page.tsx`, `src/app/(app)/barcode/stock/barcode-stock-form.tsx`, `src/app/(app)/barcode/stock/barcode-stock-staff-flow.tsx`
- Read: `src/app/(app)/barcode/scans/page.tsx`, `src/app/(app)/barcode/scans/unmatched/page.tsx`, `src/app/(app)/barcode/scans/unresolved/page.tsx`（存在するもの）
- Read: `src/lib/actions/barcodes.ts`, `src/lib/actions/barcode-stock.ts`, `src/lib/actions/barcode-scan-logs.ts`, `src/lib/barcode/`（正規化ロジック）
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  バーコード検索（全角→半角正規化、読み取りで在庫不変）、未登録バーコードの紐づけフロー、商品編集でのバーコード管理（追加/編集/種別/単位ラベル/代表指定/解除/重複禁止）、バーコード出入庫フロー（商品→担当者バーコード→入庫/出庫→数量/理由→確定、担当者照合、別クリニック応援）を監査メモにする。
  `barcode/scans` 系画面の実体（未対応バーコード一覧など）も確認し、章として不足がないか判断する。

- [ ] **Step B: 突き合わせ**
  章16〜19と照合しズレを箇条書きにする。`barcode/scans` が未記載なら追記要否を判断する。

- [ ] **Step C: 修正**
  ズレた箇所を編集。必要なら「未対応バーコードの確認」小節を追加する。

- [ ] **Step D: 再照合**
  修正後の章16〜19の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task4 の修正点を追記する。

---

## Task 5: 発注系（発注候補・発注書下書き・発注記録・納品確認）

**現行マニュアル章:** 「9. 発注候補を見る」全体

**Files:**
- Read: `src/app/(app)/orders/page.tsx`, `src/app/(app)/orders/order-request-row.tsx`, `src/app/(app)/orders/print-button.tsx`, `src/app/(app)/orders/print/page.tsx`
- Read: `src/app/(app)/order-records/page.tsx`
- Read: `src/lib/actions/orders.ts`, `src/lib/orders/status.ts`, `src/lib/orders/send-method.ts`, `src/lib/orders/print.ts`
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  発注候補の表示項目・状態（発注予定/納品待ち/納品済み/見送り）、発注数量変更（±/更新）、発注先変更の可否条件、平均納品日数（直近180日/データ不足）、メモ、発注書下書き印刷、発注記録（送付方法/メモ）、納品確認（数量上限・在庫反映チェック・取り消し条件）を監査メモにする。
  `order-records` 画面の実体を確認し、章9に小節追加が要るか判断する。

- [ ] **Step B: 突き合わせ**
  章9の各小節と照合しズレを箇条書きにする（状態遷移・取り消し条件は特に正確に）。

- [ ] **Step C: 修正**
  ズレた箇所を編集。`order-records` が独立機能なら小節を追加する。

- [ ] **Step D: 再照合**
  修正後の章9の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task5 の修正点を追記する。

---

## Task 6: 商品系（一覧・詳細・編集・新規・取込・購入履歴）

**現行マニュアル章:** 「10. 商品を見る」「11. 商品詳細」「12. 商品情報を直す」（一括登録・購入履歴含む）

**Files:**
- Read: `src/app/(app)/products/page.tsx`, `src/app/(app)/products/product-filter-form.tsx`
- Read: `src/app/(app)/products/[productId]/page.tsx`, `.../product-order-request-button.tsx`, `.../product-stock-item-create-form.tsx`
- Read: `src/app/(app)/products/[productId]/edit/page.tsx`（および edit 配下フォーム）
- Read: `src/app/(app)/products/new/page.tsx`, `.../product-create-form.tsx`
- Read: `src/app/(app)/products/import/page.tsx`, `.../product-import-form.tsx`
- Read: `src/app/(app)/products/import/purchase-history/page.tsx`, `.../purchase-history/setup/page.tsx`（存在するもの）
- Read: `src/lib/actions/products.ts`, `src/lib/actions/product-import.ts`, `src/lib/actions/purchase-history-import.ts`, `src/lib/actions/purchase-history-setup.ts`, `src/lib/actions/product-photos.ts`, `src/lib/stock/recommended-min-stock.ts`
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  商品一覧の表示列（ABCランク・推奨最低在庫・主発注先等）、商品詳細の表示項目（在庫行追加フォーム・推奨最低在庫の根拠・写真・未納内訳）、商品編集で直せる項目、写真の追加/削除、一括取込（CSV/貼付・プレビュー区分・管理者のみ）、購入履歴インポート（確認必要の扱い・整備画面）を監査メモにする。

- [ ] **Step B: 突き合わせ**
  章10〜12と照合しズレを箇条書きにする。

- [ ] **Step C: 修正**
  ズレた箇所を編集する。

- [ ] **Step D: 再照合**
  修正後の章10〜12の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task6 の修正点を追記する。

---

## Task 7: 発注先系（一覧・詳細・編集・新規・取込）

**現行マニュアル章:** 「13. 発注先を見る」「14. 発注先情報を直す」「15. 発注先をまとめて取り込む」

**Files:**
- Read: `src/app/(app)/suppliers/page.tsx`, `src/app/(app)/suppliers/supplier-filter-form.tsx`
- Read: `src/app/(app)/suppliers/[supplierId]/page.tsx`, `src/app/(app)/suppliers/[supplierId]/edit/page.tsx`（存在するもの）
- Read: `src/app/(app)/suppliers/new/page.tsx`, `.../supplier-create-form.tsx`
- Read: `src/app/(app)/suppliers/import/page.tsx`, `.../supplier-import-form.tsx`
- Read: `src/lib/actions/suppliers.ts`, `src/lib/actions/supplier-import.ts`
- Modify: `docs/user-manual.md`

- [ ] **Step A: 実態メモ作成**
  発注先一覧の表示列、詳細・編集で直せる項目、新規作成、一括取込の対応列・スキップ条件・管理者のみ、を監査メモにする。

- [ ] **Step B: 突き合わせ**
  章13〜15と照合しズレを箇条書きにする。

- [ ] **Step C: 修正**
  ズレた箇所を編集する。

- [ ] **Step D: 再照合**
  修正後の章13〜15の各文が根拠に対応することを確認する。

- [ ] **Step E: dev-log 追記**
  Task7 の修正点を追記する。

---

## Task 8: 使用期限・ロット管理（新規章）

**現行マニュアル章:** なし（新規追加）

**Files:**
- Read: `src/app/(app)/stock-lots/page.tsx`
- Read: 関連アクション（`stock-lots` から参照される `src/lib/actions/` 配下。Step A で grep して特定）
- Modify: `docs/user-manual.md`（新規「使用期限・ロット管理」章を追加）

- [ ] **Step A: 実態メモ作成**
  `stock-lots/page.tsx` を読み、表示項目（ロット・使用期限・期限切れ/期限間近の区別・数量）、できる操作（登録/編集/消込の有無）、在庫との関係を監査メモにする。参照アクションを grep（`rg "stock-lot" src/lib`）で特定して確認する。

- [ ] **Step B: 章設計**
  実態メモをもとに、新規章の小節（画面の見方／期限切れ・期限間近の意味／できること・できないこと／注意）を箇条書きで設計する。

- [ ] **Step C: 執筆**
  設計案に沿って新規章を `docs/user-manual.md` の構成案（第5部）位置に追加する。既存記法のみ使用。

- [ ] **Step D: 再照合**
  追加章の各文が Step A の根拠に対応することを確認する。実在しない機能を書いていないことを確認する。

- [ ] **Step E: dev-log 追記**
  Task8 で追加した章の概要を追記する。

---

## Task 9: 異常出庫検知（新規章）

**現行マニュアル章:** なし（章23・FAQ で名前のみ登場。専用章を追加）

**Files:**
- Read: `src/app/(app)/movements/anomalies/page.tsx`
- Read: `src/lib/actions/organization-settings.ts`（感度設定との関係）、`src/lib/actions/stock-movements.ts`（検知ロジック参照元を Step A で特定）
- Modify: `docs/user-manual.md`（新規「異常出庫検知」章を追加）

- [ ] **Step A: 実態メモ作成**
  異常出庫検知画面の表示項目・判定基準（直近24時間 等の実体を確認）・感度設定との関係・在庫は自動で変わらない点を監査メモにする。検知の実装箇所を grep（`rg -i "anomal" src/lib src/app`）で特定する。

- [ ] **Step B: 章設計**
  小節（何を見る画面か／判定の考え方／感度設定はどこで変えるか／在庫は変わらない注意）を設計する。

- [ ] **Step C: 執筆**
  新規章を第6部位置に追加する。既存の章23/FAQ の異常出庫検知への言及と矛盾しないようにする。

- [ ] **Step D: 再照合**
  追加章の各文が根拠に対応し、章23/FAQ と整合することを確認する。

- [ ] **Step E: dev-log 追記**
  Task9 の概要を追記する。

---

## Task 10: 自分の設定（通知設定・パスワード変更）

**現行マニュアル章:** なし（通知は FAQ で言及のみ。新規章を追加）

**Files:**
- Read: `src/app/(app)/account/notifications/page.tsx`, `.../notification-preference-form.tsx`
- Read: `src/app/(app)/account/password/page.tsx`, `.../password-form.tsx`
- Read: `src/lib/actions/notification-preferences.ts`, `src/lib/actions/account.ts`, `src/lib/notifications/preferences.ts`, `src/lib/notifications/daily-digest.ts`
- Modify: `docs/user-manual.md`（新規「自分の設定」章を追加）

- [ ] **Step A: 実態メモ作成**
  通知設定（朝のダイジェストの内容・通知先＝登録ログインメール・ON/OFF や時刻設定の有無）、パスワード変更フロー（現パスワード確認の有無）を監査メモにする。

- [ ] **Step B: 章設計**
  小節（通知設定の見方と変え方／ダイジェストに入る・入らないもの／パスワード変更手順）を設計する。

- [ ] **Step C: 執筆**
  新規章を第7部位置に追加する。FAQ の「朝のダイジェスト通知」記述と整合させる。

- [ ] **Step D: 再照合**
  追加章の各文が根拠に対応し、FAQ と整合することを確認する。

- [ ] **Step E: dev-log 追記**
  Task10 の概要を追記する。

---

## Task 11: 管理者向け（新規・集約章）

**現行マニュアル章:** 本部ダッシュボードは章22に有り。その他（ユーザー管理・組織設定・スタッフ担当者/ラベル・監査ログ・ストレージ・初期セットアップ）を「管理者向け」章として集約。

**Files:**
- Read: `src/app/(app)/admin/users/page.tsx`, `.../user-management.tsx`, `src/lib/actions/admin-users.ts`
- Read: `src/app/(app)/admin/settings/page.tsx`, `.../organization-settings-form.tsx`, `src/lib/actions/organization-settings.ts`
- Read: `src/app/(app)/admin/staff-operators/page.tsx`, `.../staff-operator-management.tsx`, `src/app/(app)/admin/staff-operators/labels/page.tsx`, `src/lib/actions/staff-operators.ts`
- Read: `src/app/(app)/admin/audit-logs/page.tsx`, `src/lib/audit/audit-log.ts`
- Read: `src/app/(app)/admin/storage/page.tsx`, `src/lib/storage/`（参照分）
- Read: `src/app/(app)/admin/overview/page.tsx` および配下 `[clinicId]`（`movements`/`orders`/`shortage`）, `usage-export`（章22の検証）
- Read: `src/app/(app)/setup/page.tsx`, `src/lib/actions/session.ts`
- Modify: `docs/user-manual.md`（「管理者向け」章を集約・新設、章22の本部ダッシュボードを統合または隣接配置）

- [ ] **Step A: 実態メモ作成（ユーザー管理・組織設定・担当者/ラベル）**
  ユーザー管理（追加/権限/クリニック紐づけ）、組織設定（異常出庫感度ほか実在項目）、スタッフ担当者管理とバーコードラベル印刷を監査メモにする。

- [ ] **Step B: 実態メモ作成（監査ログ・ストレージ・本部ダッシュボード・セットアップ）**
  監査ログの表示・絞り込み、ストレージ画面の用途、本部ダッシュボード（章22の現記述の検証）、初期セットアップ画面の役割を監査メモにする。

- [ ] **Step C: 章設計**
  「管理者向け」章の小節構成を設計する。章22（本部ダッシュボード）を本章へ統合するか隣接させるかを決め、重複を避ける。

- [ ] **Step D: 執筆**
  「管理者向け」章を第8部位置に追加し、章22の内容を整理して取り込む。各機能の「管理者のみ」前提を明記する。

- [ ] **Step E: 再照合**
  追加・統合した各文が根拠に対応することを確認する。章22由来の記述に重複・矛盾がないことを確認する。

- [ ] **Step F: dev-log 追記**
  Task11 の概要を追記する。

---

## Task 12: 全体再構成と整合・最終通し確認

**目的:** 第1〜9部の並びを構成案に合わせ、横断章（迷ったとき早見表／やってはいけないこと／FAQ）を新規章と整合させ、全体を通し確認する。

**Files:**
- Modify: `docs/user-manual.md`（章番号の振り直し・部の見出し・横断章の更新）
- Read（最終確認用）: `src/app/(app)/manual/page.tsx`（レンダラーが対応する記法の最終確認）

- [ ] **Step A: 章順の再構成**
  設計書の構成案（第1〜9部）に沿って章を並べ替え、章番号を振り直す。部の区切りは既存の `##` 見出しの範囲で表現する（新記法は足さない）。

- [ ] **Step B: 横断章の整合**
  「迷ったとき早見表」「やってはいけないこと」「FAQ」を、Task8〜11 で追加した新機能（ロット・期限／異常出庫検知／通知設定／管理者向け）と矛盾しないよう更新する。早見表に新章への導線を追加する。

- [ ] **Step C: レンダラー整合の最終確認**
  `manual/page.tsx` のパーサーが扱う記法（`#`/`##`/`###`、`- `、`1. `、`` `code` ``）だけで全文が書かれていることを目視確認する。`**` や表 `|`、画像 `![]()` が混入していないことを確認する。

- [ ] **Step D: 通し確認**
  `docs/user-manual.md` を先頭から通読し、(1) 章番号の連番、(2) 重複記述、(3) 個人情報・秘密情報の不在、(4) 古い「未対応」記述の残存、を確認して直す。

- [ ] **Step E: dev-log 追記とまとめ**
  `docs/dev-log.md` に第1フェーズ完了の総括（追加章・主な修正・残課題）を追記する。

- [ ] **Step F: 表示確認（任意）**
  可能なら `corepack pnpm dev` で `/manual` を開き、崩れがないか確認する。難しければ Step C の目視確認で代替する。

---

## Self-Review（計画作成者による確認結果）

- **Spec coverage:** 設計書の監査グループ1〜7はそれぞれ Task1〜7・8・9・10・11 に対応。新規章（ロット/期限=Task8、異常出庫=Task9、自分の設定=Task10、管理者向け=Task11）を網羅。構成案の再編と横断章整合は Task12。受け入れ基準（全ルート確認・新規章・既存記法・個人情報なし・dev-log 記録）はいずれかの Task でカバー済み。
- **Placeholder scan:** 各タスクは読むファイルの正確なパスと、修正対象章・検証手順を明示。実際の本文は監査結果から導くため、プロセスを具体化して placeholder を回避。
- **Type/用語 consistency:** 状態名（発注予定/納品待ち/納品済み/見送り）、画面名はマニュアル現行表記に統一。新規章名は構成案の部名と一致。
```
