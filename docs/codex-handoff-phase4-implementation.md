# Codex 向けハンドオフ: フェーズ4 院内在庫管理の無駄削減 — 実装計画

最終更新: 2026-05-26
ハンドオフ元: Claude（仕様策定担当）
受け取り側: Codex（実装担当）

プロジェクトルート: `C:\Dev\dental-materials-inventory`
正式表示名: 一般歯科材料在庫管理システム
パッケージマネージャ: pnpm（`corepack pnpm` 経由）
このドキュメントの絶対パス: `C:\Dev\dental-materials-inventory\docs\codex-handoff-phase4-implementation.md`

このハンドオフ内のファイル参照は、断りがない限りプロジェクトルートからの相対パスです。
（例: `docs/spec.md` は `C:\Dev\dental-materials-inventory\docs\spec.md` を指します）

---

## 0. このドキュメントの位置づけ

販売前の差別化軸「院内在庫管理の無駄をなくす」を実現するための、フェーズ4実装計画です。
全体方針と機能候補は `docs/codex-handoff-waste-reduction.md` に記載済み。
このドキュメントは、その中から実装対象に決まった **S-1, S-3, S-4, S-5, S-6, S-7, S-10** の実装ハンドオフです。

実装する:
- S-1 適正在庫レコメンド（推奨 minStock 表示）
- S-3 死蔵在庫レポート（90日出庫なし）
- S-4 発注済可視化（重複発注防止）
- S-5 リードタイム学習（発注先別平均納品日数）
- S-6 ABC分析（使用頻度ランク）
- S-7 異常出庫検知
- S-10 朝のダイジェスト通知

実装しない（今フェーズ）:
- S-2 期限切れ予防 / FIFO 出庫支援（次フェーズ候補）
- S-8 月次「無駄削減金額」ダッシュボード（S-1〜S-7 完了後に S-8 を載せる構造）
- S-9 商品マスタ重複検知（運用負荷の確認後）

---

## 1. 実装前の読み込み

1. `CLAUDE.md` / `AGENTS.md`
2. `docs/spec.md` 0.1、0.2、各画面、74節
3. `docs/dev-log.md`（直近の購入履歴インポート関連）
4. `docs/codex-handoff-waste-reduction.md`（全体方針）
5. `README.md`

`C:\Users\topro\Dropbox\Ts context vault\04_Projects\AI_Dev\context-index.md` も必要に応じて参照。
vault 全体は読まないこと。

---

## 2. 全体方針

### 2.1 守るべき制約（仕様 0.1 と 74.10 より）

- 在庫数は人が確定する。レコメンド・アラートは「表示のみ、採用は人」
- 機密情報（患者名、個人情報、APIキー、実在医院名）は扱わない
- 単価・購入履歴は組織機密。組織外には表示しない
- 集計はログインユーザーの `organizationId` と `clinicId` に必ず絞る
- 在庫変更系操作は `stock_movements` に履歴を残す（今フェーズで在庫を直接変える機能は無いはず）
- 監査ログ対象は `src/lib/audit/audit-log.ts` の `auditActions` に追加し `tx.auditLog.create` で記録

### 2.2 フェーズ分割

| フェーズ | 機能 | 主な変更 | DBスキーマ | 推定工数 |
|---|---|---|---|---|
| 4-A | S-4 発注済可視化 | UI + 集計関数 | 不要 | 1〜2週 |
| 4-B | S-3 死蔵在庫レポート | 新規ページ + 集計 | 不要 | 1〜2週 |
| 4-C | S-5 リードタイム学習 | 集計関数 | 不要 | 1週 |
| 4-D | S-6 ABC分析 | 集計関数 + UI | 不要 | 1週 |
| 4-E | S-1 推奨 minStock | 集計関数 + UI（S-5, S-6 と集計層を共有） | 不要 | 2週 |
| 4-F | S-7 異常出庫検知 | 閾値設定モデル + 集計 + ホーム表示 | 追加あり | 2〜3週 |
| 4-G | S-10 朝のダイジェスト通知 | 通知基盤 + バッチ + 設定UI + メール送信 | 追加あり | 3〜4週 |

