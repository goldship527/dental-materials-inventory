export function cardStockUnit(value: string | null) {
  const unit = value?.normalize("NFKC").trim();
  return unit && !["つ", "未設定", "不明", "?", "？", "-"].includes(unit) ? unit : null;
}
