export function getDailyCardSpecification(specification: string | null | undefined) {
  const value = specification?.trim();
  if (!value) return null;

  const visible = value.replace(/\s*(?:\/\s*)?元表発注名\s*[:：].*$/u, "").trim();
  return visible || null;
}
