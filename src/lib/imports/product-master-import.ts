export type ProductImportSourceType = "CSV" | "TSV";

export type ProductImportSupplierOption = {
  id: string;
  name: string;
};

export type ProductImportParsedRow = {
  rowNumber: number;
  name: string;
  productCode: string | null;
  janCode: string | null;
  internalCode: string | null;
  category: string | null;
  manufacturer: string | null;
  specification: string | null;
  orderUnit: string | null;
  primarySupplierName: string | null;
  primarySupplierId: string | null;
  supplierProductCode: string | null;
  standardPrice: number | null;
  defaultMinStock: number;
  notes: string | null;
  errors: string[];
  warnings: string[];
  willCreate: boolean;
};

export type ProductImportPreview = {
  rows: ProductImportParsedRow[];
  summary: {
    totalRows: number;
    validRows: number;
    createdRows: number;
    skippedRows: number;
    errorRows: number;
    warningRows: number;
  };
};

type RawRow = {
  rowNumber: number;
  values: Record<string, string>;
};

const maxRows = 500;
const maxTextLength = 300_000;

const headerAliases: Record<string, keyof Omit<ProductImportParsedRow, "rowNumber" | "primarySupplierId" | "errors" | "warnings" | "willCreate">> = {
  name: "name",
  productname: "name",
  "商品名": "name",
  "品名": "name",
  productcode: "productCode",
  code: "productCode",
  "商品コード": "productCode",
  jancode: "janCode",
  jan: "janCode",
  "janコード": "janCode",
  internalcode: "internalCode",
  "内部コード": "internalCode",
  category: "category",
  "カテゴリ": "category",
  "カテゴリー": "category",
  manufacturer: "manufacturer",
  maker: "manufacturer",
  "メーカー": "manufacturer",
  specification: "specification",
  spec: "specification",
  "規格": "specification",
  orderunit: "orderUnit",
  unit: "orderUnit",
  "発注単位": "orderUnit",
  primarysupplier: "primarySupplierName",
  primarysuppliername: "primarySupplierName",
  supplier: "primarySupplierName",
  suppliername: "primarySupplierName",
  "主発注先": "primarySupplierName",
  "発注先": "primarySupplierName",
  supplierproductcode: "supplierProductCode",
  "発注先商品コード": "supplierProductCode",
  "発注先品番": "supplierProductCode",
  standardprice: "standardPrice",
  price: "standardPrice",
  "標準価格": "standardPrice",
  defaultminstock: "defaultMinStock",
  minstock: "defaultMinStock",
  "標準最低在庫": "defaultMinStock",
  "最低在庫": "defaultMinStock",
  notes: "notes",
  note: "notes",
  memo: "notes",
  "備考": "notes",
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-()（）]/g, "");
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

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9_999_999) {
    errors.push(`${label}は0以上の数値で入力してください。`);
    return null;
  }

  return parsed;
}

function parseMinStock(value: string | undefined, errors: string[]) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    errors.push("最低在庫は0以上9999以下の整数で入力してください。");
    return 0;
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