**着手順序**: 4-A → 4-B → 4-C → 4-D → 4-E → 4-F → 4-G
理由:
- 既存データだけで実装できるものを先に出す（4-A〜4-D）
- 4-C, 4-D の集計層を 4-E が再利用するため、4-C, 4-D を先
- 4-F は閾値設定モデルが新規なので、UI設計が固まってから
- 4-G はメール送信基盤と仕様 9 節の改訂を伴う最重量タスクなので最後

### 2.3 共通実装パターン

- 集計関数は `src/lib/stock/`, `src/lib/orders/`, `src/lib/products/` などの既存レイアウトに沿って配置
- DB集計は Prisma の `groupBy` または raw query を使う
- 数値は組織×クリニックでスコープし、別組織のデータが絶対に混入しないこと
- 計算ロジックは純粋関数として切り出してテストする
- 各フェーズ完了時に typecheck / build / 関連テスト pass を必ず確認し、`docs/dev-log.md` に記録

---

## 3. フェーズ4-A: S-4 発注済可視化

### 3.1 docs/spec.md 追記候補

```markdown
## 75. フェーズ4-A 発注済可視化と重複発注防止

フェーズ4-Aでは、未納の発注済候補を不足在庫一覧・商品一覧・商品詳細に表示し、重複発注を防ぐ。

### 75.1 目的

- 「同じ商品をすでに発注したかどうか」を在庫判断時にすぐ確認できるようにする
- 不足在庫一覧から発注候補を作る前に、未納の発注があれば警告する
- 在庫数や発注候補の状態は変えない。表示と警告だけを追加する

### 75.2 表示

- 不足在庫一覧 `/shortage` の各商品行に「発注済 N個（最終発注: YYYY-MM-DD）」を表示する
- 商品一覧 `/products` の各商品行に「発注済 N個」を表示する
- 商品詳細 `/products/[productId]` の上部に「未納の発注 N件」を表示する。発注先別の内訳も表示する
- 不足在庫一覧から発注候補に追加するボタン横で、同じ商品が既に発注済みの場合は「発注済 N個があります」と警告する

### 75.3 集計仕様

- 「未納の発注」の定義: `OrderRequest.status = "ORDERED"` かつ `OrderRequest.receivedAt = null`
- 集計対象はログインユーザーの所属組織・所属クリニック
- 数量は `OrderRequest.requestedQuantity` の合計
- 最終発注日は `OrderRequest.orderedAt` の最大値

### 75.4 今回作らないもの

- 発注済候補の状態自動更新
- 発注済候補からの自動補充
- メール送信、外部発注送信
- 発注金額の表示（重複防止には不要）
```

### 3.2 関連ファイル

| 役割 | ファイル |
|---|---|
| 不足在庫一覧 | `src/app/(app)/shortage/page.tsx` |
| 商品一覧 | `src/app/(app)/products/page.tsx` |
| 商品詳細 | `src/app/(app)/products/[productId]/page.tsx` |
| 発注関連DB | `src/lib/db/orders.ts` |
| 商品一覧DB | `src/lib/db/products.ts` |
| 新規集計 | `src/lib/db/pending-orders.ts`（新設） |

### 3.3 実装手順

1. `docs/spec.md` に 75 節を追加（上記スニペットを整える）
2. `src/lib/db/pending-orders.ts` を新設:
   - `getPendingOrdersByProduct(organizationId, clinicId)` で商品IDごとに `{ count, totalQuantity, latestOrderedAt }` を返す
   - `OrderRequest.status = "ORDERED"` AND `receivedAt = null` AND 組織×クリニック一致でフィルタ
3. `getProductMasterRows`、不足在庫取得関数、`getProductDetail` の戻り値に `pendingOrders` を追加
4. 不足在庫一覧、商品一覧、商品詳細の UI を更新
5. 不足在庫一覧の発注候補追加ボタン横の警告を追加
6. テスト:
   - `tests/pending-orders.test.ts` 新設
     - 商品IDごとの集計が正しい
     - `receivedAt` が入った発注は集計に含まれない
     - 別組織の発注は集計に含まれない
     - 別クリニックの発注は集計に含まれない
     - `status = "DRAFT"` や `"CONFIRMED"` や `"SKIPPED"` は集計に含まれない
7. `corepack pnpm typecheck` と `corepack pnpm build` を通す
8. `docs/dev-log.md` に記録

