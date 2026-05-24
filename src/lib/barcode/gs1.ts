import { isValidEan13, isValidGtin14 } from "@/lib/barcode/ean13";

const GS1_SEPARATOR = "\u001d";

export type BarcodeInputAnalysis = {
  rawInput: string;
  normalizedInput: string;
  searchValues: string[];
  extractedGtin: string | null;
  extractedJan13: string | null;
  extractedBarcode: string | null;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDateText: string | null;
  expiryDate: Date | null;
  preferredAttachBarcode: string;
  isGs1Like: boolean;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => typeof value === "string" && value.length > 0 && /\d/.test(value)),
    ),
  );
}

function stripSymbologyIdentifier(value: string) {
  return value.replace(/^\][A-Za-z0-9]{2}/, "");
}

function extractGtinFromGs1(value: string) {
  const withoutPrefix = stripSymbologyIdentifier(value);
  const parenthesizedMatch = withoutPrefix.match(/\(01\)\s*(\d{14})/);
  const parenthesizedGtin = parenthesizedMatch?.[1];

  if (parenthesizedGtin && isValidGtin14(parenthesizedGtin)) {
    return parenthesizedGtin;
  }

  const compactMatch = withoutPrefix.match(new RegExp(`(?:^|${GS1_SEPARATOR})01(\\d{14})`));
  const compactGtin = compactMatch?.[1];

  if (compactGtin && isValidGtin14(compactGtin)) {
    return compactGtin;
  }

  return null;
}

function parseGs1ExpiryDate(value: string | null) {
  if (!value || !/^\d{6}$/.test(value)) {
    return null;
  }

  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const dayText = value.slice(4, 6);
  const day = Number(dayText);

  if (month < 1 || month > 12) {
    return null;
  }

  const resolvedDay = day === 0 ? new Date(year, month, 0).getDate() : day;
  const parsedDate = new Date(year, month - 1, resolvedDay);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== resolvedDay
  ) {
    return null;
  }

  return parsedDate;
}

