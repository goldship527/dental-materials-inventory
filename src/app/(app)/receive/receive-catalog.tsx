"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { receiveOrderRequestWithStateAction, type OrderActionState } from "@/lib/actions/orders";
import { groupReceiptsByOrderDate, type ReceiptCard } from "@/lib/orders/receipt-groups";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";

const field = "min-h-12 min-w-0 rounded-lg border border-muted bg-panel px-3 text-base disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const button = `${field} font-semibold hover:bg-subtle`;
const primary = "min-h-12 rounded-lg bg-accent px-4 text-base font-semibold text-panel hover:bg-accentDeep disabled:bg-subtle disabled:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const categoryButton = "min-h-10 whitespace-nowrap rounded-lg border border-muted bg-panel px-3 text-sm font-semibold hover:border-accent hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const selectedCategoryButton = "min-h-10 whitespace-nowrap rounded-lg bg-accent px-3 text-sm font-semibold text-panel hover:bg-accentDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function ReceiptPhoto({row}: {row: ReceiptCard}) {
  const [failed, setFailed] = useState(false);
  const url = buildProductPhotoUrl({id: row.productId, photoUpdatedAt: row.photoUpdatedAt});

  return url && !failed ? <img src={url} alt="" loading="lazy" width={80} height={80} onError={() => setFailed(true)} className="h-20 w-20 shrink-0 rounded-lg border border-line bg-panel object-contain" /> :
    <span aria-hidden="true" className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-line bg-subtle text-ink">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" /></svg>
    </span>;
}

function ReceiptItem({row, staffId, onReceived}: {row: ReceiptCard; staffId: string; onReceived: (id: string) => void}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OrderActionState | null>(null);
  const busy = useRef(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || result) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await receiveOrderRequestWithStateAction({}, new FormData(event.currentTarget));
      setResult(response);
      if (response.status === "success") onReceived(row.id);
    } catch {
      setResult({status: "error", message: "通信結果を確認できません。履歴を確認してから一覧を更新してください。"});
    } finally { setPending(false); router.refresh(); }
  }
  return <article className="flex h-full min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-panel p-2 shadow-panel">
    <div className="flex items-start gap-2"><ReceiptPhoto row={row} /><div className="min-w-0 flex-1"><p className="text-xs leading-4 text-muted">{row.supplierName || "発注先未設定"} / {row.category || "未分類"}</p><h3 className="mt-0.5 whitespace-normal text-base font-semibold leading-5 [overflow-wrap:anywhere]">{row.name}</h3></div></div>
    <p className="flex items-baseline gap-1 rounded-lg bg-subtle px-2 py-1.5"><span className="text-xs">発注数</span><strong className="text-2xl tabular-nums">{row.requestedQuantity}</strong><span className="text-sm">{row.orderUnit || "単位未確認"}</span></p>
    {result ? <div role={result.status === "success" ? "status" : "alert"} className="grid gap-2"><p>{result.message}</p>{result.status !== "success" && <a className="underline" href="/movements">入出庫履歴を確認</a>}</div> : open ?
      <form onSubmit={submit} className="grid gap-2">
        <input type="hidden" name="orderRequestId" value={row.id} />
        <input type="hidden" name="staffOperatorId" value={staffId} />
        <input type="hidden" name="applyToStock" value="on" />
        <label className="grid gap-1 text-sm font-semibold">届いた数量（{row.orderUnit || "単位未確認"}）
          <input className={field} type="number" inputMode="numeric" name="receivedQuantity" min={1} max={row.requestedQuantity} step={1} defaultValue={row.requestedQuantity} required disabled={pending} />
        </label>
        <details><summary className="cursor-pointer py-3 text-sm underline">ロット・期限・メモ</summary><div className="grid gap-3">
          <label className="grid gap-1 text-sm">ロット番号<input className={field} name="receivedLotNumber" maxLength={120} disabled={pending} /></label>
          <label className="grid gap-1 text-sm">有効期限<input className={field} type="date" name="receivedExpiryDate" disabled={pending} /></label>
          <label className="grid gap-1 text-sm">メモ<input className={field} name="receivedMemo" maxLength={200} disabled={pending} /></label>
        </div></details>
        <p className="text-sm">届いた数量を在庫に追加します。残りは納品待ちに残ります。</p>
        <button className={primary} disabled={pending || !staffId || !row.orderUnit} type="submit">{pending ? "記録中…" : "納品を確定"}</button>
        <button className={button} disabled={pending} type="button" onClick={() => setOpen(false)}>閉じる</button>
      </form> : <button className={`${primary} mt-auto`} onClick={() => setOpen(true)}>届いた商品を確認</button>}
    {!row.orderUnit && <p className="text-sm font-semibold">単位を確認してから納品してください。</p>}
  </article>;
}

export function ReceiveCatalog({rows, clinicId, staffOperators}: {rows: ReceiptCard[]; clinicId: string; staffOperators: StaffOperatorOption[]}) {
  const staff = useWorkStaffSelection({clinicId, staffOperators});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [received, setReceived] = useState<string[]>([]);
  const remaining = useMemo(() => rows.filter(row => !received.includes(row.id)), [rows, received]);
  const categories = useMemo(() => [...new Set(remaining.map(row => row.category || "未分類"))].sort((a,b) => a.localeCompare(b,"ja")), [remaining]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.normalize("NFKC").toLowerCase();
    return remaining.filter(row => (!category || (row.category || "未分類") === category) && `${row.name} ${row.supplierName || ""}`.normalize("NFKC").toLowerCase().includes(normalizedQuery));
  }, [remaining, category, query]);
  const groups = useMemo(() => groupReceiptsByOrderDate(filtered), [filtered]);
  return <>
    <section aria-label="納品待ち商品を絞り込む" className="grid gap-2 rounded-xl border border-line bg-panel p-3">
      <div className="grid gap-1.5" aria-label="カテゴリで絞り込む">
        <p className="text-sm font-semibold">カテゴリー</p>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {["", ...categories].map(value => <button key={value || "all"} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={category === value ? selectedCategoryButton : categoryButton}>{category === value ? "✓ " : ""}{value || "すべて"}</button>)}
        </div>
      </div>
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm font-semibold">商品・発注先を検索<input className={field} type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted"><p role="status">{filtered.length}商品 ／ 全{remaining.length}商品</p><p>担当: {staff.selectedStaffOperator?.displayName || "画面上部で選択"}</p></div>
    </section>
    {received.length > 0 && <p role="status" className="font-semibold text-success">{received.length}商品の納品を記録しました。</p>}
    {!staff.selectedStaffOperatorId && groups.length > 0 && <p role="status" className="rounded-lg border border-accent bg-subtle px-3 py-2 text-base font-semibold">
      画面上部で作業スタッフを選ぶと、納品を確定できるようになります。
    </p>}
    {!groups.length && <div className="rounded-xl border border-line bg-panel p-6"><p>{remaining.length ? "条件に合う商品がありません。" : "納品待ちの商品はありません。"}</p>{remaining.length > 0 && <button className={`${button} mt-3`} onClick={() => {setQuery(""); setCategory("");}}>絞り込みを解除</button>}</div>}
    {groups.map(([day, items]) => <section key={day} className="grid gap-2"><h2 className="text-lg font-semibold">{day} 発注 <span className="text-sm font-normal">／ {items.length}商品</span></h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{items.map(row => <ReceiptItem key={row.id} row={row} staffId={staff.selectedStaffOperatorId} onReceived={id => setReceived(ids => [...ids,id])} />)}</div></section>)}
  </>;
}
