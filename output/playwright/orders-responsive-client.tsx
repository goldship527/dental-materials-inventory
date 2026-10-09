import React from "react";
import { createRoot } from "react-dom/client";
import { OrderRequestTableRow } from "../../src/app/(app)/orders/order-request-row";
import type { OrderRequestRow } from "../../src/lib/db/orders";

const source = document.querySelector("#fixture-data")?.textContent;
if (!source) throw new Error("Missing fixture data");
const rows = JSON.parse(source, (key, value) => key.endsWith("At") && value ? new Date(value) : value) as OrderRequestRow[];
for (const [index, tbody] of document.querySelectorAll<HTMLTableSectionElement>("tbody[data-fixture-group]").entries()) {
  const subset = index === 0 ? rows.slice(0, 5) : rows.slice(5);
  createRoot(tbody).render(subset.map((row) => <OrderRequestTableRow key={row.id} clinicId="fixture" row={row} staffOperators={[]} />));
}
document.body.dataset.hydrated = "true";