### 3.4 注意点

- 金額情報は出さない（仕様 74.10）。件数と発注日だけ
- 発注済候補のステータスや数量は変更しない（表示専用）

---

## 4. フェーズ4-B: S-3 死蔵在庫レポート

### 4.1 docs/spec.md 追記候補

```markdown
## 76. フェーズ4-B 死蔵在庫レポート

フェーズ4-Bでは、一定期間使われていない在庫を「死蔵在庫」として可視化する。

### 76.1 目的

- 過剰発注で眠っている在庫を見える化する
- 廃棄前に融通、転用、発注見直しなどの判断につなげる

### 76.2 画面

- `/inventory/dormant` を新設する
- 表示条件: 過去90日間 `StockMovement.movementType = OUT` が無く、現在の `StockItem.quantity >= 1` の商品
- 表示項目: 商品名、現在庫、最低在庫、保管場所、最終出庫日、滞留日数、滞留金額（標準価格 × 数量）
- 集計対象はログインユーザーの所属組織・所属クリニック

### 76.3 検索・絞り込み

- 商品名、商品コード、JANコード、カテゴリで検索できる
- 滞留日数（90日、180日、365日）で絞り込みできる

### 76.4 操作

- 商品詳細への導線のみ。死蔵在庫の自動廃棄や数量変更は行わない
- 仕様 74.10 に従い、金額表示は組織内のみ。外部共有しない

### 76.5 今回作らないもの

- 死蔵在庫の自動廃棄
- 他クリニックへの自動転送提案
```

### 4.2 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規ページ | `src/app/(app)/inventory/dormant/page.tsx`（新設） |
| 新規集計 | `src/lib/db/dormant-stock.ts`（新設） |
| ナビ更新 | `src/components/domain/app-nav.tsx`、ホーム画面 |

### 4.3 実装手順

1. `docs/spec.md` に 76 節を追加
2. `src/lib/db/dormant-stock.ts` を新設:
   - `getDormantStockRows(organizationId, clinicId, days = 90)`
   - 商品ごとに最終出庫日を集計し、現在の在庫が1以上のものを返す
3. 新規ページ `src/app/(app)/inventory/dormant/page.tsx` を実装
4. ホーム画面の要対応セクションに「死蔵在庫 N件」リンクを追加
5. AppNav の在庫関連メニューに導線を追加
6. テスト `tests/dormant-stock.test.ts` 新設:
   - 90日以内に出庫があれば対象外
   - 在庫0は対象外
   - 別組織・別クリニックの商品は対象外
   - 期間境界（ちょうど90日前の出庫）
7. typecheck / build / dev-log

### 4.4 注意点

- 滞留金額は組織機密。本部ダッシュボードからの参照時はクリニックスコープを確実に守る
- 集計クエリは大きな組織でも秒台で返ることを意識（最大数百商品 × `stock_movements` で集計）

---

## 5. フェーズ4-C: S-5 リードタイム学習

### 5.1 docs/spec.md 追記候補

```markdown
## 77. フェーズ4-C 発注先リードタイム学習

フェーズ4-Cでは、発注済記録と納品確認記録から、発注先ごとの平均納品リードタイムを計算し、商品詳細と発注候補に表示する。

### 77.1 計算ロジック

- 発注先ごとに、`OrderRequest.orderedAt` と `OrderRequest.receivedAt` の差（日数）を集計
- 過去180日以内の納品確認済発注を対象
- 平均、中央値、サンプル件数を保持
- サンプル件数が3件未満の発注先は「データ不足」として表示

### 77.2 表示

- 商品詳細 `/products/[productId]` の主発注先・代替発注先表示に「平均納品日数: X.X 日（直近180日、Y件）」を表示
- 発注候補一覧 `/orders` の発注先グループヘッダにも同じ値を表示

### 77.3 用途

- フェーズ4-E の推奨 minStock 計算に利用
- 利用者がディーラー選択時の判断材料にできる
```

### 5.2 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規集計 | `src/lib/db/supplier-lead-times.ts`（新設） |
| 商品詳細 | `src/app/(app)/products/[productId]/page.tsx`、`src/lib/db/products.ts` |
| 発注候補 | `src/app/(app)/orders/page.tsx`、`src/lib/db/orders.ts` |

