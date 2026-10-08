"use client";

import { useMemo, useRef, useState } from "react";
import { parseManual, type ManualBlock, type ManualSection, type Span } from "./parse-manual";

function renderTextWithHighlight(text: string, query: string) {
  if (!query) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);

    if (matchIndex === -1) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    nodes.push(
      <mark key={`${matchIndex}-${cursor}`} className="rounded bg-markSoft px-0.5 text-ink">
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>,
    );
    cursor = matchIndex + query.length;
  }

  return nodes;
}

function renderSpans(spans: Span[], query: string) {
  return spans.map((span, index) => {
    if (span.type === "code") {
      return (
        <code key={index} className="rounded bg-subtle px-1 py-0.5 font-mono text-sm text-ink">
          {span.value}
        </code>
      );
    }

    return <span key={index}>{renderTextWithHighlight(span.value, query)}</span>;
  });
}

function ManualBlockView({ block, query }: { block: ManualBlock; query: string }) {
  switch (block.type) {
    case "h1":
      return <h1 className="mb-5 text-xl font-semibold leading-tight text-ink">{block.text}</h1>;
    case "h3": {
      const isQuestion = block.text.startsWith("Q.");

      if (isQuestion) {
        return (
          <h3 className="mt-5 rounded border border-line bg-subtle px-4 py-3 text-base font-semibold leading-7 text-ink">
            {renderTextWithHighlight(block.text, query)}
          </h3>
        );
      }

      return <h3 className="mt-6 text-lg font-semibold leading-7 text-ink">{renderTextWithHighlight(block.text, query)}</h3>;
    }
    case "paragraph":
      return <p className="my-3 text-base leading-8 text-ink">{renderSpans(block.spans, query)}</p>;
    case "ul":
      return (
        <ul className="my-4 list-disc space-y-2 pl-7 text-base leading-8 text-ink">
          {block.items.map((item, index) => (
            <li key={index}>{renderSpans(item, query)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="my-4 list-decimal space-y-2 pl-7 text-base leading-8 text-ink">
          {block.items.map((item, index) => (
            <li key={index}>{renderSpans(item, query)}</li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <aside className="my-5 rounded border border-lineStrong border-l-4 border-l-ink bg-markSoft px-4 py-3">
          <p className="text-sm font-semibold text-ink">{block.label}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-base leading-8 text-ink">
            {block.items.map((item, index) => (
              <li key={index}>{renderSpans(item, query)}</li>
            ))}
          </ul>
        </aside>
      );
    case "image":
      return (
        <figure className="my-5">
          <img className="h-auto max-w-full rounded border border-line" src={block.src} alt={block.alt} />
          {block.alt ? <figcaption className="mt-2 text-sm text-muted">{block.alt}</figcaption> : null}
        </figure>
      );
  }
}

function SectionPanel({
  section,
  isOpen,
  query,
  onToggle,
  onBackToControls,
  sectionRef,
}: {
  section: ManualSection;
  isOpen: boolean;
  query: string;
  onToggle: () => void;
  onBackToControls: () => void;
  sectionRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <section ref={sectionRef} className="rounded border border-line bg-panel shadow-sheet">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded btn-secondary px-4 py-3 text-left text-lg font-semibold transition sm:px-5"
        aria-expanded={isOpen}
      >
        <span>{renderTextWithHighlight(section.title, query)}</span>
        <span className="shrink-0 text-lg text-accent" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-line px-4 py-4 sm:px-6">
          {section.blocks.map((block, index) => (
            <ManualBlockView key={index} block={block} query={query} />
          ))}
          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={onBackToControls}
              className="min-h-11 rounded btn-secondary px-4 text-sm font-semibold transition"
            >
              目次へ戻る
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ManualViewer({ markdown }: { markdown: string }) {
  const doc = useMemo(() => parseManual(markdown), [markdown]);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const controlsRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = normalizedQuery
    ? doc.sections.filter((section) => section.text.includes(normalizedQuery))
    : doc.sections;

  function toggleSection(sectionId: string) {
    setOpenIds((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  }

  function openSection(sectionId: string) {
    setOpenIds((current) => new Set(current).add(sectionId));
    window.setTimeout(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openAll() {
    setOpenIds(new Set(visibleSections.map((section) => section.id)));
  }

  function closeAll() {
    setOpenIds(new Set());
  }

  function scrollToControls() {
    controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded border border-line bg-panel p-5 shadow-sheet">
        {doc.preamble.map((block, index) => (
          <ManualBlockView key={index} block={block} query={normalizedQuery} />
        ))}
      </section>

      <section ref={controlsRef} className="scroll-mt-4 rounded border border-line bg-panel p-4 shadow-sheet sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-1 flex-col gap-2 text-sm font-semibold text-ink">
            マニュアル内検索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 rounded border border-line bg-panel px-3 text-base font-normal text-ink  transition   "
              placeholder="例: 納品確認、バーコード、棚卸"
              type="search"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="min-h-11 rounded btn-secondary px-4 text-sm font-semibold transition"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={openAll}
              className="min-h-11 rounded btn-secondary px-4 text-sm font-semibold transition"
            >
              すべて開く
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="min-h-11 rounded btn-secondary px-4 text-sm font-semibold transition"
            >
              すべて閉じる
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm font-semibold text-muted">目次</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section.id)}
                className="min-h-11 rounded btn-secondary bg-surface px-3 py-2 text-left text-sm font-semibold leading-6 transition"
              >
                {section.title}
              </button>
            ))}
          </div>
          {normalizedQuery ? (
            <p className="mt-3 text-sm text-muted">
              「{query.trim()}」に一致する章: {visibleSections.length}件
            </p>
          ) : null}
        </div>
      </section>

      {visibleSections.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visibleSections.map((section) => {
            const isOpen = normalizedQuery ? true : openIds.has(section.id);

            return (
              <SectionPanel
                key={section.id}
                section={section}
                isOpen={isOpen}
                query={normalizedQuery}
                onToggle={() => toggleSection(section.id)}
                onBackToControls={scrollToControls}
                sectionRef={(element) => {
                  sectionRefs.current[section.id] = element;
                }}
              />
            );
          })}
        </div>
      ) : (
        <section className="rounded border border-line bg-panel p-6 text-base leading-8 text-muted shadow-sheet">
          一致する章がありません。検索語を短くするか、別の言葉で探してください。
        </section>
      )}

      <button
        type="button"
        onClick={scrollToControls}
        className="fixed bottom-4 right-4 z-30 min-h-11 rounded-full btn-secondary px-4 text-sm font-semibold transition"
      >
        目次へ戻る
      </button>
    </div>
  );
}
