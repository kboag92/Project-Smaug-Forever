// One priced stack from the auction house.
// cost is the copper needed to buy the whole stack, not the unit price.
// Commodities and gear both arrive in this shape so the math stays in one place.
export type PricedStack = {
  itemId: number;
  quantity: number;
  cost: bigint;
};

// The four numbers we keep for an item on one house.
// Every price is integer copper, rounded to the nearest copper.
export type ItemMarket = {
  itemId: number;
  p10Price: bigint;
  medianPrice: bigint;
  quantity: number;
  averagePrice: bigint;
};

// Nearest copper. A remainder of at least half the divisor rounds up.
// Prices are never negative, so this does not have to care about signs.
function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("Cannot divide a price by zero.");
  }
  return (numerator + denominator / 2n) / denominator;
}

// Cheapest unit price first. Cross-multiplying avoids decimals:
// cost/qty is cheaper when cost * otherQty is smaller than otherCost * qty.
function cheaperFirst(a: PricedStack, b: PricedStack): number {
  const left = a.cost * BigInt(b.quantity);
  const right = b.cost * BigInt(a.quantity);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// Average copper of the cheapest numerator/denominator of the units.
// The stack that crosses the cut is split, so only part of its cost counts.
// A listed item always contributes at least one unit. That matters when
// 10% of a short stack would otherwise be a fraction of one item.
function sliceAverage(
  sorted: PricedStack[],
  totalQty: number,
  numerator: number,
  denominator: number,
): bigint {
  const den = BigInt(denominator);
  // Remaining is measured in (units * denominator). 10% of 105 units is 10.5.
  let remaining = BigInt(totalQty) * BigInt(numerator);
  if (remaining < den) remaining = den;

  let cost = 0n;
  let takenScaled = 0n;
  for (const stack of sorted) {
    if (remaining <= 0n) break;
    const stackScaled = BigInt(stack.quantity) * den;
    const takeScaled = remaining < stackScaled ? remaining : stackScaled;
    // Share of this stack's copper that belongs to the units we took.
    cost += (stack.cost * takeScaled) / stackScaled;
    takenScaled += takeScaled;
    remaining -= takeScaled;
  }

  if (takenScaled <= 0n) {
    throw new Error("Price slice was empty.");
  }
  // takenScaled is units * denominator, so multiply the cost back up.
  return roundDiv(cost * den, takenScaled);
}

// Unit price of the stack that holds the middle unit, counting from the cheapest.
// For 100 units the middle is unit 50. That matches a book where the cheap
// stacks are small and the median still lands in the large expensive stack.
function medianUnitPrice(sorted: PricedStack[], totalQty: number): bigint {
  const middle = Math.floor((totalQty + 1) / 2);
  let seen = 0;
  for (const stack of sorted) {
    seen += stack.quantity;
    if (seen >= middle) {
      return roundDiv(stack.cost, BigInt(stack.quantity));
    }
  }
  throw new Error("Median walk ran past the last stack.");
}

// Group stacks by item and reduce each group to P10, median, quantity, and average.
export function aggregateMarkets(stacks: PricedStack[]): ItemMarket[] {
  const grouped = new Map<number, PricedStack[]>();

  for (const stack of stacks) {
    // Skip junk rows. A cost of zero is a real free listing, so it stays.
    if (!Number.isInteger(stack.itemId) || stack.itemId <= 0) continue;
    if (!Number.isInteger(stack.quantity) || stack.quantity <= 0) continue;
    if (stack.cost < 0n) continue;

    const list = grouped.get(stack.itemId);
    if (list) list.push(stack);
    else grouped.set(stack.itemId, [stack]);
  }

  const markets: ItemMarket[] = [];
  for (const [itemId, group] of grouped) {
    const sorted = [...group].sort(cheaperFirst);
    let totalQty = 0;
    let totalCost = 0n;
    for (const stack of sorted) {
      totalQty += stack.quantity;
      totalCost += stack.cost;
    }

    markets.push({
      itemId,
      // P10 is the average price of the cheapest 10% of the quantity.
      p10Price: sliceAverage(sorted, totalQty, 1, 10),
      medianPrice: medianUnitPrice(sorted, totalQty),
      quantity: totalQty,
      // A stack of 20 counts twenty times more than a stack of 1.
      averagePrice: roundDiv(totalCost, BigInt(totalQty)),
    });
  }

  markets.sort((a, b) => a.itemId - b.itemId);
  return markets;
}
