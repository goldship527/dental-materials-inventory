import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import xlrd
except ImportError:
    print(
        "xlrd が見つかりません。古い .xls を読むため、ローカル環境に xlrd を用意してから再実行してください。",
        file=sys.stderr,
    )
    raise


DEFAULT_SOURCE_FILES = [
    Path(r"C:\Users\topro\OneDrive\デスクトップ\一時保存フォルダ\0351141001-1.xls"),
    Path(r"C:\Users\topro\OneDrive\デスクトップ\一時保存フォルダ\0351141001-2.xls"),
    Path(r"C:\Users\topro\OneDrive\デスクトップ\一時保存フォルダ\0351141001-3.xls"),
    Path(r"C:\Users\topro\OneDrive\デスクトップ\一時保存フォルダ\0351141001-4.xls"),
]

CACHE_PATH = Path("data/local/medical-device-samples.json")


def cell_text(value):
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value)
    return str(value).strip()


def normalize_code(value):
    text = cell_text(value)
    if text in {"", "-", "－", "ー"}:
        return ""
    return re.sub(r"\s+", "", text)


def normalize_jan(value):
    digits = re.sub(r"\D", "", cell_text(value))
    return digits if len(digits) == 13 else ""


def header_index(headers, label):
    normalized = [header.replace("\n", "").replace(" ", "").replace("　", "") for header in headers]
    target = label.replace("\n", "").replace(" ", "").replace("　", "")
    try:
        return normalized.index(target)
    except ValueError:
        return -1


def build_records(source_files):
    records = []
    duplicate_counts = {}

    for source_file in source_files:
        book = xlrd.open_workbook(str(source_file), on_demand=True)
        for sheet in book.sheets():
            header_row = 2
            headers = [cell_text(sheet.cell_value(header_row, col_index)) for col_index in range(sheet.ncols)]
            indexes = {
                "manufacturer": header_index(headers, "製造販売業者名"),
                "nameKana": header_index(headers, "フリガナ（製品名）"),
                "nameKanaAlt": header_index(headers, "フリガナ（セイ品名）"),
                "productName": header_index(headers, "製品名"),
                "productNameAlt": header_index(headers, "製品名（全角）"),
                "approvalNumber": header_index(headers, "薬事法承認（認証）番号等"),
                "packageUnit": header_index(headers, "包装単位"),
                "jmdnCode": header_index(headers, "ＪＭＤＮコード"),
                "genericName": header_index(headers, "一般的名称"),
                "janCode": header_index(headers, "ＪＡＮコード（商品コード）"),
                "productNumber": header_index(headers, "製品番号"),
                "classCategory": header_index(headers, "クラス分類"),
                "note": header_index(headers, "備考"),
            }

            for row_index in range(header_row + 1, sheet.nrows):
                row = [sheet.cell_value(row_index, col_index) for col_index in range(sheet.ncols)]
                jan_code = normalize_jan(row[indexes["janCode"]]) if indexes["janCode"] >= 0 else ""

                if not jan_code:
                    continue

                product_name_index = indexes["productName"] if indexes["productName"] >= 0 else indexes["productNameAlt"]
                kana_index = indexes["nameKana"] if indexes["nameKana"] >= 0 else indexes["nameKanaAlt"]
                product_name = normalize_code(row[product_name_index]) if product_name_index >= 0 else ""

                if not product_name:
                    continue

                duplicate_counts[jan_code] = duplicate_counts.get(jan_code, 0) + 1
                records.append(
                    {
                        "sourceFile": source_file.name,
                        "sourceSheet": sheet.name,
                        "sourceRow": row_index + 1,
                        "janCode": jan_code,
                        "productName": product_name,
                        "productNameKana": normalize_code(row[kana_index]) if kana_index >= 0 else "",
                        "manufacturer": normalize_code(row[indexes["manufacturer"]]) if indexes["manufacturer"] >= 0 else "",
                        "packageUnit": normalize_code(row[indexes["packageUnit"]]) if indexes["packageUnit"] >= 0 else "",
                        "jmdnCode": normalize_code(row[indexes["jmdnCode"]]) if indexes["jmdnCode"] >= 0 else "",
                        "genericName": normalize_code(row[indexes["genericName"]]) if indexes["genericName"] >= 0 else "",
                        "approvalNumber": normalize_code(row[indexes["approvalNumber"]]) if indexes["approvalNumber"] >= 0 else "",
                        "productNumber": normalize_code(row[indexes["productNumber"]]) if indexes["productNumber"] >= 0 else "",
                        "classCategory": normalize_code(row[indexes["classCategory"]]) if indexes["classCategory"] >= 0 else "",
                        "note": normalize_code(row[indexes["note"]]) if indexes["note"] >= 0 else "",
                    }
                )

    for record in records:
        record["isDuplicateJan"] = duplicate_counts[record["janCode"]] > 1

    return records


def main():
    source_files = [Path(arg) for arg in sys.argv[1:]] or DEFAULT_SOURCE_FILES
    records = build_records(source_files)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFiles": [str(path) for path in source_files],
        "recordCount": len(records),
        "records": records,
    }

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(records)} records written to {CACHE_PATH}")


if __name__ == "__main__":
    main()