function parseDelimitedText(text: string, sourceType: ProductImportSourceType): RawRow[] {
  const trimmedText = text.replace(/^\uFEFF/, "").trim();

  if (!trimmedText) {
    throw new Error("取り込み内容が空です。CSVファイルを選ぶか、Excelから表を貼り付けてください。");
  }

  if (trimmedText.length > maxTextLength) {
    throw new Error("取り込み内容が大きすぎます。500行以内を目安に分けて取り込んでください。");
  }

  const delimiter = sourceType === "CSV" ? "," : "\t";
  const lines = trimmedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];

  if (!headerLine) {
    throw new Error("ヘッダー行が見つかりません。");
  }

  const headers = parseDelimitedLine(headerLine, delimiter).map((header) => {
    const fieldName = headerAliases[normalizeHeader(header)];

    return fieldName ?? null;
  });

  if (!headers.includes("name")) {
    throw new Error("商品名の列が必要です。ヘッダーに「商品名」または「name」を含めてください。");
  }

  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    throw new Error("取り込み対象の行がありません。");
  }

  if (dataLines.length > maxRows) {
    throw new Error(`一度に取り込める行数は${maxRows}行までです。`);
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

export function buildProductImportPreview(options: {
  text: string;
  sourceType: ProductImportSourceType;
  existingJanCodes: string[];
  suppliers: ProductImportSupplierOption[];
}): ProductImportPreview {
  const rawRows = parseDelimitedText(options.text, options.sourceType);
  const existingJanCodes = new Set(options.existingJanCodes.filter(Boolean));
  const seenJanCodes = new Set<string>();
  const suppliersByName = new Map(options.suppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier]));
  const rows = rawRows.map((rawRow): ProductImportParsedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = (rawRow.values.name ?? "").trim();

    if (!name) {
      errors.push("商品名は必須です。");
    } else if (name.length > 100) {
      errors.push("商品名は100文字以内で入力してください。");
    }

    const productCode = nullableText(rawRow.values.productCode, 64, "商品コード", errors);
    const janCode = nullableText(rawRow.values.janCode, 13, "JANコード", errors);
    const internalCode = nullableText(rawRow.values.internalCode, 64, "内部コード", errors);
    const category = nullableText(rawRow.values.category, 100, "カテゴリ", errors);
    const manufacturer = nullableText(rawRow.values.manufacturer, 100, "メーカー", errors);
    const specification = nullableText(rawRow.values.specification, 100, "規格", errors);
    const orderUnit = nullableText(rawRow.values.orderUnit, 100, "発注単位", errors);
    const supplierProductCode = nullableText(rawRow.values.supplierProductCode, 64, "発注先品番", errors);
    const notes = nullableText(rawRow.values.notes, 1000, "備考", errors);
    const standardPrice = parseNumber(rawRow.values.standardPrice, "標準価格", errors);
    const defaultMinStock = parseMinStock(rawRow.values.defaultMinStock, errors);
    const primarySupplierName = nullableText(rawRow.values.primarySupplierName, 100, "発注先", errors);
    const supplier = primarySupplierName ? suppliersByName.get(primarySupplierName.toLowerCase()) : null;

    if (janCode && !/^\d{13}$/.test(janCode)) {
      errors.push("JANコードは13桁の数字で入力してください。");
    }

    if (janCode && existingJanCodes.has(janCode)) {
      warnings.push("同じJANコードの商品が既にあります。この行はスキップします。");
    }

    if (janCode && seenJanCodes.has(janCode)) {
      warnings.push("同じファイル内に同じJANコードがあります。この行はスキップします。");
    }

    if (janCode) {
      seenJanCodes.add(janCode);
    }

    if (primarySupplierName && !supplier) {
      warnings.push("発注先名が既存マスタと一致しないため、発注先なしで作成します。");
    }

    const isDuplicate = warnings.some((warning) => warning.includes("スキップ"));
    const willCreate = errors.length === 0 && !isDuplicate;

    return {
      rowNumber: rawRow.rowNumber,
      name,
      productCode,
      janCode,
      internalCode,
      category,
      manufacturer,
      specification,
      orderUnit,
      primarySupplierName,
      primarySupplierId: supplier?.id ?? null,
      supplierProductCode,
      standardPrice,
      defaultMinStock,
      notes,
      errors,
      warnings,
      willCreate,
    };
  });
  const errorRows = rows.filter((row) => row.errors.length > 0).length;
  const warningRows = rows.filter((row) => row.warnings.length > 0).length;
  const createdRows = rows.filter((row) => row.willCreate).length;
  const skippedRows = rows.length - createdRows - errorRows;

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      createdRows,
      skippedRows,
      errorRows,
      warningRows,
    },
  };
}
