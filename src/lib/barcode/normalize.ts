const fullWidthHyphenLikePattern = /[\u2010-\u2015\u2212\uff0d]/g;

export function normalizeBarcodeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(fullWidthHyphenLikePattern, "-")
    .replace(/\u3000/g, " ")
    .trim();
}
