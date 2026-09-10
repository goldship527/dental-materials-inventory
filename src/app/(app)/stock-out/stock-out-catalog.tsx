"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { issueStockCardAction, type CardIssueResult } from "@/lib/actions/card-issue";
import { cardIssueBlockReason, cardStockUnit, filterStockOutCards, type StockOutCard } from "@/lib/stock/card-issue";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";
import { IssueInstructions } from "@/components/domain/issue-instructions";

const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const buttonStyle = `min-h-12 rounded-lg border border-muted bg-panel px-4 text-base font-semibold text-ink hover:border-accent hover:bg-subtle active:bg-subtle ${focusStyle}`;
const primaryStyle = `min-h-12 rounded-lg bg-accent px-4 text-base font-semibold text-panel hover:bg-accentDeep active:bg-accentDeep disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted ${focusStyle}`;
const categoryButtonStyle = `min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-muted bg-panel px-3 text-sm font-semibold text-ink hover:border-accent hover:bg-subtle active:bg-subtle ${focusStyle}`;
const selectedCategoryButtonStyle = `min-h-10 shrink-0 whitespace-nowrap rounded-lg bg-accent px-3 text-sm font-semibold text-panel hover:bg-accentDeep active:bg-accentDeep ${focusStyle}`;

function StockPhoto({card}: {card: StockOutCard}) {
  const [failed, setFailed] = useState(false);
  const url = buildProductPhotoUrl({id: card.productId, photoUpdatedAt: card.photoUpdatedAt});
  const sizeClass = "h-16 w-16";
  return url && !failed ? <img src={url} alt="" loading="lazy" width={96} height={96} onError={() => setFailed(true)} className={`${sizeClass} shrink-0 rounded-lg border border-line bg-panel object-contain`} /> :
    <span aria-hidden="true" className={`grid ${sizeClass} shrink-0 place-items-center rounded-lg border border-line bg-subtle text-ink`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" /></svg>
    </span>;
}

function IssueDialog({card, staffOperators, selectedStaffOperatorId, selectStaffOperator, onClose}: {
  card: StockOutCard; staffOperators: StaffOperatorOption[]; selectedStaffOperatorId: string;
  selectStaffOperator: (id: string) => void; onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [quantity, setQuantity] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CardIssueResult | null>(null);
  const titleId = useId();
  const unit = cardStockUnit(card.orderUnit)!;
  const number = Number(quantity);
  const valid = Number.isSafeInteger(number) && number > 0 && number <= Math.min(card.quantity, 9999);
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; element.close(); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || result || !confirmed || !valid || !selectedStaffOperatorId) return;
    busy.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      setResult(await issueStockCardAction(data));
    } catch {
      setResult({status: "error", message: "通信結果を確認できませんでした。履歴と最新の在庫を確認し、重複して出庫しないようにしてください。"});
    } finally {
      setPending(false);
      busy.current = false;
      router.refresh();
    }
  }
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-panel p-0 text-ink shadow-panel backdrop:bg-ink/50">
    <form onSubmit={submit} className="grid gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-sm text-muted">出庫内容の確認</p><h2 id={titleId} className="mt-1 break-words text-xl font-semibold">{card.name}</h2></div>
        <button type="button" aria-label="出庫確認を閉じる" onClick={onClose} disabled={pending} className={`${buttonStyle} shrink-0 disabled:cursor-not-allowed`}>閉じる</button>
      </div>
      {card.specification && <p className="break-words text-sm text-muted">{card.specification}</p>}
      {result ? <div role={result.status === "error" ? "alert" : "status"} className="grid gap-4">
        <p className={`text-base font-semibold ${result.status === "success" ? "text-success" : "text-danger"}`}>{result.message}</p>
        <button type="button" className={primaryStyle} onClick={onClose}>{result.status === "success" ? "一覧へ戻る" : "一覧を確認する"}</button>
        {result.status === "error" && <a href="/movements" className={`inline-flex min-h-12 items-center justify-center underline ${focusStyle}`}>入出庫履歴を確認する</a>}
      </div> : <>
        <input type="hidden" name="stockItemId" value={card.stockItemId} />
        <input type="hidden" name="expectedQuantity" value={card.quantity} />
        <input type="hidden" name="expectedUpdatedAt" value={card.stockUpdatedAt} />
        <input type="hidden" name="expectedUnit" value={unit} />
        <label className="grid gap-1 text-sm font-semibold">作業スタッフ
          <select name="staffOperatorId" required disabled={pending} value={selectedStaffOperatorId} onChange={event => selectStaffOperator(event.target.value)} className={`h-12 rounded-lg border border-muted bg-panel px-3 text-base ${focusStyle}`}>
            <option value="">選択してください</option>{staffOperators.map(staff => <option key={staff.id} value={staff.id}>{staff.displayName}</option>)}
          </select>
        </label>
        <div className="rounded-lg bg-subtle p-3 text-base">現在庫 <strong className="text-2xl tabular-nums">{card.quantity}</strong> {unit} ／ 基準 {card.minStock}{unit}</div>
        <IssueInstructions text={card.issueHint} />
        <div><label htmlFor={`${titleId}-quantity`} className="text-sm font-semibold">出庫数（{unit}）</label>
          <div className="mt-2 grid grid-cols-[56px_1fr_56px] gap-3">
            <button type="button" className={buttonStyle} disabled={pending || number <= 1} aria-label="出庫数を1減らす" onClick={() => setQuantity(String(Math.max(1, (Number.isFinite(number) ? number : 1) - 1)))}>−</button>
            <input id={`${titleId}-quantity`} name="quantity" type="number" inputMode="numeric" min={1} max={Math.min(card.quantity, 9999)} step={1} required disabled={pending} value={quantity} onChange={event => setQuantity(event.target.value)} className={`min-w-0 rounded-lg border border-muted p-2 text-center text-2xl font-semibold tabular-nums ${focusStyle}`} />
            <button type="button" className={buttonStyle} disabled={pending || number >= Math.min(card.quantity, 9999)} aria-label="出庫数を1増やす" onClick={() => setQuantity(String(Math.min(card.quantity, 9999, (Number.isFinite(number) ? number : 0) + 1)))}>＋</button>
          </div>
        </div>
        <p aria-live="polite" className="text-base font-semibold">{valid ? `出庫後: ${card.quantity - number}${unit}` : "出庫数は現在庫以下の整数で入力してください。"}</p>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-muted p-3 text-base">
          <input name="unitConfirmed" type="checkbox" value="yes" required checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-accent" />
          <span>在庫と同じ「{unit}」単位で出します。<span className="mt-1 block text-sm">箱の中身などへの換算はしません。</span></span>
        </label>
        {!staffOperators.length && <p role="alert" className="text-sm text-danger">有効なスタッフがありません。管理者に登録を依頼してください。</p>}
        <button type="submit" disabled={pending || !valid || !confirmed || !selectedStaffOperatorId} className={primaryStyle}>{pending ? "出庫を記録中…" : `${valid ? number : "—"}${unit}を出庫`}</button>
      </>}
    </form>
  </dialog>;
}

