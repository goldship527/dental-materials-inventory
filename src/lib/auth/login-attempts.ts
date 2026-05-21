import { prisma } from "@/lib/db/prisma";

const maxFailedAttempts = 5;
const lockMinutes = 15;
const defaultIpAddress = "unknown";

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeIpAddress(ipAddress?: string | null) {
  const value = ipAddress?.trim();

  return value || defaultIpAddress;
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  return normalizeIpAddress(forwardedFor || realIp);
}

export async function isLoginLocked(options: {
  email: string;
  ipAddress?: string | null;
  now?: Date;
}) {
  const email = normalizeLoginEmail(options.email);
  const ipAddress = normalizeIpAddress(options.ipAddress);
  const now = options.now ?? new Date();
  const attempt = await prisma.loginAttempt.findUnique({
    where: {
      email_ipAddress: {
        email,
        ipAddress,
      },
    },
    select: {
      lockedUntil: true,
    },
  });

  return Boolean(attempt?.lockedUntil && attempt.lockedUntil > now);
}

export async function recordLoginFailure(options: {
  email: string;
  ipAddress?: string | null;
  now?: Date;
}) {
  const email = normalizeLoginEmail(options.email);
  const ipAddress = normalizeIpAddress(options.ipAddress);
  const now = options.now ?? new Date();
  const existingAttempt = await prisma.loginAttempt.findUnique({
    where: {
      email_ipAddress: {
        email,
        ipAddress,
      },
    },
    select: {
      failedCount: true,
      lockedUntil: true,
    },
  });

  if (existingAttempt?.lockedUntil && existingAttempt.lockedUntil > now) {
    return existingAttempt.lockedUntil;
  }

  const failedCount = (existingAttempt?.failedCount ?? 0) + 1;
  const lockedUntil =
    failedCount >= maxFailedAttempts ? new Date(now.getTime() + lockMinutes * 60 * 1000) : null;

  await prisma.loginAttempt.upsert({
    where: {
      email_ipAddress: {
        email,
        ipAddress,
      },
    },
    create: {
      email,
      ipAddress,
      failedCount,
      lockedUntil,
      lastFailedAt: now,
    },
    update: {
      failedCount,
      lockedUntil,
      lastFailedAt: now,
    },
  });

  return lockedUntil;
}

export async function resetLoginFailures(options: {
  email: string;
  ipAddress?: string | null;
}) {
  const email = normalizeLoginEmail(options.email);
  const ipAddress = normalizeIpAddress(options.ipAddress);

  await prisma.loginAttempt.deleteMany({
    where: {
      email,
      ipAddress,
    },
  });
}

export async function cleanupOldLoginAttempts(options?: { olderThanDays?: number }) {
  const days = options?.olderThanDays ?? 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await prisma.loginAttempt.deleteMany({
    where: {
      updatedAt: {
        lt: cutoff,
      },
    },
  });
}
