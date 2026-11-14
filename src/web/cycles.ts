// Daily clock swings, matching Midas Cycles.
// Cheap is the 8-hour window with the lowest median P10.
// Rich is a non-overlapping window with the highest median ask.
// A row is kept only when the swing, the repeat rate, and the post-cut edge all pass.

import { crossHit, inWin, medianOf, overlap, winLabel } from "./cycles-clock.js";

const STARTS = [0, 3, 6, 9, 12, 15, 18, 21];
const MIN_SCANS = 8;
const MIN_DAYS = 3;
const MIN_SIDE = 3;
const MIN_SIDE_DAYS = 2;
const MIN_SWING = 0.1;
const MIN_HIT = 0.65;
const MIN_PAIRS = 4;
const MIN_SAME_PAIRS = 2;
const AH_CUT = 0.05;
const PHASE_BUY = 0.33;
const PHASE_SELL = 0.67;

export type CyclePoint = {
  hour: number;
  day: number;
  p10: number | null;
  med: number | null;
  qty: number | null;
  at: number;
};

export type CycleItem = { itemId: number; name: string; icon?: string | null; points: CyclePoint[] };

export type CycleRow = {
  itemId: number;
  name: string;
  icon: string | null;
  cheap: string;
  low: number;
  rich: string;
  high: number;
  edge: number;
  swing: number;
  conf: number;
  confMode: "same" | "cross";
  phase: "buy" | "sell" | "mid";
  curP10: number | null;
  days: number;
  scans: number;
  avgQty: number | null;
};

function takeWin(points: CyclePoint[], start: number, field: "p10" | "med"): number[] {
  const out: number[] = [];
  for (const point of points) {
    if (!inWin(point.hour, start)) continue;
    const value = point[field];
    if (value != null && value > 0) out.push(value);
  }
  return out;
}

export function findCycles(items: CycleItem[]): CycleRow[] {
  const rows: CycleRow[] = [];
  for (const item of items) {
    const points = item.points;
    const dayCount = new Set(points.map((point) => point.day)).size;
    // One play session is not a cycle. It has to repeat across days.
    if (points.length < MIN_SCANS || dayCount < MIN_DAYS) continue;

    let loP10: number | null = null;
    let hiMed: number | null = null;
    for (const point of points) {
      if (point.p10 != null && (loP10 == null || point.p10 < loP10)) loP10 = point.p10;
      if (point.med != null && (hiMed == null || point.med > hiMed)) hiMed = point.med;
    }
    if (loP10 == null || hiMed == null || !(hiMed > loP10 * (1 + MIN_SWING))) continue;

    let cheap: { start: number; level: number } | null = null;
    const sellWins: { start: number; level: number }[] = [];
    for (const start of STARTS) {
      const buys = takeWin(points, start, "p10");
      if (buys.length >= MIN_SIDE) {
        const level = medianOf(buys);
        if (level != null && (cheap == null || level < cheap.level)) cheap = { start, level };
      }
      const sells = takeWin(points, start, "med");
      if (sells.length >= MIN_SIDE) {
        const level = medianOf(sells);
        if (level != null) sellWins.push({ start, level });
      }
    }

    let rich: { start: number; level: number } | null = null;
    if (cheap) {
      for (const win of sellWins) {
        if (win.start === cheap.start || overlap(win.start, cheap.start)) continue;
        if (rich == null || win.level > rich.level) rich = win;
      }
    }
    if (!cheap || !rich || !(rich.level > cheap.level * (1 + MIN_SWING))) continue;

    const byDay = new Map<number, { cheap: number[]; rich: number[] }>();
    for (const point of points) {
      let bucket = byDay.get(point.day);
      if (!bucket) {
        bucket = { cheap: [], rich: [] };
        byDay.set(point.day, bucket);
      }
      if (inWin(point.hour, cheap.start) && point.p10 != null) bucket.cheap.push(point.p10);
      else if (inWin(point.hour, rich.start) && point.med != null) bucket.rich.push(point.med);
    }

    const cheapDays: number[] = [];
    const richDays: number[] = [];
    let sameHits = 0;
    let samePairs = 0;
    for (const bucket of byDay.values()) {
      const cheapMedian = medianOf(bucket.cheap);
      const richMedian = medianOf(bucket.rich);
      if (cheapMedian != null) cheapDays.push(cheapMedian);
      if (richMedian != null) richDays.push(richMedian);
      if (cheapMedian != null && richMedian != null) {
        samePairs += 1;
        if (cheapMedian < richMedian) sameHits += 1;
      }
    }

    // Same-day pairs are the stronger proof. Cross-day is the fallback.
    let hitRate = 0;
    let pairs = 0;
    let confMode: "same" | "cross" | null = null;
    if (samePairs >= MIN_SAME_PAIRS) {
      confMode = "same";
      pairs = samePairs;
      hitRate = sameHits / samePairs;
    } else if (cheapDays.length >= MIN_SIDE_DAYS && richDays.length >= MIN_SIDE_DAYS) {
      confMode = "cross";
      [hitRate, pairs] = crossHit(cheapDays, richDays);
    }
    const minPairs = confMode === "same" ? MIN_SAME_PAIRS : MIN_PAIRS;
    if (!confMode || pairs < minPairs || hitRate < MIN_HIT) continue;

    const low = cheap.level;
    const high = rich.level;
    const edge = Math.floor(high * (1 - AH_CUT) + 0.5) - low;
    if (edge <= 0) continue;

    let curP10: number | null = null;
    let curAt = -1;
    let qtySum = 0;
    let qtyCount = 0;
    for (const point of points) {
      if (point.p10 != null && point.p10 > 0 && point.at >= curAt) {
        curP10 = point.p10;
        curAt = point.at;
      }
      if (point.qty != null && point.qty >= 0) {
        qtySum += point.qty;
        qtyCount += 1;
      }
    }

    let phase: CycleRow["phase"] = "mid";
    if (curP10 != null && high > low) {
      const pos = (curP10 - low) / (high - low);
      if (pos <= PHASE_BUY) phase = "buy";
      else if (pos >= PHASE_SELL) phase = "sell";
    }

    rows.push({
      itemId: item.itemId,
      name: item.name,
      icon: item.icon || null,
      cheap: winLabel(cheap.start),
      low,
      rich: winLabel(rich.start),
      high,
      edge,
      swing: (high / low - 1) * 100,
      conf: hitRate * 100,
      confMode,
      phase,
      curP10,
      days: dayCount,
      scans: points.length,
      avgQty: qtyCount > 0 ? qtySum / qtyCount : null,
    });
  }
  return rows;
}
