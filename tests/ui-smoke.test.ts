import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import bcrypt from "bcryptjs";
import { activeClinicCookieName } from "../src/lib/db/clinic";
import { resetTestDatabase, testDatabaseUrl } from "./helpers/db";

const adminEmail = "ui-smoke-admin@example.test";
const adminPassword = "AdminSmoke123!";
const staffEmail = "ui-smoke-staff@example.test";
const staffPassword = "StaffSmoke123!";
const authSecret = "ui-smoke-test-auth-secret-at-least-32-chars";
const mainClinicName = "UIスモーククリニック1";
const branchClinicName = "UIスモーククリニック2";

type SeedResult = {
  mainClinicId: string;
  branchClinicId: string;
  product9Id: string;
};

type HttpResult = {
  status: number;
  headers: Headers;
  body: string;
};

class CookieJar {
  private readonly values = new Map<string, string>();

  storeFrom(headers: Headers) {
    for (const cookie of getSetCookieValues(headers)) {
      const firstPart = cookie.split(";")[0] ?? "";
      const separatorIndex = firstPart.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const name = firstPart.slice(0, separatorIndex);
      const value = firstPart.slice(separatorIndex + 1);

      if (value) {
        this.values.set(name, value);
      } else {
        this.values.delete(name);
      }
    }
  }

  set(name: string, value: string) {
    this.values.set(name, value);
  }

  header() {
    return Array.from(this.values.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

function getSetCookieValues(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const combined = headers.get("set-cookie");

  if (!combined) {
    return [];
  }

  return combined.split(/,(?=\s*[^;,=\s]+=[^;,\s]*)/).map((value) => value.trim());
}

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("テスト用ポートを取得できませんでした。")));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl: string, server: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 90_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js dev server exited early with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/login`, {
        redirect: "manual",
      });

      if (response.status === 200) {
        await response.text();
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next.js dev server did not become ready: ${String(lastError)}`);
}

async function startNextServer(baseUrl: string, port: number) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "corepack";
  const args = isWindows
    ? ["/d", "/s", "/c", `corepack pnpm exec next dev --hostname 127.0.0.1 --port ${port}`]
    : ["pnpm", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)];
  const serverEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1]) && !entry[0].startsWith("=")),
  );
  const server = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...serverEnv,
      AUTH_SECRET: authSecret,
      AUTH_URL: baseUrl,
      NEXTAUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "development",
    },
    stdio: "pipe",
  });
  let output = "";

  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitForServer(baseUrl, server).catch((error) => {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`);
  });

  return server;
}

function stopProcessTree(server: ChildProcessWithoutNullStreams | null) {
  if (!server?.pid || server.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  server.kill("SIGTERM");
}

async function request(baseUrl: string, path: string, jar: CookieJar, init?: RequestInit): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Cookie: jar.header(),
    },
    redirect: init?.redirect ?? "manual",
  });

  jar.storeFrom(response.headers);

  return {
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
}

async function login(baseUrl: string, email: string, password: string) {
  const jar = new CookieJar();
  const csrfResponse = await request(baseUrl, "/api/auth/csrf", jar);

  assert.equal(csrfResponse.status, 200);
  const csrfToken = JSON.parse(csrfResponse.body).csrfToken as string;
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/home`,
    json: "true",
  });
  const loginResponse = await request(baseUrl, "/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  assert.ok([200, 302, 303].includes(loginResponse.status), `login failed with ${loginResponse.status}`);

  const homeResponse = await request(baseUrl, "/home", jar);
  assert.equal(homeResponse.status, 200);
  assertIncludes(homeResponse.body, "ホーム");

  return jar;
}

