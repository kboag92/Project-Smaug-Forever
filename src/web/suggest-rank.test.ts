import assert from "node:assert/strict";
import test from "node:test";
import { rankSuggestions, type SuggestItem } from "./suggest-rank.js";

function item(itemId: number, name: string): SuggestItem {
  return { itemId, name };
}

test("exact name, then prefix, then contains, then item id", () => {
  const ranked = rankSuggestions([
    item(300, "Bolt of Linen"),
    item(2589, "Wool Cloth"),
    item(100, "Linen Cloth"),
    item(1, "Linen"),
    item(9, "Silk"),
  ], "linen");
  assert.deepEqual(ranked.map((row) => row.name), ["Linen", "Linen Cloth", "Bolt of Linen"]);
});

test("an item id prefix is used when the name does not match", () => {
  const ranked = rankSuggestions([
    item(2589, "Linen Cloth"),
    item(259, "Wool"),
    item(25, "Silk"),
    item(52, "Mageweave"),
  ], "25");
  assert.deepEqual(ranked.map((row) => row.itemId), [2589, 25, 259]);
});

test("one character suggests nothing", () => {
  assert.deepEqual(rankSuggestions([item(1, "Linen")], "l"), []);
  assert.deepEqual(rankSuggestions([item(1, "Linen")], "  "), []);
});

test("eight is the cap and a group stays alphabetical", () => {
  const items = "ABCDEFGHI".split("").map((letter, index) => item(index, "Dust " + letter));
  const ranked = rankSuggestions(items, "dust");
  assert.deepEqual(ranked.map((row) => row.name), [
    "Dust A", "Dust B", "Dust C", "Dust D", "Dust E", "Dust F", "Dust G", "Dust H",
  ]);
});

test("the same item is listed once", () => {
  const ranked = rankSuggestions([item(1, "Linen"), item(1, "Linen Cloth")], "linen");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].name, "Linen");
});
