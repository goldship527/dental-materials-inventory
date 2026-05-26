export type PurchaseHistoryReviewDecision = "EXISTING" | "CREATE" | "EXCLUDE";

const reviewDecisionValues = new Set<PurchaseHistoryReviewDecision>(["EXISTING", "CREATE", "EXCLUDE"]);
const reviewDecisionReadError = "確認必要行の選択内容を読み取れませんでした。もう一度プレビューからやり直してください。";

export function parsePurchaseHistoryReviewDecisionsJson(rawValue: string): Record<number, PurchaseHistoryReviewDecision> {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(reviewDecisionReadError);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(reviewDecisionReadError);
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([rowNumberText, decision]) => [Number(rowNumberText), decision])
      .filter(
        (entry): entry is [number, PurchaseHistoryReviewDecision] =>
          Number.isInteger(entry[0]) &&
          entry[0] > 0 &&
          typeof entry[1] === "string" &&
          reviewDecisionValues.has(entry[1] as PurchaseHistoryReviewDecision),
      ),
  );
}