async function seedUiSmokeDatabase(prisma: typeof import("../src/lib/db/prisma").prisma): Promise<SeedResult> {
  const organization = await prisma.organization.create({
    data: {
      name: "UI Smoke Test Organization",
    },
  });
  const [mainClinic, branchClinic] = await Promise.all([
    prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: mainClinicName,
        address: "開発用テスト住所 クリニック1",
      },
    }),
    prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: branchClinicName,
        address: "開発用テスト住所 クリニック2",
      },
    }),
  ]);
  const [admin, staff] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "UIスモーク管理者",
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "UIスモークスタッフ",
        email: staffEmail,
        passwordHash: await bcrypt.hash(staffPassword, 12),
        role: "STAFF",
        isActive: true,
      },
    }),
  ]);

  await prisma.userClinicAssignment.createMany({
    data: [
      {
        userId: admin.id,
        clinicId: mainClinic.id,
      },
      {
        userId: admin.id,
        clinicId: branchClinic.id,
      },
      {
        userId: staff.id,
        clinicId: mainClinic.id,
      },
    ],
  });

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: organization.id,
      name: "UIスモーク架空ディーラー",
    },
  });
  const staffOperator = await prisma.staffOperator.create({
    data: {
      organizationId: organization.id,
      displayName: "UIスモーク担当者",
      barcode: "UI-SMOKE-STAFF-001",
      clinicAssignments: {
        create: {
          clinicId: mainClinic.id,
        },
      },
    },
  });

  await prisma.staffOperatorClinicAssignment.create({
    data: {
      staffOperatorId: staffOperator.id,
      clinicId: branchClinic.id,
    },
  });

  const products = [];
  for (let index = 1; index <= 10; index += 1) {
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        primarySupplierId: supplier.id,
        productCode: `P-${String(index).padStart(4, "0")}`,
        janCode: `49000000${String(index).padStart(5, "0")}`,
        internalCode: `UI-${String(index).padStart(3, "0")}`,
        name: `UIスモーク商品${String(index).padStart(2, "0")}`,
        category: index <= 5 ? "スモークカテゴリA" : "スモークカテゴリB",
        manufacturer: "UIスモークメーカー",
        specification: "開発用テスト規格",
        orderUnit: "箱",
        supplierProductCode: `SUP-UI-${String(index).padStart(4, "0")}`,
        standardPrice: 1000 + index,
        defaultMinStock: 5,
        isActive: true,
      },
    });

    products.push(product);

    await prisma.productBarcode.create({
      data: {
        organizationId: organization.id,
        productId: product.id,
        barcode: product.janCode!,
        barcodeType: "JAN",
        unitLabel: "箱",
        isPrimary: true,
      },
    });

    await prisma.stockItem.createMany({
      data: [
        {
          clinicId: mainClinic.id,
          productId: product.id,
          quantity: index === 9 ? 3 : index,
          minStock: 5,
          location: `クリニック1棚-${index}`,
          isUsed: true,
        },
        {
          clinicId: branchClinic.id,
          productId: product.id,
          quantity: index === 9 ? 12 : index + 10,
          minStock: 5,
          location: `クリニック2棚-${index}`,
          isUsed: true,
        },
      ],
    });
  }

  const product9 = products[8]!;

  await prisma.favoriteProductCard.createMany({
    data: products.slice(0, 3).map((product, index) => ({
      clinicId: mainClinic.id,
      productId: product.id,
      displayOrder: index + 1,
      categoryTab: product.category,
    })),
  });
  await prisma.orderRequest.create({
    data: {
      clinicId: mainClinic.id,
      productId: product9.id,
      supplierId: supplier.id,
      status: "ORDERED",
      requestedQuantity: 2,
      orderedAt: new Date("2026-06-01T00:00:00.000Z"),
      orderedMethod: "FAX",
      createdByUserId: admin.id,
    },
  });
  await prisma.stockMovement.createMany({
    data: [
      {
        clinicId: mainClinic.id,
        productId: product9.id,
        movementType: "OUT",
        quantity: -9,
        beforeQuantity: 12,
        afterQuantity: 3,
        sourceType: "MANUAL",
        reason: "UI smoke abc rank",
        userId: admin.id,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        clinicId: mainClinic.id,
        productId: products[0]!.id,
        movementType: "OUT",
        quantity: -1,
        beforeQuantity: 2,
        afterQuantity: 1,
        sourceType: "MANUAL",
        reason: "UI smoke secondary rank",
        userId: admin.id,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ],
  });

  return {
    mainClinicId: mainClinic.id,
    branchClinicId: branchClinic.id,
    product9Id: product9.id,
  };
}

function assertIncludes(html: string, text: string) {
  const normalizedHtml = html.replaceAll("<!-- -->", "");

  assert.ok(html.includes(text) || normalizedHtml.includes(text), `expected HTML to include: ${text}`);
}

function assertNotIncludes(html: string, text: string) {
  const normalizedHtml = html.replaceAll("<!-- -->", "");

  assert.ok(!html.includes(text) && !normalizedHtml.includes(text), `expected HTML not to include: ${text}`);
}

