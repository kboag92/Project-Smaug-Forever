// Portfolio moves against Alliance daily medians.
// Current price is today's UTC daily median. Each window compares it with the
// median stored on the UTC day 1, 3, or 7 days earlier. The days in between
// are ignored, same as the enchanting index.
// A portfolio move is the change in copper value of the same quantities.
// An item missing today or that comparison day is left out of both sides,
// so a gap cannot inflate only the current total.

import { shiftUtcDay, WINDOWS, type WindowDays } from "./enchant-index.js";

export { shiftUtcDay, utcToday, WINDOWS } from "./enchant-index.js";
export type { WindowDays } from "./enchant-index.js";

export type Holding = { itemId: number; quantity: number };

export type PriceRow = { itemId: number; day: string; median: number };

export type HoldingScore = {
  itemId: number;
  quantity: number;
  // Today's unit median, in copper. Null when that day has no usable price.
  current: number | null;
  // quantity × current. Null when current is missing.
  value: number | null;
  pct: Record<WindowDays, number | null>;
};

// pct is a fraction (0.1 means +10%). count is how many holdings had both days.
export type WindowValue = { pct: number | null; count: number };

export type PortfolioScore = {
  // Holdings that were scored. Non-positive quantities are dropped.
  size: number;
  items: HoldingScore[];
  // Sum of line values that have today's median. Null when none do.
  total: number | null;
  day1: WindowValue;
  day3: WindowValue;
  day7: WindowValue;
};

// Last row for a day wins. A non-positive median is not a usable price.
function pricesByItem(rows: PriceRow[]): Map<number, Map<string, number>> {
  const byItem = new Map<number, Map<string, number>>();
  for (const row of rows) {
    if (!Number.isFinite(row.median) || row.median <= 0) continue;
    let days = byItem.get(row.itemId);
    if (!days) {
      days = new Map();
      byItem.set(row.itemId, days);
    }
    days.set(row.day, row.median);
  }
  return byItem;
}

// Null when today is missing, or that comparison day is missing.
// Copied from enchant-index so a portfolio line uses the same day pair.
function move(current: number | null, days: Map<string, number> | undefined, ago: number, today: string): number | null {
  if (current == null || !days) return null;
  const baseline = days.get(shiftUtcDay(today, -ago));
  if (baseline == null || baseline <= 0) return null;
  return (current - baseline) / baseline;
}

type Bucket = { now: number; then: number; count: number };

function emptyBucket(): Bucket {
  return { now: 0, then: 0, count: 0 };
}

function finish(bucket: Bucket): WindowValue {
  // A zero baseline cannot be a percent. Leave the window blank.
  if (bucket.count === 0 || bucket.then <= 0) return { pct: null, count: 0 };
  return { pct: (bucket.now - bucket.then) / bucket.then, count: bucket.count };
}

// One score per holding, in list order. Missing days stay null so the page can print a dash.
export function scorePortfolio(today: string, holdings: Holding[], rows: PriceRow[]): PortfolioScore {
  const prices = pricesByItem(rows);
  const items: HoldingScore[] = [];
  let total = 0;
  let priced = 0;
  const windows: Record<WindowDays, Bucket> = { 1: emptyBucket(), 3: emptyBucket(), 7: emptyBucket() };

  for (const holding of holdings) {
    // A blank or zero quantity is not a position. The page should not save one.
    if (!Number.isInteger(holding.quantity) || holding.quantity <= 0) continue;
    const days = prices.get(holding.itemId);
    const current = days?.get(today) ?? null;
    const value = current == null ? null : current * holding.quantity;
    const pct = { 1: null, 3: null, 7: null } as Record<WindowDays, number | null>;
    for (const window of WINDOWS) pct[window] = move(current, days, window, today);
    items.push({ itemId: holding.itemId, quantity: holding.quantity, current, value, pct });

    if (current != null) {
      total += current * holding.quantity;
      priced += 1;
    }
    for (const window of WINDOWS) {
      const baseline = days?.get(shiftUtcDay(today, -window));
      // Skip the item on both sides. Adding it only to "now" would fake a gain.
      if (current == null || baseline == null || baseline <= 0) continue;
      windows[window].now += current * holding.quantity;
      windows[window].then += baseline * holding.quantity;
      windows[window].count += 1;
    }
  }

  return {
    size: items.length,
    items,
    total: priced === 0 ? null : total,
    day1: finish(windows[1]),
    day3: finish(windows[3]),
    day7: finish(windows[7]),
  };
}
