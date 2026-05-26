export type PurchaseHistoryImportSourceType = "CSV" | "TSV";

export type PurchaseHistoryMatchStatus = "CREATE" | "EXISTING" | "NEEDS_REVIEW" | "ERROR";

export type PurchaseHistoryMatchReason =
  | "JAN_EXACT"
  | "BARCODE_EXACT"
  | "SUPPLIER_PRODUCT_CODE_EXACT"
  | "DEALER_PRODUCT_CODE_EXACT"
  | "MANUFACTURER_AND_NAME_EXACT"
  | "NAME_SIMILAR"
  | "NO_MATCH"
  | "VALIDATION_ERROR";

export type PurchaseHistoryExistingProduct = {
  id: string;
  name: string;
  janCode?: string | null;
  manufacturer?: string | null;
  productCode?: string | null;
  barcodes?: string[];
  supplierProductCodes?: string[];
};

export type PurchaseHistoryParsedRow = {
  rowNumber: number;
  purchaseDate: string | null;
  dealerName: string | null;
  dealerProductCode: string | null;
  supplierProductCode: string | null;
  janCode: string | null;
  productName: string;
  manufacturer: string | null;
  specification: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  status: PurchaseHistoryMatchStatus;
  matchReason: PurchaseHistoryMatchReason;
  matchedProductId: string | null;
  candidateProductIds: string[];
  purchaseCountInFile: number;
  totalQuantityInFile: number | null;
  latestPurchaseDateInFile: string | null;
  duplicateInFile: boolean;
  errors: string[];
  warnings: string[];
};

export type PurchaseHistoryImportPreview = {
  rows: PurchaseHistoryParsedRow[];
  summary: {
    totalRows: number;
    createRows: number;
    existingRows: number;
    needsReviewRows: number;
    errorRows: number;
    warningRows: number;
  };
};

type RawRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type FieldName =
  | "purchaseDate"
  | "dealerName"
  | "dealerProductCode"
  | "supplierProductCode"
  | "janCode"
  | "productName"
  | "manufacturer"
  | "specification"
  | "quantity"
  | "unitPrice"
  | "amount";

const maxRows = 1_000;
const maxTextLength = 500_000;

const headerAliases: Record<string, FieldName> = {
  purchasedate: "purchaseDate",
  date: "purchaseDate",
  "購入日": "purchaseDate",
  dealername: "dealerName",
  dealer: "dealerName",
  suppliername: "dealerName",
  "ディーラー名": "dealerName",
  "発注先": "dealerName",
  dealerproductcode: "dealerProductCode",
  dealercode: "dealerProductCode",
  "ディーラー商品コード": "dealerProductCode",
  "商品コード": "dealerProductCode",
  supplierproductcode: "supplierProductCode",
  suppliercode: "supplierProductCode",
  "発注先品番": "supplierProductCode",
  "品番": "supplierProductCode",
  jancode: "janCode",
  jan: "janCode",
  "janコード": "janCode",
  productname: "productName",
  name: "productName",
  "商品名": "productName",
  manufacturer: "manufacturer",
  maker: "manufacturer",
  "メーカー名": "manufacturer",
  "メーカー": "manufacturer",
  specification: "specification",
  spec: "specification",
  unit: "specification",
  "規格": "specification",
  "包装単位": "specification",
  "規格包装単位": "specification",
  quantity: "quantity",
  qty: "quantity",
  "購入数量": "quantity",
  "数量": "quantity",
  unitprice: "unitPrice",
  price: "unitPrice",
  "単価": "unitPrice",
  amount: "amount",
  total: "amount",
  "金額": "amount",
};