function assertTextOrder(html: string, labels: string[]) {
  let previousIndex = -1;

  for (const label of labels) {
    const index = html.indexOf(label, previousIndex + 1);

    assert.notEqual(index, -1, `expected HTML to include: ${label}`);
    assert.ok(index > previousIndex, `expected ${label} to appear after previous label`);
    previousIndex = index;
  }
}

async function assertOkPage(baseUrl: string, jar: CookieJar, path: string) {
  const response = await request(baseUrl, path, jar);

  assert.equal(response.status, 200, `${path} should return 200`);
  assertIncludes(response.body, "ログアウト");

  return response.body;
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const seed = await seedUiSmokeDatabase(prisma);
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: ChildProcessWithoutNullStreams | null = null;

  try {
    server = await startNextServer(baseUrl, port);

    const adminJar = await login(baseUrl, adminEmail, adminPassword);
    const adminPaths = [
      "/home",
      "/products",
      "/inventory",
      "/shortage",
      "/orders",
      "/movements",
      "/admin/overview",
      "/admin/users",
      "/admin/staff-operators",
    ];

    for (const path of adminPaths) {
      await assertOkPage(baseUrl, adminJar, path);
    }

    adminJar.set(activeClinicCookieName, seed.mainClinicId);
    const adminHomeHtml = await assertOkPage(baseUrl, adminJar, "/home");
    assertIncludes(adminHomeHtml, "id=\"active-clinic-id\"");
    assertIncludes(adminHomeHtml, mainClinicName);
    assertIncludes(adminHomeHtml, "管理メニュー");

    const adminInventoryHtml = await assertOkPage(baseUrl, adminJar, "/inventory");
    assertIncludes(adminInventoryHtml, mainClinicName);
    assertIncludes(adminInventoryHtml, "クリニック1棚-9");

    adminJar.set(activeClinicCookieName, seed.branchClinicId);
    const branchHomeHtml = await assertOkPage(baseUrl, adminJar, "/home");
    const branchInventoryHtml = await assertOkPage(baseUrl, adminJar, "/inventory");
    assertIncludes(branchHomeHtml, branchClinicName);
    assertIncludes(branchInventoryHtml, branchClinicName);
    assertIncludes(branchInventoryHtml, "クリニック2棚-9");

    const adminOverviewHtml = await assertOkPage(baseUrl, adminJar, "/admin/overview");
    assertIncludes(adminOverviewHtml, "本部ダッシュボード");
    assertIncludes(adminOverviewHtml, "ログインアカウント");
    assertIncludes(adminOverviewHtml, "担当者");

    adminJar.set(activeClinicCookieName, seed.mainClinicId);
    const productsHtml = await assertOkPage(baseUrl, adminJar, "/products");
    assertTextOrder(productsHtml, ["商品", "現在庫", "納品待ち", "最低在庫", "保管場所", "カテゴリ"]);
    assertIncludes(productsHtml, "P-0009");
    assertIncludes(productsHtml, "JAN 4900000000009");

    const productDetailHtml = await assertOkPage(baseUrl, adminJar, `/products/${seed.product9Id}`);
    assertIncludes(productDetailHtml, "P-0009");
    assertIncludes(productDetailHtml, "4900000000009");
    assertIncludes(productDetailHtml, "使用頻度 A");

    const staffJar = await login(baseUrl, staffEmail, staffPassword);
    const staffHomeHtml = await assertOkPage(baseUrl, staffJar, "/home");
    const staffInventoryHtml = await assertOkPage(baseUrl, staffJar, "/inventory");
    assertIncludes(staffHomeHtml, mainClinicName);
    assertIncludes(staffInventoryHtml, mainClinicName);
    assertIncludes(staffInventoryHtml, "クリニック1棚-9");
    assertNotIncludes(staffHomeHtml, "id=\"active-clinic-id\"");
    assertNotIncludes(staffHomeHtml, branchClinicName);
    assertNotIncludes(staffInventoryHtml, branchClinicName);

    const staffAdminResponse = await request(baseUrl, "/admin/overview", staffJar);
    assert.ok([303, 307, 308].includes(staffAdminResponse.status), `STAFF admin response: ${staffAdminResponse.status}`);
    assert.match(staffAdminResponse.headers.get("location") ?? "", /\/home\?adminDenied=role/);

    console.log("ui-smoke.test.ts passed");
  } finally {
    stopProcessTree(server);
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
