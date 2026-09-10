"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";
import { issueStockCardAction, type CardIssueResult } from "@/lib/actions/card-issue";
import { cardIssueBlockReason, cardStockUnit, filterStockOutCards, type StockOutCard } from "@/lib/stock/card-issue";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";
import { IssueInstructions } from "@/components/domain/issue-instructions";

const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const buttonStyle = `min-h-12 rounded-lg border border-muted bg-panel px-4 text-base font-semibold text-ink hover:border-accent hover:bg-subtle active:bg-subtle disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-muted ${focusStyle}`;
const primaryStyle = `min-h-12 rounded-lg bg-accent px-4 text-base font-semibold text-panel hover:bg-accentDeep active:bg-accentDeep disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted ${focusStyle}`;
const categoryButtonStyle = `min-h-9 whitespace-nowrap rounded-lg border border-muted bg-panel px-2.5 text-xs font-semibold text-ink hover:border-accent hover:bg-subtle active:bg-subtle sm:text-sm ${focusStyle}`;
const selectedCategoryButtonStyle = `min-h-9 whitespace-nowrap rounded-lg bg-accent px-2.5 text-xs font-semibold text-panel hover:bg-accentDeep active:bg-accentDeep sm:text-sm ${focusStyle}`;

function StockPhoto({card}: {card: StockOutCard}) {
  const [failed, setFailed] = useState(false);
  const url = buildProductPhotoUrl({id: card.productId, photoUpdatedAt: card.photoUpdatedAt});
  const sizeClass = "h-20 w-20";
  return url && !failed ? <img src={url} alt="" loading="lazy" width={80} height={80} onError={() => setFailed(true)} className={`${sizeClass} shrink-0 rounded-lg border border-line bg-panel object-contain`} /> :
    <span aria-hidden="true" className={`grid ${sizeClass} shrink-0 place-items-center rounded-lg border border-line bg-subtle text-ink`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" /></svg>
    </span>;
}

function UnitDecisionGuide({card}: {card: StockOutCard}) {
  return <div className="mt-auto grid gap-1.5">
    <p className="text-sm font-semibold">単位の確認が必要です</p>
    <details className="rounded-lg border border-muted bg-subtle px-2.5 py-2 text-xs leading-5">
      <summary className="cursor-pointer font-semibold underline">単位の決め方を見る</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        <li>棚から出すときに何を「1」と数えるか（箱・袋・本・個など）を決めます。</li>
        <li>現在庫と基準数が、その同じ単位で数えられているか確認します。</li>
        <li>箱から中身を1本ずつ出す場合は、1箱の入数と開封済みの残数を現物で確認します。</li>
      </ol>
      <p className="mt-2 font-semibold">決まるまでは出庫せず、箱から本への換算も自動では行いません。</p>
    </details>
    <a href={`/products/${card.productId}/edit`} className={`inline-flex min-h-10 items-center justify-center rounded-lg border border-muted px-2 text-sm underline ${focusStyle}`}>商品設定で単位を入力</a>
  </div>;
}

function InlineIssueControl({card, selectedStaffOperatorId, onResult}: {
  card: StockOutCard;
  selectedStaffOperatorId: string;
  onResult: (result: CardIssueResult) => void;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState(false);
  const unit = cardStockUnit(card.orderUnit)!;
  const number = Number(quantity);
  const maxQuantity = Math.min(card.quantity, 9999);
  const valid = Number.isSafeInteger(number) && number > 0 && number <= maxQuantity;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !valid || !selectedStaffOperatorId) return;
    busy.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      onResult(await issueStockCardAction(data));
    } catch {
      onResult({status: "error", message: "通信結果を確認できませんでした。履歴と最新の在庫を確認し、重複して出庫しないようにしてください。"});
    } finally {
      setPending(false);
      router.refresh();
    }
  }
  return <form onSubmit={submit} className="mt-auto grid gap-1.5">
    <input type="hidden" name="stockItemId" value={card.stockItemId} />
    <input type="hidden" name="expectedQuantity" value={card.quantity} />
    <input type="hidden" name="expectedUpdatedAt" value={card.stockUpdatedAt} />
    <input type="hidden" name="expectedUnit" value={unit} />
    <input type="hidden" name="unitConfirmed" value="yes" />
    <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
    <p className="text-xs font-semibold">数量（{unit}）</p>
    <div className="grid grid-cols-[48px_minmax(64px,1fr)_48px] gap-1.5">
      <button type="button" disabled={pending || number <= 1} aria-label={`${card.name}の出庫数を1減らす`} onClick={() => setQuantity(String(Math.max(1, (Number.isFinite(number) ? number : 1) - 1)))} className={`${buttonStyle} px-0 text-xl`}>−</button>
      <input name="quantity" aria-label={`${card.name}の出庫数`} type="number" inputMode="numeric" min={1} max={maxQuantity} step={1} required disabled={pending} value={quantity} onChange={event => setQuantity(event.target.value)} className={`h-12 min-w-0 rounded-lg border border-muted bg-panel px-1 text-center text-xl font-semibold tabular-nums ${focusStyle}`} />
      <button type="button" disabled={pending || number >= maxQuantity} aria-label={`${card.name}の出庫数を1増やす`} onClick={() => setQuantity(String(Math.min(maxQuantity, (Number.isFinite(number) ? number : 0) + 1)))} className={`${buttonStyle} px-0 text-xl`}>＋</button>
    </div>
    <button type="submit" disabled={pending || !valid || !selectedStaffOperatorId} aria-label={`${card.name}を${valid ? number : "入力した数量"}${unit}出庫する`} className={`${primaryStyle} px-2`}>
      {pending ? "記録中…" : `${valid ? number : "—"}${unit}を出庫`}
    </button>
    <p aria-live="polite" className={`min-h-4 text-xs ${valid ? "text-muted" : "font-semibold text-danger"}`}>
      {!valid ? "現在庫以下の整数を入力してください" : selectedStaffOperatorId ? `出庫後 ${card.quantity - number}${unit}` : ""}
    </p>
    </form>
}