Object.assign(headerAliases, {
  購入日: "purchaseDate",
  日付: "purchaseDate",
  ディーラー名: "dealerName",
  ディーラー: "dealerName",
  発注先: "dealerName",
  仕入先: "dealerName",
  ディーラー商品コード: "dealerProductCode",
  ディーラー品番: "dealerProductCode",
  商品コード: "dealerProductCode",
  発注先品番: "supplierProductCode",
  品番: "supplierProductCode",
  janコード: "janCode",
  商品名: "productName",
  製品名: "productName",
  メーカー名: "manufacturer",
  メーカー: "manufacturer",
  規格: "specification",
  包装単位: "specification",
  規格包装単位: "specification",
  購入数量: "quantity",
  数量: "quantity",
  単価: "unitPrice",
  金額: "amount",
} satisfies Record<string, FieldName>);

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-()（）・/／,，.．]/g, "");
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s_\-()（）・/／,，.．]/g, "");
}

function normalizeCode(value: string | null | undefined) {
  return normalizeSearchText(value).toUpperCase();
}

function normalizeJan(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\.0$/, "").replace(/\D/g, "");

  return digits || null;
}

function nullableText(value: string | undefined, maxLength: number, label: string, errors: string[]) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    errors.push(`${label}は${maxLength}文字以内で入力してください。`);
  }

  return trimmed;
}

function parseNumber(value: string | undefined, label: string, errors: string[]) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999) {
    errors.push(`${label}は0以上の数値で入力してください。`);
    return null;
  }

  return parsed;
}

function parseDelimitedLine(line: string, delimiter: "," | "\t") {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values.map((value) => value.trim());
}

function splitDelimitedRecords(text: string) {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += char;
        current += next;
        index += 1;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
      continue;
    }

    if (char === "\r") {
      current += "\n";
      if (next === "\n") {
        index += 1;
      }
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("CSV/TSVの引用符が閉じられていません。セル内改行やダブルクォートの位置を確認してください。");
  }

  if (current.trim().length > 0) {
    records.push(current);
  }

  return records;
}

function parseDelimitedText(text: string, sourceType: PurchaseHistoryImportSourceType): RawRow[] {
  const trimmedText = text.replace(/^\uFEFF/, "").trim();

  if (!trimmedText) {
    throw new Error("取り込み内容が空です。CSVファイルを選ぶか、Excelの表を貼り付けてください。");
  }

  if (trimmedText.length > maxTextLength) {
    throw new Error(`取り込み内容が大きすぎます。MVPでは${maxRows}行以内にしてください。`);
  }

  const delimiter = sourceType === "CSV" ? "," : "\t";
  const lines = splitDelimitedRecords(trimmedText);
  const headerLine = lines[0];

  if (!headerLine) {
    throw new Error("ヘッダー行が見つかりません。1行目に列名を入れてください。");
  }

  const headers = parseDelimitedLine(headerLine, delimiter).map((header) => {
    const fieldName = headerAliases[normalizeHeader(header)];

    return fieldName ?? null;
  });

  if (!headers.includes("productName")) {
    throw new Error("商品名の列が必要です。");
  }

  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    throw new Error("購入履歴のデータ行が見つかりません。");
  }

  if (dataLines.length > maxRows) {
    throw new Error(`一度に取り込める購入履歴は${maxRows}行までです。`);
  }

  return dataLines.map((line, index) => {
    const cells = parseDelimitedLine(line, delimiter);
    const values: Record<string, string> = {};

    headers.forEach((fieldName, cellIndex) => {
      if (fieldName) {
        values[fieldName] = cells[cellIndex] ?? "";
      }
    });

    return {
      rowNumber: index + 2,
      values,
    };
  });
}

function similarityScore(left: string, right: string) {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length);
  }

  const leftTokens = new Set(normalizedLeft.match(/[a-z0-9]+|[^a-z0-9]/g) ?? []);
  const rightTokens = new Set(normalizedRight.match(/[a-z0-9]+|[^a-z0-9]/g) ?? []);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

function getProductCodes(product: PurchaseHistoryExistingProduct) {
  return [product.productCode, ...(product.supplierProductCodes ?? [])].map(normalizeCode).filter(Boolean);
}

