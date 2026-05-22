import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-ink">
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function ManualContent({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    elements.push(
      <ul key={`list-${elements.length}`} className="my-3 list-disc space-y-1 pl-6 text-sm leading-7 text-ink">
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  function flushOrderedList() {
    if (orderedItems.length === 0) {
      return;
    }

    elements.push(
      <ol key={`ordered-list-${elements.length}`} className="my-3 list-decimal space-y-1 pl-6 text-sm leading-7 text-ink">
        {orderedItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ol>,
    );
    orderedItems = [];
  }

  function flushLists() {
    flushList();
    flushOrderedList();
  }

  lines.forEach((line) => {
    if (line.startsWith("- ")) {
      flushOrderedList();
      listItems.push(line.slice(2));
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushList();
      orderedItems.push(orderedMatch[1]);
      return;
    }

    flushLists();

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={elements.length} className="mb-4 text-3xl font-semibold">
          {line.slice(2)}
        </h1>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={elements.length} className="mt-8 border-t border-line pt-6 text-xl font-semibold">
          {line.slice(3)}
        </h2>,
      );
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={elements.length} className="mt-5 text-base font-semibold">
          {line.slice(4)}
        </h3>,
      );
      return;
    }

    if (!line.trim()) {
      elements.push(<div key={elements.length} className="h-2" />);
      return;
    }

    elements.push(
      <p key={elements.length} className="my-2 text-sm leading-7 text-ink">
        {renderInline(line)}
      </p>,
    );
  });

  flushLists();

  return <div>{elements}</div>;
}

export default async function ManualPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const markdown = await readFile(path.join(process.cwd(), "docs", "user-manual.md"), "utf8");

  return (
    <>
      <AppNav current="manual" />
      <main className="min-h-screen bg-surface px-4 py-8 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
              <h1 className="mt-2 text-3xl font-semibold">スタッフマニュアル</h1>
              <p className="mt-2 text-sm text-muted">日常操作の確認用マニュアルです。</p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-accent transition hover:border-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </header>

          <section className="rounded border border-line bg-white p-6 shadow-panel">
            <ManualContent markdown={markdown} />
          </section>
        </div>
      </main>
    </>
  );
}
