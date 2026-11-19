import assert from "node:assert/strict";
import test from "node:test";
import { scorePortfolio, shiftUtcDay } from "./portfolio-value.js";

const TODAY = "2026-03-01";

function row(itemId: number, day: string, median: number) {
  return { itemId, day, median };
}

test("a rising holding is today against yesterday, times quantity", () => {
  const score = scorePortfolio(TODAY, [{ itemId: 2589, quantity: 2 }], [
    row(2589, "2026-02-28", 100),
    row(2589, TODAY, 110),
  ]);
  const held = score.items[0];
  assert.equal(held.pct[1], 0.1);
  assert.equal(held.pct[3], null);
  assert.equal(held.pct[7], null);
  assert.equal(held.current, 110);
  // Two units at 110 copper.
  assert.equal(held.value, 220);
  assert.equal(score.total, 220);
  assert.equal(score.day1.pct, 0.1);
  assert.equal(score.day1.count, 1);
  assert.equal(score.size, 1);
});

test("a 3-day move ignores the days in between", () => {
  assert.equal(shiftUtcDay(TODAY, -3), "2026-02-26");
  const score = scorePortfolio(TODAY, [{ itemId: 2589, quantity: 1 }], [
    row(2589, "2026-02-26", 100),
    row(2589, "2026-02-27", 300),
    row(2589, "2026-02-28", 200),
    row(2589, TODAY, 250),
  ]);
  // 100 is the price 3 days ago. 300 and 200 do not count.
  assert.equal(score.items[0].pct[3], 1.5);
  assert.equal(score.day3.pct, 1.5);
});

test("a 7-day move uses the median from exactly 7 days ago", () => {
  assert.equal(shiftUtcDay(TODAY, -7), "2026-02-22");
  const score = scorePortfolio(TODAY, [{ itemId: 2589, quantity: 4 }], [
    row(2589, "2026-02-22", 200),
    row(2589, "2026-02-23", 50),
    row(2589, TODAY, 250),
  ]);
  assert.equal(score.items[0].pct[7], 0.25);
  assert.equal(score.items[0].pct[1], null);
  assert.equal(score.day7.count, 1);
  assert.equal(score.day1.count, 0);
  assert.equal(score.day1.pct, null);
});

test("a missing baseline drops that item from both sides of the window", () => {
  const score = scorePortfolio(TODAY, [
    { itemId: 1, quantity: 1 },
    { itemId: 2, quantity: 100 },
  ], [
    row(1, "2026-02-28", 100),
    row(1, TODAY, 150),
    // Item 2 has no yesterday. Its large quantity must not change the 1-day move.
    row(2, TODAY, 1000),
  ]);
  assert.equal(score.items[0].pct[1], 0.5);
  assert.equal(score.items[1].pct[1], null);
  assert.equal(score.day1.pct, 0.5);
  assert.equal(score.day1.count, 1);
  assert.equal(score.size, 2);
  // Today's total still includes the item that has a price today.
  assert.equal(score.total, 150 + 1000 * 100);
});

test("the portfolio move is weighted by quantity times median", () => {
  const score = scorePortfolio(TODAY, [
    { itemId: 1, quantity: 1 },
    { itemId: 2, quantity: 10 },
  ], [
    row(1, "2026-02-28", 100),
    row(1, TODAY, 200),
    row(2, "2026-02-28", 100),
    row(2, TODAY, 110),
  ]);
  // Then: 1×100 + 10×100 = 1100. Now: 1×200 + 10×110 = 1300.
  // An equal-weight average would be 55%. Value weight is 200/1100.
  assert.equal(score.day1.pct, 2 / 11);
  assert.equal(score.day1.count, 2);
  assert.equal(score.total, 1300);
});

test("a non-positive quantity is not a holding", () => {
  const score = scorePortfolio(TODAY, [{ itemId: 1, quantity: 0 }], [
    row(1, TODAY, 100),
  ]);
  assert.equal(score.size, 0);
  assert.equal(score.total, null);
});