### 5.3 実装手順

1. `docs/spec.md` に 77 節を追加
2. `src/lib/db/supplier-lead-times.ts` を新設:
   - `getSupplierLeadTimes(organizationId)` で発注先ID → `{ avgDays, medianDays, sampleCount }` を返す
3. 商品詳細と発注候補で表示
4. テスト `tests/supplier-lead-times.test.ts`:
   - `receivedAt` が null の発注は対象外
   - 180日より古い発注は対象外
   - サンプル3件未満は data not enough 扱い
   - 別組織の発注は混入しない
5. typecheck / build / dev-log

---

## 6. フェーズ4-D: S-6 ABC分析

### 6.1 docs/spec.md 追記候補

```markdown
## 78. フェーズ4-D 使用頻度ABC分析

フェーズ4-Dでは、過去90日の出庫数量に基づいて商品をA/B/Cにランク分けし、商品一覧と棚卸セッションで表示する。

### 78.1 ランク分けロジック

- 対象: ログインユーザーの所属組織×クリニックの全 active 商品
- 集計期間: 過去90日
- 集計値: `StockMovement.movementType = OUT` の数量合計
- ランク:
  - A: 出庫数量の累計上位 70% を占める商品
  - B: 累計 70〜90% を占める商品
  - C: 累計 90〜100% を占める商品
  - 出庫が無い商品は「未使用」扱いで A/B/C には含めない

### 78.2 表示

- 商品一覧 `/products` の各商品行に A/B/C/未使用 のラベル
- 棚卸セッション画面でランクを表示し、A 商品を優先的に確認できるようにする

### 78.3 用途

- マスタ整備の優先順位（A 商品のバーコード・minStock を優先整備）
- 棚卸頻度の最適化
- フェーズ4-E の推奨 minStock の信頼度判断
```

### 6.2 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規集計 | `src/lib/db/product-abc-ranks.ts`（新設） |
| 商品一覧 | `src/app/(app)/products/page.tsx`、`src/lib/db/products.ts` |
| 棚卸 | `src/app/(app)/stocktake/sessions/[sessionId]/page.tsx` |

### 6.3 実装手順

1. `docs/spec.md` に 78 節を追加
2. `src/lib/db/product-abc-ranks.ts` を新設:
   - `getProductAbcRanks(organizationId, clinicId)` で商品ID → `{ rank: "A" | "B" | "C" | "UNUSED", totalQuantity, share }` を返す
   - ロジックは純粋関数としても切り出してテストする
3. 商品一覧の戻り値型にランクを追加
4. 棚卸セッション画面で表示
5. テスト `tests/product-abc-ranks.test.ts`:
   - ランク境界の計算
   - 出庫無し商品が UNUSED になる
   - 全商品の出庫が0でも例外を出さない
   - 別組織・別クリニックの混入なし
6. typecheck / build / dev-log

---

## 7. フェーズ4-E: S-1 推奨 minStock 表示

### 7.1 docs/spec.md 追記候補

```markdown
## 79. フェーズ4-E 推奨最低在庫レコメンド

フェーズ4-Eでは、商品ごとの推奨 minStock を計算し、商品一覧・商品詳細・購入履歴登録商品の一括整備画面に表示する。
採用は人が確定する。自動更新は行わない。

### 79.1 計算ロジック

- 過去90日の出庫数量から月間平均使用数を求める: `monthlyUsage = total_out_90d / 3`
- 発注先のリードタイム日数（フェーズ4-C 由来）を `leadDays` とする。未取得時は `7` 日を仮値とする
- 安全在庫係数を `safetyFactor = 1.5` とする
- `recommendedMinStock = ceil((monthlyUsage / 30 * leadDays) * safetyFactor)`
- 出庫データが不足（過去90日で出庫0件）の場合は推奨値を出さず「データ不足」表示

### 79.2 表示

- 商品一覧の最低在庫セルに、現在値と「推奨 X」を併記
- 商品詳細の在庫情報セクションに、計算根拠（過去90日出庫合計、月間平均、リードタイム、安全在庫係数）を表示
- 購入履歴登録商品の一括整備画面で、初期値に推奨値を提示できるようにする
- 商品編集画面の `defaultMinStock` 入力欄横に推奨値を表示

### 79.3 採用

- 「推奨値で更新」ボタンを商品編集画面と一括整備画面に置く
- 採用は既存の商品更新フローと一括整備フローを使う
- 推奨値の表示自体は読み取り専用、変更は通常の編集フローに従う

### 79.4 今回作らないもの

- 自動採用
- 在庫数の自動補充
- 発注書自動生成
```