function findMatches(row: {
  janCode: string | null;
  dealerProductCode: string | null;
  supplierProductCode: string | null;
  productName: string;
  manufacturer: string | null;
}, existingProducts: PurchaseHistoryExistingProduct[]) {
  const janCode = normalizeJan(row.janCode);
  const dealerProductCode = normalizeCode(row.dealerProductCode);
  const supplierProductCode = normalizeCode(row.supplierProductCode);
  const manufacturer = normalizeSearchText(row.manufacturer);
  const productName = normalizeSearchText(row.productName);

  const janMatches = janCode
    ? existingProducts.filter((product) => normalizeJan(product.janCode) === janCode)
    : [];
  if (janMatches.length > 0) {
    return { reason: "JAN_EXACT" as const, products: janMatches };
  }

  const barcodeMatches = janCode
    ? existingProducts.filter((product) => (product.barcodes ?? []).some((barcode) => normalizeJan(barcode) === janCode))
    : [];
  if (barcodeMatches.length > 0) {
    return { reason: "BARCODE_EXACT" as const, products: barcodeMatches };
  }

  const supplierCodeMatches = supplierProductCode
    ? existingProducts.filter((product) => getProductCodes(product).includes(supplierProductCode))
    : [];
  if (supplierCodeMatches.length > 0) {
    return { reason: "SUPPLIER_PRODUCT_CODE_EXACT" as const, products: supplierCodeMatches };
  }

  const dealerCodeMatches = dealerProductCode
    ? existingProducts.filter((product) => getProductCodes(product).includes(dealerProductCode))
    : [];
  if (dealerCodeMatches.length > 0) {
    return { reason: "DEALER_PRODUCT_CODE_EXACT" as const, products: dealerCodeMatches };
  }

  const nameMatches = existingProducts.filter((product) => {
    const productManufacturer = normalizeSearchText(product.manufacturer);

    return productName && productName === normalizeSearchText(product.name) && (!manufacturer || manufacturer === productManufacturer);
  });
  if (nameMatches.length > 0) {
    return { reason: "MANUFACTURER_AND_NAME_EXACT" as const, products: nameMatches };
  }

  const similarMatches = existingProducts
    .map((product) => ({
      product,
      score: similarityScore(row.productName, product.name),
    }))
    .filter((candidate) => candidate.score >= 0.72)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((candidate) => candidate.product);

  if (similarMatches.length > 0) {
    return { reason: "NAME_SIMILAR" as const, products: similarMatches };
  }

  return { reason: "NO_MATCH" as const, products: [] };
}

function buildHistoryKey(row: Pick<PurchaseHistoryParsedRow, "janCode" | "supplierProductCode" | "dealerProductCode" | "productName" | "manufacturer">) {
  return (
    normalizeJan(row.janCode) ??
    normalizeCode(row.supplierProductCode) ??
    normalizeCode(row.dealerProductCode) ??
    `${normalizeSearchText(row.manufacturer)}:${normalizeSearchText(row.productName)}`
  );
}

