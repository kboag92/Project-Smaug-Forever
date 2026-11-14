// Clock windows for Cycles. An 8-hour block wraps midnight.
// Two blocks overlap when their starts are closer than 8 hours on the clock.

const WIN = 8;

export function medianOf(values: number[]): number | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  if (n % 2 === 1) return sorted[Math.floor(n / 2)];
  return Math.floor((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
}

export function inWin(hour: number, start: number): boolean {
  let distance = hour - start;
  if (distance < 0) distance += 24;
  return distance < WIN;
}

export function overlap(a: number, b: number): boolean {
  let distance = Math.abs(a - b);
  if (distance > 12) distance = 24 - distance;
  return distance < WIN;
}

function clock(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h < 12) return h + "am";
  if (h === 12) return "12pm";
  return h - 12 + "pm";
}

export function winLabel(start: number): string {
  return clock(start) + "–" + clock(start + WIN);
}

export function crossHit(cheapDays: number[], richDays: number[]): [number, number] {
  let hits = 0;
  let pairs = 0;
  for (const cheap of cheapDays) {
    for (const rich of richDays) {
      pairs += 1;
      if (cheap < rich) hits += 1;
    }
  }
  if (pairs === 0) return [0, 0];
  return [hits / pairs, pairs];
}
