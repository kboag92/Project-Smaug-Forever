import assert from "node:assert/strict";
import test from "node:test";
import { baskets } from "./enchant-mats.js";
import { scoreBaskets, shiftUtcDay, type BasketScore, type ItemScore } from "./enchant-index.js";

const TODAY = "2026-03-01";

function row(itemId: number, day: string, median: number) {
  return { itemId, day, median };
}

function basket(scores: BasketScore[], id: string): BasketScore {
  const found = scores.find((entry) => entry.id === id);
  if (!found) throw new Error("Missing basket " + id);
  return found;
}

function item(scores: BasketScore[], basketId: string, itemId: number): ItemScore {
  const found = basket(scores, basketId).items.find((entry) => entry.item.itemId === itemId);
  if (!found) throw new Error("Missing item " + itemId);
  return found;
}

test("tier 1 is Strange Dust, Greater Magic Essence, and Large Glimmering Shard", () => {
  const tier = baskets().find((entry) => entry.id === "tier-1");
  assert.deepEqual(tier?.members.map((mat) => mat.itemId), [10940, 10939, 11084]);
  assert.equal(baskets().find((entry) => entry.id === "all")?.members.length, 24);
  assert.equal(baskets().find((entry) => entry.id === "shards")?.members.length, 8);
  assert.equal(baskets().find((entry) => entry.id === "dust")?.members.length, 5);
  assert.equal(baskets().find((entry) => entry.id === "essences")?.members.length, 10);
  assert.equal(baskets().find((entry) => entry.id === "shards")?.members.some((mat) => mat.itemId === 20725), false);
});

test("a 1-day move is today against yesterday", () => {
  const scores = scoreBaskets(TODAY, [row(10940, "2026-02-28", 100), row(10940, TODAY, 110)]);
  const dust = item(scores, "dust", 10940);
  assert.equal(dust.pct[1], 0.1);
  assert.equal(dust.pct[3], null);
  assert.equal(dust.pct[7], null);
});

test("a 3-day move uses the median of the three prior days", () => {
  assert.equal(shiftUtcDay(TODAY, -1), "2026-02-28");
  const scores = scoreBaskets(TODAY, [
    row(10939, "2026-02-26", 100),
    row(10939, "2026-02-27", 300),
    row(10939, "2026-02-28", 200),
    row(10939, TODAY, 250),
  ]);
  // Sorted prior prices are 100, 200, 300. The middle one is the baseline.
  assert.equal(item(scores, "tier-1", 10939).pct[3], 0.25);
});

test("a missing baseline day drops that window", () => {
  const scores = scoreBaskets(TODAY, [
    row(11084, "2026-02-27", 100),
    row(11084, "2026-02-28", 100),
    row(11084, TODAY, 110),
  ]);
  const shard = item(scores, "tier-1", 11084);
  assert.equal(shard.pct[1], 0.1);
  assert.equal(shard.pct[3], null);
  assert.equal(basket(scores, "tier-1").day3.count, 0);
  assert.equal(basket(scores, "tier-1").day1.count, 1);
});

test("a basket is the equal-weight average of its item moves", () => {
  const scores = scoreBaskets(TODAY, [
    row(10940, "2026-02-28", 100),
    row(10940, TODAY, 110),
    row(10939, "2026-02-28", 100),
    row(10939, TODAY, 90),
    row(11084, "2026-02-28", 100),
    row(11084, TODAY, 130),
  ]);
  const tier = basket(scores, "tier-1");
  assert.equal(tier.day1.count, 3);
  assert.equal(tier.size, 3);
  // +10%, -10%, and +30% average to +10%. The last digit is binary rounding.
  assert.ok(tier.day1.pct != null && Math.abs(tier.day1.pct - 0.1) < 1e-12);
  const all = basket(scores, "all");
  assert.equal(all.day1.count, 3);
  assert.equal(all.size, 24);
  assert.ok(all.day1.pct != null && Math.abs(all.day1.pct - 0.1) < 1e-12);
});

test("opposite moves cancel in the basket average", () => {
  const scores = scoreBaskets(TODAY, [
    row(10940, "2026-02-28", 100),
    row(10940, TODAY, 110),
    row(10939, "2026-02-28", 100),
    row(10939, TODAY, 90),
  ]);
  assert.equal(basket(scores, "all").day1.pct, 0);
  assert.equal(basket(scores, "all").day1.count, 2);
});
