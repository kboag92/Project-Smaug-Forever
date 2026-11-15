import assert from "node:assert/strict";
import test from "node:test";
import { findDeals, type BookRow } from "./arbitrage.js";

const names = new Map([[1, { name: "Linen", icon: null }]]);

function row(itemId: number, p10: number, quantity = 20): BookRow {
  return { itemId, p10, quantity };
}

test("buying the cheaper house clears the 5% cut", () => {
  const deals = findDeals([row(1, 100)], [row(1, 200)], names);
  assert.equal(deals.length, 1);
  assert.equal(deals[0].direction, "alliance-neutral");
  assert.equal(deals[0].receive, 190);
  assert.equal(deals[0].edge, 90);
  assert.equal(deals[0].buyQty, 20);
  assert.equal(deals[0].sellQty, 20);
});

test("the other direction is used when neutral is cheaper", () => {
  const deals = findDeals([row(1, 200)], [row(1, 100)], names);
  assert.equal(deals[0].direction, "neutral-alliance");
  assert.equal(deals[0].edge, 90);
});

test("equal prices do not show, because the cut takes the edge", () => {
  assert.deepEqual(findDeals([row(1, 100)], [row(1, 100)], names), []);
});

test("an item listed on only one house is skipped", () => {
  assert.deepEqual(findDeals([row(1, 100)], [], names), []);
});

test("a missing or zero price is skipped", () => {
  assert.deepEqual(findDeals([row(1, 0)], [row(1, 200)], names), []);
});

test("half a copper rounds the payout up", () => {
  const deals = findDeals([row(1, 9)], [row(1, 10)], names);
  assert.equal(deals[0].receive, 10);
  assert.equal(deals[0].edge, 1);
});
