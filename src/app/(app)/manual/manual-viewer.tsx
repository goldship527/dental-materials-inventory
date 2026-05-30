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
      <mark key={`${matchIndex}-${cursor}`} className="rounded bg-amber-200 px-0.5 text-ink">
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
        <code key={index} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-ink">
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
      return <h1 className="mb-5 text-2xl font-semibold leading-tight text-ink">{block.text}</h1>;
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
        <aside className="my-5 rounded border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{block.label}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-base leading-8 text-amber-950">
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
  sectionRef,
}: {
  section: ManualSection;
  isOpen: boolean;
  query: string;
  onToggle: () => void;
  sectionRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <section ref={sectionRef} className="rounded border border-line bg-white shadow-panel">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left text-lg font-semibold text-ink transition hover:bg-subtle sm:px-5"
        aria-expanded={isOpen}
      >
        <span>{renderTextWithHighlight(section.title, query)}</span>
        <span className="shrink-0 text-xl text-accent" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-line px-4 py-4 sm:px-6">
          {section.blocks.map((block, index) => (
            <ManualBlockView key={index} block={block} query={query} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ManualViewer({ markdown }: { markdown: string }) {
  const doc = useMemo(() => parseManual(markdown), [markdown]);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
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

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded border border-line bg-white p-5 shadow-panel">
        {doc.preamble.map((block, index) => (
          <ManualBlockView key={index} block={block} query={normalizedQuery} />
        ))}
      </section>

      <section className="rounded border border-line bg-white p-4 shadow-panel sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-1 flex-col gap-2 text-sm font-semibold text-ink">
            マニュアル内検索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="例: 納品確認、バーコード、棚卸"
              type="search"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="min-h-11 rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={openAll}
              className="min-h-11 rounded border border-accent bg-white px-4 text-sm font-semibold text-accent transition hover:bg-teal-50"
            >
              すべて開く
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="min-h-11 rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
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
                className="min-h-11 rounded border border-line bg-surface px-3 py-2 text-left text-sm font-semibold leading-6 text-ink transition hover:border-accent hover:bg-white hover:text-accent"
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
                sectionRef={(element) => {
                  sectionRefs.current[section.id] = element;
                }}
              />
            );
          })}
        </div>
      ) : (
        <section className="rounded border border-line bg-white p-6 text-base leading-8 text-muted shadow-panel">
          一致する章がありません。検索語を短くするか、別の言葉で探してください。
        </section>
      )}
    </div>
  );
}
