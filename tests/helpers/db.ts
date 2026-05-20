import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const testSchema = "barcode_scan_logs_test";

function readDatabaseUrlFromEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  const envText = readFileSync(envPath, "utf-8");
  const match = envText.match(/^DATABASE_URL=(.+)$/m);

  if (!match) {
    throw new Error(".env に DATABASE_URL が見つかりません。");
  }

  return match[1].trim().replace(/^"|"$/g, "");
}

function buildTestDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL || readDatabaseUrlFromEnvFile();
  const url = new URL(baseUrl);

  url.searchParams.set("schema", testSchema);

  return url.toString();
}

export const testDatabaseUrl = buildTestDatabaseUrl();

process.env.DATABASE_URL = testDatabaseUrl;

if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: "test" });
}

export function resetTestDatabase() {
  assert.match(testDatabaseUrl, new RegExp(`schema=${testSchema}`));

  execSync("corepack pnpm prisma db push --skip-generate --force-reset", {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
    stdio: "inherit",
  });
}