export function StockOutCatalog({cards, clinicId, staffOperators}: {cards: StockOutCard[]; clinicId: string; staffOperators: StaffOperatorOption[]}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<StockOutCard | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const staff = useWorkStaffSelection({clinicId, staffOperators});
  const searchId = useId();
  const categories = useMemo(() => Array.from(new Set(cards.map(card => card.category || "未分類"))).sort((a, b) => a.localeCompare(b, "ja")), [cards]);
  const filtered = useMemo(() => filterStockOutCards(cards, query, category), [cards, query, category]);
  const clearFilters = () => { setQuery(""); setCategory(null); setLimit(24); };
  return <>
    <section aria-label="商品を絞り込む" className="grid gap-2 rounded-xl border border-line bg-panel p-3">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1" aria-label="カテゴリで絞り込む">
        <p className="shrink-0 text-sm font-semibold">カテゴリー</p>
        {[null, ...categories].map(value => <button key={value || "all"} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setLimit(24); }} className={category === value ? selectedCategoryButtonStyle : categoryButtonStyle}>{category === value ? "✓ " : ""}{value || "すべて"}</button>)}
      </div>
      <div className="grid gap-1">
        <label htmlFor={searchId} className="text-sm font-semibold">商品名・規格で検索</label>
        <div className="flex gap-2"><input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} placeholder="商品名やサイズを入力" className={`h-10 min-w-0 flex-1 rounded-lg border border-muted bg-panel px-3 text-base ${focusStyle}`} />
          {(query || category) && <button type="button" onClick={clearFilters} className={buttonStyle}>解除</button>}</div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted"><p role="status">{filtered.length}商品 ／ 全{cards.length}商品</p><p>担当: {staff.selectedStaffOperator?.displayName || "出庫確認時に選択"}</p></div>
    </section>
    {!filtered.length ? <section className="rounded-xl border border-line bg-panel p-6 text-center">
      <h2 className="text-lg font-semibold">{cards.length ? "条件に合う商品がありません" : "このクリニックの在庫商品はまだありません"}</h2>
      <p className="mt-2 text-base">{cards.length ? "商品名やカテゴリを変えてお試しください。" : "対象クリニックと在庫登録を確認してください。"}</p>
      {cards.length ? <button type="button" className={`${buttonStyle} mt-4`} onClick={clearFilters}>絞り込みを解除する</button> : <a href="/inventory" className="mt-4 inline-flex min-h-12 items-center underline">在庫一覧を確認する</a>}
    </section> : <section aria-label="在庫商品のカード" className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {filtered.slice(0, limit).map(card => {
        const unit = cardStockUnit(card.orderUnit);
        const blocked = cardIssueBlockReason(card);
        return <article key={card.stockItemId} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-panel p-2.5 shadow-panel">
          <div className="flex items-start gap-2"><StockPhoto card={card} /><div className="min-w-0 flex-1"><p className="text-xs text-muted">{card.category || "未分類"}</p><h2 className="break-words text-base font-semibold leading-5">{card.name}</h2>{card.specification && <p className="mt-0.5 break-words text-xs leading-4 text-muted">{card.specification}</p>}</div></div>
          <IssueInstructions text={card.issueHint} compact />
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 rounded-lg bg-subtle px-2 py-1.5"><p className="flex items-baseline gap-1"><span className="text-xs">現在庫</span><strong className="text-2xl tabular-nums">{card.quantity}</strong> <span className="text-sm">{unit || "単位未確認"}</span></p><p className="text-xs">基準 <strong className="text-base tabular-nums">{card.minStock}</strong> {unit || ""}</p></div>
          {card.quantity < card.minStock && <p className="text-xs font-semibold">{card.quantity === 0 ? "在庫切れ" : "基準在庫を下回っています"}</p>}
          {blocked ? <div className="grid gap-1"><p className="text-sm font-semibold">{blocked}</p><a href={`/products/${card.productId}`} className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-muted text-base underline ${focusStyle}`}>商品詳細を確認</a></div> :
            <button type="button" className={primaryStyle} aria-label={`${card.name}を出庫する`} onClick={event => { lastTrigger.current = event.currentTarget; setSelected(card); }}>出庫する <span className="text-sm">（{unit}単位）</span></button>}
        </article>;
      })}
    </section>}
    {filtered.length > limit && <button type="button" className={`${buttonStyle} mx-auto w-full max-w-sm`} onClick={() => setLimit(value => value + 24)}>さらに24商品を表示（残り{filtered.length - limit}商品）</button>}
    {selected && <IssueDialog card={selected} staffOperators={staffOperators} selectedStaffOperatorId={staff.selectedStaffOperatorId} selectStaffOperator={staff.selectStaffOperator} onClose={() => {
      setSelected(null);
      // Focus only after the modal is removed; the background is inert while it is open.
      requestAnimationFrame(() => lastTrigger.current?.focus());
    }} />}
  </>;
}
