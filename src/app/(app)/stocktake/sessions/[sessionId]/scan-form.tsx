"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  commitStocktakeSessionFromClient,
  discardStocktakeSessionAction,
  skipStocktakeSessionItemAction,
  updateStocktakeSessionItemAction,
} from "@/lib/actions/stocktake-sessions";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";
import type { StocktakeSessionDetail, StocktakeSessionItemRow } from "@/lib/db/stocktake-sessions";

type StocktakeSessionScanFormProps = {
  session: StocktakeSessionDetail;
};

type StatusTab = "ALL" | "PENDING" | "COUNTED" | "SKIPPED";

const statusTabs: Array<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "すべて" },
  { id: "PENDING", label: "未入力のみ" },
  { id: "COUNTED", label: "入力済み" },
  { id: "SKIPPED", label: "スキップ" },
];

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeStatus(value: string): StatusTab {
  if (value === "COUNTED" || value === "SKIPPED") {
    return value;
  }

  return "PENDING";
}

function getDifferenceClass(diff: number | null) {
  if (diff === null || diff === 0) {
    return "font-semibold text-accent";
  }

  return diff > 0 ? "font-semibold text-accent" : "font-semibold text-danger";
}

function formatDifference(diff: number | null) {
  if (diff === null) {
    return "-";
  }

  if (diff === 0) {
    return "差異なし";
  }

  return `${diff > 0 ? "+" : ""}${diff}`;
}

function getStatusLabel(status: string) {
  if (status === "COUNTED") {
    return "入力済み";
  }

  if (status === "SKIPPED") {
    return "スキップ";
  }

  return "未入力";
}

function getRowClass(row: StocktakeSessionItemRow, highlighted: boolean) {
  if (highlighted) {
    return "bg-amber-50 align-top ring-2 ring-inset ring-amber-200";
  }

  if (row.status === "COUNTED") {
    return "bg-emerald-50/70 align-top";
  }

  if (row.status === "SKIPPED") {
    return "bg-gray-50 align-top text-muted";
  }

  return "align-top bg-white";
}

function getRowAccentClass(row: StocktakeSessionItemRow, highlighted: boolean) {
  if (highlighted) {
    return "border-l-4 border-l-amber-400";
  }

  if (row.status === "COUNTED") {
    return "border-l-4 border-l-emerald-500";
  }

  if (row.status === "SKIPPED") {
    return "border-l-4 border-l-gray-400";
  }

  return "border-l-4 border-l-transparent";
}

function getStatusBadgeClass(status: string) {
  if (status === "COUNTED") {
    return "bg-emerald-100 text-accent";
  }

  if (status === "SKIPPED") {
    return "bg-gray-200 text-muted";
  }

  return "bg-white text-muted";
}

function getAbcRankBadgeText(rank: string) {
  if (rank === "UNUSED") {
    return "過去90日出庫なし";
  }

  return `使用頻度 ${rank}`;
}

function getAbcRankBadgeClass(rank: string) {
  if (rank === "A") {
    return "border-emerald-200 bg-emerald-50 text-accent";
  }

  if (rank === "B") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (rank === "C") {
    return "border-gray-200 bg-gray-50 text-muted";
  }

  return "border-line bg-white text-muted";
}

type StocktakeItemRowProps = {
  sessionId: string;
  row: StocktakeSessionItemRow;
  editable: boolean;
  highlighted: boolean;
  registerInputRef: (itemId: string, element: HTMLInputElement | null) => void;
  onSaved: (row: StocktakeSessionItemRow, message: string) => void;
};

