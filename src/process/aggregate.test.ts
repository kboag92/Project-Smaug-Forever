import assert from "node:assert/strict";
import test from "node:test";
import { listingRows, stacksFromBook } from "../blizzard/parse.js";
import { aggregateMarkets } from "./aggregate.js";
import { pickHouses, type HouseCandidate } from "./pick-houses.js";

// Plan example: 6 at 100, 10 at 200, 84 at 500. Quantity 100.
// P10 uses the cheapest 10 units: 6*100 + 4*200 = 1400, so 140 copper.
// The 10–50 band is units 11 through 50: 6*200 + 34*500 = 18200, so 455 copper.
// The 50th unit sits in the 500 stack. Average is 446.
test("P10, median, quantity, and average for the 100-unit book", () => {
  const [market] = aggregateMarkets([
    { itemId: 2589, quantity: 6, cost: 600n },
    { itemId: 2589, quantity: 10, cost: 2000n },
    { itemId: 2589, quantity: 84, cost: 42000n },
  ]);

  assert.equal(market.quantity, 100);
  assert.equal(market.p10Price, 140n);
  assert.equal(market.bandPrice, 455n);
  assert.equal(market.medianPrice, 500n);
  assert.equal(market.averagePrice, 446n);
});

// 10% of 105 units is 10.5. The cheap stack only covers 5, so the rest is split
// off the 900-copper stack: (5*100 + 5.5*900) / 10.5 = 519 copper.
test("P10 splits the stack that crosses ten percent", () => {
  const [market] = aggregateMarkets([
    { itemId: 3, quantity: 5, cost: 500n },
    { itemId: 3, quantity: 100, cost: 90000n },
  ]);

  assert.equal(market.quantity, 105);
  assert.equal(market.p10Price, 519n);
  assert.equal(market.medianPrice, 900n);
});

test("a single listed unit uses that price for every field", () => {
  const [market] = aggregateMarkets([{ itemId: 1, quantity: 1, cost: 80n }]);

  assert.equal(market.quantity, 1);
  assert.equal(market.p10Price, 80n);
  // Nothing is left after the 10% cut, so the band is that same unit.
  assert.equal(market.bandPrice, 80n);
  assert.equal(market.medianPrice, 80n);
  assert.equal(market.averagePrice, 80n);
});

test("a zero buyout is kept as a free listing", () => {
  const parsed = stacksFromBook([{ id: 1, item: { id: 8 }, quantity: 1, buyout: 0 }], []);
  const [market] = aggregateMarkets(parsed.stacks);

  assert.equal(market.quantity, 1);
  assert.equal(market.p10Price, 0n);
  assert.equal(market.averagePrice, 0n);
});

test("a commodity link object is not treated as listings", () => {
  assert.deepEqual(listingRows({ href: "https://example.test/commodities" }), []);
  assert.equal(listingRows({ auctions: [{ id: 4, item: { id: 1 }, quantity: 2, unit_price: 5 }] }).length, 1);
});

test("bid-only listings are left out of the market", () => {
  const parsed = stacksFromBook(
    [
      { id: 1, item: { id: 7 }, quantity: 1, bid: 50 },
      { id: 2, item: { id: 7 }, quantity: 2, buyout: 500 },
    ],
    [],
  );
  const [market] = aggregateMarkets(parsed.stacks);

  assert.equal(parsed.stacks.length, 1);
  assert.equal(market.quantity, 2);
  assert.equal(market.p10Price, 250n);
  assert.equal(market.medianPrice, 250n);
  assert.equal(market.averagePrice, 250n);
});

test("the same auction id is not counted twice", () => {
  const parsed = stacksFromBook(
    [{ id: 9, item: { id: 4 }, quantity: 1, unit_price: 40 }],
    [{ id: 9, item: { id: 4 }, quantity: 1, unit_price: 40 }],
  );
  const [market] = aggregateMarkets(parsed.stacks);

  assert.equal(market.quantity, 1);
  assert.equal(market.averagePrice, 40n);
});

function house(partial: Partial<HouseCandidate> & Pick<HouseCandidate, "blizzardId" | "faction">): HouseCandidate {
  return {
    name: partial.faction,
    listingIds: partial.listingIds ?? [partial.blizzardId],
    stacks: partial.stacks ?? [{ itemId: 1, quantity: 1, cost: 1n }],
    ...partial,
  };
}

test("keeps the fullest house per faction and skips an identical book", () => {
  const chosen = pickHouses([
    house({ blizzardId: 110, faction: "alliance", stacks: [], listingIds: [] }),
    house({
      blizzardId: 111,
      faction: "horde",
      listingIds: [1],
      stacks: [{ itemId: 1, quantity: 1, cost: 1n }],
    }),
    house({
      blizzardId: 113,
      faction: "horde",
      listingIds: [1, 2, 3],
      stacks: [
        { itemId: 1, quantity: 1, cost: 1n },
        { itemId: 2, quantity: 1, cost: 1n },
        { itemId: 3, quantity: 1, cost: 1n },
      ],
    }),
    // Same listing ids as the Horde winner, so this copy is not stored again.
    house({
      blizzardId: 116,
      faction: "blackwater",
      listingIds: [1, 2, 3],
      stacks: [
        { itemId: 1, quantity: 1, cost: 1n },
        { itemId: 2, quantity: 1, cost: 1n },
        { itemId: 3, quantity: 1, cost: 1n },
      ],
    }),
  ]);

  assert.deepEqual(
    chosen.map((entry) => entry.blizzardId),
    [113],
  );
});
