import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const fixturePath = resolve("output/playwright/orders-responsive-fixture.html");
const outputPath = resolve("output/playwright/orders-responsive-shell-fixture.html");
let html = readFileSync(fixturePath, "utf8");
html = html.replace(
  '<body><main class="mx-auto w-full max-w-7xl px-6 pt-3 pb-6 max-sm:px-3">',
  '<body><nav class="h-14 bg-accent print:hidden"></nav><main class="px-3 pt-3 pb-6 lg:px-6">',
);
const header = '<header class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 print:border-b print:border-ink print:pb-3"><h1 class="text-xl font-semibold text-ink print:text-2xl">発注</h1><div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3"><div><p class="mt-2 text-sm text-muted print:text-xs print:text-ink">発行日時: 2026/10/09 09:00</p></div><div class="flex w-full gap-2 overflow-x-auto pb-1 print:hidden md:w-auto md:justify-end md:overflow-visible md:pb-0"><a class="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold" href="#">不足一覧へ</a><a class="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold" href="#">発注書下書き</a><a class="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold" href="#">発注記録</a><button class="h-10 rounded btn-secondary px-3 text-sm font-semibold">印刷</button></div></div></header>';
html = html.replace(/<header class="border-b border-line pb-3">.*?<\/header>/s, header);
writeFileSync(outputPath, html);
console.log("Shell fixture written");
