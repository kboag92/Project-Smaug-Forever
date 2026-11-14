import assert from "node:assert/strict";
import test from "node:test";
import { findCycles, type CyclePoint } from "./cycles.js";

function point(day: number, hour: number, p10: number, med: number, at: number): CyclePoint {
  return { hour, day, p10, med, qty: 8, at };
}

// Four days of a morning dip and an afternoon peak. That is a real cycle.
test("a repeating dip and peak becomes a buy-low cycle", () => {
  const points: CyclePoint[] = [];
  for (let day = 1; day <= 4; day += 1) {
    for (const hour of [1, 2, 3]) points.push(point(day, hour, 100, 110, day * 100 + hour));
    for (const hour of [13, 14, 15]) points.push(point(day, hour, 180, 200, day * 100 + hour));
  }
  // Latest print is back at the dip, so Now is BUY.
  points.push(point(4, 1, 100, 110, 9999));

  const [row] = findCycles([{ itemId: 2589, name: "Linen", points }]);
  assert.equal(row.cheap, "12am–8am");
  assert.equal(row.low, 100);
  assert.equal(row.rich, "9am–5pm");
  assert.equal(row.high, 200);
  assert.equal(row.edge, 90);
  assert.equal(row.swing, 100);
  assert.equal(row.conf, 100);
  assert.equal(row.confMode, "same");
  assert.equal(row.phase, "buy");
  assert.equal(row.days, 4);
  assert.equal(row.avgQty, 8);
});

test("one day of scans is not a cycle", () => {
  const points: CyclePoint[] = [];
  for (const hour of [1, 2, 3, 13, 14, 15]) points.push(point(1, hour, 100, 200, hour));
  assert.deepEqual(findCycles([{ itemId: 1, name: "", points }]), []);
});
