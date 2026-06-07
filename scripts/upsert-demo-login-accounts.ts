import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const organizationName = "テスト法人";
const clinic1Name = "クリニック1";
const clinic2Name = "クリニック2";
const oldClinic1Names = ["テストクリニック"];
const oldClinic2Names = ["テスト分院"];

const clinic1LoginEmail = process.env.DEMO_LOGIN_EMAIL?.trim() || "test@example.com";
const clinic1LoginPassword = process.env.DEMO_LOGIN_PASSWORD || "password";
const clinic1UserName = process.env.DEMO_USER_NAME?.trim() || "クリニック1共通";
const clinic2LoginEmail = process.env.DEMO_CLINIC2_LOGIN_EMAIL?.trim() || "clinic2@example.com";
const clinic2LoginPassword = process.env.DEMO_CLINIC2_LOGIN_PASSWORD || clinic1LoginPassword;
const clinic2UserName = process.env.DEMO_CLINIC2_USER_NAME?.trim() || "クリニック2共通";
const adminLoginEmail = process.env.DEMO_ADMIN_EMAIL?.trim() || "admin@example.com";
const adminLoginPassword = process.env.DEMO_ADMIN_PASSWORD || clinic1LoginPassword;
const adminUserName = process.env.DEMO_ADMIN_USER_NAME?.trim() || "管理者個人アカウント";

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

async function resolveClinic(options: {
  organizationId: string;
  name: string;
  oldNames: string[];
  address: string;
  phone: string;
}) {
  const clinic = await prisma.clinic.findFirst({
    where: {
      organizationId: options.organizationId,
      name: options.name,
    },
    select: {
      id: true,
      name: true,
    },
  });
  const oldClinic = clinic
    ? null
    : await prisma.clinic.findFirst({
        where: {
          organizationId: options.organizationId,
          name: {
            in: options.oldNames,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      });
  const targetClinic = clinic ?? oldClinic;

  if (targetClinic) {
    return prisma.clinic.update({
      where: {
        id: targetClinic.id,
      },
      data: {
        name: options.name,
        address: options.address,
        phone: options.phone,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  return prisma.clinic.create({
    data: {
      organizationId: options.organizationId,
      name: options.name,
      address: options.address,
      phone: options.phone,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function upsertUser(options: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "STAFF";
  clinicIds: string[];
}) {
  const email = options.email.toLowerCase();
  const passwordHash = await bcrypt.hash(options.password, 12);
  const user = await prisma.user.upsert({
    where: {
      email,
    },
    create: {
      organizationId: options.organizationId,
      name: options.name,
      email,
      passwordHash,
      role: options.role,
      isActive: true,
    },
    update: {
      organizationId: options.organizationId,
      name: options.name,
      passwordHash,
      role: options.role,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  await prisma.userClinicAssignment.deleteMany({
    where: {
      userId: user.id,
    },
  });

  if (options.clinicIds.length > 0) {
    await prisma.userClinicAssignment.createMany({
      data: options.clinicIds.map((clinicId) => ({
        userId: user.id,
        clinicId,
      })),
      skipDuplicates: true,
    });
  }

  return user;
}

async function upsertStaffOperator(options: {
  organizationId: string;
  clinicId: string;
  displayName: string;
  barcode: string;
}) {
  const staffOperator = await prisma.staffOperator.upsert({
    where: {
      organizationId_barcode: {
        organizationId: options.organizationId,
        barcode: options.barcode,
      },
    },
    create: {
      organizationId: options.organizationId,
      displayName: options.displayName,
      barcode: options.barcode,
      operatorType: "REGULAR",
      isActive: true,
    },
    update: {
      displayName: options.displayName,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  await prisma.staffOperatorClinicAssignment.upsert({
    where: {
      staffOperatorId_clinicId: {
        staffOperatorId: staffOperator.id,
        clinicId: options.clinicId,
      },
    },
    create: {
      staffOperatorId: staffOperator.id,
      clinicId: options.clinicId,
    },
    update: {},
  });

  return staffOperator;
}

async function main() {
  assertUniqueDemoEmails([
    { label: "Clinic 1 account", email: clinic1LoginEmail },
    { label: "Clinic 2 account", email: clinic2LoginEmail },
    { label: "Admin account", email: adminLoginEmail },
  ]);

  const organization = await prisma.organization.findFirst({
    where: {
      name: organizationName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    throw new Error(`${organizationName} が見つかりません。先に通常の開発DBを用意してください。`);
  }

  const clinic1 = await resolveClinic({
    organizationId: organization.id,
    name: clinic1Name,
    oldNames: oldClinic1Names,
    address: "開発用の架空住所",
    phone: "000-0000-0000",
  });
  const clinic2 = await resolveClinic({
    organizationId: organization.id,
    name: clinic2Name,
    oldNames: oldClinic2Names,
    address: "開発用の架空住所 2",
    phone: "000-0000-0001",
  });

  const clinic1User = await upsertUser({
    organizationId: organization.id,
    name: clinic1UserName,
    email: clinic1LoginEmail,
    password: clinic1LoginPassword,
    role: "STAFF",
    clinicIds: [clinic1.id],
  });
  const clinic2User = await upsertUser({
    organizationId: organization.id,
    name: clinic2UserName,
    email: clinic2LoginEmail,
    password: clinic2LoginPassword,
    role: "STAFF",
    clinicIds: [clinic2.id],
  });
  const adminUser = await upsertUser({
    organizationId: organization.id,
    name: adminUserName,
    email: adminLoginEmail,
    password: adminLoginPassword,
    role: "ADMIN",
    clinicIds: [clinic1.id, clinic2.id],
  });

  await upsertStaffOperator({
    organizationId: organization.id,
    clinicId: clinic1.id,
    displayName: "クリニック1スタッフ",
    barcode: "STAFF-0001",
  });
  await upsertStaffOperator({
    organizationId: organization.id,
    clinicId: clinic2.id,
    displayName: "クリニック2スタッフ",
    barcode: "STAFF-0002",
  });

  console.log(
    JSON.stringify(
      {
        organization: organization.name,
        clinics: [clinic1.name, clinic2.name],
        accounts: [
          { email: clinic1User.email, role: clinic1User.role, clinics: [clinic1.name] },
          { email: clinic2User.email, role: clinic2User.role, clinics: [clinic2.name] },
          { email: adminUser.email, role: adminUser.role, clinics: [clinic1.name, clinic2.name] },
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