function applyFileAggregates(rows: PurchaseHistoryParsedRow[]) {
  const groups = new Map<string, PurchaseHistoryParsedRow[]>();

  rows.forEach((row) => {
    if (row.status === "ERROR") {
      return;
    }

    const key = buildHistoryKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });

  groups.forEach((group) => {
    const totalQuantity = group.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
    const latestPurchaseDate =
      group
        .map((row) => row.purchaseDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    group.forEach((row) => {
      row.purchaseCountInFile = group.length;
      row.totalQuantityInFile = group.some((item) => item.quantity !== null) ? totalQuantity : null;
      row.latestPurchaseDateInFile = latestPurchaseDate;
      row.duplicateInFile = group.length > 1;

      if (group.length > 1) {
        row.warnings.push("同じ商品候補がこの購入履歴内に複数回出ています。");
      }
    });
  });
}

export function buildPurchaseHistoryImportPreview(options: {
  text: string;
  sourceType: PurchaseHistoryImportSourceType;
  existingProducts: PurchaseHistoryExistingProduct[];
}): PurchaseHistoryImportPreview {
  const rawRows = parseDelimitedText(options.text, options.sourceType);
  const rows = rawRows.map((rawRow): PurchaseHistoryParsedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const productName = (rawRow.values.productName ?? "").trim();
    const purchaseDate = nullableText(rawRow.values.purchaseDate, 30, "購入日", errors);
    const dealerName = nullableText(rawRow.values.dealerName, 100, "ディーラー名", errors);
    const dealerProductCode = nullableText(rawRow.values.dealerProductCode, 100, "ディーラー商品コード", errors);
    const supplierProductCode = nullableText(rawRow.values.supplierProductCode, 100, "発注先品番", errors);
    const janCode = normalizeJan(rawRow.values.janCode);
    const manufacturer = nullableText(rawRow.values.manufacturer, 100, "メーカー名", errors);
    const specification = nullableText(rawRow.values.specification, 200, "規格・包装単位", errors);
    const quantity = parseNumber(rawRow.values.quantity, "購入数量", errors);
    const unitPrice = parseNumber(rawRow.values.unitPrice, "単価", errors);
    const amount = parseNumber(rawRow.values.amount, "金額", errors);

    if (!productName) {
      errors.push("商品名は必須です。");
    } else if (productName.length > 150) {
      errors.push("商品名は150文字以内で入力してください。");
    }

    if (rawRow.values.janCode?.trim() && (!janCode || !/^\d{8,14}$/.test(janCode))) {
      errors.push("JANコードは8桁から14桁の数字で入力してください。");
    }

    if (!janCode && !dealerProductCode && !supplierProductCode) {
      errors.push("JANコード、ディーラー商品コード、発注先品番のいずれかが必要です。");
    }

    if (errors.length > 0) {
      return {
        rowNumber: rawRow.rowNumber,
        purchaseDate,
        dealerName,
        dealerProductCode,
        supplierProductCode,
        janCode,
        productName,
        manufacturer,
        specification,
        quantity,
        unitPrice,
        amount,
        status: "ERROR",
        matchReason: "VALIDATION_ERROR",
        matchedProductId: null,
        candidateProductIds: [],
        purchaseCountInFile: 1,
        totalQuantityInFile: quantity,
        latestPurchaseDateInFile: purchaseDate,
        duplicateInFile: false,
        errors,
        warnings,
      };
    }

    const match = findMatches(
      {
        janCode,
        dealerProductCode,
        supplierProductCode,
        productName,
        manufacturer,
      },
      options.existingProducts,
    );
    const candidateProductIds = match.products.map((product) => product.id);
    let status: PurchaseHistoryMatchStatus = "CREATE";
    let matchedProductId: string | null = null;

    if (match.reason === "NO_MATCH") {
      status = "CREATE";
    } else if (match.products.length === 1 && match.reason !== "NAME_SIMILAR") {
      status = "EXISTING";
      matchedProductId = match.products[0]?.id ?? null;
    } else {
      status = "NEEDS_REVIEW";
      warnings.push("取り込み前に一致候補の商品を確認してください。");
    }

    return {
      rowNumber: rawRow.rowNumber,
      purchaseDate,
      dealerName,
      dealerProductCode,
      supplierProductCode,
      janCode,
      productName,
      manufacturer,
      specification,
      quantity,
      unitPrice,
      amount,
      status,
      matchReason: match.reason,
      matchedProductId,
      candidateProductIds,
      purchaseCountInFile: 1,
      totalQuantityInFile: quantity,
      latestPurchaseDateInFile: purchaseDate,
      duplicateInFile: false,
      errors,
      warnings,
    };
  });

  applyFileAggregates(rows);

  const errorRows = rows.filter((row) => row.status === "ERROR").length;
  const createRows = rows.filter((row) => row.status === "CREATE").length;
  const existingRows = rows.filter((row) => row.status === "EXISTING").length;
  const needsReviewRows = rows.filter((row) => row.status === "NEEDS_REVIEW").length;
  const warningRows = rows.filter((row) => row.warnings.length > 0).length;

  return {
    rows,
    summary: {
      totalRows: rows.length,
      createRows,
      existingRows,
      needsReviewRows,
      errorRows,
      warningRows,
    },
  };
}
