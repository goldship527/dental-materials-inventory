import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const demoLoginEmail = process.env.DEMO_LOGIN_EMAIL?.trim() || "test@example.com";
const demoLoginPassword = process.env.DEMO_LOGIN_PASSWORD || "password";
const demoUserName = normalizeDemoUserName(process.env.DEMO_USER_NAME);

function normalizeDemoUserName(value: string | undefined) {
  const name = value?.trim() || "テストユーザー";
  const utf8ByteLength = Buffer.byteLength(name, "utf8");

  if (utf8ByteLength === 0 || utf8ByteLength > 120) {
    throw new Error("DEMO_USER_NAME must be 1 to 120 bytes as UTF-8.");
  }

  if (name.includes("�") || /[繝譁縺螳]/.test(name)) {
    throw new Error(
      "DEMO_USER_NAME looks garbled. Set it again as UTF-8 text, for example テストユーザー.",
    );
  }

  return name;
}

const suppliers = [
  "架空ディーラーA",
  "架空ディーラーB",
  "架空ディーラーC",
  "架空メディカルサプライ",
  "架空デンタル物流",
];

const productTemplates = [
  ["グローブ S", "グローブ", "箱", 4],
  ["グローブ M", "グローブ", "箱", 5],
  ["グローブ L", "グローブ", "箱", 4],
  ["サージカルマスク", "マスク", "箱", 6],
  ["フェイスシールド", "マスク", "箱", 3],
  ["紙コップ 透明", "紙コップ", "パック", 8],
  ["紙コップ 白", "紙コップ", "パック", 8],
  ["患者用エプロン 青", "エプロン", "箱", 6],
  ["患者用エプロン 白", "エプロン", "箱", 6],
  ["滅菌バッグ S", "滅菌", "箱", 5],
  ["滅菌バッグ M", "滅菌", "箱", 5],
  ["滅菌バッグ L", "滅菌", "箱", 5],
  ["印象材 レギュラー", "印象材", "セット", 3],
  ["印象材 ファスト", "印象材", "セット", 3],
  ["アルジネート標準", "印象材", "袋", 4],
  ["咬合採得材", "印象材", "本", 2],
  ["仮封材", "セメント", "本", 2],
  ["接着性レジンセメント", "セメント", "本", 2],
  ["グラスアイオノマー", "セメント", "セット", 2],
  ["ボンディング材", "接着材", "本", 2],
  ["エッチング材", "接着材", "本", 2],
  ["コンポジットレジン A2", "レジン材料", "本", 3],
  ["コンポジットレジン A3", "レジン材料", "本", 3],
  ["フロアブルレジン", "レジン材料", "本", 3],
  ["研磨ディスク 粗", "研磨材", "箱", 2],
  ["研磨ディスク 中", "研磨材", "箱", 2],
  ["研磨ディスク 細", "研磨材", "箱", 2],
  ["研磨ポイント", "研磨材", "箱", 2],
  ["カーバイドバー", "バー類", "箱", 2],
  ["ダイヤモンドバー", "バー類", "箱", 2],
  ["仕上げ用バー", "バー類", "箱", 2],
  ["根管洗浄チップ", "根管材料", "袋", 2],
  ["ペーパーポイント", "根管材料", "箱", 4],
  ["ガッタパーチャ", "根管材料", "箱", 4],
  ["ロールワッテ", "衛生材料", "袋", 5],
  ["コットンペレット", "衛生材料", "袋", 5],
  ["ガーゼ", "衛生材料", "袋", 5],
  ["バキュームチップ", "診療補助", "袋", 6],
  ["排唾管", "診療補助", "袋", 6],
  ["ミキシングチップ", "診療補助", "袋", 3],
  ["シリンジチップ", "診療補助", "袋", 4],
  ["プロフィーカップ", "予防材料", "袋", 3],
  ["PMTCブラシ", "予防材料", "袋", 3],
  ["フッ素ジェル", "予防材料", "本", 2],
  ["歯面清掃ペースト", "予防材料", "本", 2],
  ["技工用石膏", "技工材料", "袋", 2],
  ["模型用ワックス", "技工材料", "箱", 2],
  ["咬合紙", "診療補助", "箱", 4],
  ["ラバーダムシート", "診療補助", "箱", 2],
  ["使い捨てトレー", "診療補助", "袋", 5],
] as const;

function quantityFor(index: number, minStock: number) {
  if (index < 5) {
    return 0;
  }

  if (index < 10) {
    return Math.max(1, minStock - 1);
  }

  return minStock + ((index * 3) % 8);
}

async function main() {
  await prisma.orderRequest.deleteMany();
  await prisma.orderRecord.deleteMany();
  await prisma.favoriteProductCard.deleteMany();
  await prisma.productBarcode.deleteMany();
  await prisma.barcodeScanLog.deleteMany();
  await prisma.productImportHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockLot.deleteMany();
  await prisma.stocktakeSessionItem.deleteMany();
  await prisma.stocktakeSession.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.productSupplier.deleteMany();
  await prisma.userClinicAssignment.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.organization.deleteMany();

  const organization = await prisma.organization.create({
    data: {
      name: "テスト法人",
    },
  });

  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "テストクリニック",
      address: "開発用の架空住所",
      phone: "000-0000-0000",
    },
  });

  const passwordHash = await bcrypt.hash(demoLoginPassword, 12);
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: demoUserName,
      email: demoLoginEmail,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });

  const supplierRecords = [];
  for (const name of suppliers) {
    supplierRecords.push(
      await prisma.supplier.create({
        data: {
          organizationId: organization.id,
          name,
        },
      }),
    );
  }

  const products = [];
  for (const [index, template] of productTemplates.entries()) {
    const [name, category, orderUnit, defaultMinStock] = template;
    const supplier = supplierRecords[index % supplierRecords.length];
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        productCode: `P-${String(index + 1).padStart(4, "0")}`,
        janCode: `49000000${String(index + 1).padStart(5, "0")}`,
        internalCode: `DMI-${String(index + 1).padStart(3, "0")}`,
        name,
        nameKana: name,
        category,
        manufacturer: `架空メーカー${(index % 6) + 1}`,
        specification: `${orderUnit}単位の開発用データ`,
        orderUnit,
        primarySupplierId: supplier.id,
        supplierProductCode: `SUP-${String(index + 1).padStart(4, "0")}`,
        standardPrice: 500 + index * 120,
        defaultMinStock,
        isActive: true,
        notes: "開発用の架空商品",
      },
    });
    products.push(product);

    if (product.janCode) {
      await prisma.productBarcode.create({
        data: {
          organizationId: organization.id,
          productId: product.id,
          barcode: product.janCode,
          barcodeType: "JAN",
          unitLabel: orderUnit,
          isPrimary: true,
        },
      });
    }

    const quantity = quantityFor(index, defaultMinStock);
    await prisma.stockItem.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        quantity,
        minStock: index % 4 === 0 ? defaultMinStock + 1 : null,
        location: `棚-${(index % 8) + 1}`,
        isUsed: true,
      },
    });
  }

  for (const [index, product] of products.slice(0, 20).entries()) {
    await prisma.favoriteProductCard.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        displayOrder: index + 1,
        categoryTab: product.category,
      },
    });
  }

  console.log("Seed completed");
  console.log(`Login email: ${user.email}`);
  console.log("Login password: value from DEMO_LOGIN_PASSWORD, or local default if unset");
  console.log(`Products: ${products.length}`);
  console.log("Intentional shortages: first 10 products");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
