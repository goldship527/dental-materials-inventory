export function getDailyCardSpecification(specification: string | null | undefined) {
  const value = specification?.trim();
  if (!value) return null;

  const marker = "元表発注名";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return value;

  const beforeMarker = value
    .slice(0, markerIndex)
    .replace(/\s*[/／|｜、,]\s*$/u, "")
    .trim();
  if (beforeMarker) return beforeMarker;

  const afterMarker = value.slice(markerIndex + marker.length);
  const trailingSpecification = afterMarker.match(/[/／|｜、,]\s*(対象規格\s*[:：].*)$/u)?.[1]?.trim();
  return trailingSpecification || null;
}
