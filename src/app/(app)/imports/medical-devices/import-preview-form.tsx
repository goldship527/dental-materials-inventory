"use client";

type ImportPreviewFormProps = {
  q: string;
  sourceFile: string;
  duplicateOnly: boolean;
  sourceFiles: string[];
};

export function ImportPreviewForm({ q, sourceFile, duplicateOnly, sourceFiles }: ImportPreviewFormProps) {
  return (
    <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] xl:grid-cols-[minmax(0,1fr)_220px_auto_auto] xl:items-end">
      <label className="grid gap-2 text-sm font-semibold text-muted">
        検索
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="JAN、製品名、メーカー、一般的名称"
          className="h-11 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-muted">
        ファイル
        <select
          name="sourceFile"
          defaultValue={sourceFile}
          className="h-11 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          <option value="">すべて</option>
          {sourceFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </label>
      <label className="flex h-11 items-center gap-2 rounded border border-line px-3 text-sm font-semibold text-muted lg:self-end">
        <input type="checkbox" name="duplicateOnly" value="1" defaultChecked={duplicateOnly} className="h-4 w-4 accent-teal-700" />
        重複JANのみ
      </label>
      <div className="flex flex-wrap gap-2 lg:self-end xl:flex-nowrap">
        <button type="submit" className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800">
          表示
        </button>
        <a
          href="/imports/medical-devices"
          className="flex h-11 items-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        >
          クリア
        </a>
      </div>
    </form>
  );
}