function StocktakeItemRow({ sessionId, row, editable, highlighted, registerInputRef, onSaved }: StocktakeItemRowProps) {
  const [draftQuantity, setDraftQuantity] = useState(row.countedQuantity === null ? "" : String(row.countedQuantity));
  const [draftMemo, setDraftMemo] = useState(row.memo ?? "");
  const [isPending, startTransition] = useTransition();
  const parsedQuantity = draftQuantity.trim() === "" ? null : Number(draftQuantity);
  const draftDiff =
    parsedQuantity === null || !Number.isInteger(parsedQuantity) || parsedQuantity < 0
      ? row.diff
      : parsedQuantity - row.expectedQuantity;

  function save() {
    if (!editable || isPending) {
      return;
    }

    if (parsedQuantity === null || !Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return;
    }

    if (row.status === "COUNTED" && row.countedQuantity === parsedQuantity && (row.memo ?? "") === draftMemo.trim()) {
      return;
    }

    startTransition(async () => {
      const result = await updateStocktakeSessionItemAction({
        sessionId,
        itemId: row.id,
        countedQuantity: parsedQuantity,
        memo: draftMemo,
      });

      if (result.status === "success" && result.item) {
        onSaved(
          {
            ...row,
            status: result.item.status,
            countedQuantity: result.item.countedQuantity,
            diff: result.item.diff,
            memo: result.item.memo,
            countedAt: result.item.countedAt,
          },
          result.message,
        );
      } else {
        onSaved(row, result.message);
      }
    });
  }

  function skip() {
    if (!editable || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await skipStocktakeSessionItemAction({
        sessionId,
        itemId: row.id,
        memo: draftMemo,
      });

      if (result.status === "success" && result.item) {
        setDraftQuantity("");
        onSaved(
          {
            ...row,
            status: result.item.status,
            countedQuantity: result.item.countedQuantity,
            diff: result.item.diff,
            memo: result.item.memo,
            countedAt: result.item.countedAt,
          },
          result.message,
        );
      } else {
        onSaved(row, result.message);
      }
    });
  }

  return (
    <tr id={`stocktake-item-${row.id}`} className={`${getRowClass(row, highlighted)} transition-colors`}>
      <td className={`border-b border-line px-4 py-3 ${getRowAccentClass(row, highlighted)}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${getAbcRankBadgeClass(row.abcRank.rank)}`}>
            {getAbcRankBadgeText(row.abcRank.rank)}
          </span>
          {row.abcRank.rank !== "UNUSED" ? (
            <span className="text-xs text-muted">90日出庫 {row.abcRank.totalQuantity}</span>
          ) : null}
        </div>
        <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
          {row.name}
        </a>
        <p className="mt-1 text-xs text-muted">
          {[row.category ?? "未分類", row.manufacturer, row.productCode ? `商品コード: ${row.productCode}` : null]
            .filter(Boolean)
            .join(" / ")}
        </p>
        {row.janCode ? <p className="mt-1 font-mono text-xs text-muted">JAN {row.janCode}</p> : null}
      </td>
      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
      <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">{row.expectedQuantity}</td>
      <td className="border-b border-line px-4 py-3 text-right">
        <input
          ref={(element) => registerInputRef(row.id, element)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draftQuantity}
          onChange={(event) => setDraftQuantity(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          disabled={!editable || isPending}
          className="h-10 w-28 rounded border border-line px-3 text-right outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-gray-50"
        />
      </td>
      <td className="border-b border-line px-4 py-3 text-right">
        <span className={getDifferenceClass(draftDiff)}>{formatDifference(draftDiff)}</span>
      </td>
      <td className="border-b border-line px-4 py-3">
        <input
          type="text"
          value={draftMemo}
          maxLength={200}
          onChange={(event) => setDraftMemo(event.target.value)}
          onBlur={save}
          disabled={!editable || isPending}
          placeholder="任意"
          className="h-10 w-44 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-gray-50"
        />
      </td>
      <td className="border-b border-line px-4 py-3 text-xs text-muted">
        <span className={`inline-flex rounded px-2 py-1 font-semibold ${getStatusBadgeClass(row.status)}`}>
          {getStatusLabel(row.status)}
        </span>
        {highlighted ? <p className="mt-1 font-semibold text-amber-700">直近操作</p> : null}
        <p className="mt-1">{formatDateTime(row.countedAt)}</p>
        {row.countedByUserName ? <p className="mt-1">{row.countedByUserName}</p> : null}
      </td>
      <td className="border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={skip}
          disabled={!editable || isPending}
          className="h-10 rounded border border-line px-4 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "保存中" : "スキップ"}
        </button>
      </td>
    </tr>
  );
}

export function StocktakeSessionScanForm({ session }: StocktakeSessionScanFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState(session.rows);
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isCommitPending, startCommitTransition] = useTransition();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const editable = session.status === "IN_PROGRESS";
  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter((value): value is string => Boolean(value)))).sort(),
    [rows],
  );
  const counts = useMemo(
    () => ({
      ALL: rows.length,
      PENDING: rows.filter((row) => row.status === "PENDING").length,
      COUNTED: rows.filter((row) => row.status === "COUNTED").length,
      SKIPPED: rows.filter((row) => row.status === "SKIPPED").length,
    }),
    [rows],
  );
  const commitSummary = useMemo(
    () => ({
      diffCount: rows.filter((row) => row.status === "COUNTED" && row.diff !== null && row.diff !== 0).length,
      pendingCount: rows.filter((row) => row.status === "PENDING").length,
      countedCount: rows.filter((row) => row.status === "COUNTED").length,
    }),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusTab !== "ALL" && normalizeStatus(row.status) !== statusTab) {
        return false;
      }

      if (category && row.category !== category) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, query, rows, statusTab]);

  function registerInputRef(itemId: string, element: HTMLInputElement | null) {
    inputRefs.current[itemId] = element;
  }

  function updateRow(nextRow: StocktakeSessionItemRow, nextMessage: string) {
    setRows((currentRows) => currentRows.map((row) => (row.id === nextRow.id ? nextRow : row)));
    setMessage(nextMessage);
    setHighlightedItemId(nextRow.id);
  }

  function commitSession() {
    if (isCommitPending) {
      return;
    }

    setCommitError(null);
    startCommitTransition(async () => {
      const result = await commitStocktakeSessionFromClient({
        sessionId: session.id,
      });

      if (result.status === "success") {
        router.push(result.redirectTo ?? `/stocktake/sessions/${session.id}/history`);
        router.refresh();
        return;
      }

      setCommitError(result.message);
    });
  }

  function handleBarcodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const analysis = analyzeBarcodeInput(barcodeInput);
    const searchValues = analysis.searchValues;

    if (searchValues.length === 0) {
      setMessage("読み取り値を確認してください。");
      return;
    }

    const matches = rows.filter((row) => row.barcodeValues.some((barcode) => searchValues.includes(barcode)));

    if (matches.length !== 1) {
      setMessage(
        matches.length === 0
          ? "該当する商品が見つかりませんでした。在庫は変更していません。"
          : "複数の商品に一致しました。商品検索で絞り込んでください。在庫は変更していません。",
      );
      return;
    }

    const matchedRow = matches[0];
    setStatusTab("ALL");
    setQuery("");
    setCategory("");
    setHighlightedItemId(matchedRow.id);
    setMessage(`${matchedRow.name} に移動しました。実在庫を入力してください。`);

    window.setTimeout(() => {
      document.getElementById(`stocktake-item-${matchedRow.id}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      inputRefs.current[matchedRow.id]?.focus();
      inputRefs.current[matchedRow.id]?.select();
    }, 80);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="sticky top-0 z-10 rounded border border-line bg-white p-4 shadow-panel">
        <form onSubmit={handleBarcodeSubmit} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm font-semibold text-muted">
            スキャナー入力
            <input
              type="search"
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              placeholder="JAN / GTIN / GS1"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="h-12 rounded border border-line px-4 font-mono text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <button
            type="submit"
            className="self-end h-12 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            商品へ移動
          </button>
        </form>
        {message ? (
          <p className="mt-3 rounded bg-gray-50 px-3 py-2 text-sm font-semibold text-muted">{message}</p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_240px]">
        <label className="grid gap-2 text-sm font-semibold text-muted">
          商品検索
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="商品名・商品コード・JANコード"
            className="h-11 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-muted">
          カテゴリ
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">すべて</option>
            {categories.map((categoryName) => (
              <option key={categoryName} value={categoryName}>
                {categoryName}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTab(tab.id)}
            className={
              statusTab === tab.id
                ? "rounded bg-ink px-4 py-2 text-sm font-semibold text-white"
                : "rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            }
          >
            {tab.label} {counts[tab.id]}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted">
            表示 {filteredRows.length} 件 / 全 {rows.length} 件。数量欄を入力して離れると自動保存します。
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCommitError(null);
                    setIsCommitModalOpen(true);
                  }}
                  className="h-10 rounded bg-ink px-4 text-xs font-semibold text-white transition hover:bg-gray-700"
                >
                  確定する
                </button>
              </>
            ) : null}
            {editable ? (
              <form
                action={discardStocktakeSessionAction}
                onSubmit={(event) => {
                  if (!window.confirm("この棚卸セッションを破棄します。入力内容は在庫へ反映されません。よろしいですか？")) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="sessionId" value={session.id} />
                <button
                  type="submit"
                  className="h-10 rounded border border-danger px-4 text-xs font-semibold text-danger transition hover:bg-red-50"
                >
                  破棄する
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs text-muted">
              <tr>
                <th className="border-b border-line px-4 py-3">商品</th>
                <th className="border-b border-line px-4 py-3">保管場所</th>
                <th className="border-b border-line px-4 py-3 text-right">システム在庫</th>
                <th className="border-b border-line px-4 py-3 text-right">実在庫</th>
                <th className="border-b border-line px-4 py-3 text-right">差異</th>
                <th className="border-b border-line px-4 py-3">メモ</th>
                <th className="border-b border-line px-4 py-3">状態</th>
                <th className="border-b border-line px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <StocktakeItemRow
                    key={row.id}
                    sessionId={session.id}
                    row={row}
                    editable={editable}
                    highlighted={highlightedItemId === row.id}
                    registerInputRef={registerInputRef}
                    onSaved={updateRow}
                  />
                ))
              ) : (
                <tr>
                  <td className="px-4 py-12 text-center text-muted" colSpan={8}>
                    条件に一致する明細はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCommitModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <section className="w-full max-w-md rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">棚卸セッションを確定しますか？</h2>
            <dl className="mt-4 grid gap-3 rounded bg-gray-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">差異あり</dt>
                <dd className="font-semibold">{commitSummary.diffCount} 件</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">未入力</dt>
                <dd className="font-semibold">{commitSummary.pendingCount} 件</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">入力済み</dt>
                <dd className="font-semibold">{commitSummary.countedCount} 件</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              未入力の商品は在庫を変更しません。確定後、このセッションは編集できません。
            </p>
            {commitError ? (
              <p className="mt-4 rounded border border-danger/30 bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
                {commitError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCommitModalOpen(false)}
                disabled={isCommitPending}
                className="h-10 rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              >
                破棄しない
              </button>
              <button
                type="button"
                onClick={commitSession}
                disabled={isCommitPending}
                className="h-10 rounded bg-ink px-4 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCommitPending ? "確定中" : "確定する"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