### 7.2 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規集計 | `src/lib/stock/recommended-min-stock.ts`（新設、純粋関数 + DB集計） |
| 商品一覧 | `src/app/(app)/products/page.tsx`、`src/lib/db/products.ts` |
| 商品詳細 | `src/app/(app)/products/[productId]/page.tsx` |
| 商品編集 | `src/app/(app)/products/[productId]/edit/page.tsx`、`src/lib/actions/products.ts` |
| 一括整備 | `src/app/(app)/products/import/purchase-history/setup/purchase-history-setup-form.tsx` |

### 7.3 実装手順

1. `docs/spec.md` に 79 節を追加
2. `src/lib/stock/recommended-min-stock.ts` を新設:
   - 純粋関数 `calculateRecommendedMinStock({ totalOut90d, leadDays, safetyFactor })` を分離してテスト容易にする
   - `getRecommendedMinStocks(organizationId, clinicId)` で商品ID → `{ recommended, monthlyUsage, leadDays, sampleSufficient }` を返す
3. 商品一覧の戻り値型に推奨値を追加
4. 商品詳細に計算根拠表示
5. 商品編集画面と一括整備画面に「推奨値で更新」ボタンを追加
6. テスト:
   - 計算ロジックの純粋関数テスト
   - DB集計の組織境界
   - 出庫データ不足時の挙動
7. typecheck / build / dev-log

### 7.4 注意点

- 推奨値は「参考」表示のみ。自動更新は禁止
- 計算式の各係数は spec に明記し、変更時は spec を更新する
- フェーズ4-C のリードタイムが未取得の発注先は仮値 7 日を使う旨を画面でも示す

---

## 8. フェーズ4-F: S-7 異常出庫検知

### 8.1 docs/spec.md 追記候補

```markdown
## 80. フェーズ4-F 異常出庫検知

フェーズ4-Fでは、商品ごとの直近の出庫数量が通常時より顕著に多い場合に、ホーム画面に警告を表示する。

### 80.1 検知ロジック

- 過去30日の日次平均出庫数量を `baselineDaily` とする
- 当日（最新24時間以内）の出庫数量合計を `todayQuantity` とする
- `baselineDaily * threshold <= todayQuantity` の場合に「異常」と判定
- `threshold` は組織ごとに設定可能（既定値 3.0）
- `baselineDaily` が 0.1 未満の商品は対象外（出庫実績がほぼ無い商品の誤検知を防ぐ）

### 80.2 表示

- ホーム画面の要対応セクションに「異常出庫検知 N件」を表示
- 一覧ページ `/movements/anomalies` を新設し、検知された商品と当日出庫数、平均、超過倍率、操作者を表示
- 入出庫履歴一覧から該当商品の詳細履歴に飛べる

### 80.3 設定

- 組織別の `threshold` を ADMIN が変更できる
- 設定画面: `/admin/settings`（新規）または `/admin/anomaly-detection`
- 既定 3.0、最小 1.5、最大 10.0

### 80.4 今回作らないもの

- 異常の自動取り消し
- 通知メール送信（フェーズ4-G で扱う）
- 紛失・盗難の自動判定
```

### 8.2 DBスキーマ追加

```prisma
model OrganizationSetting {
  id                          String   @id @default(cuid())
  organizationId              String   @unique
  anomalyOutThreshold         Float    @default(3.0)
  // 今後の組織別設定はこのモデルに追加していく
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
}
```

### 8.3 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規モデル | `prisma/schema.prisma` |
| 新規集計 | `src/lib/db/stock-anomalies.ts`（新設） |
| ホーム表示 | `src/app/(app)/home/page.tsx` |
| 異常一覧 | `src/app/(app)/movements/anomalies/page.tsx`（新設） |
| 設定 | `src/app/(app)/admin/settings/page.tsx`（新設）、`src/lib/actions/organization-settings.ts`（新設） |
| 監査ログ | `src/lib/audit/audit-log.ts` に `anomalyThresholdUpdate` 追加 |

