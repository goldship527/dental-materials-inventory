export type SupplierImportSourceType = "CSV" | "TSV";

export type SupplierImportParsedRow = {
  rowNumber: number;
  name: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  notes: string | null;
  errors: string[];
  warnings: string[];
  willCreate: boolean;
};

export type SupplierImportPreview = {
  rows: SupplierImportParsedRow[];
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

const maxRows = 300;
const maxTextLength = 200_000;

const headerAliases: Record<
  string,
  keyof Omit<SupplierImportParsedRow, "rowNumber" | "errors" | "warnings" | "willCreate">
> = {
  name: "name",
  supplier: "name",
  suppliername: "name",
  "発注先": "name",
  "発注先名": "name",
  address: "address",
  "住所": "address",
  phone: "phone",
  tel: "phone",
  "電話": "phone",
  "電話番号": "phone",
  fax: "fax",
  "fax番号": "fax",
  email: "email",
  mail: "email",
  "メール": "email",
  "メールアドレス": "email",
  contactpersonname: "contactPersonName",
  contactname: "contactPersonName",
  contact: "contactPersonName",
  "担当者": "contactPersonName",
  "担当者名": "contactPersonName",
  contactpersonemail: "contactPersonEmail",
  contactemail: "contactPersonEmail",
  "担当者メール": "contactPersonEmail",
  "担当者メールアドレス": "contactPersonEmail",
  notes: "notes",
  note: "notes",
  memo: "notes",
  "備考": "notes",
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-()（）・]/g, "");
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

function nullableEmail(value: string | undefined, label: string, errors: string[]) {
  const trimmed = nullableText(value, 254, label, errors);

  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.push(`${label}の形式を確認してください。`);
  }

  return trimmed;
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

function parseDelimitedText(text: string, sourceType: SupplierImportSourceType): RawRow[] {
  const trimmedText = text.replace(/^\uFEFF/, "").trim();

  if (!trimmedText) {
    throw new Error("取り込み内容が空です。CSVファイルを選ぶか、Excelから表を貼り付けてください。");
  }

  if (trimmedText.length > maxTextLength) {
    throw new Error(`取り込み内容が大きすぎます。${maxRows}行以内を目安に分けて取り込んでください。`);
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
    throw new Error("発注先名の列が必要です。ヘッダーに「発注先名」または「name」を含めてください。");
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

export function buildSupplierImportPreview(options: {
  text: string;
  sourceType: SupplierImportSourceType;
  existingSupplierNames: string[];
}): SupplierImportPreview {
  const rawRows = parseDelimitedText(options.text, options.sourceType);
  const existingSupplierNames = new Set(
    options.existingSupplierNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const seenSupplierNames = new Set<string>();
  const rows = rawRows.map((rawRow): SupplierImportParsedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = (rawRow.values.name ?? "").trim();
    const normalizedName = name.toLowerCase();

    if (!name) {
      errors.push("発注先名は必須です。");
    } else if (name.length > 100) {
      errors.push("発注先名は100文字以内で入力してください。");
    }

    const address = nullableText(rawRow.values.address, 300, "住所", errors);
    const phone = nullableText(rawRow.values.phone, 100, "電話番号", errors);
    const fax = nullableText(rawRow.values.fax, 100, "FAX番号", errors);
    const email = nullableEmail(rawRow.values.email, "メールアドレス", errors);
    const contactPersonName = nullableText(rawRow.values.contactPersonName, 100, "担当者名", errors);
    const contactPersonEmail = nullableEmail(rawRow.values.contactPersonEmail, "担当者メールアドレス", errors);
    const notes = nullableText(rawRow.values.notes, 1000, "備考", errors);

    if (normalizedName && existingSupplierNames.has(normalizedName)) {
      warnings.push("同じ発注先名が既にあります。この行はスキップします。");
    }

    if (normalizedName && seenSupplierNames.has(normalizedName)) {
      warnings.push("同じファイル内に同じ発注先名があります。この行はスキップします。");
    }

    if (normalizedName) {
      seenSupplierNames.add(normalizedName);
    }

    const isDuplicate = warnings.some((warning) => warning.includes("スキップ"));
    const willCreate = errors.length === 0 && !isDuplicate;

    return {
      rowNumber: rawRow.rowNumber,
      name,
      address,
      phone,
      fax,
      email,
      contactPersonName,
      contactPersonEmail,
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
