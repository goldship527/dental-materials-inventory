import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildDemoSpecification } from "../src/lib/products/demo-specification";

const prisma = new PrismaClient();

const clinic1LoginEmail = process.env.DEMO_LOGIN_EMAIL?.trim() || "test@example.com";
const clinic1LoginPassword = process.env.DEMO_LOGIN_PASSWORD || "password";
const clinic1UserName = normalizeDemoUserName(process.env.DEMO_USER_NAME, "クリニック1共通");
const clinic2LoginEmail = process.env.DEMO_CLINIC2_LOGIN_EMAIL?.trim() || "clinic2@example.com";
const clinic2LoginPassword = process.env.DEMO_CLINIC2_LOGIN_PASSWORD || clinic1LoginPassword;
const clinic2UserName = normalizeDemoUserName(process.env.DEMO_CLINIC2_USER_NAME, "クリニック2共通");
const adminLoginEmail = process.env.DEMO_ADMIN_EMAIL?.trim() || "admin@example.com";
const adminLoginPassword = process.env.DEMO_ADMIN_PASSWORD || clinic1LoginPassword;
const adminUserName = normalizeDemoUserName(process.env.DEMO_ADMIN_USER_NAME, "管理者個人アカウント");

function normalizeDemoUserName(value: string | undefined, fallback: string) {
  const name = value?.trim() || fallback;
  const utf8ByteLength = Buffer.byteLength(name, "utf8");

  if (utf8ByteLength === 0 || utf8ByteLength > 120) {
    throw new Error("Demo user display names must be 1 to 120 bytes as UTF-8.");
  }

  if (name.includes("�") || /[繝譁縺螳]/.test(name)) {
    throw new Error(
      "A demo user display name looks garbled. Set it again as UTF-8 text, for example クリニック1共通.",
    );
  }

  return name;
}

function assertUniqueDemoEmails(accounts: { label: string; email: string }[]) {
  const seen = new Map<string, string>();

  for (const account of accounts) {
    const email = account.email.toLowerCase();
    const existingLabel = seen.get(email);

    if (existingLabel) {
      throw new Error(`${account.label} and ${existingLabel} must use different demo login emails.`);
    }

    seen.set(email, account.label);
  }
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

function clinic2QuantityFor(index: number, minStock: number) {
  if (index < 3) {
    return 0;
  }

  if (index < 8) {
    return Math.max(1, minStock - 1);
  }

  return minStock + 1 + ((index * 5) % 6);
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
  await prisma.staffOperatorClinicAssignment.deleteMany();
  await prisma.staffOperator.deleteMany();
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
      name: "クリニック1",
      address: "開発用の架空住所",
      phone: "000-0000-0000",
    },
  });

  const clinic2 = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "クリニック2",
      address: "開発用の架空住所 2",
      phone: "000-0000-0001",
    },
  });

  assertUniqueDemoEmails([
    { label: "Clinic 1 account", email: clinic1LoginEmail },
    { label: "Clinic 2 account", email: clinic2LoginEmail },
    { label: "Admin account", email: adminLoginEmail },
  ]);

  const clinic1PasswordHash = await bcrypt.hash(clinic1LoginPassword, 12);
  const clinic1User = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: clinic1UserName,
      email: clinic1LoginEmail.toLowerCase(),
      passwordHash: clinic1PasswordHash,
      role: "STAFF",
      isActive: true,
    },
  });

  const clinic2PasswordHash = await bcrypt.hash(clinic2LoginPassword, 12);
  const clinic2User = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: clinic2UserName,
      email: clinic2LoginEmail.toLowerCase(),
      passwordHash: clinic2PasswordHash,
      role: "STAFF",
      isActive: true,
    },
  });

  const adminPasswordHash = await bcrypt.hash(adminLoginPassword, 12);
  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: adminUserName,
      email: adminLoginEmail.toLowerCase(),
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.userClinicAssignment.createMany({
    data: [
      {
        userId: clinic1User.id,
        clinicId: clinic.id,
      },
      {
        userId: clinic2User.id,
        clinicId: clinic2.id,
      },
      {
        userId: adminUser.id,
        clinicId: clinic.id,
      },
      {
        userId: adminUser.id,
        clinicId: clinic2.id,
      },
    ],
  });

  await prisma.staffOperator.create({
    data: {
      organizationId: organization.id,
      displayName: "クリニック1スタッフ",
      barcode: "STAFF-0001",
      operatorType: "REGULAR",
      clinicAssignments: {
        create: {
          clinicId: clinic.id,
        },
      },
    },
  });

  await prisma.staffOperator.create({
    data: {
      organizationId: organization.id,
      displayName: "クリニック2スタッフ",
      barcode: "STAFF-0002",
      operatorType: "REGULAR",
      clinicAssignments: {
        create: {
          clinicId: clinic2.id,
        },
      },
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
        specification: buildDemoSpecification(name, orderUnit),
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

    const clinic2Quantity = clinic2QuantityFor(index, defaultMinStock);
    await prisma.stockItem.create({
      data: {
        clinicId: clinic2.id,
        productId: product.id,
        quantity: clinic2Quantity,
        minStock: index % 5 === 0 ? defaultMinStock + 2 : null,
        location: `クリニック2棚-${(index % 6) + 1}`,
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

  for (const [index, product] of products.slice(0, 12).entries()) {
    await prisma.favoriteProductCard.create({
      data: {
        clinicId: clinic2.id,
        productId: product.id,
        displayOrder: index + 1,
        categoryTab: product.category,
      },
    });
  }

  console.log("Seed completed");
  console.log(`Clinic 1 account: ${clinic1User.email} / STAFF`);
  console.log(`Clinic 2 account: ${clinic2User.email} / STAFF`);
  console.log(`Admin account: ${adminUser.email} / ADMIN`);
  console.log("Login passwords: values from DEMO_*_PASSWORD, or local default if unset");
  console.log("Clinics: 2");
  console.log(`Products: ${products.length}`);
  console.log("Intentional shortages: first 10 products in clinic 1, first 8 products in clinic 2");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