### 8.4 実装手順

1. `docs/spec.md` に 80 節を追加
2. Prisma スキーマに `OrganizationSetting` を追加し、マイグレーション生成
3. `src/lib/db/stock-anomalies.ts` を新設:
   - 異常判定の純粋関数 `detectAnomalies({ baselineDaily, todayQuantity, threshold })`
   - `getAnomalies(organizationId, clinicId)` で異常リスト返却
4. 組織設定モデルを操作する Action と画面を実装
5. ホームに異常件数表示、異常一覧ページを実装
6. 設定変更を AuditLog に記録
7. テスト:
   - 検知ロジックの純粋関数テスト（境界、0div 回避）
   - 設定値の範囲チェック
   - 別組織の設定が混入しない
   - 別クリニックの出庫が混入しない
8. typecheck / build / dev-log

### 8.5 注意点

- `OrganizationSetting` の閾値変更は監査ログ対象
- 異常判定は表示専用。自動で在庫を戻したり、操作を取り消したりしない
- 「ノイズが多すぎる」「少なすぎる」のフィードバックを取りやすいよう、`threshold` 変更フォームに既定値を併記

---

## 9. フェーズ4-G: S-10 朝のダイジェスト通知

### 9.1 docs/spec.md 追記候補

```markdown
## 81. フェーズ4-G 朝のダイジェスト通知

フェーズ4-Gでは、毎朝決まった時刻に、要対応事項のサマリをメールで配信する。
仕様 9 節「現時点でまだ作らないもの」の「メール送信」項目を、本節の範囲に限って解禁する。

### 81.1 配信内容

- 不足在庫件数
- 期限切れ・期限間近ロット件数
- 未納の発注件数（フェーズ4-A 由来）
- 死蔵在庫件数（フェーズ4-B 由来）
- 異常出庫検知件数（フェーズ4-F 由来）
- 各項目から該当画面への直接リンク

### 81.2 配信時刻と対象

- 既定: 毎営業日 7:00（タイムゾーン JST）
- 受信者は ADMIN が組織別に設定する
- 通知設定オプション:
  - 配信時刻（30分単位）
  - 配信曜日（月〜日）
  - 配信対象項目のオン/オフ

### 81.3 メール送信基盤

- 当面は外部メール送信サービス（Resend / SendGrid のいずれか）を使う想定
- APIキーは環境変数で管理し、コード・仕様書・READMEには記載しない
- 送信履歴は `NotificationDelivery` モデルに記録する

### 81.4 配信トリガ

- Vercel Cron Job または Supabase Scheduled Function でバッチを起動
- バッチは組織ごとに通知設定を読み、対象時刻と一致するものに対してメール送信

### 81.5 今回作らないもの

- LINE / Slack / SMS 通知
- 個別商品のリアルタイム通知
- 患者情報を含む通知
- 在庫の自動操作

### 81.6 安全ルール

- 通知内容に金額情報は含めない
- 通知に患者情報・個人情報を絶対に含めない
- 送信先メールアドレスはユーザー登録メールに限定し、自由入力は受け付けない
```

### 9.2 DBスキーマ追加

```prisma
model NotificationPreference {
  id                  String   @id @default(cuid())
  organizationId      String
  userId              String
  channel             String   @default("EMAIL")
  isEnabled           Boolean  @default(true)
  dailyDigestTime     String   @default("07:00") // HH:mm
  dailyDigestWeekdays String   @default("MON,TUE,WED,THU,FRI") // CSV
  itemsJson           Json     // どの項目を含めるかのフラグ群
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@unique([userId, channel])
  @@index([organizationId])
}

model NotificationDelivery {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  channel         String
  status          String   // QUEUED, SENT, FAILED
  subject         String
  bodyDigestJson  Json
  attemptCount    Int      @default(0)
  lastError       String?
  scheduledFor    DateTime
  sentAt          DateTime?
  createdAt       DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([organizationId, scheduledFor])
  @@index([userId])
  @@index([status])
}
```

### 9.3 関連ファイル