function parseParenthesizedGs1(value: string) {
  const result = {
    lotNumber: null as string | null,
    serialNumber: null as string | null,
    expiryDateText: null as string | null,
  };
  const matches = Array.from(value.matchAll(/\((\d{2})\)([^(]*)/g));

  for (const match of matches) {
    const ai = match[1];
    const aiValue = match[2]?.trim() ?? "";

    if (ai === "17" && /^\d{6}$/.test(aiValue)) {
      result.expiryDateText = aiValue;
    }

    if (ai === "10" && aiValue.length > 0) {
      result.lotNumber = aiValue;
    }

    if (ai === "21" && aiValue.length > 0) {
      result.serialNumber = aiValue;
    }
  }

  return result;
}

function findNextKnownAi(value: string, startIndex: number) {
  for (let index = startIndex; index < value.length - 1; index += 1) {
    const code = value.slice(index, index + 2);

    if (code === "17" && /^\d{6}/.test(value.slice(index + 2))) {
      return index;
    }

    if (code === "10" || code === "21") {
      return index;
    }
  }

  return -1;
}

function readVariableLengthAiValue(value: string, startIndex: number) {
  const separatorIndex = value.indexOf(GS1_SEPARATOR, startIndex);
  const nextAiIndex = findNextKnownAi(value, startIndex);
  const endCandidates = [separatorIndex, nextAiIndex].filter((index) => index >= 0);
  const endIndex = endCandidates.length > 0 ? Math.min(...endCandidates) : value.length;

  return {
    value: value.slice(startIndex, endIndex),
    nextIndex: value[endIndex] === GS1_SEPARATOR ? endIndex + 1 : endIndex,
  };
}

function parseCompactGs1(value: string) {
  const result = {
    lotNumber: null as string | null,
    serialNumber: null as string | null,
    expiryDateText: null as string | null,
  };
  let index = 0;

  while (index < value.length) {
    if (value[index] === GS1_SEPARATOR) {
      index += 1;
      continue;
    }

    const ai = value.slice(index, index + 2);

    if (ai === "01" && /^\d{14}/.test(value.slice(index + 2))) {
      index += 16;
      continue;
    }

    if (ai === "17" && /^\d{6}/.test(value.slice(index + 2))) {
      result.expiryDateText = value.slice(index + 2, index + 8);
      index += 8;
      continue;
    }

    if (ai === "10") {
      const parsed = readVariableLengthAiValue(value, index + 2);
      result.lotNumber = parsed.value || null;
      index = parsed.nextIndex;
      continue;
    }

    if (ai === "21") {
      const parsed = readVariableLengthAiValue(value, index + 2);
      result.serialNumber = parsed.value || null;
      index = parsed.nextIndex;
      continue;
    }

    index += 1;
  }

  return result;
}

function parseGs1ApplicationIdentifiers(input: string) {
  const withoutPrefix = stripSymbologyIdentifier(input);
  const parsed = withoutPrefix.includes("(")
    ? parseParenthesizedGs1(withoutPrefix)
    : parseCompactGs1(withoutPrefix);
  const expiryDate = parseGs1ExpiryDate(parsed.expiryDateText);

  return {
    ...parsed,
    expiryDate,
  };
}

function normalizeVisibleInput(value: string) {
  return stripSymbologyIdentifier(value.trim()).replace(/\s+/g, "");
}

function extractJan13Candidate(value: string) {
  const candidates = value.match(/\d{13}/g) ?? [];
  return candidates.find((candidate) => isValidEan13(candidate)) ?? candidates[0] ?? null;
}

export function analyzeBarcodeInput(input: string): BarcodeInputAnalysis {
  const rawInput = input.trim();
  const normalizedInput = normalizeVisibleInput(rawInput);
  const extractedGtin = extractGtinFromGs1(rawInput);
  const digitsOnly = normalizedInput.replace(/\D/g, "");
  const formattedNumericValue = /^[\d\s-]+$/.test(rawInput) ? digitsOnly : null;
  const gtinFromPlainValue = !extractedGtin && digitsOnly.length === 14 && isValidGtin14(digitsOnly) ? digitsOnly : null;
  const gtin = extractedGtin ?? gtinFromPlainValue;
  const jan13FromGtin = gtin?.startsWith("0") ? gtin.slice(1) : null;
  const jan13FromInput = extractJan13Candidate(rawInput);
  const jan13 = jan13FromGtin ?? jan13FromInput;
  const extractedBarcode = jan13 ?? gtin ?? null;
  const isGs1Like =
    Boolean(extractedGtin) ||
    rawInput.startsWith("]C1") ||
    rawInput.startsWith("]d2") ||
    rawInput.includes("(17)") ||
    rawInput.includes("(10)") ||
    rawInput.includes("(21)");
  const gs1ApplicationIdentifiers = isGs1Like
    ? parseGs1ApplicationIdentifiers(rawInput)
    : {
        lotNumber: null,
        serialNumber: null,
        expiryDateText: null,
        expiryDate: null,
      };
  const searchValues = uniqueValues([rawInput, normalizedInput, formattedNumericValue, gtin, jan13, extractedBarcode]);
  const preferredAttachBarcode = jan13 ?? gtin ?? formattedNumericValue ?? normalizedInput;

  return {
    rawInput,
    normalizedInput,
    searchValues,
    extractedGtin: gtin,
    extractedJan13: jan13,
    extractedBarcode,
    lotNumber: gs1ApplicationIdentifiers.lotNumber,
    serialNumber: gs1ApplicationIdentifiers.serialNumber,
    expiryDateText: gs1ApplicationIdentifiers.expiryDateText,
    expiryDate: gs1ApplicationIdentifiers.expiryDate,
    preferredAttachBarcode,
    isGs1Like,
  };
}