export function StockOutCatalog({cards, clinicId, staffOperators}: {cards: StockOutCard[]; clinicId: string; staffOperators: StaffOperatorOption[]}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [limit, setLimit] = useState(24);
  const [feedback, setFeedback] = useState<CardIssueResult | null>(null);
  const staff = useWorkStaffSelection({clinicId, staffOperators});
  const searchId = useId();
  const categories = useMemo(() => Array.from(new Set(cards.map(card => card.category || "未分類"))).sort((a, b) => a.localeCompare(b, "ja")), [cards]);
  const filtered = useMemo(() => filterStockOutCards(cards, query, category), [cards, query, category]);
  const clearFilters = () => { setQuery(""); setCategory(null); setLimit(24); };
  return <>
    <section aria-label="商品を絞り込む" className="grid gap-2 rounded-xl border border-line bg-panel p-3">
      <div className="grid gap-1.5" aria-label="カテゴリで絞り込む">
        <p className="text-sm font-semibold">カテゴリー</p>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {[null, ...categories].map(value => <button key={value || "all"} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setLimit(24); }} className={category === value ? selectedCategoryButtonStyle : categoryButtonStyle}>{category === value ? "✓ " : ""}{value || "すべて"}</button>)}
        </div>
      </div>
      <div className="grid gap-1">
        <label htmlFor={searchId} className="text-sm font-semibold">商品名・規格で検索</label>
        <div className="flex gap-2"><input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} placeholder="商品名やサイズを入力" className={`h-10 min-w-0 flex-1 rounded-lg border border-muted bg-panel px-3 text-base ${focusStyle}`} />
          {(query || category) && <button type="button" onClick={clearFilters} className={buttonStyle}>解除</button>}</div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted"><p role="status">{filtered.length}商品 ／ 全{cards.length}商品</p><p>担当: {staff.selectedStaffOperator?.displayName || "画面上部で選択"}</p></div>
    </section>
    {feedback && <section role={feedback.status === "error" ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm font-semibold ${feedback.status === "success" ? "border-success text-success" : "border-danger text-danger"}`}>
      <p>{feedback.message}</p>
      <div className="flex gap-3"><a href="/stock-out" className={`underline ${focusStyle}`}>最新の一覧を表示</a>{feedback.status === "error" && <a href="/movements" className={`underline ${focusStyle}`}>入出庫履歴を確認</a>}</div>
    </section>}
    {!staff.selectedStaffOperatorId && filtered.length > 0 && <p role="status" className="rounded-lg border border-accent bg-subtle px-3 py-2 text-base font-semibold">
      画面上部で作業スタッフを選ぶと、出庫できるようになります。
    </p>}
    {!filtered.length ? <section className="rounded-xl border border-line bg-panel p-6 text-center">
      <h2 className="text-lg font-semibold">{cards.length ? "条件に合う商品がありません" : "このクリニックの在庫商品はまだありません"}</h2>
      <p className="mt-2 text-base">{cards.length ? "商品名やカテゴリを変えてお試しください。" : "対象クリニックと在庫登録を確認してください。"}</p>
      {cards.length ? <button type="button" className={`${buttonStyle} mt-4`} onClick={clearFilters}>絞り込みを解除する</button> : <a href="/inventory" className="mt-4 inline-flex min-h-12 items-center underline">在庫一覧を確認する</a>}
    </section> : <section aria-label="在庫商品のカード" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {filtered.slice(0, limit).map(card => {
        const unit = cardStockUnit(card.orderUnit);
        const blocked = cardIssueBlockReason(card);
        return <article key={card.stockItemId} className="flex h-full min-w-0 flex-col gap-1 rounded-lg border border-line bg-panel p-2 shadow-panel">
          <div className="flow-root sm:min-h-20 lg:min-h-24"><div className="float-left mb-1 mr-2"><StockPhoto card={card} /></div><p className="text-xs text-muted">{card.category || "未分類"}</p><h2 className="whitespace-normal text-base font-semibold leading-5 [overflow-wrap:anywhere]">{card.name}</h2>{card.specification && <p className="mt-0.5 whitespace-normal text-xs leading-4 text-muted [overflow-wrap:anywhere]">{card.specification}</p>}</div>
          <IssueInstructions text={card.issueHint} compact />
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 rounded-lg bg-subtle px-2 py-1.5"><p className="flex items-baseline gap-1"><span className="text-xs">現在庫</span><strong className="text-2xl tabular-nums">{card.quantity}</strong> <span className="text-sm">{unit || "単位未確認"}</span></p><p className="text-xs">基準 <strong className="text-base tabular-nums">{card.minStock}</strong> {unit || ""}</p></div>
          {card.quantity < card.minStock && <p className="text-xs font-semibold">{card.quantity === 0 ? "在庫切れ" : "基準在庫を下回っています"}</p>}
          {blocked ? !unit ? <UnitDecisionGuide card={card} /> : <div className="mt-auto grid gap-1"><p className="text-sm font-semibold">{blocked}</p><a href={`/products/${card.productId}`} className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-muted text-base underline ${focusStyle}`}>商品詳細を確認</a></div> :
            <InlineIssueControl key={`${card.stockItemId}:${card.stockUpdatedAt}`} card={card} selectedStaffOperatorId={staff.selectedStaffOperatorId} onResult={setFeedback} />}
        </article>;
      })}
    </section>}
    {filtered.length > limit && <button type="button" className={`${buttonStyle} mx-auto w-full max-w-sm`} onClick={() => setLimit(value => value + 24)}>さらに24商品を表示（残り{filtered.length - limit}商品）</button>}
  </>;
}
