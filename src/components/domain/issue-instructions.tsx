export function getIssueInstructions(notes: string | null | undefined) {
  return notes?.match(/^元表の出し方: (.*)$/m)?.[1]?.trim() || null;
}

export function IssueInstructions({ text, compact = false }: { text: string | null; compact?: boolean }) {
  if (compact) {
    return <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-accent bg-subtle px-2 py-1.5 text-ink">
      <p className="text-xs font-semibold">出し方</p>
      <p className="min-w-0 whitespace-pre-wrap break-words text-base font-semibold leading-5">{text || "未確認"}</p>
    </div>;
  }

  return <div className="rounded-lg border border-accent bg-subtle p-3 text-ink">
    <p className="text-sm font-semibold">出し方</p>
    <p className="mt-1 whitespace-pre-wrap break-words text-xl font-semibold leading-7">{text || "未確認"}</p>
  </div>;
}