| 役割 | ファイル |
|---|---|
| 新規モデル | `prisma/schema.prisma` |
| 通知設定UI | `src/app/(app)/account/notifications/page.tsx`（新設） |
| 通知設定Action | `src/lib/actions/notification-preferences.ts`（新設） |
| ダイジェスト構築 | `src/lib/notifications/daily-digest.ts`（新設） |
| メール送信 | `src/lib/notifications/email-sender.ts`（新設） |
| Cron エンドポイント | `src/app/api/notifications/daily-digest/route.ts`（新設） |
| Vercel Cron 設定 | `vercel.json`（追加） |
| 環境変数 | `.env.example`（追加。APIキーはコミットしない） |
| 監査ログ | `src/lib/audit/audit-log.ts` に通知設定変更を追加 |

### 9.4 実装手順

1. `docs/spec.md` に 81 節を追加。仕様 9 節を更新し、「メール送信は 81 節の範囲に限定して実装する」と明記
2. Prisma スキーマに `NotificationPreference` と `NotificationDelivery` を追加、マイグレーション生成
3. 通知設定の Server Action と画面を実装
4. ダイジェスト構築関数を新設。S-4, S-3, S-7 の集計を再利用
5. メール送信モジュール（Resend / SendGrid 抽象化）を実装
6. Cron エンドポイントを実装し、Vercel Cron で叩く（または Supabase Scheduled Function）
7. テスト:
   - ダイジェスト構築の組織×ユーザー境界
   - 配信時刻と曜日フィルタ
   - 失敗時のリトライ・上限
   - APIキー未設定時の安全な fallback
8. 環境変数・運用手順を `docs/project-manual.md` に追記
9. typecheck / build / dev-log

### 9.5 注意点

- メール送信のレート制限と失敗時のリトライは慎重に
- 通知本文に金額・患者情報を絶対に含めない（自動テストで文字列マッチを検証）
- ローカル開発時は実メール送信を抑止する（環境変数 `NOTIFICATIONS_ENABLED=false` 等）
- 仕様 9 節の更新は、本フェーズの最重要レビューポイント

---

## 10. 共通的に守る運用ルール

- 各フェーズ完了時に必ず実施:
  1. `corepack pnpm typecheck`
  2. `corepack pnpm build`
  3. 該当テスト pass
  4. `docs/dev-log.md` に作業記録
  5. `docs/spec.md` の該当節を最新化
  6. ユーザー向けの変更がある場合は `docs/user-manual.md` も更新
- 監査ログ対象を追加する場合は `auditActions` に追記
- 新規モデルを追加する場合は `prisma/schema.prisma` のレイアウトに沿わせる
- 集計関数は組織×クリニック境界を必ず引数で受け取る

---

## 11. 未決事項（実装着手前にユーザー確認）

これらは仕様確定が必要です。Codex は実装前にユーザーに確認してください。

- S-1: 安全在庫係数の既定値（暫定 1.5）、リードタイム未取得時の仮値（暫定 7 日）の妥当性
- S-3: 死蔵在庫の判定期間既定値（暫定 90 日）
- S-5: 平均リードタイムの計算対象期間（暫定 180 日）、サンプル件数の閾値（暫定 3 件）
- S-6: ABC ランクの累計閾値（暫定 70% / 90%）、ランク表示UIの種類（バッジ / 行ハイライト）
- S-7: 既定 threshold 3.0、最小 1.5、最大 10.0 の妥当性、baselineDaily の下限 0.1 の妥当性
- S-10: メール送信サービスの選定（Resend / SendGrid / SES のいずれか）、Cron 実行基盤の選定（Vercel Cron / Supabase Scheduled Function）

---

## 12. Codex への依頼テンプレート

以下のような依頼文を Codex に渡すと、フェーズ4-A から順に実装を進められます。

> `docs/codex-handoff-phase4-implementation.md` を読み、フェーズ4-A から順に実装してください。
> 各フェーズの完了時に `docs/spec.md` と `docs/dev-log.md` を更新し、typecheck / build / 関連テストを通してください。
> 未決事項（11節）は実装前にユーザーに確認してください。
> フェーズ4-A から 4-G まで一括では着手せず、各フェーズが完了するごとにレビューを受けてから次に進んでください。
