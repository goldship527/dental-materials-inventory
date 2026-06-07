"use client";

import { ignoreBarcodeScanLogAction, promoteBarcodeScanLogFromSampleAction } from "@/lib/actions/barcode-scan-logs";
import { SubmitButton } from "@/components/ui/submit-button";

type UnresolvedScanActionsProps = {
  logId: string;
  matchType: string;
};

export function UnresolvedScanActions({ logId, matchType }: UnresolvedScanActionsProps) {
  return (
    <div className="grid gap-3">
      {matchType === "SAMPLE" ? (
        <form
          action={promoteBarcodeScanLogFromSampleAction}
          onSubmit={(event) => {
            if (!window.confirm("取込サンプルからローカル検証用商品を作成します。よろしいですか？")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="logId" value={logId} />
          <SubmitButton
            pendingLabel="作成中"
            className="w-full rounded bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            昇格させる
          </SubmitButton>
        </form>
      ) : null}

      <form action={ignoreBarcodeScanLogAction} className="grid gap-2">
        <input type="hidden" name="logId" value={logId} />
        <input
          name="resolvedNote"
          placeholder="無視メモ 任意"
          maxLength={500}
          className="h-9 rounded border border-line px-2 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <SubmitButton
          pendingLabel="処理中"
          className="rounded border border-line bg-white px-3 py-2 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          無視する
        </SubmitButton>
      </form>
    </div>
  );
}
