import assert from "node:assert/strict";
import test from "node:test";
import { getDailyCardSpecification } from "../src/lib/products/daily-card-display";

test("daily cards hide the original order name while retaining the useful specification", () => {
  assert.equal(
    getDailyCardSpecification("対象規格: オレンジ A1 / 元表発注名: エクザファイン パテタイプ [GC] 1セット"),
    "対象規格: オレンジ A1",
  );
  assert.equal(
    getDailyCardSpecification("元表発注名: A / 対象規格: オレンジ"),
    "対象規格: オレンジ",
  );
  assert.equal(getDailyCardSpecification("対象規格: A ／ 元表発注名： B"), "対象規格: A");
  assert.equal(getDailyCardSpecification("対象規格: A / 元表発注名 B"), "対象規格: A");
  assert.equal(getDailyCardSpecification("元表発注名：エクザファイン パテタイプ [GC] 1セット"), null);
  assert.equal(getDailyCardSpecification("容量 500g"), "容量 500g");
  assert.equal(getDailyCardSpecification(null), null);
});
