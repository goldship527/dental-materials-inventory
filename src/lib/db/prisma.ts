import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getProductionDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (process.env.NODE_ENV !== "production" || !databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);

    if ((url.protocol === "postgresql:" || url.protocol === "postgres:") && !url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

const productionDatabaseUrl = getProductionDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    ...(productionDatabaseUrl
      ? {
          datasources: {
            db: {
              url: productionDatabaseUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
