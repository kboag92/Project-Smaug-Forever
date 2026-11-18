// Basket moves for the enchanting index.
// Current price is today's daily median. The baseline is the median of the
// daily medians on the UTC days before today. A window needs every one of those
// days, so a 7-day figure is never filled in from a shorter stretch.
// Each material gets one vote. A shard priced in gold does not outweigh a dust priced in silver.

import { baskets, MATS, type EnchantMat } from "./enchant-mats.js";

export const WINDOWS = [1, 3, 7] as const;
export type WindowDays = (typeof WINDOWS)[number];

export type PriceRow = { itemId: number; day: string; median: number };

export type ItemScore = {
  item: EnchantMat;
  current: number | null;
  pct: Record<WindowDays, number | null>;
};

export type WindowScore = { pct: number | null; count: number };

export type BasketScore = {
  id: string;
  name: string;
  size: number;
  items: ItemScore[];
  day1: WindowScore;
  day3: WindowScore;
  day7: WindowScore;
};

// YYYY-MM-DD in UTC, matching daily_prices.day.
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Step a UTC date by whole days. Month and year boundaries stay on the UTC calendar.
export function shiftUtcDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

// Middle price. A complete 1, 3, or 7 day window is odd, so this is the middle day after sorting by price.
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

function priorDates(today: string, count: number): string[] {
  const dates: string[] = [];
  for (let ago = count; ago >= 1; ago -= 1) dates.push(shiftUtcDay(today, -ago));
  return dates;
}

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

// Null when today is missing, or any baseline day is missing, or the baseline is not a positive price.
function move(current: number | null, days: Map<string, number> | undefined, dates: string[]): number | null {
  if (current == null || !days) return null;
  const values: number[] = [];
  for (const date of dates) {
    const price = days.get(date);
    if (price == null) return null;
    values.push(price);
  }
  const baseline = median(values);
  if (baseline <= 0) return null;
  return (current - baseline) / baseline;
}

function scoreItem(mat: EnchantMat, today: string, days: Map<string, number> | undefined): ItemScore {
  const current = days?.get(today) ?? null;
  const pct = { 1: null, 3: null, 7: null } as Record<WindowDays, number | null>;
  for (const window of WINDOWS) pct[window] = move(current, days, priorDates(today, window));
  return { item: mat, current, pct };
}

function average(items: ItemScore[], window: WindowDays): WindowScore {
  const values: number[] = [];
  for (const item of items) {
    const pct = item.pct[window];
    if (pct != null) values.push(pct);
  }
  if (values.length === 0) return { pct: null, count: 0 };
  const sum = values.reduce((total, value) => total + value, 0);
  return { pct: sum / values.length, count: values.length };
}

// One score per basket, in page order. Items with no row today are still listed, with empty percents.
export function scoreBaskets(today: string, rows: PriceRow[]): BasketScore[] {
  const prices = pricesByItem(rows);
  const scored = new Map<number, ItemScore>();
  for (const mat of MATS) scored.set(mat.itemId, scoreItem(mat, today, prices.get(mat.itemId)));
  return baskets().map((basket) => {
    const items = basket.members.map((mat) => scored.get(mat.itemId)!);
    return {
      id: basket.id,
      name: basket.name,
      size: items.length,
      items,
      day1: average(items, 1),
      day3: average(items, 3),
      day7: average(items, 7),
    };
  });
}
