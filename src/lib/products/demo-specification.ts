const generatedDemoSpecificationPattern = /^(箱|パック|セット|袋|本)単位の開発用データ$/;

export function buildDemoSpecification(productName: string, orderUnit: string | null) {
  if (productName.startsWith("グローブ ")) {
    const size = productName.replace("グローブ ", "");

    return `ニトリル・${size}サイズ / 100枚入`;
  }

  if (productName === "サージカルマスク") {
    return "ふつうサイズ / 50枚入";
  }

  if (productName === "フェイスシールド") {
    return "10枚入";
  }

  if (productName.startsWith("紙コップ")) {
    const color = productName.replace("紙コップ ", "");

    return `${color} / 200mL / 100個入`;
  }

  if (productName.startsWith("患者用エプロン")) {
    const color = productName.replace("患者用エプロン ", "");

    return `${color} / 500枚入`;
  }

  if (productName.startsWith("滅菌バッグ ")) {
    const size = productName.replace("滅菌バッグ ", "");

    return `${size}サイズ / 200枚入`;
  }

  if (productName.startsWith("印象材 ")) {
    const type = productName.replace("印象材 ", "");

    return `${type}タイプ / 2本入`;
  }

  if (productName.startsWith("コンポジットレジン ")) {
    const shade = productName.replace("コンポジットレジン ", "");

    return `${shade}シェード / 1本`;
  }

  if (productName.startsWith("研磨ディスク ")) {
    const grit = productName.replace("研磨ディスク ", "");

    return `${grit} / 100枚入`;
  }

  if (productName.includes("バー")) {
    return "標準タイプ / 5本入";
  }

  if (productName.includes("チップ")) {
    return "標準タイプ / 50個入";
  }

  if (productName.includes("ポイント")) {
    return "標準サイズ / 200本入";
  }

  if (productName.includes("ジェル") || productName.includes("ペースト")) {
    return "標準タイプ / 1本";
  }

  const fallbackByOrderUnit: Record<string, string> = {
    箱: "標準タイプ / 1箱",
    パック: "標準タイプ / 1パック",
    セット: "標準タイプ / 1セット",
    袋: "標準タイプ / 1袋",
    本: "標準タイプ / 1本",
  };

  return fallbackByOrderUnit[orderUnit ?? ""] ?? "標準タイプ";
}

export function normalizeDemoSpecification(
  specification: string | null,
  productName: string,
  orderUnit: string | null,
) {
  if (!specification || !generatedDemoSpecificationPattern.test(specification)) {
    return specification;
  }

  return buildDemoSpecification(productName, orderUnit);
}
